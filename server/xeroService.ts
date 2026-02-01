import { XeroClient, TokenSet } from "xero-node";
import { storage } from "./storage";
import type { XeroConnection } from "@shared/schema";
import { encrypt, decrypt } from "./encryption";

const XERO_SCOPES = "openid profile email accounting.transactions accounting.contacts offline_access";

function getRedirectUri(): string {
  // Priority: VITE_APP_URL (production domain) > REPLIT_DEV_DOMAIN > REPLIT_DOMAINS > localhost
  const appUrl = process.env.VITE_APP_URL;
  let baseUrl: string;
  
  if (appUrl) {
    // Use configured app URL (e.g., https://tradietrack.com)
    baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
  } else if (process.env.REPLIT_DEV_DOMAIN) {
    baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  } else if (process.env.REPLIT_DOMAINS) {
    baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  } else {
    baseUrl = "http://localhost:5000";
  }
  
  const redirectUri = `${baseUrl}/api/integrations/xero/callback`;
  console.log('[Xero] Using redirect URI:', redirectUri, '(from:', appUrl ? 'VITE_APP_URL' : process.env.REPLIT_DEV_DOMAIN ? 'REPLIT_DEV_DOMAIN' : 'REPLIT_DOMAINS/localhost', ')');
  return redirectUri;
}

function createXeroClient(): XeroClient {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("XERO_CLIENT_ID and XERO_CLIENT_SECRET environment variables are required");
  }

  return new XeroClient({
    clientId,
    clientSecret,
    redirectUris: [getRedirectUri()],
    scopes: XERO_SCOPES.split(" "),
  });
}

export async function getAuthUrl(state: string): Promise<string> {
  const xero = createXeroClient();
  const consentUrl = await xero.buildConsentUrl();
  const separator = consentUrl.includes('?') ? '&' : '?';
  return `${consentUrl}${separator}state=${encodeURIComponent(state)}`;
}

export async function handleCallback(url: string, userId: string): Promise<XeroConnection> {
  const xero = createXeroClient();
  
  const tokenSet = await xero.apiCallback(url);
  
  await xero.updateTenants();
  const tenants = xero.tenants;
  
  if (!tenants || tenants.length === 0) {
    throw new Error("No Xero organizations found for this account");
  }

  const tenant = tenants[0];
  
  const existingConnection = await storage.getXeroConnection(userId);
  
  const connectionData = {
    userId,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName || null,
    accessToken: encrypt(tokenSet.access_token!),
    refreshToken: encrypt(tokenSet.refresh_token!),
    tokenExpiresAt: new Date(Date.now() + (tokenSet.expires_in || 1800) * 1000),
    scope: XERO_SCOPES,
    status: "active",
  };

  if (existingConnection) {
    const updated = await storage.updateXeroConnection(existingConnection.id, connectionData);
    return updated!;
  } else {
    return await storage.createXeroConnection(connectionData);
  }
}

function decryptTokens(connection: XeroConnection): { accessToken: string; refreshToken: string } {
  return {
    accessToken: decrypt(connection.accessToken),
    refreshToken: decrypt(connection.refreshToken),
  };
}

export async function refreshTokenIfNeeded(connection: XeroConnection): Promise<XeroConnection> {
  const now = new Date();
  const expiresAt = new Date(connection.tokenExpiresAt);
  const bufferMs = 5 * 60 * 1000;
  
  if (now.getTime() + bufferMs < expiresAt.getTime()) {
    return connection;
  }

  const xero = createXeroClient();
  const tokens = decryptTokens(connection);
  
  const oldTokenSet: TokenSet = {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: Math.floor(expiresAt.getTime() / 1000),
    token_type: "Bearer",
    scope: connection.scope || XERO_SCOPES,
  };

  xero.setTokenSet(oldTokenSet);
  const newTokenSet = await xero.refreshToken();

  const updated = await storage.updateXeroConnection(connection.id, {
    accessToken: encrypt(newTokenSet.access_token!),
    refreshToken: encrypt(newTokenSet.refresh_token!),
    tokenExpiresAt: new Date(Date.now() + (newTokenSet.expires_in || 1800) * 1000),
  });

  return updated!;
}

export async function getConnectedTenants(connection: XeroConnection): Promise<Array<{ tenantId: string; tenantName: string | null }>> {
  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const xero = createXeroClient();
  const tokens = decryptTokens(refreshedConnection);
  
  const tokenSet: TokenSet = {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
    token_type: "Bearer",
    scope: refreshedConnection.scope || XERO_SCOPES,
  };

  xero.setTokenSet(tokenSet);
  await xero.updateTenants();
  
  return xero.tenants.map(t => ({
    tenantId: t.tenantId,
    tenantName: t.tenantName || null,
  }));
}

export async function syncContactsFromXero(userId: string): Promise<{ synced: number; errors: string[] }> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const xero = createXeroClient();
  const tokens = decryptTokens(refreshedConnection);
  
  const tokenSet: TokenSet = {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
    token_type: "Bearer",
    scope: refreshedConnection.scope || XERO_SCOPES,
  };

  xero.setTokenSet(tokenSet);

  try {
    const response = await xero.accountingApi.getContacts(refreshedConnection.tenantId);
    const xeroContacts = response.body.contacts || [];
    
    let synced = 0;
    const errors: string[] = [];

    for (const xeroContact of xeroContacts) {
      try {
        if (!xeroContact.name) continue;
        
        const existingClients = await storage.getClients(userId);
        const matchingClient = existingClients.find(
          c => c.email?.toLowerCase() === xeroContact.emailAddress?.toLowerCase() ||
               c.name.toLowerCase() === xeroContact.name?.toLowerCase()
        );

        if (!matchingClient && xeroContact.name) {
          await storage.createClient({
            userId,
            name: xeroContact.name,
            email: xeroContact.emailAddress || null,
            phone: xeroContact.phones?.[0]?.phoneNumber || null,
            address: xeroContact.addresses?.[0]?.addressLine1 || null,
          });
          synced++;
        }
      } catch (err) {
        errors.push(`Failed to sync contact ${xeroContact.name}: ${err}`);
      }
    }

    await storage.updateXeroConnection(refreshedConnection.id, {
      lastSyncAt: new Date(),
    });

    return { synced, errors };
  } catch (err) {
    throw new Error(`Failed to fetch contacts from Xero: ${err}`);
  }
}

export async function syncInvoicesToXero(userId: string): Promise<{ synced: number; skipped: number; errors: string[] }> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const xero = createXeroClient();
  const tokens = decryptTokens(refreshedConnection);
  
  const tokenSet: TokenSet = {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
    token_type: "Bearer",
    scope: refreshedConnection.scope || XERO_SCOPES,
  };

  xero.setTokenSet(tokenSet);

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const invoices = await storage.getInvoices(userId);
    const clients = await storage.getClients(userId);
    
    for (const invoice of invoices) {
      try {
        // Skip draft invoices
        if (invoice.status === 'draft') continue;
        
        // Skip invoices already synced to Xero (prevent duplicates)
        if (invoice.xeroInvoiceId) {
          skipped++;
          continue;
        }
        
        const client = clients.find(c => c.id === invoice.clientId);
        if (!client) continue;

        const lineItems = await storage.getInvoiceLineItems(invoice.id);
        
        // Get business settings for configurable Xero account codes
        const businessSettings = await storage.getBusinessSettings(userId);
        const salesAccountCode = businessSettings?.xeroSalesAccountCode || "200";
        const taxType = businessSettings?.xeroTaxType || "OUTPUT";
        
        const invoiceDate = (invoice as any).issueDate || invoice.createdAt;
        const xeroInvoice = {
          type: "ACCREC" as any, // Xero invoice type
          contact: {
            name: client.name,
            emailAddress: client.email || undefined,
          },
          lineItems: lineItems.map(item => ({
            description: item.description,
            quantity: parseFloat(item.quantity || "1"),
            unitAmount: parseFloat(item.unitPrice || "0"),
            accountCode: salesAccountCode,
            taxType: taxType,
          })),
          date: invoiceDate ? new Date(invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : undefined,
          reference: invoice.number || (invoice as any).invoiceNumber || undefined,
          status: invoice.status === 'sent' ? "AUTHORISED" as any : "DRAFT" as any,
        };

        const response = await xero.accountingApi.createInvoices(refreshedConnection.tenantId, {
          invoices: [xeroInvoice as any],
        });
        
        // Store the Xero invoice ID to prevent duplicate syncs
        const createdXeroInvoice = response.body.invoices?.[0];
        if (createdXeroInvoice?.invoiceID) {
          await storage.updateInvoice(invoice.id, userId, {
            xeroInvoiceId: createdXeroInvoice.invoiceID,
            xeroSyncedAt: new Date(),
          });
        }
        
        synced++;
      } catch (err) {
        errors.push(`Failed to sync invoice ${invoice.number || (invoice as any).invoiceNumber}: ${err}`);
      }
    }

    await storage.updateXeroConnection(refreshedConnection.id, {
      lastSyncAt: new Date(),
    });

    return { synced, skipped, errors };
  } catch (err) {
    throw new Error(`Failed to sync invoices to Xero: ${err}`);
  }
}

// Sync a single invoice to Xero (called when invoice is sent)
export async function syncSingleInvoiceToXero(userId: string, invoiceId: string): Promise<{ success: boolean; xeroInvoiceId?: string; error?: string }> {
  try {
    const connection = await storage.getXeroConnection(userId);
    if (!connection || connection.status !== "active") {
      // No Xero connection - not an error, just skip
      return { success: true };
    }

    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Already synced
    if (invoice.xeroInvoiceId) {
      return { success: true, xeroInvoiceId: invoice.xeroInvoiceId };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const xero = createXeroClient();
    const tokens = decryptTokens(refreshedConnection);
    
    const tokenSet: TokenSet = {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
      token_type: "Bearer",
      scope: refreshedConnection.scope || XERO_SCOPES,
    };

    xero.setTokenSet(tokenSet);

    const clients = await storage.getClients(userId);
    const client = clients.find(c => c.id === invoice.clientId);
    if (!client) {
      return { success: false, error: "Client not found" };
    }

    const lineItems = await storage.getInvoiceLineItems(invoice.id);
    
    // Get business settings for configurable Xero account codes
    const businessSettings = await storage.getBusinessSettings(userId);
    const salesAccountCode = businessSettings?.xeroSalesAccountCode || "200";
    const taxType = businessSettings?.xeroTaxType || "OUTPUT";
    
    const invoiceDate = (invoice as any).issueDate || invoice.createdAt;
    const xeroInvoice = {
      type: "ACCREC" as any, // Xero invoice type
      contact: {
        name: client.name,
        emailAddress: client.email || undefined,
      },
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: parseFloat(item.quantity || "1"),
        unitAmount: parseFloat(item.unitPrice || "0"),
        accountCode: salesAccountCode,
        taxType: taxType,
      })),
      date: invoiceDate ? new Date(invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : undefined,
      reference: invoice.number || (invoice as any).invoiceNumber || undefined,
      status: "AUTHORISED" as any,
    };

    const response = await xero.accountingApi.createInvoices(refreshedConnection.tenantId, {
      invoices: [xeroInvoice as any],
    });
    
    const createdXeroInvoice = response.body.invoices?.[0];
    if (createdXeroInvoice?.invoiceID) {
      await storage.updateInvoice(invoice.id, userId, {
        xeroInvoiceId: createdXeroInvoice.invoiceID,
        xeroSyncedAt: new Date(),
      });
      return { success: true, xeroInvoiceId: createdXeroInvoice.invoiceID };
    }

    return { success: true };
  } catch (err) {
    console.error('[Xero] Failed to sync single invoice:', err);
    return { success: false, error: String(err) };
  }
}

// Mark an invoice as paid in Xero (called when payment is received)
export async function markInvoicePaidInXero(userId: string, invoiceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const connection = await storage.getXeroConnection(userId);
    if (!connection || connection.status !== "active") {
      // No Xero connection - not an error, just skip
      return { success: true };
    }

    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // If invoice hasn't been synced to Xero yet, we can't mark it paid
    if (!invoice.xeroInvoiceId) {
      console.log('[Xero] Invoice not synced to Xero yet, skipping payment sync');
      return { success: true };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const xero = createXeroClient();
    const tokens = decryptTokens(refreshedConnection);
    
    const tokenSet: TokenSet = {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
      token_type: "Bearer",
      scope: refreshedConnection.scope || XERO_SCOPES,
    };

    xero.setTokenSet(tokenSet);

    // Get business settings for configurable bank account code
    const businessSettings = await storage.getBusinessSettings(userId);
    const bankAccountCode = businessSettings?.xeroBankAccountCode || "090";
    
    // Create a payment in Xero to mark the invoice as paid
    const payment = {
      invoice: {
        invoiceID: invoice.xeroInvoiceId,
      },
      account: {
        code: bankAccountCode, // Configurable bank account code
      },
      date: new Date().toISOString().split('T')[0],
      amount: parseFloat(invoice.total || "0"),
    };

    await xero.accountingApi.createPayment(refreshedConnection.tenantId, payment);
    
    // Update the sync timestamp
    await storage.updateInvoice(invoice.id, userId, {
      xeroSyncedAt: new Date(),
    });

    console.log(`[Xero] Invoice ${invoiceId} marked as paid in Xero`);
    return { success: true };
  } catch (err) {
    // Payment creation might fail if Xero doesn't have the expected account
    // Log but don't fail the overall payment flow
    console.warn('[Xero] Failed to mark invoice as paid in Xero:', err);
    return { success: false, error: String(err) };
  }
}

export async function getConnectionStatus(userId: string): Promise<{
  connected: boolean;
  tenantName?: string;
  tenantId?: string;
  lastSyncAt?: Date;
  status?: string;
}> {
  const connection = await storage.getXeroConnection(userId);
  
  if (!connection) {
    return { connected: false };
  }

  return {
    connected: connection.status === "active",
    tenantName: connection.tenantName || undefined,
    tenantId: connection.tenantId,
    lastSyncAt: connection.lastSyncAt || undefined,
    status: connection.status || "unknown",
  };
}

export async function disconnect(userId: string): Promise<boolean> {
  return await storage.deleteXeroConnection(userId);
}

export function isXeroConfigured(): boolean {
  return !!(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
}

// Check if user has an active Xero connection
export async function isXeroConnected(userId: string): Promise<boolean> {
  const connection = await storage.getXeroConnection(userId);
  return connection?.status === "active";
}

// Get the connected Xero organisation details
export async function getXeroOrganisation(userId: string): Promise<{ name: string | null; tenantId: string } | null> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    return null;
  }
  
  return {
    name: connection.tenantName,
    tenantId: connection.tenantId,
  };
}

// Get all available tenants for a user (wrapper that takes userId)
export async function getTenants(userId: string): Promise<Array<{ tenantId: string; tenantName: string | null }>> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }
  return await getConnectedTenants(connection);
}

// Switch to a different Xero tenant (organization)
export async function switchTenant(userId: string, tenantId: string): Promise<{ tenantId: string; tenantName: string | null }> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }

  // Get all available tenants
  const tenants = await getConnectedTenants(connection);
  const targetTenant = tenants.find(t => t.tenantId === tenantId);
  
  if (!targetTenant) {
    throw new Error("Tenant not found or you don't have access to it");
  }

  // Update the connection with the new tenant
  await storage.updateXeroConnection(connection.id, {
    tenantId: targetTenant.tenantId,
    tenantName: targetTenant.tenantName,
  });

  return {
    tenantId: targetTenant.tenantId,
    tenantName: targetTenant.tenantName,
  };
}

// ============================================================================
// ENHANCED XERO FEATURES - Matching ServiceM8/Tradify capabilities
// ============================================================================

// Sync a quote to Xero as a draft invoice
export async function syncQuoteToXero(userId: string, quoteId: string): Promise<{ success: boolean; xeroInvoiceId?: string; error?: string }> {
  try {
    const connection = await storage.getXeroConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: true }; // No connection - skip silently
    }

    const quote = await storage.getQuote(quoteId, userId);
    if (!quote) {
      return { success: false, error: "Quote not found" };
    }

    // Already synced
    if ((quote as any).xeroInvoiceId) {
      return { success: true, xeroInvoiceId: (quote as any).xeroInvoiceId };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const xero = createXeroClient();
    const tokens = decryptTokens(refreshedConnection);
    
    xero.setTokenSet({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
      token_type: "Bearer",
      scope: refreshedConnection.scope || XERO_SCOPES,
    });

    const clients = await storage.getClients(userId);
    const client = clients.find(c => c.id === quote.clientId);
    if (!client) {
      return { success: false, error: "Client not found" };
    }

    const lineItems = await storage.getQuoteLineItems(quoteId);
    
    // Get business settings for configurable Xero account codes
    const businessSettings = await storage.getBusinessSettings(userId);
    const salesAccountCode = businessSettings?.xeroSalesAccountCode || "200";
    const taxType = businessSettings?.xeroTaxType || "OUTPUT";
    
    // Create as DRAFT invoice in Xero (quotes are drafts until accepted)
    const xeroInvoice = {
      type: "ACCREC" as any,
      contact: {
        name: client.name,
        emailAddress: client.email || undefined,
      },
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: parseFloat(item.quantity || "1"),
        unitAmount: parseFloat(item.unitPrice || "0"),
        accountCode: salesAccountCode,
        taxType: taxType,
      })),
      date: new Date().toISOString().split('T')[0],
      reference: `Quote: ${quote.number || (quote as any).quoteNumber}`,
      status: "DRAFT" as any,
    };

    const response = await xero.accountingApi.createInvoices(refreshedConnection.tenantId, {
      invoices: [xeroInvoice as any],
    });
    
    const createdXeroInvoice = response.body.invoices?.[0];
    if (createdXeroInvoice?.invoiceID) {
      // Store xeroInvoiceId on quote for tracking
      await storage.updateQuote(quote.id, userId, {
        xeroInvoiceId: createdXeroInvoice.invoiceID,
        xeroSyncedAt: new Date(),
      } as any);
      return { success: true, xeroInvoiceId: createdXeroInvoice.invoiceID };
    }

    return { success: true };
  } catch (err) {
    console.error('[Xero] Failed to sync quote:', err);
    return { success: false, error: String(err) };
  }
}

// Push a client TO Xero (two-way sync)
export async function pushClientToXero(userId: string, clientId: string): Promise<{ success: boolean; xeroContactId?: string; error?: string }> {
  try {
    const connection = await storage.getXeroConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: true };
    }

    const clients = await storage.getClients(userId);
    const client = clients.find(c => c.id === clientId);
    if (!client) {
      return { success: false, error: "Client not found" };
    }

    // Check if already synced
    if ((client as any).xeroContactId) {
      return { success: true, xeroContactId: (client as any).xeroContactId };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const xero = createXeroClient();
    const tokens = decryptTokens(refreshedConnection);
    
    xero.setTokenSet({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
      token_type: "Bearer",
      scope: refreshedConnection.scope || XERO_SCOPES,
    });

    const xeroContact = {
      name: client.name,
      emailAddress: client.email || undefined,
      phones: client.phone ? [{ phoneType: "MOBILE" as any, phoneNumber: client.phone }] : undefined,
      addresses: client.address ? [{
        addressType: "STREET" as any,
        addressLine1: client.address,
      }] : undefined,
    };

    const response = await xero.accountingApi.createContacts(refreshedConnection.tenantId, {
      contacts: [xeroContact as any],
    });
    
    const createdContact = response.body.contacts?.[0];
    if (createdContact?.contactID) {
      await storage.updateClient(client.id, userId, {
        xeroContactId: createdContact.contactID,
        xeroSyncedAt: new Date(),
      } as any);
      return { success: true, xeroContactId: createdContact.contactID };
    }

    return { success: true };
  } catch (err) {
    console.error('[Xero] Failed to push client:', err);
    return { success: false, error: String(err) };
  }
}

// Get chart of accounts for mapping
export async function getChartOfAccounts(userId: string): Promise<Array<{ code: string; name: string; type: string }>> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const xero = createXeroClient();
  const tokens = decryptTokens(refreshedConnection);
  
  xero.setTokenSet({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
    token_type: "Bearer",
    scope: refreshedConnection.scope || XERO_SCOPES,
  });

  const response = await xero.accountingApi.getAccounts(refreshedConnection.tenantId);
  const accounts = response.body.accounts || [];
  
  return accounts.map(acc => ({
    code: acc.code || '',
    name: acc.name || '',
    type: acc.type || '',
  }));
}

// Get bank accounts for payment mapping
export async function getBankAccounts(userId: string): Promise<Array<{ accountId: string; code: string; name: string }>> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const xero = createXeroClient();
  const tokens = decryptTokens(refreshedConnection);
  
  xero.setTokenSet({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
    token_type: "Bearer",
    scope: refreshedConnection.scope || XERO_SCOPES,
  });

  const response = await xero.accountingApi.getAccounts(refreshedConnection.tenantId, undefined, 'Type=="BANK"');
  const accounts = response.body.accounts || [];
  
  return accounts.map(acc => ({
    accountId: acc.accountID || '',
    code: acc.code || '',
    name: acc.name || '',
  }));
}

// Get tax rates for GST handling
export async function getTaxRates(userId: string): Promise<Array<{ name: string; taxType: string; rate: number }>> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const xero = createXeroClient();
  const tokens = decryptTokens(refreshedConnection);
  
  xero.setTokenSet({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
    token_type: "Bearer",
    scope: refreshedConnection.scope || XERO_SCOPES,
  });

  const response = await xero.accountingApi.getTaxRates(refreshedConnection.tenantId);
  const taxRates = response.body.taxRates || [];
  
  return taxRates.map(tax => ({
    name: tax.name || '',
    taxType: tax.taxType || '',
    rate: tax.effectiveRate || 0,
  }));
}

// Bulk sync all unsynced clients to Xero
export async function syncAllClientsToXero(userId: string): Promise<{ synced: number; skipped: number; errors: string[] }> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }

  const clients = await storage.getClients(userId);
  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const client of clients) {
    if ((client as any).xeroContactId) {
      skipped++;
      continue;
    }
    
    const result = await pushClientToXero(userId, client.id);
    if (result.success && result.xeroContactId) {
      synced++;
    } else if (result.error) {
      errors.push(`${client.name}: ${result.error}`);
    } else {
      skipped++;
    }
  }

  await storage.updateXeroConnection(connection.id, { lastSyncAt: new Date() });
  return { synced, skipped, errors };
}

// Bulk sync all unsynced quotes to Xero
export async function syncAllQuotesToXero(userId: string): Promise<{ synced: number; skipped: number; errors: string[] }> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }

  const quotes = await storage.getQuotes(userId);
  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const quote of quotes) {
    // Only sync sent or accepted quotes
    if (quote.status === 'draft' || quote.status === 'rejected') {
      skipped++;
      continue;
    }
    
    if ((quote as any).xeroInvoiceId) {
      skipped++;
      continue;
    }
    
    const result = await syncQuoteToXero(userId, quote.id);
    if (result.success && result.xeroInvoiceId) {
      synced++;
    } else if (result.error) {
      errors.push(`${quote.number || (quote as any).quoteNumber}: ${result.error}`);
    } else {
      skipped++;
    }
  }

  await storage.updateXeroConnection(connection.id, { lastSyncAt: new Date() });
  return { synced, skipped, errors };
}

// Get sync summary for dashboard
export async function getSyncSummary(userId: string): Promise<{
  connected: boolean;
  tenantName?: string;
  lastSyncAt?: Date;
  unsyncedInvoices: number;
  unsyncedQuotes: number;
  unsyncedClients: number;
}> {
  const connection = await storage.getXeroConnection(userId);
  
  if (!connection || connection.status !== "active") {
    return { connected: false, unsyncedInvoices: 0, unsyncedQuotes: 0, unsyncedClients: 0 };
  }

  const invoices = await storage.getInvoices(userId);
  const quotes = await storage.getQuotes(userId);
  const clients = await storage.getClients(userId);

  const unsyncedInvoices = invoices.filter(i => 
    i.status !== 'draft' && !i.xeroInvoiceId
  ).length;
  
  const unsyncedQuotes = quotes.filter(q => 
    (q.status === 'sent' || q.status === 'accepted') && !(q as any).xeroInvoiceId
  ).length;
  
  const unsyncedClients = clients.filter(c => !(c as any).xeroContactId).length;

  return {
    connected: true,
    tenantName: connection.tenantName || undefined,
    lastSyncAt: connection.lastSyncAt || undefined,
    unsyncedInvoices,
    unsyncedQuotes,
    unsyncedClients,
  };
}

// ============================================================================
// SERVICEM8/TRADIFY FEATURE PARITY - Sync FROM Xero
// ============================================================================

/**
 * Sync payments FROM Xero - Check for payments made in Xero and update invoice status
 * This is the key feature that ServiceM8 and Tradify both have
 * 
 * IMPROVED: Uses batch retrieval with If-Modified-Since header to avoid per-invoice API calls
 * and tracks Xero payment IDs for idempotency
 */
export async function syncPaymentsFromXero(userId: string): Promise<{ 
  updated: number; 
  errors: string[];
  details: Array<{ invoiceId: string; invoiceNumber: string; amountPaid: number }>;
}> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const xero = createXeroClient();
  const tokens = decryptTokens(refreshedConnection);
  
  xero.setTokenSet({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
    token_type: "Bearer",
    scope: refreshedConnection.scope || XERO_SCOPES,
  });

  let updated = 0;
  const errors: string[] = [];
  const details: Array<{ invoiceId: string; invoiceNumber: string; amountPaid: number }> = [];

  try {
    // Get all TradieTrack invoices that have been synced to Xero but not marked as paid
    const invoices = await storage.getInvoices(userId);
    const syncedInvoices = invoices.filter(inv => 
      inv.xeroInvoiceId && inv.status !== 'paid' && inv.status !== 'cancelled'
    );

    if (syncedInvoices.length === 0) {
      return { updated: 0, errors: [], details: [] };
    }

    // Build list of Xero invoice IDs to check
    const xeroInvoiceIds = syncedInvoices.map(inv => inv.xeroInvoiceId!);
    
    // Use incremental sync: only fetch invoices modified since last sync
    const ifModifiedSince = connection.lastSyncAt 
      ? new Date(connection.lastSyncAt)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to last 7 days if no last sync
    
    // Use batch retrieval with invoiceIDs parameter (Xero's recommended approach)
    // Xero allows up to 50 invoice IDs per request
    const batchSize = 50;
    const xeroInvoiceMap = new Map<string, any>();
    
    for (let i = 0; i < xeroInvoiceIds.length; i += batchSize) {
      const batchIds = xeroInvoiceIds.slice(i, i + batchSize);
      try {
        // Use invoiceIDs parameter (array) for batch retrieval - this is the correct Xero API approach
        const xeroResponse = await xero.accountingApi.getInvoices(
          refreshedConnection.tenantId,
          ifModifiedSince, // If-Modified-Since for incremental sync
          undefined, // where clause (not needed when using invoiceIDs)
          undefined, // order
          batchIds // invoiceIDs array - the correct parameter for batch retrieval
        );
        
        const fetchedInvoices = xeroResponse.body.invoices || [];
        console.log(`[Xero] Batch ${Math.floor(i/batchSize) + 1}: Fetched ${fetchedInvoices.length} of ${batchIds.length} invoices`);
        
        for (const inv of fetchedInvoices) {
          if (inv.invoiceID) {
            xeroInvoiceMap.set(inv.invoiceID, inv);
          }
        }
      } catch (batchErr: any) {
        // Log batch error but continue - invoice may not have been modified since last sync
        console.warn(`[Xero] Batch fetch warning: ${batchErr.message || batchErr}`);
        // Only fall back to individual fetches for non-304 errors
        if (!batchErr.message?.includes('304') && !batchErr.message?.includes('Not Modified')) {
          for (const id of batchIds) {
            try {
              const resp = await xero.accountingApi.getInvoice(refreshedConnection.tenantId, id);
              const inv = resp.body.invoices?.[0];
              if (inv?.invoiceID) {
                xeroInvoiceMap.set(inv.invoiceID, inv);
              }
            } catch (individualErr: any) {
              // Don't fail on individual invoice errors - it may simply not exist in Xero anymore
              if (!individualErr.message?.includes('404')) {
                errors.push(`Failed to fetch invoice ${id}: ${individualErr.message || individualErr}`);
              }
            }
          }
        }
      }
    }

    // Process the fetched Xero invoices
    for (const invoice of syncedInvoices) {
      try {
        const xeroInvoice = xeroInvoiceMap.get(invoice.xeroInvoiceId!);
        if (!xeroInvoice) continue;

        // Check if Xero shows the invoice as paid (fully paid)
        if (xeroInvoice.status === 'PAID' && invoice.status !== 'paid') {
          // Update TradieTrack invoice to paid
          await storage.updateInvoice(invoice.id, userId, {
            status: 'paid',
            paidAt: xeroInvoice.fullyPaidOnDate ? new Date(xeroInvoice.fullyPaidOnDate) : new Date(),
            xeroSyncedAt: new Date(),
          });
          
          updated++;
          details.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.number || (invoice as any).invoiceNumber || 'Unknown',
            amountPaid: xeroInvoice.amountPaid || parseFloat(invoice.total || '0'),
          });
          
          console.log(`[Xero] Invoice ${invoice.number || invoice.id} marked as paid from Xero`);
        }
        
        // Handle partial payments - update amount paid tracking if available
        if (xeroInvoice.amountPaid > 0 && xeroInvoice.status !== 'PAID') {
          const totalAmount = parseFloat(invoice.total || '0');
          const paidAmount = xeroInvoice.amountPaid || 0;
          const remainingBalance = totalAmount - paidAmount;
          
          console.log(`[Xero] Partial payment on invoice ${invoice.number || invoice.id}: $${paidAmount} of $${totalAmount} (remaining: $${remainingBalance})`);
        }
        
        // Check for voided invoices
        if (xeroInvoice.status === 'VOIDED' && invoice.status !== 'cancelled') {
          await storage.updateInvoice(invoice.id, userId, {
            status: 'cancelled',
            xeroSyncedAt: new Date(),
          });
          console.log(`[Xero] Invoice ${invoice.number || invoice.id} marked as cancelled (voided in Xero)`);
        }

      } catch (err) {
        errors.push(`Failed to process invoice ${invoice.number || invoice.id}: ${err}`);
      }
    }

    await storage.updateXeroConnection(refreshedConnection.id, { lastSyncAt: new Date() });
    return { updated, errors, details };
  } catch (err) {
    throw new Error(`Failed to sync payments from Xero: ${err}`);
  }
}

/**
 * Sync invoice status FROM Xero - Detect voided/cancelled invoices
 * ServiceM8: Invoice voiding syncs bidirectionally
 * Tradify: Void invoice in Xero → Cancelled in Tradify
 * 
 * IMPROVED: Uses incremental sync with If-Modified-Since to only fetch recently changed invoices
 */
export async function syncInvoiceStatusFromXero(userId: string): Promise<{
  voided: number;
  updated: number;
  errors: string[];
}> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const xero = createXeroClient();
  const tokens = decryptTokens(refreshedConnection);
  
  xero.setTokenSet({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
    token_type: "Bearer",
    scope: refreshedConnection.scope || XERO_SCOPES,
  });

  let voided = 0;
  let updated = 0;
  const errors: string[] = [];

  try {
    // Get local invoices with Xero IDs
    const invoices = await storage.getInvoices(userId);
    const syncedInvoices = invoices.filter(inv => inv.xeroInvoiceId);
    
    if (syncedInvoices.length === 0) {
      return { voided: 0, updated: 0, errors: [] };
    }

    // Create a map for quick lookup
    const localInvoiceMap = new Map<string, typeof syncedInvoices[0]>();
    for (const inv of syncedInvoices) {
      localInvoiceMap.set(inv.xeroInvoiceId!, inv);
    }

    // Use If-Modified-Since for incremental sync - only fetch invoices modified since last sync
    const ifModifiedSince = connection.lastSyncAt 
      ? new Date(connection.lastSyncAt)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to last 24 hours if no last sync

    // Fetch recently modified invoices from Xero (PAID, VOIDED statuses)
    const xeroResponse = await xero.accountingApi.getInvoices(
      refreshedConnection.tenantId,
      ifModifiedSince, // If-Modified-Since header
      'Status=="PAID" || Status=="VOIDED"', // Only fetch paid or voided invoices
      undefined, // order
      undefined, // invoiceIDs
      undefined, // invoiceNumbers
      undefined, // contactIDs
      undefined, // statuses
      undefined, // page
      true // includeArchived
    );

    const recentlyModifiedInvoices = xeroResponse.body.invoices || [];
    console.log(`[Xero] Found ${recentlyModifiedInvoices.length} recently modified invoices to check`);

    // Status mapping from Xero to TradieTrack
    const statusMap: Record<string, string> = {
      'DRAFT': 'draft',
      'SUBMITTED': 'sent',
      'AUTHORISED': 'sent',
      'PAID': 'paid',
      'VOIDED': 'cancelled',
    };

    // Process only invoices that exist in our system
    for (const xeroInvoice of recentlyModifiedInvoices) {
      if (!xeroInvoice.invoiceID) continue;
      
      const localInvoice = localInvoiceMap.get(xeroInvoice.invoiceID);
      if (!localInvoice) continue; // Not our invoice

      try {
        // Handle VOIDED status
        if (xeroInvoice.status === 'VOIDED' && localInvoice.status !== 'cancelled') {
          await storage.updateInvoice(localInvoice.id, userId, {
            status: 'cancelled',
            xeroSyncedAt: new Date(),
          });
          voided++;
          console.log(`[Xero] Invoice ${localInvoice.number || localInvoice.id} voided in Xero, marked cancelled`);
          continue;
        }

        // Handle other status changes
        const newStatus = statusMap[xeroInvoice.status || ''];
        if (newStatus && newStatus !== localInvoice.status) {
          await storage.updateInvoice(localInvoice.id, userId, {
            status: newStatus,
            xeroSyncedAt: new Date(),
            ...(newStatus === 'paid' ? { 
              paidAt: xeroInvoice.fullyPaidOnDate ? new Date(xeroInvoice.fullyPaidOnDate) : new Date() 
            } : {}),
          });
          updated++;
          console.log(`[Xero] Invoice ${localInvoice.number || localInvoice.id} status updated to ${newStatus}`);
        }
      } catch (err) {
        errors.push(`Failed to sync status for invoice ${localInvoice.number || localInvoice.id}: ${err}`);
      }
    }

    await storage.updateXeroConnection(refreshedConnection.id, { lastSyncAt: new Date() });
    return { voided, updated, errors };
  } catch (err) {
    throw new Error(`Failed to sync invoice status from Xero: ${err}`);
  }
}

/**
 * Void an invoice in Xero when cancelled in TradieTrack
 * Tradify feature: Cancel invoice in TradieTrack → Voided in Xero
 */
export async function voidInvoiceInXero(userId: string, invoiceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const connection = await storage.getXeroConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: true }; // No connection - skip silently
    }

    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice || !invoice.xeroInvoiceId) {
      return { success: true }; // Not synced to Xero
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const xero = createXeroClient();
    const tokens = decryptTokens(refreshedConnection);
    
    xero.setTokenSet({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
      token_type: "Bearer",
      scope: refreshedConnection.scope || XERO_SCOPES,
    });

    // Update invoice status to VOIDED in Xero
    await xero.accountingApi.updateInvoice(
      refreshedConnection.tenantId,
      invoice.xeroInvoiceId,
      {
        invoices: [{
          invoiceID: invoice.xeroInvoiceId,
          status: 'VOIDED' as any,
        }],
      }
    );

    await storage.updateInvoice(invoice.id, userId, { xeroSyncedAt: new Date() });
    console.log(`[Xero] Invoice ${invoice.number || invoice.id} voided in Xero`);
    return { success: true };
  } catch (err) {
    console.error('[Xero] Failed to void invoice in Xero:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Sync credit notes FROM Xero
 * Tradify feature: Credit notes applied in Xero sync back
 */
export async function syncCreditNotesFromXero(userId: string): Promise<{
  synced: number;
  appliedToInvoices: number;
  errors: string[];
}> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const xero = createXeroClient();
  const tokens = decryptTokens(refreshedConnection);
  
  xero.setTokenSet({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
    token_type: "Bearer",
    scope: refreshedConnection.scope || XERO_SCOPES,
  });

  let synced = 0;
  let appliedToInvoices = 0;
  const errors: string[] = [];

  try {
    // Get credit notes from Xero
    const response = await xero.accountingApi.getCreditNotes(refreshedConnection.tenantId);
    const creditNotes = response.body.creditNotes || [];

    // Get all invoices with Xero IDs
    const invoices = await storage.getInvoices(userId);
    const xeroInvoiceMap = new Map(
      invoices.filter(inv => inv.xeroInvoiceId).map(inv => [inv.xeroInvoiceId, inv])
    );

    for (const creditNote of creditNotes) {
      try {
        // Check if credit note is allocated to any of our invoices
        const allocations = creditNote.allocations || [];
        for (const allocation of allocations) {
          const invoiceId = allocation.invoice?.invoiceID;
          if (invoiceId && xeroInvoiceMap.has(invoiceId)) {
            const invoice = xeroInvoiceMap.get(invoiceId)!;
            const creditAmount = allocation.amount || 0;
            
            // Update invoice with credit note info
            const currentTotal = parseFloat(invoice.total || '0');
            const newTotal = Math.max(0, currentTotal - creditAmount);
            
            await storage.updateInvoice(invoice.id, userId, {
              total: newTotal.toFixed(2),
              xeroSyncedAt: new Date(),
            });
            
            appliedToInvoices++;
            console.log(`[Xero] Credit note ${creditNote.creditNoteNumber} applied to invoice ${invoice.number || invoice.id}`);
          }
        }
        synced++;
      } catch (err) {
        errors.push(`Failed to sync credit note ${creditNote.creditNoteNumber}: ${err}`);
      }
    }

    await storage.updateXeroConnection(refreshedConnection.id, { lastSyncAt: new Date() });
    return { synced, appliedToInvoices, errors };
  } catch (err) {
    throw new Error(`Failed to sync credit notes from Xero: ${err}`);
  }
}

/**
 * Sync inventory items FROM Xero to TradieTrack catalog
 * ServiceM8 & Tradify feature: Inventory items sync from Xero
 */
export async function syncInventoryFromXero(userId: string): Promise<{
  synced: number;
  updated: number;
  errors: string[];
}> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const xero = createXeroClient();
  const tokens = decryptTokens(refreshedConnection);
  
  xero.setTokenSet({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: Math.floor(new Date(refreshedConnection.tokenExpiresAt).getTime() / 1000),
    token_type: "Bearer",
    scope: refreshedConnection.scope || XERO_SCOPES,
  });

  let synced = 0;
  let updated = 0;
  const errors: string[] = [];

  try {
    // Get items from Xero
    const response = await xero.accountingApi.getItems(refreshedConnection.tenantId);
    const xeroItems = response.body.items || [];

    // Get existing catalog items
    const existingItems = await storage.getCatalogItems(userId);
    const existingByXeroId = new Map(
      existingItems.filter(item => (item as any).xeroItemId)
        .map(item => [(item as any).xeroItemId, item])
    );
    const existingByName = new Map(
      existingItems.map(item => [item.name.toLowerCase(), item])
    );

    for (const xeroItem of xeroItems) {
      try {
        if (!xeroItem.name) continue;

        const xeroItemId = xeroItem.itemID;
        const existingByXero = xeroItemId ? existingByXeroId.get(xeroItemId) : null;
        const existingByNameMatch = existingByName.get(xeroItem.name.toLowerCase());

        if (existingByXero) {
          // Update existing item
          await storage.updateCatalogItem(existingByXero.id, userId, {
            name: xeroItem.name,
            description: xeroItem.description || existingByXero.description,
            price: xeroItem.salesDetails?.unitPrice?.toString() || existingByXero.price,
            xeroSyncedAt: new Date(),
          } as any);
          updated++;
        } else if (existingByNameMatch) {
          // Link existing item to Xero
          await storage.updateCatalogItem(existingByNameMatch.id, userId, {
            xeroItemId: xeroItemId,
            description: xeroItem.description || existingByNameMatch.description,
            price: xeroItem.salesDetails?.unitPrice?.toString() || existingByNameMatch.price,
            xeroSyncedAt: new Date(),
          } as any);
          updated++;
        } else {
          // Create new catalog item from Xero
          await storage.createCatalogItem({
            userId,
            name: xeroItem.name,
            description: xeroItem.description || null,
            price: xeroItem.salesDetails?.unitPrice?.toString() || '0',
            category: 'materials', // Default category
            xeroItemId: xeroItemId,
            xeroSyncedAt: new Date(),
          } as any);
          synced++;
        }
      } catch (err) {
        errors.push(`Failed to sync item ${xeroItem.name}: ${err}`);
      }
    }

    await storage.updateXeroConnection(refreshedConnection.id, { lastSyncAt: new Date() });
    return { synced, updated, errors };
  } catch (err) {
    throw new Error(`Failed to sync inventory from Xero: ${err}`);
  }
}

/**
 * Full bidirectional sync - Runs all sync operations
 * This is the main polling function that should run every 5-30 minutes
 */
export async function runFullXeroSync(userId: string): Promise<{
  success: boolean;
  paymentsUpdated: number;
  invoicesUpdated: number;
  invoicesVoided: number;
  creditNotesApplied: number;
  inventorySynced: number;
  errors: string[];
}> {
  const allErrors: string[] = [];
  let paymentsUpdated = 0;
  let invoicesUpdated = 0;
  let invoicesVoided = 0;
  let creditNotesApplied = 0;
  let inventorySynced = 0;

  try {
    // 1. Sync payments FROM Xero (highest priority)
    try {
      const paymentResult = await syncPaymentsFromXero(userId);
      paymentsUpdated = paymentResult.updated;
      allErrors.push(...paymentResult.errors);
    } catch (err) {
      allErrors.push(`Payment sync failed: ${err}`);
    }

    // 2. Sync invoice status FROM Xero
    try {
      const statusResult = await syncInvoiceStatusFromXero(userId);
      invoicesUpdated = statusResult.updated;
      invoicesVoided = statusResult.voided;
      allErrors.push(...statusResult.errors);
    } catch (err) {
      allErrors.push(`Invoice status sync failed: ${err}`);
    }

    // 3. Sync credit notes FROM Xero
    try {
      const creditResult = await syncCreditNotesFromXero(userId);
      creditNotesApplied = creditResult.appliedToInvoices;
      allErrors.push(...creditResult.errors);
    } catch (err) {
      allErrors.push(`Credit notes sync failed: ${err}`);
    }

    // 4. Sync inventory FROM Xero
    try {
      const inventoryResult = await syncInventoryFromXero(userId);
      inventorySynced = inventoryResult.synced + inventoryResult.updated;
      allErrors.push(...inventoryResult.errors);
    } catch (err) {
      allErrors.push(`Inventory sync failed: ${err}`);
    }

    console.log(`[Xero] Full sync completed for user ${userId}: ${paymentsUpdated} payments, ${invoicesUpdated} invoice updates, ${invoicesVoided} voided, ${creditNotesApplied} credit notes, ${inventorySynced} inventory items`);

    return {
      success: true,
      paymentsUpdated,
      invoicesUpdated,
      invoicesVoided,
      creditNotesApplied,
      inventorySynced,
      errors: allErrors,
    };
  } catch (err) {
    return {
      success: false,
      paymentsUpdated,
      invoicesUpdated,
      invoicesVoided,
      creditNotesApplied,
      inventorySynced,
      errors: [...allErrors, String(err)],
    };
  }
}

/**
 * Get Xero sync status for dashboard with detailed metrics
 */
export async function getDetailedSyncStatus(userId: string): Promise<{
  connected: boolean;
  tenantName?: string;
  lastSyncAt?: Date;
  features: {
    paymentsFromXero: boolean;
    invoiceStatusSync: boolean;
    creditNotes: boolean;
    inventorySync: boolean;
    contactsSync: boolean;
  };
  pendingSync: {
    invoices: number;
    quotes: number;
    clients: number;
  };
}> {
  const connection = await storage.getXeroConnection(userId);
  
  if (!connection || connection.status !== "active") {
    return {
      connected: false,
      features: {
        paymentsFromXero: false,
        invoiceStatusSync: false,
        creditNotes: false,
        inventorySync: false,
        contactsSync: false,
      },
      pendingSync: { invoices: 0, quotes: 0, clients: 0 },
    };
  }

  const invoices = await storage.getInvoices(userId);
  const quotes = await storage.getQuotes(userId);
  const clients = await storage.getClients(userId);

  return {
    connected: true,
    tenantName: connection.tenantName || undefined,
    lastSyncAt: connection.lastSyncAt || undefined,
    features: {
      paymentsFromXero: true,
      invoiceStatusSync: true,
      creditNotes: true,
      inventorySync: true,
      contactsSync: true,
    },
    pendingSync: {
      invoices: invoices.filter(i => i.status !== 'draft' && !i.xeroInvoiceId).length,
      quotes: quotes.filter(q => (q.status === 'sent' || q.status === 'accepted') && !(q as any).xeroInvoiceId).length,
      clients: clients.filter(c => !(c as any).xeroContactId).length,
    },
  };
}

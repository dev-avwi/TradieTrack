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
            accountCode: "200",
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
        accountCode: "200",
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

    // Create a payment in Xero to mark the invoice as paid
    const payment = {
      invoice: {
        invoiceID: invoice.xeroInvoiceId,
      },
      account: {
        code: "090", // Default bank account code - typically "Business Bank Account"
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
        accountCode: "200", // Default sales account
        taxType: "OUTPUT", // GST on sales (Australia)
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

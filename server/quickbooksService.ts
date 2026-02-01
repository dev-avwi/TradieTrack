import { storage } from "./storage";
import type { QuickbooksConnection } from "@shared/schema";
import { encrypt, decrypt } from "./encryption";

const QUICKBOOKS_SCOPES = "com.intuit.quickbooks.accounting openid profile email";

const QUICKBOOKS_AUTHORIZATION_URL = "https://appcenter.intuit.com/connect/oauth2";
const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QUICKBOOKS_API_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";

export function isQuickbooksConfigured(): boolean {
  return !!(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET);
}

function getRedirectUri(): string {
  const appUrl = process.env.VITE_APP_URL;
  let baseUrl: string;
  
  if (appUrl) {
    baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
  } else if (process.env.REPLIT_DEV_DOMAIN) {
    baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  } else if (process.env.REPLIT_DOMAINS) {
    baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  } else {
    baseUrl = "http://localhost:5000";
  }
  
  const redirectUri = `${baseUrl}/api/integrations/quickbooks/callback`;
  console.log('[QuickBooks] Using redirect URI:', redirectUri);
  return redirectUri;
}

export async function getAuthUrl(state: string): Promise<string> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  
  if (!clientId) {
    throw new Error("QUICKBOOKS_CLIENT_ID environment variable is required");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: QUICKBOOKS_SCOPES,
    state: state,
  });

  return `${QUICKBOOKS_AUTHORIZATION_URL}?${params.toString()}`;
}

export async function handleCallback(code: string, realmId: string, userId: string): Promise<QuickbooksConnection> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET environment variables are required");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[QuickBooks] Token exchange failed:', error);
    throw new Error(`Failed to exchange authorization code: ${error}`);
  }

  const tokenData = await response.json();

  const companyInfo = await getCompanyInfo(tokenData.access_token, realmId);
  
  const existingConnection = await storage.getQuickbooksConnection(userId);
  
  const connectionData = {
    userId,
    realmId,
    companyName: companyInfo?.CompanyName || null,
    accessToken: encrypt(tokenData.access_token),
    refreshToken: encrypt(tokenData.refresh_token),
    tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    refreshTokenExpiresAt: tokenData.x_refresh_token_expires_in 
      ? new Date(Date.now() + tokenData.x_refresh_token_expires_in * 1000)
      : null,
    scope: QUICKBOOKS_SCOPES,
    status: "active",
  };

  if (existingConnection) {
    const updated = await storage.updateQuickbooksConnection(existingConnection.id, connectionData);
    return updated!;
  } else {
    return await storage.createQuickbooksConnection(connectionData);
  }
}

async function getCompanyInfo(accessToken: string, realmId: string): Promise<any> {
  try {
    const response = await fetch(
      `${QUICKBOOKS_API_BASE_URL}/${realmId}/companyinfo/${realmId}?minorversion=65`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error('[QuickBooks] Failed to fetch company info');
      return null;
    }

    const data = await response.json();
    return data.CompanyInfo;
  } catch (error) {
    console.error('[QuickBooks] Error fetching company info:', error);
    return null;
  }
}

function decryptTokens(connection: QuickbooksConnection): { accessToken: string; refreshToken: string } {
  return {
    accessToken: decrypt(connection.accessToken),
    refreshToken: decrypt(connection.refreshToken),
  };
}

export async function refreshTokenIfNeeded(connection: QuickbooksConnection): Promise<QuickbooksConnection> {
  const now = new Date();
  const expiresAt = new Date(connection.tokenExpiresAt);
  const bufferMs = 5 * 60 * 1000;
  
  if (now.getTime() + bufferMs < expiresAt.getTime()) {
    return connection;
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET environment variables are required");
  }

  const tokens = decryptTokens(connection);
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[QuickBooks] Token refresh failed:', error);
    await storage.updateQuickbooksConnection(connection.id, { status: 'expired' });
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const tokenData = await response.json();

  const updated = await storage.updateQuickbooksConnection(connection.id, {
    accessToken: encrypt(tokenData.access_token),
    refreshToken: encrypt(tokenData.refresh_token),
    tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    refreshTokenExpiresAt: tokenData.x_refresh_token_expires_in 
      ? new Date(Date.now() + tokenData.x_refresh_token_expires_in * 1000)
      : null,
  });

  return updated!;
}

export async function getConnectionStatus(userId: string): Promise<{
  connected: boolean;
  configured: boolean;
  companyName?: string;
  lastSyncAt?: Date;
}> {
  const configured = isQuickbooksConfigured();
  
  if (!configured) {
    return { connected: false, configured: false };
  }

  const connection = await storage.getQuickbooksConnection(userId);
  
  if (!connection || connection.status !== 'active') {
    return { connected: false, configured: true };
  }

  return {
    connected: true,
    configured: true,
    companyName: connection.companyName || undefined,
    lastSyncAt: connection.lastSyncAt || undefined,
  };
}

export async function isQuickbooksConnected(userId: string): Promise<boolean> {
  const connection = await storage.getQuickbooksConnection(userId);
  return !!(connection && connection.status === 'active');
}

export async function disconnect(userId: string): Promise<boolean> {
  return await storage.deleteQuickbooksConnection(userId);
}

export async function syncContactsToQuickbooks(userId: string): Promise<{ synced: number; errors: string[] }> {
  const connection = await storage.getQuickbooksConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active QuickBooks connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);

  let synced = 0;
  const errors: string[] = [];

  try {
    const clients = await storage.getClients(userId);
    
    for (const client of clients) {
      try {
        if (!client.name) continue;
        
        const existingCustomer = await findCustomerByEmail(
          tokens.accessToken, 
          refreshedConnection.realmId, 
          client.email
        );

        if (!existingCustomer) {
          await createCustomer(tokens.accessToken, refreshedConnection.realmId, {
            DisplayName: client.name,
            PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
            PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
            BillAddr: client.address ? { Line1: client.address } : undefined,
          });
          synced++;
        }
      } catch (err) {
        errors.push(`Failed to sync client ${client.name}: ${err}`);
      }
    }

    await storage.updateQuickbooksConnection(refreshedConnection.id, {
      lastSyncAt: new Date(),
    });

    return { synced, errors };
  } catch (err) {
    throw new Error(`Failed to sync contacts to QuickBooks: ${err}`);
  }
}

async function findCustomerByEmail(accessToken: string, realmId: string, email: string | null): Promise<any> {
  if (!email) return null;
  
  try {
    const query = encodeURIComponent(`SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email}'`);
    const response = await fetch(
      `${QUICKBOOKS_API_BASE_URL}/${realmId}/query?query=${query}&minorversion=65`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) return null;
    
    const data = await response.json();
    return data.QueryResponse?.Customer?.[0] || null;
  } catch {
    return null;
  }
}

async function createCustomer(accessToken: string, realmId: string, customerData: any): Promise<any> {
  const response = await fetch(
    `${QUICKBOOKS_API_BASE_URL}/${realmId}/customer?minorversion=65`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(customerData),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create customer: ${error}`);
  }

  const data = await response.json();
  return data.Customer;
}

export async function syncInvoicesToQuickbooks(userId: string): Promise<{ synced: number; skipped: number; errors: string[] }> {
  const connection = await storage.getQuickbooksConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active QuickBooks connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const invoices = await storage.getInvoices(userId);
    const clients = await storage.getClients(userId);
    
    for (const invoice of invoices) {
      try {
        if (invoice.status === 'draft') continue;
        
        if ((invoice as any).quickbooksInvoiceId) {
          skipped++;
          continue;
        }
        
        const client = clients.find(c => c.id === invoice.clientId);
        if (!client) continue;

        let customer = await findCustomerByEmail(tokens.accessToken, refreshedConnection.realmId, client.email);
        
        if (!customer) {
          customer = await createCustomer(tokens.accessToken, refreshedConnection.realmId, {
            DisplayName: client.name,
            PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
            PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
          });
        }

        const lineItems = await storage.getInvoiceLineItems(invoice.id);
        
        const qbInvoice = {
          CustomerRef: { value: customer.Id },
          Line: lineItems.map(item => ({
            DetailType: "SalesItemLineDetail",
            Amount: parseFloat(item.unitPrice || "0") * parseFloat(item.quantity || "1"),
            SalesItemLineDetail: {
              ItemRef: { value: "1", name: "Services" },
              Qty: parseFloat(item.quantity || "1"),
              UnitPrice: parseFloat(item.unitPrice || "0"),
            },
            Description: item.description,
          })),
          DueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : undefined,
          DocNumber: invoice.number || (invoice as any).invoiceNumber || undefined,
        };

        const createdInvoice = await createQuickbooksInvoice(
          tokens.accessToken, 
          refreshedConnection.realmId, 
          qbInvoice
        );
        
        if (createdInvoice?.Id) {
          await storage.updateInvoice(invoice.id, userId, {
            quickbooksInvoiceId: createdInvoice.Id,
            quickbooksSyncedAt: new Date(),
          } as any);
        }
        
        synced++;
      } catch (err) {
        errors.push(`Failed to sync invoice ${invoice.number || (invoice as any).invoiceNumber}: ${err}`);
      }
    }

    await storage.updateQuickbooksConnection(refreshedConnection.id, {
      lastSyncAt: new Date(),
    });

    return { synced, skipped, errors };
  } catch (err) {
    throw new Error(`Failed to sync invoices to QuickBooks: ${err}`);
  }
}

async function createQuickbooksInvoice(accessToken: string, realmId: string, invoiceData: any): Promise<any> {
  const response = await fetch(
    `${QUICKBOOKS_API_BASE_URL}/${realmId}/invoice?minorversion=65`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(invoiceData),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create invoice: ${error}`);
  }

  const data = await response.json();
  return data.Invoice;
}

export async function syncPaymentsFromQuickbooks(userId: string): Promise<{ updated: number; errors: string[] }> {
  const connection = await storage.getQuickbooksConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active QuickBooks connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);

  let updated = 0;
  const errors: string[] = [];

  try {
    const invoices = await storage.getInvoices(userId);
    
    for (const invoice of invoices) {
      try {
        const qbInvoiceId = (invoice as any).quickbooksInvoiceId;
        if (!qbInvoiceId || invoice.status === 'paid') continue;
        
        const qbInvoice = await getQuickbooksInvoice(tokens.accessToken, refreshedConnection.realmId, qbInvoiceId);
        
        if (qbInvoice && qbInvoice.Balance === 0 && invoice.status !== 'paid') {
          await storage.updateInvoice(invoice.id, userId, {
            status: 'paid',
            paidAt: new Date(),
          });
          updated++;
        }
      } catch (err) {
        errors.push(`Failed to check payment for invoice ${invoice.number}: ${err}`);
      }
    }

    await storage.updateQuickbooksConnection(refreshedConnection.id, {
      lastSyncAt: new Date(),
    });

    return { updated, errors };
  } catch (err) {
    throw new Error(`Failed to sync payments from QuickBooks: ${err}`);
  }
}

async function getQuickbooksInvoice(accessToken: string, realmId: string, invoiceId: string): Promise<any> {
  const response = await fetch(
    `${QUICKBOOKS_API_BASE_URL}/${realmId}/invoice/${invoiceId}?minorversion=65`,
    {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) return null;
  
  const data = await response.json();
  return data.Invoice;
}

export async function syncSingleInvoiceToQuickbooks(userId: string, invoiceId: string): Promise<{ success: boolean; quickbooksInvoiceId?: string; error?: string }> {
  try {
    const connection = await storage.getQuickbooksConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: true };
    }

    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if ((invoice as any).quickbooksInvoiceId) {
      return { success: true, quickbooksInvoiceId: (invoice as any).quickbooksInvoiceId };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const tokens = decryptTokens(refreshedConnection);

    const clients = await storage.getClients(userId);
    const client = clients.find(c => c.id === invoice.clientId);
    if (!client) {
      return { success: false, error: "Client not found" };
    }

    let customer = await findCustomerByEmail(tokens.accessToken, refreshedConnection.realmId, client.email);
    
    if (!customer) {
      customer = await createCustomer(tokens.accessToken, refreshedConnection.realmId, {
        DisplayName: client.name,
        PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
        PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
      });
    }

    const lineItems = await storage.getInvoiceLineItems(invoice.id);
    
    const qbInvoice = {
      CustomerRef: { value: customer.Id },
      Line: lineItems.map(item => ({
        DetailType: "SalesItemLineDetail",
        Amount: parseFloat(item.unitPrice || "0") * parseFloat(item.quantity || "1"),
        SalesItemLineDetail: {
          ItemRef: { value: "1", name: "Services" },
          Qty: parseFloat(item.quantity || "1"),
          UnitPrice: parseFloat(item.unitPrice || "0"),
        },
        Description: item.description,
      })),
      DueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : undefined,
      DocNumber: invoice.number || (invoice as any).invoiceNumber || undefined,
    };

    const createdInvoice = await createQuickbooksInvoice(
      tokens.accessToken, 
      refreshedConnection.realmId, 
      qbInvoice
    );
    
    if (createdInvoice?.Id) {
      await storage.updateInvoice(invoice.id, userId, {
        quickbooksInvoiceId: createdInvoice.Id,
        quickbooksSyncedAt: new Date(),
      } as any);
    }

    return { success: true, quickbooksInvoiceId: createdInvoice?.Id };
  } catch (error: any) {
    console.error('[QuickBooks] Failed to sync single invoice:', error);
    return { success: false, error: error.message || "Failed to sync invoice" };
  }
}

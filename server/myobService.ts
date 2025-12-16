import axios from "axios";
import { storage } from "./storage";
import type { MyobConnection } from "@shared/schema";
import { encrypt, decrypt } from "./encryption";

const MYOB_SCOPES = "sme-company-file sme-customer sme-invoice sme-sales";
const MYOB_AUTH_URL = "https://secure.myob.com/oauth2/account/authorize";
const MYOB_TOKEN_URL = "https://secure.myob.com/oauth2/v1/authorize";
const MYOB_API_BASE = "https://api.myob.com/accountright";

function getRedirectUri(): string {
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPL_SLUG && process.env.REPL_OWNER 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : "http://localhost:5000";
  return `${baseUrl}/api/integrations/myob/callback`;
}

export function isMyobConfigured(): boolean {
  return !!(process.env.MYOB_CLIENT_ID && process.env.MYOB_CLIENT_SECRET);
}

export function getAuthUrl(state: string): string {
  const clientId = process.env.MYOB_CLIENT_ID;
  
  if (!clientId) {
    throw new Error("MYOB_CLIENT_ID environment variable is required");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: MYOB_SCOPES,
    state: state,
    prompt: "consent",
  });

  return `${MYOB_AUTH_URL}?${params.toString()}`;
}

export async function handleCallback(
  code: string,
  businessId: string,
  userId: string
): Promise<MyobConnection> {
  const clientId = process.env.MYOB_CLIENT_ID;
  const clientSecret = process.env.MYOB_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("MYOB_CLIENT_ID and MYOB_CLIENT_SECRET environment variables are required");
  }

  const tokenResponse = await axios.post(
    MYOB_TOKEN_URL,
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: getRedirectUri(),
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const { access_token, refresh_token, expires_in } = tokenResponse.data;
  
  let companyName: string | null = null;
  try {
    const companyFilesResponse = await axios.get(MYOB_API_BASE, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "x-myobapi-key": clientId,
        "x-myobapi-version": "v2",
      },
    });
    
    const companyFiles = companyFilesResponse.data;
    const matchingFile = companyFiles.find((cf: any) => cf.Id === businessId);
    if (matchingFile) {
      companyName = matchingFile.Name || null;
    }
  } catch (err) {
    console.warn("Failed to fetch company name from MYOB:", err);
  }

  const existingConnection = await storage.getMyobConnection(userId);
  
  const connectionData = {
    userId,
    businessId,
    companyName,
    accessToken: encrypt(access_token),
    refreshToken: encrypt(refresh_token),
    tokenExpiresAt: new Date(Date.now() + (expires_in || 1200) * 1000),
    scope: MYOB_SCOPES,
    status: "active",
  };

  if (existingConnection) {
    const updated = await storage.updateMyobConnection(existingConnection.id, connectionData);
    return updated!;
  } else {
    return await storage.createMyobConnection(connectionData);
  }
}

function decryptTokens(connection: MyobConnection): { accessToken: string; refreshToken: string } {
  return {
    accessToken: decrypt(connection.accessToken),
    refreshToken: decrypt(connection.refreshToken),
  };
}

function getCfToken(connection: MyobConnection): string | null {
  if (!connection.cfUsername || !connection.cfPassword) {
    return null;
  }
  const username = decrypt(connection.cfUsername);
  const password = decrypt(connection.cfPassword);
  return Buffer.from(`${username}:${password}`).toString('base64');
}

function getApiHeaders(accessToken: string, cfToken: string | null): Record<string, string> {
  const clientId = process.env.MYOB_CLIENT_ID!;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "x-myobapi-key": clientId,
    "x-myobapi-version": "v2",
  };
  if (cfToken) {
    headers["x-myobapi-cftoken"] = cfToken;
  }
  return headers;
}

export async function refreshTokenIfNeeded(connection: MyobConnection): Promise<MyobConnection> {
  const now = new Date();
  const expiresAt = new Date(connection.tokenExpiresAt);
  const bufferMs = 2 * 60 * 1000;
  
  if (now.getTime() + bufferMs < expiresAt.getTime()) {
    return connection;
  }

  const clientId = process.env.MYOB_CLIENT_ID;
  const clientSecret = process.env.MYOB_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("MYOB_CLIENT_ID and MYOB_CLIENT_SECRET environment variables are required");
  }

  const tokens = decryptTokens(connection);
  
  const tokenResponse = await axios.post(
    MYOB_TOKEN_URL,
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const { access_token, refresh_token, expires_in } = tokenResponse.data;

  const updated = await storage.updateMyobConnection(connection.id, {
    accessToken: encrypt(access_token),
    refreshToken: encrypt(refresh_token),
    tokenExpiresAt: new Date(Date.now() + (expires_in || 1200) * 1000),
  });

  return updated!;
}

export async function syncContactsFromMyob(userId: string): Promise<{ synced: number; errors: string[] }> {
  const connection = await storage.getMyobConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active MYOB connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);
  const clientId = process.env.MYOB_CLIENT_ID!;
  
  let synced = 0;
  const errors: string[] = [];

  const cfToken = getCfToken(refreshedConnection);
  if (!cfToken) {
    throw new Error("Company file credentials not configured. Please set your MYOB company file username and password.");
  }

  try {
    const customersResponse = await axios.get(
      `${MYOB_API_BASE}/${refreshedConnection.businessId}/Contact/Customer`,
      {
        headers: getApiHeaders(tokens.accessToken, cfToken),
      }
    );

    const myobCustomers = customersResponse.data.Items || [];
    
    for (const customer of myobCustomers) {
      try {
        if (!customer.CompanyName && !customer.FirstName) continue;
        
        const name = customer.CompanyName || `${customer.FirstName || ''} ${customer.LastName || ''}`.trim();
        const existingClients = await storage.getClients(userId);
        const matchingClient = existingClients.find(
          c => c.email?.toLowerCase() === customer.Email?.toLowerCase() ||
               c.name.toLowerCase() === name.toLowerCase()
        );

        if (!matchingClient && name) {
          await storage.createClient({
            userId,
            name,
            email: customer.Email || null,
            phone: customer.Phone1 || null,
            address: customer.Addresses?.[0]?.Street || null,
          });
          synced++;
        }
      } catch (err) {
        errors.push(`Failed to sync customer ${customer.CompanyName || customer.FirstName}: ${err}`);
      }
    }

    await storage.updateMyobConnection(refreshedConnection.id, {
      lastSyncAt: new Date(),
    });

    return { synced, errors };
  } catch (err) {
    throw new Error(`Failed to fetch customers from MYOB: ${err}`);
  }
}

export async function syncInvoicesToMyob(userId: string): Promise<{ synced: number; errors: string[] }> {
  const connection = await storage.getMyobConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active MYOB connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);
  
  const cfToken = getCfToken(refreshedConnection);
  if (!cfToken) {
    throw new Error("Company file credentials not configured. Please set your MYOB company file username and password.");
  }
  
  let synced = 0;
  const errors: string[] = [];

  try {
    const invoices = await storage.getInvoices(userId);
    const clients = await storage.getClients(userId);
    
    for (const invoice of invoices) {
      try {
        if (invoice.status === 'draft') continue;
        
        const client = clients.find(c => c.id === invoice.clientId);
        if (!client) continue;

        const lineItems = await storage.getInvoiceLineItems(invoice.id);
        
        const myobInvoice = {
          Number: invoice.number,
          Customer: {
            Name: client.name,
          },
          Lines: lineItems.map(item => ({
            Description: item.description,
            Total: parseFloat(item.total || "0"),
          })),
          Date: invoice.createdAt ? new Date(invoice.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        };

        const invoiceHeaders = getApiHeaders(tokens.accessToken, cfToken);
        invoiceHeaders["Content-Type"] = "application/json";
        await axios.post(
          `${MYOB_API_BASE}/${refreshedConnection.businessId}/Sale/Invoice/Service`,
          myobInvoice,
          {
            headers: invoiceHeaders,
          }
        );
        
        synced++;
      } catch (err) {
        errors.push(`Failed to sync invoice ${invoice.number}: ${err}`);
      }
    }

    await storage.updateMyobConnection(refreshedConnection.id, {
      lastSyncAt: new Date(),
    });

    return { synced, errors };
  } catch (err) {
    throw new Error(`Failed to sync invoices to MYOB: ${err}`);
  }
}

export async function getConnectionStatus(userId: string): Promise<{
  connected: boolean;
  companyName?: string;
  businessId?: string;
  lastSyncAt?: Date;
  status?: string;
  cfCredentialsSet?: boolean;
}> {
  const connection = await storage.getMyobConnection(userId);
  
  if (!connection) {
    return { connected: false };
  }

  return {
    connected: connection.status === "active",
    companyName: connection.companyName || undefined,
    businessId: connection.businessId,
    lastSyncAt: connection.lastSyncAt || undefined,
    status: connection.status || "unknown",
    cfCredentialsSet: !!(connection.cfUsername && connection.cfPassword),
  };
}

export async function setCompanyFileCredentials(
  userId: string,
  cfUsername: string,
  cfPassword: string
): Promise<{ success: boolean }> {
  const connection = await storage.getMyobConnection(userId);
  if (!connection) {
    throw new Error("No MYOB connection found. Please connect to MYOB first.");
  }

  await storage.updateMyobConnection(connection.id, {
    cfUsername: encrypt(cfUsername),
    cfPassword: encrypt(cfPassword),
  });

  return { success: true };
}

export async function disconnect(userId: string): Promise<boolean> {
  return await storage.deleteMyobConnection(userId);
}

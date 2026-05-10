import { XeroClient, TokenSet, Contact, Phone, Address } from "xero-node";
import { createRequire } from "module";
import { storage } from "./storage";

// Xero rate-limits / Akamai-blocks repeated hits to its OIDC discovery endpoint
// (`https://identity.xero.com/.well-known/openid-configuration`). The xero-node
// SDK calls Issuer.discover on every new XeroClient instance, which means each
// Connect/Test attempt re-discovers — hammering the endpoint until WAF returns
// 403 Forbidden. Patch Issuer.discover to cache the result for the life of the
// process so we only hit Xero's discovery endpoint once.
//
// xero-node bundles openid-client v5 (which exports `Issuer`). The top-level
// `openid-client` package may be a different (v6+) version that has dropped
// the `Issuer` export, so we resolve the SDK's bundled copy explicitly.
try {
  const _require = createRequire(import.meta.url);
  const _oidc: any = _require("xero-node/node_modules/openid-client");
  if (_oidc?.Issuer?.discover) {
    const _origDiscover = _oidc.Issuer.discover.bind(_oidc.Issuer);
    const _discoveryCache = new Map<string, Promise<any>>();
    _oidc.Issuer.discover = function (url: string): Promise<any> {
      let p = _discoveryCache.get(url);
      if (!p) {
        p = _origDiscover(url).catch((err: any) => {
          _discoveryCache.delete(url); // don't cache failures
          throw err;
        });
        _discoveryCache.set(url, p);
      }
      return p;
    };
    console.log("[Xero] OIDC Issuer.discover patched with in-process cache");
  } else {
    console.warn("[Xero] Could not patch Issuer.discover — Issuer not found on bundled openid-client");
  }
} catch (err) {
  console.warn("[Xero] Could not load bundled openid-client to patch discovery:", err);
}
import type { XeroConnection, InsertClient, XeroSyncState } from "@shared/schema";
import { encrypt, decrypt } from "./encryption";
import crypto from "crypto";
import { xeroAccountsCache, xeroTaxRatesCache, xeroItemsCache } from "./cache";

const XERO_SCOPES = "openid profile email accounting.transactions accounting.contacts offline_access";

/**
 * Task #91: build a PDF buffer for an invoice using the same generator the
 * email/send-invoice flow uses. Returns null on any failure so callers can
 * silently skip the auto-attach step (best-effort).
 */
async function buildInvoicePdfBuffer(userId: string, invoiceId: string): Promise<Buffer | null> {
  try {
    const invoice = await storage.getInvoiceWithLineItems(invoiceId, userId);
    if (!invoice) return null;
    const client = await storage.getClientById(invoice.clientId);
    if (!client) return null;
    const business = await storage.getBusinessSettings(userId);
    if (!business) return null;
    const { generateInvoicePDF, generatePDFBuffer, resolveBusinessLogoForPdf } = await import('./pdfService');
    const businessForPdf = await resolveBusinessLogoForPdf(business as any);
    const html = generateInvoicePDF({
      invoice: invoice as any,
      lineItems: (invoice as any).lineItems || [],
      client: client as any,
      business: businessForPdf as any,
    } as any);
    return await generatePDFBuffer(html);
  } catch (err) {
    console.warn('[Xero] buildInvoicePdfBuffer failed:', err);
    return null;
  }
}

function getRedirectUri(): string {
  // Priority: VITE_APP_URL (production domain) > REPLIT_DEV_DOMAIN > REPLIT_DOMAINS > localhost
  const appUrl = process.env.VITE_APP_URL;
  let baseUrl: string;
  
  if (appUrl) {
    // Use configured app URL (e.g., https://jobrunner.com)
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

function createXeroClient(state?: string): XeroClient {
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
    state,
  } as any);
}

export async function getAuthUrl(state: string): Promise<string> {
  const xero = createXeroClient(state);
  const consentUrl = await xero.buildConsentUrl();
  // Force Xero to re-display the consent screen so the user actually grants
  // the accounting.* scopes. Without this, Xero silently reuses any prior
  // consent (e.g. an OIDC-only Sign-In-with-Xero grant) and issues an access
  // token missing the data scopes — causing /connections to 401 with
  // insufficient_scope.
  const sep = consentUrl.includes('?') ? '&' : '?';
  return `${consentUrl}${sep}prompt=consent`;
}

export async function handleCallback(url: string, userId: string): Promise<XeroConnection> {
  const stateFromUrl = new URL(url).searchParams.get('state') || undefined;
  const xero = createXeroClient(stateFromUrl);
  
  const tokenSet = await xero.apiCallback(url);

  // DIAGNOSTIC: Dump the scopes Xero actually granted in the access_token.
  // The `scope` param in the callback URL only echoes the request — it doesn't
  // prove the issued token has those scopes. The access_token is a JWT whose
  // payload includes the real granted scopes.
  try {
    const at = tokenSet.access_token || '';
    const parts = at.split('.');
    const payloadJson = parts.length === 3
      ? JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
      : null;
    console.log('[Xero] Token granted scopes:', {
      tokenSetScope: tokenSet.scope,
      jwtScope: payloadJson?.scope,
      jwtAud: payloadJson?.aud,
      jwtAuthEvent: payloadJson?.authentication_event_id,
      jwtAuthMethods: payloadJson?.amr,
    });
  } catch (logErr) {
    console.warn('[Xero] Could not decode access_token for diagnostic:', logErr);
  }

  // Detect legacy Sign-In-with-Xero accounts that have no API access. The JWT
  // includes `amr: ['legacy']` for these, and /connections will 401 even though
  // the access_token nominally carries the accounting.* scopes.
  let amr: string[] | undefined;
  let jwtScopes: string[] = [];
  try {
    const at = tokenSet.access_token || '';
    const parts = at.split('.');
    const payload = parts.length === 3
      ? JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
      : null;
    amr = payload?.amr;
    jwtScopes = Array.isArray(payload?.scope)
      ? payload.scope
      : typeof payload?.scope === 'string'
        ? payload.scope.split(/\s+/)
        : [];
  } catch {
    // already logged in the diagnostic above
  }

  const hasAccountingScope = jwtScopes.some(s => s.startsWith('accounting.'));
  if (!hasAccountingScope) {
    throw new Error(
      "Your Xero login doesn't have accounting access. The token Xero issued only contains identity scopes (no accounting.*). " +
      "This means the email you signed in with is a 'Sign In with Xero' identity account, not a full Xero subscription. " +
      "Please sign in with the email that owns or is invited to your Xero organisation."
    );
  }

  let tenants: any[] = [];
  let updateTenantsError: any = null;
  try {
    await xero.updateTenants();
    tenants = xero.tenants || [];
  } catch (err: any) {
    updateTenantsError = err;
    // Inspect the error VERY defensively — different xero-node / openid-client
    // versions wrap upstream errors differently (axios-style .response.status,
    // openid-client OPError with .statusCode, generic Error with body in
    // .message, etc.). We dig through every plausible field.
    const status =
      err?.response?.statusCode ??
      err?.response?.status ??
      err?.statusCode ??
      err?.status;
    const wwwAuth =
      err?.response?.headers?.['www-authenticate'] ||
      err?.headers?.['www-authenticate'] ||
      '';
    const detailBody = err?.response?.body || err?.body || {};
    const detail = (detailBody?.Detail || detailBody?.detail || '') as string;
    const errMsg = String(err?.message || '');

    console.error('[Xero] updateTenants failed:', {
      status,
      wwwAuth,
      detail,
      errMsg,
      errCtor: err?.constructor?.name,
      amr,
      jwtScopes,
    });

    const looksLikeInsufficientScope =
      /insufficient_scope/i.test(wwwAuth) ||
      /insufficient_scope/i.test(errMsg) ||
      /AuthorizationUnsuccessful/i.test(detail) ||
      (status === 401 && jwtScopes.length > 0);

    if (looksLikeInsufficientScope) {
      const isLegacy = Array.isArray(amr) && amr.includes('legacy');
      if (isLegacy) {
        throw new Error(
          "Your Xero login is a legacy 'Sign In with Xero' account, not a full Xero accounting subscription. " +
          "Xero issued an identity-only token — its API rejected the call to list your organisations. " +
          "Please sign in with the email that owns/has been invited to your Xero accounting organisation, " +
          "or migrate this Xero login by logging into xero.com once and accepting any pending account upgrade."
        );
      }
      throw new Error(
        "Xero authorised the connection but rejected the request to list your organisations (insufficient_scope). " +
        "On the Xero authorise screen, make sure you SELECT an organisation (don't just click 'Allow access' on a blank screen) and that the user you're signing in as has been added to that organisation in Xero."
      );
    }

    // Anything else — surface the upstream error verbatim so the user (and we)
    // can see what's wrong instead of a generic "Connection failed".
    throw new Error(
      `Xero rejected the connection (HTTP ${status ?? '?'}): ${detail || errMsg || 'unknown error'}`
    );
  }

  if (!tenants || tenants.length === 0) {
    throw new Error(
      "No Xero organisations were returned for this login. On the Xero authorise screen you need to tick at least one organisation before clicking 'Allow access'. Please disconnect and try again, making sure to select your organisation."
    );
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

function xeroLog(operation: string, details: Record<string, string | number | boolean | null | undefined>) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...details,
  };
  console.log(`[Xero:${operation}] ${JSON.stringify(logEntry)}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function refreshTokenIfNeeded(connection: XeroConnection): Promise<XeroConnection> {
  const now = new Date();
  const expiresAt = new Date(connection.tokenExpiresAt);
  const bufferMs = 5 * 60 * 1000;
  
  if (now.getTime() + bufferMs < expiresAt.getTime()) {
    return connection;
  }

  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
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
        status: "active",
      });

      xeroLog("tokenRefresh", { userId: connection.userId, tenantId: connection.tenantId, status: "success", attempt });
      return updated!;
    } catch (err: any) {
      lastError = err;
      const statusCode = err?.response?.statusCode || err?.statusCode || err?.status;

      if (statusCode === 400 || statusCode === 401) {
        xeroLog("tokenRefresh", {
          userId: connection.userId,
          tenantId: connection.tenantId,
          status: "revoked",
          statusCode,
          error: err.message,
        });
        await storage.updateXeroConnection(connection.id, {
          status: "token_expired",
        });
        throw new Error("Xero refresh token has expired or been revoked. Please reconnect your Xero account.");
      }

      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        xeroLog("tokenRefresh", {
          userId: connection.userId,
          tenantId: connection.tenantId,
          status: "retrying",
          attempt,
          backoffMs,
          error: err.message,
        });
        await sleep(backoffMs);
      }
    }
  }

  xeroLog("tokenRefresh", {
    userId: connection.userId,
    tenantId: connection.tenantId,
    status: "failed",
    error: lastError?.message,
  });
  await storage.updateXeroConnection(connection.id, {
    status: "token_expired",
  });
  throw new Error("Failed to refresh Xero token after multiple attempts. Please reconnect your Xero account.");
}

async function handleXeroDisconnection(connection: XeroConnection, statusCode: number, errorMessage: string): Promise<void> {
  xeroLog("disconnection", {
    userId: connection.userId,
    tenantId: connection.tenantId,
    statusCode,
    error: errorMessage,
  });
  await storage.updateXeroConnection(connection.id, {
    status: "disconnected",
    accessToken: "",
    refreshToken: "",
  });
}

async function xeroApiCall<T>(
  connection: XeroConnection,
  operation: string,
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiCall();
      return result;
    } catch (err: any) {
      lastError = err;
      const statusCode = err?.response?.statusCode || err?.statusCode || err?.status;

      xeroLog(operation, {
        userId: connection.userId,
        tenantId: connection.tenantId,
        status: "error",
        statusCode,
        attempt,
        error: err.message,
      });

      if (statusCode === 401 || statusCode === 403) {
        await handleXeroDisconnection(connection, statusCode, err.message);
        throw new Error(
          statusCode === 401
            ? "Xero access has been revoked. Please reconnect your Xero account."
            : "Xero permission denied. Your app may lack required scopes. Please reconnect."
        );
      }

      if (statusCode === 429) {
        const retryAfter = parseInt(err?.response?.headers?.["retry-after"] || "0", 10);
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt) * 1000;
        xeroLog(operation, {
          userId: connection.userId,
          tenantId: connection.tenantId,
          status: "rate_limited",
          attempt,
          waitMs,
        });
        await sleep(waitMs);
        continue;
      }

      if (attempt < maxRetries && statusCode && statusCode >= 500) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        await sleep(backoffMs);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

function prepareXeroClient(connection: XeroConnection): XeroClient {
  const xero = createXeroClient();
  const tokens = decryptTokens(connection);
  xero.setTokenSet({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: Math.floor(new Date(connection.tokenExpiresAt).getTime() / 1000),
    token_type: "Bearer",
    scope: connection.scope || XERO_SCOPES,
  });
  return xero;
}

async function getRefreshedClientAndConnection(userId: string): Promise<{ xero: XeroClient; connection: XeroConnection }> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || (connection.status !== "active" && connection.status !== "token_expired" && connection.status !== "disconnected")) {
    throw new Error("No active Xero connection found");
  }
  if (connection.status === "token_expired" || connection.status === "disconnected") {
    throw new Error("Xero connection needs to be reconnected. Please reconnect your Xero account from the Integrations page.");
  }
  const refreshedConnection = await refreshTokenIfNeeded(connection);
  // Task #91: honour the multi-tenant selector. If the user picked a specific
  // organisation in Settings (xeroActiveTenantId), all push/pull calls must
  // target THAT tenant — not whichever tenant happened to be saved on the
  // connection row at OAuth time. We mutate a shallow copy so the original
  // DB row is untouched.
  try {
    const settings: any = await storage.getBusinessSettings(userId);
    const activeTenant = settings?.xeroActiveTenantId;
    if (activeTenant && activeTenant !== refreshedConnection.tenantId) {
      const overridden = { ...refreshedConnection, tenantId: activeTenant } as XeroConnection;
      const xero = prepareXeroClient(overridden);
      return { xero, connection: overridden };
    }
  } catch { /* fall through to default tenant */ }
  const xero = prepareXeroClient(refreshedConnection);
  return { xero, connection: refreshedConnection };
}

async function recordSyncRun(
  userId: string,
  entityType: string,
  direction: string,
  startTime: number,
  processed: number,
  failed: number,
  errors: string[],
  outcome: "success" | "partial" | "failure",
) {
  try {
    await storage.recordXeroSyncRun({
      userId,
      entityType,
      syncDirection: direction,
      startedAt: new Date(startTime),
      lastSyncAt: new Date(),
      outcome,
      recordsProcessed: processed,
      recordsFailed: failed,
      durationMs: Date.now() - startTime,
      errorDetails: errors.length > 0 ? JSON.stringify(errors) : null,
    });
  } catch (err) {
    console.error("[Xero:recordSyncRun] Failed to record sync run:", err);
  }
}

export async function getConnectedTenants(connection: XeroConnection): Promise<Array<{ tenantId: string; tenantName: string | null }>> {
  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const xero = prepareXeroClient(refreshedConnection);

  await xero.updateTenants();
  
  return xero.tenants.map(t => ({
    tenantId: t.tenantId,
    tenantName: t.tenantName || null,
  }));
}

export async function syncContactsFromXero(userId: string): Promise<{ synced: number; updated: number; errors: string[] }> {
  const startTime = Date.now();
  const { xero, connection } = await getRefreshedClientAndConnection(userId);

  let synced = 0;
  let updated = 0;
  const errors: string[] = [];

  try {
    const response = await xeroApiCall(connection, "getContacts", () =>
      xero.accountingApi.getContacts(connection.tenantId)
    );
    const xeroContacts = response.body.contacts || [];
    
    const existingClients = await storage.getClients(userId);

    for (const xeroContact of xeroContacts) {
      try {
        if (!xeroContact.name) continue;
        
        const matchingClient = existingClients.find(
          c => c.xeroContactId === xeroContact.contactID ||
               c.email?.toLowerCase() === xeroContact.emailAddress?.toLowerCase() ||
               c.name.toLowerCase() === xeroContact.name?.toLowerCase()
        );

        if (matchingClient) {
          const xeroUpdatedAt = xeroContact.updatedDateUTC ? new Date(xeroContact.updatedDateUTC) : null;
          const localSyncedAt = matchingClient.xeroSyncedAt ? new Date(matchingClient.xeroSyncedAt) : null;
          const xeroIsNewer = !localSyncedAt || (xeroUpdatedAt && xeroUpdatedAt > localSyncedAt);

          const updates: Partial<InsertClient> = {};

          if (xeroContact.contactID && !matchingClient.xeroContactId) {
            updates.xeroContactId = xeroContact.contactID;
          }

          if (xeroIsNewer) {
            const xeroEmail = xeroContact.emailAddress || null;
            const xeroPhone = xeroContact.phones?.[0]?.phoneNumber || null;
            const xeroAddress = xeroContact.addresses?.[0]?.addressLine1 || null;

            if (xeroEmail && xeroEmail !== matchingClient.email) updates.email = xeroEmail;
            if (xeroPhone && xeroPhone !== matchingClient.phone) updates.phone = xeroPhone;
            if (xeroAddress && xeroAddress !== matchingClient.address) updates.address = xeroAddress;
          }

          if (Object.keys(updates).length > 0) {
            updates.xeroSyncedAt = new Date();
            await storage.updateClient(matchingClient.id, userId, updates);
            updated++;
          }
        } else {
          await storage.createClient({
            userId,
            name: xeroContact.name,
            email: xeroContact.emailAddress || null,
            phone: xeroContact.phones?.[0]?.phoneNumber || null,
            address: xeroContact.addresses?.[0]?.addressLine1 || null,
            xeroContactId: xeroContact.contactID,
            xeroSyncedAt: new Date(),
          });
          synced++;
        }
      } catch (err) {
        errors.push(`Failed to sync contact ${xeroContact.name}: ${err}`);
      }
    }

    await storage.updateXeroConnection(connection.id, { lastSyncAt: new Date() });

    xeroLog("syncContactsFromXero", { userId, synced, updated, errors: errors.length });
    await recordSyncRun(userId, "contacts", "from_xero", startTime, synced + updated, errors.length, errors,
      errors.length === 0 ? "success" : synced + updated > 0 ? "partial" : "failure");

    return { synced, updated, errors };
  } catch (err) {
    await recordSyncRun(userId, "contacts", "from_xero", startTime, synced + updated, errors.length + 1,
      [...errors, String(err)], "failure");
    throw new Error(`Failed to fetch contacts from Xero: ${err}`);
  }
}

export async function syncInvoicesToXero(userId: string): Promise<{ synced: number; skipped: number; errors: string[] }> {
  const startTime = Date.now();
  const { xero, connection } = await getRefreshedClientAndConnection(userId);

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const invoices = await storage.getInvoices(userId);
    const clients = await storage.getClients(userId);
    
    for (const invoice of invoices) {
      try {
        if (invoice.status === 'draft') continue;
        
        if (invoice.xeroInvoiceId) {
          skipped++;
          continue;
        }
        
        const client = clients.find(c => c.id === invoice.clientId);
        if (!client) continue;

        const lineItems = await storage.getInvoiceLineItems(invoice.id);
        
        const businessSettings = await storage.getBusinessSettings(userId);
        // Task #91: prefer the new mapping IDs; legacy code/type kept as fallback.
        const salesAccountCode = businessSettings?.xeroSalesAccountId || businessSettings?.xeroSalesAccountCode || "200";
        const taxType = businessSettings?.xeroTaxRateId || businessSettings?.xeroTaxType || "OUTPUT";
        const itemCode = businessSettings?.xeroDefaultItemCode;
        
        const invoiceDate = (invoice as any).issueDate || invoice.createdAt;
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
            itemCode: itemCode || undefined,
          })),
          date: invoiceDate ? new Date(invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : undefined,
          reference: invoice.number || (invoice as any).invoiceNumber || undefined,
          status: invoice.status === 'sent' ? "AUTHORISED" as any : "DRAFT" as any,
        };

        const response = await xeroApiCall(connection, "createInvoice", () =>
          xero.accountingApi.createInvoices(connection.tenantId, { invoices: [xeroInvoice as any] })
        );
        
        const createdXeroInvoice = response.body.invoices?.[0];
        if (createdXeroInvoice?.invoiceID) {
          await storage.updateInvoice(invoice.id, userId, {
            xeroInvoiceId: createdXeroInvoice.invoiceID,
            xeroSyncedAt: new Date(),
          });
          // Task #91 (review fix): bulk push parity — best-effort PDF attach.
          const _invId = invoice.id;
          buildInvoicePdfBuffer(userId, _invId)
            .then(buf => buf && attachInvoicePdfToXero(userId, _invId, buf, `Invoice-${invoice.number || _invId}.pdf`))
            .then(r => r && !r.success && xeroLog('attachInvoicePdf', { userId, invoiceId: _invId, status: 'warn', error: r.error }))
            .catch(err => xeroLog('attachInvoicePdf', { userId, invoiceId: _invId, status: 'error', error: String(err) }));
        }
        
        synced++;
      } catch (err) {
        errors.push(`Failed to sync invoice ${invoice.number || (invoice as any).invoiceNumber}: ${err}`);
      }
    }

    await storage.updateXeroConnection(connection.id, { lastSyncAt: new Date() });

    xeroLog("syncInvoicesToXero", { userId, synced, skipped, errors: errors.length });
    await recordSyncRun(userId, "invoices", "to_xero", startTime, synced, errors.length, errors,
      errors.length === 0 ? "success" : synced > 0 ? "partial" : "failure");

    return { synced, skipped, errors };
  } catch (err) {
    await recordSyncRun(userId, "invoices", "to_xero", startTime, synced, errors.length + 1,
      [...errors, String(err)], "failure");
    throw new Error(`Failed to sync invoices to Xero: ${err}`);
  }
}

export async function syncSingleInvoiceToXero(userId: string, invoiceId: string): Promise<{ success: boolean; xeroInvoiceId?: string; error?: string }> {
  try {
    const connection = await storage.getXeroConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: true };
    }

    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (invoice.xeroInvoiceId) {
      return { success: true, xeroInvoiceId: invoice.xeroInvoiceId };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const xero = prepareXeroClient(refreshedConnection);

    const clients = await storage.getClients(userId);
    const client = clients.find(c => c.id === invoice.clientId);
    if (!client) {
      return { success: false, error: "Client not found" };
    }

    const lineItems = await storage.getInvoiceLineItems(invoice.id);
    
    const businessSettings = await storage.getBusinessSettings(userId);
    // Task #91: prefer the new mapping IDs; legacy code/type kept as fallback.
    const salesAccountCode = businessSettings?.xeroSalesAccountId || businessSettings?.xeroSalesAccountCode || "200";
    const taxType = businessSettings?.xeroTaxRateId || businessSettings?.xeroTaxType || "OUTPUT";
    const itemCode = businessSettings?.xeroDefaultItemCode;
    
    const invoiceDate = (invoice as any).issueDate || invoice.createdAt;
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
        itemCode: itemCode || undefined,
      })),
      date: invoiceDate ? new Date(invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : undefined,
      reference: invoice.number || (invoice as any).invoiceNumber || undefined,
      status: "AUTHORISED" as any,
    };

    const response = await xeroApiCall(refreshedConnection, "createSingleInvoice", () =>
      xero.accountingApi.createInvoices(refreshedConnection.tenantId, { invoices: [xeroInvoice as any] })
    );
    
    const createdXeroInvoice = response.body.invoices?.[0];
    if (createdXeroInvoice?.invoiceID) {
      await storage.updateInvoice(invoice.id, userId, {
        xeroInvoiceId: createdXeroInvoice.invoiceID,
        xeroSyncedAt: new Date(),
      });
      xeroLog("syncSingleInvoice", { userId, invoiceId, xeroInvoiceId: createdXeroInvoice.invoiceID, status: "success" });
      // Task #91: best-effort PDF auto-attach so the customer always sees the
      // same PDF the tradie sent. Non-blocking — failures are logged but do
      // not roll back the push.
      buildInvoicePdfBuffer(userId, invoiceId)
        .then(buf => {
          if (!buf) return;
          return attachInvoicePdfToXero(userId, invoiceId, buf, `Invoice-${invoice.number || invoice.id}.pdf`);
        })
        .then(r => r && !r.success && xeroLog('attachInvoicePdf', { userId, invoiceId, status: 'warn', error: r.error }))
        .catch(err => xeroLog('attachInvoicePdf', { userId, invoiceId, status: 'error', error: String(err) }));
      return { success: true, xeroInvoiceId: createdXeroInvoice.invoiceID };
    }

    return { success: true };
  } catch (err) {
    xeroLog("syncSingleInvoice", { userId, invoiceId, status: "error", error: String(err) });
    return { success: false, error: String(err) };
  }
}

export async function markInvoicePaidInXero(userId: string, invoiceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const connection = await storage.getXeroConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: true };
    }

    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (!invoice.xeroInvoiceId) {
      xeroLog("markPaid", { userId, invoiceId, status: "skipped", reason: "not_synced_to_xero" });
      return { success: true };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const xero = prepareXeroClient(refreshedConnection);

    const businessSettings = await storage.getBusinessSettings(userId);
    const bankAccountCode = businessSettings?.xeroBankAccountCode || "090";
    
    const payment = {
      invoice: { invoiceID: invoice.xeroInvoiceId },
      account: { code: bankAccountCode },
      date: new Date().toISOString().split('T')[0],
      amount: parseFloat(invoice.total || "0"),
    };

    await xeroApiCall(refreshedConnection, "createPayment", () =>
      xero.accountingApi.createPayment(refreshedConnection.tenantId, payment)
    );
    
    await storage.updateInvoice(invoice.id, userId, { xeroSyncedAt: new Date() });

    xeroLog("markPaid", { userId, invoiceId, status: "success" });
    return { success: true };
  } catch (err) {
    xeroLog("markPaid", { userId, invoiceId, status: "error", error: String(err) });
    return { success: false, error: String(err) };
  }
}

export async function getConnectionStatus(userId: string): Promise<{
  connected: boolean;
  tenantName?: string;
  tenantId?: string;
  lastSyncAt?: Date;
  status?: string;
  needsReconnect?: boolean;
}> {
  const connection = await storage.getXeroConnection(userId);
  
  if (!connection) {
    return { connected: false };
  }

  const needsReconnect = connection.status === "token_expired" || connection.status === "disconnected";

  return {
    connected: connection.status === "active",
    tenantName: connection.tenantName || undefined,
    tenantId: connection.tenantId,
    lastSyncAt: connection.lastSyncAt || undefined,
    status: connection.status || "unknown",
    needsReconnect,
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

export async function syncQuoteToXero(userId: string, quoteId: string): Promise<{ success: boolean; xeroInvoiceId?: string; error?: string }> {
  try {
    const connection = await storage.getXeroConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: true };
    }

    const quote = await storage.getQuote(quoteId, userId);
    if (!quote) {
      return { success: false, error: "Quote not found" };
    }

    if ((quote as any).xeroInvoiceId) {
      return { success: true, xeroInvoiceId: (quote as any).xeroInvoiceId };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const xero = prepareXeroClient(refreshedConnection);

    const clients = await storage.getClients(userId);
    const client = clients.find(c => c.id === quote.clientId);
    if (!client) {
      return { success: false, error: "Client not found" };
    }

    const lineItems = await storage.getQuoteLineItems(quoteId);
    
    const businessSettings = await storage.getBusinessSettings(userId);
    // Task #91: prefer the new mapping IDs; legacy code/type kept as fallback.
    const salesAccountCode = businessSettings?.xeroSalesAccountId || businessSettings?.xeroSalesAccountCode || "200";
    const taxType = businessSettings?.xeroTaxRateId || businessSettings?.xeroTaxType || "OUTPUT";
    const itemCode = businessSettings?.xeroDefaultItemCode;
    
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
        itemCode: itemCode || undefined,
      })),
      date: new Date().toISOString().split('T')[0],
      reference: `Quote: ${quote.number || (quote as any).quoteNumber}`,
      status: "DRAFT" as any,
    };

    const response = await xeroApiCall(refreshedConnection, "createQuoteInvoice", () =>
      xero.accountingApi.createInvoices(refreshedConnection.tenantId, { invoices: [xeroInvoice as any] })
    );
    
    const createdXeroInvoice = response.body.invoices?.[0];
    if (createdXeroInvoice?.invoiceID) {
      await storage.updateQuote(quote.id, userId, {
        xeroInvoiceId: createdXeroInvoice.invoiceID,
        xeroSyncedAt: new Date(),
      } as any);
      xeroLog("syncQuote", { userId, quoteId, xeroInvoiceId: createdXeroInvoice.invoiceID, status: "success" });
      return { success: true, xeroInvoiceId: createdXeroInvoice.invoiceID };
    }

    return { success: true };
  } catch (err) {
    xeroLog("syncQuote", { userId, quoteId, status: "error", error: String(err) });
    return { success: false, error: String(err) };
  }
}

/**
 * Push a quote to Xero using the *real* Xero Quotes API (vs syncQuoteToXero
 * above which creates a DRAFT invoice — kept for backwards-compat). Persists
 * the new Xero Quote ID on quotes.xeroQuoteId so we don't double-push.
 */
export async function pushQuoteToXero(userId: string, quoteId: string): Promise<{ success: boolean; xeroQuoteId?: string; error?: string }> {
  try {
    const connection = await storage.getXeroConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: true };
    }

    const quote = await storage.getQuote(quoteId, userId);
    if (!quote) return { success: false, error: "Quote not found" };
    if ((quote as any).xeroQuoteId) {
      return { success: true, xeroQuoteId: (quote as any).xeroQuoteId };
    }

    // Task #91: route through getRefreshedClientAndConnection so the
    // multi-tenant selector (xeroActiveTenantId) is honoured.
    const { xero, connection: refreshedConnection } = await getRefreshedClientAndConnection(userId);

    const clients = await storage.getClients(userId);
    const client = clients.find(c => c.id === quote.clientId);
    if (!client) return { success: false, error: "Client not found" };

    const lineItems = await storage.getQuoteLineItems(quoteId);
    const settings = await storage.getBusinessSettings(userId);
    const salesAccountCode = settings?.xeroSalesAccountId || settings?.xeroSalesAccountCode || "200";
    const taxType = settings?.xeroTaxRateId || settings?.xeroTaxType || "OUTPUT";
    const itemCode = settings?.xeroDefaultItemCode;

    const xeroQuote: any = {
      contact: { name: client.name, emailAddress: client.email || undefined, contactID: client.xeroContactId || undefined },
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: parseFloat(item.quantity || "1"),
        unitAmount: parseFloat(item.unitPrice || "0"),
        accountCode: salesAccountCode,
        taxType,
        itemCode: itemCode || undefined,
      })),
      date: new Date().toISOString().split('T')[0],
      expiryDate: (quote as any).expiryDate ? new Date((quote as any).expiryDate).toISOString().split('T')[0] : undefined,
      quoteNumber: quote.number || (quote as any).quoteNumber || undefined,
      reference: quote.number || (quote as any).quoteNumber || undefined,
      status: quote.status === 'accepted' ? 'ACCEPTED' : quote.status === 'sent' ? 'SENT' : 'DRAFT',
    };

    const response = await xeroApiCall(refreshedConnection, "createQuote", () =>
      (xero.accountingApi as any).createQuotes(refreshedConnection.tenantId, { quotes: [xeroQuote] })
    );
    const created = (response as any).body.quotes?.[0];
    if (created?.quoteID) {
      await storage.updateQuote(quote.id, userId, { xeroQuoteId: created.quoteID, xeroSyncedAt: new Date() } as any);
      xeroLog("pushQuote", { userId, quoteId, xeroQuoteId: created.quoteID, status: "success" });
      return { success: true, xeroQuoteId: created.quoteID };
    }
    return { success: true };
  } catch (err) {
    xeroLog("pushQuote", { userId, quoteId, status: "error", error: String(err) });
    return { success: false, error: String(err) };
  }
}

/**
 * Attach a generated invoice PDF to the matching Xero invoice. Best-effort —
 * returns success:false but never throws so it can be fired-and-forgotten
 * after a successful invoice push.
 */
export async function attachInvoicePdfToXero(userId: string, invoiceId: string, pdfBuffer: Buffer, fileName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice?.xeroInvoiceId) return { success: false, error: "Invoice not synced to Xero" };
    const { xero, connection } = await getRefreshedClientAndConnection(userId);
    await xeroApiCall(connection, "attachInvoicePdf", () =>
      (xero.accountingApi as any).createInvoiceAttachmentByFileName(
        connection.tenantId, invoice.xeroInvoiceId!, fileName, pdfBuffer, true
      )
    );
    xeroLog("attachInvoicePdf", { userId, invoiceId, fileName, status: "success" });
    return { success: true };
  } catch (err) {
    xeroLog("attachInvoicePdf", { userId, invoiceId, status: "error", error: String(err) });
    return { success: false, error: String(err) };
  }
}

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

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const xero = prepareXeroClient(refreshedConnection);

    const xeroContact: Contact = {
      name: client.name,
      emailAddress: client.email || undefined,
      phones: client.phone ? [{ phoneType: Phone.PhoneTypeEnum.MOBILE, phoneNumber: client.phone }] : undefined,
      addresses: client.address ? [{
        addressType: Address.AddressTypeEnum.STREET,
        addressLine1: client.address,
      }] : undefined,
    };

    if (client.xeroContactId) {
      xeroContact.contactID = client.xeroContactId;
      const response = await xeroApiCall(refreshedConnection, "updateContact", () =>
        xero.accountingApi.updateContact(refreshedConnection.tenantId, client.xeroContactId!, {
          contacts: [xeroContact],
        })
      );
      const updatedContact = response.body.contacts?.[0];
      await storage.updateClient(client.id, userId, { xeroSyncedAt: new Date() });
      xeroLog("pushClient", { userId, clientId, xeroContactId: client.xeroContactId, action: "updated" });
      return { success: true, xeroContactId: updatedContact?.contactID || client.xeroContactId };
    }

    const response = await xeroApiCall(refreshedConnection, "createContact", () =>
      xero.accountingApi.createContacts(refreshedConnection.tenantId, { contacts: [xeroContact] })
    );
    
    const createdContact = response.body.contacts?.[0];
    if (createdContact?.contactID) {
      await storage.updateClient(client.id, userId, {
        xeroContactId: createdContact.contactID,
        xeroSyncedAt: new Date(),
      });
      xeroLog("pushClient", { userId, clientId, xeroContactId: createdContact.contactID, action: "created" });
      return { success: true, xeroContactId: createdContact.contactID };
    }

    return { success: true };
  } catch (err) {
    xeroLog("pushClient", { userId, clientId, status: "error", error: String(err) });
    return { success: false, error: String(err) };
  }
}

export async function getChartOfAccounts(userId: string): Promise<Array<{ id: string; code: string; name: string; type: string }>> {
  const { xero, connection } = await getRefreshedClientAndConnection(userId);

  const response = await xeroApiCall(connection, "getAccounts", () =>
    xero.accountingApi.getAccounts(connection.tenantId)
  );
  const accounts = response.body.accounts || [];

  // Task #91 (review fix): normalize to a consistent { id, code, name, type }
  // contract so the mapping UI can use a single value accessor across providers.
  return accounts.map(acc => ({
    id: acc.accountID || '',
    code: acc.code || '',
    name: acc.name || '',
    type: acc.type || '',
  }));
}

// Cached pull (60s TTL) — used by the Integrations mapping UI, which
// re-renders frequently. The cache is per-user.
export async function getCachedAccounts(userId: string) {
  return xeroAccountsCache.getOrLoad(userId, () => getChartOfAccounts(userId));
}
export async function getCachedTaxRates(userId: string) {
  return xeroTaxRatesCache.getOrLoad(userId, () => getTaxRates(userId));
}
export async function getCachedItems(userId: string) {
  return xeroItemsCache.getOrLoad(userId, async () => {
    const { xero, connection } = await getRefreshedClientAndConnection(userId);
    const response = await xeroApiCall(connection, "getItems", () =>
      xero.accountingApi.getItems(connection.tenantId)
    );
    const items = response.body.items || [];
    // Task #91 (review fix): normalized DTO shape — `id` is always populated;
    // `code` is what Xero invoice payloads expect for itemCode.
    return items.map((it: any) => ({
      id: it.itemID || '',
      code: it.code || '',
      name: it.name || '',
      description: it.description || '',
    }));
  });
}
export function invalidateXeroMappingCache(userId: string) {
  xeroAccountsCache.invalidate(userId);
  xeroTaxRatesCache.invalidate(userId);
  xeroItemsCache.invalidate(userId);
}

export async function getBankAccounts(userId: string): Promise<Array<{ accountId: string; code: string; name: string }>> {
  const { xero, connection } = await getRefreshedClientAndConnection(userId);

  const response = await xeroApiCall(connection, "getBankAccounts", () =>
    xero.accountingApi.getAccounts(connection.tenantId, undefined, 'Type=="BANK"')
  );
  const accounts = response.body.accounts || [];
  
  return accounts.map(acc => ({
    accountId: acc.accountID || '',
    code: acc.code || '',
    name: acc.name || '',
  }));
}

export async function getTaxRates(userId: string): Promise<Array<{ name: string; taxType: string; rate: number }>> {
  const { xero, connection } = await getRefreshedClientAndConnection(userId);

  const response = await xeroApiCall(connection, "getTaxRates", () =>
    xero.accountingApi.getTaxRates(connection.tenantId)
  );
  const taxRates = response.body.taxRates || [];
  
  return taxRates.map(tax => ({
    name: tax.name || '',
    taxType: tax.taxType || '',
    rate: tax.effectiveRate || 0,
  }));
}

// Bulk sync all unsynced clients to Xero
export async function syncAllClientsToXero(userId: string): Promise<{ synced: number; updated: number; skipped: number; errors: string[] }> {
  const connection = await storage.getXeroConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active Xero connection found");
  }

  const clients = await storage.getClients(userId);
  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  let updated = 0;
  for (const client of clients) {
    if (client.xeroContactId) {
      const localChangedSinceSync = !client.xeroSyncedAt || 
        (client.updatedAt && new Date(client.updatedAt) > new Date(client.xeroSyncedAt));
      if (localChangedSinceSync) {
        const result = await pushClientToXero(userId, client.id);
        if (result.success) {
          updated++;
        } else if (result.error) {
          errors.push(`${client.name}: ${result.error}`);
        }
      } else {
        skipped++;
      }
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
  return { synced, updated, skipped, errors };
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
  
  const unsyncedClients = clients.filter(c => !c.xeroContactId).length;

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
  const startTime = Date.now();
  const { xero, connection } = await getRefreshedClientAndConnection(userId);

  let updated = 0;
  const errors: string[] = [];
  const details: Array<{ invoiceId: string; invoiceNumber: string; amountPaid: number }> = [];

  try {
    // Get all JobRunner invoices that have been synced to Xero but not marked as paid
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
        const xeroResponse = await xeroApiCall(connection, "getInvoicesBatch", () =>
          xero.accountingApi.getInvoices(
            connection.tenantId,
            ifModifiedSince,
            undefined,
            undefined,
            batchIds
          )
        );
        
        const fetchedInvoices = xeroResponse.body.invoices || [];
        xeroLog("syncPaymentsBatch", { userId, batch: Math.floor(i/batchSize) + 1, fetched: fetchedInvoices.length, requested: batchIds.length });
        
        for (const inv of fetchedInvoices) {
          if (inv.invoiceID) {
            xeroInvoiceMap.set(inv.invoiceID, inv);
          }
        }
      } catch (batchErr: any) {
        xeroLog("syncPaymentsBatch", { userId, status: "warning", error: batchErr.message });
        if (!batchErr.message?.includes('304') && !batchErr.message?.includes('Not Modified')) {
          for (const id of batchIds) {
            try {
              const resp = await xeroApiCall(connection, "getInvoice", () =>
                xero.accountingApi.getInvoice(connection.tenantId, id)
              );
              const inv = resp.body.invoices?.[0];
              if (inv?.invoiceID) {
                xeroInvoiceMap.set(inv.invoiceID, inv);
              }
            } catch (individualErr: any) {
              if (!individualErr.message?.includes('404')) {
                errors.push(`Failed to fetch invoice ${id}: ${individualErr.message || individualErr}`);
              }
            }
          }
        }
      }
    }

    for (const invoice of syncedInvoices) {
      try {
        const xeroInvoice = xeroInvoiceMap.get(invoice.xeroInvoiceId!);
        if (!xeroInvoice) continue;

        if (xeroInvoice.status === 'PAID' && invoice.status !== 'paid') {
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
          
          xeroLog("paymentDetected", { userId, invoiceId: invoice.id, invoiceNumber: invoice.number });
        }
        
        if (xeroInvoice.amountPaid > 0 && xeroInvoice.status !== 'PAID') {
          xeroLog("partialPayment", {
            userId,
            invoiceId: invoice.id,
            paidAmount: xeroInvoice.amountPaid,
            totalAmount: parseFloat(invoice.total || '0'),
          });
        }
        
        if (xeroInvoice.status === 'VOIDED' && invoice.status !== 'cancelled') {
          await storage.updateInvoice(invoice.id, userId, {
            status: 'cancelled',
            xeroSyncedAt: new Date(),
          });
          xeroLog("invoiceVoided", { userId, invoiceId: invoice.id });
        }

      } catch (err) {
        errors.push(`Failed to process invoice ${invoice.number || invoice.id}: ${err}`);
      }
    }

    await storage.updateXeroConnection(connection.id, { lastSyncAt: new Date() });

    await recordSyncRun(userId, "payments", "from_xero", startTime, updated, errors.length, errors,
      errors.length === 0 ? "success" : updated > 0 ? "partial" : "failure");

    return { updated, errors, details };
  } catch (err) {
    await recordSyncRun(userId, "payments", "from_xero", startTime, updated, errors.length + 1,
      [...errors, String(err)], "failure");
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
  const startTime = Date.now();
  const { xero, connection } = await getRefreshedClientAndConnection(userId);

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

    const xeroResponse = await xeroApiCall(connection, "getInvoiceStatuses", () =>
      xero.accountingApi.getInvoices(
        connection.tenantId,
        ifModifiedSince,
        'Status=="PAID" || Status=="VOIDED"',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      )
    );

    const recentlyModifiedInvoices = xeroResponse.body.invoices || [];
    xeroLog("syncInvoiceStatus", { userId, found: recentlyModifiedInvoices.length });

    // Status mapping from Xero to JobRunner
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
          xeroLog("invoiceVoided", { invoiceId: localInvoice.id, number: localInvoice.number || "unknown" });
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
          xeroLog("invoiceStatusUpdated", { invoiceId: localInvoice.id, number: localInvoice.number || "unknown", newStatus });
        }
      } catch (err) {
        errors.push(`Failed to sync status for invoice ${localInvoice.number || localInvoice.id}: ${err}`);
      }
    }

    await storage.updateXeroConnection(connection.id, { lastSyncAt: new Date() });
    await recordSyncRun(userId, "invoice_status", "from_xero", startTime, voided + updated, errors.length, errors,
      errors.length === 0 ? "success" : voided + updated > 0 ? "partial" : "failure");
    return { voided, updated, errors };
  } catch (err) {
    await recordSyncRun(userId, "invoice_status", "from_xero", startTime, voided + updated, errors.length + 1,
      [...errors, String(err)], "failure");
    throw new Error(`Failed to sync invoice status from Xero: ${err}`);
  }
}

export async function voidInvoiceInXero(userId: string, invoiceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const connection = await storage.getXeroConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: true };
    }

    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice || !invoice.xeroInvoiceId) {
      return { success: true };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const xero = prepareXeroClient(refreshedConnection);

    await xeroApiCall(refreshedConnection, "voidInvoice", () =>
      xero.accountingApi.updateInvoice(
        refreshedConnection.tenantId,
        invoice.xeroInvoiceId!,
        {
          invoices: [{
            invoiceID: invoice.xeroInvoiceId!,
            status: 'VOIDED' as any,
          }],
        }
      )
    );

    await storage.updateInvoice(invoice.id, userId, { xeroSyncedAt: new Date() });
    xeroLog("voidInvoice", { userId, invoiceId, status: "success" });
    return { success: true };
  } catch (err) {
    xeroLog("voidInvoice", { userId, invoiceId, status: "error", error: String(err) });
    return { success: false, error: String(err) };
  }
}

export async function syncCreditNotesFromXero(userId: string): Promise<{
  synced: number;
  appliedToInvoices: number;
  errors: string[];
}> {
  const startTime = Date.now();
  const { xero, connection } = await getRefreshedClientAndConnection(userId);

  let synced = 0;
  let appliedToInvoices = 0;
  const errors: string[] = [];

  try {
    // Get credit notes from Xero
    const response = await xeroApiCall(connection, "getCreditNotes", () =>
      xero.accountingApi.getCreditNotes(connection.tenantId)
    );
    const creditNotes = response.body.creditNotes || [];

    const invoices = await storage.getInvoices(userId);
    const xeroInvoiceMap = new Map(
      invoices.filter(inv => inv.xeroInvoiceId).map(inv => [inv.xeroInvoiceId, inv])
    );

    for (const creditNote of creditNotes) {
      try {
        const allocations = creditNote.allocations || [];
        for (const allocation of allocations) {
          const invoiceId = allocation.invoice?.invoiceID;
          if (invoiceId && xeroInvoiceMap.has(invoiceId)) {
            const invoice = xeroInvoiceMap.get(invoiceId)!;
            const creditAmount = allocation.amount || 0;
            
            const currentTotal = parseFloat(invoice.total || '0');
            const newTotal = Math.max(0, currentTotal - creditAmount);
            
            await storage.updateInvoice(invoice.id, userId, {
              total: newTotal.toFixed(2),
              xeroSyncedAt: new Date(),
            });
            
            appliedToInvoices++;
            xeroLog("creditNoteApplied", { userId, creditNoteNumber: creditNote.creditNoteNumber, invoiceId: invoice.id });
          }
        }
        synced++;
      } catch (err) {
        errors.push(`Failed to sync credit note ${creditNote.creditNoteNumber}: ${err}`);
      }
    }

    await storage.updateXeroConnection(connection.id, { lastSyncAt: new Date() });
    await recordSyncRun(userId, "credit_notes", "from_xero", startTime, synced, errors.length, errors,
      errors.length === 0 ? "success" : synced > 0 ? "partial" : "failure");
    return { synced, appliedToInvoices, errors };
  } catch (err) {
    await recordSyncRun(userId, "credit_notes", "from_xero", startTime, synced, errors.length + 1,
      [...errors, String(err)], "failure");
    throw new Error(`Failed to sync credit notes from Xero: ${err}`);
  }
}

export async function syncInventoryFromXero(userId: string): Promise<{
  synced: number;
  updated: number;
  errors: string[];
}> {
  const startTime = Date.now();
  const { xero, connection } = await getRefreshedClientAndConnection(userId);

  let synced = 0;
  let updated = 0;
  const errors: string[] = [];

  try {
    // Get items from Xero
    const response = await xeroApiCall(connection, "getItems", () =>
      xero.accountingApi.getItems(connection.tenantId)
    );
    const xeroItems = response.body.items || [];

    // Get existing catalog items
    const existingItems = await storage.getLineItemCatalog(userId);
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

    await storage.updateXeroConnection(connection.id, { lastSyncAt: new Date() });
    await recordSyncRun(userId, "inventory", "from_xero", startTime, synced + updated, errors.length, errors,
      errors.length === 0 ? "success" : synced + updated > 0 ? "partial" : "failure");
    return { synced, updated, errors };
  } catch (err) {
    await recordSyncRun(userId, "inventory", "from_xero", startTime, synced + updated, errors.length + 1,
      [...errors, String(err)], "failure");
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

    xeroLog("fullSyncComplete", { userId, paymentsUpdated, invoicesUpdated, invoicesVoided, creditNotesApplied: creditNotesApplied, inventorySynced });

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
      clients: clients.filter(c => !c.xeroContactId).length,
    },
  };
}

export async function checkConnectionHealth(userId: string): Promise<{
  healthy: boolean;
  status: string;
  tenantName?: string;
  tenantId?: string;
  tokenValid: boolean;
  lastSyncAt?: Date;
  error?: string;
}> {
  try {
    const connection = await storage.getXeroConnection(userId);
    if (!connection) {
      return { healthy: false, status: "not_connected", tokenValid: false };
    }

    if (connection.status === "token_expired" || connection.status === "disconnected") {
      return {
        healthy: false,
        status: connection.status,
        tenantName: connection.tenantName || undefined,
        tenantId: connection.tenantId,
        tokenValid: false,
        lastSyncAt: connection.lastSyncAt || undefined,
        error: "Connection needs to be re-established",
      };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const xero = prepareXeroClient(refreshedConnection);

    const response = await xeroApiCall(refreshedConnection, "healthCheck", () =>
      xero.accountingApi.getOrganisations(refreshedConnection.tenantId)
    );

    const org = response.body.organisations?.[0];

    xeroLog("healthCheck", { userId, tenantId: refreshedConnection.tenantId, status: "healthy" });

    return {
      healthy: true,
      status: "active",
      tenantName: org?.name || refreshedConnection.tenantName || undefined,
      tenantId: refreshedConnection.tenantId,
      tokenValid: true,
      lastSyncAt: refreshedConnection.lastSyncAt || undefined,
    };
  } catch (err: any) {
    xeroLog("healthCheck", { userId, status: "unhealthy", error: err.message });
    return {
      healthy: false,
      status: "error",
      tokenValid: false,
      error: err.message,
    };
  }
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const webhookKey = process.env.XERO_WEBHOOK_KEY;
  if (!webhookKey) {
    xeroLog("webhook", { status: "error", error: "XERO_WEBHOOK_KEY not configured" });
    return false;
  }
  try {
    const expectedSignature = crypto
      .createHmac("sha256", webhookKey)
      .update(payload)
      .digest("base64");
    const sigBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export async function processWebhookEvent(event: {
  tenantId: string;
  resourceId: string;
  eventCategory: string;
  eventType: string;
}): Promise<void> {
  const { tenantId, resourceId, eventCategory, eventType } = event;

  xeroLog("webhookEvent", { tenantId, resourceId, eventCategory, eventType });

  const connections = await findConnectionsByTenant(tenantId);
  if (connections.length === 0) {
    xeroLog("webhookEvent", { tenantId, status: "skipped", reason: "no_connection_for_tenant" });
    return;
  }

  for (const conn of connections) {
    await processSingleWebhookEvent(conn.userId, tenantId, resourceId, eventCategory, eventType);
  }
}

async function processSingleWebhookEvent(
  userId: string, tenantId: string, resourceId: string, eventCategory: string, eventType: string
): Promise<void> {
  try {
    if (eventCategory === "INVOICE") {
      if (eventType === "UPDATE" || eventType === "CREATE") {
        const { xero, connection } = await getRefreshedClientAndConnection(userId);
        const response = await xeroApiCall(connection, "webhookGetInvoice", () =>
          xero.accountingApi.getInvoice(connection.tenantId, resourceId)
        );
        const xeroInvoice = response.body.invoices?.[0];
        if (!xeroInvoice) return;

        const invoices = await storage.getInvoices(userId);
        const localInvoice = invoices.find(inv => inv.xeroInvoiceId === xeroInvoice.invoiceID);
        if (!localInvoice) return;

        if (String(xeroInvoice.status) === "PAID" && localInvoice.status !== "paid") {
          await storage.updateInvoice(localInvoice.id, userId, {
            status: "paid",
            paidAt: xeroInvoice.fullyPaidOnDate ? new Date(xeroInvoice.fullyPaidOnDate) : new Date(),
            xeroSyncedAt: new Date(),
          });
          xeroLog("webhookInvoicePaid", { userId, invoiceId: localInvoice.id });
        } else if (String(xeroInvoice.status) === "VOIDED" && localInvoice.status !== "cancelled") {
          await storage.updateInvoice(localInvoice.id, userId, {
            status: "cancelled",
            xeroSyncedAt: new Date(),
          });
          xeroLog("webhookInvoiceVoided", { userId, invoiceId: localInvoice.id });
        }
      }
    } else if (eventCategory === "CONTACT") {
      if (eventType === "UPDATE" || eventType === "CREATE") {
        const { xero, connection } = await getRefreshedClientAndConnection(userId);
        const response = await xeroApiCall(connection, "webhookGetContact", () =>
          xero.accountingApi.getContact(connection.tenantId, resourceId)
        );
        const xeroContact = response.body.contacts?.[0];
        if (!xeroContact || !xeroContact.name) return;

        const clients = await storage.getClients(userId);
        const matchingClient = clients.find(
          c => c.xeroContactId === xeroContact.contactID ||
               c.email?.toLowerCase() === xeroContact.emailAddress?.toLowerCase() ||
               c.name.toLowerCase() === xeroContact.name?.toLowerCase()
        );

        if (matchingClient) {
          const updates: Partial<InsertClient> = { xeroSyncedAt: new Date() };
          if (xeroContact.emailAddress && xeroContact.emailAddress !== matchingClient.email) updates.email = xeroContact.emailAddress;
          if (xeroContact.phones?.[0]?.phoneNumber && xeroContact.phones[0].phoneNumber !== matchingClient.phone) updates.phone = xeroContact.phones[0].phoneNumber;
          if (xeroContact.contactID && !matchingClient.xeroContactId) updates.xeroContactId = xeroContact.contactID;
          await storage.updateClient(matchingClient.id, userId, updates);
          xeroLog("webhookContactUpdated", { userId, clientId: matchingClient.id });
        }
      }
    } else if (eventCategory === "PAYMENT") {
      if (eventType === "CREATE") {
        await syncPaymentsFromXero(userId).catch(err =>
          xeroLog("webhookPaymentSync", { userId, status: "error", error: String(err) })
        );
      }
    }

    // INVOICE DELETE — Xero treats DELETE as "removed from the org"; mark local as cancelled.
    if (eventCategory === "INVOICE" && eventType === "DELETE") {
      const invoices = await storage.getInvoices(userId);
      const localInvoice = invoices.find(inv => inv.xeroInvoiceId === resourceId);
      if (localInvoice && localInvoice.status !== "cancelled") {
        await storage.updateInvoice(localInvoice.id, userId, { status: "cancelled", xeroSyncedAt: new Date() });
        xeroLog("webhookInvoiceDeleted", { userId, invoiceId: localInvoice.id });
      }
    }

    // Stamp lastWebhookAt — used by Integrations /test endpoint to surface "last
    // webhook X seconds ago" so the user knows webhooks are actually arriving.
    try {
      const { storage: s } = await import('./storage');
      const settings = await s.getBusinessSettings(userId);
      if (settings) {
        await s.updateBusinessSettings(userId, { xeroLastWebhookAt: new Date() } as any);
      }
    } catch { /* best-effort */ }
  } catch (err) {
    xeroLog("webhookProcessing", { userId, tenantId, eventCategory, eventType, status: "error", error: String(err) });
  }
}

async function findConnectionsByTenant(tenantId: string): Promise<XeroConnection[]> {
  try {
    const allConnections = await storage.getAllXeroConnections?.();
    if (allConnections) {
      return allConnections.filter(c => c.tenantId === tenantId);
    }
    return [];
  } catch {
    return [];
  }
}

export async function getSyncHistory(userId: string, limit: number = 50): Promise<XeroSyncState[]> {
  return await storage.getXeroSyncHistory(userId, limit);
}

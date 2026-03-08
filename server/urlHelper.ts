/**
 * Centralized URL helper for generating consistent URLs across the application.
 * Production URLs always use jobrunner.com.au for branding and trust.
 */

const PRODUCTION_DOMAIN = 'jobrunner.com.au';

/**
 * Find the best custom domain from REPLIT_DOMAINS (prefer non-.replit.app domains)
 */
function getCustomDomainFromReplitDomains(): string | null {
  const domains = process.env.REPLIT_DOMAINS?.split(',') || [];
  const customDomain = domains.find(d => !d.endsWith('.replit.app') && !d.endsWith('.replit.dev') && !d.endsWith('.repl.co'));
  return customDomain || null;
}

/**
 * Get the base URL for public links (quotes, invoices, receipts, tracking).
 * In development, uses the dev domain so links work with the dev database.
 * In production, uses jobrunner.com.au.
 */
export function getProductionBaseUrl(req?: { protocol: string; get: (header: string) => string | undefined }): string {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    
    if (process.env.REPLIT_DOMAINS) {
      const customDomain = getCustomDomainFromReplitDomains();
      if (customDomain) {
        return `https://${customDomain}`;
      }
      const domains = process.env.REPLIT_DOMAINS.split(',');
      return `https://${domains[0]}`;
    }
    
    if (req) {
      return `${req.protocol}://${req.get('host')}`;
    }
    
    return 'http://localhost:5000';
  }
  
  // Production mode: use custom domain, never replit.app
  if (process.env.APP_DOMAIN) {
    return `https://${process.env.APP_DOMAIN}`;
  }
  
  const customDomain = getCustomDomainFromReplitDomains();
  if (customDomain) {
    return `https://${customDomain}`;
  }
  
  // Hardcoded fallback - never return a .replit.app domain for public links
  return `https://${PRODUCTION_DOMAIN}`;
}

/**
 * Generate a short public quote URL (for customers)
 */
export function getQuotePublicUrl(token: string, req?: { protocol: string; get: (header: string) => string | undefined }): string {
  const baseUrl = getProductionBaseUrl(req);
  return `${baseUrl}/q/${token}`;
}

/**
 * Generate a short public invoice URL (for customers)
 */
export function getInvoicePublicUrl(token: string, req?: { protocol: string; get: (header: string) => string | undefined }): string {
  const baseUrl = getProductionBaseUrl(req);
  return `${baseUrl}/i/${token}`;
}

/**
 * Generate a receipt URL (for customers)
 */
export function getReceiptPublicUrl(token: string, req?: { protocol: string; get: (header: string) => string | undefined }): string {
  const baseUrl = getProductionBaseUrl(req);
  return `${baseUrl}/receipt/${token}`;
}

/**
 * Generate a Stripe payment link URL
 */
export function getStripePaymentUrl(linkId: string): string {
  return `https://pay.stripe.com/c/${linkId}`;
}

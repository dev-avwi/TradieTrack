/**
 * Centralized URL helper for generating consistent URLs across the application.
 * Prioritizes the custom domain (tradietrack.com) for production trust and branding.
 */

/**
 * Get the production base URL for public links (quotes, invoices, receipts).
 * This URL should be consistent and trustworthy for customers.
 * 
 * Priority order:
 * 1. APP_DOMAIN environment variable (custom domain like tradietrack.com)
 * 2. VITE_APP_URL environment variable
 * 3. REPLIT_DOMAINS (production deployments)
 * 4. REPLIT_DEV_DOMAIN (development)
 * 5. Request host (fallback)
 * 6. localhost:5000 (last resort)
 */
export function getProductionBaseUrl(req?: { protocol: string; get: (header: string) => string | undefined }): string {
  // Priority 1: Custom production domain (for branding and trust)
  if (process.env.APP_DOMAIN) {
    return `https://${process.env.APP_DOMAIN}`;
  }
  
  // Priority 2: Explicitly set app URL
  if (process.env.VITE_APP_URL) {
    return process.env.VITE_APP_URL.replace(/\/$/, ''); // Remove trailing slash
  }
  
  // Priority 3: Production Replit domains
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    return `https://${domains[0]}`;
  }
  
  // Priority 4: Development Replit domain
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  // Priority 5: Use request host if available
  if (req) {
    return `${req.protocol}://${req.get('host')}`;
  }
  
  // Fallback to localhost
  return 'http://localhost:5000';
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

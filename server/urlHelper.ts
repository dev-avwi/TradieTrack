/**
 * Centralized URL helper for generating consistent URLs across the application.
 * Prioritizes the custom domain (tradietrack.com) for production trust and branding.
 */

/**
 * Get the base URL for public links (quotes, invoices, receipts).
 * In development, uses the dev domain so links work with the dev database.
 * In production, uses the custom domain (tradietrack.com) for branding/trust.
 * 
 * Development priority:
 * 1. REPLIT_DEV_DOMAIN (development Replit URL)
 * 2. Request host (fallback)
 * 
 * Production priority:
 * 1. APP_DOMAIN environment variable (custom domain like tradietrack.com)
 * 2. VITE_APP_URL environment variable
 * 3. REPLIT_DOMAINS (production deployments)
 * 4. Request host (fallback)
 * 5. localhost:5000 (last resort)
 */
export function getProductionBaseUrl(req?: { protocol: string; get: (header: string) => string | undefined }): string {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // In development, prioritize the dev domain so email links work with the dev database
  if (isDevelopment) {
    // Use development Replit domain first
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    
    // Use REPLIT_DOMAINS if available (development mode but deployed)
    if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(',');
      return `https://${domains[0]}`;
    }
    
    // Use request host if available
    if (req) {
      return `${req.protocol}://${req.get('host')}`;
    }
    
    return 'http://localhost:5000';
  }
  
  // Production mode: prioritize custom domain for branding and trust
  
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
  
  // Priority 4: Use request host if available
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

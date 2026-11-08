// Standard security response headers (shared by Express and the Vercel functions).
export function securityHeaders(production: boolean): Record<string, string> {
  const h: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
  // The strict Content-Security-Policy is applied to production builds only (the Vite dev server needs inline scripts for hot reload).
  if (production) {
    h['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
  }
  return h;
}

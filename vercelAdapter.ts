// Thin wrapper that lets every Vercel function in /api call the shared API in server/api.ts.
import { handleApi } from './api.js';
import { securityHeaders } from './security.js';

const first = (v: any): string | undefined => (Array.isArray(v) ? v[0] : v === undefined || v === null ? undefined : String(v));

export function vercelHandler(basePath: string) {
  return async (req: any, res: any) => {
    for (const [k, v] of Object.entries(securityHeaders(true))) res.setHeader(k, v);
    res.setHeader('Cache-Control', 'no-store');

    let body = req.body;
    if (typeof body === 'string') {
      if (body.trim() === '') body = {};
      else { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'The request body is not valid JSON.' }); } }
    }
    const query: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.query || {})) query[k] = first(v);
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers || {})) headers[k.toLowerCase()] = first(v);
    const ip = (headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';

    const r = await handleApi({ method: req.method || 'GET', path: basePath, query, body: body ?? {}, headers, ip });
    for (const [k, v] of Object.entries(r.headers || {})) res.setHeader(k, v);
    if (r.status === 204) return res.status(204).end();
    if (r.text !== undefined) { res.setHeader('Content-Type', r.contentType || 'text/plain; charset=utf-8'); return res.status(r.status).send(r.text); }
    return res.status(r.status).json(r.body);
  };
}

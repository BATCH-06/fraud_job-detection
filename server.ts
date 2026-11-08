import './server/env.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleApi } from './server/api.js';
import { securityHeaders } from './server/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const PORT = Number(process.env.PORT) || 3000;

const first = (v: unknown): string | undefined => (Array.isArray(v) ? String(v[0]) : typeof v === 'string' ? v : undefined);

async function startServer() {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    for (const [k, v] of Object.entries(securityHeaders(isProduction))) res.setHeader(k, v);
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  // JSON errors (bad JSON, body too large) instead of HTML error pages
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.path.startsWith('/api')) return next(err);
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large. Please send a shorter text.' });
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) return res.status(400).json({ error: 'The request body is not valid JSON.' });
    console.error('[API] Unexpected error:', err);
    return res.status(500).json({ error: 'Sorry, something went wrong on our side. Please try again in a few moments.' });
  });

  // All API routes live in server/api.ts (shared with the Vercel functions)
  app.all('/api/*', async (req, res) => {
    const query: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.query)) query[k] = first(v);
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = first(v);
    const r = await handleApi({ method: req.method, path: req.path, query, body: req.body ?? {}, headers, ip: req.ip || req.socket.remoteAddress || 'unknown' });
    for (const [k, v] of Object.entries(r.headers || {})) res.setHeader(k, v);
    if (r.status === 204) return res.status(204).end();
    if (r.text !== undefined) { res.setHeader('Content-Type', r.contentType || 'text/plain; charset=utf-8'); return res.status(r.status).send(r.text); }
    return res.status(r.status).json(r.body);
  });

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT, hmr: process.env.DISABLE_HMR !== 'true', watch: process.env.DISABLE_HMR === 'true' ? null : {} },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.resolve(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`[Scam Checker] Server running at http://0.0.0.0:${PORT}`));
}

startServer().catch(err => { console.error('Failed to start server:', err); process.exit(1); });

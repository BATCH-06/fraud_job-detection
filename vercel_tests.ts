import fs from 'fs';
process.env.VERCEL = '1';              // behave like Vercel: temporary /tmp storage
process.env.AUTH_SECRET = 'test-secret-test-secret-123';
process.env.ADMIN_EMAIL = 'admin@test.local'; process.env.ADMIN_PASSWORD = 'AdminPass123';
process.env.COMPANY_VERIFY_ONLINE = 'false'; process.env.RATE_LIMIT_PER_MIN = '100000'; process.env.REGISTER_LIMIT_PER_HOUR = '1000';
delete process.env.GEMINI_API_KEY;
const analyze = (await import('../api/analyze.js')).default;
const history = (await import('../api/history.js')).default;
const stats = (await import('../api/stats.js')).default;
const status = (await import('../api/system-status.js')).default;
const exportH = (await import('../api/export.js')).default;
const auth = (await import('../api/auth.js')).default;
const admin = (await import('../api/admin.js')).default;

function mk(method: string, body?: any, query?: any, token?: string) {
  const req: any = { method, body, query: query || {}, headers: token ? { authorization: 'Bearer ' + token } : {}, socket: { remoteAddress: '127.0.0.1' } };
  const out: any = { code: 0, json: null, text: null, headers: {} as any };
  const res: any = {
    setHeader: (k: string, v: string) => { out.headers[k.toLowerCase()] = v; },
    status: (c: number) => { out.code = c; return res; },
    json: (j: any) => { out.json = j; return res; },
    send: (t: any) => { out.text = t; return res; },
    end: () => res
  };
  return { req, res, out };
}
async function go(h: any, method: string, body?: any, query?: any, token?: string) { const m = mk(method, body, query, token); await h(m.req, m.res); return m.out; }

const R: any[] = [];
function rec(id: string, scenario: string, expected: string, actual: string, pass: boolean) {
  R.push({ id, type: 'Integration / Deployment handler', scenario, input: '', expected, actual, status: pass ? 'PASS' : 'FAIL' });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${scenario}\n      actual: ${actual}`);
}
const FRAUD = 'Pay a registration fee of Rs 500 to confirm your internship. Contact on Telegram @fastjobs_hr now.';
let o = await go(analyze, 'POST', { text: FRAUD });
rec('VC-01', 'api/analyze (Vercel handler): fraud text gives a verdict', 'HTTP 200, Fraudulent', `HTTP ${o.code}, ${o.json?.finalVerdict?.riskCategory}, ${o.json?.finalVerdict?.riskScore}`, o.code === 200 && o.json?.finalVerdict?.riskCategory === 'Fraudulent');
const guestRecord = o.json?.recordId;
o = await go(analyze, 'GET');
rec('VC-02', 'api/analyze rejects GET', 'HTTP 405', `HTTP ${o.code}`, o.code === 405);
o = await go(analyze, 'POST', { text: '' });
rec('VC-03', 'api/analyze empty text', 'HTTP 400', `HTTP ${o.code}`, o.code === 400);
o = await go(analyze, 'POST', JSON.stringify({ text: FRAUD }));
rec('VC-04', 'api/analyze accepts a body sent as a JSON string', 'HTTP 200', `HTTP ${o.code}`, o.code === 200);
o = await go(analyze, 'POST', '{"text": "broken');
rec('VC-04b', 'api/analyze malformed JSON body', 'HTTP 400 with a JSON error', `HTTP ${o.code}, ${JSON.stringify(o.json)}`, o.code === 400 && !!o.json?.error);
o = await go(analyze, 'OPTIONS');
rec('VC-05', 'api/analyze handles an OPTIONS request', 'HTTP 204', `HTTP ${o.code}`, o.code === 204);
rec('VC-06', 'CORS policy of the Vercel handlers', 'No "allow every origin" header', `Access-Control-Allow-Origin=${o.headers['access-control-allow-origin']}`, o.headers['access-control-allow-origin'] === undefined);
o = await go(analyze, 'POST', { text: FRAUD });
rec('VC-06b', 'Security headers on API responses', 'nosniff, X-Frame-Options and a Content-Security-Policy', `nosniff=${o.headers['x-content-type-options']}; frame=${o.headers['x-frame-options']}; csp=${!!o.headers['content-security-policy']}`, o.headers['x-content-type-options'] === 'nosniff' && o.headers['x-frame-options'] === 'DENY' && !!o.headers['content-security-policy']);

const reg = await go(auth, 'POST', { name: 'Vercel User', email: 'v@example.com', password: 'password123' }, { action: 'register' });
const token = reg.json?.token;
rec('VC-07a', 'api/auth register (action=register)', 'HTTP 201 and a token', `HTTP ${reg.code}, token=${!!token}`, reg.code === 201 && !!token);
let g = await go(history, 'GET');
rec('VC-07', 'api/history without sign-in is refused (history is private)', 'HTTP 401', `HTTP ${g.code}`, g.code === 401);
const mine = await go(analyze, 'POST', { text: FRAUD, jobTitle: 'VercelProbe' }, undefined, token);
g = await go(history, 'GET', undefined, undefined, token);
rec('VC-07b', 'api/history returns the signed-in user\'s check, and not the guest check', 'own record present, guest record absent', `HTTP ${g.code}; own=${(g.json?.records || []).some((r: any) => r.id === mine.json?.recordId)}; guest=${(g.json?.records || []).some((r: any) => r.id === guestRecord)}`, (g.json?.records || []).some((r: any) => r.id === mine.json?.recordId) && !(g.json?.records || []).some((r: any) => r.id === guestRecord));
o = await go(history, 'PATCH', undefined, { id: mine.json.recordId }, token);
rec('VC-08', 'api/history PATCH ?id= (bookmark toggle, the URL the web app calls)', 'HTTP 200', `HTTP ${o.code}`, o.code === 200);
o = await go(history, 'DELETE', undefined, { id: mine.json.recordId }, token);
rec('VC-09', 'api/history DELETE ?id=', 'HTTP 200', `HTTP ${o.code}`, o.code === 200);
o = await go(history, 'PUT', {}, undefined, token);
rec('VC-10', 'api/history unsupported method', 'HTTP 405', `HTTP ${o.code}`, o.code === 405);
o = await go(stats, 'GET', undefined, undefined, token);
rec('VC-11', 'api/stats', 'HTTP 200 with totalScans', `HTTP ${o.code}, totalScans=${o.json?.totalScans}`, o.code === 200 && typeof o.json?.totalScans === 'number');
o = await go(status, 'GET');
rec('VC-12', 'api/system-status on Vercel', 'HTTP 200 operational, environment vercel', `HTTP ${o.code}, env=${o.json?.environment}, storage=${o.json?.database?.storage}`, o.code === 200 && o.json?.status === 'operational' && o.json?.environment === 'vercel');
rec('VC-13', 'Storage on Vercel is permanent', 'Database survives between requests/deploys', `persistent=${o.json?.database?.persistent} (${o.json?.database?.storage}). Vercel files are erased between runs; the system reports this honestly and the sign-in dialog warns users`, o.json?.database?.persistent === true);
o = await go(exportH, 'GET', undefined, { format: 'csv' });
const o2 = await go(exportH, 'GET', undefined, { format: 'csv' }, token);
rec('VC-14', 'api/export needs sign-in', 'guest 401; signed in 200 CSV', `guest ${o.code}; user ${o2.code}, csv=${typeof o2.text === 'string' && o2.headers['content-type']?.includes('text/csv')}`, o.code === 401 && o2.code === 200);
o = await go(admin, 'GET', undefined, { resource: 'users' });
const o3 = await go(admin, 'GET', undefined, { resource: 'users' }, token);
const al = await go(auth, 'POST', { email: 'admin@test.local', password: 'AdminPass123' }, { action: 'login' });
const o4 = await go(admin, 'GET', undefined, { resource: 'users' }, al.json?.token);
rec('VC-15', 'api/admin access control and seeded admin', 'guest 401; student 403; admin 200', `guest ${o.code}; student ${o3.code}; admin ${o4.code} (users=${o4.json?.users?.length})`, o.code === 401 && o3.code === 403 && o4.code === 200);
o = await go(auth, 'GET', undefined, { action: 'me' }, token);
rec('VC-16', 'api/auth me', 'HTTP 200 and the user', `HTTP ${o.code}, ${o.json?.user?.email}`, o.code === 200 && o.json?.user?.email === 'v@example.com');
fs.writeFileSync('tests/results/vercel.json', JSON.stringify(R, null, 2));
console.log(`\nVERCEL-HANDLERS: ${R.filter(r => r.status === 'PASS').length}/${R.length} passed`);

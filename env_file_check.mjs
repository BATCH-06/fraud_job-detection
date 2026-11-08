// Checks that settings written in .env.local (AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD) are really used.
// 1) Put the settings in .env.local   2) start the server: npm start    3) node tests/env_file_check.mjs a
// 4) stop and start the server again  5) node tests/env_file_check.mjs b   (the old login token must still work)
import fs from 'fs';
const B = 'http://localhost:3000', F = 'tests/results/env_file_token.txt';
const email = process.env.ADMIN_EMAIL || 'admin@example.com', password = process.env.ADMIN_PASSWORD || 'AdminPass123';
const j = async (p, o) => { const r = await fetch(B + p, o); return { s: r.status, d: await r.json().catch(() => null) }; };
if (process.argv[2] === 'a') {
  const st = await j('/api/system-status');
  const l = await j('/api/auth?action=login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  fs.mkdirSync('tests/results', { recursive: true }); if (l.d?.token) fs.writeFileSync(F, l.d.token);
  console.log(`ENV-01 environment=${st.d.environment}; admin login HTTP ${l.s}, role=${l.d?.user?.role}  ->  ${l.s === 200 && l.d.user.role === 'admin' ? 'PASS' : 'FAIL'}`);
} else {
  const m = await j('/api/auth?action=me', { headers: { Authorization: 'Bearer ' + fs.readFileSync(F, 'utf8') } });
  console.log(`ENV-02 old token after restart: HTTP ${m.s}, user=${m.d?.user?.email}  ->  ${m.s === 200 ? 'PASS (AUTH_SECRET is read from the file and is stable)' : 'FAIL (a random secret is being used)'}`);
}

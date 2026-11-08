import fs from 'fs';

const BASE = 'http://localhost:3000';
const results = [];
const ctx = {};
let TOKEN = null;   // sign-in token of the test user (guest until set)
async function register(email, name = 'Test User', password = 'password123') {
  const r = await fetch(BASE + '/api/auth?action=register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
  const j = await r.json();
  return j.token;
}

async function call(method, path, body, opts = {}) {
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeout || 30000);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(opts.headers || (body !== undefined ? { 'Content-Type': 'application/json' } : {})), ...((opts.token ?? (opts.noAuth ? null : TOKEN)) ? { Authorization: 'Bearer ' + (opts.token ?? TOKEN) } : {}) },
      body: body === undefined ? undefined : (opts.raw ? body : JSON.stringify(body)),
      signal: ac.signal
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, ms: Date.now() - t0, headers: res.headers };
  } catch (e) {
    return { status: 0, json: null, text: String(e), ms: Date.now() - t0, headers: new Headers(), error: true };
  } finally { clearTimeout(timer); }
}

function rec(id, type, scenario, input, expected, actual, pass, extra = {}) {
  results.push({ id, type, scenario, input, expected, actual, status: pass ? 'PASS' : 'FAIL', ...extra });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${scenario}\n      actual: ${actual}`);
}
const short = (s, n = 110) => (s.length > n ? s.slice(0, n - 3).replace(/\n/g, ' ') + '...' : s.replace(/\n/g, ' '));
const verdict = r => r.json?.finalVerdict ? `HTTP ${r.status}, ${r.json.finalVerdict.riskCategory}, score ${r.json.finalVerdict.riskScore}` : `HTTP ${r.status}, ${short(r.text, 90)}`;

const GENUINE_TCS = `Dear Candidate,
Greetings from TCS Talent Acquisition Team.
We are pleased to invite you to the TCS Campus Hiring Technical Assessment for the batch of 2026.
Role: Graduate Trainee (Digital Track)
CTC Package: 7.0 LPA - 9.0 LPA upon successful completion of technical rounds and managerial interview.
Security Notice: TCS does not ask candidates for any payments, security deposits, or registration charges at any stage of recruitment.
Please review the guidelines on the official portal: https://nextstep.tcs.com.
Warm regards, Campus Talent Acquisition, Tata Consultancy Services`;
const GENUINE_PLAIN = 'We are hiring a Software Engineer Intern for our Hyderabad office. Apply through the careers page on our official website. Shortlisted candidates will attend an online coding test and two interview rounds. Stipend as per company norms.';
const FRAUD_1 = `URGENT HIRING FOR STUDENTS!
Work from home using your mobile phone for only 1 to 2 hours daily.
Earn ₹45,000 to ₹70,000 per month with daily payouts! Direct selection! No interview required.
To activate your merchant review account submit a 100% refundable security deposit of ₹2,500 (UPI: apexpay@okhdfcbank).
Contact our Senior HR Coordinator on Telegram immediately: @apex_recruiter_official.`;
const FRAUD_2 = `Congratulations! You are offered the Full-Stack Web Development Intern position with a monthly stipend of ₹38,000.
You will be dispatched an Apple MacBook Air. To cover mandatory registration processing and courier insurance, you are required to remit a registration charge of ₹3,800 within 24 hours.
Send transaction screenshot to hr.nextgencloud@yahoo.com.`;
const SUSP_4 = `CONGRATULATIONS! You have been selected for the position of Junior Remote Marketing Assistant at Starlight Digital Agency.
Monthly Pay: $3,200 USD (Remote, Flexible Hours).
To finalize your employment contract you must reply within 12 hours with scanned copies of your national identity card, passport photo, and utility bill.
Send documents to starlight.hiring@hotmail.com.`;
const CRYPTO_5 = `Earn $150 to $300 per day evaluating AI chatbots! No formal degrees needed. Must possess an active Trust Wallet or Binance USDT address.
Candidates must link their wallet and stake 50 USDT as gas guarantee. Join our recruitment channel on Telegram: @quantum_ai_evaluators_desk.`;

// =============== SECTION A: Classification (functional) ===============
const classCases = [
  ['API-01', 'Genuine job offer: campus invitation with anti-scam notice (app\'s own Genuine preset)', GENUINE_TCS, { companyName: 'Tata Consultancy Services (TCS)', senderInfo: 'campus.talent@tcs.com', channel: 'Campus Placement' }, 'Genuine', c => c === 'Genuine'],
  ['API-02', 'Genuine job offer: plain internship ad, no fees, interviews mentioned', GENUINE_PLAIN, {}, 'Genuine', c => c === 'Genuine'],
  ['API-03', 'Fake job offer: Telegram video-task scam with refundable deposit', FRAUD_1, { senderInfo: 'recruiter-apex@gmail.com', channel: 'Telegram' }, 'Fraudulent', c => c === 'Fraudulent'],
  ['API-04', 'Internship scam: laptop courier / registration charge', FRAUD_2, { senderInfo: 'hr.nextgencloud@yahoo.com', channel: 'Email' }, 'Fraudulent', c => c === 'Fraudulent'],
  ['API-05', 'Suspicious offer: rushed deadline + ID document request via free email', SUSP_4, { senderInfo: 'starlight.hiring@hotmail.com' }, 'Suspicious', c => c === 'Suspicious'],
  ['API-06', 'Fake job offer: cryptocurrency staking requirement', CRYPTO_5, { channel: 'Telegram' }, 'Fraudulent', c => c === 'Fraudulent'],
  ['API-07', 'Registration fee scam (short message)', 'Congratulations, you are selected for the internship. Pay a registration fee of Rs 500 today to confirm your seat.', {}, 'Fraudulent', c => c === 'Fraudulent'],
  ['API-08', 'Guaranteed salary / unrealistic offer (plain wording)', 'Guaranteed salary of Rs 90000 per week. No experience, no interview, no targets. Work 30 minutes daily from your phone and earn big.', {}, 'Fraudulent or Suspicious', c => c !== 'Genuine'],
  ['API-09', 'Unrealistic pay with Indian number format (₹50,000 per day)', 'Work from home and earn ₹50,000 per day with simple online tasks. No skills needed, only 1-2 hours work daily. Limited seats, apply now.', {}, 'Fraudulent or Suspicious', c => c !== 'Genuine'],
  ['API-10', 'Internship scam: fake big-company internship + free email + deposit', 'Google Summer Internship 2026 selection letter. Send a refundable security deposit of Rs 1500 to googleintern.hr@gmail.com to receive your joining kit.', {}, 'Fraudulent', c => c === 'Fraudulent'],
  ['API-11', 'Task scam without any fee: like-and-subscribe style job on WhatsApp', 'Earn money by rating products and liking YouTube videos from home. WhatsApp only. Daily payment guaranteed, no interview needed, join today.', { channel: 'WhatsApp' }, 'Fraudulent or Suspicious', c => c !== 'Genuine'],
  ['API-12', 'Single strong red flag: "no interview needed" with free email', 'No interview needed. You are selected as an Office Assistant for our Hyderabad branch. Send your resume to office.jobs@gmail.com to receive the joining date.', {}, 'Fraudulent or Suspicious', c => c !== 'Genuine'],
  ['API-13', 'Genuine ad that contains ordinary words "together" and "method"', 'Our engineers work together to build cloud products. The selection method includes an online test and two technical interviews. Apply on our careers page.', {}, 'Genuine', c => c === 'Genuine'],
  ['API-14', 'Genuine ad mentioning "metadata" with recruiter free-mail in text', 'You will work on metadata pipelines for our analytics team. Interview rounds are conducted on our official portal. Contact recruiter.ops@gmail.com for scheduling queries.', {}, 'Genuine or Suspicious (not an impersonation Fraud call)', c => c !== 'Fraudulent'],
  ['API-15', 'Non-English (Hindi) scam text', 'घर बैठे रोज ₹5000 कमाएं। पंजीकरण शुल्क 500 रुपये जमा करें और तुरंत नौकरी पाएं। टेलीग्राम पर संपर्क करें।', {}, 'Fraudulent or Suspicious', c => c !== 'Genuine'],
];
const classResults = [];
for (const [id, scen, text, meta, expected, ok] of classCases) {
  const r = await call('POST', '/api/analyze', { text, ...meta });
  const cat = r.json?.finalVerdict?.riskCategory;
  classResults.push({ id, cat, score: r.json?.finalVerdict?.riskScore, status: r.status });
  rec(id, 'Functional / Classification', scen, short(text), expected, verdict(r), r.status === 200 && ok(cat), { ms: r.ms, recordId: r.json?.recordId });
  if (id === 'API-02') ctx.genuineId = r.json?.recordId;
  if (id === 'API-03') ctx.fraudId = r.json?.recordId;
}

// =============== SECTION B: Response structure & consistency ===============
{
  const r = await call('POST', '/api/analyze', { text: FRAUD_2, companyName: 'NextGen Cloud', jobTitle: 'Web Intern' });
  const j = r.json || {};
  const fields = ['recordId', 'timestamp', 'finalVerdict', 'heuristicEngine', 'aiModelEngine', 'metadata', 'raw_text'];
  const missing = fields.filter(f => !(f in j));
  const fv = j.finalVerdict || {};
  const okStruct = missing.length === 0 && typeof fv.riskScore === 'number' && fv.riskScore >= 0 && fv.riskScore <= 100 &&
    ['Genuine', 'Suspicious', 'Fraudulent'].includes(fv.riskCategory) && Array.isArray(fv.recommendations) && fv.recommendations.length > 0 &&
    Array.isArray(j.heuristicEngine?.flags) && j.heuristicEngine.flags.every(f => f.evidenceSnippet && f.label && f.severity);
  rec('API-20', 'Functional / Output', 'Response has risk score (0-100), label, explanation (flags with evidence), recommendations', 'Fraud ad with metadata',
    'All fields present; score in 0-100; label valid; every flag has evidence text', `missing=[${missing.join(',')}], score=${fv.riskScore}, label=${fv.riskCategory}, flags=${j.heuristicEngine?.flags?.length}`, okStruct);
  ctx.metaRecord = j.recordId;
}
{
  const bad = classResults.filter(c => c.cat === 'Genuine' && c.score >= 20 || c.cat === 'Fraudulent' && c.score < 70 || c.cat === 'Suspicious' && (c.score < 20 || c.score >= 75));  // bands after the BUG-04 fix: Low <20, Medium 20-74, High >=70
  rec('API-21', 'Functional / Consistency', 'Score matches label for all results above (Genuine low, Suspicious mid, Fraudulent high)', `${classResults.length} results from API-01..15`,
    'No label/score mismatch', bad.length ? `mismatch: ${JSON.stringify(bad)}` : 'No mismatches', bad.length === 0);
}
{
  const a = await call('POST', '/api/analyze', { text: FRAUD_1 });
  const b = await call('POST', '/api/analyze', { text: FRAUD_1 });
  rec('API-22', 'Functional / Consistency', 'Same input twice gives same verdict (deterministic rule engine)', 'FRAUD_1 x2', 'Same label and score', `${verdict(a)} | ${verdict(b)}`,
    a.json?.finalVerdict?.riskScore === b.json?.finalVerdict?.riskScore && a.json?.finalVerdict?.riskCategory === b.json?.finalVerdict?.riskCategory);
}

// =============== SECTION C: Input validation ===============
const valid = [
  ['API-30', 'Empty input validation (empty string)', { text: '' }, 400],
  ['API-31', 'Whitespace-only input', { text: '          \n\n     ' }, 400],
  ['API-32', 'Missing text field', {}, 400],
  ['API-33', 'Text shorter than 20 characters', { text: 'hello job' }, 400],
  ['API-34', 'Invalid type: text is a number', { text: 12345678901234567890 }, 400],
  ['API-35', 'Invalid type: text is an array', { text: ['pay fee', 'earn money now please'] }, 400],
  ['API-36', 'Invalid type: text is an object', { text: { a: 'b' } }, 400],
  ['API-37', 'Invalid type: text is null', { text: null }, 400],
];
for (const [id, scen, body, want] of valid) {
  const r = await call('POST', '/api/analyze', body);
  rec(id, 'Validation', scen, JSON.stringify(body).slice(0, 80), `HTTP ${want} with a readable error message`, `HTTP ${r.status}, error="${short(r.json?.error || r.text, 80)}"`, r.status === want && !!r.json?.error);
}
{
  const r = await call('POST', '/api/analyze', '{"text": "broken json', { raw: true });
  rec('API-38', 'Validation', 'Malformed JSON body', '{"text": "broken json', 'HTTP 400 with a JSON error (no stack trace)', `HTTP ${r.status}, body="${short(r.text, 100)}"`,
    r.status === 400 && !/at\s+\S+\s+\(|node_modules|\.js:\d+/.test(r.text), { note: r.text.includes('node_modules') ? 'stack trace leaked' : '' });
  ctx.malformedBody = r.text;
}
{
  const r = await call('POST', '/api/analyze', 'text=pay registration fee now please', { raw: true, headers: { 'Content-Type': 'text/plain' } });
  rec('API-39', 'Validation', 'Wrong Content-Type (text/plain)', 'text/plain body', 'HTTP 400 JSON error', `HTTP ${r.status}, ${short(r.text, 80)}`, r.status === 400 && !!r.json?.error);
}
{
  const r = await call('POST', '/api/analyze', { text: 'asdkjh qweoiu zxcmnb lkjpoi mnbvcx poiuyt lkjhgf' });
  rec('API-40', 'Validation / Random text', 'Random gibberish text (not a job ad)', 'asdkjh qweoiu zxcmnb ...',
    'No crash; must NOT say "looks like a standard recruitment message": either a clear "not a job offer" message (HTTP 422) or a non-Genuine verdict', `${r.status === 422 ? 'HTTP 422, ' + short(r.json?.error || '', 80) : verdict(r)}`, (r.status === 422 && !!r.json?.error) || (r.status === 200 && r.json?.finalVerdict?.riskCategory !== 'Genuine'));
}
{
  const r = await call('POST', '/api/analyze', { text: 'The quick brown fox jumps over the lazy dog. This is a normal English sentence about animals and nothing else.' });
  rec('API-41', 'Validation / Random text', 'Valid-length normal sentence that is not a job offer', 'fox / dog sentence', 'Should not be reported as a "standard recruitment message": clear "not a job offer" message (HTTP 422) or a non-Genuine verdict', `${r.status === 422 ? 'HTTP 422, ' + short(r.json?.error || '', 80) : verdict(r)}`, (r.status === 422 && !!r.json?.error) || (r.status === 200 && r.json?.finalVerdict?.riskCategory !== 'Genuine'));
}
{
  const text = ('We are hiring a software intern. Apply on the careers page and attend interviews. ').repeat(70);
  const r = await call('POST', '/api/analyze', { text });
  rec('API-42', 'Validation / Long text', 'Long text input (~5,600 characters)', `${text.length} chars`, 'HTTP 200 and a verdict in under 2 s', `${verdict(r)} in ${r.ms} ms`, r.status === 200 && r.ms < 2000, { ms: r.ms });
}
{
  const text = ('We are hiring a software intern. Apply on the careers page and attend interviews. ').repeat(12500);
  const r = await call('POST', '/api/analyze', { text }, { timeout: 60000 });
  rec('API-43', 'Validation / Long text', 'Very long text input (~1 MB)', `${(text.length / 1e6).toFixed(2)} million chars`, 'HTTP 200 (or clear size-limit error) in under 5 s', `${verdict(r)} in ${r.ms} ms`, (r.status === 200 || r.status === 413 || r.status === 400) && r.ms < 5000, { ms: r.ms });
}
{
  const r = await call('POST', '/api/analyze', { text: 'x'.repeat(11 * 1024 * 1024) }, { timeout: 60000 });
  const leaks = /at\s+\S+\s+\(|node_modules|\/home\//.test(r.text);
  rec('API-44', 'Validation / Long text', 'Oversized payload (11 MB, above the 10 MB server limit)', '11 MB body', 'HTTP 413 with a friendly JSON error and no internal paths', `HTTP ${r.status}, body="${short(r.text, 100)}"${leaks ? ' [internal paths / stack trace visible]' : ''}`, r.status === 413 && !leaks && !!r.json?.error);
}
{
  const r = await call('POST', '/api/analyze', { text: '🔥💰 घर बैठे ₹5000 रोज़ कमाएं 💰🔥 అందరికీ ఉద్యోగం! 你好，招聘实习生，请先支付报名费 ✅✅✅', jobTitle: 'दैनिक कार्य' });
  rec('API-45', 'Validation / Invalid input', 'Unicode, emoji, Hindi, Telugu and Chinese characters', 'multi-script text', 'HTTP 200, no crash', verdict(r), r.status === 200);
}
{
  const r = await call('POST', '/api/analyze', { text: GENUINE_PLAIN, companyName: { a: 1 }, jobTitle: 12345, senderInfo: ['x'], channel: true });
  rec('API-46', 'Validation / Invalid input', 'Metadata fields sent with wrong types (object, number, array, boolean)', 'companyName={a:1}, jobTitle=12345 ...', 'HTTP 200 or HTTP 400; no crash, no "[object Object]" saved', `${verdict(r)}; companyName saved as "${r.json?.metadata?.companyName}"`, (r.status === 400) || (r.status === 200 && r.json?.metadata?.companyName !== '[object Object]'));
}

// =============== SECTION D: Security ===============
TOKEN = await register(`tester-${Date.now()}@example.com`);
ctx.token = TOKEN;
{
  const payload = "'; DROP TABLE analysis_records; --";
  const r = await call('POST', '/api/analyze', { text: `Pay registration fee now ${payload} to join the internship`, companyName: payload, jobTitle: `" OR 1=1 --`, senderInfo: payload });
  const h = await call('GET', '/api/history');
  const stillThere = Array.isArray(h.json?.records) && h.json.records.length > 0;
  const search = await call('GET', `/api/history?search=${encodeURIComponent("' OR '1'='1")}`);
  rec('API-50', 'Security / SQL Injection', 'SQL injection strings in text, company, title, sender and in the history search box', "'; DROP TABLE ...; --  and  ' OR '1'='1", 'Table not dropped; history still works; search does not return all rows', `analyze HTTP ${r.status}; history rows=${h.json?.records?.length}; injection-search rows=${search.json?.records?.length}`,
    r.status === 200 && stillThere && search.status === 200 && (search.json?.records?.length === 0));
}
{
  const xss = '<img src=x onerror=alert(1)><script>alert(1)</script>';
  const r = await call('POST', '/api/analyze', { text: `Pay registration fee ${xss} to confirm internship`, companyName: xss, jobTitle: xss });
  ctx.xssId = r.json?.recordId;
  rec('API-51', 'Security / XSS (server side)', 'Script / HTML tags in text and metadata are accepted and stored', xss, 'Server may store text but must return it as JSON data only (render-time escaping is checked in the UI test)', `HTTP ${r.status}; companyName echoed as: "${short(r.json?.metadata?.companyName || '', 60)}"; Content-Type=${r.headers.get('content-type')}`, r.status === 200 && /application\/json/.test(r.headers.get('content-type') || ''));
}
{
  const r = await call('GET', '/api/system-status');
  const xp = r.headers.get('x-powered-by');
  const csp = r.headers.get('content-security-policy');
  const xcto = r.headers.get('x-content-type-options');
  rec('API-52', 'Security / Headers', 'Security response headers (X-Powered-By hidden, CSP, X-Content-Type-Options)', 'GET /api/system-status', 'X-Powered-By absent; X-Content-Type-Options and X-Frame-Options present (CSP is production-only, see PR-04)', `X-Powered-By=${xp}; X-Content-Type-Options=${xcto}; X-Frame-Options=${r.headers.get('x-frame-options')}`, !xp && !!xcto && !!r.headers.get('x-frame-options'));
}
{
  const r = await call('POST', '/api/analyze', { text: FRAUD_2 }, { headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' } });
  const acao = r.headers.get('access-control-allow-origin');
  rec('API-53', 'Security / CORS', 'CORS policy of the Express server for a foreign Origin', 'Origin: https://evil.example', 'Server should not allow arbitrary origins', `Access-Control-Allow-Origin=${acao}`, !acao || acao === 'null' ? true : acao !== '*');
}
{
  // history must be private per user
  const guest = await call('GET', '/api/history', undefined, { noAuth: true });
  const tokenB = await register(`tester-b-${Date.now()}@example.com`, 'Other User');
  const other = await call('GET', '/api/history', undefined, { token: tokenB });
  const leaks = (other.json?.records || []).length;
  const peek = await call('GET', `/api/history/${ctx.fraudId || 'x'}`, undefined, { token: tokenB });
  rec('API-54', 'Security / Access control', 'History is private per user: a guest and a different user must not see anyone else\'s checks', 'guest, and a second user, call /api/history', 'Guest gets HTTP 401; second user sees 0 of the first user\'s records', `guest HTTP ${guest.status}; second user sees ${leaks} record(s); direct read of another user's record by id: HTTP ${peek.status}`, guest.status === 401 && leaks === 0 && peek.status === 404);
}
{
  const r = await call('POST', '/api/analyze', { text: FRAUD_1, jobTitle: '=HYPERLINK("http://evil.example","Click")', companyName: '+cmd|\' /C calc\'!A0' });
  const csv = await call('GET', '/api/export?format=csv');
  const hasFormula = /(^|\n|,)"?[=+\-@]/m.test(csv.text.split('\n').slice(1).map(l => l.split('","')[2] || '').join('\n'));
  const line = csv.text.split('\n').find(l => l.includes('HYPERLINK')) || '';
  rec('API-55', 'Security / CSV injection', 'CSV export neutralises spreadsheet formulas in job title / company', 'jobTitle=\'=HYPERLINK(...)\'', 'Cell values beginning with = + - @ should be prefixed (e.g. with \')', `CSV cell: ${short(line, 100)}`, !/,"=HYPERLINK/.test(line));
}

// =============== SECTION E: History + database (integration) ===============
{
  const a = await call('POST', '/api/analyze', { text: FRAUD_2, jobTitle: 'HistoryProbe-Alpha', companyName: 'ProbeCo' });
  const id = a.json?.recordId;
  ctx.probeId = id;
  const h = await call('GET', '/api/history');
  const found = (h.json?.records || []).find(x => x.id === id);
  rec('API-60', 'Integration / Database', 'A completed check is saved and appears in Past History', 'POST /api/analyze then GET /api/history', 'Record present with same category, score and flags array', found ? `found; category=${found.risk_category}, score=${found.risk_score}, flags=${found.flags?.length}` : 'NOT FOUND', !!found && found.risk_category === a.json.finalVerdict.riskCategory && found.risk_score === a.json.finalVerdict.riskScore && Array.isArray(found.flags));
  const first = h.json?.records?.[0];
  rec('API-61', 'Integration / Database', 'Past History is sorted newest first', 'GET /api/history', 'First record is the most recent check', `first id=${first?.id} (expected ${id})`, first?.id === id);
}
{
  const r = await call('GET', `/api/history/${ctx.probeId}`);
  rec('API-62', 'Integration / Database', 'Open a single saved record by ID', `GET /api/history/${ctx.probeId}`, 'HTTP 200 with the same record', `HTTP ${r.status}, job_title=${r.json?.record?.job_title}`, r.status === 200 && r.json?.record?.job_title === 'HistoryProbe-Alpha');
  const n = await call('GET', '/api/history/does-not-exist-123');
  rec('API-63', 'Integration / Database', 'Open a record that does not exist', 'GET /api/history/does-not-exist-123', 'HTTP 404 with JSON error', `HTTP ${n.status}, ${short(n.text, 80)}`, n.status === 404 && !!n.json?.error);
}
{
  const s = await call('GET', '/api/history?search=HistoryProbe-Alpha');
  const c = await call('GET', '/api/history?category=Fraudulent');
  const c2 = await call('GET', '/api/history?category=Genuine');
  const allFraud = (c.json?.records || []).every(x => x.risk_category === 'Fraudulent');
  const noneFraudInGenuine = (c2.json?.records || []).every(x => x.risk_category === 'Genuine');
  rec('API-64', 'Integration / Database', 'Search and category filter on Past History', 'search=HistoryProbe-Alpha; category=Fraudulent; category=Genuine', 'Search returns the probe record only; filters return only the chosen category', `search rows=${s.json?.records?.length}; fraud-filter rows=${c.json?.records?.length} allFraud=${allFraud}; genuine-filter rows=${c2.json?.records?.length} ok=${noneFraudInGenuine}`, s.json?.records?.length === 1 && allFraud && noneFraudInGenuine);
}
{
  const before = (await call('GET', '/api/stats')).json;
  await call('POST', '/api/analyze', { text: GENUINE_PLAIN });
  const after = (await call('GET', '/api/stats')).json;
  rec('API-65', 'Integration / Database', 'Statistics update after a new check', 'GET /api/stats before and after one check', 'totalScans increases by 1', `before=${before?.totalScans}, after=${after?.totalScans}, counts=${JSON.stringify(after?.categoryCounts)}`, after?.totalScans === before?.totalScans + 1);
}
{
  const id = ctx.probeId;
  const t = await call('PATCH', `/api/history/${id}/star`);
  const g1 = await call('GET', `/api/history/${id}`);
  const t2 = await call('PATCH', `/api/history/${id}/star`);
  const g2 = await call('GET', `/api/history/${id}`);
  rec('API-66', 'Integration / Database', 'Bookmark (star) toggle using the server route /api/history/:id/star', 'PATCH twice', 'Flag flips each time', `after 1st: ${g1.json?.record?.is_starred}, after 2nd: ${g2.json?.record?.is_starred} (started at 1 because Fraudulent is auto-starred)`, g1.json?.record?.is_starred !== g2.json?.record?.is_starred);
  const web = await call('PATCH', `/api/history?id=${id}`);
  rec('API-67', 'Integration / Frontend-Backend', 'Bookmark toggle using the URL the web app actually calls (PATCH /api/history?id=...)', 'PATCH /api/history?id=' + id, 'HTTP 200 (server is in sync with the browser)', `HTTP ${web.status}, ${short(web.text, 70)}`, web.status === 200);
}
{
  const id = `manual-${Date.now()}`;
  const post = await call('POST', '/api/history', { record: { id, job_title: 'ManualInsert', company_name: 'X', risk_category: 'Suspicious', risk_score: 55, summary: 's', raw_text: 'some text here for the record', flags: [], recommendations: ['a'] } });
  const g = await call('GET', `/api/history/${id}`);
  rec('API-68', 'Integration / Database', 'Save a record directly through POST /api/history', 'valid record JSON', 'HTTP 200 and record retrievable', `POST HTTP ${post.status}; GET HTTP ${g.status}, title=${g.json?.record?.job_title}`, post.status === 200 && g.json?.record?.job_title === 'ManualInsert');
  const bad = await call('POST', '/api/history', { record: { job_title: 'no id' } });
  rec('API-69', 'Integration / Database', 'Save a record without an ID', '{record:{job_title}}', 'HTTP 400', `HTTP ${bad.status}`, bad.status === 400);
  ctx.manualId = id;
}
{
  const id = ctx.manualId;
  const dup = await call('POST', '/api/history', { record: { id, job_title: 'UPDATED-TITLE', risk_category: 'Fraudulent', risk_score: 99, raw_text: 'changed text here', summary: 'changed' } });
  const g = await call('GET', `/api/history/${id}`);
  const dupOk = dup.status === 200 ? g.json?.record?.job_title === 'UPDATED-TITLE' : dup.status === 409;
  rec('API-70', 'Integration / Database', 'Save a record with an ID that already exists', 'POST same id with new data', 'Either update the record or reject with 409; never report success while saving nothing', `POST HTTP ${dup.status} success=${dup.json?.success}; stored title is still "${g.json?.record?.job_title}"`, dupOk);
}
{
  const r1 = await call('POST', '/api/history', { record: { id: `bad-${Date.now()}`, risk_category: '<script>x</script>', risk_score: 'abc', raw_text: 'bad record text', summary: 's' } });
  const g = await call('GET', `/api/history/bad-${r1.json?.id?.toString().replace('bad-', '')}`);
  const exists = g.status === 200;
  rec('API-71', 'Validation / Database', 'Save a record with invalid score ("abc") and invalid category', "risk_score='abc', risk_category='<script>'", 'HTTP 400 (invalid data rejected)', `HTTP ${r1.status} success=${r1.json?.success}; record later found: ${exists}`, r1.status === 400);
  ctx.badId = r1.json?.id;
}
{
  const a = await call('POST', '/api/analyze', { text: FRAUD_2, jobTitle: 'DeleteProbe-1' });
  const b = await call('POST', '/api/analyze', { text: FRAUD_2, jobTitle: 'DeleteProbe-2' });
  const d1 = await call('DELETE', `/api/history?id=${a.json.recordId}`);
  const d2 = await call('DELETE', `/api/history/${b.json.recordId}`);
  const g1 = await call('GET', `/api/history/${a.json.recordId}`);
  const g2 = await call('GET', `/api/history/${b.json.recordId}`);
  rec('API-72', 'Integration / Database', 'Delete a record (query form and route form)', 'DELETE /api/history?id=  and  DELETE /api/history/:id', 'Both return 200 and the records are gone', `HTTP ${d1.status}/${d2.status}; lookup after delete: ${g1.status}/${g2.status}`, d1.status === 200 && d2.status === 200 && g1.status === 404 && g2.status === 404);
  const nd = await call('DELETE', '/api/history');
  rec('API-73', 'Validation / Database', 'Delete with no ID', 'DELETE /api/history', 'HTTP 400', `HTTP ${nd.status}`, nd.status === 400);
}
{
  const ex = await call('GET', '/api/export?format=json');
  const csv = await call('GET', '/api/export?format=csv');
  rec('API-74', 'Functional / Export', 'Export history as JSON and CSV', 'GET /api/export?format=json|csv', 'HTTP 200, correct Content-Type, attachment filename', `json: ${ex.status} ${ex.headers.get('content-type')}; csv: ${csv.status} ${csv.headers.get('content-type')}; rows=${csv.text.split('\n').length - 1}`, ex.status === 200 && csv.status === 200 && /text\/csv/.test(csv.headers.get('content-type') || '') && /attachment/.test(csv.headers.get('content-disposition') || ''));
}
{
  const r = await call('GET', '/api/system-status');
  rec('API-75', 'Functional / System status', 'System status endpoint reports engine state', 'GET /api/system-status', 'HTTP 200, status=operational, 8 rule categories, key flag reported', `HTTP ${r.status}, status=${r.json?.status}, rules=${r.json?.nlpEngine?.rulesCount}, keyConfigured=${r.json?.aiModel?.keyConfigured}, mode=${r.json?.aiModel?.mode}`, r.status === 200 && r.json?.status === 'operational' && r.json?.nlpEngine?.categories?.length === 8);
}
{
  const r = await call('GET', '/api/nonexistent-endpoint');
  rec('API-76', 'Error handling', 'Unknown API route', 'GET /api/nonexistent-endpoint', 'HTTP 404 JSON (not the HTML home page)', `HTTP ${r.status}, content-type=${r.headers.get('content-type')}, body starts: ${short(r.text, 40)}`, r.status === 404 && /json/.test(r.headers.get('content-type') || ''));
}

// =============== SECTION F: Performance ===============
{
  const times = [];
  for (let i = 0; i < 30; i++) { const r = await call('POST', '/api/analyze', { text: i % 2 ? FRAUD_1 : GENUINE_PLAIN }); times.push(r.ms); }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const max = Math.max(...times);
  rec('API-80', 'Performance', 'Average response time over 30 sequential checks (rule engine only)', '30 requests', 'Average < 500 ms', `avg=${avg.toFixed(1)} ms, max=${max} ms, min=${Math.min(...times)} ms`, avg < 500, { ms: avg });
}
{
  const t0 = Date.now();
  const rs = await Promise.all(Array.from({ length: 25 }, (_, i) => call('POST', '/api/analyze', { text: FRAUD_2 + ' ' + i })));
  const ok = rs.filter(r => r.status === 200).length;
  rec('API-81', 'Performance / Load', '25 simultaneous checks', '25 parallel requests', 'All return 200', `${ok}/25 returned 200, total ${Date.now() - t0} ms`, ok === 25);
}

fs.writeFileSync('tests/results/api.json', JSON.stringify(results, null, 2));
fs.writeFileSync('tests/results/api_context.json', JSON.stringify(ctx, null, 2));
const p = results.filter(r => r.status === 'PASS').length;
console.log(`\nAPI: ${p}/${results.length} passed`);

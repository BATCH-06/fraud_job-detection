import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3000';
const EV = 'tests/evidence';
fs.mkdirSync(EV, { recursive: true });
const R = [];
const rec = (id, type, scenario, input, expected, actual, pass) => {
  R.push({ id, type, scenario, input, expected, actual, status: pass ? 'PASS' : 'FAIL' });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${scenario}\n      actual: ${actual}`);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const FRAUD = `URGENT HIRING FOR STUDENTS! Work from home for only 1 to 2 hours daily. Direct selection! No interview required.
To activate your account submit a 100% refundable security deposit of Rs 2500 (UPI: apexpay@okhdfcbank).
Contact our HR on Telegram immediately: @apex_recruiter_official.`;
const GENUINE_PLAIN = 'We are hiring a Software Engineer Intern for our Hyderabad office. Apply through the careers page on our official website. Shortlisted candidates will attend an online coding test and two interview rounds.';

const api = async (m, p, b, t) => { const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); let d = null; try { d = await r.json(); } catch {} return { s: r.status, d }; };
const victimReg = await api('POST', '/api/auth?action=register', { name: 'Victim', email: `victim-${Date.now()}@example.com`, password: 'password123' });
await api('POST', '/api/analyze', { text: FRAUD, jobTitle: 'Victim-Private-Check' }, victimReg.d.token);
const serverCountVictim = async () => (await api('GET', '/api/history', null, victimReg.d.token)).d.records.length;
const victimBefore = await serverCountVictim();

const browser = await chromium.launch({ headless: true });
const newCtx = async (opts = {}) => browser.newContext({ viewport: { width: 1366, height: 900 }, ...opts });

async function nav(page, label) { await page.locator(`header button:has-text("${label}"), nav button:has-text("${label}")`).first().click(); await sleep(500); }
async function submit(page) { await page.locator('button[type=submit]').first().click(); }
async function waitResult(page) { await page.waitForSelector('text=Check Another Offer', { timeout: 15000 }); await sleep(600); }
const mainText = page => page.locator('main').innerText();
const label = t => (t.match(/(High Risk|Low Risk|Needs Careful Checking|Suspicious)/) || [])[1] || 'none';
const cardCountRaw = page => page.locator('button[title="Delete Record"]').count();
async function cardCount(page) { let last = -1, same = 0; for (let i = 0; i < 30; i++) { const c = await cardCountRaw(page); if (c === last) { same++; if (same >= 3) return c; } else { same = 0; last = c; } await sleep(250); } return last; }

// ======================= Context A: desktop main flow =======================
const ctxA = await newCtx();
const A = await ctxA.newPage();
const consoleErrors = [];
const alerts = [];
A.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
A.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
A.on('dialog', async d => { if (d.type() === 'alert') { alerts.push(d.message()); } await d.accept(); });

// UI-01 page load
const t0 = Date.now();
await ctxA.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
await A.goto(BASE, { waitUntil: 'networkidle' });
const loadMs = Date.now() - t0;
await sleep(800);
await A.screenshot({ path: `${EV}/ui-01-home.png`, fullPage: false });
const title = await A.title();
const navLabels = ['Home', 'Check a Job', 'Past History', 'Threat Intel', 'System Info'];
const navOk = [];
for (const n of navLabels) navOk.push(await A.locator(`header button:has-text("${n}")`).count() > 0);
rec('UI-01', 'UI / Website accessibility', 'Website opens; title and 5 navigation tabs visible', `GET ${BASE}`, 'Page loads, title set, all tabs shown', `loaded in ${loadMs} ms; title="${title}"; tabs present: ${navOk.join('/')}`, navOk.every(Boolean) && title.length > 5);
rec('UI-02', 'UI / Console', 'No JavaScript errors in the browser console on load', 'open home page', '0 console errors', `${consoleErrors.length} error(s)${consoleErrors.length ? ': ' + consoleErrors[0].slice(0, 100) : ''}`, consoleErrors.length === 0);

// UI-09 privacy: what does a brand-new visitor see in Past History?
await nav(A, 'Past History');
await A.screenshot({ path: `${EV}/ui-09-new-visitor-history.png` });
const foreign = await cardCount(A);
const foreignText = foreign ? (await mainText(A)).slice(0, 0) : '';
rec('UI-09', 'UI / Past History / Privacy', 'A brand-new visitor (empty browser storage, never ran a check) opens Past History', 'fresh browser profile', 'Empty history ("No Previous Scans Stored")', `${foreign} record(s) already listed that this visitor never created`, foreign === 0);
await nav(A, 'Home');

// UI-03 submit button states (Home page)
const ta = A.locator('textarea').first();
const btn = A.locator('button[type=submit]').first();
const d0 = await btn.isDisabled();
await ta.fill('too short');
const d1 = await btn.isDisabled();
const sample52 = 'This is a text that is longer than twenty characters.';
await ta.fill(sample52);
const d2 = await btn.isDisabled();
rec('UI-03', 'UI / Validation', 'Submit button enabled only when input is valid (empty / <20 chars / ≥20 chars)', 'empty, "too short", 52-char text', 'disabled, disabled, enabled', `disabled=${d0}, disabled=${d1}, disabled=${d2}`, d0 && d1 && !d2);
const counter = await A.locator('text=/\\d+ chars/').first().innerText().catch(() => 'n/a');
rec('UI-04', 'UI / Functional', 'Character counter updates while typing', `typed ${sample52.length} characters`, `Shows "${sample52.length} chars"`, `shows "${counter}"`, counter.trim().startsWith(String(sample52.length)));
await A.locator('button:has-text("Clear")').first().click();
rec('UI-05', 'UI / Functional', 'Clear button empties the text box', 'click Clear', 'Textarea empty', `value length=${(await ta.inputValue()).length}`, (await ta.inputValue()).length === 0);

// UI-06 submit fraud (Home page) + result
await ta.fill(FRAUD);
const respP = A.waitForResponse(r => r.url().includes('/api/analyze'));
await submit(A);
const resp = await respP; const rj = await resp.json();
await waitResult(A);
const rt = await mainText(A);
await A.screenshot({ path: `${EV}/ui-06-fraud-result.png`, fullPage: true });
const hasFlags = /registration|deposit|Telegram|No Interview|interview/i.test(rt);
rec('UI-06', 'UI / Functional / Submit', 'Submit a fake job offer → result page shows High Risk, score and warning signs', 'Telegram refundable-deposit scam text', 'High Risk label, score, explanation of warning signs', `API=${rj.finalVerdict.riskCategory}/${rj.finalVerdict.riskScore}; page label="${label(rt)}"; warning text shown=${hasFlags}`, label(rt) === 'High Risk' && hasFlags);

// UI-07 genuine preset through the Check a Job page
await A.locator('button:has-text("Check Another Offer")').first().click();
await sleep(500);
await A.locator('button:has-text("Example 3")').first().click();
await sleep(400);
const loaded = (await A.locator('#checkInput').inputValue()).length;
const resp2P = A.waitForResponse(r => r.url().includes('/api/analyze'));
await submit(A);
const resp2 = await resp2P; const rj2 = await resp2.json();
await waitResult(A);
const rt2 = await mainText(A);
await A.screenshot({ path: `${EV}/ui-07-genuine-preset-result.png`, fullPage: true });
rec('UI-07', 'UI / Functional / Genuine detection', 'App\'s own "Genuine" example preset (TCS campus invitation) → should show Low Risk', 'Example 3 preset (loaded ' + loaded + ' chars)', 'Low Risk (green)', `API=${rj2.finalVerdict.riskCategory}/${rj2.finalVerdict.riskScore}; page shows "${label(rt2)}"`, label(rt2) === 'Low Risk');

// third check: plain genuine
await A.locator('button:has-text("Check Another Offer")').first().click();
await sleep(500);
await A.locator('#checkInput').fill(GENUINE_PLAIN);
await submit(A);
await waitResult(A);
const rt3 = await mainText(A);
rec('UI-08', 'UI / Functional / Genuine detection', 'Plain genuine job ad → Low Risk', 'Software Engineer Intern ad, no fees', 'Low Risk', `page shows "${label(rt3)}"`, label(rt3) === 'Low Risk');

// result page buttons
await A.locator('button:has-text("Copy Summary")').first().click();
await sleep(400);
const copied = await A.locator('button:has-text("Copied")').count();
const clip = await A.evaluate(() => navigator.clipboard.readText().catch(() => '')).catch(() => '');
rec('UI-09b', 'UI / Functional', 'Copy Summary button copies the result text', 'click Copy Summary', 'Button shows "Copied" and clipboard has text', `button says Copied=${copied > 0}; clipboard length=${clip.length}`, copied > 0 && clip.length > 20);
await A.locator('button:has-text("Print Security Audit")').first().click();
await sleep(500);
const printVisible = await A.locator('text=Print / Save as PDF').first().isVisible().catch(() => false);
await A.screenshot({ path: `${EV}/ui-10-print-report.png` });
rec('UI-10', 'UI / Functional', 'Print Security Audit opens the printable report', 'click button', 'Report modal with "Print / Save as PDF"', `visible=${printVisible}`, printVisible);
await A.keyboard.press('Escape');
await A.locator('button:has(svg.lucide-x), button:has-text("Close")').first().click({ timeout: 1500 }).catch(() => {});
await sleep(300);

// Past History tests
await nav(A, 'Past History');
await sleep(500);
const total = await cardCount(A);
await A.screenshot({ path: `${EV}/ui-11-history.png`, fullPage: true });
const mine = total - foreign;
rec('UI-11', 'UI / Past History', 'Past History lists the 3 checks just performed', '3 checks done in this browser', `${foreign}+3 records (only the 3 own checks if history is private)`, `${total} cards shown; own checks=${mine}`, mine === 3);

// search + filter
const search = A.locator('input[placeholder*="Search previous scans"]');
await search.fill('Hyderabad');
await sleep(400);
const sCount = await cardCount(A);
await search.fill('zzzzqqqq-no-match');
await sleep(400);
const noMatch = await A.locator('text=No previous scans match').isVisible().catch(() => false);
await search.fill('');
await sleep(300);
rec('UI-12', 'UI / Past History', 'Search box filters records; unmatched search shows "No previous scans match"', 'search "Hyderabad" and "zzzzqqqq-no-match"', '1 match, then empty-state message', `"Hyderabad" → ${sCount} card(s); no-match message visible=${noMatch}`, sCount === 1 && noMatch);
await A.locator('button:text-is("Low Risk")').first().click();
await sleep(400);
const lowCount = await cardCount(A);
await A.locator('button:text-is("High Risk")').first().click();
await sleep(400);
const highCount = await cardCount(A);
await A.locator('button:text-is("All")').first().click();
await sleep(300);
rec('UI-13', 'UI / Past History', 'Risk-level filter buttons (Low Risk / High Risk / All)', 'click Low Risk, High Risk, All', 'Low Risk shows the 2 genuine checks (TCS example and plain ad); High Risk shows the 1 fraud check', `Low Risk → ${lowCount} card(s); High Risk → ${highCount} card(s)`, lowCount === 2 && highCount === 1);

// view result modal
await A.locator('button:has-text("View Result")').first().click();
await sleep(600);
const modalOpen = await A.locator('.fixed.inset-0.z-50').first().isVisible().catch(() => false);
await A.screenshot({ path: `${EV}/ui-14-history-view-result.png` });
await A.getByRole('button', { name: /Close Audit View/ }).click({ timeout: 3000 }).catch(async () => { await A.locator('.fixed.inset-0.z-50 button').first().click({ timeout: 2000 }).catch(() => {}); });
await sleep(400);
rec('UI-14', 'UI / Past History', 'View Result opens the saved result in a window', 'click View Result', 'Modal with the saved verdict', `modal visible=${modalOpen}`, modalOpen);

// bookmark
const bm = A.locator('button[title="Bookmark this record"]').first();
const hadBm = await bm.count();
if (hadBm) { await bm.click(); await sleep(400); }
const bookmarked = await A.locator('button[title="Bookmarked"]').count();
rec('UI-15', 'UI / Past History', 'Bookmark button toggles', 'click Bookmark on a card', 'Card becomes Bookmarked', `un-bookmarked cards found=${hadBm}; bookmarked cards now=${bookmarked}`, hadBm > 0 && bookmarked > 0);

// exports
const dlCsvP = A.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await A.locator('button:has-text("CSV")').first().click();
const dlCsv = await dlCsvP;
let csvInfo = 'no download';
if (dlCsv) { const p = await dlCsv.path(); const txt = fs.readFileSync(p, 'utf8'); csvInfo = `${dlCsv.suggestedFilename()}, ${txt.split('\n').length - 1} data rows, header="${txt.split('\n')[0].slice(0, 60)}"`; }
const dlJsonP = A.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await A.locator('button:has-text("JSON")').first().click();
const dlJson = await dlJsonP;
let jsonInfo = 'no download';
if (dlJson) { const p = await dlJson.path(); const arr = JSON.parse(fs.readFileSync(p, 'utf8')); jsonInfo = `${dlJson.suggestedFilename()}, ${arr.length} records`; }
rec('UI-16', 'UI / Past History / Export', 'Export history as CSV and JSON files', 'click CSV, click JSON', 'Both files download with data', `CSV: ${csvInfo}; JSON: ${jsonInfo}`, !!dlCsv && !!dlJson);

// persistence on reload
const before = await cardCount(A);
await A.reload({ waitUntil: 'networkidle' });
await sleep(800);
await nav(A, 'Past History');
await sleep(500);
const after = await cardCount(A);
const lsLen = await A.evaluate(() => JSON.parse(localStorage.getItem('scam_checker_records_v1') || '[]').length);
rec('UI-17', 'UI / Past History / Persistence', 'History survives a page refresh', 'reload the page', 'Same records after reload', `before=${before}, after=${after}, saved in browser storage=${lsLen}`, before === after && after > 0);

// delete one
const beforeDel = await cardCount(A);
await A.locator('button[title="Delete Record"]').first().click();
await sleep(800);
const afterDel = await cardCount(A);
const serverAfterDel = 'n/a (a guest\'s history is only in the browser)';
rec('UI-18', 'UI / Past History', 'Delete one record (with confirmation)', 'click Delete, accept confirm', 'One fewer card, also removed on server', `cards ${beforeDel} → ${afterDel}; records on server now=${serverAfterDel}`, afterDel === beforeDel - 1);

// stats header shows counts
const histText = await mainText(A);
await A.screenshot({ path: `${EV}/ui-19-history-after-delete.png`, fullPage: true });

// clear all
await A.locator('button:has-text("Clear All")').first().click();
await sleep(900);
const emptyShown = await A.locator('text=No Previous Scans Stored').isVisible().catch(() => false);
rec('UI-20', 'UI / Past History', 'Clear All removes the user\'s history', 'click Clear All, accept confirm', 'Empty-state shown', `empty-state visible=${emptyShown}`, emptyShown);
const victimAfter = await serverCountVictim();
rec('UI-21', 'UI / Security / Data isolation', "Clear All by one visitor must not delete other users' saved data", 'guest clicks Clear All while another user has a saved check on the server', "The other user's check is still there", `other user's server records: ${victimBefore} before, ${victimAfter} after`, victimAfter === victimBefore && victimBefore >= 1);

// other tabs
await nav(A, 'Threat Intel'); await sleep(500);
const tiText = await mainText(A);
await A.screenshot({ path: `${EV}/ui-22-threat-intel.png` });
await nav(A, 'System Info'); await sleep(500);
const siText = await mainText(A);
rec('UI-22', 'UI / Navigation', 'Threat Intel and System Info tabs open with content', 'click both tabs', 'Both show content, no crash', `Threat Intel text length=${tiText.length}; System Info text length=${siText.length}`, tiText.length > 300 && siText.length > 300);

// a11y basics
await nav(A, 'Home');
const lang = await A.evaluate(() => document.documentElement.lang);
const labelInfo = await A.locator('textarea').first().evaluate(el => ({ labels: el.labels?.length || 0, aria: el.getAttribute('aria-label') }));
rec('UI-23', 'UI / Accessibility', 'Basic accessibility: page language and a label for the main text box (Home page)', 'inspect DOM', 'lang attribute set; textarea has label or aria-label', `lang="${lang}"; textarea labels=${labelInfo.labels}, aria-label=${labelInfo.aria}`, !!lang && (labelInfo.labels > 0 || !!labelInfo.aria));

// XSS rendering
await nav(A, 'Check a Job');
await A.locator('button:has-text("Check Another Offer")').first().click({ timeout: 1500 }).catch(() => {});
await sleep(400);
await A.locator('button:has-text("Context Metadata")').first().click();
const xss = '<img src=x onerror=alert(1)><script>alert(2)</script>';
await A.locator('#checkInput').fill(`Pay registration fee now ${xss} to confirm internship`);
await A.locator('input[placeholder*="Apex Media"]').fill(xss);
await A.locator('input[placeholder*="Data Entry"]').fill(xss);
await submit(A);
await waitResult(A);
await sleep(800);
const xssPage = await mainText(A);
await A.screenshot({ path: `${EV}/ui-24-xss-result.png`, fullPage: true });
const injectedImgs = await A.locator('main img[src="x"]').count();
rec('UI-24', 'UI / Security / XSS', 'HTML/script in text and company name is shown as plain text, never executed', xss, 'No alert dialog, no injected <img>, text visible as text', `alerts fired=${alerts.length}; injected <img> elements=${injectedImgs}; literal text visible=${xssPage.includes('<img src=x')}`, alerts.length === 0 && injectedImgs === 0);
await nav(A, 'Past History');
await sleep(500);
const histXss = await A.locator('main img[src="x"]').count();
rec('UI-25', 'UI / Security / XSS', 'Same payload is safe when shown again in Past History', 'open Past History', 'No alert, no injected element', `alerts fired=${alerts.length}; injected <img>=${histXss}`, alerts.length === 0 && histXss === 0);

await ctxA.close();


// ======================= Context E: accounts (student) =======================
const E_EMAIL = `ui-student-${Date.now()}@example.com`;
const ctxE = await newCtx();
const E = await ctxE.newPage();
const eAlerts = [];
E.on('dialog', async d => { eAlerts.push(d.message()); await d.accept(); });
await E.goto(BASE, { waitUntil: 'networkidle' });
await sleep(600);
await E.locator('[data-testid=auth-controls] button:has-text("Register")').first().click();
await E.waitForSelector('[role=dialog]');
await E.screenshot({ path: `${EV}/ui-30-register-modal.png` });
// validation inside the dialog
await E.locator('#auth-name').fill('Test Student');
await E.locator('#auth-email').fill('not-an-email');
await E.locator('#auth-password').fill('password123');
await E.locator('[role=dialog] button[type=submit]').click();
const emailErr = await E.locator('[role=alert]').first().innerText().catch(() => '');
await E.locator('#auth-email').fill(E_EMAIL);
await E.locator('#auth-password').fill('short');
await E.locator('[role=dialog] button[type=submit]').click();
const pwErr = await E.locator('[role=alert]').first().innerText().catch(() => '');
rec('UI-35', 'UI / Accounts / Validation', 'Sign-up form shows clear messages for a bad email and a short password', 'email "not-an-email"; password "short"', 'Two readable error messages, dialog stays open', `email: "${emailErr}"; password: "${pwErr}"`, /valid email/i.test(emailErr) && /8 characters/i.test(pwErr) && await E.locator('[role=dialog]').isVisible());
await E.locator('#auth-password').fill('password123');
await E.locator('[role=dialog] button[type=submit]').click();
await E.waitForSelector('[data-testid=auth-controls] button:has-text("Sign out")', { timeout: 8000 }).catch(() => {});
const signedInText = await E.locator('[data-testid=auth-controls]').innerText();
const avatarTitle = await E.locator('[data-testid=user-avatar]').getAttribute('title').catch(() => '');
rec('UI-30', 'UI / Accounts', 'Register: the dialog closes and the header shows the name and Sign out', 'Test Student / password123', 'Avatar with the user\'s name (on hover), Sign out available, dialog closed', `header: "${signedInText.replace(/\n/g, ' ')}"; avatar title="${avatarTitle}"; dialog open=${await E.locator('[role=dialog]').count() > 0}`, /Test Student/.test(avatarTitle || '') && /Sign out/.test(signedInText) && (await E.locator('[role=dialog]').count()) === 0);

// check while signed in
await E.locator('textarea').first().fill(FRAUD);
await submit(E);
await waitResult(E);
await E.screenshot({ path: `${EV}/ui-31-signed-in-result.png`, fullPage: true });
const tokenE = await E.evaluate(() => localStorage.getItem('scam_checker_token_v1'));
const srv = await api('GET', '/api/history', null, tokenE);
await nav(E, 'Past History'); await sleep(500);
const eCards = await cardCount(E);
rec('UI-31', 'UI / Accounts / History', 'A check made while signed in appears in Past History and is saved to the account on the server', 'one fraud check', '1 card; 1 record on the server for this user', `cards=${eCards}; server records=${srv.d?.records?.length}`, eCards === 1 && srv.d?.records?.length === 1);
const labelTxt = await E.locator('main').innerText();
rec('UI-31b', 'UI / Accounts / History', 'History badge says it is saved to the account', 'open Past History', '"Your Account + This Browser"', /Your Account \+ This Browser/.test(labelTxt) ? 'badge shown' : 'badge missing', /Your Account \+ This Browser/.test(labelTxt));

// session survives a reload
await E.reload({ waitUntil: 'networkidle' }); await sleep(900);
const afterReload = await E.locator('[data-testid=auth-controls]').innerText();
await nav(E, 'Past History'); await sleep(500);
rec('UI-32', 'UI / Accounts / Session', 'Signed-in state and history survive a page reload', 'reload', 'Still signed in; still 1 card', `header: "${afterReload.replace(/\n/g, ' ')}"; cards=${await cardCount(E)}`, /Sign out/.test(afterReload) && (await cardCount(E)) === 1);

// sign out: guest sees nothing of the account's history
await E.locator('[data-testid=auth-controls] button:has-text("Sign out")').click(); await sleep(700);
await nav(E, 'Past History'); await sleep(500);
const guestCards = await cardCount(E);
const ctl = await E.locator('[data-testid=auth-controls]').innerText();
rec('UI-33', 'UI / Accounts / Privacy', "After Sign out, the account's history is no longer shown in the browser", 'click Sign out, open Past History', '0 cards; Sign in / Register shown again', `cards=${guestCards}; header="${ctl.replace(/\n/g, ' ')}"`, guestCards === 0 && /Sign in/.test(ctl));

// a second person on the same browser
await E.locator('[data-testid=auth-controls] button:has-text("Register")').first().click();
await E.locator('#auth-name').fill('Second Person'); await E.locator('#auth-email').fill(`ui-second-${Date.now()}@example.com`); await E.locator('#auth-password').fill('password123');
await E.locator('[role=dialog] button[type=submit]').click();
await E.waitForSelector('[data-testid=auth-controls] button:has-text("Sign out")', { timeout: 8000 }).catch(() => {});
await nav(E, 'Past History'); await sleep(600);
const secondCards = await cardCount(E);
await E.locator('[data-testid=auth-controls] button:has-text("Sign out")').click(); await sleep(600);
rec('UI-34', 'UI / Accounts / Privacy', "A second person using the same browser does not see the first person's history", 'register another account in the same browser', '0 cards', `cards=${secondCards}`, secondCards === 0);

// sign back in as the first user
await E.locator('[data-testid=auth-controls] button:has-text("Sign in")').first().click();
await E.locator('#auth-email').fill(E_EMAIL); await E.locator('#auth-password').fill('wrong-password-1');
await E.locator('[role=dialog] button[type=submit]').click();
await E.waitForSelector('[role=alert]', { timeout: 6000 }).catch(() => {});
const wrongMsg = await E.locator('[role=alert]').first().innerText().catch(() => '');
const stillOpen = await E.locator('[role=dialog]').isVisible();
await E.locator('#auth-password').fill('password123');
await E.locator('[role=dialog] button[type=submit]').click();
await E.waitForSelector('[data-testid=auth-controls] button:has-text("Sign out")', { timeout: 8000 }).catch(() => {});
await nav(E, 'Past History'); await sleep(700);
const backCards = await cardCount(E);
rec('UI-36', 'UI / Accounts', 'Wrong password shows an error; the right password signs in and the history is back', 'wrong then right password', 'Error "Incorrect email or password"; then 1 card', `message="${wrongMsg}"; dialog stayed open=${stillOpen}; cards after sign-in=${backCards}`, /Incorrect email or password/i.test(wrongMsg) && stillOpen && backCards === 1);

// not a job offer
await nav(E, 'Home'); await sleep(400);
await E.locator('textarea').first().fill('The quick brown fox jumps over the lazy dog near the river bank.');
await submit(E); await sleep(1500);
const notJobMsg = await E.locator('main').innerText();
const stillOnForm = await E.locator('text=Check Another Offer').count() === 0;
await E.screenshot({ path: `${EV}/ui-38-not-a-job.png` });
rec('UI-38', 'UI / Validation', 'Text that is not a job offer shows a clear message and no result', 'fox sentence', 'Message "does not look like a job or internship offer"; no result page', `message shown=${/does not look like a job/i.test(notJobMsg)}; stayed on form=${stillOnForm}`, /does not look like a job/i.test(notJobMsg) && stillOnForm);

// company verification + salary / website fields
await nav(E, 'Check a Job'); await sleep(500);
await E.locator('button:has-text("Context Metadata")').first().click().catch(() => {});
const hasSalary = await E.locator('#salaryInput').count(), hasSite = await E.locator('#websiteInput').count();
await E.locator('#checkInput').fill('Infosys is hiring freshers for software roles. Interview in 3 rounds. Send your resume to hr@infosys-careers.com to register.');
await E.locator('input[placeholder*="Apex Media"]').fill('Infosys');
await E.locator('#salaryInput').fill('Rs 4,00,000 per year');
await E.locator('#websiteInput').fill('www.infosys-careers.com');
const analyzeReq = E.waitForResponse(r => r.url().includes('/api/analyze'));
await submit(E);
const ar = await analyzeReq; const aj = await ar.json();
await waitResult(E);
await sleep(500);
const verdictText = await E.locator('[data-testid=company-verdict]').innerText().catch(() => 'missing');
const cardText = await E.locator('[data-testid=company-verification]').innerText().catch(() => '');
await E.screenshot({ path: `${EV}/ui-37-company-verification.png`, fullPage: true });
rec('UI-37', 'UI / Company verification', 'Salary and Website fields exist; a look-alike company domain shows a Suspicious company verdict with the reasons', 'Infosys + hr@infosys-careers.com + www.infosys-careers.com', 'Fields present; card shows "Suspicious Company Details"; overall High Risk; salary and website sent to the server', `fields: salary=${hasSalary}, website=${hasSite}; verdict="${verdictText}"; overall=${aj.finalVerdict.riskCategory}; sent salary="${aj.metadata?.salary}" website="${aj.metadata?.website}"; reason shown=${/look|copy/i.test(cardText)}`, hasSalary === 1 && hasSite === 1 && /Suspicious Company/i.test(verdictText) && aj.finalVerdict.riskCategory === 'Fraudulent' && aj.metadata?.salary === 'Rs 4,00,000 per year' && /look|copy/i.test(cardText));
const adminTabForStudent = await E.locator('header button:has-text("Admin")').count();
rec('UI-39a', 'UI / Admin / Access', 'A student does not see the Admin tab', 'signed in as student', 'No Admin tab', `Admin tabs visible=${adminTabForStudent}`, adminTabForStudent === 0);
await ctxE.close();

// ======================= Context F: administrator =======================
const ctxF = await newCtx({ acceptDownloads: true });
const F = await ctxF.newPage();
F.on('dialog', async d => { await d.accept(); });
await F.goto(BASE, { waitUntil: 'networkidle' }); await sleep(600);
await F.locator('[data-testid=auth-controls] button:has-text("Sign in")').first().click();
await F.locator('#auth-email').fill(process.env.ADMIN_EMAIL || 'admin@test.local'); await F.locator('#auth-password').fill(process.env.ADMIN_PASSWORD || 'AdminPass123');
await F.locator('[role=dialog] button[type=submit]').click();
await F.waitForSelector('header button:has-text("Admin")', { timeout: 8000 }).catch(() => {});
const adminTab = await F.locator('header button:has-text("Admin")').count();
rec('UI-39', 'UI / Admin / Access', 'Administrator sees the Admin tab after signing in', 'sign in as admin', 'Admin tab visible, ADMIN badge shown', `Admin tab=${adminTab}; header="${(await F.locator('[data-testid=auth-controls]').innerText()).replace(/\n/g, ' ')}"`, adminTab >= 1);
await F.locator('header button:has-text("Admin")').first().click(); await sleep(800);
const ovTotal = await F.locator('[data-testid=ov-total]').innerText().catch(() => 'missing');
const ovUsers = await F.locator('[data-testid=ov-users]').innerText().catch(() => 'missing');
await F.screenshot({ path: `${EV}/ui-40-admin-overview.png` });
rec('UI-40', 'UI / Admin / Overview', 'Admin overview shows totals', 'open Admin', 'Total checks and users are numbers > 0', `checks=${ovTotal}; users=${ovUsers}`, Number(ovTotal) > 0 && Number(ovUsers) > 0);
await F.locator('[role=tab]:has-text("Monitor Results")').click(); await sleep(900);
const resultRows = await F.locator('[data-testid=results-table] tbody tr').count();
const ownerEmails = await F.locator('[data-testid=results-table]').innerText();
await F.screenshot({ path: `${EV}/ui-41-admin-results.png`, fullPage: true });
rec('UI-41', 'UI / Admin / Monitor results', "Monitor Results lists everyone's checks (guests and users) with the owner", 'open Monitor Results', 'Rows listed; "Guest" and an e-mail owner both appear', `rows=${resultRows}; guest shown=${/Guest/.test(ownerEmails)}; user email shown=${/@example\.com/.test(ownerEmails)}`, resultRows >= 3 && /Guest/.test(ownerEmails) && /@example\.com/.test(ownerEmails));
await F.locator('[role=tab]:has-text("Manage Users")').click(); await sleep(800);
const usersText = await F.locator('[data-testid=users-table]').innerText();
const selfDisabled = await F.locator('[data-testid=users-table] tr:has-text("(you)") button:has-text("Delete")').isDisabled().catch(() => false);
await F.screenshot({ path: `${EV}/ui-42-admin-users.png`, fullPage: true });
rec('UI-42', 'UI / Admin / Manage users', "Manage Users lists accounts; the admin's own row cannot be deleted", 'open Manage Users', 'Students listed; own Delete button disabled', `student listed=${/Test Student|Victim/.test(usersText)}; own delete disabled=${selfDisabled}`, /Test Student|Victim/.test(usersText) && selfDisabled);
await F.locator('[role=tab]:has-text("Manage Dataset")').click(); await sleep(700);
await F.locator('#ds-text').fill('Urgent hiring! Pay a registration fee of Rs 300 to confirm your seat. Contact on Telegram only.');
await F.locator('#ds-label').selectOption('Fraudulent');
await F.getByRole('button', { name: 'Add', exact: true }).click(); await sleep(800);
await F.locator('#ds-text').fill('We are hiring a software intern. Apply on the careers page. Interviews: coding test and HR round.');
await F.locator('#ds-label').selectOption('Genuine');
await F.getByRole('button', { name: 'Add', exact: true }).click(); await sleep(800);
const dsRows = await F.locator('[data-testid=dataset-table] tbody tr').count();
await F.getByRole('button', { name: /Test the detection rules/ }).click(); await sleep(1200);
const evalText = await F.locator('[data-testid=evaluation]').innerText().catch(() => 'missing');
await F.screenshot({ path: `${EV}/ui-43-admin-dataset.png`, fullPage: true });
const dl = F.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await F.getByRole('button', { name: 'CSV' }).click();
const dlf = await dl;
let csvOk = false; if (dlf) { const txt = fs.readFileSync(await dlf.path(), 'utf8'); csvOk = txt.includes('Fraudulent') && txt.startsWith('"id"'); }
rec('UI-43', 'UI / Admin / Manage dataset', 'Add labelled examples, run the evaluation, export CSV', 'add 2 examples; evaluate; CSV', '2+ rows; "Correct: x of y"; CSV file with the data', `rows=${dsRows}; evaluation="${evalText.replace(/\n/g, ' ').slice(0, 90)}"; csv ok=${csvOk}`, dsRows >= 2 && /Correct:\s*\d+\s*of\s*\d+/.test(evalText) && csvOk);
await ctxF.close();

// ======================= Context B: slow server / double-click =======================
const ctxB = await newCtx();
const B = await ctxB.newPage();
let analyzeCalls = 0;
await B.route('**/api/analyze', async route => { analyzeCalls++; await sleep(1800); await route.continue(); });
await B.goto(BASE, { waitUntil: 'networkidle' });
await B.locator('textarea').first().fill(FRAUD);
await B.locator('button[type=submit]').first().click();
await sleep(400);
const loadingTxt = await B.locator('button[type=submit]').first().innerText();
const disabledDuring = await B.locator('button[type=submit]').first().isDisabled();
await B.locator('button[type=submit]').first().click({ force: true, timeout: 1000 }).catch(() => {});
await B.screenshot({ path: `${EV}/ui-26-loading-state.png` });
await waitResult(B);
rec('UI-26', 'UI / Functional', 'Loading indicator shown and double-click does not send two requests', 'click submit twice during a slow (1.8 s) response', 'Spinner text, button disabled, exactly 1 request', `button text="${loadingTxt.trim().replace(/\n/g, ' ')}"; disabled=${disabledDuring}; analyze requests=${analyzeCalls}`, /Analy|Running|Scan|Loading/i.test(loadingTxt) && disabledDuring && analyzeCalls === 1);
await ctxB.close();

// ======================= Context C: backend unreachable =======================
const ctxC = await newCtx();
const C = await ctxC.newPage();
await C.route('**/api/**', r => r.abort());
await C.goto(BASE, { waitUntil: 'domcontentloaded' });
await sleep(800);
await C.locator('textarea').first().fill(FRAUD);
await C.locator('button[type=submit]').first().click();
let fallbackOk = true;
try { await waitResult(C); } catch { fallbackOk = false; }
const ctext = fallbackOk ? await mainText(C) : '';
await C.screenshot({ path: `${EV}/ui-27-backend-down-fallback.png`, fullPage: true });
await nav(C, 'Past History'); await sleep(500);
const cCards = await cardCount(C);
rec('UI-27', 'UI / Error handling', 'Backend completely unreachable → built-in rule checker still gives a result and saves it', 'all /api calls blocked', 'Result shown (High Risk) and stored in Past History', `result shown=${fallbackOk}; label="${label(ctext)}"; history cards=${cCards}`, fallbackOk && label(ctext) === 'High Risk' && cCards === 1);
await ctxC.close();

// ======================= Context D: mobile =======================
const ctxD = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const D = await ctxD.newPage();
await D.goto(BASE, { waitUntil: 'networkidle' });
await sleep(800);
await D.screenshot({ path: `${EV}/ui-28-mobile-home.png` });
const overflow = await D.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
await D.locator('textarea').first().fill(FRAUD);
await D.locator('button[type=submit]').first().click();
let mobOk = true;
try { await waitResult(D); } catch { mobOk = false; }
await sleep(500);
await D.screenshot({ path: `${EV}/ui-29-mobile-result.png` });
const overflow2 = await D.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
rec('UI-28', 'UI / Responsive', 'Mobile screen (375×812): no sideways scrolling; check works', 'phone viewport', 'No horizontal overflow; result displayed', `home scrollWidth=${overflow.sw}/${overflow.iw}; result scrollWidth=${overflow2.sw}/${overflow2.iw}; result shown=${mobOk}`, overflow.sw <= overflow.iw + 1 && overflow2.sw <= overflow2.iw + 1 && mobOk);
await ctxD.close();

await browser.close();
fs.writeFileSync('tests/results/ui.json', JSON.stringify(R, null, 2));
console.log(`\nUI: ${R.filter(r => r.status === 'PASS').length}/${R.length} passed`);

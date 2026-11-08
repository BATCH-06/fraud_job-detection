import { runHeuristicNLPAnalysis } from '../server/nlpRules.js';
import { verifyCompanyOffline } from '../server/companyChecks.js';
import { addOnlineChecks, lookupDomain } from '../server/companyLookup.js';
import { cleanText, looksLikeJobPosting, extractEntities, tokenizeText, extractFeatures } from '../server/preprocess.js';
import { evaluateDataset } from '../server/api.js';
import fs from 'fs';

type R = { id: string; scenario: string; input: string; expected: string; actual: string; status: 'PASS' | 'FAIL' };
const results: R[] = [];
const short = (s: string) => (s.length > 130 ? s.slice(0, 127).replace(/\n/g, ' ') + '...' : s.replace(/\n/g, ' '));
function rec(id: string, scenario: string, input: string, expected: string, actual: string, pass: boolean) {
  results.push({ id, scenario, input: short(input), expected, actual, status: pass ? 'PASS' : 'FAIL' });
}
const sum = (r: ReturnType<typeof runHeuristicNLPAnalysis>) => `${r.riskCategory}/${r.heuristicScore} flags=[${r.flags.map(f => f.id).join(' | ') || 'none'}]`;
function eng(id: string, scenario: string, text: string, expected: string, check: (r: ReturnType<typeof runHeuristicNLPAnalysis>) => boolean, meta?: any) {
  const r = runHeuristicNLPAnalysis(text, meta);
  rec(id, scenario, text, expected, sum(r), check(r));
}

// ========== A. Attempts to hide a real scam (must still be detected) ==========
eng('UN-01', 'Scam says "no experience needed" right before the fee demand', 'No experience needed. Pay a registration fee of Rs 500 today to confirm your internship.', 'Fraudulent (fee flag)', r => r.riskCategory === 'Fraudulent');
eng('UN-02', '"No interview, no experience, just pay" must not cancel the fee flag', 'Work from home job. No interview, no experience, just pay a registration fee of 999 rupees now.', 'Fee flag present', r => r.flags.some(f => f.category === 'FEE_DEMAND'));
eng('UN-03', 'Fake disclaimer followed by "but" and a real demand', 'We never ask for fees elsewhere, but for this internship you must pay a registration fee of Rs 1000.', 'Fee flag present', r => r.flags.some(f => f.category === 'FEE_DEMAND'));
eng('UN-04', 'Fake disclaimer in one sentence, demand in the next', 'We do not charge any fee from candidates. Pay a security deposit of Rs 2000 to receive your laptop.', 'Deposit flag present (new sentence)', r => r.flags.some(f => f.category === 'FEE_DEMAND'));
eng('UN-05', 'Zero-width characters hidden inside "registration"', 'Pay the regi\u200Bstra\u200Btion fee of Rs 500 to confirm your internship seat.', 'Fee flag present', r => r.flags.some(f => f.category === 'FEE_DEMAND'));
eng('UN-06', 'Look-alike Cyrillic letters in "Google" with a Gmail contact', 'Gооgle is hiring interns. Send your resume to hr.team@gmail.com for the interview.', 'Impersonation flag (CRITICAL)', r => r.flags.some(f => f.id.startsWith('impersonation')));
eng('UN-07', 'Hindi registration-fee demand', 'इंटर्नशिप के लिए पंजीकरण शुल्क 500 रुपये जमा करें और तुरंत नौकरी पाएं।', 'Fee flag present', r => r.flags.some(f => f.category === 'FEE_DEMAND'));
eng('UN-08', 'Telugu registration-fee demand', 'ఉద్యోగం కోసం రిజిస్ట్రేషన్ ఫీజు 500 రూపాయలు చెల్లించండి.', 'Fee flag present', r => r.flags.some(f => f.category === 'FEE_DEMAND'));
eng('UN-09', 'Pay ₹1,50,000 per week (lakh format)', 'Earn ₹1,50,000 per week from home. Apply now for this job.', 'Unrealistic-pay flag', r => r.flags.some(f => f.id === 'comp-0'));
eng('UN-10', 'Pay "60000 rupees weekly" (number before currency word)', 'Earn 60000 rupees weekly doing simple online video reviews. Job open for all.', 'Unrealistic-pay flag', r => r.flags.some(f => f.category === 'COMPENSATION_ANOMALY'));
eng('UN-11', 'Crypto stake demand', 'You must stake 50 USDT in your wallet as a guarantee before starting this job.', 'Crypto payment flag (CRITICAL)', r => r.flags.some(f => f.id === 'pay-chan-0'));

// ========== B. Genuine wording that must NOT be flagged ==========
eng('UN-20', 'Blockchain company mentions Ethereum / Bitcoin as skills', 'We are hiring a Solidity intern. Knowledge of Ethereum and Bitcoin is a plus. Apply on our careers page; two interview rounds.', 'No crypto-payment flag', r => !r.flags.some(f => f.category === 'SUSPICIOUS_PAYMENT_METHODS'));
eng('UN-21', '"Data entry operator" job ad', 'Hiring a data entry operator for our Hyderabad office. Apply with your resume. Interview on Monday.', 'Genuine', r => r.riskCategory === 'Genuine');
eng('UN-22', 'Low realistic stipend per day', 'Internship stipend of ₹500 per day for selected candidates. Apply on our careers page; interviews next week.', 'No unrealistic-pay flag', r => !r.flags.some(f => f.id === 'comp-0'));
eng('UN-23', 'Normal monthly salary with commas', 'Software engineer role, salary Rs 25,000 per month plus benefits. Interview rounds: coding test and HR.', 'Genuine', r => r.riskCategory === 'Genuine');
eng('UN-24', '"Fees" in a safe sentence: "no registration fee required"', 'Apply for this internship. No registration fee is required at any stage. Selection is by test and interview.', 'Genuine', r => r.riskCategory === 'Genuine');
eng('UN-25', '"Never share your OTP" safety advice', 'Never share your OTP or password with anyone. Our HR will interview you on the official portal.', 'No data-harvesting flag', r => !r.flags.some(f => f.category === 'SENSITIVE_DATA_HARVESTING'));
eng('UN-26', '"We do not hire without an interview"', 'We do not hire without an interview. Candidates attend a coding test and two interview rounds on campus.', 'Genuine', r => r.riskCategory === 'Genuine');
eng('UN-27', 'Company will pay for the course (not the student)', 'The company will sponsor your training. Apply on our careers page and attend the interview.', 'Genuine', r => r.riskCategory === 'Genuine');
eng('UN-28', 'Guaranteed stipend (mild wording)', 'Selected interns get a guaranteed stipend of Rs 15,000 per month. Apply with your resume; interview next week.', 'Not Fraudulent', r => r.riskCategory !== 'Fraudulent');

// ========== C. Scoring bands ==========
eng('UN-30', 'A single HIGH sign is now Suspicious (not Genuine)', 'Join our team as an office assistant. Contact only on Telegram @office_jobs_desk for the interview.', 'Suspicious', r => r.riskCategory === 'Suspicious');
eng('UN-31', 'Score is always 0-100 and Genuine is below 20', 'We are hiring a Software Engineer Intern. Apply on the careers page and attend two interview rounds.', 'Genuine, score < 20', r => r.riskCategory === 'Genuine' && r.heuristicScore < 20);

// ========== D. Preprocessing ==========
rec('UN-40', 'cleanText removes hidden characters and tidies spaces', 'a\u200Bb   c\n\n\n\nd', '"ab c\\n\\nd"', JSON.stringify(cleanText('a\u200Bb   c\n\n\n\nd')), cleanText('a\u200Bb   c\n\n\n\nd') === 'ab c\n\nd');
rec('UN-41', 'tokenizeText splits into lower-case words (also Hindi)', 'Pay NOW नौकरी', '["pay","now","नौकरी"]', JSON.stringify(tokenizeText('Pay NOW नौकरी')), JSON.stringify(tokenizeText('Pay NOW नौकरी')) === JSON.stringify(['pay', 'now', 'नौकरी']));
{ const f = extractFeatures('HELLO WORLD!!! ok'); rec('UN-42', 'extractFeatures counts words, caps ratio and exclamations', 'HELLO WORLD!!! ok', 'words=3, exclamations=3, caps ratio > 0.8', JSON.stringify({ w: f.wordCount, e: f.exclamationCount, c: +f.upperCaseRatio.toFixed(2) }), f.wordCount === 3 && f.exclamationCount === 3 && f.upperCaseRatio > 0.8); }
rec('UN-43', 'looksLikeJobPosting: job text yes, fox sentence no, gibberish no', 'three texts', 'true, false, false', JSON.stringify([looksLikeJobPosting('We are hiring interns, apply now').isJobLike, looksLikeJobPosting('The quick brown fox jumps over the lazy dog.').isJobLike, looksLikeJobPosting('asdkjh qweoiu zxcmnb').isJobLike]),
  looksLikeJobPosting('We are hiring interns, apply now').isJobLike && !looksLikeJobPosting('The quick brown fox jumps over the lazy dog.').isJobLike && !looksLikeJobPosting('asdkjh qweoiu zxcmnb').isJobLike);
{ const long = 'a'.repeat(10000); const t0 = Date.now(); extractEntities(long); runHeuristicNLPAnalysis('Apply now. ' + long); const ms = Date.now() - t0; rec('UN-44', 'Engine speed on 10,000 characters with no spaces (old version: ~0.4 s and growing fast)', '10,000 x "a"', 'under 150 ms', `${ms} ms`, ms < 150); }

{ const d = '1'.repeat(10000); const t0 = Date.now(); runHeuristicNLPAnalysis('Apply now. ' + d); const ms = Date.now() - t0; rec('UN-45', 'Engine speed on 10,000 digits with no spaces (old version: ~0.5 s and growing fast)', '10,000 x "1"', 'under 150 ms', `${ms} ms`, ms < 150); }

// ========== E. Company verification (offline) ==========
const V = (input: any) => verifyCompanyOffline(input);
const vs = (v: ReturnType<typeof V>) => `${v.verdict}; flags=[${v.flags.map(f => f.severity + ':' + f.id).join(' | ') || 'none'}]`;
{ const v = V({ text: 'TCS campus drive. Contact hr@tcs.com or visit https://nextstep.tcs.com', companyName: 'Tata Consultancy Services' }); rec('CV-01', 'Official company e-mail and website', 'hr@tcs.com + nextstep.tcs.com', 'Verified, no flags', vs(v), v.verdict === 'Verified' && v.flags.length === 0); }
{ const v = V({ text: 'Infosys is hiring freshers. Send your resume to hr@infosys-careers.com' }); rec('CV-02', 'Look-alike of a real company domain (infosys-careers.com)', 'hr@infosys-careers.com', 'Suspicious + CRITICAL look-alike flag', vs(v), v.verdict === 'Suspicious' && v.flags.some(f => f.severity === 'CRITICAL')); }
{ const v = V({ text: 'Google internship program. Mail your CV to recruit@g00gle.com' }); rec('CV-03', 'Number-for-letter look-alike (g00gle.com)', 'recruit@g00gle.com', 'CRITICAL look-alike flag', vs(v), v.flags.some(f => f.severity === 'CRITICAL')); }
{ const v = V({ text: 'Microsoft is hiring. Apply at careers@microsooft.com' }); rec('CV-04', 'Typing-error look-alike (microsooft.com)', 'careers@microsooft.com', 'CRITICAL look-alike flag', vs(v), v.flags.some(f => f.severity === 'CRITICAL')); }
{ const v = V({ text: 'Google is hiring interns. Contact randomstaffing@jobsolutions.com' }); rec('CV-05', 'Known company claimed but unrelated contact domain', 'randomstaffing@jobsolutions.com', 'Unverified + MEDIUM mismatch flag (not CRITICAL)', vs(v), v.verdict === 'Unverified' && v.flags.some(f => f.severity === 'MEDIUM') && !v.flags.some(f => f.severity === 'CRITICAL')); }
{ const v = V({ text: 'Apply here: http://192.168.4.10/apply now' }); rec('CV-06', 'Link to a raw IP address (and not https)', 'http://192.168.4.10/apply', 'Suspicious + HIGH IP flag', vs(v), v.verdict === 'Suspicious' && v.flags.some(f => f.severity === 'HIGH')); }
{ const v = V({ text: 'Register using https://bit.ly/3abcXYZ today' }); rec('CV-07', 'Shortened link hides the destination', 'https://bit.ly/3abcXYZ', 'MEDIUM shortened-link flag', vs(v), v.flags.some(f => f.id.startsWith('company-short') && f.severity === 'MEDIUM')); }
{ const v = V({ text: 'Apply through https://forms.gle/abc123 for the role' }); rec('CV-08', 'Application through a free form page', 'https://forms.gle/abc123', 'LOW generic-page flag', vs(v), v.flags.some(f => f.id.startsWith('company-generic') && f.severity === 'LOW')); }
{ const v = V({ text: 'Join us. Details at https://hiring-portal.xyz/jobs' }); rec('CV-09', 'Website with a risky ending (.xyz)', 'hiring-portal.xyz', 'MEDIUM risky-ending flag', vs(v), v.flags.some(f => f.id.startsWith('company-webtld'))); }
{ const v = V({ text: 'Offer details at http://example-jobs.com/offer' }); rec('CV-10', 'Plain http link', 'http://example-jobs.com', 'LOW not-secure flag', vs(v), v.flags.some(f => f.id.startsWith('company-http') && f.severity === 'LOW')); }
{ const v = V({ text: 'Visit https://xn--googl-fsa.com for the form' }); rec('CV-11', 'Disguised (punycode) domain', 'xn--googl-fsa.com', 'HIGH disguised-letters flag', vs(v), v.flags.some(f => f.id.startsWith('company-idn'))); }
{ const v = V({ text: 'We are hiring. Apply on our site.', companyName: 'Apex Media Pvt Ltd', website: 'www.freejobs-today.com' }); rec('CV-12', 'Website name does not match the company name given', 'Apex Media vs freejobs-today.com', 'MEDIUM name-mismatch flag', vs(v), v.flags.some(f => f.id.startsWith('company-namemismatch'))); }
{ const v = V({ text: 'We are hiring. Apply on our site.', companyName: 'Apex Media Pvt Ltd', website: 'www.apexmedia.com' }); rec('CV-13', 'Website name matches the company name', 'Apex Media vs apexmedia.com', 'No mismatch flag; website check passes', vs(v), v.flags.length === 0 && v.checks.some(c => c.status === 'pass' && c.area === 'Website')); }
{ const v = V({ text: 'We are hiring a clerk, please apply with your resume.' }); rec('CV-14', 'No company, e-mail or website given', 'plain text', 'Not enough details, no flags', vs(v), v.verdict === 'Not enough details' && v.flags.length === 0); }
{ const v = V({ text: 'Hiring. Mail resume to hr@pinnacle-systems.com', companyName: 'Pinnacle Systems' }); rec('CV-15', 'Small unknown company with its own domain: no false alarm', 'hr@pinnacle-systems.com', 'No flags (Unverified, not Suspicious)', vs(v), v.verdict === 'Unverified' && v.flags.length === 0); }
{ const v = V({ text: 'We are hiring pineapple farm workers. Contact hr@pineapple-farms.com' }); rec('CV-16', 'Ordinary word containing "apple" is not a look-alike', 'hr@pineapple-farms.com', 'No look-alike flag', vs(v), !v.flags.some(f => f.severity === 'CRITICAL')); }
{ const v = V({ text: 'Our client Meta is hiring. Contact metadata-labs@datalabs.in' }); rec('CV-17', '"metadata" in a domain is not a Meta look-alike', 'metadata-labs / datalabs.in', 'No CRITICAL flag', vs(v), !v.flags.some(f => f.severity === 'CRITICAL')); }

// ========== F. Live checks (injected results) ==========
const base = V({ text: 'Offer details at https://new-hire-portal.com/jobs' });
const fake = (resolves: boolean | null, ageDays: number | null) => async (d: string) => ({ domain: d, resolves, ageDays });
{ const v = await addOnlineChecks(base, fake(false, null), true); rec('CV-20', 'Live check: domain does not exist', 'lookup says NXDOMAIN', 'Suspicious + HIGH flag', `${v.verdict}; ${v.flags.map(f => f.id).join(',')}`, v.verdict === 'Suspicious' && v.flags.some(f => f.id.startsWith('company-nxdomain'))); }
{ const v = await addOnlineChecks(base, fake(true, 12), true); rec('CV-21', 'Live check: domain registered 12 days ago', 'age 12 days', 'Suspicious + HIGH new-domain flag', `${v.verdict}; ${v.flags.map(f => f.severity + ':' + f.id).join(',')}`, v.verdict === 'Suspicious' && v.flags.some(f => f.id.startsWith('company-newdomain') && f.severity === 'HIGH')); }
{ const v = await addOnlineChecks(base, fake(true, 100), true); rec('CV-22', 'Live check: domain 100 days old', 'age 100 days', 'MEDIUM flag, not Suspicious', `${v.verdict}; ${v.flags.map(f => f.severity + ':' + f.id).join(',')}`, v.flags.some(f => f.severity === 'MEDIUM' && f.id.startsWith('company-younger')) && v.verdict !== 'Suspicious'); }
{ const v = await addOnlineChecks(base, fake(true, 2500), true); rec('CV-23', 'Live check: domain 6+ years old', 'age 2500 days', 'Passes, no new flags', `${v.verdict}; flags=${v.flags.length}; onlineChecks=${v.onlineChecks}`, v.flags.length === 0 && v.checks.some(c => c.id.startsWith('live-age') && c.status === 'pass') && v.onlineChecks === 'completed'); }
{ const v = await addOnlineChecks(base, async () => { throw new Error('network down'); }, true); rec('CV-24', 'Live lookup fails: company is NOT penalised', 'lookup throws', 'No new flags; onlineChecks=unavailable', `flags=${v.flags.length}; onlineChecks=${v.onlineChecks}`, v.flags.length === 0 && v.onlineChecks === 'unavailable'); }
{ const v = await addOnlineChecks(base, fake(null, null), true); rec('CV-25', 'Live lookup returns nothing: company is NOT penalised', 'unknown / unknown', 'No new flags', `flags=${v.flags.length}; onlineChecks=${v.onlineChecks}`, v.flags.length === 0 && v.onlineChecks === 'unavailable'); }
{ let called = 0; const official = V({ text: 'Mail hr@tcs.com or gmail user@gmail.com', companyName: 'TCS' }); await addOnlineChecks(official, async d => { called++; return { domain: d, resolves: true, ageDays: 1 }; }, true); rec('CV-26', 'Official and free-mail domains are never looked up', 'hr@tcs.com, user@gmail.com', 'lookup called 0 times', `${called} call(s)`, called === 0); }
{ let called = 0; await addOnlineChecks(base, async d => { called++; return { domain: d, resolves: false, ageDays: null }; }, false); rec('CV-27', 'Live checks can be switched off', 'enabled=false', 'lookup not called', `${called} call(s)`, called === 0); }
{ const t0 = Date.now(); const v = await addOnlineChecks(base, lookupDomain, true); const ms = Date.now() - t0; rec('CV-28', 'Real network lookup finishes within its time limit (any network state)', 'real DNS / RDAP call', 'Returns a valid result in under 9 s', `${v.onlineChecks}; ${ms} ms; flags=${v.flags.length}`, ms < 9000 && ['completed', 'partial', 'unavailable'].includes(v.onlineChecks)); }

{
  // The result must depend on whether DNS itself works: a broken DNS must never be read as "domain does not exist".
  const dnsMod = await import('dns/promises');
  let dnsWorks = true; try { await dnsMod.default.resolve4('example.com'); } catch { dnsWorks = false; }
  const info = await lookupDomain('apex-careers-portal-xyz-' + Date.now() + '.com');
  rec('CV-29', 'Live lookup never calls a domain "non-existent" when DNS itself is not working', `DNS control lookup (example.com) works here: ${dnsWorks}`,
    dnsWorks ? 'resolves=false (domain truly does not exist)' : 'resolves=null (cannot tell, no penalty)', `resolves=${info.resolves}`, dnsWorks ? info.resolves === false : info.resolves === null);
}

// ========== G. Dataset evaluation logic ==========
{
  const items: any[] = [
    { id: 1, text: 'Pay a registration fee of Rs 500 to confirm your internship seat today.', label: 'Fraudulent', source: 't', added_by: null, created_at: '' },
    { id: 2, text: 'We are hiring a Software Engineer Intern. Apply on the careers page; two interview rounds.', label: 'Genuine', source: 't', added_by: null, created_at: '' },
    { id: 3, text: 'We are hiring a Software Engineer Intern. Apply on the careers page; two interview rounds.', label: 'Fraudulent', source: 't', added_by: null, created_at: '' },
  ];
  const e = evaluateDataset(items);
  rec('CV-30', 'Dataset evaluation counts correct answers honestly', '3 items, one deliberately mislabelled', 'total 3, correct 2, accuracy 66.7, 1 mismatch', `total ${e.total}, correct ${e.correct}, accuracy ${e.accuracy}, mismatches ${e.mismatches.length}`, e.total === 3 && e.correct === 2 && e.accuracy === 66.7 && e.mismatches.length === 1 && e.confusionMatrix.Fraudulent.Genuine === 1);
}

fs.writeFileSync('tests/results/unit_new.json', JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.status}  ${r.id}  ${r.scenario}\n      actual: ${r.actual}`);
console.log(`\nUNIT-NEW: ${results.filter(r => r.status === 'PASS').length}/${results.length} passed`);

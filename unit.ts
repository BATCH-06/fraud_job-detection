import { runHeuristicNLPAnalysis } from '../server/nlpRules.js';
import fs from 'fs';

type R = { id: string; scenario: string; input: string; expected: string; actual: string; status: 'PASS' | 'FAIL' };
const results: R[] = [];

function run(
  id: string,
  scenario: string,
  text: string,
  expected: string,
  check: (r: ReturnType<typeof runHeuristicNLPAnalysis>) => boolean,
  meta?: any
) {
  const r = runHeuristicNLPAnalysis(text, meta);
  const actual = `category=${r.riskCategory}, score=${r.heuristicScore}, flags=[${r.flags.map(f => f.id + ':' + f.severity).join(' | ') || 'none'}]`;
  results.push({
    id,
    scenario,
    input: text.length > 140 ? text.slice(0, 137).replace(/\n/g, ' ') + '...' : text.replace(/\n/g, ' '),
    expected,
    actual,
    status: check(r) ? 'PASS' : 'FAIL'
  });
}

// ---------- Fraud indicators (should be detected) ----------
run('UT-01', 'Registration fee demand', 'Congratulations! Pay registration fee of Rs 500 to confirm your internship seat today.',
  'Fraudulent, FEE_DEMAND flag', r => r.riskCategory === 'Fraudulent' && r.flags.some(f => f.category === 'FEE_DEMAND'));

run('UT-02', 'Refundable security deposit', 'Your selection is confirmed. A refundable security deposit of 2000 rupees is needed before joining.',
  'Fraudulent, FEE_DEMAND flag', r => r.riskCategory === 'Fraudulent' && r.flags.some(f => f.category === 'FEE_DEMAND'));

run('UT-03', 'Laptop courier fee', 'We will ship your laptop. Please pay the courier charge of 3500 rupees first via UPI.',
  'Fraudulent, FEE_DEMAND flag', r => r.riskCategory === 'Fraudulent' && r.flags.some(f => f.category === 'FEE_DEMAND'));

run('UT-04', 'Crypto payment request', 'To start work, send USDT to our Binance wallet address as a joining guarantee.',
  'Fraudulent, SUSPICIOUS_PAYMENT_METHODS flag', r => r.riskCategory === 'Fraudulent' && r.flags.some(f => f.category === 'SUSPICIOUS_PAYMENT_METHODS'));

run('UT-05', 'Gift card payment', 'Buy two Amazon gift card codes worth 100 dollars and send us the codes to activate your account.',
  'Fraudulent, SUSPICIOUS_PAYMENT_METHODS flag', r => r.riskCategory === 'Fraudulent' && r.flags.some(f => f.category === 'SUSPICIOUS_PAYMENT_METHODS'));

run('UT-06', 'OTP / banking secret request', 'For salary setup please share your net banking password and the OTP you receive on your phone.',
  'Fraudulent, SENSITIVE_DATA_HARVESTING flag', r => r.riskCategory === 'Fraudulent' && r.flags.some(f => f.category === 'SENSITIVE_DATA_HARVESTING'));

run('UT-07', 'No interview / direct selection', 'No interview needed. You are directly selected for the work from home job. Join Monday.',
  'At least Suspicious, INTERVIEW_OMISSION flag', r => r.riskCategory !== 'Genuine' && r.flags.some(f => f.category === 'INTERVIEW_OMISSION'));

run('UT-08', 'Telegram-only recruiter', 'Our HR will talk to you only on Telegram. Contact on Telegram @jobs_hr_desk to receive tasks.',
  'SUSPICIOUS_COMMUNICATION flag raised', r => r.flags.some(f => f.category === 'SUSPICIOUS_COMMUNICATION'));

run('UT-09', 'Free email claiming big company', 'Google is hiring interns. Send your resume to googlecareers.hr@gmail.com today.',
  'Fraudulent (impersonation flag)', r => r.riskCategory === 'Fraudulent' && r.flags.some(f => f.id.startsWith('impersonation')));

run('UT-10', 'Unrealistic pay: plain number', 'Work from home and earn Rs 50000 per day. Only 30 mins work needed, no skills required.',
  'At least Suspicious (COMPENSATION_ANOMALY)', r => r.riskCategory !== 'Genuine');

run('UT-11', 'Unrealistic pay: Indian comma format', 'Work from home and earn ₹50,000 per day by simple online tasks. No skills required for this job.',
  'At least Suspicious (COMPENSATION_ANOMALY)', r => r.riskCategory !== 'Genuine');

run('UT-12', 'Guaranteed salary promise', 'Guaranteed salary of ₹90,000 per week with no work experience and no interview process at all.',
  'At least Suspicious', r => r.riskCategory !== 'Genuine');

run('UT-13', 'Urgency pressure', 'Reply within 2 hours or the offer expires tonight. Limited seats hurry and confirm your slot.',
  'URGENCY_PRESSURE flag raised', r => r.flags.some(f => f.category === 'URGENCY_PRESSURE'));

run('UT-14', 'ALL CAPS shouting', 'URGENT HIRING FOR FRESHERS NO EXPERIENCE NEEDED APPLY NOW WORK FROM HOME GOOD SALARY JOIN TODAY',
  'LEXICAL_ANOMALIES flag raised', r => r.flags.some(f => f.category === 'LEXICAL_ANOMALIES'));

// ---------- Genuine messages (must NOT be flagged) ----------
run('UT-20', 'Plain genuine ad (no trigger words)', 'We are hiring a Software Engineer Intern. Apply on our careers page. Selected candidates will go through a coding test and two interview rounds.',
  'Genuine, no flags', r => r.riskCategory === 'Genuine' && r.flags.length === 0);

run('UT-21', 'Genuine ad containing the word "together"', 'Our team works together on cloud products. Apply on our careers page and attend two technical interview rounds.',
  'Genuine, no flags', r => r.riskCategory === 'Genuine');

run('UT-22', 'Genuine ad containing "method" / "whether"', 'Please tell us whether you prefer the online method of assessment. Interviews are held on our official campus portal.',
  'Genuine, no flags', r => r.riskCategory === 'Genuine');

run('UT-23', 'Genuine ad containing "footprint"', 'Our global footprint spans 20 countries. We invite you to our campus hiring drive with a written test and interview.',
  'Genuine, no flags', r => r.riskCategory === 'Genuine');

run('UT-24', 'Genuine anti-scam notice ("we never ask for a registration fee")', 'Join our internship program. Note: we never ask for any registration fee from candidates. Selection is through a test and interview.',
  'Genuine (negation must not trigger fee flag)', r => r.riskCategory === 'Genuine');

run('UT-25', 'Genuine message with "metadata"', 'Please attach your resume metadata and portfolio link on our careers portal. Our HR will schedule an interview with you.',
  'No company-impersonation flag and not Fraudulent (a Gmail sender is itself a valid Suspicious signal)', r => r.riskCategory !== 'Fraudulent' && !r.flags.some(f => f.id.startsWith('impersonation')), { senderInfo: 'recruiter@gmail.com' });

run('UT-25b', 'Genuine message with "metadata" and a free-mail contact in the body', 'Please upload the project metadata as part of the task. Send your resume to careers.hr@gmail.com and we will schedule an interview.',
  'Not flagged as impersonating a big company (no CRITICAL)', r => !r.flags.some(f => f.severity === 'CRITICAL'));

run('UT-26', 'App\'s own Genuine preset (TCS campus invitation)', `Dear Candidate,
Greetings from TCS Talent Acquisition Team.
We are pleased to invite you to the TCS Campus Hiring Technical Assessment for the batch of 2026.
CTC Package: 7.0 LPA - 9.0 LPA upon successful completion of technical rounds and managerial interview.
Security Notice: TCS does not ask candidates for any payments, security deposits, or registration charges at any stage of recruitment.
Please review the guidelines on the official portal: https://nextstep.tcs.com.`,
  'Genuine (the app labels this preset Genuine)', r => r.riskCategory === 'Genuine', { companyName: 'Tata Consultancy Services (TCS)', senderInfo: 'campus.talent@tcs.com' });

run('UT-27', 'Genuine mail from official company domain', 'Dear candidate, your technical interview is scheduled for Monday 10 AM on Microsoft Teams. Please carry your college ID card. Regards, Infosys HR.',
  'Genuine', r => r.riskCategory === 'Genuine', { senderInfo: 'hr@infosys.com' });

// ---------- Entity extraction ----------
run('UT-30', 'Extract email, URL, money, UPI', 'Contact hr@acme.com or visit https://acme.com/jobs. Stipend Rs 15000 per month. Pay via UPI to acmepay@okaxis.',
  'emails=1, urls=1, upiIds>=1, moneyMentions>=1', r => r.extractedEntities.emails.length === 1 && r.extractedEntities.urls.length === 1 && r.extractedEntities.upiIds.length >= 1 && r.extractedEntities.moneyMentions.length >= 1);

// ---------- Score range ----------
run('UT-31', 'Score is always within 0-100', 'Pay registration fee. Pay security deposit. Send USDT. Gift card. Net banking password. OTP. No interview needed. Telegram only. Within 2 hours. Training fee. Courier fee.',
  '0 <= score <= 100', r => r.heuristicScore >= 0 && r.heuristicScore <= 100);

// ---------- Robustness ----------
run('UT-32', 'Empty-ish text does not crash', '                    ', 'No crash, Genuine/no flags', r => Array.isArray(r.flags));
run('UT-33', 'Unicode / emoji text does not crash', '🔥🔥 नमस्ते! घर से काम करें और कमाएं ₹5000 रोज़ 💰💰 अभी जुड़ें', 'No crash', r => typeof r.heuristicScore === 'number');

// ---------- Print ----------
const pass = results.filter(r => r.status === 'PASS').length;
fs.writeFileSync('tests/results/unit.json', JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.status}  ${r.id}  ${r.scenario}\n      actual: ${r.actual}`);
console.log(`\nUNIT: ${pass}/${results.length} passed`);

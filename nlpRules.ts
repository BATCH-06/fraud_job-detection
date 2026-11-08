// Rule-based NLP engine: 8 groups of scam indicators -> score, label, and explanation.
// Pure TypeScript (also used by the browser fallback), so it has no Node-only imports.
//
// Matching rules used throughout:
//  * Whole words only (\b), so "together" never matches "eth" and "footprint" never matches "otp".
//  * A match is ignored when the sentence says the opposite ("we never ask for a registration fee").
//  * Amounts accept Indian comma format (₹50,000 and ₹1,50,000).

import type { FlaggedIndicator, ExtractedEntities } from './indicators.js';
import { cleanText, foldConfusables, extractEntities, extractFeatures } from './preprocess.js';
import { detectClaimedCompany, FREE_EMAIL_PROVIDERS } from './companyChecks.js';

export type { FlaggedIndicator } from './indicators.js';

export interface HeuristicAnalysisResult {
  heuristicScore: number; // 0 to 100
  riskCategory: 'Genuine' | 'Suspicious' | 'Fraudulent';
  flags: FlaggedIndicator[];
  extractedEntities: ExtractedEntities;
  recommendations: string[];
  heuristicSummary: string;
}

export interface AnalysisMetadata {
  companyName?: string;
  jobTitle?: string;
  senderInfo?: string;
  channel?: string;
  salary?: string;
  website?: string;
}

// ---------- negation handling ----------
const VERB_NEG = /\b(?:do(?:es)?\s+not|don['’]?t|doesn['’]?t|never|will\s+not|won['’]?t|shall\s+not|must\s+not|should\s+not|cannot|can['’]?t|not\s+to)\b[^.!?\n;]{0,120}$/i;
const ADJ_NEG = /\b(?:no|nil|zero|without|free\s+of|not\s+(?:any|a|an)|neither|nor)\s+(?:(?:any|such|hidden|extra|additional|upfront|advance|kind\s+of)\s+){0,3}(?:\w+\s+)?$/i;
const TRAIL_NEG = /^\s*(?:(?:is|are|will\s+be|shall\s+be)\s+(?:not\s+(?:required|needed|applicable|charged|collected|taken|accepted)|(?:totally\s+|completely\s+)?(?:free|waived|nil|zero))|[:\-–]\s*(?:nil|zero|none|free|waived|n\/a|0)\b)/i;

function isNegatedMatch(text: string, index: number, length: number): boolean {
  let start = 0;
  for (const ch of ['.', '!', '?', '\n', ';']) start = Math.max(start, text.lastIndexOf(ch, index - 1) + 1);
  // A contrast word ends the negation: "We never ask for fees, BUT you must pay a registration fee" is still a demand.
  const sentence = text.slice(start, index);
  const contrast = /\b(?:but|however|except|although|though|whereas|yet)\b/gi;
  let cm: RegExpExecArray | null;
  while ((cm = contrast.exec(sentence)) !== null) start = start + cm.index + cm[0].length;
  const before = text.slice(Math.max(start, index - 160), index);
  const after = text.slice(index + length, index + length + 60);
  return VERB_NEG.test(before) || ADJ_NEG.test(before) || TRAIL_NEG.test(after);
}

function findFirst(text: string, rgx: RegExp, negatable = true): RegExpExecArray | null {
  const g = new RegExp(rgx.source, rgx.flags.includes('g') ? rgx.flags : rgx.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = g.exec(text)) !== null) {
    if (m[0].length === 0) { g.lastIndex++; continue; }
    if (!negatable || !isNegatedMatch(text, m.index, m[0].length)) return m;
  }
  return null;
}

// ---------- amounts ----------
const AMTC = String.raw`((?:\d{1,3}(?:,\d{2,3})+|\d{1,12})(?:\.\d{1,4})?)`;
const CURRENCY = String.raw`(₹|rs\.?|inr|\$|usd)`;
const HIGH_PAY_RE = new RegExp(
  String.raw`(?:${CURRENCY}\s*${AMTC}(?:\s*(?:-|–|to)\s*(?:(?:₹|rs\.?|inr|\$|usd)\s*)?${AMTC})?|${AMTC}(?:\s*(?:-|–|to)\s*${AMTC})?\s*(rupees?|rs\.?|inr|usd|dollars?))\s*(?:\/|per|a|each|every)?\s*(day|daily|week|weekly)\b`,
  'gi'
);
const toNum = (s?: string) => (s ? parseFloat(s.replace(/,/g, '')) : 0);

function findHighPay(text: string): RegExpExecArray | null {
  const g = new RegExp(HIGH_PAY_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = g.exec(text)) !== null) {
    const cur = (m[1] || m[7] || '').toLowerCase();
    const usd = cur.includes('$') || cur.includes('usd') || cur.includes('dollar');
    const value = Math.max(toNum(m[2]), toNum(m[3]), toNum(m[4]), toNum(m[5]));
    const perDay = /^(day|daily)$/i.test(m[8] || '');
    const limit = perDay ? (usd ? 100 : 5000) : (usd ? 500 : 25000);
    if (value >= limit && !isNegatedMatch(text, m.index, m[0].length)) return m;
  }
  return null;
}

function extractSnippet(text: string, index: number, matchLength: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + matchLength + 40);
  return `${start > 0 ? '...' : ''}${text.slice(start, end).trim()}${end < text.length ? '...' : ''}`;
}

// ---------- the engine ----------
export function runHeuristicNLPAnalysis(
  rawText: string,
  metadata?: AnalysisMetadata,
  extraFlags: FlaggedIndicator[] = []
): HeuristicAnalysisResult {
  const original = cleanText(rawText);        // clean text shown in evidence
  const text = foldConfusables(original);     // same length, look-alike letters mapped to Latin for matching
  const flags: FlaggedIndicator[] = [];
  const entities = extractEntities(original);
  const { emails, upiIds, moneyMentions } = entities;
  const features = extractFeatures(original);

  const add = (f: FlaggedIndicator) => flags.push(f);
  const run = (
    rgx: RegExp, mk: (m: RegExpExecArray) => Omit<FlaggedIndicator, 'evidenceSnippet' | 'matchedKeywords'>, negatable = true
  ) => {
    const m = findFirst(text, rgx, negatable);
    if (m) add({ ...mk(m), evidenceSnippet: extractSnippet(original, m.index, m[0].length), matchedKeywords: [m[0]] });
  };

  // --- RULE 1: Demands for upfront fees or deposits (CRITICAL) ---
  const FEE_DESC = 'Real companies never ask job applicants or interns to pay any fee for applying, receiving equipment, or starting work.';
  const feePatterns: { regex: RegExp; label: string }[] = [
    { regex: /\bregistration\s*(?:fees?|charges?|amount|cost|payment)\b/i, label: 'Asking for a Registration Fee' },
    { regex: /\b(?:security|refundable|caution)\s*(?:deposits?|fees?|bond|money|amount)\b/i, label: 'Asking for a "Refundable" Security Deposit' },
    { regex: /\b(?:training|kit|material|course|certification)\s*(?:fees?|costs?|charges?|payment)\b/i, label: 'Charging for Training or Starter Kits' },
    { regex: /\b(?:laptop|courier|dispatch|delivery|shipping)\s*(?:insurance\s*)?(?:fees?|charges?|advance|costs?)\b/i, label: 'Charging for Laptop Shipping or Courier' },
    { regex: /\b(?:processing|document|documentation|id\s*card|gate\s*pass)\s*(?:fees?|charges?)\b/i, label: 'Charging for ID Cards or Document Processing' },
    { regex: new RegExp(String.raw`\b(?:pay|send|transfer|deposit|remit)\s*(?:an?\s*|the\s*)?(?:(?:rs\.?|₹|\$|€|£|inr)\s*)?(?:\d{1,3}(?:,\d{2,3})+|\d{1,12})\s*(?:rupees|rs|inr)?\s*(?:before|prior|for|to\s*confirm|advance)\b`, 'i'), label: 'Demanding Advance Money to Start Work' },
    // Hindi and Telugu wording
    { regex: /(?:पंजीकरण|पंजीयन|रजिस्ट्रेशन)\s*(?:शुल्क|फीस|फ़ीस|चार्ज)/, label: 'Asking for a Registration Fee' },
    { regex: /(?:सिक्योरिटी|सुरक्षा)\s*(?:डिपॉजिट|जमा|राशि)/, label: 'Asking for a "Refundable" Security Deposit' },
    { regex: /(?:రిజిస్ట్రేషన్|నమోదు)\s*(?:ఫీజు|రుసుము|చార్జీ)/, label: 'Asking for a Registration Fee' },
  ];
  feePatterns.forEach((p, idx) => run(p.regex, () => ({ id: `fee-${idx}`, category: 'FEE_DEMAND', label: p.label, severity: 'CRITICAL', description: FEE_DESC })));

  // --- RULE 2: Suspicious payment methods ---
  const PAY_DESC = 'Asking for payments through apps, cryptocurrency, or gift cards is a strong warning sign of a scam.';
  const cryptoRe = /\b(?:crypto(?:currency|currencies)?|usdt|bitcoin|btc|ethereum|eth|binance|trust\s*wallet)\b/i;
  const cg = new RegExp(cryptoRe.source, 'gi');
  let cm: RegExpExecArray | null;
  while ((cm = cg.exec(text)) !== null) {
    const win = text.slice(Math.max(0, cm.index - 80), cm.index + cm[0].length + 80);
    // Crypto is only a warning sign when the offer asks for money / a wallet, not when it just mentions the word.
    if (/\b(?:pay|send|transfer|deposit|stake|invest|remit|buy|wallet\s*address|link\s*(?:your\s*)?wallet)\b/i.test(win) && !isNegatedMatch(text, cm.index, cm[0].length)) {
      add({ id: 'pay-chan-0', category: 'SUSPICIOUS_PAYMENT_METHODS', label: 'Asking for Cryptocurrency or Digital Tokens', severity: 'CRITICAL', description: PAY_DESC, evidenceSnippet: extractSnippet(original, cm.index, cm[0].length), matchedKeywords: [cm[0]] });
      break;
    }
  }
  const paymentChannelPatterns: { regex: RegExp; label: string }[] = [
    { regex: /\b(?:gift\s*cards?|itunes|steam\s*card|google\s*play\s*card)\b/i, label: 'Asking for Gift Cards' },
    { regex: /\b(?:cashier'?s\s*check|money\s*order|wire\s*transfer|western\s*union)\b/i, label: 'Unusual Wire Transfer or Check Instructions' },
    { regex: /\b(?:pay\s*via|send\s*to|transfer\s*to)\s*upi\b/i, label: 'Asking to Send Money to a Personal UPI Address' },
  ];
  paymentChannelPatterns.forEach((p, idx) => run(p.regex, () => ({ id: `pay-chan-${idx + 1}`, category: 'SUSPICIOUS_PAYMENT_METHODS', label: p.label, severity: 'CRITICAL', description: PAY_DESC })));

  if (upiIds.length > 0 && flags.some(f => f.category === 'FEE_DEMAND')) {
    add({ id: 'upi-address-detected', category: 'SUSPICIOUS_PAYMENT_METHODS', label: 'Personal Payment Address Found', severity: 'HIGH', description: `A personal payment address was found (${upiIds.join(', ')}). Real businesses do not collect application money into personal accounts.`, evidenceSnippet: upiIds[0], matchedKeywords: upiIds });
  }

  // --- RULE 3: Unrealistic pay and easy-money promises ---
  const COMP_DESC = 'Offers that promise high daily earnings for very simple tasks (like watching videos or typing) are almost always traps.';
  const pay = findHighPay(text);
  if (pay) add({ id: 'comp-0', category: 'COMPENSATION_ANOMALY', label: 'Unusually High Daily or Weekly Pay', severity: 'HIGH', description: COMP_DESC, evidenceSnippet: extractSnippet(original, pay.index, pay[0].length), matchedKeywords: [pay[0]] });
  run(/\b(?:like\s*(?:and|&)\s*subscribe|youtube\s*videos?|rating\s*products?|product\s*ratings?|hotel\s*reviews?|copy\s*paste|ad\s*clicking|liking\s*videos?|watch(?:ing)?\s*videos?)\b[^.!?\n]{0,40}\b(?:earn|job|task|income|payment|paid)\b/i,
    () => ({ id: 'comp-1', category: 'COMPENSATION_ANOMALY', label: 'Paying High Money for Liking Videos or Simple Tasks', severity: 'HIGH', description: COMP_DESC }));
  run(/\b(?:earn|make)\b[^.!?\n]{0,40}\b(?:by|from|for)\s+(?:simply\s+|just\s+)?(?:liking|watching|rating|clicking|typing|sharing)\b/i,
    () => ({ id: 'comp-1b', category: 'COMPENSATION_ANOMALY', label: 'Paying High Money for Liking Videos or Simple Tasks', severity: 'HIGH', description: COMP_DESC }));
  if (moneyMentions.length > 0) {
    run(/\b(?:only\s+)?(?:1\s*(?:-|to)\s*2\s*hours?|2\s*hours?|30\s*(?:mins?|minutes)|few\s*minutes?|just\s+\d+\s*(?:mins?|minutes|hours?))\s*(?:daily|a\s*day|per\s*day|of\s*work|work)\b/i,
      () => ({ id: 'comp-2', category: 'COMPENSATION_ANOMALY', label: 'Big Money Promised for Very Little Time', severity: 'HIGH', description: COMP_DESC }));
  }
  run(/\b(?:guarantee[d]?|assured|fixed)\s+(?:(?:daily|weekly|instant|monthly)\s+)?(?:profit|income|returns?|payout|earnings?)\b/i,
    () => ({ id: 'comp-3', category: 'COMPENSATION_ANOMALY', label: 'Guaranteed Instant Returns or Profit', severity: 'HIGH', description: COMP_DESC }));
  run(/\bguarantee[d]?\s+(?:(?:a|an|the)\s+)?(?:salary|job|placement|selection|pay|stipend)\b/i,
    () => ({ id: 'comp-4', category: 'COMPENSATION_ANOMALY', label: 'Guaranteed Salary or Job Promise', severity: 'MEDIUM', description: 'No honest employer can guarantee a job or salary before an interview and skill check. Treat this promise with care.' }));

  // --- RULE 4: Contact warnings (free e-mail, chat apps) ---
  const claimed = detectClaimedCompany(text, metadata?.companyName);
  const contactEmails = new Set<string>(emails);
  for (const e of extractEntities(metadata?.senderInfo || '').emails) contactEmails.add(e);
  contactEmails.forEach(email => {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || !FREE_EMAIL_PROVIDERS.includes(domain)) return;
    if (claimed) {
      const name = claimed.key.toUpperCase();
      add({ id: `impersonation-${domain}`, category: 'SUSPICIOUS_COMMUNICATION', label: `Claims to Be ${name} but Uses a Free Email`, severity: 'CRITICAL', description: `The message mentions ${name}, but the contact email uses a free service (@${domain}) instead of their real company address.`, evidenceSnippet: email, matchedKeywords: [email, claimed.key] });
    } else {
      add({ id: `free-webmail-${domain}`, category: 'SUSPICIOUS_COMMUNICATION', label: 'Official Hiring Done Through a Free Email Account', severity: 'HIGH', description: `The sender uses a free personal email (@${domain}). Professional recruiters almost always use their company's official domain name.`, evidenceSnippet: email, matchedKeywords: [email] });
    }
  });
  const CHAT_DESC = 'Scammers frequently keep conversations on chat apps like Telegram or WhatsApp to remain anonymous.';
  run(/(?:\btelegram\b|\btg\s*handle\b|\bt\.me\/[a-zA-Z0-9_]+|टेलीग्राम|@\w+_hr\b)/i, () => ({ id: 'tele-redirect-0', category: 'SUSPICIOUS_COMMUNICATION', label: 'Recruiting Strictly on Telegram or WhatsApp', severity: 'HIGH', description: CHAT_DESC }));
  run(/(?:\bwhatsapp\s*(?:only|hr|manager|group|number)\b|\bwa\.me\/[0-9]+)/i, () => ({ id: 'tele-redirect-1', category: 'SUSPICIOUS_COMMUNICATION', label: 'Recruiting Strictly on Telegram or WhatsApp', severity: 'HIGH', description: CHAT_DESC }));

  // --- RULE 5: No interview / instant selection ---
  const INT_DESC = 'Real jobs and internships always have at least one interview or skill check before giving you an offer.';
  [
    /\b(?:no\s*interviews?(?:\s*(?:needed|required|conducted|process|rounds?))?|direct\s*(?:joining|selection|hiring)|instant\s*(?:offer\s*letter|joining|selection))\b/i,
    /\b(?:selected\s*without\s*(?:any\s*)?interview|without\s*(?:any\s*)?interviews?|congratulations\s*,?\s*you\s*are\s*directly\s*selected)\b/i,
    /\b(?:interview\s*via\s*telegram|questionnaire\s*only\s*interview)\b/i,
  ].forEach((rgx, idx) => run(rgx, () => ({ id: `no-interview-${idx}`, category: 'INTERVIEW_OMISSION', label: 'Selected Instantly Without an Interview', severity: 'HIGH', description: INT_DESC })));

  // --- RULE 6: Asking for private information too early ---
  const PII_DESC = 'Employers do not need banking passwords, PINs, OTPs, or original certificates before you are even hired.';
  const piiPatterns: { regex: RegExp; label: string; severity: 'CRITICAL' | 'MEDIUM' }[] = [
    { regex: /\b(?:bank\s*account\s*password|net\s*banking\s*(?:password|login|credentials|details|pin)|atm\s*pin|cvv(?:\s*number)?|otp|one[\s-]*time\s*password)\b/i, label: 'Asking for Banking Passwords, PIN, or OTP', severity: 'CRITICAL' },
    { regex: /\b(?:blank\s*signed\s*cheque|blank\s*check|send\s*original\s*(?:degree|certificate|passport|mark\s*sheet))\b/i, label: 'Asking for Blank Signed Checks or Original Certificates', severity: 'CRITICAL' },
    { regex: /\b(?:credit\s*card\s*number|debit\s*card\s*details|card\s*expiry)\b/i, label: 'Asking for Card Numbers or Security Codes', severity: 'CRITICAL' },
    { regex: /\b(?:aadhaar|ssn|social\s*security\s*number|pan\s*card|id\s*photo)\s*(?:immediately|before\s*interview|to\s*apply)\b/i, label: 'Demanding Identity Card Photos Upfront', severity: 'MEDIUM' },
  ];
  piiPatterns.forEach((p, idx) => run(p.regex, () => ({ id: `pii-${idx}`, category: 'SENSITIVE_DATA_HARVESTING', label: p.label, severity: p.severity, description: PII_DESC })));

  // --- RULE 7: Artificial rush ---
  [
    /\b(?:within\s*(?:1|2|3|6|12|24)\s*hours?|offer\s*expires\s*tonight|valid\s*only\s*today)\b/i,
    /\b(?:limited\s*(?:seats|slots|vacancies)\s*,?\s*hurry|immediate\s*joiners\s*only\s*apply\s*now|only\s*\d+\s*(?:seats|slots|vacancies)\s*left)\b/i,
    /\b(?:pay\s*immediately\s*or\s*lose\s*offer|slot\s*will\s*be\s*given\s*to\s*another)\b/i,
  ].forEach((rgx, idx) => run(rgx, () => ({ id: `urgency-${idx}`, category: 'URGENCY_PRESSURE', label: 'Rushing You with an Urgent Deadline', severity: 'MEDIUM', description: 'Scammers create tight deadlines (like "expires in 2 hours") so students act quickly without checking with parents or teachers.' }), false));

  // --- RULE 8: Text quality and shouting ---
  if (features.upperCaseRatio > 0.45 && original.length > 80) {
    add({ id: 'lexical-caps', category: 'LEXICAL_ANOMALIES', label: 'Too Much Capital Letter Shouting', severity: 'LOW', description: 'The message is written in all-capital letters, which is common in spam messages and unusual for professional companies.', evidenceSnippet: original.slice(0, 80) + '...', matchedKeywords: ['ALL-CAPS text'] });
  }
  if (features.exclamationCount >= 5 && original.length < 500) {
    add({ id: 'lexical-exclamation', category: 'LEXICAL_ANOMALIES', label: 'Too Many Exclamation Marks', severity: 'LOW', description: 'Multiple exclamation points (!!!) often indicate spam rather than official company communication.', evidenceSnippet: `Contains ${features.exclamationCount} exclamation marks`, matchedKeywords: ['!'] });
  }

  // --- Extra flags from company verification (same scoring) ---
  for (const f of extraFlags) if (!flags.some(x => x.id === f.id)) flags.push(f);

  // --- Score ---
  let score = 0;
  for (const flag of flags) score += flag.severity === 'CRITICAL' ? 35 : flag.severity === 'HIGH' ? 22 : flag.severity === 'MEDIUM' ? 12 : 5;
  score = Math.min(Math.max(score, 0), 98);

  const hasAntiScamDisclaimer = [
    /\b(?:never|do\s*not|does\s*not|don['’]?t)\s*(?:ask|charge|collect|demand|take)[^.!?\n]{0,80}\b(?:fees?|money|payments?|deposits?|charges?)\b/i,
    /\bwe\s*do\s*not\s*charge\s*any\s*(?:fee|money)\b/i,
    /\bno\s*fee\s*is\s*required\s*at\s*any\s*stage\b/i,
  ].some(r => r.test(text));
  if (hasAntiScamDisclaimer && flags.length === 0) score = 5;
  else if (hasAntiScamDisclaimer && !flags.some(f => f.severity === 'CRITICAL')) score = Math.max(score - 15, 5);

  let riskCategory: 'Genuine' | 'Suspicious' | 'Fraudulent';
  if (score >= 70 || flags.some(f => f.severity === 'CRITICAL')) {
    riskCategory = 'Fraudulent';
    score = Math.max(score, 75);
  } else if (score >= 20) {
    riskCategory = 'Suspicious';
  } else {
    riskCategory = 'Genuine';
    score = Math.min(score, 19);
  }

  // --- Advice ---
  const recommendations: string[] = [];
  if (flags.some(f => f.category === 'FEE_DEMAND' || f.category === 'SUSPICIOUS_PAYMENT_METHODS')) {
    recommendations.push('Do NOT pay any money, whether called a registration fee, laptop deposit, or training kit fee. Real employers pay you; you never pay them.');
    recommendations.push('If you already paid, immediately call the National Cyber Crime Helpline at 1930 or visit cybercrime.gov.in.');
  }
  if (flags.some(f => f.category === 'SUSPICIOUS_COMMUNICATION')) {
    recommendations.push('Never agree to a job offer that only happens over Telegram, WhatsApp, or personal email. Ask for an official offer letter from their verified company email address.');
    recommendations.push('Visit the company\'s official website by typing the address yourself and check their careers page.');
  }
  if (flags.some(f => f.category === 'COMPANY_VERIFICATION')) {
    recommendations.push('Check the company yourself: type its official website into your browser and look for the same job on its careers page. You can also look the company up on the Ministry of Corporate Affairs site (mca.gov.in).');
  }
  if (flags.some(f => f.category === 'SENSITIVE_DATA_HARVESTING')) {
    recommendations.push('Never share your banking password, ATM PIN, card CVV, or one-time password (OTP). No legitimate employer will ever ask for these.');
  }
  if (flags.some(f => f.category === 'INTERVIEW_OMISSION')) {
    recommendations.push('Be cautious if you are offered a job immediately without any conversation or test. Real employers always interview you first.');
  }
  if (riskCategory === 'Genuine') {
    recommendations.push('This message looks normal and professional. To be safe, always double-check through the company\'s official careers page before sharing documents.');
    recommendations.push('You can also show this offer to your college placement cell to verify it.');
  } else {
    recommendations.push('Warn your classmates and friends so they don\'t fall for this same message.');
  }

  const heuristicSummary = flags.length === 0
    ? 'No common warning signs were detected in this advertisement. The wording looks like normal, professional recruitment.'
    : `We found ${flags.length} warning signs (${flags.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length} important ones). Please review the warning signs below before responding.`;

  return { heuristicScore: score, riskCategory, flags, extractedEntities: entities, recommendations, heuristicSummary };
}

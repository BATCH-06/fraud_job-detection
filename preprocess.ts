// Text preprocessing (the "NLP Processor" in the class diagram): cleanText, tokenizeText, extractFeatures.
// Pure TypeScript: no Node-only imports, so it also runs in the browser fallback.

import type { ExtractedEntities } from './indicators.js';

export const MAX_TEXT_LENGTH = 10000;
export const MIN_TEXT_LENGTH = 20;

/** Clean raw text: normalise Unicode, drop hidden characters, tidy whitespace. */
export function cleanText(raw: string): string {
  let t = String(raw ?? '');
  try { t = t.normalize('NFKC'); } catch { /* ignore */ }
  t = t
    .replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, '')        // zero-width / soft-hyphen characters used to dodge keyword filters
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

// Look-alike letters (Cyrillic / Greek) mapped 1-to-1 to Latin, so "Gооgle" (with Cyrillic o) is still seen as "Google".
// Because the mapping is 1-to-1, character positions stay the same and evidence snippets stay correct.
const CONFUSABLES: Record<string, string> = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ӏ': 'l',
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'І': 'I',
  'ο': 'o', 'ν': 'v', 'α': 'a', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ρ': 'p', 'τ': 't', 'Ο': 'O', 'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ρ': 'P', 'Τ': 'T'
};
export function foldConfusables(text: string): string {
  let out = '';
  for (const ch of text) out += CONFUSABLES[ch] ?? ch;
  return out.length === text.length ? out : text;
}

/** Split text into lower-case word tokens (letters and numbers in any language). */
export function tokenizeText(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’_-]*/gu) || []);
}

export interface TextFeatures {
  charCount: number;
  wordCount: number;
  upperCaseRatio: number;
  exclamationCount: number;
  digitRatio: number;
  avgWordLength: number;
}

export function extractFeatures(text: string): TextFeatures {
  const tokens = tokenizeText(text);
  const letters = text.replace(/[^a-zA-Z]/g, '').length;
  const upper = text.replace(/[^A-Z]/g, '').length;
  const digits = text.replace(/[^0-9]/g, '').length;
  return {
    charCount: text.length,
    wordCount: tokens.length,
    upperCaseRatio: upper / Math.max(letters, 1),
    exclamationCount: (text.match(/!/g) || []).length,
    digitRatio: digits / Math.max(text.length, 1),
    avgWordLength: tokens.length ? tokens.reduce((a, t) => a + t.length, 0) / tokens.length : 0
  };
}

// ---- Entity extraction (linear-time: no patterns that can backtrack badly on long input) ----

function extractEmails(text: string): string[] {
  const found = new Set<string>();
  let at = text.indexOf('@');
  while (at !== -1) {
    let s = at - 1;
    while (s >= 0 && at - s <= 64 && /[a-zA-Z0-9._%+-]/.test(text[s])) s--;
    let e = at + 1;
    while (e < text.length && e - at <= 255 && /[a-zA-Z0-9.-]/.test(text[e])) e++;
    const candidate = text.slice(s + 1, e).replace(/[.-]+$/, '');
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/.test(candidate)) found.add(candidate);
    at = text.indexOf('@', at + 1);
  }
  return Array.from(found);
}

export function extractEntities(text: string): ExtractedEntities {
  const emails = extractEmails(text);
  const phones = Array.from(new Set(text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []));
  const telegramHandles = Array.from(new Set(text.match(/@[a-zA-Z0-9_]{4,32}/g) || []))
    .filter(h => !emails.some(e => e.includes(h)));
  const upiIds = Array.from(new Set(text.match(/[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}(?!\.?[a-zA-Z0-9-])/g) || []))
    .filter(u => /@(okaxis|okhdfcbank|okicici|oksbi|paytm|ybl|apl|upi|axl|ibl)$/i.test(u));
  const urls = Array.from(new Set(text.match(/https?:\/\/[^\s"'<>]{3,300}/gi) || [])).map(u => u.replace(/[.,;:!?)]+$/, ''));
  const moneyMentions = Array.from(new Set(text.match(/(?:[$€£₹]|rs\.?|inr|usd)\s*\d{1,3}(?:,\d{2,3})+(?:\.\d+)?(?:\s*(?:k|lakh|lakhs|crore|per\s*(?:day|week|month|hour|hr|year|annum)))?|(?:[$€£₹]|rs\.?|inr|usd)\s*\d+(?:\.\d+)?(?:\s*(?:k|lakh|lakhs|crore|per\s*(?:day|week|month|hour|hr|year|annum)))?/gi) || []));
  return { emails, phones, telegramHandles, upiIds, urls, moneyMentions };
}

// ---- "Does this look like a job / internship message at all?" ----
const JOB_TERMS = new RegExp(
  '\\b(?:job|jobs|intern|interns|internship|internships|hiring|hire|hired|vacanc(?:y|ies)|position|role|opening|openings|opportunity|recruit(?:er|ers|ment|ing)?|apply|applying|application|applications|candidate|candidates|selected|selection|shortlisted|offer|salary|stipend|ctc|lpa|package|income|earn|earning|earnings|payout|pay|paid|work|working|career|careers|employment|employer|employee|interview|interviews|joining|join|training|trainee|fresher|freshers|campus|placement|task|tasks|part[- ]?time|full[- ]?time|remote|wfh|resume|cv)\\b' +
  '|नौकरी|जॉब|भर्ती|रोजगार|काम|वेतन|सैलरी|इंटर्न|कमा|ఉద్యోగ|ఇంటర్న్|జీతం|పని|招聘|实习|工作',
  'iu'
);
export function looksLikeJobPosting(text: string): { isJobLike: boolean; matchedTerms: string[] } {
  const found = new Set<string>();
  const re = new RegExp(JOB_TERMS.source, 'giu');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null && found.size < 6) found.add(m[0].toLowerCase());
  return { isJobLike: found.size > 0, matchedTerms: Array.from(found) };
}

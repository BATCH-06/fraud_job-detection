// Company verification (the "CompanyVerifier" in the project class diagram):
//   verifyCompany()  - who does the offer claim to come from?
//   verifyContact()  - do the contact e-mail domains fit that company?
//   checkWebsite()   - do the website links look genuine?
// This file is pure TypeScript (no network, no Node APIs) so it runs on the server AND in the browser fallback.
// Live checks (DNS, domain age) are in companyLookup.ts and are added on the server only.

import type { CompanyVerificationResult, FlaggedIndicator, VerificationCheck, ExtractedEntities } from './indicators.js';
import { extractEntities } from './preprocess.js';

export interface KnownCompany { key: string; names: string[]; domains: string[]; }

// Well-known employers that scammers often pretend to be, with their official domains.
export const KNOWN_COMPANIES: KnownCompany[] = [
  { key: 'google', names: ['google', 'alphabet'], domains: ['google.com', 'google.co.in', 'withgoogle.com'] },
  { key: 'microsoft', names: ['microsoft'], domains: ['microsoft.com', 'live.com'] },
  { key: 'amazon', names: ['amazon', 'amazon web services', 'aws'], domains: ['amazon.com', 'amazon.in', 'amazon.jobs', 'aboutamazon.com', 'amazonaws.com'] },
  { key: 'apple', names: ['apple'], domains: ['apple.com'] },
  { key: 'meta', names: ['meta', 'facebook'], domains: ['meta.com', 'facebook.com', 'fb.com'] },
  { key: 'netflix', names: ['netflix'], domains: ['netflix.com'] },
  { key: 'ibm', names: ['ibm'], domains: ['ibm.com'] },
  { key: 'oracle', names: ['oracle'], domains: ['oracle.com'] },
  { key: 'intel', names: ['intel'], domains: ['intel.com'] },
  { key: 'nvidia', names: ['nvidia'], domains: ['nvidia.com'] },
  { key: 'adobe', names: ['adobe'], domains: ['adobe.com'] },
  { key: 'salesforce', names: ['salesforce'], domains: ['salesforce.com'] },
  { key: 'cisco', names: ['cisco'], domains: ['cisco.com'] },
  { key: 'qualcomm', names: ['qualcomm'], domains: ['qualcomm.com'] },
  { key: 'sap', names: ['sap'], domains: ['sap.com'] },
  { key: 'tcs', names: ['tcs', 'tata consultancy services'], domains: ['tcs.com'] },
  { key: 'infosys', names: ['infosys'], domains: ['infosys.com'] },
  { key: 'wipro', names: ['wipro'], domains: ['wipro.com'] },
  { key: 'hcl', names: ['hcl', 'hcltech', 'hcl technologies'], domains: ['hcltech.com', 'hcl.com'] },
  { key: 'techmahindra', names: ['tech mahindra'], domains: ['techmahindra.com'] },
  { key: 'cognizant', names: ['cognizant'], domains: ['cognizant.com'] },
  { key: 'capgemini', names: ['capgemini'], domains: ['capgemini.com'] },
  { key: 'accenture', names: ['accenture'], domains: ['accenture.com'] },
  { key: 'deloitte', names: ['deloitte'], domains: ['deloitte.com', 'deloitte.co.in'] },
  { key: 'pwc', names: ['pwc', 'pricewaterhousecoopers'], domains: ['pwc.com', 'pwc.in'] },
  { key: 'kpmg', names: ['kpmg'], domains: ['kpmg.com', 'kpmg.in'] },
  { key: 'ey', names: ['ernst & young', 'ernst and young'], domains: ['ey.com'] },
  { key: 'goldman', names: ['goldman sachs', 'goldman'], domains: ['goldmansachs.com', 'gs.com'] },
  { key: 'morganstanley', names: ['morgan stanley'], domains: ['morganstanley.com', 'ms.com'] },
  { key: 'jpmorgan', names: ['jpmorgan', 'jp morgan'], domains: ['jpmorgan.com', 'jpmchase.com'] },
  { key: 'flipkart', names: ['flipkart'], domains: ['flipkart.com'] },
  { key: 'paytm', names: ['paytm'], domains: ['paytm.com', 'paytm.in'] },
  { key: 'swiggy', names: ['swiggy'], domains: ['swiggy.com', 'swiggy.in'] },
  { key: 'zomato', names: ['zomato'], domains: ['zomato.com'] },
  { key: 'hdfc', names: ['hdfc bank', 'hdfc'], domains: ['hdfcbank.com'] },
  { key: 'icici', names: ['icici bank', 'icici'], domains: ['icicibank.com'] },
  { key: 'sbi', names: ['state bank of india', 'sbi'], domains: ['sbi.co.in'] },
];

export const FREE_EMAIL_PROVIDERS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in', 'ymail.com', 'hotmail.com', 'outlook.com', 'live.com',
  'msn.com', 'rediffmail.com', 'aol.com', 'protonmail.com', 'proton.me', 'icloud.com', 'mail.com', 'gmx.com', 'yandex.com'
];

const SUSPICIOUS_TLDS = ['xyz', 'top', 'click', 'work', 'gq', 'tk', 'ml', 'cf', 'ga', 'icu', 'site', 'online', 'buzz', 'rest', 'loan', 'win', 'vip', 'monster', 'cyou', 'cfd', 'sbs'];
const URL_SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'rb.gy', 'is.gd', 'shorturl.at', 'ow.ly', 'buff.ly', 'rebrand.ly', 'tiny.cc', 'lnkd.in'];
const GENERIC_PAGE_HOSTS = ['forms.gle', 'wa.me', 't.me', 'telegram.me', 'linktr.ee', 'wixsite.com', 'blogspot.com', 'weebly.com', 'sites.google.com', 'notion.site', 'webflow.io', 'carrd.co', 'typeform.com', 'wordpress.com'];

const GENERIC_COMPANY_WORDS = new Set(['pvt', 'ltd', 'limited', 'private', 'technologies', 'technology', 'tech', 'solutions', 'services', 'service', 'inc', 'llc', 'llp', 'india', 'group', 'the', 'and', 'company', 'corp', 'corporation', 'systems', 'global', 'digital', 'software', 'infotech', 'consulting', 'consultancy', 'enterprises']);

// ---------- helpers ----------
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const normalizeLeet = (s: string) => s.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/5/g, 's').replace(/\$/g, 's');

export function detectClaimedCompany(text: string, companyName?: string): KnownCompany | null {
  const search = (hay: string): KnownCompany | null => {
    for (const c of KNOWN_COMPANIES) {
      for (const n of c.names) {
        if (new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(n).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'iu').test(hay)) return c;
      }
    }
    return null;
  };
  return (companyName ? search(companyName) : null) || search(text);
}

export function isOfficialDomain(host: string, company: KnownCompany): boolean {
  const h = host.toLowerCase();
  return company.domains.some(d => h === d || h.endsWith('.' + d));
}

/** Is this host a fake look-alike of a known company's domain? */
export function findLookalike(host: string, claimed: KnownCompany | null): KnownCompany | null {
  const h = host.toLowerCase().replace(/^www\./, '');
  const labels = h.split('.');
  if (labels.length < 2) return null;
  const nameParts = labels.slice(0, -1);                       // everything except the last label (the TLD)
  const joined = normalizeLeet(nameParts.join(''));            // e.g. "google-careers" -> "googlecareers"
  const tokens = nameParts.join('-').split('-').map(normalizeLeet).filter(Boolean);
  for (const c of KNOWN_COMPANIES) {
    if (isOfficialDomain(h, c)) continue;
    const isClaimed = claimed?.key === c.key;
    for (const brand of c.names.map(n => n.replace(/[^a-z0-9]/gi, '').toLowerCase()).filter(n => n.length >= 3)) {
      if (brand.length <= 4) {
        // short brands (tcs, ibm, meta...) must match a whole word of the domain, and only when that company is claimed
        if (isClaimed && tokens.includes(brand)) return c;
      } else if (joined.includes(brand) && (isClaimed || brand.length >= 6)) {
        return c;
      } else if (brand.length >= 5 && tokens.some(t => Math.abs(t.length - brand.length) <= 2 && levenshtein(t, brand) <= (brand.length >= 8 ? 2 : 1) && t !== brand)) {
        return c;
      }
    }
  }
  return null;
}

interface ParsedUrl { host: string; https: boolean | null; raw: string; }
function parseHost(raw: string): ParsedUrl | null {
  const s = raw.trim();
  if (!s) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
  try {
    const u = new URL(hasScheme ? s : `https://${s}`);
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    if (!host || !/[.:]/.test(host)) return null;
    return { host, https: hasScheme ? u.protocol === 'https:' : null, raw: s };
  } catch { return null; }
}
const isIpHost = (h: string) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(h) || h.includes(':');
const tldOf = (h: string) => h.split('.').pop() || '';
const matchesHostList = (host: string, list: string[]) => list.some(d => host === d || host.endsWith('.' + d));

function companyTokens(name: string): string[] {
  return (name.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter(t => !GENERIC_COMPANY_WORDS.has(t));
}

export interface VerifyInput {
  text: string;
  companyName?: string;
  website?: string;
  senderInfo?: string;
  entities?: ExtractedEntities;
}

// ---------- main entry ----------
export function verifyCompanyOffline(input: VerifyInput): CompanyVerificationResult {
  const text = input.text || '';
  const entities = input.entities || extractEntities(text);
  const checks: VerificationCheck[] = [];
  const flags: FlaggedIndicator[] = [];
  const checkedDomains = new Set<string>();

  const companyName = (input.companyName || '').trim();
  const claimed = detectClaimedCompany(text, companyName);

  const addFlag = (f: Omit<FlaggedIndicator, 'category'>) => flags.push({ category: 'COMPANY_VERIFICATION', ...f });

  // --- verifyCompany ---
  if (claimed) {
    checks.push({ id: 'company-known', area: 'Company', label: 'Recognised organisation', status: 'info', detail: `The offer names ${claimed.key.toUpperCase()}. Its official web domains include: ${claimed.domains.slice(0, 3).join(', ')}.` });
  } else if (companyName) {
    checks.push({ id: 'company-named', area: 'Company', label: 'Company name given', status: 'info', detail: `"${companyName}" is not on our list of well-known employers, so it can only be checked through its domains.` });
  } else {
    checks.push({ id: 'company-missing', area: 'Company', label: 'Company name', status: 'info', detail: 'No company name was entered. Add it in the extra details for a stronger check.' });
  }

  // --- verifyContact: e-mail domains ---
  const emails = new Set<string>(entities.emails);
  for (const e of extractEntities(input.senderInfo || '').emails) emails.add(e);
  let officialMatches = 0;
  for (const email of Array.from(emails).slice(0, 5)) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) continue;
    checkedDomains.add(domain);
    const free = FREE_EMAIL_PROVIDERS.includes(domain);
    const lookalike = !free ? findLookalike(domain, claimed) : null;
    if (claimed && isOfficialDomain(domain, claimed)) {
      officialMatches++;
      checks.push({ id: `contact-official-${domain}`, area: 'Contact', label: `Email domain ${domain}`, status: 'pass', detail: `Matches an official ${claimed.key.toUpperCase()} domain.` });
    } else if (free) {
      checks.push({ id: `contact-free-${domain}`, area: 'Contact', label: `Email domain ${domain}`, status: 'warn', detail: 'A free personal email service. Companies normally write from their own domain.' });
    } else if (lookalike) {
      checks.push({ id: `contact-lookalike-${domain}`, area: 'Contact', label: `Email domain ${domain}`, status: 'fail', detail: `Looks like a copy of ${lookalike.key.toUpperCase()}'s domain, but it is not one of their official domains.` });
      addFlag({ id: `company-lookalike-${domain}`, label: `Fake Look-alike Email Domain (${domain})`, severity: 'CRITICAL', description: `The domain ${domain} is made to look like ${lookalike.key.toUpperCase()}, but it is not an official ${lookalike.key.toUpperCase()} domain. Scammers register such domains to look real.`, evidenceSnippet: email, matchedKeywords: [domain] });
    } else if (SUSPICIOUS_TLDS.includes(tldOf(domain))) {
      checks.push({ id: `contact-tld-${domain}`, area: 'Contact', label: `Email domain ${domain}`, status: 'warn', detail: `Ends in ".${tldOf(domain)}", an ending that is cheap and often used in scams.` });
      addFlag({ id: `company-tld-${domain}`, label: `Recruiter Email Uses a Risky Domain Ending (.${tldOf(domain)})`, severity: 'MEDIUM', description: `Domains ending in ".${tldOf(domain)}" are cheap and common in scam campaigns. Check the company independently.`, evidenceSnippet: email, matchedKeywords: [domain] });
    } else if (claimed) {
      checks.push({ id: `contact-mismatch-${domain}`, area: 'Contact', label: `Email domain ${domain}`, status: 'warn', detail: `The offer names ${claimed.key.toUpperCase()}, but ${domain} is not one of its official domains.` });
      addFlag({ id: `company-mismatch-${domain}`, label: `Contact Email Does Not Match ${claimed.key.toUpperCase()}`, severity: 'MEDIUM', description: `The offer says it is from ${claimed.key.toUpperCase()}, but the contact email uses ${domain}. Confirm through ${claimed.domains[0]} before replying.`, evidenceSnippet: email, matchedKeywords: [domain, claimed.key] });
    } else {
      checks.push({ id: `contact-unknown-${domain}`, area: 'Contact', label: `Email domain ${domain}`, status: 'info', detail: 'Not a well-known domain. Check that it belongs to the company (visit the site yourself).' });
    }
  }
  if (emails.size === 0) {
    checks.push({ id: 'contact-none', area: 'Contact', label: 'Contact email', status: 'info', detail: 'No email address was found in the offer.' });
  }

  // --- checkWebsite: URLs in the text + the website field ---
  const urlInputs: { raw: string; fromField: boolean }[] = [];
  if (input.website && input.website.trim()) urlInputs.push({ raw: input.website, fromField: true });
  for (const u of entities.urls) urlInputs.push({ raw: u, fromField: false });
  const seenHosts = new Set<string>();
  for (const { raw, fromField } of urlInputs.slice(0, 6)) {
    const p = parseHost(raw);
    if (!p || seenHosts.has(p.host)) continue;
    seenHosts.add(p.host);
    const host = p.host.replace(/^www\./, '');
    checkedDomains.add(host);
    const label = `Website ${host}`;
    const lookalike = findLookalike(host, claimed);
    const isShort = matchesHostList(host, URL_SHORTENERS);
    const isGeneric = matchesHostList(host, GENERIC_PAGE_HOSTS) || /(^|\.)docs\.google\.com$/.test(host) && /\/forms/i.test(p.raw);

    if (isIpHost(host)) {
      checks.push({ id: `web-ip-${host}`, area: 'Website', label, status: 'fail', detail: 'The link points to a raw IP address instead of a company name.' });
      addFlag({ id: `company-ip-${host}`, label: 'Link Goes to a Raw IP Address', severity: 'HIGH', description: 'Real companies use their own domain name. A raw number address is typical of throw-away scam sites.', evidenceSnippet: p.raw, matchedKeywords: [host] });
    } else if (host.split('.').some(l => l.startsWith('xn--'))) {
      checks.push({ id: `web-idn-${host}`, area: 'Website', label, status: 'fail', detail: 'The address uses disguised (punycode) letters that can imitate a real brand.' });
      addFlag({ id: `company-idn-${host}`, label: 'Link Uses Disguised Look-alike Letters', severity: 'HIGH', description: 'Addresses starting "xn--" can imitate a famous brand with foreign letters that look the same.', evidenceSnippet: p.raw, matchedKeywords: [host] });
    } else if (lookalike) {
      checks.push({ id: `web-lookalike-${host}`, area: 'Website', label, status: 'fail', detail: `Looks like a copy of ${lookalike.key.toUpperCase()}'s website address, but it is not an official domain.` });
      addFlag({ id: `company-weblookalike-${host}`, label: `Fake Look-alike Website (${host})`, severity: 'CRITICAL', description: `The address ${host} imitates ${lookalike.key.toUpperCase()} but is not an official ${lookalike.key.toUpperCase()} domain.`, evidenceSnippet: p.raw, matchedKeywords: [host] });
    } else if (isShort) {
      checks.push({ id: `web-short-${host}`, area: 'Website', label, status: 'warn', detail: 'A link shortener hides where the link really goes.' });
      addFlag({ id: `company-short-${host}`, label: 'Hidden Destination (Shortened Link)', severity: 'MEDIUM', description: 'Shortened links hide the real website. Ask for the full company link instead.', evidenceSnippet: p.raw, matchedKeywords: [host] });
    } else if (isGeneric) {
      checks.push({ id: `web-generic-${host}`, area: 'Website', label, status: 'warn', detail: 'A free form, chat or page-builder link, not a company website.' });
      addFlag({ id: `company-generic-${host}`, label: 'Application Through a Generic Page, Not a Company Website', severity: 'LOW', description: 'Real employers usually have their own careers page. Free form and chat links are easy to fake.', evidenceSnippet: p.raw, matchedKeywords: [host] });
    } else if (claimed && isOfficialDomain(host, claimed)) {
      officialMatches++;
      checks.push({ id: `web-official-${host}`, area: 'Website', label, status: 'pass', detail: `An official ${claimed.key.toUpperCase()} domain.` });
    } else if (SUSPICIOUS_TLDS.includes(tldOf(host))) {
      checks.push({ id: `web-tld-${host}`, area: 'Website', label, status: 'warn', detail: `Ends in ".${tldOf(host)}", an ending that is cheap and often used in scams.` });
      addFlag({ id: `company-webtld-${host}`, label: `Website Uses a Risky Domain Ending (.${tldOf(host)})`, severity: 'MEDIUM', description: `Sites ending in ".${tldOf(host)}" are cheap and common in scam campaigns.`, evidenceSnippet: p.raw, matchedKeywords: [host] });
    } else if (claimed) {
      checks.push({ id: `web-mismatch-${host}`, area: 'Website', label, status: 'warn', detail: `The offer names ${claimed.key.toUpperCase()}, but this site is not one of its official domains.` });
      addFlag({ id: `company-webmismatch-${host}`, label: `Website Does Not Match ${claimed.key.toUpperCase()}`, severity: 'MEDIUM', description: `The offer says it is from ${claimed.key.toUpperCase()}, but the link goes to ${host}.`, evidenceSnippet: p.raw, matchedKeywords: [host, claimed.key] });
    } else if (fromField && companyName) {
      const tokens = companyTokens(companyName);
      const hostFlat = host.replace(/[^a-z0-9]/g, '');
      if (tokens.length > 0 && !tokens.some(t => hostFlat.includes(t))) {
        checks.push({ id: `web-namemismatch-${host}`, area: 'Website', label, status: 'warn', detail: `The website name does not contain the company name "${companyName}".` });
        addFlag({ id: `company-namemismatch-${host}`, label: 'Website Name Does Not Match the Company Name', severity: 'MEDIUM', description: `You gave the company as "${companyName}", but the website is ${host}. Check that the site really belongs to the company.`, evidenceSnippet: p.raw, matchedKeywords: [host, companyName] });
      } else {
        checks.push({ id: `web-namematch-${host}`, area: 'Website', label, status: 'pass', detail: 'The website name fits the company name given.' });
      }
    } else {
      checks.push({ id: `web-unknown-${host}`, area: 'Website', label, status: 'info', detail: 'Not a well-known site. Type the address yourself and check the company page.' });
    }

    if (p.https === false && !isIpHost(host)) {
      checks.push({ id: `web-http-${host}`, area: 'Website', label: `Website ${host} (connection)`, status: 'warn', detail: 'The link does not use a secure (https) connection.' });
      addFlag({ id: `company-http-${host}`, label: 'Link Is Not Secure (http)', severity: 'LOW', description: 'Real recruitment sites use https. Never type personal details on an http page.', evidenceSnippet: p.raw, matchedKeywords: [host] });
    }
  }
  if (seenHosts.size === 0) {
    checks.push({ id: 'web-none', area: 'Website', label: 'Website', status: 'info', detail: 'No website link was found. Add the company website in the extra details for a stronger check.' });
  }

  // --- verdict ---
  const anyFail = checks.some(c => c.status === 'fail');
  const anyWarn = checks.some(c => c.status === 'warn');
  const gaveDetails = Boolean(companyName || input.website?.trim() || emails.size || seenHosts.size || claimed);
  let verdict: CompanyVerificationResult['verdict'];
  let summary: string;
  if (anyFail) {
    verdict = 'Suspicious';
    summary = 'Some contact or website details look fake or copied. Do not trust this sender until you confirm them on the real company website.';
  } else if (claimed && officialMatches > 0 && !anyWarn) {
    verdict = 'Verified';
    summary = `The contact and website details match the official domains of ${claimed.key.toUpperCase()}. Still confirm on their careers page before sharing documents.`;
  } else if (anyWarn) {
    verdict = 'Unverified';
    summary = 'We could not confirm this company. Some details do not match or look unusual. Check them yourself before replying.';
  } else if (!gaveDetails) {
    verdict = 'Not enough details';
    summary = 'No company name, email or website was available, so the company could not be checked.';
  } else {
    verdict = 'Unverified';
    summary = 'No fake details were found, but we also could not confirm this company. Visit its official website yourself before applying.';
  }

  return { verdict, summary, checks, flags, checkedDomains: Array.from(checkedDomains), onlineChecks: 'skipped' };
}

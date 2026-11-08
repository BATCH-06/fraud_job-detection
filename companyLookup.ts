// Live company-domain checks (server only): does the domain exist, and how old is it?
// New scam domains are usually only days or weeks old, so domain age is a strong signal.
// Every lookup has a short timeout and FAILS SAFE: if the network is unavailable the result is
// "could not be checked" and the company is NOT penalised.

import dns from 'dns/promises';
import type { CompanyVerificationResult, FlaggedIndicator, VerificationCheck } from './indicators.js';
import { FREE_EMAIL_PROVIDERS, KNOWN_COMPANIES, isOfficialDomain } from './companyChecks.js';

export interface DomainInfo {
  domain: string;
  resolves: boolean | null;   // true = exists, false = does not exist, null = could not tell
  ageDays: number | null;     // days since registration, null = unknown
}
export type DomainLookup = (domain: string) => Promise<DomainInfo>;

const TWO_LEVEL_TLDS = ['co.in', 'org.in', 'net.in', 'ac.in', 'edu.in', 'gov.in', 'nic.in', 'co.uk', 'org.uk', 'com.au', 'co.za'];
export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  return TWO_LEVEL_TLDS.includes(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// "Not found" from DNS is only trustworthy if DNS works at all. On a restricted network every lookup fails,
// so we first check that well-known domains resolve (the answer is remembered for 10 minutes).
let dnsHealth: { at: number; ok: boolean } | null = null;
async function dnsIsWorking(): Promise<boolean> {
  if (dnsHealth && Date.now() - dnsHealth.at < 10 * 60 * 1000) return dnsHealth.ok;
  let ok = false;
  for (const control of ['example.com', 'cloudflare.com', 'wikipedia.org']) {
    try { await withTimeout(dns.resolve4(control), 2500); ok = true; break; } catch { /* try the next one */ }
  }
  dnsHealth = { at: Date.now(), ok };
  return ok;
}
export const resetDnsHealthForTests = () => { dnsHealth = null; cache.clear(); };

const cache = new Map<string, { at: number; info: DomainInfo }>();
const CACHE_MS = 6 * 60 * 60 * 1000;

/** Real network lookup: DNS first, then the public RDAP registry for the registration date. */
export const lookupDomain: DomainLookup = async (domain: string) => {
  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.info;

  const info: DomainInfo = { domain, resolves: null, ageDays: null };

  // 1. Does the domain exist?
  try {
    await withTimeout(dns.resolve4(domain), 2500);
    info.resolves = true;
  } catch (e: any) {
    const code = e?.code as string | undefined;
    if (code === 'ENODATA' || code === 'ENOTFOUND') {
      try { await withTimeout(dns.resolveMx(domain), 2500); info.resolves = true; }
      catch (e2: any) { info.resolves = code === 'ENOTFOUND' && e2?.code === 'ENOTFOUND' && (await dnsIsWorking()) ? false : null; }
    } // other codes (timeout, no network) => unknown, not penalised
  }

  // 2. How old is the registration?
  if (info.resolves !== false) {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 3000);
      const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { signal: ac.signal, headers: { Accept: 'application/rdap+json' } });
      clearTimeout(timer);
      if (res.ok) {
        const data: any = await res.json();
        const reg = (data?.events || []).find((ev: any) => ev?.eventAction === 'registration');
        const t = reg?.eventDate ? Date.parse(reg.eventDate) : NaN;
        if (!Number.isNaN(t)) info.ageDays = Math.max(0, Math.floor((Date.now() - t) / 86400000));
      }
    } catch { /* unknown: not penalised */ }
  }

  cache.set(domain, { at: Date.now(), info });
  return info;
};

const isTrustedDomain = (d: string) => FREE_EMAIL_PROVIDERS.includes(d) || KNOWN_COMPANIES.some(c => isOfficialDomain(d, c));

/** Adds live DNS / domain-age results to an offline verification result. */
export async function addOnlineChecks(
  base: CompanyVerificationResult,
  lookup: DomainLookup = lookupDomain,
  enabled: boolean = process.env.COMPANY_VERIFY_ONLINE !== 'false'
): Promise<CompanyVerificationResult> {
  if (!enabled) return base;
  const domains = Array.from(new Set(base.checkedDomains.map(registrableDomain))).filter(d => d.includes('.') && !isTrustedDomain(d)).slice(0, 3);
  if (domains.length === 0) return base;

  const settled = await Promise.allSettled(domains.map(d => withTimeout(lookup(d), 5000)));
  const checks: VerificationCheck[] = [...base.checks];
  const flags: FlaggedIndicator[] = [...base.flags];
  let answered = 0;
  let addedFail = false;
  let addedWarn = false;

  settled.forEach((r, i) => {
    const d = domains[i];
    const info = r.status === 'fulfilled' ? r.value : null;
    const area: VerificationCheck['area'] = 'Website';
    if (!info || (info.resolves === null && info.ageDays === null)) {
      checks.push({ id: `live-unavailable-${d}`, area, label: `Live check: ${d}`, status: 'info', detail: 'Could not be checked online right now. This does not count against the company.' });
      return;
    }
    answered++;
    if (info.resolves === false) {
      addedFail = true;
      checks.push({ id: `live-nxdomain-${d}`, area, label: `Live check: ${d}`, status: 'fail', detail: 'This domain does not exist on the internet.' });
      flags.push({ category: 'COMPANY_VERIFICATION', id: `company-nxdomain-${d}`, label: 'Domain Does Not Exist', severity: 'HIGH', description: `The domain ${d} is not registered or not reachable. A real recruiter would have a working domain.`, evidenceSnippet: d, matchedKeywords: [d] });
    } else if (info.ageDays !== null && info.ageDays < 60) {
      addedFail = true;
      checks.push({ id: `live-age-${d}`, area, label: `Live check: ${d}`, status: 'fail', detail: `Registered only ${info.ageDays} day(s) ago. Scam sites are usually brand new.` });
      flags.push({ category: 'COMPANY_VERIFICATION', id: `company-newdomain-${d}`, label: `Brand-New Domain (${info.ageDays} days old)`, severity: 'HIGH', description: `The domain ${d} was registered only ${info.ageDays} day(s) ago. Genuine companies usually have older domains.`, evidenceSnippet: d, matchedKeywords: [d] });
    } else if (info.ageDays !== null && info.ageDays < 180) {
      addedWarn = true;
      checks.push({ id: `live-age-${d}`, area, label: `Live check: ${d}`, status: 'warn', detail: `Registered ${info.ageDays} days ago (less than 6 months).` });
      flags.push({ category: 'COMPANY_VERIFICATION', id: `company-younger-${d}`, label: `Very New Domain (${info.ageDays} days old)`, severity: 'MEDIUM', description: `The domain ${d} is less than six months old. Check the company carefully.`, evidenceSnippet: d, matchedKeywords: [d] });
    } else if (info.ageDays !== null) {
      checks.push({ id: `live-age-${d}`, area, label: `Live check: ${d}`, status: 'pass', detail: `Registered about ${Math.round(info.ageDays / 365 * 10) / 10} years ago and reachable.` });
    } else {
      checks.push({ id: `live-exists-${d}`, area, label: `Live check: ${d}`, status: 'info', detail: 'The domain exists. Its registration date could not be read.' });
    }
  });

  let verdict = base.verdict;
  let summary = base.summary;
  if (addedFail) {
    verdict = 'Suspicious';
    summary = 'Live checks found a problem with a domain used in this offer (it does not exist or is brand new). Do not trust this sender.';
  } else if (addedWarn && verdict === 'Verified') {
    verdict = 'Unverified';
  }
  const onlineChecks: CompanyVerificationResult['onlineChecks'] = answered === 0 ? 'unavailable' : answered === domains.length ? 'completed' : 'partial';
  return { ...base, verdict, summary, checks, flags, onlineChecks };
}

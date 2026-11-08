import { AnalysisResponse, AnalysisRecordItem, DatabaseStats } from '../types';
import { runHeuristicNLPAnalysis } from '../../server/nlpRules';
import { verifyCompanyOffline } from '../../server/companyChecks';
import { cleanText, extractEntities, looksLikeJobPosting, MAX_TEXT_LENGTH, MIN_TEXT_LENGTH } from '../../server/preprocess';

const LOCAL_STORAGE_KEY = 'scam_checker_records_v1';
const TOKEN_KEY = 'scam_checker_token_v1';

// History is kept per signed-in user, so two people sharing one browser never see each other's checks.
let currentStorageKey = LOCAL_STORAGE_KEY;
export function setStorageScope(userId: string | null): void {
  currentStorageKey = userId ? `${LOCAL_STORAGE_KEY}_user_${userId}` : LOCAL_STORAGE_KEY;
  inMemoryClientRecords = [];
}
export const getStorageKey = () => currentStorageKey;

// Sign-in token (sent with every API call when present)
let memoryToken: string | null = null;
export function getAuthToken(): string | null {
  try { return window.localStorage.getItem(TOKEN_KEY) || memoryToken; } catch { return memoryToken; }
}
export function setAuthToken(token: string | null): void {
  memoryToken = token;
  try { token ? window.localStorage.setItem(TOKEN_KEY, token) : window.localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
}

// Helper to safely parse JSON from a fetch response without crashing on HTML error pages
export async function safeFetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status?: number; data?: T; error?: string; isHtmlOrText?: boolean }> {
  try {
    const token = getAuthToken();
    const headers = { ...(options?.headers as Record<string, string> | undefined), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const res = await fetch(url, { ...options, headers });
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    // Check if the response is actually JSON
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: data?.error || 'Service temporarily unavailable.',
          isHtmlOrText: false
        };
      }
      return { ok: true, status: res.status, data, isHtmlOrText: false };
    }

    // It is an HTML or text error page (such as Vercel's "The page could not be found" 404)
    const textSnippet = (await res.text()).trim();
    console.warn(`[SafeFetch] ${url} returned non-JSON (${res.status}): ${textSnippet.slice(0, 120)}`);

    return {
      ok: false,
      status: res.status,
      error: res.status === 404
        ? 'The detection server endpoint was not found (404).'
        : 'Service temporarily unavailable.',
      isHtmlOrText: true
    };
  } catch (err: any) {
    console.warn(`[SafeFetch] Network error for ${url}:`, err);
    return {
      ok: false,
      error: 'Network connection issue or offline mode.',
      isHtmlOrText: false
    };
  }
}

// Memory fallback cache in case browser storage (localStorage) is blocked, in private mode, or iframe-restricted
let inMemoryClientRecords: AnalysisRecordItem[] = [];

// Convert any AnalysisResponse into a complete AnalysisRecordItem for history display & storage
export function convertResponseToRecordItem(
  data: AnalysisResponse,
  rawTextFallback: string,
  metadataFallback?: {
    companyName?: string;
    jobTitle?: string;
    senderInfo?: string;
    channel?: string;
    salary?: string;
    website?: string;
  }
): AnalysisRecordItem {
  const flags = Array.isArray(data.heuristicEngine?.flags) ? data.heuristicEngine.flags : [];
  const recommendations = Array.isArray(data.finalVerdict?.recommendations)
    ? data.finalVerdict.recommendations
    : [];

  return {
    id: data.recordId || `check-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: data.timestamp || new Date().toISOString(),
    job_title: metadataFallback?.jobTitle || data.metadata?.jobTitle || 'Job / Internship Offer',
    company_name:
      metadataFallback?.companyName ||
      data.metadata?.companyName ||
      (data.heuristicEngine?.extractedEntities?.emails?.[0]
        ? `From: ${data.heuristicEngine.extractedEntities.emails[0]}`
        : 'Unspecified Company'),
    sender_info:
      metadataFallback?.senderInfo ||
      data.metadata?.senderInfo ||
      data.heuristicEngine?.extractedEntities?.emails?.join(', ') ||
      'Direct message',
    channel: metadataFallback?.channel || data.metadata?.channel || 'Direct Message',
    salary: metadataFallback?.salary || data.metadata?.salary || '',
    website: metadataFallback?.website || data.metadata?.website || '',
    company_verification: data.companyVerification ?? null,
    risk_category: data.finalVerdict?.riskCategory || 'Suspicious',
    risk_score: typeof data.finalVerdict?.riskScore === 'number' ? data.finalVerdict.riskScore : 50,
    heuristic_score: data.heuristicEngine?.score ?? data.finalVerdict?.riskScore ?? 50,
    model_score: data.aiModelEngine?.isAvailable ? data.aiModelEngine.confidenceScore ?? null : null,
    summary: data.finalVerdict?.summary || 'Analysis completed.',
    raw_text: data.raw_text || rawTextFallback || '',
    flags,
    recommendations,
    model_verdict: data.aiModelEngine?.isAvailable ? data.aiModelEngine : null,
    is_starred: data.finalVerdict?.riskCategory === 'Fraudulent' ? 1 : 0
  };
}

// Client-side analysis fallback (runs 100% in the browser when the server cannot be reached).
// It uses the same rule engine and the same offline company checks as the server.
export function runClientSideAnalysis(payload: {
  text: string;
  companyName?: string;
  jobTitle?: string;
  senderInfo?: string;
  channel?: string;
  salary?: string;
  website?: string;
}): { response: AnalysisResponse; recordItem: AnalysisRecordItem } | { error: string } {
  const { text, companyName, jobTitle, senderInfo, channel, salary, website } = payload;
  const metadata = { companyName, jobTitle, senderInfo, channel, salary, website };

  const cleaned = cleanText(text);
  if (cleaned.length < MIN_TEXT_LENGTH) return { error: `Please paste at least a couple of sentences (minimum ${MIN_TEXT_LENGTH} letters) so we can check it.` };
  if (cleaned.length > MAX_TEXT_LENGTH) return { error: `The text is too long. Please paste at most ${MAX_TEXT_LENGTH.toLocaleString('en-US')} characters.` };

  const verification = verifyCompanyOffline({ text: cleaned, companyName, website, senderInfo, entities: extractEntities(cleaned) });
  const heuristicResult = runHeuristicNLPAnalysis(cleaned, metadata, verification.flags);
  if (heuristicResult.flags.length === 0 && !looksLikeJobPosting(cleaned).isJobLike) {
    return { error: 'This text does not look like a job or internship offer, so we cannot judge it. Please paste the full message you received (the role, pay, contact details and what they ask you to do).' };
  }
  const finalCategory = heuristicResult.riskCategory;
  const finalScore = heuristicResult.heuristicScore;

  let finalSummary: string;
  if (finalCategory === 'Fraudulent') {
    finalSummary = 'High Risk: We found serious warning signs in this advertisement (such as requests for fees or suspicious contact methods). Never send money to secure a job.';
  } else if (finalCategory === 'Suspicious') {
    finalSummary = 'Needs Careful Checking: Some details look unusual or unverified. Please take extra care and verify the sender before sharing private details.';
  } else {
    finalSummary = 'Low Risk: No common scam warning signs were found in this text. It looks like standard, professional communication.';
  }

  const recordId = `check-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  const response: AnalysisResponse = {
    recordId,
    timestamp,
    finalVerdict: {
      riskCategory: finalCategory,
      riskScore: finalScore,
      summary: finalSummary,
      recommendations: heuristicResult.recommendations
    },
    heuristicEngine: {
      score: heuristicResult.heuristicScore,
      riskCategory: heuristicResult.riskCategory,
      flags: heuristicResult.flags,
      extractedEntities: heuristicResult.extractedEntities,
      heuristicSummary: heuristicResult.heuristicSummary
    },
    companyVerification: verification,
    aiModelEngine: {
      isAvailable: false,
      modelName: 'Built-in Rule Checker',
      note: 'Checked using built-in scam detection rules.'
    },
    metadata,
    raw_text: text
  };

  const recordItem = convertResponseToRecordItem(response, text, metadata);
  return { response, recordItem };
}

// Sanitize a parsed record item to ensure defensive runtime stability
function sanitizeRecordItem(item: any): AnalysisRecordItem | null {
  if (!item || typeof item !== 'object' || !item.id) return null;
  // Discard any fake demo records from history
  if (String(item.id).startsWith('scan-demo-')) return null;

  let parsedFlags: any[] = [];
  if (Array.isArray(item.flags)) {
    parsedFlags = item.flags;
  } else if (typeof item.flags === 'string') {
    try {
      const p = JSON.parse(item.flags);
      if (Array.isArray(p)) parsedFlags = p;
    } catch {}
  } else if (typeof item.flags_json === 'string') {
    try {
      const p = JSON.parse(item.flags_json);
      if (Array.isArray(p)) parsedFlags = p;
    } catch {}
  }

  let parsedRecommendations: string[] = [];
  if (Array.isArray(item.recommendations)) {
    parsedRecommendations = item.recommendations;
  } else if (typeof item.recommendations === 'string') {
    try {
      const p = JSON.parse(item.recommendations);
      if (Array.isArray(p)) parsedRecommendations = p;
    } catch {}
  } else if (typeof item.recommendations_json === 'string') {
    try {
      const p = JSON.parse(item.recommendations_json);
      if (Array.isArray(p)) parsedRecommendations = p;
    } catch {}
  }

  let parsedModelVerdict: any = item.model_verdict || null;
  if (!parsedModelVerdict && typeof item.model_verdict_json === 'string') {
    try {
      parsedModelVerdict = JSON.parse(item.model_verdict_json);
    } catch {}
  }

  return {
    id: String(item.id),
    timestamp: item.timestamp || new Date().toISOString(),
    job_title: String(item.job_title || 'Job / Internship Offer'),
    company_name: String(item.company_name || 'Unspecified Company'),
    sender_info: String(item.sender_info || 'Direct message'),
    channel: String(item.channel || 'Direct Message'),
    salary: String(item.salary || ''),
    website: String(item.website || ''),
    company_verification: item.company_verification && typeof item.company_verification === 'object' ? item.company_verification : null,
    risk_category: item.risk_category === 'Fraudulent' || item.risk_category === 'Suspicious' || item.risk_category === 'Genuine'
      ? item.risk_category
      : 'Suspicious',
    risk_score: Number(item.risk_score || 0),
    heuristic_score: Number(item.heuristic_score || item.risk_score || 0),
    model_score: typeof item.model_score === 'number' ? item.model_score : null,
    summary: String(item.summary || ''),
    raw_text: String(item.raw_text || ''),
    flags: parsedFlags,
    recommendations: parsedRecommendations,
    model_verdict: parsedModelVerdict,
    is_starred: item.is_starred ? 1 : 0
  };
}

// Get saved records: reads localStorage first, falls back to in-memory store
export function getLocalStorageRecords(): AnalysisRecordItem[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(currentStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const sanitized = parsed
            .map(sanitizeRecordItem)
            .filter((r): r is AnalysisRecordItem => r !== null)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          // Automatically purge any previously cached fake records from the browser disk
          if (sanitized.length !== parsed.length) {
            try {
              window.localStorage.setItem(currentStorageKey, JSON.stringify(sanitized));
            } catch {}
          }

          // Keep in-memory store synchronized
          inMemoryClientRecords = sanitized;
          return sanitized;
        }
      }
    }
  } catch (err) {
    console.warn('[Storage] Could not read from localStorage, using memory store:', err);
  }

  // Fallback to in-memory store (also strip any fake demo records)
  return [...inMemoryClientRecords]
    .filter(r => !String(r.id).startsWith('scan-demo-'))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export interface SaveRecordResult {
  success: boolean;
  persistedToDisk: boolean;
  error?: string;
}

// Save a single record: prepends to existing list, avoiding duplicates, and writes atomically
export function saveRecordToLocalStorage(record: AnalysisRecordItem): SaveRecordResult {
  const sanitized = sanitizeRecordItem(record);
  if (!sanitized) {
    return { success: false, persistedToDisk: false, error: 'Invalid record data.' };
  }

  // 1. Update in-memory store immediately
  inMemoryClientRecords = [sanitized, ...inMemoryClientRecords.filter((r) => r.id !== sanitized.id)].slice(0, 100);

  // 2. Persist to browser localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = getLocalStorageRecords();
      const updated = [sanitized, ...existing.filter((r) => r.id !== sanitized.id)].slice(0, 100);
      window.localStorage.setItem(currentStorageKey, JSON.stringify(updated));
      return { success: true, persistedToDisk: true };
    }
    return {
      success: true,
      persistedToDisk: false,
      error: 'Browser storage is unavailable; record is kept for this session.'
    };
  } catch (e: any) {
    console.warn('[Storage] Failed to write to localStorage:', e);
    return {
      success: true,
      persistedToDisk: false,
      error: 'Your browser storage is restricted or full; saved in memory for this session.'
    };
  }
}

// Save all records atomically in one operation (no repeated write loops)
export function saveAllRecordsToLocalStorage(records: AnalysisRecordItem[]): boolean {
  const sanitized = records
    .map(sanitizeRecordItem)
    .filter((r): r is AnalysisRecordItem => r !== null)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 100);

  inMemoryClientRecords = sanitized;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(currentStorageKey, JSON.stringify(sanitized));
      return true;
    }
    return false;
  } catch (e) {
    console.warn('[Storage] Failed to save all records to localStorage:', e);
    return false;
  }
}

export function deleteLocalStorageRecord(id: string): void {
  inMemoryClientRecords = inMemoryClientRecords.filter((r) => r.id !== id);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = getLocalStorageRecords();
      const updated = existing.filter((r) => r.id !== id);
      window.localStorage.setItem(currentStorageKey, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('[Storage] Could not delete from localStorage:', e);
  }
}

export function clearAllLocalStorageRecords(): void {
  inMemoryClientRecords = [];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(currentStorageKey);
    }
  } catch (e) {
    console.warn('[Storage] Could not clear localStorage:', e);
  }
}

export function toggleLocalStorageStar(id: string): void {
  inMemoryClientRecords = inMemoryClientRecords.map((r) =>
    r.id === id ? { ...r, is_starred: r.is_starred ? 0 : 1 } : r
  );
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = getLocalStorageRecords();
      const updated = existing.map((r) =>
        r.id === id ? { ...r, is_starred: r.is_starred ? 0 : 1 } : r
      );
      window.localStorage.setItem(currentStorageKey, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('[Storage] Could not update bookmark in localStorage:', e);
  }
}

export function computeLocalStats(records: AnalysisRecordItem[]): DatabaseStats {
  const counts = { Genuine: 0, Suspicious: 0, Fraudulent: 0 };
  let totalScore = 0;

  records.forEach((r) => {
    if (counts[r.risk_category] !== undefined) {
      counts[r.risk_category]++;
    }
    totalScore += r.risk_score || 0;
  });

  return {
    totalScans: records.length,
    categoryCounts: counts,
    avgRiskScore: records.length > 0 ? Math.round(totalScore / records.length) : 0
  };
}

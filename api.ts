// One API implementation shared by the Express server (server.ts) and the Vercel functions (api/*.ts).
// Keeping a single copy removes the old differences between local and deployed behaviour.

import crypto from 'crypto';
import {
  initDb, insertRecord, getRecords, getRecordById, deleteRecord, clearRecordsForUser, toggleStar, getDatabaseStats,
  createUser, getUserByEmail, listUsers, updateUser, deleteUser, countAdmins, getUserById,
  addDatasetItem, listDataset, deleteDatasetItem, adminOverview, AnalysisRecord, UserRow, DatasetRow,
  isPersistentStorage, STORAGE_LOCATION
} from './db.js';
import { hashPassword, verifyPassword, signToken, getAuthUser, publicUser, ensureAdminSeed, hitLimit, clearLimit } from './auth.js';
import { analyzeJobPosting } from './analysisService.js';
import { runHeuristicNLPAnalysis } from './nlpRules.js';
import { verifyCompanyOffline } from './companyChecks.js';
import { cleanText, looksLikeJobPosting, MAX_TEXT_LENGTH } from './preprocess.js';
import type { DomainLookup } from './companyLookup.js';

export interface ApiRequest {
  method: string;
  path: string;
  query: Record<string, string | undefined>;
  body: any;
  headers: Record<string, string | undefined>;
  ip: string;
}
export interface ApiResult { status: number; body?: any; text?: string; contentType?: string; headers?: Record<string, string>; }

const json = (status: number, body: any): ApiResult => ({ status, body });
const err = (status: number, error: string): ApiResult => json(status, { error });
const CATEGORIES = ['Genuine', 'Suspicious', 'Fraudulent'] as const;
type Category = typeof CATEGORIES[number];
const isCategory = (v: any): v is Category => CATEGORIES.includes(v);
const RATE_LIMIT_PER_MIN = () => Math.max(1, Number(process.env.RATE_LIMIT_PER_MIN) || 60);

// test hook: lets the test-suite replace the live DNS / domain-age lookup
let lookupOverride: DomainLookup | undefined;
export const setLookupOverride = (fn?: DomainLookup) => { lookupOverride = fn; };

let ready: Promise<void> | null = null;
function ensureReady() {
  if (!ready) ready = initDb().then(() => { ensureAdminSeed(); });
  return ready;
}

const safeParse = (s: string | null | undefined, fallback: any) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

function formatRecord(r: AnalysisRecord, asAdmin = false) {
  const { flags_json, recommendations_json, model_verdict_json, company_verification_json, user_id, user_email, ...rest } = r;
  return {
    ...rest,
    flags: safeParse(flags_json, []),
    recommendations: safeParse(recommendations_json, []),
    model_verdict: safeParse(model_verdict_json, null),
    company_verification: safeParse(company_verification_json, null),
    ...(asAdmin ? { user_id, user_email: user_email || null } : {})
  };
}

// ---------- validation ----------
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@.]{2,}$/;
const ID_RE = /^[A-Za-z0-9._:-]{1,100}$/;

function textField(v: any, name: string, max: number, fallback: string): { ok: true; value: string } | { ok: false; error: string } {
  if (v === undefined || v === null || v === '') return { ok: true, value: fallback };
  if (typeof v !== 'string') return { ok: false, error: `"${name}" must be text.` };
  if (v.length > max) return { ok: false, error: `"${name}" is too long (maximum ${max} characters).` };
  return { ok: true, value: v };
}

function validateRecord(body: any): { ok: true; rec: Omit<AnalysisRecord, 'user_id'> } | { ok: false; error: string } {
  const r = body?.record ?? body;
  if (!r || typeof r !== 'object' || Array.isArray(r)) return { ok: false, error: 'A record object is required.' };
  if (typeof r.id !== 'string' || !ID_RE.test(r.id)) return { ok: false, error: 'Valid record data with an id (letters, numbers, . _ : -) is required.' };
  if (!isCategory(r.risk_category)) return { ok: false, error: 'risk_category must be Genuine, Suspicious or Fraudulent.' };
  const num = (v: any) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
  if (!num(r.risk_score)) return { ok: false, error: 'risk_score must be a number from 0 to 100.' };
  if (r.heuristic_score !== undefined && !num(r.heuristic_score)) return { ok: false, error: 'heuristic_score must be a number from 0 to 100.' };
  if (r.model_score !== undefined && r.model_score !== null && !num(r.model_score)) return { ok: false, error: 'model_score must be a number from 0 to 100 or null.' };
  if (typeof r.raw_text !== 'string' || r.raw_text.trim().length === 0) return { ok: false, error: 'raw_text is required.' };
  if (r.raw_text.length > MAX_TEXT_LENGTH * 2) return { ok: false, error: 'raw_text is too long.' };

  const fields: Record<string, string> = {};
  for (const [key, max, def] of [['job_title', 200, 'Job / Internship Offer'], ['company_name', 200, 'Unspecified Company'], ['sender_info', 300, 'Direct message'], ['channel', 100, 'Direct Message'], ['salary', 100, ''], ['website', 300, ''], ['summary', 1000, '']] as [string, number, string][]) {
    const t = textField(r[key], key, max, def);
    if (!t.ok) return t;
    fields[key] = t.value;
  }
  const arr = (v: any, name: string, max: number) => {
    const val = typeof v === 'string' ? safeParse(v, null) : v ?? [];
    if (!Array.isArray(val) || val.length > max) return { ok: false as const, error: `${name} must be a list of at most ${max} items.` };
    return { ok: true as const, value: val };
  };
  const flags = arr(r.flags ?? r.flags_json, 'flags', 100); if (!flags.ok) return flags;
  const recs = arr(r.recommendations ?? r.recommendations_json, 'recommendations', 50); if (!recs.ok) return recs;
  if (!recs.value.every((x: any) => typeof x === 'string')) return { ok: false, error: 'recommendations must be a list of text.' };
  const obj = (v: any, name: string) => (v === undefined || v === null) ? { ok: true as const, value: null } : (typeof v === 'object' && !Array.isArray(v)) ? { ok: true as const, value: v } : { ok: false as const, error: `${name} must be an object.` };
  const mv = obj(r.model_verdict, 'model_verdict'); if (!mv.ok) return mv;
  const cv = obj(r.company_verification, 'company_verification'); if (!cv.ok) return cv;

  const ts = typeof r.timestamp === 'string' && !Number.isNaN(Date.parse(r.timestamp)) ? new Date(r.timestamp).toISOString() : new Date().toISOString();
  return {
    ok: true,
    rec: {
      id: r.id, timestamp: ts,
      job_title: fields.job_title, company_name: fields.company_name, sender_info: fields.sender_info, channel: fields.channel, salary: fields.salary, website: fields.website,
      risk_category: r.risk_category, risk_score: Math.round(r.risk_score), heuristic_score: Math.round(r.heuristic_score ?? r.risk_score),
      model_score: r.model_score === undefined || r.model_score === null ? null : Math.round(r.model_score),
      summary: fields.summary, raw_text: r.raw_text,
      flags_json: JSON.stringify(flags.value), recommendations_json: JSON.stringify(recs.value),
      model_verdict_json: mv.value ? JSON.stringify(mv.value) : null, company_verification_json: cv.value ? JSON.stringify(cv.value) : null,
      is_starred: r.is_starred ? 1 : 0
    }
  };
}

/** Stops spreadsheet programs from running text that starts with = + - @ as a formula. */
const csvCell = (v: any): string => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
const friendlyRisk = (c: string) => c === 'Fraudulent' ? 'High Risk' : c === 'Suspicious' ? 'Needs Careful Checking' : 'Low Risk';

// ---------- the dispatcher ----------
export async function handleApi(req: ApiRequest): Promise<ApiResult> {
  try { await ensureReady(); } catch (e) { console.error('[Storage] Database could not start:', e); return err(503, 'The database could not be started. Please try again shortly.'); }

  let p = (req.path.replace(/\/+$/, '') || '/');
  if (p === '/api/auth' && req.query.action) p = `/api/auth/${req.query.action}`;
  if (p === '/api/admin' && req.query.resource) p = `/api/admin/${req.query.resource}`;
  const m = req.method.toUpperCase();
  if (m === 'OPTIONS') return { status: 204 };

  try {
    const hist = /^\/api\/history\/([^/]+?)(?:\/(star))?$/.exec(p);
    switch (true) {
      case p === '/api/system-status': return m === 'GET' ? systemStatus() : notAllowed('GET');
      case p === '/api/stats': return m === 'GET' ? stats(req) : notAllowed('GET');
      case p === '/api/analyze': return m === 'POST' ? await analyze(req) : notAllowed('POST');
      case p === '/api/export': return m === 'GET' ? exportHistory(req) : notAllowed('GET');
      case p === '/api/auth/register': return m === 'POST' ? register(req) : notAllowed('POST');
      case p === '/api/auth/login': return m === 'POST' ? login(req) : notAllowed('POST');
      case p === '/api/auth/me': return m === 'GET' ? me(req) : notAllowed('GET');
      case p === '/api/history' || !!hist: return history(req, m, hist ? decodeURIComponent(hist[1]) : req.query.id, !!hist?.[2]);
      case p.startsWith('/api/admin/'): return admin(req, m, p.slice('/api/admin/'.length));
      default: return err(404, 'This API address does not exist.');
    }
  } catch (e) {
    console.error('[API] Unexpected error:', e);
    return err(500, 'Sorry, something went wrong on our side. Please try again in a few moments.');
  }
}

const notAllowed = (allow: string): ApiResult => ({ status: 405, body: { error: `Method not allowed. Use ${allow}.` }, headers: { Allow: allow } });

function systemStatus(): ApiResult {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  return json(200, {
    status: 'operational',
    environment: process.env.VERCEL ? 'vercel' : (process.env.NODE_ENV || 'development'),
    database: { engine: 'Saved Information Storage', status: 'Ready', storage: STORAGE_LOCATION, persistent: isPersistentStorage },
    nlpEngine: {
      status: 'Active', rulesCount: 8,
      categories: ['Fee Demands', 'Unrealistic Salaries', 'Rushed Deadlines', 'Suspicious Contact Methods', 'Private Data Requests', 'Missing Interview Steps', 'Suspicious Payment Methods', 'Unusual Text Formatting']
    },
    companyVerification: { status: 'Active', liveChecks: process.env.COMPANY_VERIFY_ONLINE !== 'false' },
    accounts: { enabled: true, adminConfigured: Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) },
    aiModel: { modelName: 'Detection System', keyConfigured: hasKey, mode: hasKey ? 'Smart Scam Detection Active' : 'Basic Rule Checker Active' }
  });
}

function stats(req: ApiRequest): ApiResult {
  const user = getAuthUser(req.headers);
  return json(200, getDatabaseStats(user?.id ?? null));
}

async function analyze(req: ApiRequest): Promise<ApiResult> {
  if (hitLimit(`analyze:${req.ip}`, RATE_LIMIT_PER_MIN(), 60_000)) return err(429, 'Too many checks in a short time. Please wait a minute and try again.');
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return err(400, 'Please send the advertisement as JSON: {"text": "..."}.');
  const user = getAuthUser(req.headers);
  return await analyzeJobPosting({ text: body.text, details: body }, { userId: user?.id ?? null, lookup: lookupOverride });
}

// ---------- accounts ----------
function register(req: ApiRequest): ApiResult {
  if (hitLimit(`register:${req.ip}`, Math.max(1, Number(process.env.REGISTER_LIMIT_PER_HOUR) || 10), 60 * 60_000)) return err(429, 'Too many sign-up attempts. Please try again later.');
  const b = req.body || {};
  const name = typeof b.name === 'string' ? cleanText(b.name) : '';
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  if (name.length < 2 || name.length > 60) return err(400, 'Please enter your name (2 to 60 characters).');
  if (!EMAIL_RE.test(email)) return err(400, 'Please enter a valid email address.');
  if (password.length < 8 || password.length > 128) return err(400, 'Password must be 8 to 128 characters long.');
  if (getUserByEmail(email)) return err(409, 'An account with this email already exists. Please sign in.');
  const user: UserRow = { id: `usr-${crypto.randomUUID()}`, name, email, password_hash: hashPassword(password), role: 'student', disabled: 0, created_at: new Date().toISOString() };
  createUser(user);
  return json(201, { token: signToken(user), user: publicUser(user) });
}

function login(req: ApiRequest): ApiResult {
  const b = req.body || {};
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const key = `login:${req.ip}:${email}`;
  if (hitLimit(key, 8, 15 * 60_000)) return err(429, 'Too many sign-in attempts. Please wait 15 minutes and try again.');
  const user = email ? getUserByEmail(email) : null;
  // always do the hashing work so that timing does not reveal whether the email exists
  const ok = verifyPassword(password, user?.password_hash ?? 'scrypt$00$00') && !!user;
  if (!ok || !user) return err(401, 'Incorrect email or password.');
  if (user.disabled) return err(403, 'This account has been disabled. Please contact the administrator.');
  clearLimit(key);
  return json(200, { token: signToken(user), user: publicUser(user) });
}

function me(req: ApiRequest): ApiResult {
  const user = getAuthUser(req.headers);
  return user ? json(200, { user: publicUser(user) }) : err(401, 'Please sign in.');
}

// ---------- history (private to the signed-in user) ----------
function history(req: ApiRequest, m: string, id: string | undefined, starRoute: boolean): ApiResult {
  const user = getAuthUser(req.headers);
  if (!user) return err(401, 'Please sign in to use saved history on the server. (Without signing in, your history stays in this browser.)');

  if (m === 'GET') {
    if (id) {
      const r = getRecordById(id);
      if (!r || r.user_id !== user.id) return err(404, 'We could not find this saved record.');
      return json(200, { record: formatRecord(r) });
    }
    const records = getRecords({ userId: user.id, search: req.query.search, category: req.query.category });
    return json(200, { records: records.map(r => formatRecord(r)) });
  }
  if (m === 'POST') {
    const v = validateRecord(req.body);
    if (!v.ok) return err(400, v.error);
    const existing = getRecordById(v.rec.id);
    if (existing && existing.user_id !== user.id) return err(409, 'This record id is already used.');
    insertRecord({ ...v.rec, user_id: user.id });
    return json(200, { success: true, id: v.rec.id });
  }
  if (m === 'DELETE') {
    if (!id && (req.query.clearAll === 'true' || req.body?.clearAll === true)) {
      const n = clearRecordsForUser(user.id);
      return json(200, { success: true, message: 'All your records were cleared.', deleted: n });
    }
    if (!id) return err(400, 'Record ID is required for deletion.');
    return deleteRecord(id, user.id) ? json(200, { success: true, message: 'Record deleted successfully.' }) : err(404, 'We could not find this saved record.');
  }
  if (m === 'PATCH' && (id || starRoute)) {
    if (!id) return err(400, 'Record ID is required.');
    return toggleStar(id, user.id) ? json(200, { success: true }) : err(404, 'We could not find this saved record.');
  }
  return notAllowed('GET, POST, PATCH, DELETE');
}

function exportHistory(req: ApiRequest): ApiResult {
  const user = getAuthUser(req.headers);
  if (!user) return err(401, 'Please sign in to export your saved history.');
  const records = getRecords({ userId: user.id });
  if ((req.query.format || 'json') === 'csv') {
    const rows = [['ID', 'Date Checked', 'Job Title', 'Company', 'Where Received', 'Risk Level', 'Estimated Risk Score', 'Details'].map(csvCell).join(',')];
    for (const r of records) rows.push([r.id, r.timestamp, r.job_title, r.company_name, r.channel, friendlyRisk(r.risk_category), r.risk_score, r.summary].map(csvCell).join(','));
    return { status: 200, text: rows.join('\n'), contentType: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="job_checks_summary.csv"' } };
  }
  return { status: 200, text: JSON.stringify(records.map(r => formatRecord(r)), null, 2), contentType: 'application/json; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="job_checks_summary.json"' } };
}

// ---------- admin: monitor results, manage users, manage dataset ----------
function admin(req: ApiRequest, m: string, resource: string): ApiResult {
  const me_ = getAuthUser(req.headers);
  if (!me_) return err(401, 'Please sign in.');
  if (me_.role !== 'admin') return err(403, 'Administrator access is required.');

  switch (resource) {
    case 'overview':
      return m === 'GET' ? json(200, adminOverview()) : notAllowed('GET');

    case 'results': {
      if (m !== 'GET') return notAllowed('GET');
      const limit = req.query.limit ? Number(req.query.limit) : 200;
      const rows = getRecords({ all: true, search: req.query.search, category: req.query.category, limit: Number.isFinite(limit) ? limit : 200 });
      return json(200, { records: rows.map(r => formatRecord(r, true)) });
    }

    case 'label': {   // review a monitored result and add it to the dataset with a confirmed label
      if (m !== 'POST') return notAllowed('POST');
      const { id, label } = req.body || {};
      if (typeof id !== 'string' || !isCategory(label)) return err(400, 'Send the record id and a label (Genuine, Suspicious or Fraudulent).');
      const rec = getRecordById(id);
      if (!rec) return err(404, 'We could not find this saved record.');
      const newId = addDatasetItem(rec.raw_text, label, `Reviewed from result ${id}`, me_.id);
      return json(201, { success: true, id: newId });
    }

    case 'users': {
      if (m === 'GET') return json(200, { users: listUsers() });
      const id = req.query.id;
      if (!id) return err(400, 'User id is required.');
      const target = getUserById(id);
      if (!target) return err(404, 'User not found.');
      if (target.id === me_.id) return err(400, 'You cannot change or delete your own account here.');
      const lastAdmin = target.role === 'admin' && !target.disabled && countAdmins() <= 1;
      if (m === 'PATCH') {
        const b = req.body || {};
        const patch: { role?: 'student' | 'admin'; disabled?: boolean } = {};
        if (b.role !== undefined) { if (b.role !== 'student' && b.role !== 'admin') return err(400, 'role must be student or admin.'); patch.role = b.role; }
        if (b.disabled !== undefined) { if (typeof b.disabled !== 'boolean') return err(400, 'disabled must be true or false.'); patch.disabled = b.disabled; }
        if (!Object.keys(patch).length) return err(400, 'Nothing to change.');
        if (lastAdmin && (patch.role === 'student' || patch.disabled === true)) return err(400, 'At least one active administrator must remain.');
        updateUser(id, patch);
        return json(200, { success: true });
      }
      if (m === 'DELETE') {
        if (lastAdmin) return err(400, 'At least one active administrator must remain.');
        deleteUser(id);
        return json(200, { success: true });
      }
      return notAllowed('GET, PATCH, DELETE');
    }

    case 'dataset': {
      if (m === 'GET') return json(200, { items: listDataset() });
      if (m === 'POST') {
        const { text, label, source } = req.body || {};
        if (typeof text !== 'string' || cleanText(text).length < 20 || text.length > MAX_TEXT_LENGTH) return err(400, `Dataset text must be 20 to ${MAX_TEXT_LENGTH} characters.`);
        if (!isCategory(label)) return err(400, 'label must be Genuine, Suspicious or Fraudulent.');
        const src = typeof source === 'string' && source.trim() ? source.trim().slice(0, 200) : 'Added by administrator';
        return json(201, { success: true, id: addDatasetItem(text.trim(), label, src, me_.id) });
      }
      if (m === 'DELETE') {
        const id = Number(req.query.id);
        if (!Number.isInteger(id)) return err(400, 'Dataset item id is required.');
        return deleteDatasetItem(id) ? json(200, { success: true }) : err(404, 'Dataset item not found.');
      }
      return notAllowed('GET, POST, DELETE');
    }

    case 'dataset-export': {
      if (m !== 'GET') return notAllowed('GET');
      const items = listDataset();
      if ((req.query.format || 'json') === 'csv') {
        const rows = [['id', 'label', 'source', 'created_at', 'text'].map(csvCell).join(',')];
        for (const i of items) rows.push([i.id, i.label, i.source, i.created_at, i.text].map(csvCell).join(','));
        return { status: 200, text: rows.join('\n'), contentType: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="scam_dataset.csv"' } };
      }
      return { status: 200, text: JSON.stringify(items, null, 2), contentType: 'application/json; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="scam_dataset.json"' } };
    }

    case 'dataset-evaluate': {   // measure the rule engine against the labelled dataset
      if (m !== 'POST') return notAllowed('POST');
      return json(200, evaluateDataset(listDataset()));
    }

    default:
      return err(404, 'This API address does not exist.');
  }
}

export function evaluateDataset(items: DatasetRow[]) {
  const labels = ['Genuine', 'Suspicious', 'Fraudulent', 'Unassessable'] as const;
  const matrix: Record<string, Record<string, number>> = {};
  for (const a of CATEGORIES) { matrix[a] = {}; for (const b of labels) matrix[a][b] = 0; }
  const mismatches: any[] = [];
  let correct = 0;
  for (const item of items) {
    const text = cleanText(item.text);
    const ver = verifyCompanyOffline({ text });
    const h = runHeuristicNLPAnalysis(text, undefined, ver.flags);
    const predicted: string = h.flags.length === 0 && !looksLikeJobPosting(text).isJobLike ? 'Unassessable' : h.riskCategory;
    matrix[item.label][predicted]++;
    if (predicted === item.label) correct++;
    else if (mismatches.length < 50) mismatches.push({ id: item.id, expected: item.label, predicted, score: h.heuristicScore, flags: h.flags.map(f => f.label).slice(0, 4), preview: item.text.slice(0, 140) });
  }
  return {
    engine: 'Rule-based engine only (no AI call is made)',
    total: items.length, correct,
    accuracy: items.length ? Math.round((correct / items.length) * 1000) / 10 : null,
    confusionMatrix: matrix, mismatches
  };
}

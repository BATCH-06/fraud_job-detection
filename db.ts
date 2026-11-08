import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

export interface AnalysisRecord {
  id: string;
  timestamp: string;
  job_title: string;
  company_name: string;
  sender_info: string;
  channel: string;
  salary: string;
  website: string;
  risk_category: 'Genuine' | 'Suspicious' | 'Fraudulent';
  risk_score: number;
  heuristic_score: number;
  model_score: number | null;
  summary: string;
  raw_text: string;
  flags_json: string;
  recommendations_json: string;
  model_verdict_json: string | null;
  company_verification_json: string | null;
  is_starred: number;
  user_id: string | null;
  user_email?: string | null; // only filled for admin listings
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'student' | 'admin';
  disabled: number;
  created_at: string;
}

export interface DatasetRow {
  id: number;
  text: string;
  label: 'Genuine' | 'Suspicious' | 'Fraudulent';
  source: string;
  added_by: string | null;
  created_at: string;
}

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isVercel ? path.join('/tmp', 'data') : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'scam_detection.db');

/** false on serverless hosts such as Vercel, where files are erased between runs */
export const isPersistentStorage = !isVercel;
export const STORAGE_LOCATION = isVercel ? '/tmp/data (temporary)' : 'data/scam_detection.db';

export function initDb(): Promise<Database> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
    catch (err) { console.warn('[Storage] Could not create the data folder; data will not be saved to disk:', err); }

    const SQL = await initSqlJs();
    let database: Database;
    if (fs.existsSync(DB_FILE)) {
      try { database = new SQL.Database(fs.readFileSync(DB_FILE)); }
      catch (err) { console.warn('[Storage] Could not read the existing database file, starting a new one:', err); database = new SQL.Database(); }
    } else {
      database = new SQL.Database();
    }
    db = database;

    db.run(`
      CREATE TABLE IF NOT EXISTS analysis_records (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        job_title TEXT,
        company_name TEXT,
        sender_info TEXT,
        channel TEXT,
        risk_category TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        heuristic_score INTEGER NOT NULL,
        model_score INTEGER,
        summary TEXT,
        raw_text TEXT NOT NULL,
        flags_json TEXT NOT NULL,
        recommendations_json TEXT NOT NULL,
        model_verdict_json TEXT,
        is_starred INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        disabled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS dataset (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        label TEXT NOT NULL,
        source TEXT,
        added_by TEXT,
        created_at TEXT NOT NULL
      );
    `);
    // Upgrade databases created by the earlier version of the project
    const have = new Set(all<{ name: string }>('PRAGMA table_info(analysis_records)').map(c => c.name));
    const addCol = (name: string, ddl: string) => { if (!have.has(name)) db!.run(`ALTER TABLE analysis_records ADD COLUMN ${name} ${ddl}`); };
    addCol('user_id', 'TEXT');
    addCol('salary', 'TEXT');
    addCol('website', 'TEXT');
    addCol('company_verification_json', 'TEXT');
    db.run('CREATE INDEX IF NOT EXISTS idx_records_user ON analysis_records(user_id)');
    saveDb();
    return db;
  })();
  return initPromise;
}

function saveDb() {
  if (!db) return;
  try { fs.writeFileSync(DB_FILE, Buffer.from(db.export())); }
  catch (err) { console.warn('[Storage] Could not write the database file (temporary storage?):', err); }
}

function all<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error('Database is not ready');
  const stmt = db.prepare(sql);
  try {
    if (params.length) stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally { stmt.free(); }
}
function one<T = any>(sql: string, params: any[] = []): T | null { return all<T>(sql, params)[0] ?? null; }
function exec(sql: string, params: any[] = []): number {
  if (!db) throw new Error('Database is not ready');
  db.run(sql, params);
  const changed = db.getRowsModified();
  saveDb();
  return changed;
}
const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => '\\' + m);

// ---------------- analysis records ----------------
/** Insert or update a record. Errors are thrown (never hidden) so callers can report them. */
export function insertRecord(r: AnalysisRecord): void {
  exec(
    `INSERT OR REPLACE INTO analysis_records (
      id, timestamp, job_title, company_name, sender_info, channel, salary, website,
      risk_category, risk_score, heuristic_score, model_score, summary,
      raw_text, flags_json, recommendations_json, model_verdict_json, company_verification_json, is_starred, user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [r.id, r.timestamp, r.job_title, r.company_name, r.sender_info, r.channel, r.salary ?? '', r.website ?? '',
      r.risk_category, r.risk_score, r.heuristic_score, r.model_score, r.summary,
      r.raw_text, r.flags_json, r.recommendations_json, r.model_verdict_json, r.company_verification_json ?? null, r.is_starred, r.user_id ?? null]
  );
}

export interface RecordQuery { userId?: string | null; all?: boolean; search?: string; category?: string; limit?: number; }

export function getRecords(q: RecordQuery = {}): AnalysisRecord[] {
  const where: string[] = [];
  const params: any[] = [];
  if (!q.all) {
    if (!q.userId) return [];               // guests have no server-side history
    where.push('r.user_id = ?'); params.push(q.userId);
  }
  if (q.category && q.category !== 'ALL') { where.push('r.risk_category = ?'); params.push(q.category); }
  if (q.search && q.search.trim()) {
    const term = `%${escapeLike(q.search.trim())}%`;
    where.push("(r.job_title LIKE ? ESCAPE '\\' OR r.company_name LIKE ? ESCAPE '\\' OR r.sender_info LIKE ? ESCAPE '\\' OR r.raw_text LIKE ? ESCAPE '\\')");
    params.push(term, term, term, term);
  }
  const limit = Math.min(Math.max(Math.floor(q.limit || 500), 1), 2000);
  return all<AnalysisRecord>(
    `SELECT r.*, u.email AS user_email FROM analysis_records r LEFT JOIN users u ON u.id = r.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.timestamp DESC LIMIT ${limit}`, params
  );
}

export function getRecordById(id: string): AnalysisRecord | null {
  return one<AnalysisRecord>('SELECT r.*, u.email AS user_email FROM analysis_records r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ?', [id]);
}

/** Delete one record. When userId is given, only that user's own record can be deleted. */
export function deleteRecord(id: string, userId?: string | null): boolean {
  return (userId === undefined ? exec('DELETE FROM analysis_records WHERE id = ?', [id]) : exec('DELETE FROM analysis_records WHERE id = ? AND user_id = ?', [id, userId])) > 0;
}
export function clearRecordsForUser(userId: string): number {
  return exec('DELETE FROM analysis_records WHERE user_id = ?', [userId]);
}
export function toggleStar(id: string, userId: string): boolean {
  return exec('UPDATE analysis_records SET is_starred = CASE WHEN is_starred = 1 THEN 0 ELSE 1 END WHERE id = ? AND user_id = ?', [id, userId]) > 0;
}

function statsFrom(rows: { risk_category: string; c: number; a: number }[]) {
  const categoryCounts: Record<string, number> = { Genuine: 0, Suspicious: 0, Fraudulent: 0 };
  let total = 0, weighted = 0;
  for (const r of rows) { categoryCounts[r.risk_category] = (categoryCounts[r.risk_category] || 0) + r.c; total += r.c; weighted += r.a * r.c; }
  return { totalScans: total, categoryCounts, avgRiskScore: total ? Math.round(weighted / total) : 0 };
}
export function getDatabaseStats(userId?: string | null, all_ = false) {
  if (!all_ && !userId) return statsFrom([]);
  const rows = all<{ risk_category: string; c: number; a: number }>(
    `SELECT risk_category, COUNT(*) AS c, AVG(risk_score) AS a FROM analysis_records ${all_ ? '' : 'WHERE user_id = ?'} GROUP BY risk_category`, all_ ? [] : [userId]);
  return statsFrom(rows);
}

// ---------------- users ----------------
export function createUser(u: UserRow): void {
  exec('INSERT INTO users (id, name, email, password_hash, role, disabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [u.id, u.name, u.email.toLowerCase(), u.password_hash, u.role, u.disabled, u.created_at]);
}
export const getUserByEmail = (email: string) => one<UserRow>('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
export const getUserById = (id: string) => one<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
export function listUsers() {
  return all<Omit<UserRow, 'password_hash'> & { scans: number }>(
    `SELECT u.id, u.name, u.email, u.role, u.disabled, u.created_at,
       (SELECT COUNT(*) FROM analysis_records r WHERE r.user_id = u.id) AS scans
     FROM users u ORDER BY u.created_at DESC`);
}
export const countAdmins = () => Number(one<{ c: number }>("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND disabled = 0")?.c || 0);
export function updateUser(id: string, patch: { role?: 'student' | 'admin'; disabled?: boolean }): boolean {
  let changed = 0;
  if (patch.role) changed += exec('UPDATE users SET role = ? WHERE id = ?', [patch.role, id]);
  if (patch.disabled !== undefined) changed += exec('UPDATE users SET disabled = ? WHERE id = ?', [patch.disabled ? 1 : 0, id]);
  return changed > 0;
}
export function deleteUser(id: string): boolean {
  exec('DELETE FROM analysis_records WHERE user_id = ?', [id]);
  return exec('DELETE FROM users WHERE id = ?', [id]) > 0;
}
export function setUserPassword(id: string, hash: string): void { exec('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]); }

// ---------------- dataset (admin) ----------------
export function addDatasetItem(text: string, label: DatasetRow['label'], source: string, addedBy: string | null): number {
  exec('INSERT INTO dataset (text, label, source, added_by, created_at) VALUES (?, ?, ?, ?, ?)', [text, label, source, addedBy, new Date().toISOString()]);
  return Number(one<{ id: number }>('SELECT last_insert_rowid() AS id')?.id);
}
export const listDataset = () => all<DatasetRow>('SELECT * FROM dataset ORDER BY id DESC LIMIT 5000');
export const deleteDatasetItem = (id: number) => exec('DELETE FROM dataset WHERE id = ?', [id]) > 0;

// ---------------- admin overview ----------------
export function adminOverview() {
  const total = getDatabaseStats(null, true);
  const users = Number(one<{ c: number }>('SELECT COUNT(*) AS c FROM users')?.c || 0);
  const guest = Number(one<{ c: number }>('SELECT COUNT(*) AS c FROM analysis_records WHERE user_id IS NULL')?.c || 0);
  const dataset = Number(one<{ c: number }>('SELECT COUNT(*) AS c FROM dataset')?.c || 0);
  const perDay = all<{ day: string; c: number }>(
    "SELECT substr(timestamp, 1, 10) AS day, COUNT(*) AS c FROM analysis_records GROUP BY day ORDER BY day DESC LIMIT 7");
  return { ...total, users, guestScans: guest, datasetSize: dataset, lastSevenDays: perDay.reverse() };
}

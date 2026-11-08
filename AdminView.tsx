import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Users, Database, BarChart3, Download, Trash2, RefreshCw, Play, Plus } from 'lucide-react';
import { safeFetchJson, getAuthToken } from '../utils/clientAnalyzer';
import type { AnalysisRecordItem } from '../types';

type Tab = 'overview' | 'results' | 'users' | 'dataset';
type Category = 'Genuine' | 'Suspicious' | 'Fraudulent';

interface AdminRecord extends AnalysisRecordItem { user_email?: string | null; user_id?: string | null; }
interface AdminUser { id: string; name: string; email: string; role: 'student' | 'admin'; disabled: number; created_at: string; scans: number; }
interface DatasetItem { id: number; text: string; label: Category; source: string; created_at: string; }
interface Overview { totalScans: number; categoryCounts: Record<string, number>; avgRiskScore: number; users: number; guestScans: number; datasetSize: number; lastSevenDays: { day: string; c: number }[]; }
interface Evaluation { engine: string; total: number; correct: number; accuracy: number | null; confusionMatrix: Record<string, Record<string, number>>; mismatches: { id: number; expected: string; predicted: string; score: number; flags: string[]; preview: string }[]; }

const card = 'rounded-xl border border-cyan-500/20 bg-slate-950/60 p-4';
const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50';
const btnPrimary = `${btn} border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10`;
const btnDanger = `${btn} border-rose-500/40 text-rose-300 hover:bg-rose-500/10`;
const field = 'px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-cyan-500/25 text-xs text-slate-100 focus:outline-none focus:border-cyan-400';
const badge = (c: string) => c === 'Fraudulent' ? 'bg-rose-500/15 text-rose-300 border-rose-500/40' : c === 'Suspicious' ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
const friendly = (c: string) => c === 'Fraudulent' ? 'High Risk' : c === 'Suspicious' ? 'Suspicious' : 'Low Risk';

async function downloadWithToken(path: string, filename: string) {
  const token = getAuthToken();
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) return;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export const AdminView: React.FC<{ currentUserId: string }> = ({ currentUserId }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [message, setMessage] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [results, setResults] = useState<AdminRecord[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [dataset, setDataset] = useState<DatasetItem[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [labels, setLabels] = useState<Record<string, Category>>({});
  const [newText, setNewText] = useState('');
  const [newLabel, setNewLabel] = useState<Category>('Fraudulent');
  const [expanded, setExpanded] = useState<string | null>(null);

  const say = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 4000); };

  const loadOverview = useCallback(async () => { const r = await safeFetchJson<Overview>('/api/admin?resource=overview'); if (r.ok && r.data) setOverview(r.data); else if (r.error) say(r.error); }, []);
  const loadResults = useCallback(async () => {
    const q = new URLSearchParams({ resource: 'results', ...(search ? { search } : {}), ...(category !== 'ALL' ? { category } : {}) });
    const r = await safeFetchJson<{ records: AdminRecord[] }>(`/api/admin?${q}`);
    if (r.ok && r.data) setResults(r.data.records); else if (r.error) say(r.error);
  }, [search, category]);
  const loadUsers = useCallback(async () => { const r = await safeFetchJson<{ users: AdminUser[] }>('/api/admin?resource=users'); if (r.ok && r.data) setUsers(r.data.users); }, []);
  const loadDataset = useCallback(async () => { const r = await safeFetchJson<{ items: DatasetItem[] }>('/api/admin?resource=dataset'); if (r.ok && r.data) setDataset(r.data.items); }, []);

  useEffect(() => {
    if (tab === 'overview') loadOverview();
    if (tab === 'results') loadResults();
    if (tab === 'users') loadUsers();
    if (tab === 'dataset') loadDataset();
  }, [tab, loadOverview, loadResults, loadUsers, loadDataset]);

  const addToDataset = async (rec: AdminRecord) => {
    const label = labels[rec.id] || (rec.risk_category as Category);
    const r = await safeFetchJson('/api/admin?resource=label', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rec.id, label }) });
    say(r.ok ? `Added to the dataset as ${label}.` : r.error || 'Could not add it.');
  };
  const patchUser = async (u: AdminUser, body: object) => {
    const r = await safeFetchJson(`/api/admin?resource=users&id=${encodeURIComponent(u.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    say(r.ok ? 'User updated.' : r.error || 'Could not update the user.'); loadUsers();
  };
  const removeUser = async (u: AdminUser) => {
    if (!window.confirm(`Delete ${u.email} and all of their saved checks? This cannot be undone.`)) return;
    const r = await safeFetchJson(`/api/admin?resource=users&id=${encodeURIComponent(u.id)}`, { method: 'DELETE' });
    say(r.ok ? 'User deleted.' : r.error || 'Could not delete the user.'); loadUsers();
  };
  const addItem = async () => {
    const r = await safeFetchJson('/api/admin?resource=dataset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: newText, label: newLabel, source: 'Added by administrator' }) });
    if (r.ok) { setNewText(''); say('Added to the dataset.'); loadDataset(); } else say(r.error || 'Could not add this text.');
  };
  const removeItem = async (id: number) => { const r = await safeFetchJson(`/api/admin?resource=dataset&id=${id}`, { method: 'DELETE' }); say(r.ok ? 'Removed.' : r.error || 'Could not remove it.'); loadDataset(); };
  const evaluate = async () => { const r = await safeFetchJson<Evaluation>('/api/admin?resource=dataset-evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); if (r.ok && r.data) setEvaluation(r.data); else say(r.error || 'Could not run the evaluation.'); };

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 }, { id: 'results', label: 'Monitor Results', icon: Activity },
    { id: 'users', label: 'Manage Users', icon: Users }, { id: 'dataset', label: 'Manage Dataset', icon: Database }
  ];

  return (
    <div className="space-y-5" data-testid="admin-view">
      <div>
        <h2 className="text-2xl font-bold text-white">Administrator Console</h2>
        <p className="text-sm text-slate-400">Monitor detection results, manage user accounts, and manage the labelled scam dataset.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map(t => { const Icon = t.icon; return (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`${btn} ${tab === t.id ? 'border-cyan-400/60 bg-cyan-500/15 text-white' : 'border-slate-700 text-slate-300 hover:text-white'}`}>
            <Icon className="w-3.5 h-3.5" /> {t.label}
          </button>); })}
      </div>

      {message && <div role="status" className="text-xs px-3 py-2 rounded-lg border border-cyan-500/30 bg-cyan-950/30 text-cyan-100">{message}</div>}

      {tab === 'overview' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {overview ? (<>
            <div className={card}><div className="text-xs text-slate-400">Total checks</div><div className="text-2xl font-bold text-white" data-testid="ov-total">{overview.totalScans}</div></div>
            <div className={card}><div className="text-xs text-slate-400">Registered users</div><div className="text-2xl font-bold text-white" data-testid="ov-users">{overview.users}</div></div>
            <div className={card}><div className="text-xs text-slate-400">Guest checks</div><div className="text-2xl font-bold text-white">{overview.guestScans}</div></div>
            <div className={card}><div className="text-xs text-slate-400">Dataset size</div><div className="text-2xl font-bold text-white">{overview.datasetSize}</div></div>
            <div className={`${card} sm:col-span-2`}>
              <div className="text-xs text-slate-400 mb-2">Checks by result (average risk score {overview.avgRiskScore})</div>
              <div className="flex gap-2 flex-wrap">{(['Genuine', 'Suspicious', 'Fraudulent'] as Category[]).map(c => <span key={c} className={`px-2.5 py-1 rounded-lg border text-xs ${badge(c)}`}>{friendly(c)}: {overview.categoryCounts[c] || 0}</span>)}</div>
            </div>
            <div className={`${card} sm:col-span-2`}>
              <div className="text-xs text-slate-400 mb-2">Checks in the last days</div>
              <div className="flex gap-3 flex-wrap text-xs text-slate-200">{overview.lastSevenDays.length ? overview.lastSevenDays.map(d => <span key={d.day}>{d.day}: <b>{d.c}</b></span>) : <span className="text-slate-500">No checks yet.</span>}</div>
            </div>
          </>) : <p className="text-sm text-slate-400">Loading…</p>}
        </div>
      )}

      {tab === 'results' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div><label htmlFor="adm-search" className="block text-[11px] text-slate-400 mb-1">Search</label><input id="adm-search" className={field} value={search} onChange={e => setSearch(e.target.value)} placeholder="title, company, text…" /></div>
            <div><label htmlFor="adm-cat" className="block text-[11px] text-slate-400 mb-1">Result</label>
              <select id="adm-cat" className={field} value={category} onChange={e => setCategory(e.target.value)}><option value="ALL">All</option><option value="Fraudulent">High Risk</option><option value="Suspicious">Suspicious</option><option value="Genuine">Low Risk</option></select></div>
            <button className={btnPrimary} onClick={loadResults}><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          </div>
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-xs text-left" data-testid="results-table">
              <thead className="text-slate-400"><tr><th className="py-2 pr-3">Time</th><th className="pr-3">User</th><th className="pr-3">Offer</th><th className="pr-3">Result</th><th className="pr-3">Score</th><th>Review</th></tr></thead>
              <tbody>
                {results.length === 0 && <tr><td colSpan={6} className="py-4 text-slate-500">No results yet.</td></tr>}
                {results.map(r => (
                  <React.Fragment key={r.id}>
                    <tr className="border-t border-slate-800 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-300">{new Date(r.timestamp).toLocaleString()}</td>
                      <td className="pr-3 text-slate-300">{r.user_email || 'Guest'}</td>
                      <td className="pr-3 max-w-[260px]"><button className="text-left text-cyan-200 hover:underline" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>{r.job_title} <span className="text-slate-500">· {r.company_name}</span></button></td>
                      <td className="pr-3"><span className={`px-2 py-0.5 rounded border ${badge(r.risk_category)}`}>{friendly(r.risk_category)}</span></td>
                      <td className="pr-3 text-slate-200">{r.risk_score}</td>
                      <td className="whitespace-nowrap">
                        <select aria-label={`Label for ${r.id}`} className={field} value={labels[r.id] || r.risk_category} onChange={e => setLabels({ ...labels, [r.id]: e.target.value as Category })}><option value="Genuine">Genuine</option><option value="Suspicious">Suspicious</option><option value="Fraudulent">Fraudulent</option></select>
                        <button className={`${btnPrimary} ml-1.5`} onClick={() => addToDataset(r)}><Plus className="w-3 h-3" /> Dataset</button>
                      </td>
                    </tr>
                    {expanded === r.id && <tr><td colSpan={6} className="pb-3 text-slate-300"><pre className="whitespace-pre-wrap break-words bg-slate-900/70 rounded-lg p-3 text-[11px]">{r.raw_text}</pre></td></tr>}
                  </React.Fragment>))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-xs text-left" data-testid="users-table">
            <thead className="text-slate-400"><tr><th className="py-2 pr-3">Name</th><th className="pr-3">Email</th><th className="pr-3">Role</th><th className="pr-3">Status</th><th className="pr-3">Checks</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => { const self = u.id === currentUserId; return (
                <tr key={u.id} className="border-t border-slate-800">
                  <td className="py-2 pr-3 text-slate-200">{u.name}{self && <span className="text-slate-500"> (you)</span>}</td>
                  <td className="pr-3 text-slate-300">{u.email}</td><td className="pr-3 text-slate-300">{u.role}</td>
                  <td className="pr-3">{u.disabled ? <span className="text-rose-300">Disabled</span> : <span className="text-emerald-300">Active</span>}</td>
                  <td className="pr-3 text-slate-300">{u.scans}</td>
                  <td className="space-x-1.5 whitespace-nowrap">
                    <button className={btnPrimary} disabled={self} onClick={() => patchUser(u, { role: u.role === 'admin' ? 'student' : 'admin' })}>{u.role === 'admin' ? 'Make student' : 'Make admin'}</button>
                    <button className={btnPrimary} disabled={self} onClick={() => patchUser(u, { disabled: !u.disabled })}>{u.disabled ? 'Enable' : 'Disable'}</button>
                    <button className={btnDanger} disabled={self} onClick={() => removeUser(u)}><Trash2 className="w-3 h-3" /> Delete</button>
                  </td>
                </tr>); })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'dataset' && (
        <div className="space-y-4">
          <div className={card}>
            <h3 className="text-sm font-semibold text-white mb-2">Add a labelled example</h3>
            <label htmlFor="ds-text" className="block text-[11px] text-slate-400 mb-1">Job offer text</label>
            <textarea id="ds-text" className={`${field} w-full min-h-[90px]`} value={newText} onChange={e => setNewText(e.target.value)} maxLength={10000} />
            <div className="flex flex-wrap items-end gap-2 mt-2">
              <div><label htmlFor="ds-label" className="block text-[11px] text-slate-400 mb-1">Label</label>
                <select id="ds-label" className={field} value={newLabel} onChange={e => setNewLabel(e.target.value as Category)}><option value="Genuine">Genuine</option><option value="Suspicious">Suspicious</option><option value="Fraudulent">Fraudulent</option></select></div>
              <button className={btnPrimary} onClick={addItem} disabled={newText.trim().length < 20}><Plus className="w-3.5 h-3.5" /> Add</button>
              <span className="flex-1" />
              <button className={btnPrimary} onClick={() => downloadWithToken('/api/admin?resource=dataset-export&format=csv', 'scam_dataset.csv')}><Download className="w-3.5 h-3.5" /> CSV</button>
              <button className={btnPrimary} onClick={() => downloadWithToken('/api/admin?resource=dataset-export&format=json', 'scam_dataset.json')}><Download className="w-3.5 h-3.5" /> JSON</button>
              <button className={btnPrimary} onClick={evaluate} disabled={dataset.length === 0}><Play className="w-3.5 h-3.5" /> Test the detection rules on this dataset</button>
            </div>
          </div>

          {evaluation && (
            <div className={card} data-testid="evaluation">
              <h3 className="text-sm font-semibold text-white">Evaluation result</h3>
              <p className="text-xs text-slate-400 mb-2">{evaluation.engine}</p>
              <p className="text-sm text-white mb-2">Correct: <b>{evaluation.correct}</b> of <b>{evaluation.total}</b>{evaluation.accuracy !== null && <> ({evaluation.accuracy}%)</>}</p>
              <table className="text-xs text-left mb-2"><thead className="text-slate-400"><tr><th className="pr-4">Expected ↓ / Predicted →</th>{['Genuine', 'Suspicious', 'Fraudulent', 'Unassessable'].map(l => <th key={l} className="pr-4">{l}</th>)}</tr></thead>
                <tbody>{Object.entries(evaluation.confusionMatrix).map(([exp, row]) => <tr key={exp} className="border-t border-slate-800"><td className="pr-4 py-1 text-slate-200">{exp}</td>{['Genuine', 'Suspicious', 'Fraudulent', 'Unassessable'].map(l => <td key={l} className="pr-4 text-slate-200">{row[l] ?? 0}</td>)}</tr>)}</tbody></table>
              {evaluation.mismatches.length > 0 && <details className="text-xs text-slate-300"><summary className="cursor-pointer text-cyan-200">Show {evaluation.mismatches.length} wrong result(s)</summary>
                <ul className="mt-2 space-y-1.5">{evaluation.mismatches.map(m => <li key={m.id} className="border-l-2 border-rose-500/50 pl-2">#{m.id}: expected <b>{m.expected}</b>, got <b>{m.predicted}</b> (score {m.score}). <span className="text-slate-400">{m.preview}</span></li>)}</ul></details>}
            </div>
          )}

          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-xs text-left" data-testid="dataset-table">
              <thead className="text-slate-400"><tr><th className="py-2 pr-3">#</th><th className="pr-3">Label</th><th className="pr-3">Text</th><th className="pr-3">Source</th><th /></tr></thead>
              <tbody>
                {dataset.length === 0 && <tr><td colSpan={5} className="py-4 text-slate-500">The dataset is empty. Add examples above, or review results in "Monitor Results".</td></tr>}
                {dataset.map(i => <tr key={i.id} className="border-t border-slate-800 align-top"><td className="py-2 pr-3 text-slate-400">{i.id}</td><td className="pr-3"><span className={`px-2 py-0.5 rounded border ${badge(i.label)}`}>{i.label}</span></td><td className="pr-3 text-slate-200 max-w-[420px] truncate" title={i.text}>{i.text}</td><td className="pr-3 text-slate-400">{i.source}</td><td><button className={btnDanger} onClick={() => removeItem(i.id)} aria-label={`Delete dataset item ${i.id}`}><Trash2 className="w-3 h-3" /></button></td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

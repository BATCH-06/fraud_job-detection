import { CompanyVerificationCard } from './CompanyVerificationCard';
import React, { useState } from 'react';
import { 
  Search, 
  Trash2, 
  Eye, 
  Calendar, 
  Building2, 
  Clock, 
  X,
  FileSpreadsheet,
  FileJson,
  Bookmark,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Database,
  Lock,
  Terminal,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnalysisRecordItem, DatabaseStats } from '../types';

interface HistoryViewProps {
  records: AnalysisRecordItem[];
  stats: DatabaseStats | null;
  storageWarning?: string | null;
  user?: { name: string } | null;
  onRefresh: () => void;
  onDelete: (id: string) => Promise<void>;
  onClearAll?: () => Promise<void>;
  onToggleStar: (id: string) => Promise<void>;
  onGoToChecker?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  records,
  stats,
  storageWarning,
  user,
  onRefresh,
  onDelete,
  onClearAll,
  onToggleStar,
  onGoToChecker
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'Genuine' | 'Suspicious' | 'Fraudulent'>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecordItem | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter out any fake demo records defensively and sort newest first
  const sortedRecords = [...(records || [])]
    .filter(r => !String(r.id).startsWith('scan-demo-'))
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

  const filteredRecords = sortedRecords.filter((r) => {
    const matchesCategory = selectedCategory === 'ALL' || r.risk_category === selectedCategory;
    const matchesSearch =
      !searchTerm.trim() ||
      (r.job_title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.sender_info || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.raw_text || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this threat record?')) {
      setIsDeletingId(id);
      try {
        await onDelete(id);
      } finally {
        setIsDeletingId(null);
      }
    }
  };

  const getRiskTheme = (cat: 'Genuine' | 'Suspicious' | 'Fraudulent') => {
    switch (cat) {
      case 'Fraudulent':
        return {
          label: 'High Risk',
          textColor: 'text-rose-400',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          cardBorder: 'hover:border-rose-500/40',
          scoreColor: 'text-rose-400'
        };
      case 'Suspicious':
        return {
          label: 'Suspicious',
          textColor: 'text-amber-400',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          cardBorder: 'hover:border-amber-500/40',
          scoreColor: 'text-amber-400'
        };
      case 'Genuine':
        return {
          label: 'Low Risk',
          textColor: 'text-emerald-400',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          cardBorder: 'hover:border-emerald-500/40',
          scoreColor: 'text-emerald-400'
        };
    }
  };

  // CSV & JSON exports directly from genuine user records
  const handleExportCsv = () => {
    const headers = ['ID', 'Date Checked', 'Job Title', 'Company', 'Where Received', 'Risk Level', 'Threat Score', 'Details'];
    const csvRows = [headers.join(',')];

    for (const r of sortedRecords) {
      const friendlyRisk = r.risk_category === 'Fraudulent' ? 'High Risk' : r.risk_category === 'Suspicious' ? 'Suspicious' : 'Low Risk';
      const row = [
        `"${r.id}"`,
        `"${r.timestamp}"`,
        `"${(r.job_title || '').replace(/"/g, '""')}"`,
        `"${(r.company_name || '').replace(/"/g, '""')}"`,
        `"${(r.channel || '').replace(/"/g, '""')}"`,
        `"${friendlyRisk}"`,
        r.risk_score,
        `"${(r.summary || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat_audit_log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(sortedRecords, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat_audit_log_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to purge your entire check history? This action cannot be reversed.')) {
      if (onClearAll) {
        await onClearAll();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Storage Warning Banner */}
      {storageWarning && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2.5 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{storageWarning}</span>
        </div>
      )}

      {/* Header & Dashboard Stats Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 bg-[#090d24]/90 border border-cyan-500/25 shadow-[0_10px_35px_rgba(0,0,0,0.5)] backdrop-blur-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              <Database className="w-3 h-3 text-cyan-400" />
              <span>{user ? 'Your Account + This Browser' : 'This Browser Only'}</span>
            </span>
            <span className="text-xs font-mono text-slate-400">
              • {sortedRecords.length} {sortedRecords.length === 1 ? 'record' : 'records'} archived
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Security Audit History
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 font-normal">
            Review, inspect, or export all previous job offers and recruitment advertisements you have audited.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-cyan-500/20 hover:border-cyan-400/50"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {sortedRecords.length > 0 && (
            <>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-cyan-500/20 hover:border-cyan-400/50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                <span>CSV</span>
              </button>

              <button
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-cyan-500/20 hover:border-cyan-400/50"
              >
                <FileJson className="w-3.5 h-3.5 text-purple-400" />
                <span>JSON</span>
              </button>

              {onClearAll && (
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700/60 hover:border-rose-700/80 text-xs font-semibold transition-all"
                  title="Purge all audit records"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Filter and Search Bar */}
      {sortedRecords.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#090d24]/75 p-3.5 rounded-2xl border border-cyan-500/20 backdrop-blur-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search previous scans by job title, company, sender, or text content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#050816] border border-cyan-500/20 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['ALL', 'Fraudulent', 'Suspicious', 'Genuine'] as const).map((cat) => {
              const label = cat === 'ALL' ? 'All' : cat === 'Fraudulent' ? 'High Risk' : cat === 'Suspicious' ? 'Suspicious' : 'Low Risk';
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all whitespace-nowrap border ${
                    isActive
                      ? cat === 'Fraudulent' ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.3)]' :
                        cat === 'Suspicious' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]' :
                        cat === 'Genuine' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                        'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                      : 'bg-slate-900/60 text-slate-400 border-transparent hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Records List or Clean Zero-Fake Empty State */}
      {sortedRecords.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl p-10 sm:p-14 bg-[#090d24]/75 border border-cyan-500/20 text-center space-y-4 backdrop-blur-xl"
        >
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto shadow-[0_0_20px_rgba(56,189,248,0.2)]">
            <Clock className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-slate-100">
              No Previous Scans Stored
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Whenever you inspect a job offer or internship communication on the Home or Check a Job tab, 
              the full threat breakdown, warning indicators, and guidance are permanently saved to your device.
            </p>
          </div>

          {onGoToChecker && (
            <div className="pt-2">
              <button
                onClick={onGoToChecker}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:scale-[1.02]"
              >
                <span>Run Your First Security Check</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-2xl p-10 bg-[#090d24]/60 border border-cyan-500/15 text-center space-y-2">
          <p className="text-sm text-slate-300">No previous scans match your search criteria.</p>
          <button
            onClick={() => { setSearchTerm(''); setSelectedCategory('ALL'); }}
            className="text-xs text-cyan-400 hover:underline font-mono"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          <AnimatePresence>
            {filteredRecords.map((r, index) => {
              const theme = getRiskTheme(r.risk_category);
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
                  onClick={() => setSelectedRecord(r)}
                  className={`rounded-2xl p-4 sm:p-5 bg-[#090d24]/80 border border-cyan-500/15 ${theme.cardBorder} hover:shadow-[0_4px_25px_rgba(0,0,0,0.5)] cursor-pointer transition-all duration-200 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4 group`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${theme.badge}`}>
                        {theme.label}
                      </span>
                      <span className="text-xs font-mono text-slate-300">
                        Threat Score: <strong className={theme.scoreColor}>{r.risk_score}/100</strong>
                      </span>
                      <span className="text-slate-600 text-xs hidden sm:inline">•</span>
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {new Date(r.timestamp).toLocaleDateString()} at {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="text-sm sm:text-base font-bold text-white tracking-tight truncate group-hover:text-cyan-200 transition-colors">
                      {r.job_title || 'Job Advertisement'}
                    </h4>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                        {r.company_name || 'Unspecified Company'}
                      </span>
                      <span>•</span>
                      <span>Channel: {r.channel || 'Direct message'}</span>
                      {(r.flags || []).length > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-rose-400 font-mono font-semibold">
                            {(r.flags || []).length} Red Flag(s)
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-1 italic font-sans pt-0.5">
                      "{r.summary || 'Security analysis completed.'}"
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(r.id);
                      }}
                      className={`p-2 rounded-xl border transition-all ${
                        r.is_starred
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white hover:border-cyan-400'
                      }`}
                      title={r.is_starred ? 'Bookmarked' : 'Bookmark this record'}
                    >
                      <Bookmark className={`w-4 h-4 ${r.is_starred ? 'fill-amber-400' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRecord(r);
                      }}
                      className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold transition-all shadow-[0_0_12px_rgba(56,189,248,0.25)] border border-cyan-400/30"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Result</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(r.id, e)}
                      disabled={isDeletingId === r.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-700 text-xs font-semibold transition-all"
                      title="Delete Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* View Result Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#090d24] border border-cyan-500/30 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-[0_10px_50px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-cyan-500/15 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${getRiskTheme(selectedRecord.risk_category).badge}`}>
                    {getRiskTheme(selectedRecord.risk_category).label}
                  </span>
                  <span className="text-xs font-mono text-slate-300">
                    Threat Score: {selectedRecord.risk_score}/100
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {selectedRecord.job_title || 'Job / Internship Offer'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedRecord.company_name || 'Unspecified Company'} • Audited {new Date(selectedRecord.timestamp).toLocaleString()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary */}
            <div className="p-4 rounded-xl bg-[#050816] border border-cyan-500/20 space-y-1">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider block">
                Security Analysis Summary:
              </span>
              <p className="text-xs text-slate-200 leading-relaxed">
                {selectedRecord.summary || 'Threat analysis completed.'}
              </p>
            </div>

            <CompanyVerificationCard verification={selectedRecord.company_verification} compact />

            {/* Red Flags */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                Identified Threat Flags ({(selectedRecord.flags || []).length})
              </h4>
              {(selectedRecord.flags || []).length === 0 ? (
                <p className="text-xs text-emerald-400">Zero threat flags found in this communication.</p>
              ) : (
                <div className="space-y-2">
                  {(selectedRecord.flags || []).map((f, i) => (
                    <div key={i} className="p-3 rounded-xl bg-[#050816] border border-rose-500/30 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-300">{f.label}</span>
                      </div>
                      <p className="text-slate-300">{f.description}</p>
                      {f.evidenceSnippet && (
                        <p className="text-cyan-200/90 text-[11px] font-mono italic bg-[#0a0f28] p-2 rounded border border-cyan-500/15">
                          "{f.evidenceSnippet}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommendations */}
            {(selectedRecord.recommendations || []).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Defensive Protocol</span>
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-200 bg-[#050816] p-4 rounded-xl border border-cyan-500/20">
                  {(selectedRecord.recommendations || []).map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Raw Text */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Audited Text Payload</span>
              </h4>
              <div className="text-xs text-slate-300 bg-[#050816] p-3 rounded-xl border border-cyan-500/15 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                {selectedRecord.raw_text}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
              >
                Close Audit View
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

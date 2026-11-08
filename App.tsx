import React, { useState, useEffect } from 'react';
import { Header, NavTab } from './components/Header';
import { HomeView } from './components/HomeView';
import { Analyzer } from './components/Analyzer';
import { AnalysisResultView } from './components/AnalysisResultView';
import { HistoryView } from './components/HistoryView';
import { SafetyTipsView } from './components/SafetyTipsView';
import { AboutView } from './components/AboutView';
import { ReportModal } from './components/ReportModal';
import { AuthModal } from './components/AuthModal';
import { AdminView } from './components/AdminView';
import { 
  AnalysisResponse, 
  AnalysisRecordItem, 
  DatabaseStats,
  AuthUser,
  SystemStatus
} from './types';
import { 
  safeFetchJson, 
  runClientSideAnalysis, 
  convertResponseToRecordItem,
  getLocalStorageRecords, 
  saveRecordToLocalStorage,
  saveAllRecordsToLocalStorage,
  deleteLocalStorageRecord,
  clearAllLocalStorageRecords,
  toggleLocalStorageStar, 
  computeLocalStats,
  setStorageScope,
  getStorageKey,
  getAuthToken,
  setAuthToken
} from './utils/clientAnalyzer';
import { ShieldCheck, Lock, Terminal, Cpu, Zap, ArrowRight, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [currentResult, setCurrentResult] = useState<AnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Account state (guests can still check offers; signing in adds server-side history)
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [persistentStorage, setPersistentStorage] = useState<boolean>(true);

  // Saved records state
  const [records, setRecords] = useState<AnalysisRecordItem[]>([]);
  const [stats, setStats] = useState<DatabaseStats | null>(null);

  // Fetch and sync records from both local storage and server
  const fetchRecords = async () => {
    // 1. Immediately load local records (authoritative for client & deployed sites)
    const localRecords = getLocalStorageRecords();
    setRecords(localRecords);
    setStats(computeLocalStats(localRecords));

    if (!getAuthToken()) return; // guests keep their history in this browser only

    try {
      // 2. Signed-in users: also load their own saved checks from the server
      const historyResult = await safeFetchJson<{ records: AnalysisRecordItem[] }>('/api/history');

      if (historyResult.ok && Array.isArray(historyResult.data?.records)) {
        // Discard any fake demo records from server
        const serverRecords = historyResult.data.records.filter(
          (r) => !String(r.id).startsWith('scan-demo-')
        );

        if (serverRecords.length > 0) {
          // Merge without duplicates (favoring local for any un-synced checks)
          const recordMap = new Map<string, AnalysisRecordItem>();
          for (const loc of localRecords) {
            recordMap.set(loc.id, loc);
          }
          for (const srv of serverRecords) {
            if (!recordMap.has(srv.id)) {
              recordMap.set(srv.id, srv);
            }
          }

          const combined = Array.from(recordMap.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          setRecords(combined);
          setStats(computeLocalStats(combined));

          // Keep local storage in sync
          saveAllRecordsToLocalStorage(combined);
        }
      }
    } catch (err) {
      console.warn('Could not load remote records, using local storage:', err);
    }
  };

  useEffect(() => {
    // Restore an existing sign-in, then load history for that user (or the guest)
    (async () => {
      if (getAuthToken()) {
        const me = await safeFetchJson<{ user: AuthUser }>('/api/auth?action=me');
        if (me.ok && me.data?.user) {
          setUser(me.data.user);
          setStorageScope(me.data.user.id);
        } else if (me.status === 401) {
          setAuthToken(null); // expired or invalid sign-in
        }
      }
      await fetchRecords();
      setAuthReady(true);
      const st = await safeFetchJson<SystemStatus>('/api/system-status');
      if (st.ok && st.data?.database) setPersistentStorage(st.data.database.persistent !== false);
    })();

    // Listen for storage events across browser tabs on deployed websites
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === getStorageKey()) {
        const updated = getLocalStorageRecords();
        setRecords(updated);
        setStats(computeLocalStats(updated));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Handle scam analysis submission
  const handleAnalyze = async (payload: {
    text: string;
    companyName?: string;
    jobTitle?: string;
    senderInfo?: string;
    channel?: string;
    salary?: string;
    website?: string;
  }) => {
    setIsLoading(true);
    setError(null);

    let savedRecord: AnalysisRecordItem | null = null;
    let analysisResult: AnalysisResponse | null = null;
    let usedFallback = false;

    const runFallback = (): boolean => {
      const fallback = runClientSideAnalysis(payload);
      if ('error' in fallback) { setError(fallback.error); return false; }
      analysisResult = fallback.response;
      savedRecord = fallback.recordItem;
      usedFallback = true;
      return true;
    };

    try {
      // 1. Attempt server-side analysis
      const res = await safeFetchJson<AnalysisResponse>('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok && res.data) {
        analysisResult = res.data;
        // Convert to full record item
        savedRecord = convertResponseToRecordItem(res.data, payload.text, {
          companyName: payload.companyName,
          jobTitle: payload.jobTitle,
          senderInfo: payload.senderInfo,
          channel: payload.channel,
          salary: payload.salary,
          website: payload.website
        });
      } else if (res.status && [400, 413, 422, 429].includes(res.status)) {
        // The server understood the request and rejected it: show its message (no silent fallback)
        setError(res.error || 'Please check your text and try again.');
        setIsLoading(false);
        return;
      } else if (!runFallback()) {
        setIsLoading(false);
        return;
      }
    } catch (err: any) {
      console.warn('Server error, using built-in detection:', err);
      if (!runFallback()) {
        setIsLoading(false);
        return;
      }
    }

    if (savedRecord && analysisResult) {
      // Save directly into browser storage so history is NEVER lost across refreshes
      const saveResult = saveRecordToLocalStorage(savedRecord);
      if (!saveResult.persistedToDisk && saveResult.error) {
        setStorageWarning('Note: Your browser storage is restricted or disabled, so this check was saved in memory for this session.');
      } else {
        setStorageWarning(null);
      }

      // Update in-memory state immediately (newest first)
      setRecords((prev) => {
        const updated = [savedRecord!, ...prev.filter((r) => r.id !== savedRecord!.id)];
        return updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      });

      // Update statistics directly from updated records
      setStats(() => {
        const allRecords = getLocalStorageRecords();
        return computeLocalStats(allRecords);
      });

      // Signed-in users: if the check ran in the browser (server unreachable), save it to the account too.
      // Checks made through the server are already saved there.
      if (usedFallback && getAuthToken()) {
        safeFetchJson('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ record: savedRecord })
        }).catch(() => {});
      }

      setCurrentResult(analysisResult);
      setActiveTab('check');
    } else {
      setError('Unable to analyze this job offer. Please check your text and try again.');
    }

    setIsLoading(false);
  };

  // Sign in / out
  const handleAuthSuccess = async (token: string, signedIn: AuthUser) => {
    setAuthToken(token);
    setUser(signedIn);
    setStorageScope(signedIn.id);
    setAuthMode(null);
    setCurrentResult(null);
    await fetchRecords();
  };

  const handleLogout = async () => {
    setAuthToken(null);
    setUser(null);
    setStorageScope(null);
    setCurrentResult(null);
    if (activeTab === 'admin') setActiveTab('home');
    await fetchRecords();
  };

  // Delete saved record
  const handleDeleteRecord = async (id: string) => {
    try {
      // 1. Delete from browser storage
      deleteLocalStorageRecord(id);

      // 2. Delete from the signed-in user's server history if reachable
      if (getAuthToken()) safeFetchJson(`/api/history?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});

      // 3. Update React state immediately
      setRecords((prev) => {
        const updated = prev.filter((r) => r.id !== id);
        setStats(computeLocalStats(updated));
        return updated;
      });
    } catch (err) {
      console.error('Failed to delete record:', err);
    }
  };

  // Clear all saved records
  const handleClearAllHistory = async () => {
    try {
      clearAllLocalStorageRecords();
      setRecords([]);
      setStats(computeLocalStats([]));

      // Signed-in users: also clear THEIR OWN server history (never anyone else's)
      if (getAuthToken()) safeFetchJson('/api/history?clearAll=true', { method: 'DELETE' }).catch(() => {});
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  // Toggle bookmark on record
  const handleToggleStar = async (id: string) => {
    try {
      toggleLocalStorageStar(id);

      if (getAuthToken()) safeFetchJson(`/api/history?id=${encodeURIComponent(id)}`, { method: 'PATCH' }).catch(() => {});

      setRecords((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, is_starred: r.is_starred ? 0 : 1 } : r
        )
      );
    } catch (err) {
      console.error('Failed to update bookmark:', err);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#050816] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black overflow-x-hidden">
      
      {/* 1. Subtle Animated Blue-Purple Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Ambient Gradient Orbs */}
        <div className="absolute -top-40 -left-40 w-96 sm:w-[550px] h-96 sm:h-[550px] rounded-full bg-cyan-600/15 blur-[120px] animate-float-orb-1" />
        <div className="absolute top-1/3 -right-40 w-96 sm:w-[600px] h-96 sm:h-[600px] rounded-full bg-purple-600/15 blur-[140px] animate-float-orb-2" />
        <div className="absolute -bottom-40 left-1/3 w-96 sm:w-[500px] h-96 sm:h-[500px] rounded-full bg-blue-700/10 blur-[130px] animate-float-orb-1" />
        
        {/* Subtle Cyber Grid Mesh Pattern */}
        <div className="absolute inset-0 cyber-grid-bg opacity-70" />
      </div>

      {/* 2. Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setError(null);
        }}
        historyCount={records.length}
        user={user}
        onLoginClick={() => setAuthMode('login')}
        onRegisterClick={() => setAuthMode('register')}
        onLogout={handleLogout}
      />

      {/* 3. Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <AnimatePresence mode="wait">
          {/* TAB 1: HOME */}
          {activeTab === 'home' && (
            <motion.div
              key="home-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <HomeView
                onCheckJob={handleAnalyze}
                isLoading={isLoading}
                error={error}
                onNavigateToSafety={() => setActiveTab('safety')}
                onNavigateToAbout={() => setActiveTab('about')}
                onNavigateToHistory={() => setActiveTab('history')}
                historyCount={records.length}
              />
            </motion.div>
          )}

          {/* TAB 2: CHECK A JOB */}
          {activeTab === 'check' && (
            <motion.div
              key="check-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              {currentResult ? (
                <AnalysisResultView
                  result={currentResult}
                  onOpenReport={() => setShowReportModal(true)}
                  onReset={() => {
                    setCurrentResult(null);
                    setError(null);
                  }}
                  onToggleStar={handleToggleStar}
                  isStarred={records.find((r) => r.id === currentResult.recordId)?.is_starred === 1}
                />
              ) : (
                <Analyzer
                  onAnalyze={handleAnalyze}
                  isLoading={isLoading}
                  error={error}
                  onClear={() => {
                    setCurrentResult(null);
                    setError(null);
                  }}
                  currentResult={null}
                />
              )}
            </motion.div>
          )}

          {/* TAB 3: PAST HISTORY */}
          {activeTab === 'history' && (
            <motion.div
              key="history-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <HistoryView
                records={records}
                stats={stats}
                storageWarning={storageWarning}
                user={user}
                onRefresh={fetchRecords}
                onDelete={handleDeleteRecord}
                onClearAll={handleClearAllHistory}
                onToggleStar={handleToggleStar}
                onGoToChecker={() => {
                  setCurrentResult(null);
                  setActiveTab('check');
                }}
              />
            </motion.div>
          )}

          {/* ADMIN: monitor results, manage users, manage dataset */}
          {activeTab === 'admin' && authReady && (
            <motion.div
              key="admin-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {user?.role === 'admin' ? (
                <AdminView currentUserId={user.id} />
              ) : (
                <div className="max-w-xl mx-auto p-8 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-center text-slate-200">
                  <h2 className="text-lg font-bold text-white mb-2">Administrator access required</h2>
                  <p className="text-sm text-slate-300">Please sign in with an administrator account to open this page.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 4: THREAT INTEL / SAFETY TIPS */}
          {activeTab === 'safety' && (
            <motion.div
              key="safety-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <SafetyTipsView />
            </motion.div>
          )}

          {/* TAB 5: SYSTEM INFO / ABOUT US */}
          {activeTab === 'about' && (
            <motion.div
              key="about-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <AboutView
                onGoToChecker={() => {
                  setCurrentResult(null);
                  setActiveTab('check');
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Sign in / Register */}
      {authMode && (
        <AuthModal
          initialMode={authMode}
          persistentStorage={persistentStorage}
          onClose={() => setAuthMode(null)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {/* 4. Printable Security Report Modal */}
      {showReportModal && currentResult && (
        <ReportModal
          result={currentResult}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* 5. Professional Cybersecurity SaaS Footer */}
      <footer className="relative z-10 border-t border-cyan-500/15 bg-[#050816]/95 backdrop-blur-xl py-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-cyan-500/10 pb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.25)]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-white text-sm">
                  Fake Job &amp; Internship Scam Checker
                </span>
                <span className="block text-[11px] text-slate-400 font-mono">
                  Cyber Threat Intelligence Engine for Students &amp; Freshers
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <button 
                onClick={() => { setCurrentResult(null); setActiveTab('check'); }}
                className="text-slate-400 hover:text-cyan-300 transition-colors"
              >
                Scan Offer
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className="text-slate-400 hover:text-cyan-300 transition-colors"
              >
                Audit Log ({records.length})
              </button>
              <button 
                onClick={() => setActiveTab('safety')}
                className="text-slate-400 hover:text-cyan-300 transition-colors"
              >
                Safety Playbook
              </button>
              <button 
                onClick={() => setActiveTab('about')}
                className="text-slate-400 hover:text-cyan-300 transition-colors"
              >
                Architecture
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-400">Engine Status: All Heuristic &amp; AI Systems Operational</span>
            </div>

            <div className="text-center sm:text-right text-slate-400">
              Never remit money, registration deposits, or sensitive ID cards to secure employment.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

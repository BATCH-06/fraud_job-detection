import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Trash2, 
  AlertTriangle, 
  ArrowRight, 
  Lightbulb, 
  Lock, 
  Terminal, 
  Cpu, 
  CheckCircle2, 
  ShieldAlert,
  Sparkles,
  Zap,
  Radio,
  Clock,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SAMPLE_CASES, SampleCase } from '../data/samples';

interface HomeViewProps {
  onCheckJob: (payload: {
    text: string;
    companyName?: string;
    jobTitle?: string;
    senderInfo?: string;
    channel?: string;
  }) => void;
  isLoading: boolean;
  error: string | null;
  onNavigateToSafety: () => void;
  onNavigateToAbout: () => void;
  onNavigateToHistory?: () => void;
  historyCount?: number;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onCheckJob,
  isLoading,
  error,
  onNavigateToSafety,
  onNavigateToAbout,
  onNavigateToHistory,
  historyCount = 0
}) => {
  const [text, setText] = useState('');
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || text.trim().length < 20 || isLoading) return;
    onCheckJob({ text: text.trim() });
  };

  const handleClear = () => {
    setText('');
    setSelectedSampleId(null);
  };

  const handlePickSample = (sample: SampleCase) => {
    setSelectedSampleId(sample.id);
    setText(sample.text);
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center max-w-4xl mx-auto space-y-4 pt-4 sm:pt-8"
      >
        {/* Cybersecurity Status Kicker */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-cyan-500/30 text-cyan-300 text-xs font-mono shadow-[0_0_15px_rgba(56,189,248,0.2)] backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>Zero-Day Recruitment Fraud Defense Engine</span>
        </div>

        {/* Hero Heading - Exact User Prompt Requirement */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
          Detect Fake Jobs <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(56,189,248,0.3)]">
            Before They Trap You
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base lg:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto font-normal">
          AI &amp; heuristic-powered cybersecurity audit tool to analyze recruitment offers, 
          detect advance-fee scams, spot identity harvesting, and safeguard students in seconds.
        </p>

        {/* Live Protection Stats Strip */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 pt-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Dual Heuristic + AI Engine</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-purple-400" />
            <span>Private Browser History</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Real-Time Risk Scoring</span>
          </div>
        </div>
      </motion.div>

      {/* Main Analysis Input Card */}
      <motion.div 
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        className="relative max-w-4xl mx-auto"
      >
        {/* Outer Neon Glow Halo */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-cyan-500/20 via-blue-600/20 to-purple-600/20 blur-xl opacity-75 pointer-events-none" />

        <div className="relative rounded-2xl bg-[#090e24]/85 border border-cyan-500/30 p-5 sm:p-8 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] overflow-hidden">
          
          {/* Active Scanner Line Animation when Analyzing */}
          {isLoading && (
            <div className="absolute inset-0 pointer-events-none z-30">
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#38bdf8] animate-laser-scan absolute top-0" />
              <div className="absolute inset-0 bg-cyan-950/20 backdrop-blur-[1px]" />
            </div>
          )}

          {/* Form Header */}
          <div className="flex items-center justify-between mb-4 border-b border-cyan-500/10 pb-3">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>SECURITY_SCANNER // INPUT_PAYLOAD</span>
            </div>

            <div className="flex items-center gap-2">
              {text.trim().length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isLoading}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800/60"
                  title="Clear text"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
              <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                text.trim().length >= 20 ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30' : 'text-slate-500 bg-slate-900'
              }`}>
                {text.trim().length} chars
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <textarea
                id="adText"
                aria-label="Job offer text"
                maxLength={10000}
                rows={7}
                disabled={isLoading}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the job advertisement, internship offer letter, recruiter email, or Telegram/WhatsApp recruitment message here..."
                className="w-full bg-[#050816]/90 border border-cyan-500/25 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 leading-relaxed transition-all resize-y shadow-inner font-sans focus:outline-none"
              />
              {text.length === 0 && (
                <div className="absolute bottom-3 right-3 pointer-events-none text-[11px] font-mono text-slate-500 hidden sm:block">
                  Min 20 characters required
                </div>
              )}
            </div>

            {/* Error Banner */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Animated Security Scanner HUD Overlay while analyzing */}
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-5 rounded-xl bg-gradient-to-r from-cyan-950/50 via-slate-900/70 to-purple-950/50 border border-cyan-400/40 space-y-3 shadow-[0_0_20px_rgba(56,189,248,0.2)]"
              >
                <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                    <span className="font-bold">CYBER DEFENSE SCAN IN PROGRESS</span>
                  </div>
                  <span className="text-cyan-400 animate-pulse">Running Heuristic NLP &amp; Gemini Flash...</span>
                </div>

                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-cyan-500/20">
                  <div className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 w-full animate-neon-shimmer" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono text-slate-400">
                  <div className="flex items-center gap-1.5 text-cyan-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span>Linguistic Analysis</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-cyan-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span>Fee Vector Check</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-purple-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    <span>Domain Forensics</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-purple-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    <span>AI Threat Verdict</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Action Bar with Prominent "Check This Job" Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Your history stays in this browser. The service also keeps a copy of each check so administrators can monitor accuracy.</span>
              </div>

              {/* Prominent Check This Job Button */}
              <button
                type="submit"
                disabled={isLoading || !text.trim() || text.trim().length < 20}
                className={`w-full sm:w-auto relative group overflow-hidden px-8 py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5 ${
                  isLoading || !text.trim() || text.trim().length < 20
                    ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:via-blue-500 hover:to-purple-500 text-white shadow-[0_0_25px_rgba(56,189,248,0.35)] hover:shadow-[0_0_35px_rgba(56,189,248,0.6)] hover:scale-[1.02] active:scale-[0.99] border border-cyan-300/40 cursor-pointer'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Analyzing Security Threat...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 drop-shadow-[0_0_6px_rgba(255,255,255,0.7)] group-hover:rotate-6 transition-transform" />
                    <span className="drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                      Check This Job
                    </span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>

      {/* Preset Example Test Cases Selector */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="max-w-4xl mx-auto space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-300 font-semibold">
            <Lightbulb className="w-4 h-4 text-cyan-400" />
            <span>Try a Quick Real-World Example:</span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">Click to auto-populate the payload</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SAMPLE_CASES.slice(0, 3).map((sample) => {
            const isSelected = selectedSampleId === sample.id;
            const badgeColor = 
              sample.categoryBadge === 'Fraudulent' ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' :
              sample.categoryBadge === 'Suspicious' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
              'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';

            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => handlePickSample(sample)}
                className={`p-4 rounded-xl text-left transition-all duration-200 border flex flex-col justify-between gap-2.5 backdrop-blur-md group ${
                  isSelected
                    ? 'bg-[#0f1738] border-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.25)]'
                    : 'bg-[#090d21]/70 border-cyan-500/15 hover:border-cyan-400/50 hover:bg-[#0c1330]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${badgeColor}`}>
                      {sample.categoryBadge}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{sample.channel}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-cyan-200 transition-colors pt-1">
                    {sample.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {sample.description}
                  </p>
                </div>

                <div className="text-[10px] font-mono text-cyan-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Load Sample Payload</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Feature Highlights Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4"
      >
        <div className="p-5 rounded-2xl bg-[#090d21]/60 border border-cyan-500/15 backdrop-blur-md space-y-2 hover:border-cyan-500/30 transition-all">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">8 Rule-Based NLP Engines</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Deterministic heuristics detect upfront fee traps, suspicious Telegram channels, unrealistic stipends, and identity theft.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#090d21]/60 border border-purple-500/15 backdrop-blur-md space-y-2 hover:border-purple-500/30 transition-all">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Gemini AI Semantic Analysis</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Advanced neural reasoning evaluates deceptive emotional urgency, manipulation tactics, and corporate domain plausibility.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#090d21]/60 border border-blue-500/15 backdrop-blur-md space-y-2 hover:border-blue-500/30 transition-all">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Device-Level Past History</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every analysis is automatically archived in private browser storage with printable audit summaries and export options.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

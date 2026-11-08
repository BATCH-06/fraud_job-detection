import React from 'react';
import { 
  Info, 
  ShieldCheck, 
  GraduationCap, 
  Search, 
  Terminal, 
  Cpu, 
  Lock, 
  ArrowRight,
  Database,
  Sparkles,
  Zap
} from 'lucide-react';
import { motion } from 'motion/react';

interface AboutViewProps {
  onGoToChecker: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ onGoToChecker }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="rounded-2xl p-6 sm:p-8 bg-[#090d24]/90 border border-cyan-500/25 shadow-[0_10px_35px_rgba(0,0,0,0.5)] backdrop-blur-2xl space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>SYSTEM_SPECIFICATION // ARCHITECTURE</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          About the Fake Job &amp; Internship Scam Detection System
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl font-normal font-sans">
          A dedicated cybersecurity and NLP detection platform built to protect students, fresh graduates, and career seekers from modern employment fraud, identity theft syndicates, and deceptive task operations.
        </p>
      </div>

      {/* 4 Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-2xl p-6 bg-[#090d24]/80 border border-cyan-500/15 backdrop-blur-xl space-y-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">
            1. Dual Detection Engine
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            The platform synthesizes an 8-rule deterministic NLP heuristic engine (evaluating upfront fee traps, suspicious messaging handles, and compensation anomalies) with Google Gemini neural reasoning to evaluate subtle psychological manipulation tactics.
          </p>
        </div>

        <div className="rounded-2xl p-6 bg-[#090d24]/80 border border-purple-500/15 backdrop-blur-xl space-y-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">
            2. Student Threat Vector Protection
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Students and freshers are the prime targets for fake summer internship schemes and prepaid video review tasks. Scammers spoof Fortune 500 brands to extract refundable registration deposits or courier insurance, causing financial distress and identity theft.
          </p>
        </div>

        <div className="rounded-2xl p-6 bg-[#090d24]/80 border border-blue-500/15 backdrop-blur-xl space-y-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">
            3. Privacy and Accounts
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Anyone can check an offer without signing in; guest history stays in the browser. Students who register get a private history in their own account. Every check is also stored by the service so that administrators can monitor detection quality, and no one else can see your saved history.
          </p>
        </div>

        <div className="rounded-2xl p-6 bg-[#090d24]/80 border border-emerald-500/15 backdrop-blur-xl space-y-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">
            4. Zero-Trust Verification Protocol
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            The system adheres to zero-trust principles: never trust a recruiter based purely on a PDF offer letter, logo, or WhatsApp message. Always verify corporate identity through verified company portals and institutional campus channels.
          </p>
        </div>
      </div>

      {/* Call to action card */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-cyan-950/40 via-[#090d24] to-purple-950/40 border border-cyan-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white">Ready to verify a suspicious offer?</h3>
          <p className="text-xs text-slate-400 mt-0.5">Paste any recruiter email or WhatsApp message to receive an instant security verdict.</p>
        </div>
        <button
          onClick={onGoToChecker}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all flex items-center gap-2 flex-shrink-0"
        >
          <span>Open Security Console</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Copy, 
  Check, 
  Printer, 
  Bookmark, 
  Building2, 
  Briefcase, 
  Mail, 
  Radio, 
  Lock, 
  ExternalLink, 
  RotateCcw,
  Cpu,
  Terminal,
  Zap,
  Flame,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { AnalysisResponse, FlaggedIndicator } from '../types';
import { CompanyVerificationCard } from './CompanyVerificationCard';

interface AnalysisResultViewProps {
  result: AnalysisResponse;
  onOpenReport: () => void;
  onReset: () => void;
  onToggleStar?: (id: string) => void;
  isStarred?: boolean;
}

export const AnalysisResultView: React.FC<AnalysisResultViewProps> = ({
  result,
  onOpenReport,
  onReset,
  onToggleStar,
  isStarred = false
}) => {
  const [copiedText, setCopiedText] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);

  const { finalVerdict, heuristicEngine, aiModelEngine, metadata, recordId, timestamp, raw_text } = result;
  const targetScore = finalVerdict.riskScore;

  // Animate the risk score counter smoothly from 0 to targetScore
  useEffect(() => {
    let start = 0;
    const duration = 900; // ms
    const stepTime = 16;
    const totalSteps = Math.ceil(duration / stepTime);
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / totalSteps;
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * targetScore);
      setAnimatedScore(current);

      if (step >= totalSteps) {
        setAnimatedScore(targetScore);
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [targetScore]);

  // Color mappings per user requirements: Green = Low Risk, Amber = Suspicious, Red = High Risk
  const riskCategory = finalVerdict.riskCategory;
  const isHighRisk = riskCategory === 'Fraudulent';
  const isSuspicious = riskCategory === 'Suspicious';
  const isLowRisk = riskCategory === 'Genuine';

  const theme = isHighRisk ? {
    label: 'High Risk',
    badgeText: 'CRITICAL THREAT / HIGH RISK',
    textColor: 'text-rose-400',
    borderColor: 'border-rose-500/40',
    bgCard: 'bg-rose-950/20',
    glowShadow: 'shadow-[0_0_30px_rgba(244,63,94,0.25)]',
    ringColor: 'stroke-rose-500',
    barColor: 'bg-rose-500',
    subtext: 'Critical danger: Scam warning indicators detected. Do not pay money or share private identification.'
  } : isSuspicious ? {
    label: 'Suspicious',
    badgeText: 'SUSPICIOUS / NEEDS VERIFICATION',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/40',
    bgCard: 'bg-amber-950/20',
    glowShadow: 'shadow-[0_0_30px_rgba(245,158,11,0.25)]',
    ringColor: 'stroke-amber-500',
    barColor: 'bg-amber-500',
    subtext: 'Irregularities detected. Verify employer credentials and physical office before proceeding.'
  } : {
    label: 'Low Risk',
    badgeText: 'AUTHENTIC / LOW RISK',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/40',
    bgCard: 'bg-emerald-950/20',
    glowShadow: 'shadow-[0_0_30px_rgba(16,185,129,0.25)]',
    ringColor: 'stroke-emerald-500',
    barColor: 'bg-emerald-500',
    subtext: 'Standard recruitment practices identified. Always confirm offers on the company official careers portal.'
  };

  const handleCopySummary = () => {
    const textToCopy = `[Scam Checker Threat Audit]\nRole: ${metadata?.jobTitle || 'Job Offer'}\nCompany: ${metadata?.companyName || 'Unspecified'}\nThreat Level: ${theme.label} (${targetScore}/100)\nSummary: ${finalVerdict.summary}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Circular gauge math
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Top Threat Banner Card */}
      <div className={`relative rounded-3xl p-6 sm:p-8 ${theme.bgCard} border ${theme.borderColor} ${theme.glowShadow} backdrop-blur-2xl overflow-hidden`}>
        {/* Ambient Top Glow Line */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${theme.barColor} opacity-80`} />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase border ${
                isHighRisk ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                isSuspicious ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {isHighRisk ? <ShieldAlert className="w-3.5 h-3.5" /> :
                 isSuspicious ? <AlertTriangle className="w-3.5 h-3.5" /> :
                 <ShieldCheck className="w-3.5 h-3.5" />}
                <span>{theme.badgeText}</span>
              </span>

              <span className="text-xs font-mono text-slate-400">
                AUDIT_ID: {recordId}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {metadata?.jobTitle || 'Job / Internship Advertisement'}
            </h2>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-300">
              <span className="flex items-center gap-1 text-cyan-300">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                {metadata?.companyName || 'Unspecified Company'}
              </span>
              <span>•</span>
              <span>Via: {metadata?.channel || 'Direct Message'}</span>
              <span>•</span>
              <span className="text-slate-400">{new Date(timestamp).toLocaleString()}</span>
            </div>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-2xl pt-1">
              {finalVerdict.summary}
            </p>
          </div>

          {/* Animated Risk Score Circular Gauge */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[#050816]/80 border border-cyan-500/20 backdrop-blur-md shadow-xl flex-shrink-0">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  className="stroke-slate-800"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  className={`${theme.ringColor} transition-all duration-300`}
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className={`text-3xl font-mono font-extrabold tracking-tight ${theme.textColor}`}>
                  {animatedScore}
                </span>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                  Threat / 100
                </span>
              </div>
            </div>

            <div className="mt-2 text-center">
              <span className={`text-xs font-mono font-bold uppercase ${theme.textColor}`}>
                {theme.label}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-6 pt-5 border-t border-cyan-500/15 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700 hover:border-cyan-400/50"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Check Another Offer</span>
            </button>

            {onToggleStar && recordId && (
              <button
                type="button"
                onClick={() => onToggleStar(recordId)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  isStarred 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                <span>{isStarred ? 'Bookmarked' : 'Bookmark'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedText ? 'Copied' : 'Copy Summary'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenReport}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(56,189,248,0.25)] border border-cyan-400/30"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Security Audit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Warning Signs & Security Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Warning Flags Card */}
        <div className="rounded-2xl p-6 bg-[#090d24]/85 border border-cyan-500/20 backdrop-blur-xl shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-500/15 pb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Detected Warning Flags ({(heuristicEngine?.flags || []).length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Threat Indicators</span>
          </div>

          {(heuristicEngine?.flags || []).length === 0 ? (
            <div className="p-6 rounded-xl bg-[#050816]/70 border border-emerald-500/30 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-xs font-bold text-emerald-300">Zero Red Flags Identified</p>
              <p className="text-[11px] text-slate-400">
                No upfront fee demands, anonymous messaging traps, or compensation anomalies were spotted.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(heuristicEngine?.flags || []).map((flag, idx) => (
                <div 
                  key={flag.id || idx}
                  className="p-4 rounded-xl bg-[#050816]/80 border border-rose-500/30 space-y-2 hover:border-rose-400/60 transition-colors shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      {flag.label}
                    </span>
                    <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                      flag.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse' :
                      flag.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
                      'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {flag.severity}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {flag.description}
                  </p>

                  {flag.evidenceSnippet && (
                    <div className="p-2.5 rounded-lg bg-[#0a0f28] border border-cyan-500/15 text-[11px] font-mono text-cyan-200/90 italic">
                      "{flag.evidenceSnippet}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Recommendations Card */}
        <div className="rounded-2xl p-6 bg-[#090d24]/85 border border-cyan-500/20 backdrop-blur-xl shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-500/15 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Defensive Action Protocol
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Next Steps</span>
          </div>

          <div className="space-y-3">
            {(finalVerdict.recommendations || []).map((rec, idx) => (
              <div 
                key={idx}
                className="p-3.5 rounded-xl bg-[#050816]/70 border border-cyan-500/20 flex items-start gap-3 hover:border-cyan-400/40 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-mono font-bold flex-shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {rec}
                </p>
              </div>
            ))}
          </div>

          {/* AI Intelligence Note */}
          {aiModelEngine?.isAvailable && (
            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs space-y-1">
              <span className="font-mono text-[10px] text-purple-300 uppercase tracking-wider block font-bold">
                AI Semantic Verdict: {aiModelEngine.modelName}
              </span>
              <p className="text-slate-300 text-xs italic leading-relaxed">
                "{aiModelEngine.verdictRationale}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Company Verification (company, contact e-mail and website checks) */}
      <CompanyVerificationCard verification={result.companyVerification} />

      {/* Raw Payload Inspection Accordion */}
      {raw_text && (
        <div className="rounded-2xl p-5 bg-[#090d24]/75 border border-cyan-500/20 backdrop-blur-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Audited Payload Body</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">{raw_text.length} bytes</span>
          </div>

          <div className="p-4 rounded-xl bg-[#050816] border border-cyan-500/15 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed shadow-inner">
            {raw_text}
          </div>
        </div>
      )}
    </motion.div>
  );
};

import React from 'react';
import { Printer, X, ShieldAlert, ShieldCheck, AlertTriangle, Building2, Terminal } from 'lucide-react';
import { AnalysisResponse } from '../types';

interface ReportModalProps {
  result: AnalysisResponse;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ result, onClose }) => {
  const { finalVerdict, heuristicEngine, metadata, recordId, timestamp, raw_text } = result;

  const handlePrint = () => {
    window.print();
  };

  const isHighRisk = finalVerdict.riskCategory === 'Fraudulent';
  const isSuspicious = finalVerdict.riskCategory === 'Suspicious';

  const friendlyRiskLabel = isHighRisk 
    ? 'High Risk' 
    : isSuspicious 
    ? 'Suspicious' 
    : 'Low Risk';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#090d24] border border-cyan-500/30 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-[0_10px_50px_rgba(0,0,0,0.8)] flex flex-col">
        {/* Modal Controls (Hidden in print) */}
        <div className="p-4 border-b border-cyan-500/15 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>SECURITY_AUDIT_REPORT // PRINT_PREVIEW</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)]"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <div className="p-8 sm:p-10 space-y-6 bg-[#050816] text-slate-200 print:bg-white print:text-black">
          {/* Header */}
          <div className="border-b-2 border-cyan-500/30 print:border-black pb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white print:text-black">
                Recruitment Fraud &amp; Scam Audit Report
              </h1>
              <p className="text-xs font-mono text-cyan-400 print:text-slate-600 mt-0.5">
                Automated Cybersecurity Threat Assessment
              </p>
            </div>
            <div className="text-right font-mono text-[11px] text-slate-400 print:text-slate-600">
              <div>AUDIT REF: {recordId}</div>
              <div>DATE: {new Date(timestamp).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Risk Verdict Banner */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            isHighRisk 
              ? 'bg-rose-950/30 border-rose-500/40 text-rose-300 print:border-red-600 print:text-red-700' 
              : isSuspicious 
              ? 'bg-amber-950/30 border-amber-500/40 text-amber-300 print:border-amber-600 print:text-amber-700' 
              : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 print:border-emerald-600 print:text-emerald-700'
          }`}>
            <div className="flex items-center gap-3">
              {isHighRisk ? <ShieldAlert className="w-6 h-6 text-rose-400" /> :
               isSuspicious ? <AlertTriangle className="w-6 h-6 text-amber-400" /> :
               <ShieldCheck className="w-6 h-6 text-emerald-400" />}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest block">Threat Classification</span>
                <span className="text-base font-bold">{friendlyRiskLabel}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono uppercase tracking-widest block">Threat Score</span>
              <span className="text-xl font-mono font-extrabold">{finalVerdict.riskScore}/100</span>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-[#090d24] p-4 rounded-xl border border-cyan-500/20 print:bg-slate-100 print:text-black print:border-slate-300">
            <div>
              <span className="text-slate-400 print:text-slate-600 block text-[10px]">CLAIMED COMPANY:</span>
              <span className="font-bold text-white print:text-black">{metadata?.companyName || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-slate-400 print:text-slate-600 block text-[10px]">JOB ROLE / TITLE:</span>
              <span className="font-bold text-white print:text-black">{metadata?.jobTitle || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-slate-400 print:text-slate-600 block text-[10px]">COMMUNICATION CHANNEL:</span>
              <span className="text-slate-200 print:text-black">{metadata?.channel || 'Direct Message'}</span>
            </div>
            <div>
              <span className="text-slate-400 print:text-slate-600 block text-[10px]">SENDER CONTACT:</span>
              <span className="text-slate-200 print:text-black">{metadata?.senderInfo || 'Not specified'}</span>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 print:text-black">
              Executive Summary
            </h3>
            <p className="text-xs text-slate-300 print:text-black leading-relaxed font-sans">
              {finalVerdict.summary}
            </p>
          </div>

          {/* Warning Signs */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 print:text-black">
              Detected Warning Signs ({(heuristicEngine?.flags || []).length})
            </h3>
            {(heuristicEngine?.flags || []).length === 0 ? (
              <p className="text-xs text-emerald-400 print:text-emerald-700">No warning signs detected.</p>
            ) : (
              <div className="space-y-2">
                {(heuristicEngine?.flags || []).map((f, i) => (
                  <div key={i} className="p-3 rounded-lg border border-rose-500/25 bg-[#090d24] print:bg-white print:border-slate-300 text-xs space-y-1">
                    <span className="font-bold text-rose-300 print:text-red-700 block">{f.label} ({f.severity})</span>
                    <p className="text-slate-300 print:text-black">{f.description}</p>
                    {f.evidenceSnippet && (
                      <p className="text-cyan-300 print:text-slate-700 text-[11px] font-mono italic">
                        "{f.evidenceSnippet}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 print:text-black">
              Recommended Defensive Protocols
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-300 print:text-black">
              {(finalVerdict.recommendations || []).map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>

          {/* Audited Text Payload */}
          {raw_text && (
            <div className="space-y-1">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 print:text-black">
                Audited Text Payload
              </h3>
              <div className="p-3 rounded-lg bg-[#090d24] print:bg-slate-50 border border-slate-800 print:border-slate-300 text-[11px] font-mono text-slate-300 print:text-black max-h-36 overflow-y-auto whitespace-pre-wrap">
                {raw_text}
              </div>
            </div>
          )}

          {/* Legal / Institutional Disclaimer */}
          <div className="border-t border-cyan-500/20 print:border-black pt-4 text-[10px] text-slate-500 print:text-slate-700 space-y-1">
            <p>
              This report is generated for defensive student safety and educational awareness based on NLP pattern heuristics and AI threat evaluation. 
              Always independently confirm employment offers with verified corporate headquarters or university placement cells.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

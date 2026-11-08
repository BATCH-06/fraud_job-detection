import React from 'react';
import { BadgeCheck, ShieldAlert, HelpCircle, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import type { CompanyVerificationResult } from '../types';

const verdictTheme: Record<CompanyVerificationResult['verdict'], { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  'Verified': { label: 'Company Verified', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/40', Icon: BadgeCheck },
  'Unverified': { label: 'Could Not Verify', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/40', Icon: HelpCircle },
  'Suspicious': { label: 'Suspicious Company Details', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/40', Icon: ShieldAlert },
  'Not enough details': { label: 'Not Enough Details', cls: 'text-slate-300 bg-slate-500/10 border-slate-500/40', Icon: Info }
};
const statusIcon = {
  pass: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" aria-label="passed" />,
  warn: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" aria-label="warning" />,
  fail: <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" aria-label="failed" />,
  info: <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" aria-label="information" />
};

export const CompanyVerificationCard: React.FC<{ verification?: CompanyVerificationResult | null; compact?: boolean }> = ({ verification, compact }) => {
  if (!verification) return null;
  const theme = verdictTheme[verification.verdict] || verdictTheme['Unverified'];
  const Icon = theme.Icon;
  return (
    <section className={`rounded-2xl ${compact ? 'p-4' : 'p-5'} bg-[#090d24]/75 border border-cyan-500/20 backdrop-blur-xl space-y-3`} data-testid="company-verification" aria-label="Company verification">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">Company Verification</h3>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${theme.cls}`} data-testid="company-verdict">
          <Icon className="w-3.5 h-3.5" /> {theme.label}
        </span>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{verification.summary}</p>
      <ul className="space-y-1.5">
        {verification.checks.map(c => (
          <li key={c.id} className="flex items-start gap-2 text-xs">
            {statusIcon[c.status]}
            <span className="text-slate-300"><span className="font-semibold text-slate-100">{c.label}:</span> {c.detail}</span>
          </li>
        ))}
      </ul>
      {verification.onlineChecks === 'unavailable' && <p className="text-[11px] text-slate-500">Live domain checks (existence and age) could not be reached, so only the built-in checks were used.</p>}
    </section>
  );
};

import React from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  PhoneCall, 
  ExternalLink, 
  CheckCircle2, 
  Lock, 
  Mail, 
  DollarSign, 
  Building, 
  KeyRound,
  Terminal,
  Zap,
  Flame,
  ShieldAlert
} from 'lucide-react';
import { motion } from 'motion/react';

export const SafetyTipsView: React.FC = () => {
  const coreTips = [
    {
      title: '1. Upfront Fee Vector: Instant Red Flag',
      icon: DollarSign,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      description: 'Legitimate employers pay you for your work; candidates never pay to get hired. Any demand for "registration bonds", "training kit deposits", or "courier equipment charges" indicates employment fraud.'
    },
    {
      title: '2. Domain Integrity & DNS Audit',
      icon: Building,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
      description: 'Do not follow unsolicited URLs in messages. Always manually navigate to the corporation verified website (e.g. company.com/careers) to cross-reference real opening requisitions.'
    },
    {
      title: '3. Webmail Recruiter Spoofing',
      icon: Mail,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      description: 'Corporate recruiters use custom domain emails (recruiter@company.com). Extreme suspicion is warranted when someone claiming to represent Fortune 500 enterprises uses free @gmail.com or @yahoo.com addresses.'
    },
    {
      title: '4. Asymmetric Task-to-Compensation Ratio',
      icon: AlertTriangle,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      description: 'Promises of ₹50,000 to ₹90,000/month for 1-2 hours of unskilled tasks (video ratings, copy-paste data, crypto node binding) are classic prepaid task and advance-fee scam lures.'
    },
    {
      title: '5. Zero-Trust Personal Data Protocol',
      icon: KeyRound,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      description: 'Never transmit online banking OTPs, CVVs, ATM PINs, or unredacted passport/ID documents over messaging apps. Legitimate onboarding occurs via encrypted enterprise HR portals.'
    },
    {
      title: '6. Institutional Placement Cell Vetting',
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      description: 'University candidates should always cross-verify unannounced internship invitations with their campus Training & Placement Cell (TPO) before signing or sharing credentials.'
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="rounded-2xl p-6 sm:p-8 bg-[#090d24]/90 border border-cyan-500/25 shadow-[0_10px_35px_rgba(0,0,0,0.5)] backdrop-blur-2xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>CYBER_INTELLIGENCE // THREAT_PLAYBOOK</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <ShieldCheck className="w-7 h-7 text-cyan-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]" />
          <span>Recruitment Scam Defense Protocols</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl font-normal">
          Defensive security guidelines to audit unsolicited job proposals, spot phishing lures, and protect your identity.
        </p>
      </div>

      {/* 6 Core Advice Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {coreTips.map((tip, idx) => {
          const Icon = tip.icon;
          return (
            <div
              key={idx}
              className="rounded-2xl p-5 bg-[#090d24]/80 border border-cyan-500/15 hover:border-cyan-500/40 shadow-lg backdrop-blur-xl space-y-3 transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${tip.bgColor} ${tip.borderColor} border flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <Icon className={`w-5 h-5 ${tip.color}`} />
                </div>
                <h3 className="text-sm font-bold text-white leading-snug">
                  {tip.title}
                </h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed pl-1 font-sans">
                {tip.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Quick Checklist */}
      <div className="rounded-2xl p-6 bg-[#090d24]/85 border border-cyan-500/20 backdrop-blur-xl shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-cyan-400" />
          <span>Quick 5-Point Security Audit Checklist</span>
        </h3>
        <p className="text-xs text-slate-400">
          Before signing contracts or transmitting documents, verify these 5 vectors:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-[#050816] border border-cyan-500/15 space-y-1">
            <span className="font-bold text-cyan-300 block">1. Assessment Step Audit</span>
            <p className="text-slate-400 text-[11px] font-sans">Genuine enterprises never issue immediate contracts without technical evaluations.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#050816] border border-cyan-500/15 space-y-1">
            <span className="font-bold text-cyan-300 block">2. Zero-Fee Principle</span>
            <p className="text-slate-400 text-[11px] font-sans">Any request for upfront fee or courier insurance is immediate fraud.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#050816] border border-cyan-500/15 space-y-1">
            <span className="font-bold text-cyan-300 block">3. Corporate Email Verification</span>
            <p className="text-slate-400 text-[11px] font-sans">Audit whether the sending server domain matches the real company portal.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#050816] border border-cyan-500/15 space-y-1">
            <span className="font-bold text-cyan-300 block">4. Urgency Pressure Check</span>
            <p className="text-slate-400 text-[11px] font-sans">Arbitrary 2-hour deadlines are social engineering traps to prevent verification.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#050816] border border-cyan-500/15 space-y-1">
            <span className="font-bold text-cyan-300 block">5. Academic Placement Verification</span>
            <p className="text-slate-400 text-[11px] font-sans">Confirm the recruiter identity through your university placement coordinator.</p>
          </div>
        </div>
      </div>

      {/* Emergency Reporting Protocols */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-rose-950/30 via-[#090d24] to-[#090d24] border border-rose-500/30 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <h3 className="text-base font-bold text-white">
            Incident Response: Report Active Fraud
          </h3>
        </div>
        <p className="text-xs text-slate-300">
          If you have transferred funds or shared unredacted national ID cards, initiate incident reporting immediately:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-xs">
          <div className="p-4 rounded-xl bg-[#050816] border border-rose-500/30 space-y-1.5">
            <span className="text-[11px] font-mono font-bold text-rose-400 uppercase tracking-wider block">
              National Cyber Crime Reporting Helpline
            </span>
            <p className="text-lg font-mono font-extrabold text-white">Dial 1930 (Toll-Free)</p>
            <p className="text-slate-400 text-[11px] font-sans">
              Immediate reporting assists financial intelligence units in freezing fraudulent UPI and bank transfers.
            </p>
            <a
              href="https://cybercrime.gov.in"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 font-semibold mt-1"
            >
              <span>Access cybercrime.gov.in</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="p-4 rounded-xl bg-[#050816] border border-cyan-500/20 space-y-1.5">
            <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider block">
              Institutional Escalation
            </span>
            <p className="text-base font-bold text-white">Notify Training &amp; Placement Cell</p>
            <p className="text-slate-400 text-[11px] font-sans">
              Report fraudulent recruiters to your college TPO to safeguard fellow batchmates and blacklist the syndicate domain.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

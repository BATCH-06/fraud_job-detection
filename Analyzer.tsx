import React, { useState } from 'react';
import { 
  Search, 
  Trash2, 
  Building2, 
  Briefcase, 
  Mail, 
  Radio, 
  Lock, 
  Lightbulb, 
  AlertTriangle, 
  ArrowRight,
  ShieldCheck,
  Terminal,
  Zap,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SAMPLE_CASES, SampleCase } from '../data/samples';
import { AnalysisResponse } from '../types';

interface AnalyzerProps {
  onAnalyze: (payload: {
    text: string;
    companyName?: string;
    jobTitle?: string;
    senderInfo?: string;
    channel?: string;
    salary?: string;
    website?: string;
  }) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onClear: () => void;
  currentResult: AnalysisResponse | null;
}

export const Analyzer: React.FC<AnalyzerProps> = ({
  onAnalyze,
  isLoading,
  error,
  onClear
}) => {
  const [text, setText] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [senderInfo, setSenderInfo] = useState('');
  const [channel, setChannel] = useState('Email');
  const [salary, setSalary] = useState('');
  const [website, setWebsite] = useState('');
  const [showExtraDetails, setShowExtraDetails] = useState(false);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);

  const handleSelectSample = (sample: SampleCase) => {
    setActiveSampleId(sample.id);
    setText(sample.text);
    setCompanyName(sample.companyName);
    setJobTitle(sample.jobTitle);
    setSenderInfo(sample.senderInfo);
    setChannel(sample.channel);
    setSalary('');
    setWebsite('');
    setShowExtraDetails(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || text.trim().length < 20 || isLoading) return;
    onAnalyze({
      text: text.trim(),
      companyName: companyName.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
      senderInfo: senderInfo.trim() || undefined,
      channel: channel || undefined,
      salary: salary.trim() || undefined,
      website: website.trim() || undefined
    });
  };

  const handleClear = () => {
    setText('');
    setCompanyName('');
    setJobTitle('');
    setSenderInfo('');
    setChannel('Email');
    setSalary('');
    setWebsite('');
    setActiveSampleId(null);
    onClear();
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 sm:p-7 bg-[#090d24]/85 border border-cyan-500/25 shadow-[0_4px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>CYBER_DEFENSE_CONSOLE // DEEP_INSPECTOR</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Targeted Scam &amp; Threat Analysis
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl font-normal">
          Paste the unedited job advertisement or recruitment communication below. 
          Optionally add metadata to enable high-precision entity verification and cross-domain auditing.
        </p>
      </motion.div>

      {/* Preset Test Case Selector */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl p-5 bg-[#090d21]/75 border border-cyan-500/20 backdrop-blur-xl shadow-lg"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
              Quick Threat Scenario Presets:
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">Select to test scanner capabilities</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {SAMPLE_CASES.map((sample) => {
            const isSelected = activeSampleId === sample.id;
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSelectSample(sample)}
                className={`text-left p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between group ${
                  isSelected
                    ? 'bg-[#10193d] border-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.3)] ring-1 ring-cyan-400'
                    : 'bg-[#060a19]/80 border-cyan-500/15 hover:bg-[#0c1432] hover:border-cyan-400/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-xs text-white group-hover:text-cyan-200 line-clamp-1 transition-colors">
                      {sample.name}
                    </span>
                    <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border ${
                      sample.categoryBadge === 'Fraudulent' ? 'text-rose-400 border-rose-500/40 bg-rose-500/10' :
                      sample.categoryBadge === 'Suspicious' ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' :
                      'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                    }`}>
                      {sample.categoryBadge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {sample.description}
                  </p>
                </div>
                <div className="mt-2.5 text-[10px] font-mono text-cyan-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Load into console</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Main Check Form */}
      <motion.form 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        onSubmit={handleSubmit} 
        className="relative rounded-2xl p-5 sm:p-7 bg-[#090d24]/90 border border-cyan-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl space-y-5 overflow-hidden"
      >
        {/* Laser Scanner Line Animation */}
        {isLoading && (
          <div className="absolute inset-0 pointer-events-none z-30">
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#38bdf8] animate-laser-scan absolute top-0" />
            <div className="absolute inset-0 bg-cyan-950/25 backdrop-blur-[1px]" />
          </div>
        )}

        <div className="flex items-center justify-between border-b border-cyan-500/15 pb-3">
          <label htmlFor="checkInput" className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>PAYLOAD_TEXT (JOB ADVERTISEMENT)</span>
          </label>

          <div className="flex items-center gap-2">
            {text.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isLoading}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800"
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

        <div>
          <textarea
            id="checkInput"
            rows={7}
            disabled={isLoading}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={10000}
            placeholder="Paste the full job advertisement, internship offer letter, recruiter message, or email body here..."
            className="w-full bg-[#050816]/90 border border-cyan-500/25 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 leading-relaxed font-sans focus:outline-none transition-all resize-y shadow-inner"
          />
        </div>

        {/* Collapsible Metadata Drawer */}
        <div className="border border-cyan-500/15 rounded-xl bg-[#060a19]/70 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setShowExtraDetails(!showExtraDetails)}
            className="w-full px-4 py-3 text-xs font-mono flex items-center justify-between text-slate-300 hover:text-cyan-300 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Context Metadata (Optional - increases accuracy)</span>
            </div>
            {showExtraDetails ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showExtraDetails && (
            <div className="p-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-cyan-500/10">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Claimed Company Name</span>
                </label>
                <input
                  type="text"
                  disabled={isLoading}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex Media, Infosys, NextGen Cloud"
                  className="w-full bg-[#050816] border border-cyan-500/20 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Job Role / Title</span>
                </label>
                <input
                  type="text"
                  disabled={isLoading}
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Data Entry Assistant, Summer Intern"
                  className="w-full bg-[#050816] border border-cyan-500/20 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-purple-400" />
                  <span>Sender Email or Phone</span>
                </label>
                <input
                  type="text"
                  disabled={isLoading}
                  value={senderInfo}
                  onChange={(e) => setSenderInfo(e.target.value)}
                  placeholder="e.g. recruiter@gmail.com, @telegram_id"
                  className="w-full bg-[#050816] border border-cyan-500/20 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-purple-400" />
                  <span>Recruitment Channel</span>
                </label>
                <select
                  disabled={isLoading}
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full bg-[#050816] border border-cyan-500/20 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="Email">Official / Direct Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Telegram">Telegram</option>
                  <option value="LinkedIn">LinkedIn InMail</option>
                  <option value="SMS">SMS / Text Message</option>
                  <option value="Campus Placement">Campus Placement Cell</option>
                  <option value="Job Board">Job Board (Naukri, Indeed)</option>
                  <option value="Other">Other Channel</option>
                </select>
              </div>

              <div>
                <label htmlFor="salaryInput" className="block text-[11px] font-mono text-slate-400 mb-1">
                  <span>Salary / Stipend Offered</span>
                </label>
                <input
                  id="salaryInput"
                  type="text"
                  disabled={isLoading}
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Rs 15,000 per month"
                  className="w-full bg-[#050816] border border-cyan-500/20 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="websiteInput" className="block text-[11px] font-mono text-slate-400 mb-1">
                  <span>Company Website</span>
                </label>
                <input
                  id="websiteInput"
                  type="text"
                  disabled={isLoading}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  maxLength={300}
                  placeholder="e.g. www.company.com"
                  className="w-full bg-[#050816] border border-cyan-500/20 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Your history stays in this browser. The service also keeps a copy of each check so administrators can monitor accuracy.</span>
          </div>

          <button
            type="submit"
            disabled={isLoading || !text.trim() || text.trim().length < 20}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5 ${
              isLoading || !text.trim() || text.trim().length < 20
                ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/50'
                : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:via-blue-500 hover:to-purple-500 text-white shadow-[0_0_25px_rgba(56,189,248,0.35)] hover:shadow-[0_0_35px_rgba(56,189,248,0.6)] hover:scale-[1.02] active:scale-[0.99] border border-cyan-300/40 cursor-pointer'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Running Deep Threat Scan...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5 drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]" />
                <span className="drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                  Check This Job
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </motion.form>
    </div>
  );
};

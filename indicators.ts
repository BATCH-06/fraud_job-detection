// Shared types for warning signs (used by the rule engine, company verification, server and browser).

export type IndicatorCategory =
  | 'FEE_DEMAND'
  | 'COMPENSATION_ANOMALY'
  | 'URGENCY_PRESSURE'
  | 'SUSPICIOUS_COMMUNICATION'
  | 'SENSITIVE_DATA_HARVESTING'
  | 'INTERVIEW_OMISSION'
  | 'SUSPICIOUS_PAYMENT_METHODS'
  | 'LEXICAL_ANOMALIES'
  | 'COMPANY_VERIFICATION';

export interface FlaggedIndicator {
  id: string;
  category: IndicatorCategory;
  label: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  evidenceSnippet: string;
  matchedKeywords: string[];
}

export interface ExtractedEntities {
  emails: string[];
  phones: string[];
  telegramHandles: string[];
  upiIds: string[];
  urls: string[];
  moneyMentions: string[];
}

export interface VerificationCheck {
  id: string;
  area: 'Company' | 'Contact' | 'Website';
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  detail: string;
}

export interface CompanyVerificationResult {
  verdict: 'Verified' | 'Unverified' | 'Suspicious' | 'Not enough details';
  summary: string;
  checks: VerificationCheck[];
  flags: FlaggedIndicator[];
  checkedDomains: string[];
  onlineChecks: 'completed' | 'partial' | 'unavailable' | 'skipped';
}

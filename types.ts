import type { FlaggedIndicator, ExtractedEntities, CompanyVerificationResult, VerificationCheck } from '../server/indicators';
export type { FlaggedIndicator, ExtractedEntities, CompanyVerificationResult, VerificationCheck };

export interface AIModelResult {
  isAvailable: boolean;
  modelName: string;
  category?: 'Genuine' | 'Suspicious' | 'Fraudulent';
  confidenceScore?: number;
  semanticAnalysis?: string;
  linguisticObservations?: string[];
  identifiedRedFlags?: string[];
  verdictRationale?: string;
  recommendedAction?: string;
  note?: string;
}

export interface AnalysisResponse {
  recordId: string;
  timestamp: string;
  finalVerdict: {
    riskCategory: 'Genuine' | 'Suspicious' | 'Fraudulent';
    riskScore: number;
    summary: string;
    recommendations: string[];
  };
  heuristicEngine: {
    score: number;
    riskCategory: 'Genuine' | 'Suspicious' | 'Fraudulent';
    flags: FlaggedIndicator[];
    extractedEntities: ExtractedEntities;
    heuristicSummary: string;
  };
  companyVerification?: CompanyVerificationResult;
  aiModelEngine: AIModelResult;
  saved?: boolean;
  metadata: {
    companyName?: string;
    jobTitle?: string;
    senderInfo?: string;
    channel?: string;
    salary?: string;
    website?: string;
  };
  raw_text?: string;
}

export interface AnalysisRecordItem {
  id: string;
  timestamp: string;
  job_title: string;
  company_name: string;
  sender_info: string;
  channel: string;
  salary?: string;
  website?: string;
  company_verification?: CompanyVerificationResult | null;
  risk_category: 'Genuine' | 'Suspicious' | 'Fraudulent';
  risk_score: number;
  heuristic_score: number;
  model_score: number | null;
  summary: string;
  raw_text: string;
  flags: FlaggedIndicator[];
  recommendations: string[];
  model_verdict: AIModelResult | null;
  is_starred: number;
}

export interface SystemStatus {
  status: string;
  environment: string;
  database: {
    engine: string;
    status: string;
    storage: string;
    persistent?: boolean;
  };
  companyVerification?: { status: string; liveChecks: boolean };
  accounts?: { enabled: boolean; adminConfigured: boolean };
  nlpEngine: {
    status: string;
    rulesCount: number;
    categories: string[];
  };
  aiModel: {
    modelName: string;
    keyConfigured: boolean;
    mode: string;
  };
}

export interface DatabaseStats {
  totalScans: number;
  categoryCounts: {
    Genuine: number;
    Suspicious: number;
    Fraudulent: number;
  };
  avgRiskScore: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin';
}

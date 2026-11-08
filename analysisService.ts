// The full check pipeline from the project's activity and sequence diagrams:
//   Submit -> Preprocess -> NLP/AI analysis -> Verify company -> Check fraud indicators -> Risk score -> Classify -> Save -> Display

import { insertRecord, AnalysisRecord } from './db.js';
import { runHeuristicNLPAnalysis, AnalysisMetadata } from './nlpRules.js';
import { runAIModelClassification } from './aiClassifier.js';
import { cleanText, extractEntities, looksLikeJobPosting, MAX_TEXT_LENGTH, MIN_TEXT_LENGTH } from './preprocess.js';
import { verifyCompanyOffline } from './companyChecks.js';
import { addOnlineChecks, DomainLookup, lookupDomain } from './companyLookup.js';

export interface AnalyzeOutcome { status: number; body: any; }

const META_LIMITS: Record<keyof AnalysisMetadata, number> = { companyName: 200, jobTitle: 200, senderInfo: 300, channel: 100, salary: 100, website: 300 };

/** Validate and clean the optional details. Returns an error message if a value is not text. */
export function cleanMetadata(input: any): { ok: true; metadata: AnalysisMetadata } | { ok: false; error: string } {
  const metadata: AnalysisMetadata = {};
  for (const key of Object.keys(META_LIMITS) as (keyof AnalysisMetadata)[]) {
    const v = input?.[key];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'string') return { ok: false, error: `The "${key}" detail must be plain text.` };
    const t = cleanText(v);
    if (t.length > META_LIMITS[key]) return { ok: false, error: `The "${key}" detail is too long (maximum ${META_LIMITS[key]} characters).` };
    if (t) metadata[key] = t;
  }
  return { ok: true, metadata };
}

export async function analyzeJobPosting(
  input: { text: unknown; details?: any },
  opts: { userId: string | null; lookup?: DomainLookup; online?: boolean }
): Promise<AnalyzeOutcome> {
  const text = input.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { status: 400, body: { error: 'Please paste a job advertisement before continuing.' } };
  }
  if (text.length > MAX_TEXT_LENGTH * 2) {
    return { status: 413, body: { error: `The text is too long. Please paste at most ${MAX_TEXT_LENGTH.toLocaleString('en-US')} characters.` } };
  }
  const cleaned = cleanText(text);
  if (cleaned.length < MIN_TEXT_LENGTH) {
    return { status: 400, body: { error: `The advertisement text is a bit too short. Please paste at least a couple of sentences (minimum ${MIN_TEXT_LENGTH} letters) so we can check it.` } };
  }
  if (cleaned.length > MAX_TEXT_LENGTH) {
    return { status: 413, body: { error: `The text is too long. Please paste at most ${MAX_TEXT_LENGTH.toLocaleString('en-US')} characters.` } };
  }
  const meta = cleanMetadata(input.details);
  if (!meta.ok) return { status: 400, body: { error: meta.error } };
  const metadata = meta.metadata;

  // Verify company details (contact e-mail, website, company name), then run the indicator rules with those findings
  const entities = extractEntities(cleaned);
  let verification = verifyCompanyOffline({ text: cleaned, companyName: metadata.companyName, website: metadata.website, senderInfo: metadata.senderInfo, entities });
  verification = await addOnlineChecks(verification, opts.lookup ?? lookupDomain, opts.online);
  const heuristic = runHeuristicNLPAnalysis(cleaned, metadata, verification.flags);

  // Text with no job wording and no warning signs is not something we can judge
  if (heuristic.flags.length === 0 && !looksLikeJobPosting(cleaned).isJobLike) {
    return { status: 422, body: { error: 'This text does not look like a job or internship offer, so we cannot judge it. Please paste the full message you received (the role, pay, contact details and what they ask you to do).' } };
  }

  const aiResult = await runAIModelClassification(cleaned, metadata);

  let finalScore: number;
  let finalCategory: 'Genuine' | 'Suspicious' | 'Fraudulent';
  let finalSummary: string;
  const hasCritical = heuristic.flags.some(f => f.severity === 'CRITICAL');

  if (aiResult.isAvailable && typeof aiResult.confidenceScore === 'number') {
    let weighted = Math.round(heuristic.heuristicScore * 0.5 + aiResult.confidenceScore * 0.5);
    if (hasCritical) weighted = Math.max(weighted, 80);
    finalScore = Math.min(Math.max(weighted, 0), 100);
    if (finalScore >= 70 || hasCritical || aiResult.category === 'Fraudulent') {
      finalCategory = 'Fraudulent';
      finalSummary = 'High Risk: This job offer contains serious warning signs commonly seen in scams, such as asking for money or promising unrealistic pay. We strongly advise against paying anything or sharing personal details.';
    } else if (finalScore >= 20 || aiResult.category === 'Suspicious') {
      finalCategory = 'Suspicious';
      finalSummary = 'Needs Careful Checking: This offer has several unusual or unverified details. Please verify the employer through their official website or college placement office before taking the next step.';
    } else {
      finalCategory = 'Genuine';
      finalSummary = 'Low Risk: We did not find common scam warning signs. This looks like a standard recruitment message. As a general rule, always confirm offers on the company\'s official website.';
    }
  } else {
    finalScore = heuristic.heuristicScore;
    finalCategory = heuristic.riskCategory;
    finalSummary = finalCategory === 'Fraudulent'
      ? 'High Risk: We found serious warning signs in this advertisement (such as requests for fees or suspicious contact methods). Never send money to secure a job.'
      : finalCategory === 'Suspicious'
        ? 'Needs Careful Checking: Some details look unusual or unverified. Please take extra care and verify the sender before sharing private details.'
        : 'Low Risk: No common scam warning signs were found in this text. It looks like standard, professional communication.';
  }

  const recommendations = [...heuristic.recommendations];
  if (aiResult.isAvailable && aiResult.recommendedAction && !recommendations.includes(aiResult.recommendedAction)) recommendations.unshift(aiResult.recommendedAction);

  const recordId = `check-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();
  const record: AnalysisRecord = {
    id: recordId,
    timestamp,
    job_title: metadata.jobTitle || 'Job / Internship Offer',
    company_name: metadata.companyName || (heuristic.extractedEntities.emails[0] ? `From: ${heuristic.extractedEntities.emails[0]}` : 'Unspecified Company'),
    sender_info: metadata.senderInfo || heuristic.extractedEntities.emails.join(', ') || 'Direct message',
    channel: metadata.channel || 'Direct Message',
    salary: metadata.salary || '',
    website: metadata.website || '',
    risk_category: finalCategory,
    risk_score: finalScore,
    heuristic_score: heuristic.heuristicScore,
    model_score: aiResult.isAvailable ? aiResult.confidenceScore ?? null : null,
    summary: finalSummary,
    raw_text: text.trim(),
    flags_json: JSON.stringify(heuristic.flags),
    recommendations_json: JSON.stringify(recommendations),
    model_verdict_json: aiResult.isAvailable ? JSON.stringify(aiResult) : null,
    company_verification_json: JSON.stringify(verification),
    is_starred: finalCategory === 'Fraudulent' ? 1 : 0,
    user_id: opts.userId
  };

  let saved = true;
  try { insertRecord(record); } catch (err) { saved = false; console.warn('[Storage] Could not save this check:', err); }

  return {
    status: 200,
    body: {
      recordId,
      timestamp,
      saved,
      finalVerdict: { riskCategory: finalCategory, riskScore: finalScore, summary: finalSummary, recommendations },
      heuristicEngine: { score: heuristic.heuristicScore, riskCategory: heuristic.riskCategory, flags: heuristic.flags, extractedEntities: heuristic.extractedEntities, heuristicSummary: heuristic.heuristicSummary },
      companyVerification: verification,
      aiModelEngine: aiResult,
      metadata,
      raw_text: text.trim()
    }
  };
}

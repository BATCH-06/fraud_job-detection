import { GoogleGenAI, Type } from '@google/genai';

export interface AIModelClassificationResult {
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

export async function runAIModelClassification(
  text: string,
  metadata?: {
    companyName?: string;
    jobTitle?: string;
    senderInfo?: string;
    channel?: string;
  }
): Promise<AIModelClassificationResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      isAvailable: false,
      modelName: 'gemini-3.1-flash-lite',
      note: 'AI Model was not executed because GEMINI_API_KEY is not configured in server secrets. Analysis relies on the deterministic NLP Heuristic Rule Engine.'
    };
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const prompt = `You are an academic NLP cybercrime researcher and fraud classification model.
Analyze this job advertisement / internship offer / recruitment message:

Metadata provided:
- Claimed Company: ${metadata?.companyName || 'Not specified'}
- Job Role: ${metadata?.jobTitle || 'Not specified'}
- Sender / Contact: ${metadata?.senderInfo || 'Not specified'}
- Recruitment Channel: ${metadata?.channel || 'Not specified'}

Offer / Message Body:
"""
${text}
"""

Evaluate the text for:
1. Deceptive linguistic patterns, emotional urgency, manipulation tactics.
2. Financial exploitation traps (registration fees, security bonds, laptop shipping, paid kits).
3. Contact integrity (free webmail, Telegram / WhatsApp anonymity, domain spoofing).
4. Compensation plausibility vs role complexity.
5. Interview omission or direct hire anomalies.

Classify strictly into one of three categories:
- 'Genuine': Legitimate recruitment with normal enterprise procedures.
- 'Suspicious': Irregularities, lacking verification, high pressure, or unverified channels.
- 'Fraudulent': Clear indicators of employment scam, fee demand, task scam, or identity phishing.`;

  // We try fast gemini-3.1-flash-lite first for rapid inference, falling back to gemini-3.8-flash
  const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

  for (const model of candidateModels) {
    try {
      const generatePromise = ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          systemInstruction: 'You are an objective NLP cyber-security model designed for university research on fake job offer detection. Deliver precise, evidence-based threat classifications.',
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: "Must be exactly 'Genuine', 'Suspicious', or 'Fraudulent'"
              },
              confidenceScore: {
                type: Type.INTEGER,
                description: "Probability percentage from 0 (completely genuine) to 100 (definite fraud)"
              },
              semanticAnalysis: {
                type: Type.STRING,
                description: "Detailed linguistic and semantic breakdown of the text"
              },
              linguisticObservations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Bullet points detailing tone, urgency, deception cues, or professional syntax"
              },
              identifiedRedFlags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of specific warning signs found by the model"
              },
              verdictRationale: {
                type: Type.STRING,
                description: "Summary explanation justifying the assigned category and risk score"
              },
              recommendedAction: {
                type: Type.STRING,
                description: "Primary recommendation for the student candidate"
              }
            },
            required: ['category', 'confidenceScore', 'semanticAnalysis', 'linguisticObservations', 'identifiedRedFlags', 'verdictRationale', 'recommendedAction']
          }
        }
      });

      // 8-second timeout per model
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Inference timeout after 8000ms')), 8000)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const responseText = response.text?.trim() || '{}';
      const parsed = JSON.parse(responseText);

      let normCategory: 'Genuine' | 'Suspicious' | 'Fraudulent' = 'Suspicious';
      if (parsed.category === 'Genuine' || parsed.category === 'Suspicious' || parsed.category === 'Fraudulent') {
        normCategory = parsed.category;
      } else if (parsed.confidenceScore >= 70) {
        normCategory = 'Fraudulent';
      } else if (parsed.confidenceScore <= 30) {
        normCategory = 'Genuine';
      }

      return {
        isAvailable: true,
        modelName: model,
        category: normCategory,
        confidenceScore: Math.min(Math.max(Number(parsed.confidenceScore) || 50, 0), 100),
        semanticAnalysis: parsed.semanticAnalysis || 'Semantic classification completed.',
        linguisticObservations: Array.isArray(parsed.linguisticObservations) ? parsed.linguisticObservations : [],
        identifiedRedFlags: Array.isArray(parsed.identifiedRedFlags) ? parsed.identifiedRedFlags : [],
        verdictRationale: parsed.verdictRationale || 'Model analysis completed successfully.',
        recommendedAction: parsed.recommendedAction || 'Exercise caution and verify company through official channels.'
      };
    } catch (err: any) {
      console.warn(`Model ${model} attempt failed:`, err?.message || err);
      // Try next candidate model
    }
  }

  return {
    isAvailable: false,
    modelName: 'gemini-3.1-flash-lite',
    note: 'AI Model service was temporarily unavailable or timed out. System safely defaulted to deterministic NLP Heuristic Rule Engine.'
  };
}

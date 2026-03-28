import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * GEMINI API SERVICE WITH INTELLIGENT ROTATION
 * ============================================
 * 
 * This service implements a sophisticated API key and model rotation algorithm:
 * 
 * API KEYS:
 * - Supports 3 API keys (GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3)
 * - Rotates through keys when all model families are exhausted
 * 
 * MODEL FAMILIES:
 * - Each family has shared quota (e.g., gemini-3-flash, gemini-2.5-flash, gemini-2.5-flash-lite)
 * - Different families are used for different tasks (disease detection, document analysis, audio)
 * 
 * ROTATION LOGIC:
 * 1. Start with first model in first family with first API key
 * 2. If internal server error (500): Try next model in SAME family
 * 3. If quota exceeded (429): Skip to NEXT family (different quota)
 * 4. If all families exhausted: Move to NEXT API key and restart from first family
 * 5. Continue until successful or all keys/models exhausted
 * 
 * FEATURES FOR EACH USE CASE:
 * - Disease Detection: gemini-3-flash → gemini-2.5-flash → gemini-2.5-flash-lite
 * - Document Analysis: gemini-3-flash → gemini-2.5-flash-lite
 * - Audio Transcription: gemini-2.5-flash-lite → gemini-2.5-flash-native → gemini-2.5-flash → gemini-3-flash
 */

type GeminiRole = 'user' | 'model';

export type SupportedLanguageCode = 'en' | 'hi' | 'bn';

export interface DocumentAnalysisResult {
  summary: string;
  keyPoints: string[];
  actionRequired: string;
}

export interface GeminiChatTurn {
  role: GeminiRole;
  text: string;
}

const LANGUAGE_NAME: Record<SupportedLanguageCode, string> = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
};

const DEFAULT_MODEL = 'gemini-3-flash-preview';

const DEFAULT_VISION_MODEL = 'gemini-3-flash-preview';

// ============ MODEL FAMILIES & ROTATION ============

interface ModelFamily {
  name: string;
  models: string[];
}

// Disease detection model families
const DISEASE_DETECTION_FAMILIES: ModelFamily[] = [
  {
    name: 'gemini-3-flash',
    models: ['gemini-3-flash-preview'],
  },
  {
    name: 'gemini-2.5-flash',
    models: [
      'gemini-2.5-flash',
      'gemini-2.5-flash-preview-09-2025',
      'gemini-2.5-flash-image',
    ],
  },
  {
    name: 'gemini-2.5-flash-lite',
    models: ['gemini-2.5-flash-lite'],
  },
];

// Document analysis model families
const DOCUMENT_ANALYSIS_FAMILIES: ModelFamily[] = [
  {
    name: 'gemini-3-flash',
    models: ['gemini-3-flash-preview'],
  },
  {
    name: 'gemini-2.5-flash-lite',
    models: ['gemini-2.5-flash-lite'],
  },
];

// Product validation model families (image analysis)
const PRODUCT_VALIDATION_FAMILIES: ModelFamily[] = [
  {
    name: 'gemini-3-flash',
    models: ['gemini-3-flash-preview'],
  },
  {
    name: 'gemini-2.5-flash',
    models: [
      'gemini-2.5-flash',
      'gemini-2.5-flash-preview-09-2025',
      'gemini-2.5-flash-image',
    ],
  },
  {
    name: 'gemini-2.5-flash-lite',
    models: ['gemini-2.5-flash-lite'],
  },
];

// Chat conversation model families
const CHAT_FAMILIES: ModelFamily[] = [
  {
    name: 'gemini-3-flash',
    models: ['gemini-3-flash-preview'],
  },
  {
    name: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-preview-09-2025'],
  },
  {
    name: 'gemini-2.5-flash-lite',
    models: ['gemini-2.5-flash-lite'],
  },
];

// Crop prediction model families
const CROP_PREDICTION_FAMILIES: ModelFamily[] = [
  {
    name: 'gemini-3-flash',
    models: ['gemini-3-flash-preview'],
  },
  {
    name: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-preview-09-2025'],
  },
];

interface ApiCallOptions {
  apiKeys: string[];
  modelFamilies: ModelFamily[];
  requestBody: any;
  endpoint: string;
}

/**
 * Advanced API rotation algorithm:
 * 1. Try each model in a family
 * 2. If model gets internal server error (500), try next model in same family
 * 3. If family quota exceeded (429), skip to next family
 * 4. After all families exhausted on one API key, move to next API key
 * 5. Repeat process with new API key
 */
const callWithRotation = async (options: ApiCallOptions): Promise<any> => {
  const { apiKeys, modelFamilies, requestBody, endpoint } = options;
  
  if (apiKeys.length === 0) {
    throw new Error('No API keys available');
  }
  
  let lastError: Error | null = null;
  
  // Iterate through each API key
  for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
    const apiKey = apiKeys[keyIndex];
    console.log(`Trying API key ${keyIndex + 1}/${apiKeys.length}`);
    
    // Iterate through each model family
    for (let familyIndex = 0; familyIndex < modelFamilies.length; familyIndex++) {
      const family = modelFamilies[familyIndex];
      console.log(`Trying family: ${family.name} (${family.models.length} models)`);
      
      let familyQuotaExceeded = false;
      
      // Iterate through each model in the family
      for (let modelIndex = 0; modelIndex < family.models.length; modelIndex++) {
        const model = family.models[modelIndex];
        console.log(`Attempting with model: ${model}`);
        
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            model
          )}:${endpoint}?key=${encodeURIComponent(apiKey)}`;
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
          
          const json = await response.json().catch(() => ({}));
          
          if (!response.ok) {
            const errorMessage = json?.error?.message || '';
            const status = response.status;
            
            console.log(`Model ${model} failed with status ${status}: ${errorMessage}`);
            
            // Check for quota exceeded (429 or explicit quota error)
            if (
              status === 429 || 
              errorMessage.toLowerCase().includes('quota') || 
              errorMessage.toLowerCase().includes('resource exhausted') ||
              errorMessage.toLowerCase().includes('rate limit')
            ) {
              console.log(`Family ${family.name} quota exceeded, moving to next family`);
              familyQuotaExceeded = true;
              lastError = new Error(`Quota exceeded for family ${family.name}`);
              break; // Break model loop, move to next family
            }
            
            // Check for internal server error (500-599)
            if (status >= 500 && status < 600) {
              console.log(`Internal server error for ${model}, trying next model in family`);
              lastError = new Error(`Server error (${status}) for ${model}: ${errorMessage}`);
              continue; // Try next model in same family
            }
            
            // For other errors (4xx except 429), try next model
            lastError = new Error(errorMessage || `Request failed (${status})`);
            continue;
          }
          
          // Success!
          console.log(`✓ Success with API key ${keyIndex + 1}, family ${family.name}, model ${model}`);
          return json;
          
        } catch (error: any) {
          console.error(`Error with model ${model}:`, error.message);
          lastError = error;
          
          // If it's a network error, continue to next model
          continue;
        }
      }
      
      // If family quota exceeded, move to next family (already broke out of model loop)
      if (familyQuotaExceeded) {
        continue;
      }
    }
    
    // All families exhausted for this API key, try next API key
    console.log(`All families exhausted for API key ${keyIndex + 1}, moving to next key`);
  }
  
  // All API keys and models exhausted
  throw lastError || new Error('All API keys and models exhausted. Please try again later.');
};

const getEnv = (key: string): string | undefined => {
  // Expo only auto-injects EXPO_PUBLIC_* into the client bundle.
  // We keep a fallback for non-Expo environments.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (process?.env as any)?.[key];
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return undefined;
};

const getApiKeys = (): string[] => {
  const keys: string[] = [];
  
  // Try to get all three API keys
  for (let i = 1; i <= 3; i++) {
    const keyName = `GEMINI_API_KEY_${i}`;
    const fromEnv = getEnv(keyName);
    if (fromEnv) {
      keys.push(fromEnv);
      continue;
    }
    
    // Read from Expo config (injected via app.config.js -> extra)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extra: any = (Constants as any)?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra;
    const fromExtra = typeof extra?.[keyName] === 'string' ? extra[keyName].trim() : undefined;
    if (fromExtra) {
      keys.push(fromExtra);
    }
  }
  
  // Fallback to old single key for backward compatibility
  if (keys.length === 0) {
    const fromPublic = getEnv('EXPO_PUBLIC_GEMINI_API_KEY');
    if (fromPublic) keys.push(fromPublic);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extra: any = (Constants as any)?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra;
    const fromExtra = typeof extra?.GEMINI_API_KEY === 'string' ? extra.GEMINI_API_KEY.trim() : undefined;
    if (fromExtra) keys.push(fromExtra);
    
    const fallback = getEnv('GEMINI_API_KEY');
    if (fallback) keys.push(fallback);
  }
  
  return keys.filter(Boolean);
};

const getApiKey = (): string | undefined => {
  const keys = getApiKeys();
  return keys.length > 0 ? keys[0] : undefined;
};

const isSupportedLanguage = (lang: string): lang is SupportedLanguageCode => {
  return lang === 'en' || lang === 'hi' || lang === 'bn';
};

const coerceLanguage = (lang: string): SupportedLanguageCode => {
  return isSupportedLanguage(lang) ? lang : 'en';
};

const getDocumentMimeType = (fileNameOrUri: string, providedMimeType?: string): string => {
  if (providedMimeType && providedMimeType.trim().length > 0) return providedMimeType.trim();

  const lower = fileNameOrUri.toLowerCase();
  const extension = (lower.split('.').pop() || '').trim();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
};

const fileToBase64 = async (uri: string): Promise<string> => {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
  } catch (error) {
    console.error('Error converting file to base64:', error);
    throw new Error('Failed to read image file');
  }
};

const buildSystemInstruction = (language: SupportedLanguageCode): string => {
  const languageName = LANGUAGE_NAME[language];

  return [
    `You are an AI assistant for farmers worldwide, with a strong focus on India.`,
    `Your scope is LIMITED to agriculture and farming.`,
    `Allowed topics include: crops, plants, seeds, soil health, irrigation, fertilizers and manures, pests and diseases, weed management, weather and climate impact on farming, farm machinery and tools, sustainable and organic practices, post-harvest handling and storage, basic market guidance, and government or institutional agricultural schemes.`,
    `Agriculture statistics and trends are IN SCOPE: "most grown crops", cropped area, production share, seasonal patterns, and typical state-wise crop dominance.`,
    `When the user's location is India (or not specified), prioritize Indian conditions, crops, seasons, climates, practices, and government schemes.`,
    `When the user's location is outside India, tailor advice to that country or region if information is available; otherwise, give general best-practice guidance and clearly state any limitations.`,
    `Always respond in ${languageName}.`,
    `If the user asks anything clearly outside agriculture or farming (such as personal matters, coding, entertainment, etc.), politely refuse and redirect the conversation back to farming by suggesting 2–3 relevant agriculture-related example questions. Do NOT answer off-topic requests.`,
    `IMPORTANT: Do NOT falsely label agriculture questions as off-topic. If the question is about crops/farming in any way, answer it.`,
    `When giving advice, ask 1–3 clarifying questions if necessary (for example: crop type, country/state/district, season, soil type, irrigation method, or observed symptoms).`,
    `Use plain text with clear line breaks. Use bullet points or numbered lists when helpful.`,
    `Do not invent exact facts, prices, policies, or news.`,
    `If asked for year-specific stats (e.g., "in 2025 which crop is farmed the most"), answer with best-effort general ranking and explain uncertainty. Ask whether they mean India overall or a specific state. Suggest authoritative sources for exact figures (DAC&FW, NSSO, Directorate of Economics & Statistics, state agri dept).`,
    `If asked for "latest news", real-time prices, or time-sensitive updates, clearly say you cannot access live data. Suggest reliable sources such as government agriculture departments, extension services, official market portals, or meteorological agencies (e.g., IMD for India), and then provide a general, non-time-sensitive overview if possible.`,
    `If you do not know an answer or lack sufficient information, say so clearly and explain what additional details are needed.`,
    `Do not cut off mid-sentence. If the response is long and must stop, end by asking the user to say "continue".`
  ].join(' ');
};

const toGeminiContents = (turns: GeminiChatTurn[]) => {
  return turns.map((t) => ({
    role: t.role,
    parts: [{ text: t.text }],
  }));
};

export const getGeminiChatResponse = async (params: {
  userText: string;
  language: string;
  history: GeminiChatTurn[];
}): Promise<string> => {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error(
      'Missing Gemini API key. Set GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3 in .env for Expo.'
    );
  }

  const language = coerceLanguage(params.language);

  // Keep prompt size in check: send last ~12 turns.
  const trimmedHistory = params.history.slice(-12);
  const turns: GeminiChatTurn[] = [...trimmedHistory, { role: 'user', text: params.userText }];

  const requestBody = {
    systemInstruction: {
      parts: [{ text: buildSystemInstruction(language) }],
    },
    contents: toGeminiContents(turns),
    generationConfig: {
      temperature: 0.3,
      topP: 0.85,
      maxOutputTokens: 2048,
    },
  };

  const json = await callWithRotation({
    apiKeys,
    modelFamilies: CHAT_FAMILIES,
    requestBody,
    endpoint: 'generateContent',
  });

  const text = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text)
    .filter(Boolean)
    .join('');

  if (typeof text === 'string' && text.trim().length > 0) return text.trim();
  throw new Error('Gemini returned an empty response');
};

// ============ DOCUMENT ANALYSIS VIA GEMINI VISION ============

export const isGeminiConfigured = (): boolean => {
  return !!getApiKey();
};

export const analyzeDocument = async (params: {
  fileUri: string;
  fileName: string;
  mimeType?: string;
  language?: string;
}): Promise<DocumentAnalysisResult> => {
  const { fileUri, fileName, mimeType, language = 'en' } = params;

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error('Missing Gemini API key. Set GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3 in .env file.');
  }

  const targetLanguage = coerceLanguage(language);
  const languageName = LANGUAGE_NAME[targetLanguage];
  const detectedMimeType = getDocumentMimeType(fileName || fileUri, mimeType);

  // Validate file type - accept both images and PDFs
  const isImage = detectedMimeType.startsWith('image/');
  const isPDF = detectedMimeType === 'application/pdf';
  
  if (!isImage && !isPDF) {
    throw new Error('Only image files (JPG, PNG, WEBP) and PDF documents are supported for analysis.');
  }

  const documentBase64 = await fileToBase64(fileUri);

  const fileTypeText = isPDF ? 'PDF document' : 'image of a document';
  const prompt = `You are an expert document analyzer for farmers, especially in India.

IMPORTANT:
- Respond ONLY in ${languageName}.
- Respond as STRICT JSON only (no markdown, no extra text, no code blocks).
- The user provided a ${fileTypeText}.

Your job:
1) Carefully read and identify what the document is (e.g., loan notice, KCC, land record, insurance policy, mandi receipt, government scheme letter, fertilizer invoice, soil test report, subsidy letter, lease agreement, etc.).
2) Extract ALL important details farmers care about: dates, amounts, deadlines, reference numbers, names, crop/land details, bank/office names, account numbers, and any required steps.
3) List EVERY key point separately - do not miss any important information.
4) Give clear, practical next steps that help the farmer.

Return JSON exactly in this shape:
{
  "summary": "One comprehensive paragraph (8-12 sentences) in ${languageName} that explains the entire document in simple terms for a farmer. Include document type, issuing authority, purpose, and all critical information.",
  "keyPoints": ["List EVERY important detail as separate points. Include: document type, dates, amounts, reference numbers, names, deadlines, requirements, and specific terms. Aim for 5-10 points depending on document complexity. Each point should be clear and specific in ${languageName}."],
  "actionRequired": "Clear, step-by-step actions the farmer should take (with specific deadlines if present). If no action needed, say 'Keep this document safe for your records' in ${languageName}."
}

CRITICAL RULES:
- Extract EVERY piece of important information - do not summarize or skip details
- Each keyPoint should be a distinct, specific piece of information
- Include ALL dates, amounts, reference numbers, and names found in the document
- If the document is unclear or illegible, still return valid JSON and ask for a clearer copy
- Ensure all text is in ${languageName} as specified
- Do NOT wrap the JSON in markdown code blocks - return pure JSON only`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: `You are an expert document analyzer for farmers. Always respond in ${languageName}. Return ONLY valid JSON without any markdown formatting or code blocks.` }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: detectedMimeType,
              data: documentBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.9,
      maxOutputTokens: 3072,
    },
  };

  const json = await callWithRotation({
    apiKeys,
    modelFamilies: DOCUMENT_ANALYSIS_FAMILIES,
    requestBody,
    endpoint: 'generateContent',
  });

  const contentText = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text)
    .filter(Boolean)
    .join('')
    ?.trim();

  if (!contentText) {
    throw new Error('No response received from Gemini');
  }

  try {
    // Remove markdown code blocks if present
    let cleanText = contentText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // Extract JSON object
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    const raw = jsonMatch ? jsonMatch[0] : cleanText;
    const parsed = JSON.parse(raw);
    
    // Validate and return with proper defaults
    return {
      summary:
        typeof parsed?.summary === 'string' && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : 'Unable to extract summary from the document. Please ensure the document is clear and readable.',
      keyPoints: Array.isArray(parsed?.keyPoints) && parsed.keyPoints.length > 0
        ? parsed.keyPoints.map((x: unknown) => String(x).trim()).filter(Boolean)
        : ['No key points could be extracted from the document. Please try uploading a clearer version.'],
      actionRequired:
        typeof parsed?.actionRequired === 'string' && parsed.actionRequired.trim().length > 0
          ? parsed.actionRequired.trim()
          : 'Keep this document safe for your records.',
    };
  } catch (parseError) {
    console.error('Error parsing Gemini response:', parseError);
    console.error('Raw response:', contentText);
    return {
      summary: 'The document analysis could not be completed. Please ensure you uploaded a clear, readable document or PDF file.',
      keyPoints: [
        'Upload a high-quality image or PDF',
        'Ensure all text is visible and not cut off',
        'Make sure the document is well-lit and in focus',
        'For PDFs, ensure they are not password-protected or corrupted'
      ],
      actionRequired: 'Re-upload the document with better quality for accurate analysis',
    };
  }
};

// ============ CROP PREDICTION VIA GEMINI ============

export interface CropPredictionInput {
  cropType: string;
  acres: string;
  plantingDate: string;
  harvestDate: string;
  soilType: string;
  farmingMethod: string;
  additionalInfo: string;
  location: string;
}

export interface CropPredictionResult {
  expectedYield: string;
  cropHealth: string;
  riskLevel: string;
  waterRequirement: string;
  fertilizerSuggestion: string;
  harvestReadiness: string;
  recommendations: string;
}

// ============ CROP DISEASE DETECTION VIA GEMINI ============

export interface CropDiseaseInput {
  imageUri: string;
  cropType: string;
  cropAge: string;
  weather: string;
}

export interface CropDiseaseResult {
  diseaseName: string;
  severity: 'low' | 'medium' | 'high';
  treatment: string;
  prevention: string;
  healthPercentage: number;
  recoveryChance: 'low' | 'medium' | 'high';
  isNotCrop?: boolean;
  warningMessage?: string;
}

// ============ PRODUCT VALIDATION INTERFACES ============

export interface ProductValidationInput {
  imageUri: string;
  productName: string;
}

export interface ProductValidationResult {
  isValid: boolean;
  validatedName: string; // Corrected product name in singular English form
  reason: string; // Explanation of validation decision
  category?: string; // Food category (vegetables, fruits, grains, etc.)
}

/**
 * Get crop prediction from Gemini AI
 * @param input - Crop prediction input data
 * @param language - Target language for response (en, hi, bn)
 * @returns Crop prediction results
 */
export const getCropPrediction = async (params: {
  input: CropPredictionInput;
  language: string;
}): Promise<CropPredictionResult> => {
  const { input, language } = params;

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error('Missing Gemini API key. Set GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3 in .env file.');
  }

  const langCode = coerceLanguage(language);
  const languageName = LANGUAGE_NAME[langCode];

  // Build detailed prompt for crop prediction
  const prompt = `You are an expert agricultural AI assistant specializing in crop yield prediction and farming advice for India.

FARMER'S CROP INFORMATION:
- Crop Type: ${input.cropType}
- Farm Size: ${input.acres} acres
- Planting Date: ${input.plantingDate}
- Expected Harvest Date: ${input.harvestDate}
- Soil Type: ${input.soilType}
- Farming Method: ${input.farmingMethod}
- Location: ${input.location}
${input.additionalInfo ? `- Additional Information: ${input.additionalInfo}` : ''}

IMPORTANT INSTRUCTIONS:
1. Respond ONLY in ${languageName}
2. Return STRICT JSON format only (no markdown, no extra text)
3. Base predictions on Indian agricultural conditions and practices
4. Consider the specific location's climate, rainfall patterns, and growing conditions
5. Provide practical, actionable recommendations

Analyze the above crop information and provide predictions in this EXACT JSON format:
{
  "expectedYield": "Estimated yield range in Quintals per acre (e.g., '18-22 Quintals/acre')",
  "cropHealth": "Overall health assessment (Excellent/Good/Fair/Poor)",
  "riskLevel": "Risk assessment (Low/Medium/High)",
  "waterRequirement": "Water needs assessment (Low/Medium/High)",
  "fertilizerSuggestion": "Recommended fertilizer type (e.g., 'Nitrogen-based', 'NPK 10:26:26', 'Organic compost')",
  "harvestReadiness": "Harvest timing assessment (Early/On Time/Delayed)",
  "recommendations": "2-3 specific, actionable recommendations for the farmer (as a single paragraph in ${languageName})"
}

Consider factors like:
- Typical yield for this crop in the specified location
- Soil compatibility with the crop
- Seasonal timing and climate conditions
- Farming method effectiveness
- Common risks and mitigation strategies`;

  const requestBody = {
    systemInstruction: {
      parts: [{
        text: `You are an expert agricultural AI for Indian farmers. Always respond in ${languageName}. Return JSON only.`
      }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      topP: 0.85,
      maxOutputTokens: 2048,
    },
  };

  const json = await callWithRotation({
    apiKeys,
    modelFamilies: CROP_PREDICTION_FAMILIES,
    requestBody,
    endpoint: 'generateContent',
  });

  const contentText = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text)
    .filter(Boolean)
    .join('')
    ?.trim();

  if (!contentText) {
    throw new Error('No response received from Gemini');
  }

  try {
    // Extract JSON from response (handle markdown code blocks if present)
    const jsonMatch = contentText.match(/\{[\s\S]*\}/);
    const raw = jsonMatch ? jsonMatch[0] : contentText;
    const parsed = JSON.parse(raw);

    return {
      expectedYield: parsed?.expectedYield || 'Not available',
      cropHealth: parsed?.cropHealth || 'Good',
      riskLevel: parsed?.riskLevel || 'Medium',
      waterRequirement: parsed?.waterRequirement || 'Medium',
      fertilizerSuggestion: parsed?.fertilizerSuggestion || 'Consult local expert',
      harvestReadiness: parsed?.harvestReadiness || 'On Time',
      recommendations: parsed?.recommendations || 'Follow standard farming practices for your crop and region.',
    };
  } catch (parseError) {
    console.error('Error parsing Gemini prediction response:', parseError);
    throw new Error('Failed to parse prediction results. Please try again.');
  }
};

/**
 * Detect crop disease from image using Gemini Vision AI
 * @param input - Crop disease input data including image and context
 * @param language - Target language for response (en, hi, bn)
 * @returns Crop disease analysis results
 */
// ============ SPEECH-TO-TEXT VIA GEMINI ============

// Audio transcription model families
const AUDIO_TRANSCRIPTION_FAMILIES: ModelFamily[] = [
  {
    name: 'gemini-2.5-flash-lite',
    models: [
      'gemini-2.5-flash-lite-preview-09-2025',
      'gemini-2.5-flash-lite',
    ],
  },
  {
    name: 'gemini-2.5-flash-native',
    models: ['gemini-2.5-flash-native-audio-preview-12-2025'],
  },
  {
    name: 'gemini-2.5-flash',
    models: [
      'gemini-2.5-flash-preview-09-2025',
      'gemini-2.5-flash',
    ],
  },
  {
    name: 'gemini-3-flash',
    models: ['gemini-3-flash-preview'],
  },
];

export const transcribeAudio = async (params: {
  audioUri: string;
  language: string;
}): Promise<string> => {
  const { audioUri, language } = params;

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error('Missing Gemini API key. Set GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3 in .env file.');
  }

  const langCode = coerceLanguage(language);
  const languageName = LANGUAGE_NAME[langCode];

  // Convert audio file to base64
  const audioBase64 = await fileToBase64(audioUri);

  const prompt = `You are a speech-to-text transcription service. 
Transcribe the audio into text in ${languageName}.
Return ONLY the transcribed text, nothing else.
Do not add any explanations, labels, or formatting.`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'audio/m4a',
              data: audioBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 1024,
    },
  };

  const json = await callWithRotation({
    apiKeys,
    modelFamilies: AUDIO_TRANSCRIPTION_FAMILIES,
    requestBody,
    endpoint: 'generateContent',
  });

  const contentText = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text)
    .filter(Boolean)
    .join('')
    ?.trim();

  if (!contentText) {
    throw new Error('No transcription received from Gemini');
  }

  console.log(`Successfully transcribed audio`);
  return contentText;
};

export const detectCropDisease = async (params: {
  input: CropDiseaseInput;
  language: string;
}): Promise<CropDiseaseResult> => {
  const { input, language } = params;

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error('Missing Gemini API key. Set GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3 in .env file.');
  }

  const langCode = coerceLanguage(language);
  const languageName = LANGUAGE_NAME[langCode];

  // Convert image to base64
  const imageBase64 = await fileToBase64(input.imageUri);
  const mimeType = getDocumentMimeType(input.imageUri);

  // Build detailed prompt for disease detection
  const prompt = `You are an expert plant pathologist with 20+ years of experience in crop disease diagnosis, specializing in Indian agricultural conditions.

CROP INFORMATION:
- Crop Type: ${input.cropType || 'Not specified'}
${input.cropAge ? `- Crop Age: ${input.cropAge} days` : ''}
- Recent Weather: ${input.weather}

FIRST - IMAGE VALIDATION:
Before analyzing, determine if the image shows a crop, plant, or any agricultural/farming-related content.
If the image is NOT related to farming (e.g., person, animal, building, vehicle, food item, random object), respond with:
{
  "isNotCrop": true,
  "warningMessage": "Brief message in ${languageName} explaining this is not a crop/plant image",
  "diseaseName": "N/A",
  "severity": "low",
  "treatment": "N/A",
  "prevention": "N/A",
  "healthPercentage": 0,
  "recoveryChance": "low"
}

CRITICAL ANALYSIS INSTRUCTIONS (Only if image IS a crop/plant):
1. CAREFULLY examine the provided crop image for visible symptoms
2. Look for specific signs: leaf spots, discoloration (yellow, brown, black), wilting, lesions, powdery/fuzzy growth, holes, curling, stunting, or rot
3. Identify the EXACT disease based on visual symptoms - do NOT guess or generalize
4. Consider crop-specific diseases common in India:
   - Rice: Blast, Bacterial Leaf Blight, Sheath Blight, Brown Spot
   - Wheat: Rust (Yellow/Brown/Black), Powdery Mildew, Leaf Blight
   - Potato: Late Blight, Early Blight, Black Scurf, Common Scab
5. Factor in weather conditions: ${input.weather} weather influences fungal, bacterial, and viral diseases
6. If NO clear disease symptoms are visible, state "Healthy Crop" or "No Disease Detected"

OUTPUT FORMAT - Return ONLY valid JSON (no markdown, no code blocks):
{
  "isNotCrop": false,
  "diseaseName": "Specific disease name in ${languageName} based on actual visual symptoms, or 'Healthy Crop' if no disease",
  "severity": "low OR medium OR high",
  "treatment": "Specific treatment with chemical names (e.g., Mancozeb 75% WP @ 2g/L, Copper Oxychloride, Carbendazim) and application method in ${languageName}",
  "prevention": "Concrete preventive practices: crop rotation, spacing, drainage, resistant varieties, timing in ${languageName}",
  "healthPercentage": 0-100,
  "recoveryChance": "low OR medium OR high"
}

ACCURACY RULES:
- Base diagnosis ONLY on visible symptoms in the image
- Match symptoms to known disease patterns
- Severity: "high" = >50% leaf area affected or critical symptoms; "medium" = 20-50% affected; "low" = <20% affected
- healthPercentage: Estimate based on visible damage (not affected area ÷ total visible area)
- recoveryChance: "high" if caught early with good treatment; "medium" if moderate stage; "low" if advanced/systemic
- Treatment MUST include specific fungicide/pesticide/biocontrol names used in India
- If image shows healthy crop, return: diseaseName="Healthy Crop", severity="low", healthPercentage=95-100, recoveryChance="high"

Respond in ${languageName}. Return JSON only.`;

  const requestBody = {
    systemInstruction: {
      parts: [{
        text: `You are an expert plant disease diagnostician for Indian farmers. Always respond in ${languageName}. Return JSON only.`
      }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1, // Very low temperature for maximum accuracy
      topP: 0.8,
      topK: 20,
      maxOutputTokens: 2048,
    },
  };

  const json = await callWithRotation({
    apiKeys,
    modelFamilies: DISEASE_DETECTION_FAMILIES,
    requestBody,
    endpoint: 'generateContent',
  });

  const contentText = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text)
    .filter(Boolean)
    .join('')
    ?.trim();

  if (!contentText) {
    throw new Error('No response received from Gemini');
  }

  try {
    // Extract JSON from response (handle markdown code blocks if present)
    const jsonMatch = contentText.match(/\{[\s\S]*\}/);
    const raw = jsonMatch ? jsonMatch[0] : contentText;
    const parsed = JSON.parse(raw);

    // Check if image is not a crop
    if (parsed?.isNotCrop === true) {
      return {
        diseaseName: 'Not a Crop',
        severity: 'low',
        treatment: '',
        prevention: '',
        healthPercentage: 0,
        recoveryChance: 'low',
        isNotCrop: true,
        warningMessage: parsed?.warningMessage || 'This image does not appear to be a crop or plant.',
      };
    }

    // Validate and sanitize the response
    const severity = ['low', 'medium', 'high'].includes(parsed?.severity?.toLowerCase()) 
      ? parsed.severity.toLowerCase() 
      : 'medium';
    
    const recoveryChance = ['low', 'medium', 'high'].includes(parsed?.recoveryChance?.toLowerCase())
      ? parsed.recoveryChance.toLowerCase()
      : 'medium';
    
    const healthPercentage = typeof parsed?.healthPercentage === 'number' 
      ? Math.max(0, Math.min(100, parsed.healthPercentage))
      : 70;

    return {
      diseaseName: parsed?.diseaseName || 'Disease Detected',
      severity: severity as 'low' | 'medium' | 'high',
      treatment: parsed?.treatment || 'Consult with a local agricultural expert for proper treatment.',
      prevention: parsed?.prevention || 'Maintain good field hygiene and monitor crops regularly.',
      healthPercentage: healthPercentage,
      recoveryChance: recoveryChance as 'low' | 'medium' | 'high',
      isNotCrop: false,
    };
  } catch (parseError) {
    console.error('Error parsing Gemini disease detection response:', parseError);
    throw new Error('Failed to analyze the crop image. Please try again with a clearer photo.');
  }
};

// ============ PRODUCT VALIDATION VIA GEMINI VISION ============

/**
 * Validate farmer product upload (image + name) using Gemini Vision AI
 * Checks if image is food and corrects product name to singular English form
 * @param input - Product validation input (image URI and product name)
 * @returns Validation result with corrected product name or rejection
 */
export const validateProductUpload = async (
  input: ProductValidationInput
): Promise<ProductValidationResult> => {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error('Missing Gemini API key. Set GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3 in .env file.');
  }

  // Convert image to base64
  const imageBase64 = await fileToBase64(input.imageUri);
  const mimeType = getDocumentMimeType(input.imageUri);

  // Build detailed prompt for product validation
  const prompt = `You are an AI assistant helping farmers sell their agricultural products safely. Your job is to validate product uploads.

FARMER'S INPUT:
- Product Name/Text: "${input.productName}"
- Product Image: [Provided]

YOUR TASK:
1. IMAGE VALIDATION:
   - Analyze the image to determine if it shows any food item, agricultural produce, or farm product
   - Valid items: vegetables, fruits, grains, pulses, spices, dairy products, eggs, meat, fish, processed foods, etc.
   - INVALID items: people, animals (unless for sale like livestock), buildings, vehicles, random objects, non-food items, inappropriate content

2. TEXT VALIDATION:
   - The farmer may write the product name in ANY language (English, Hindi, Bengali, regional languages, etc.)
   - The farmer may misspell or use informal names (e.g., "pututu" for "potato", "aalu" for "potato", "tamatar" for "tomato")
   - Analyze if the text refers to ANY food or agricultural product
   - Consider: common misspellings, transliterations, regional names, colloquial terms
   - REJECT if text is completely random, nonsensical, or offensive

3. CROSS-VALIDATION:
   - Check if the image and text match or are both food-related
   - If image shows food but text is random: REJECT (safety check)
   - If image is non-food but text mentions food: REJECT (safety check)
   - If BOTH are food-related (even if different items): VALIDATE and use the product shown in the IMAGE

4. NAME CORRECTION:
   - Convert the product name to proper English
   - Use SINGULAR form only (e.g., "potato" not "potatoes", "tomato" not "tomatoes")
   - Use standard/common name (e.g., "eggplant" or "brinjal", "okra" or "lady finger")
   - Capitalize only the first letter (e.g., "Potato", "Tomato", "Red onion")

RESPONSE FORMAT - Return ONLY valid JSON (no markdown, no code blocks):
{
  "isValid": true/false,
  "validatedName": "Corrected product name in singular English form with first letter capitalized (e.g., 'Potato', 'Tomato')",
  "reason": "Brief explanation of decision in English",
  "category": "Category like 'Vegetable', 'Fruit', 'Grain', 'Pulse', 'Spice', 'Dairy', 'Other' (only if valid)"
}

VALIDATION EXAMPLES:
✓ VALID: Image=potato, Text="pututu" → isValid=true, validatedName="Potato"
✓ VALID: Image=tomato, Text="टमाटर" (Hindi) → isValid=true, validatedName="Tomato"
✓ VALID: Image=rice, Text="chawal" → isValid=true, validatedName="Rice"
✓ VALID: Image=wheat, Text="wheat grains" → isValid=true, validatedName="Wheat"
✗ INVALID: Image=person, Text="potato" → isValid=false, reason="Image does not show food"
✗ INVALID: Image=potato, Text="asdfgh" → isValid=false, reason="Product name is not recognizable as food"
✗ INVALID: Image=car, Text="car" → isValid=false, reason="Not a food or agricultural product"

CRITICAL RULES:
- Be lenient with misspellings and language variations for genuine food items
- Be strict with non-food images regardless of text
- Always provide validatedName in singular English form if valid
- Prioritize safety: if uncertain, REJECT the upload

Return ONLY the JSON object, nothing else.`;

  const requestBody = {
    systemInstruction: {
      parts: [{
        text: 'You are a product validation AI for agricultural marketplaces. Return JSON only.'
      }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1, // Low temperature for consistent validation
      topP: 0.8,
      topK: 20,
      maxOutputTokens: 1024,
    },
  };

  const json = await callWithRotation({
    apiKeys,
    modelFamilies: PRODUCT_VALIDATION_FAMILIES,
    requestBody,
    endpoint: 'generateContent',
  });

  const contentText = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text)
    .filter(Boolean)
    .join('')
    ?.trim();

  if (!contentText) {
    throw new Error('No response received from Gemini');
  }

  try {
    // Extract JSON from response (handle markdown code blocks if present)
    const jsonMatch = contentText.match(/\{[\s\S]*\}/);
    const raw = jsonMatch ? jsonMatch[0] : contentText;
    const parsed = JSON.parse(raw);

    // Validate response structure
    const isValid = parsed?.isValid === true;
    const validatedName = typeof parsed?.validatedName === 'string' 
      ? parsed.validatedName.trim() 
      : input.productName;
    const reason = typeof parsed?.reason === 'string'
      ? parsed.reason.trim()
      : (isValid ? 'Product validated successfully' : 'Product validation failed');
    const category = typeof parsed?.category === 'string' ? parsed.category.trim() : undefined;

    return {
      isValid,
      validatedName,
      reason,
      category,
    };
  } catch (parseError) {
    console.error('Error parsing Gemini product validation response:', parseError);
    console.error('Raw response:', contentText);
    
    // If parsing fails, reject for safety
    return {
      isValid: false,
      validatedName: input.productName,
      reason: 'Unable to validate product. Please try again with a clear image and proper product name.',
    };
  }
};


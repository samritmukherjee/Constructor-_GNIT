import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';

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

const getEnv = (key: string): string | undefined => {
  // Expo only auto-injects EXPO_PUBLIC_* into the client bundle.
  // We keep a fallback for non-Expo environments.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (process?.env as any)?.[key];
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return undefined;
};

const getApiKey = (): string | undefined => {
  const fromPublic = getEnv('EXPO_PUBLIC_GEMINI_API_KEY');
  if (fromPublic) return fromPublic;

  // Read from Expo config (injected via app.config.js -> extra)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extra: any = (Constants as any)?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra;
  const fromExtra = typeof extra?.GEMINI_API_KEY === 'string' ? extra.GEMINI_API_KEY.trim() : undefined;
  if (fromExtra) return fromExtra;

  // Fallback for non-Expo environments
  return getEnv('GEMINI_API_KEY');
};

const getModel = (): string => {
  return getEnv('EXPO_PUBLIC_GEMINI_MODEL') ?? DEFAULT_MODEL;
};

const getVisionModel = (): string => {
  return getEnv('EXPO_PUBLIC_GEMINI_VISION_MODEL') ?? DEFAULT_VISION_MODEL;
};

const isSupportedLanguage = (lang: string): lang is SupportedLanguageCode => {
  return lang === 'en' || lang === 'hi' || lang === 'bn';
};

const coerceLanguage = (lang: string): SupportedLanguageCode => {
  return isSupportedLanguage(lang) ? lang : 'en';
};

const getImageMimeType = (fileNameOrUri: string, providedMimeType?: string): string => {
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

const callGemini = async (params: {
  apiKey: string;
  model: string;
  language: SupportedLanguageCode;
  turns: GeminiChatTurn[];
}): Promise<string> => {
  const { apiKey, model, language, turns } = params;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildSystemInstruction(language) }],
      },
      contents: toGeminiContents(turns),
      generationConfig: {
        temperature: 0.3,
        topP: 0.85,
        maxOutputTokens: 2048,
      },
    }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof json?.error?.message === 'string'
        ? json.error.message
        : `Gemini request failed (${res.status})`;
    const error = new Error(message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).status = res.status;
    throw error;
  }

  const text = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text)
    .filter(Boolean)
    .join('');

  if (typeof text === 'string' && text.trim().length > 0) return text.trim();
  throw new Error('Gemini returned an empty response');
};

export const getGeminiChatResponse = async (params: {
  userText: string;
  language: string;
  history: GeminiChatTurn[];
}): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'Missing Gemini API key. Set EXPO_PUBLIC_GEMINI_API_KEY in .env for Expo.'
    );
  }

  const language = coerceLanguage(params.language);

  // Keep prompt size in check: send last ~12 turns.
  const trimmedHistory = params.history.slice(-12);
  const turns: GeminiChatTurn[] = [...trimmedHistory, { role: 'user', text: params.userText }];

  const model = getModel();
  return await callGemini({ apiKey, model, language, turns });
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

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Set GEMINI_API_KEY in .env file.');
  }

  const targetLanguage = coerceLanguage(language);
  const languageName = LANGUAGE_NAME[targetLanguage];
  const detectedMimeType = getImageMimeType(fileName || fileUri, mimeType);

  if (!detectedMimeType.startsWith('image/')) {
    throw new Error('Currently only image files (JPG, PNG, WEBP) are supported for analysis.');
  }

  const imageBase64 = await fileToBase64(fileUri);
  const model = getVisionModel();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt = `You are an expert document analyzer for farmers, especially in India.

IMPORTANT:
- Respond ONLY in ${languageName}.
- Respond as STRICT JSON only (no markdown, no extra text).
- The user provided an image of a document.

Your job:
1) Identify what the document is (e.g., loan notice, KCC, land record, insurance policy, mandi receipt, government scheme letter, fertilizer invoice, soil test report, etc.).
2) Extract the most important details farmers care about: dates, amounts, deadlines, reference numbers, names, crop/land details, bank/office names, and any required steps.
3) Give clear, practical next steps that help the farmer.

Return JSON exactly in this shape:
{
  "summary": "One clear paragraph (6-10 sentences) in ${languageName} that explains the entire document in simple terms for a farmer",
  "keyPoints": ["3-7 bullet-like points with specific details"],
  "actionRequired": "Clear action the farmer should take (with deadlines if present)"
}

If the image is unclear or not a document, still return JSON and ask for a clearer photo (good lighting, full page visible, no blur).`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: `Always respond in ${languageName}. Return JSON only.` }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: detectedMimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.85,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof json?.error?.message === 'string'
        ? json.error.message
        : `Gemini request failed (${res.status})`;
    throw new Error(message);
  }

  const contentText = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text)
    .filter(Boolean)
    .join('')
    ?.trim();

  if (!contentText) {
    throw new Error('No response received from Gemini');
  }

  try {
    const jsonMatch = contentText.match(/\{[\s\S]*\}/);
    const raw = jsonMatch ? jsonMatch[0] : contentText;
    const parsed = JSON.parse(raw);
    return {
      summary:
        typeof parsed?.summary === 'string' && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : 'Unable to extract summary from the document.',
      keyPoints: Array.isArray(parsed?.keyPoints)
        ? parsed.keyPoints.map((x: unknown) => String(x))
        : ['No key points extracted'],
      actionRequired:
        typeof parsed?.actionRequired === 'string' && parsed.actionRequired.trim().length > 0
          ? parsed.actionRequired.trim()
          : 'No specific action required.',
    };
  } catch (parseError) {
    console.error('Error parsing Gemini response:', parseError);
    return {
      summary: contentText,
      keyPoints: ['Please upload a clearer image of the document (full page, good light, no blur).'],
      actionRequired: 'Upload a clearer document image for better analysis',
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

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Set GEMINI_API_KEY in .env file.');
  }

  const langCode = coerceLanguage(language);
  const languageName = LANGUAGE_NAME[langCode];

  const model = getModel(); // Uses gemini-2.5-flash as specified
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

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

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = json?.error?.message || `Gemini request failed (${response.status})`;
    console.error('Gemini crop prediction error:', json);
    throw new Error(errorMessage);
  }

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
export const detectCropDisease = async (params: {
  input: CropDiseaseInput;
  language: string;
}): Promise<CropDiseaseResult> => {
  const { input, language } = params;

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Set GEMINI_API_KEY in .env file.');
  }

  const langCode = coerceLanguage(language);
  const languageName = LANGUAGE_NAME[langCode];
  const model = getVisionModel();

  // Convert image to base64
  const imageBase64 = await fileToBase64(input.imageUri);
  const mimeType = getImageMimeType(input.imageUri);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

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

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = json?.error?.message || `Gemini request failed (${response.status})`;
    console.error('Gemini disease detection error:', json);
    throw new Error(errorMessage);
  }

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


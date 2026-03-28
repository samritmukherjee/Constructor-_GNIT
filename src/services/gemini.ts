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

export type LocalizedText3 = {
  en: string;
  hi: string;
  bn: string;
};

export interface GeneratedFarmingPlanV1 {
  version: 1;
  title: LocalizedText3;
  overview: LocalizedText3;
  crop: {
    cropType: string;
    cropName: string;
    areaAcres: number;
  };
  dates: {
    plantingDateISO: string; // YYYY-MM-DD
    expectedHarvestDateISO: string; // YYYY-MM-DD
  };
  wateringRules: Array<{
    startDay: number;
    endDay: number;
    everyDays: number;
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    timeHHmm?: string;
    title?: LocalizedText3;
    notes?: LocalizedText3;
  }>;
  recurringTasks: Array<{
    type: string;
    startDay: number;
    endDay: number;
    everyDays: number;
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    timeHHmm?: string;
    title: LocalizedText3;
    notes?: LocalizedText3;
  }>;
  oneOffTasks: Array<{
    type: string;
    dueDateISO: string; // YYYY-MM-DD
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    timeHHmm?: string;
    title: LocalizedText3;
    notes?: LocalizedText3;
  }>;
  preventiveMeasures?: LocalizedText3;
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
  timeoutMs?: number; // Optional timeout in milliseconds
}

/**
 * Creates a fetch request with timeout
 */
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs / 1000} seconds`);
    }
    throw error;
  }
};

/**
 * Advanced API rotation algorithm:
 * 1. Try each model in a family
 * 2. If model gets internal server error (500), try next model in same family
 * 3. If family quota exceeded (429), skip to next family
 * 4. After all families exhausted on one API key, move to next API key
 * 5. Repeat process with new API key
 */
const callWithRotation = async (options: ApiCallOptions): Promise<any> => {
  const { apiKeys, modelFamilies, requestBody, endpoint, timeoutMs = 45000 } = options;

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

          const response = await fetchWithTimeout(
            url,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            },
            timeoutMs
          );

          const responseText = await response.text();
          let json: any = {};

          if (responseText) {
            try {
              json = JSON.parse(responseText);
            } catch {
              // Keep raw text for diagnostics, but treat as invalid JSON.
              json = { __rawText: responseText };
            }
          }

          if (!response.ok) {
            const errorMessage = json?.error?.message || json?.message || responseText || '';
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

          // Some rare cases return a 200 but the body is empty or non-JSON.
          // Treat this as a retryable failure so we don't incorrectly log success.
          const isEmptyObject =
            json && typeof json === 'object' && !Array.isArray(json) && Object.keys(json).length === 0;

          if (isEmptyObject || json?.__rawText) {
            lastError = new Error(
              json?.__rawText
                ? 'Invalid JSON response body from Gemini'
                : 'Empty response body from Gemini'
            );
            console.log(`Model ${model} returned an invalid/empty body, trying next model`);
            continue;
          }

          if (
            endpoint === 'generateContent' &&
            (!Array.isArray(json?.candidates) || json.candidates.length === 0)
          ) {
            const blockReason = json?.promptFeedback?.blockReason;
            lastError = new Error(
              blockReason
                ? `Gemini returned no candidates (blocked: ${blockReason})`
                : 'Gemini returned no candidates'
            );
            console.log(`Model ${model} returned no candidates, trying next model`);
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

const extractLikelyJsonObject = (text: string): string => {
  const raw = (text || '').trim();
  if (!raw) return '';

  // Remove common code-fence wrappers.
  const withoutFences = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const first = withoutFences.indexOf('{');
  const last = withoutFences.lastIndexOf('}');
  if (first >= 0 && last > first) return withoutFences.slice(first, last + 1);
  return withoutFences;
};

const tryParseJsonLenient = (text: string): unknown => {
  const raw = extractLikelyJsonObject(text);
  if (!raw) throw new Error('Empty JSON');

  // Common model mistakes: smart quotes and trailing commas.
  const normalized = raw
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .trim();

  return JSON.parse(normalized);
};

const buildFarmingPlanSystemInstruction = (): string => {
  return [
    'You are an expert agronomist and farm planner.',
    'You will generate MATHEMATICAL SCHEDULING RULES that expand into daily tasks.',
    'Return STRICT JSON only (no markdown, no code fences, no extra text).',
    'All farmer-facing text (title, overview, task titles, notes) MUST be provided in ALL THREE languages: English (en), Hindi (hi), Bengali (bn).',
    'Use short, actionable sentences suitable for mobile UI.',
    'Do not invent exact prices, brands, or government policy numbers.',
    'CRITICAL: Use mathematical intervals (startDay, endDay, everyDays) - the system will automatically expand these into daily calendar entries.',
    'Include a time of day and HH:mm for every task and watering rule.',
    'If the user provided an expected harvest date, validate it against realistic crop duration and seasonality. If it is unrealistic, correct it and mention the correction in the overview.'
  ].join(' ');
};

export const generateLocalizedFarmingPlanV1 = async (params: {
  cropType: string;
  cropName: string;
  areaAcres: number;
  plantingDateISO: string;
  expectedHarvestDateISO?: string;
  country?: string;
  state?: string;
}): Promise<GeneratedFarmingPlanV1> => {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error(
      'Missing Gemini API key. Set GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3 in .env for Expo.'
    );
  }

  const country = (params.country || 'India').trim();
  const state = (params.state || '').trim();

  const prompt = [
    'Generate a MATHEMATICAL FARMING SCHEDULE as STRICT JSON with this exact schema:',
    '{',
    '  "version": 1,',
    '  "title": {"en":"Complete title in English","hi":"पूरा शीर्षक हिंदी में","bn":"সম্পূর্ণ শিরোনাম বাংলায়"},',
    '  "overview": {"en":"Full overview in English","hi":"पूर्ण विवरण हिंदी में","bn":"সম্পূর্ণ সারসংক্ষেপ বাংলায়"},',
    '  "crop": {"cropType":"...","cropName":"...","areaAcres": 0},',
    '  "dates": {"plantingDateISO":"YYYY-MM-DD","expectedHarvestDateISO":"YYYY-MM-DD"},',
    '  "wateringRules": [{"startDay":0,"endDay":30,"everyDays":2,"timeOfDay":"morning","timeHHmm":"07:00","title":{"en":"Early irrigation","hi":"प्रारंभिक सिंचाई","bn":"প্রাথমিক সেচ"},"notes":{"en":"Keep soil moist","hi":"मिट्टी को नम रखें","bn":"মাটি আর্দ্র রাখুন"}}],',
    '  "recurringTasks": [{"type":"fertilizer","startDay":15,"endDay":90,"everyDays":15,"timeOfDay":"morning","timeHHmm":"08:00","title":{"en":"Apply fertilizer","hi":"उर्वरक डालें","bn":"সার প্রয়োগ করুন"},"notes":{"en":"Use organic compost","hi":"जैविक खाद का उपयोग करें","bn":"জৈব সার ব্যবহার করুন"}}],',
    '  "oneOffTasks": [{"type":"field","dueDateISO":"YYYY-MM-DD","timeOfDay":"morning","timeHHmm":"06:00","title":{"en":"Land preparation","hi":"भूमि तैयारी","bn":"জমি প্রস্তুতি"},"notes":{"en":"Plow and level","hi":"जोतें और समतल करें","bn":"চাষ ও সমতল করুন"}}],',
    '  "preventiveMeasures": {"en":"English prevention tips","hi":"हिंदी में रोकथाम युक्तियाँ","bn":"বাংলায় প্রতিরোধ টিপস"}',
    '}',
    '',
    'MATHEMATICAL INTERVAL EXPLANATION:',
    '- startDay: days after planting (0 = planting day)',
    '- endDay: last day to perform this recurring task',
    '- everyDays: interval between repetitions (2 = every 2 days, 7 = weekly)',
    '- The calendar will show: day 0, day 2, day 4... or day 15, day 30, day 45...',
    '',
    'Farmer Inputs:',
    `- country: ${country}`,
    state ? `- state: ${state}` : '- state: (not provided)',
    `- cropType: ${params.cropType}`,
    `- cropName: ${params.cropName}`,
    `- areaAcres: ${params.areaAcres}`,
    `- plantingDateISO: ${params.plantingDateISO}`,
    params.expectedHarvestDateISO
      ? `- expectedHarvestDateISO: ${params.expectedHarvestDateISO} (user-provided; validate and correct if unrealistic)`
      : '- expectedHarvestDateISO: (not provided; estimate)',
    '',
    'CRITICAL RULES FOR MATHEMATICAL SCHEDULING:',
    '1. dates.expectedHarvestDateISO must be >= plantingDateISO + 1 day.',
    '2. Use MATHEMATICAL INTERVALS for recurring work:',
    '   - wateringRules: {startDay: 0, endDay: 30, everyDays: 2} means \"water every 2 days from day 0 to day 30\"',
    '   - recurringTasks: {startDay: 10, endDay: 90, everyDays: 7, type: \"fertilizer\"} means \"apply fertilizer every 7 days from day 10 to 90\"',
    '   - The system will AUTOMATICALLY generate individual calendar entries for each occurrence',
    '3. Use realistic, stage-based scheduling (germination, vegetative, flowering, maturation).',
    '4. Avoid unsafe pesticide instructions; keep it preventive and threshold-based.',
    '5. Provide a time of day (morning/afternoon/evening/night) and HH:mm for EVERY task.',
    '6. Examples of good mathematical rules:',
    '   - \"Irrigate every 3 days during first 30 days\" = {startDay: 0, endDay: 30, everyDays: 3}',
    '   - \"Apply fertilizer every 15 days from day 20 to harvest\" = {startDay: 20, endDay: <maturity>, everyDays: 15}',
    '   - \"Scout field weekly\" = {startDay: 7, endDay: <maturity>, everyDays: 7}',
    '7. Provide ALL text in English, Hindi, AND Bengali - no exceptions.',
    '8. Keep total rules reasonable (3-8 watering rules, 5-12 recurring tasks, 3-8 one-off milestone tasks).',
  ].join('\n');

  const baseRequestBody = {
    systemInstruction: {
      parts: [{ text: buildFarmingPlanSystemInstruction() }],
    },
    generationConfig: {
      temperature: 0.2,
      topP: 0.85,
      maxOutputTokens: 3072,
      // Ask Gemini for JSON-only output (supported by many Gemini models).
      responseMimeType: 'application/json',
    },
  };

  const attempts: Array<{ label: string; contents: any[] }> = [
    {
      label: 'initial',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    },
    {
      label: 'repair',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                prompt +
                '\n\nIMPORTANT: Your previous response was invalid JSON. Return ONLY valid JSON that matches the schema. No markdown. No extra text.',
            },
          ],
        },
      ],
    },
  ];

  let parsed: unknown = undefined;
  let lastText = '';

  for (const attempt of attempts) {
    const requestBody = {
      ...baseRequestBody,
      contents: attempt.contents,
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

    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Gemini returned an empty response');
    }

    lastText = text;

    try {
      parsed = tryParseJsonLenient(text);
      break;
    } catch (e) {
      console.log(`Farming plan JSON parse failed (${attempt.label})`);
      continue;
    }
  }

  if (!parsed) {
    console.log('Last farming plan raw response (truncated):', (lastText || '').slice(0, 800));
    throw new Error('Gemini returned invalid JSON for farming plan');
  }

  const plan = parsed as GeneratedFarmingPlanV1;
  if (plan?.version !== 1) throw new Error('Unsupported farming plan JSON version');
  if (!plan?.dates?.plantingDateISO || !plan?.dates?.expectedHarvestDateISO) {
    throw new Error('Gemini farming plan JSON missing required dates');
  }

  return plan;
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

ALLOWED DOCUMENT TYPES TO ANALYZE:
You MUST ONLY analyze documents that fall into these categories:
1. **Farming & Agriculture Related**: Fertilizer invoices, seed purchase receipts, pesticide bills, machinery invoices, harvest records, crop insurance documents, agricultural loan documents, farming contracts
2. **Weather & Climate Related**: Weather forecasts, rainfall records, temperature data, seasonal reports, climate advisories
3. **Environment Related**: Soil test reports, water quality reports, environmental compliance documents, land quality assessments
4. **Bank Related**: Loan notices, KCC (Kisan Credit Card) documents, bank statements, loan disbursement letters, agricultural credit documents, bank account statements, mortgage documents
5. **Government Scheme Related**: Subsidy letters, government aid documents, scheme registration papers, government notification letters, compensation letters, crop subsidy documents, pension scheme documents

If the document does NOT fall into any of the above categories, you MUST reject the analysis and return the rejection message in JSON format.

Your job:
1) First, identify what the document is and CHECK if it belongs to the allowed categories above.
2) If the document is NOT in the allowed categories, return JSON with a rejection message.
3) If the document IS in the allowed categories:
   - Carefully read and extract ALL important details farmers care about: dates, amounts, deadlines, reference numbers, names, crop/land details, bank/office names, account numbers, and any required steps.
   - List EVERY key point separately - do not miss any important information.
   - Give clear, practical next steps that help the farmer.

Return JSON exactly in this shape:
{
  "summary": "One comprehensive paragraph in ${languageName}. If the document is NOT allowed: 'This document is not related to farming, weather, environment, banking, or government schemes. This analyzer only provides analysis for agriculture-related documents, weather records, environmental reports, bank documents, and government scheme documents.' If document IS allowed: explain the entire document in simple terms for a farmer. Include document type, issuing authority, purpose, and all critical information.",
  "keyPoints": ["If NOT allowed: 'This analyzer only analyzes documents related to: Farming & Agriculture, Weather & Climate, Environment, Bank Services, and Government Schemes.' If allowed: List EVERY important detail as separate points. Include: document type, dates, amounts, reference numbers, names, deadlines, requirements, and specific terms. Aim for 5-10 points."],
  "actionRequired": "If NOT allowed: 'Please upload documents related to farming, weather, environment, bank services, or government schemes for analysis.' If allowed: Clear, step-by-step actions the farmer should take."
}

CRITICAL RULES:
- FIRST validate if the document is in the allowed categories
- If document is NOT allowed, clearly state this in the JSON response
- If document IS allowed, extract EVERY piece of important information - do not summarize or skip details
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

    // Check if this is a rejection response (document not allowed)
    const summary = typeof parsed?.summary === 'string' ? parsed.summary.trim() : '';
    const isRejection = summary.includes('not related to') || 
                       summary.includes('only analyzes') || 
                       summary.includes('not allowed') ||
                       summary.includes('only provides analysis');

    // Validate and return with proper defaults
    return {
      summary:
        summary.length > 0
          ? summary
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

// ============ DOCUMENT Q&A VIA GEMINI VISION ============

export const askQuestionAboutDocument = async (params: {
  fileUri: string;
  fileName: string;
  mimeType?: string;
  question: string;
  language?: string;
}): Promise<string> => {
  const { fileUri, fileName, mimeType, question, language = 'en' } = params;

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error('Missing Gemini API key. Set GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3 in .env file.');
  }

  const trimmedQuestion = String(question || '').trim();
  if (!trimmedQuestion) {
    throw new Error('Please enter a question.');
  }

  const targetLanguage = coerceLanguage(language);
  const languageName = LANGUAGE_NAME[targetLanguage];
  const detectedMimeType = getDocumentMimeType(fileName || fileUri, mimeType);

  const isImage = detectedMimeType.startsWith('image/');
  const isPDF = detectedMimeType === 'application/pdf';
  if (!isImage && !isPDF) {
    throw new Error('Only image files (JPG, PNG, WEBP) and PDF documents are supported.');
  }

  const documentBase64 = await fileToBase64(fileUri);
  const fileTypeText = isPDF ? 'PDF document' : 'image of a document';

  const prompt = `You are a helpful assistant for farmers, and you must answer questions ABOUT the provided document.

IMPORTANT:
- Respond ONLY in ${languageName}.
- Use ONLY information that is present in the document. Do not guess.
- If the question is NOT related to the document content, politely explain that you can only answer questions about this specific document.
- If the answer is not found in the document, clearly say it is not mentioned, and ask what detail the user wants to confirm.
- Keep the answer concise and practical. Use bullet points if helpful.

The user provided a ${fileTypeText}.

Question: ${trimmedQuestion}`;

  const requestBody = {
    systemInstruction: {
      parts: [
        {
          text: `You answer questions grounded in a document for farmers. Always respond in ${languageName}. Never invent facts that are not in the document. If a question is not related to the document, politely explain that you can only answer questions about the document content.`,
        },
      ],
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
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 1024,
    },
  };

  const json = await callWithRotation({
    apiKeys,
    modelFamilies: DOCUMENT_ANALYSIS_FAMILIES,
    requestBody,
    endpoint: 'generateContent',
  });

  const text = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text)
    .filter(Boolean)
    .join('')
    ?.trim();

  if (typeof text === 'string' && text.length > 0) return text;

  // Return a user-friendly message instead of throwing an error
  const languageMessages: Record<SupportedLanguageCode, string> = {
    en: "I can only answer questions about the content of this document. Please ask a question related to the information shown in the document.",
    hi: "मैं केवल इस दस्तावेज़ की सामग्री के बारे में प्रश्नों का उत्तर दे सकता हूं। कृपया दस्तावेज़ में दिखाई गई जानकारी से संबंधित प्रश्न पूछें।",
    bn: "আমি শুধুমাত্র এই নথির বিষয়বস্তু সম্পর্কে প্রশ্নের উত্তর দিতে পারি। অনুগ্রহ করে নথিতে দেখানো তথ্য সম্পর্কিত একটি প্রশ্ন জিজ্ঞাসা করুন।",
  };

  return languageMessages[targetLanguage] || languageMessages.en;
};

// ============ CROP PREDICTION VIA GEMINI ============

export interface CropPredictionInput {
  cropType: string;
  acres: string;
  sellingPricePerKgInr: string;
  plantingDate: string;
  harvestDate: string;
  // Optional helper from the client (derived from dates). Gemini can recompute if missing.
  growingPeriodDays?: number;
  soilType: string;
  farmingMethod: string;
  additionalInfo: string;
  location: string;
}

export interface CropPredictionResult {
  financialConfidence: {
    confidencePercent: number;
    predictedYieldKg: number;
    climateScore: number;
  };
  cropHealth: {
    healthPercent: number;
    status: string;
    notes: string;
  };
  financialProjection: {
    projectedRevenueInr: number;
    marketPricePerKgInr: number;
    yieldTons: number;
  };
  riskAnalysis: {
    soilHealth: string;
    climateCondition: string;
    additionalRisks: string;
  };
  recommendation: string;
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

  const toFiniteNumber = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  };

  const isFinitePositive = (value: number) => Number.isFinite(value) && value > 0;

  const extractContentText = (json: any): string => {
    console.log('Extracting content from Gemini response...');
    
    // Check for safety/filter issues that cause empty content
    const finishReason = json?.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.warn(`Response finished with reason: ${finishReason}`);
      // Still try to extract content even if finish reason indicates a problem
    }

    // Try to extract from standard candidates structure first
    const parts = json?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts) && parts.length > 0) {
      const joined = parts
        .map((p: { text?: unknown }) => (typeof p?.text === 'string' ? p.text : ''))
        .join('')
        .trim();
      if (joined) {
        console.log('Found content in candidates.content.parts');
        return joined;
      }
    }

    const direct = json?.candidates?.[0]?.content?.text;
    if (typeof direct === 'string' && direct.trim()) {
      console.log('Found content in candidates.content.text');
      return direct.trim();
    }

    const fallback = json?.candidates?.[0]?.text;
    if (typeof fallback === 'string' && fallback.trim()) {
      console.log('Found content in candidates.text');
      return fallback.trim();
    }

    const topLevel = json?.text;
    if (typeof topLevel === 'string' && topLevel.trim()) {
      console.log('Found content in top-level text');
      return topLevel.trim();
    }

    // When responseMimeType is 'application/json', some models return JSON directly
    // Check if the entire response is the JSON object we're expecting
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      // Check if it's already the expected structure (no candidates wrapper)
      if (json?.financialConfidence || json?.cropHealth || json?.financialProjection || 
          json?.riskAnalysis || json?.recommendation) {
        console.log('Found direct JSON response (no candidates wrapper)');
        return JSON.stringify(json);
      }
    }

    // Log detailed error info for debugging
    const contentObj = json?.candidates?.[0]?.content;
    const contentKeys = contentObj ? Object.keys(contentObj) : [];
    console.error('Failed to extract content. Content object keys:', contentKeys);
    console.error('Finish reason:', finishReason);
    console.error('Full response structure:', JSON.stringify(json, null, 2).substring(0, 800));
    return '';
  };

  const stripCodeFences = (text: string): string => {
    // Remove standalone ``` / ```json fence lines while preserving inner content.
    return (text || '').replace(/^\s*```(?:json)?\s*$/gim, '').trim();
  };

  const extractFirstJsonObject = (text: string): string | null => {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === '{') {
        depth++;
        continue;
      }

      if (ch === '}') {
        depth--;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }

    return null;
  };

  const buildBasePrompt = () => {
    const derivedDays =
      typeof input.growingPeriodDays === 'number' && Number.isFinite(input.growingPeriodDays)
        ? input.growingPeriodDays
        : null;

    return `You are an expert agricultural AI assistant specializing in crop yield, crop health, and financial outlook for Indian farmers.

FARMER'S CROP INFORMATION:
- Crop Type: ${input.cropType}
- Farm Size: ${input.acres} acres
- Expected Selling Price: ${input.sellingPricePerKgInr} INR per kg
- Planting Date: ${input.plantingDate}
- Expected Harvest Date: ${input.harvestDate}
${derivedDays !== null ? `- Crop Duration (derived): ${derivedDays} days` : ''}
- Soil Type: ${input.soilType}
- Farming Method: ${input.farmingMethod}
- Location: ${input.location}
${input.additionalInfo ? `- Additional Information: ${input.additionalInfo}` : ''}

IMPORTANT INSTRUCTIONS:
1. Respond ONLY in ${languageName}
2. Return STRICT JSON format only (no markdown, no extra text)
3. Make numbers realistic for Indian farming (avoid extreme values)
4. Use the farmer's Expected Selling Price as the primary reference for marketPricePerKgInr (keep it close unless clearly unrealistic)
5. Numeric fields MUST be numbers (not strings)
6. Validate the Expected Harvest Date against realistic crop duration and seasonality. If the date seems unrealistic (too short/long), adjust to a realistic window and mention the corrected expected harvest date in the recommendation. Use the corrected duration for calculations.
7. Use the Planting Date and Expected Harvest Date to infer the season (e.g., Kharif/Rabi/Zaid) and typical weather risks for that region.
  - Do NOT claim you have live weather/forecast access.
  - Use typical seasonal patterns for India and mention actionable weather risk mitigation.
7. Units:
   - predictedYieldKg: total yield for the given farm size in kilograms
   - yieldTons: total yield for the given farm size in metric tons
   - projectedRevenueInr: total projected revenue in INR
   - marketPricePerKgInr: market price per kg in INR
   - confidencePercent: 0-100
   - climateScore: 0-100
8. Internal consistency rules (must hold):
   - projectedRevenueInr must be approximately predictedYieldKg * marketPricePerKgInr (within 5% rounding)
   - yieldTons must be approximately predictedYieldKg / 1000

Analyze the above crop information and provide results in this EXACT JSON format:
{
  "financialConfidence": {
    "confidencePercent": 0,
    "predictedYieldKg": 0,
    "climateScore": 0
  },
  "cropHealth": {
    "healthPercent": 0,
    "status": "",
    "notes": ""
  },
  "financialProjection": {
    "projectedRevenueInr": 0,
    "marketPricePerKgInr": 0,
    "yieldTons": 0
  },
  "riskAnalysis": {
    "soilHealth": "",
    "climateCondition": "",
    "additionalRisks": ""
  },
  "recommendation": ""
}

For "recommendation":
- Write 4-6 VERY specific, practical actions tailored to the farmer's inputs
- Mention irrigation schedule, fertilizer plan, and a risk-mitigation step
- Keep it in ${languageName} and as one readable paragraph (no JSON arrays)

Keep all other text fields concise and actionable.`;
  };

  const callGeminiOnce = async (promptText: string) => {
    const requestBody = {
      systemInstruction: {
        parts: [{
          text: `You are an expert agricultural AI for Indian farmers. Always respond in ${languageName}. Return JSON only.`
        }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.85,
        maxOutputTokens: 3072,
        responseMimeType: 'application/json',
      },
    };

    const json = await callWithRotation({
      apiKeys,
      modelFamilies: CROP_PREDICTION_FAMILIES,
      requestBody,
      endpoint: 'generateContent',
      timeoutMs: 60000, // 60 second timeout for crop prediction (complex computation)
    });

    const contentText = extractContentText(json);
    if (!contentText) {
      const finishReason = json?.candidates?.[0]?.finishReason;
      const detailedError = finishReason === 'SAFETY' 
        ? 'Request was blocked for safety reasons. Please try with different input.'
        : finishReason && finishReason !== 'STOP'
        ? `Response generation stopped: ${finishReason}. Please try again.`
        : 'No response received from Gemini';
      throw new Error(detailedError);
    }

    return contentText;
  };

  const parseAndNormalize = (contentText: string): { result: CropPredictionResult; issues: string[]; raw: string } => {
    const cleaned = stripCodeFences(contentText);
    const raw = extractFirstJsonObject(cleaned) || cleaned;
    const parsed = JSON.parse(raw);

    const confidencePercent = toFiniteNumber(parsed?.financialConfidence?.confidencePercent);
    const predictedYieldKg = toFiniteNumber(parsed?.financialConfidence?.predictedYieldKg);
    const climateScore = toFiniteNumber(parsed?.financialConfidence?.climateScore);

    const healthPercent = toFiniteNumber(parsed?.cropHealth?.healthPercent);
    const cropHealthStatus = String(parsed?.cropHealth?.status ?? '').trim();
    const cropHealthNotes = String(parsed?.cropHealth?.notes ?? '').trim();

    const projectedRevenueInr = toFiniteNumber(parsed?.financialProjection?.projectedRevenueInr);
    const marketPricePerKgInr = toFiniteNumber(parsed?.financialProjection?.marketPricePerKgInr);
    const yieldTons = toFiniteNumber(parsed?.financialProjection?.yieldTons);

    const soilHealth = String(parsed?.riskAnalysis?.soilHealth ?? '').trim();
    const climateCondition = String(parsed?.riskAnalysis?.climateCondition ?? '').trim();
    const additionalRisks = String(parsed?.riskAnalysis?.additionalRisks ?? '').trim();

    const recommendation = String(parsed?.recommendation ?? '').trim();

    const issues: string[] = [];
    if (!isFinitePositive(predictedYieldKg)) issues.push('predictedYieldKg');
    if (!Number.isFinite(confidencePercent) || confidencePercent < 0 || confidencePercent > 100) issues.push('confidencePercent');
    if (!Number.isFinite(climateScore) || climateScore < 0 || climateScore > 100) issues.push('climateScore');
    if (!Number.isFinite(healthPercent) || healthPercent < 0 || healthPercent > 100) issues.push('healthPercent');
    if (!isFinitePositive(marketPricePerKgInr)) issues.push('marketPricePerKgInr');
    if (!isFinitePositive(projectedRevenueInr)) issues.push('projectedRevenueInr');
    if (!isFinitePositive(yieldTons)) issues.push('yieldTons');
    if (!soilHealth) issues.push('soilHealth');
    if (!climateCondition) issues.push('climateCondition');
    if (!additionalRisks) issues.push('additionalRisks');
    if (!recommendation) issues.push('recommendation');

    // Consistency checks: revenue ~= yieldKg * priceKg, yieldTons ~= yieldKg / 1000
    if (isFinitePositive(predictedYieldKg) && isFinitePositive(marketPricePerKgInr) && isFinitePositive(projectedRevenueInr)) {
      const expectedRevenue = predictedYieldKg * marketPricePerKgInr;
      if (expectedRevenue > 0) {
        const ratio = projectedRevenueInr / expectedRevenue;
        if (!Number.isFinite(ratio) || ratio < 0.95 || ratio > 1.05) {
          issues.push('revenueConsistency');
        }
      }
    }

    if (isFinitePositive(predictedYieldKg) && isFinitePositive(yieldTons)) {
      const expectedTons = predictedYieldKg / 1000;
      const diff = Math.abs(yieldTons - expectedTons);
      if (expectedTons > 0 && diff / expectedTons > 0.08) {
        issues.push('tonsConsistency');
      }
    }

    // Keep market price aligned with farmer input when available
    const farmerPrice = toFiniteNumber(input.sellingPricePerKgInr);
    if (isFinitePositive(farmerPrice) && isFinitePositive(marketPricePerKgInr)) {
      const delta = Math.abs(marketPricePerKgInr - farmerPrice) / farmerPrice;
      if (delta > 0.35) {
        issues.push('priceFarFromInput');
      }
    }

    // Sanity check for extreme market price values
    if (isFinitePositive(marketPricePerKgInr) && marketPricePerKgInr > 5000) {
      issues.push('priceExtreme');
    }

    return {
      result: {
        financialConfidence: {
          confidencePercent: Number.isFinite(confidencePercent) ? confidencePercent : 0,
          predictedYieldKg: Number.isFinite(predictedYieldKg) ? predictedYieldKg : 0,
          climateScore: Number.isFinite(climateScore) ? climateScore : 0,
        },
        cropHealth: {
          healthPercent: Number.isFinite(healthPercent) ? healthPercent : 0,
          status: cropHealthStatus || 'Not available',
          notes: cropHealthNotes || 'Not available',
        },
        financialProjection: {
          projectedRevenueInr: Number.isFinite(projectedRevenueInr) ? projectedRevenueInr : 0,
          marketPricePerKgInr: Number.isFinite(marketPricePerKgInr) ? marketPricePerKgInr : 0,
          yieldTons: Number.isFinite(yieldTons) ? yieldTons : 0,
        },
        riskAnalysis: {
          soilHealth: soilHealth || 'Not available',
          climateCondition: climateCondition || 'Not available',
          additionalRisks: additionalRisks || 'Not available',
        },
        recommendation: recommendation || 'Use local market rates and follow best practices for better outcomes.',
      },
      issues,
      raw,
    };
  };
  
  try {
    console.log('Starting crop prediction...');
    const firstText = await callGeminiOnce(buildBasePrompt());
    const firstParsed = parseAndNormalize(firstText);

    if (firstParsed.issues.length === 0) {
      console.log('Crop prediction successful on first attempt');
      return firstParsed.result;
    }

    console.log('First attempt had issues, requesting correction...');
    // One correction pass via Gemini (still Gemini-generated, but with stricter consistency requirements)
    const fixPrompt = `${buildBasePrompt()}

The previous JSON had issues in these fields: ${firstParsed.issues.join(', ')}.

Here is the previous JSON:
${firstParsed.raw}

Return a corrected JSON that:
- Fixes ONLY the inconsistent/invalid values
- Keeps numbers realistic
- Obeys the internal consistency rules exactly

Return JSON only.`;

    const fixedText = await callGeminiOnce(fixPrompt);
    const fixedParsed = parseAndNormalize(fixedText);
    console.log('Crop prediction successful after correction');
    return fixedParsed.result;
  } catch (error: any) {
    console.error('Error in crop prediction:', error);
    
    // Provide user-friendly error messages
    const errorMessage = error.message || '';
    
    if (errorMessage.includes('timeout')) {
      throw new Error('Request is taking too long. Please check your internet connection and try again.');
    }
    
    if (errorMessage.includes('No API keys') || errorMessage.includes('Missing Gemini API key')) {
      throw new Error('Service configuration error. Please contact support.');
    }
    
    if (errorMessage.includes('quota') || errorMessage.includes('exhausted')) {
      throw new Error('Service is currently busy. Please try again in a few moments.');
    }
    
    if (errorMessage.includes('blocked') || errorMessage.includes('SAFETY')) {
      throw new Error('Unable to process your request due to content restrictions. Please check your inputs.');
    }
    
    if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
      throw new Error('Unable to process the prediction results. Please try again.');
    }
    
    // Generic error fallback
    throw new Error('Unable to generate prediction. Please check your input and try again.');
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


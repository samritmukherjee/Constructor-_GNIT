import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  generateLocalizedFarmingPlanV1,
  isGeminiConfigured,
  LocalizedText3,
  SupportedLanguageCode,
} from './gemini';

export type FarmingTaskType =
  | 'watering'
  | 'fertilizer'
  | 'pest'
  | 'disease'
  | 'field'
  | 'harvest'
  | 'general';

export interface FarmingWateringRule {
  startDay: number; // days after planting (0-based)
  endDay: number; // inclusive
  everyDays: number;
  timeOfDay?: TimeOfDay;
  timeHHmm?: string;
  title?: string;
  titleI18n?: LocalizedText3;
  notes: string;
  notesI18n?: LocalizedText3;
}

export interface FarmingRecurringTaskRule {
  id: string;
  type: FarmingTaskType;
  title: string;
  titleI18n?: LocalizedText3;
  startDay: number;
  endDay: number;
  everyDays: number;
  timeOfDay?: TimeOfDay;
  timeHHmm?: string;
  notes?: string;
  notesI18n?: LocalizedText3;
}

export interface FarmingOneOffTask {
  id: string;
  type: FarmingTaskType;
  title: string;
  titleI18n?: LocalizedText3;
  dueDateISO: string; // YYYY-MM-DD
  timeOfDay?: TimeOfDay;
  timeHHmm?: string;
  notes?: string;
  notesI18n?: LocalizedText3;
}

export interface StoredFarmingPlan {
  id: string;
  cropType: string;
  cropName: string;
  areaAcres: number;
  planTitleI18n?: LocalizedText3;
  planOverviewI18n?: LocalizedText3;
  plantingDateISO: string;
  expectedHarvestDateISO: string;
  cleanupAfterISO: string;
  wateringRules: FarmingWateringRule[];
  recurringTasks: FarmingRecurringTaskRule[];
  tasks: FarmingOneOffTask[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: 'active' | 'completed';
  source?: string;
  generatedAt?: Timestamp;
  geminiGenerationAttemptedAt?: Timestamp;
  geminiGenerationError?: string;
}

export interface FarmingTaskInstance {
  planId: string;
  cropName: string;
  planTitle?: string;
  planExpectedHarvestDateISO?: string;
  type: FarmingTaskType;
  title: string;
  dueDateISO: string;
  timeOfDay?: TimeOfDay;
  timeHHmm?: string;
  notes?: string;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface FarmingTaskInstanceDetailed extends FarmingTaskInstance {
  timeOfDay: TimeOfDay;
  timeHHmm: string;
  waterAmountHint?: string;
}

export interface FarmingPlanSummary {
  id: string;
  cropName: string;
  cropType: string;
  areaAcres: number;
  plantingDateISO: string;
  expectedHarvestDateISO: string;
  status: 'active' | 'completed';
  planTitle: string;
  planOverview?: string;
  source?: string;
  updatedAtISO?: string;
  nextTaskDateISO?: string;
  nextTaskTitle?: string;
  nextTaskCountIn7Days?: number;
}

const normalizeLanguage = (lang?: string): SupportedLanguageCode => {
  const raw = (lang || '').trim().toLowerCase();
  if (raw === 'hi' || raw === 'hn') return 'hi';
  if (raw === 'bn') return 'bn';
  return 'en';
};

const pickI18n = (value: LocalizedText3 | undefined, lang: SupportedLanguageCode): string | undefined => {
  if (!value) return undefined;
  return (value as any)?.[lang] || value.en || value.hi || value.bn;
};

const toISODate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const clampISO = (iso: string, minISO: string, maxISO: string): string => {
  if (iso < minISO) return minISO;
  if (iso > maxISO) return maxISO;
  return iso;
};

const inferTimeOfDay = (type: FarmingTaskType): TimeOfDay => {
  switch (type) {
    case 'watering':
      return 'morning';
    case 'fertilizer':
      return 'morning';
    case 'pest':
      return 'evening';
    case 'disease':
      return 'morning';
    case 'field':
      return 'afternoon';
    case 'harvest':
      return 'morning';
    default:
      return 'afternoon';
  }
};

const defaultTimeHHmmForTimeOfDay = (tod: TimeOfDay): string => {
  switch (tod) {
    case 'morning':
      return '07:00';
    case 'afternoon':
      return '13:00';
    case 'evening':
      return '18:00';
    case 'night':
      return '20:30';
    default:
      return '13:00';
  }
};

const extractWaterAmountHint = (notes?: string): string | undefined => {
  const text = (notes || '').toLowerCase();
  if (!text) return undefined;

  // Try to capture common irrigation units from free-form notes.
  // Examples: "15-20 mm", "10 mm", "2-3 liters", "5 L"
  const mm = text.match(/(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*mm\b/);
  if (mm) {
    const a = mm[1];
    const b = mm[2];
    return b ? `${a}-${b} mm` : `${a} mm`;
  }

  const liters = text.match(/(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(?:l|litre|liter|liters|litres)\b/);
  if (liters) {
    const a = liters[1];
    const b = liters[2];
    return b ? `${a}-${b} L` : `${a} L`;
  }

  return undefined;
};

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const parseLooseDate = (value: string): Date | null => {
  const raw = (value || '').trim();
  if (!raw) return null;

  // Try ISO first.
  const iso = raw.match(/^\d{4}-\d{2}-\d{2}$/);
  if (iso) {
    const d = new Date(`${raw}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const normalized = raw
    .replace(/\s+/g, '')
    .replace(/\./g, '/')
    .replace(/\\/g, '/')
    .replace(/-/g, '/');

  // DD/MM/YYYY
  const ddmmyyyy = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const dd = Number(ddmmyyyy[1]);
    const mm = Number(ddmmyyyy[2]);
    const yyyy = Number(ddmmyyyy[3]);
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd) return d;
    return null;
  }

  // MM/DD/YYYY (fallback)
  const mmddyyyy = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const mm = Number(mmddyyyy[1]);
    const dd = Number(mmddyyyy[2]);
    const yyyy = Number(mmddyyyy[3]);
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd) return d;
    return null;
  }

  return null;
};

const sanitizeId = (value: string): string => {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
};

const inferMaturityDays = (cropNameOrType: string): number => {
  const c = (cropNameOrType || '').trim().toLowerCase();
  if (c.includes('rice') || c.includes('paddy')) return 120;
  if (c.includes('wheat')) return 120;
  if (c.includes('maize') || c.includes('corn')) return 100;
  if (c.includes('potato')) return 95;
  if (c.includes('tomato')) return 95;
  if (c.includes('onion')) return 125;
  if (c.includes('cotton')) return 160;
  if (c.includes('sugarcane')) return 330;
  return 110;
};

// ============ HEURISTIC PLAN TRANSLATIONS ============
// These translations are used when Gemini is not available and we fall back to heuristic plans

const HEURISTIC_TRANSLATIONS: Record<string, LocalizedText3> = {
  // Common titles
  'Field scouting (pests, disease, weeds, moisture)': {
    en: 'Field scouting (pests, disease, weeds, moisture)',
    hi: 'खेत का निरीक्षण (कीट, रोग, खरपतवार, नमी)',
    bn: 'ক্ষেত পর্যবেক্ষণ (পোকামাকড়, রোগ, আগাছা, আর্দ্রতা)',
  },
  'Check drainage & remove standing water (monsoon)': {
    en: 'Check drainage & remove standing water (monsoon)',
    hi: 'जल निकासी जांचें और जमा पानी हटाएं (मानसून)',
    bn: 'নিষ্কাশন পরীক্ষা করুন এবং জমা জল সরান (বর্ষা)',
  },
  'Water/irrigate (as per stage)': {
    en: 'Water/irrigate (as per stage)',
    hi: 'सिंचाई करें (अवस्था के अनुसार)',
    bn: 'সেচ দিন (পর্যায় অনুযায়ী)',
  },
  'Harvest window starts (plan labor, bags, storage, drying)': {
    en: 'Harvest window starts (plan labor, bags, storage, drying)',
    hi: 'फसल कटाई का समय शुरू (मजदूर, बोरी, भंडारण, सुखाने की योजना बनाएं)',
    bn: 'ফসল কাটার সময় শুরু (শ্রমিক, বস্তা, সংরক্ষণ, শুকানোর পরিকল্পনা করুন)',
  },

  // Rice/Paddy specific
  'Basal fertilization (FYM/compost + recommended NPK) and zinc if needed': {
    en: 'Basal fertilization (FYM/compost + recommended NPK) and zinc if needed',
    hi: 'आधार उर्वरक (गोबर खाद/कम्पोस्ट + अनुशंसित NPK) और जिंक यदि आवश्यक हो',
    bn: 'বেসাল সার (গোবর সার/কম্পোস্ট + প্রস্তাবিত NPK) এবং প্রয়োজনে জিঙ্ক',
  },
  'Top dress nitrogen (tillering stage)': {
    en: 'Top dress nitrogen (tillering stage)',
    hi: 'नाइट्रोजन की टॉप ड्रेसिंग (कल्ले निकलने की अवस्था)',
    bn: 'টপ ড্রেসিং নাইট্রোজেন (কুশি পর্যায়)',
  },
  'Top dress nitrogen/potash (panicle initiation)': {
    en: 'Top dress nitrogen/potash (panicle initiation)',
    hi: 'नाइट्रोजन/पोटाश की टॉप ड्रेसिंग (बाली निकलने की शुरुआत)',
    bn: 'নাইট্রোজেন/পটাশ টপ ড্রেসিং (শীষ উদ্গমন)',
  },
  'Install pheromone/light traps (stem borer/leaf folder monitoring)': {
    en: 'Install pheromone/light traps (stem borer/leaf folder monitoring)',
    hi: 'फेरोमोन/लाइट ट्रैप लगाएं (तना छेदक/पत्ती मोड़क की निगरानी)',
    bn: 'ফেরোমন/লাইট ট্র্যাপ লাগান (কাণ্ড ছিদ্রকারী/পাতা মোড়ক পর্যবেক্ষণ)',
  },

  // Wheat specific
  'Irrigation #1 (Crown Root Initiation - CRI)': {
    en: 'Irrigation #1 (Crown Root Initiation - CRI)',
    hi: 'सिंचाई #1 (क्राउन रूट इनिशिएशन - CRI)',
    bn: 'সেচ #1 (ক্রাউন রুট ইনিশিয়েশন - CRI)',
  },
  'Irrigation #2 (Tillering)': {
    en: 'Irrigation #2 (Tillering)',
    hi: 'सिंचाई #2 (कल्ले निकलना)',
    bn: 'সেচ #2 (কুশি)',
  },
  'Irrigation #3 (Jointing/Booting)': {
    en: 'Irrigation #3 (Jointing/Booting)',
    hi: 'सिंचाई #3 (गांठ बनना/बूटिंग)',
    bn: 'সেচ #3 (জয়েন্টিং/বুটিং)',
  },
  'Irrigation #4 (Heading/Flowering)': {
    en: 'Irrigation #4 (Heading/Flowering)',
    hi: 'सिंचाई #4 (बाली निकलना/फूल आना)',
    bn: 'সেচ #4 (শীষ উদ্গমন/ফুল)',
  },
  'Irrigation #5 (Milking/Dough stage)': {
    en: 'Irrigation #5 (Milking/Dough stage)',
    hi: 'सिंचाई #5 (दूधिया/आटा अवस्था)',
    bn: 'সেচ #5 (দুধ/আটা পর্যায়)',
  },
  'Basal dose (FYM/compost + recommended NPK)': {
    en: 'Basal dose (FYM/compost + recommended NPK)',
    hi: 'आधार खुराक (गोबर खाद/कम्पोस्ट + अनुशंसित NPK)',
    bn: 'বেসাল ডোজ (গোবর সার/কম্পোস্ট + প্রস্তাবিত NPK)',
  },
  'Top dress nitrogen (after first irrigation / CRI)': {
    en: 'Top dress nitrogen (after first irrigation / CRI)',
    hi: 'नाइट्रोजन की टॉप ड्रेसिंग (पहली सिंचाई/CRI के बाद)',
    bn: 'নাইট্রোজেন টপ ড্রেসিং (প্রথম সেচ/CRI পরে)',
  },
  'Rust/leaf blight monitoring and preventive spray decision': {
    en: 'Rust/leaf blight monitoring and preventive spray decision',
    hi: 'रस्ट/पत्ती झुलसा की निगरानी और निवारक स्प्रे का निर्णय',
    bn: 'মরিচা/পাতা ঝলসা পর্যবেক্ষণ এবং প্রতিরোধমূলক স্প্রে সিদ্ধান্ত',
  },

  // Generic/Vegetable specific
  'Basal nutrition (FYM/compost + recommended NPK)': {
    en: 'Basal nutrition (FYM/compost + recommended NPK)',
    hi: 'आधार पोषण (गोबर खाद/कम्पोस्ट + अनुशंसित NPK)',
    bn: 'বেসাল পুষ্টি (গোবর সার/কম্পোস্ট + প্রস্তাবিত NPK)',
  },
  'Top dressing (nitrogen) + micronutrient check': {
    en: 'Top dressing (nitrogen) + micronutrient check',
    hi: 'टॉप ड्रेसिंग (नाइट्रोजन) + सूक्ष्म पोषक तत्व जांच',
    bn: 'টপ ড্রেসিং (নাইট্রোজেন) + মাইক্রোনিউট্রিয়েন্ট পরীক্ষা',
  },
  'Install sticky/pheromone traps (monitoring)': {
    en: 'Install sticky/pheromone traps (monitoring)',
    hi: 'चिपचिपा/फेरोमोन ट्रैप लगाएं (निगरानी)',
    bn: 'আঠালো/ফেরোমন ট্র্যাপ লাগান (পর্যবেক্ষণ)',
  },
  'Preventive fungal risk check (humidity/leaf wetness)': {
    en: 'Preventive fungal risk check (humidity/leaf wetness)',
    hi: 'फफूंद जोखिम की निवारक जांच (नमी/पत्ती गीलापन)',
    bn: 'প্রতিরোধমূলক ছত্রাক ঝুঁকি পরীক্ষা (আর্দ্রতা/পাতা ভেজা)',
  },
};

const HEURISTIC_NOTES_TRANSLATIONS: Record<string, LocalizedText3> = {
  // Common notes
  'Walk the plot early morning; check undersides of leaves, new growth, and waterlogging. Act only if thresholds are met.': {
    en: 'Walk the plot early morning; check undersides of leaves, new growth, and waterlogging. Act only if thresholds are met.',
    hi: 'सुबह जल्दी खेत का चक्कर लगाएं; पत्तियों के नीचे, नई वृद्धि और जलभराव की जांच करें। केवल सीमा पार होने पर ही कार्रवाई करें।',
    bn: 'সকালে মাঠে হাঁটুন; পাতার নিচে, নতুন বৃদ্ধি এবং জলাবদ্ধতা পরীক্ষা করুন। সীমা অতিক্রম করলেই পদক্ষেপ নিন।',
  },
  'Prevent root rot and nutrient loss; keep bunds/field channels clear.': {
    en: 'Prevent root rot and nutrient loss; keep bunds/field channels clear.',
    hi: 'जड़ सड़न और पोषक तत्व हानि रोकें; मेड़/खेत की नालियां साफ रखें।',
    bn: 'শিকড় পচা এবং পুষ্টি ক্ষতি রোধ করুন; আল/মাঠের চ্যানেল পরিষ্কার রাখুন।',
  },
  'Harvest at physiological maturity; avoid harvesting immediately after rain. Dry/grade produce for better price.': {
    en: 'Harvest at physiological maturity; avoid harvesting immediately after rain. Dry/grade produce for better price.',
    hi: 'शारीरिक परिपक्वता पर फसल काटें; बारिश के तुरंत बाद कटाई से बचें। बेहतर मूल्य के लिए उपज सुखाएं/ग्रेड करें।',
    bn: 'শারীরিক পরিপক্কতায় ফসল কাটুন; বৃষ্টির পরপরই কাটা এড়িয়ে চলুন। ভালো দামের জন্য ফসল শুকান/গ্রেড করুন।',
  },

  // Rice/Paddy watering notes
  'Maintain shallow water layer (2–3 cm) after establishment; skip if continuous rainfall and waterlogging risk.': {
    en: 'Maintain shallow water layer (2–3 cm) after establishment; skip if continuous rainfall and waterlogging risk.',
    hi: 'स्थापना के बाद उथला पानी (2-3 सेमी) बनाए रखें; लगातार बारिश और जलभराव के खतरे में छोड़ें।',
    bn: 'স্থাপনের পরে অগভীর জল স্তর (2-3 সেমি) বজায় রাখুন; ক্রমাগত বৃষ্টি এবং জলাবদ্ধতার ঝুঁকিতে এড়িয়ে যান।',
  },
  'Irrigate to keep soil moist; avoid long dry gaps during tillering and panicle initiation.': {
    en: 'Irrigate to keep soil moist; avoid long dry gaps during tillering and panicle initiation.',
    hi: 'मिट्टी नम रखने के लिए सिंचाई करें; कल्ले निकलने और बाली शुरू होने के दौरान लंबे सूखे अंतराल से बचें।',
    bn: 'মাটি আর্দ্র রাখতে সেচ দিন; কুশি এবং শীষ উদ্গমনের সময় দীর্ঘ শুষ্ক ব্যবধান এড়িয়ে চলুন।',
  },
  'Stop irrigation ~10–14 days before harvest to improve grain maturity and ease harvesting.': {
    en: 'Stop irrigation ~10–14 days before harvest to improve grain maturity and ease harvesting.',
    hi: 'फसल कटाई से ~10-14 दिन पहले सिंचाई बंद करें ताकि दाने की परिपक्वता बेहतर हो और कटाई आसान हो।',
    bn: 'ফসল কাটার ~10-14 দিন আগে সেচ বন্ধ করুন যাতে দানা পরিপক্বতা ভালো হয় এবং কাটা সহজ হয়।',
  },

  // Rice fertilizer notes
  'Apply well-decomposed FYM/compost. Use soil-test based NPK; consider zinc sulfate in zinc-deficient areas.': {
    en: 'Apply well-decomposed FYM/compost. Use soil-test based NPK; consider zinc sulfate in zinc-deficient areas.',
    hi: 'अच्छी तरह सड़ी गोबर खाद/कम्पोस्ट डालें। मृदा परीक्षण आधारित NPK का उपयोग करें; जिंक की कमी वाले क्षेत्रों में जिंक सल्फेट पर विचार करें।',
    bn: 'ভালোভাবে পচা গোবর সার/কম্পোস্ট দিন। মাটি পরীক্ষা ভিত্তিক NPK ব্যবহার করুন; জিঙ্ক-ঘাটতি এলাকায় জিঙ্ক সালফেট বিবেচনা করুন।',
  },
  'Split N improves uptake; apply just before irrigation or rainfall.': {
    en: 'Split N improves uptake; apply just before irrigation or rainfall.',
    hi: 'विभाजित N अवशोषण बेहतर करता है; सिंचाई या बारिश से ठीक पहले डालें।',
    bn: 'বিভক্ত N শোষণ উন্নত করে; সেচ বা বৃষ্টির ঠিক আগে দিন।',
  },
  'Critical for grain formation; avoid over-N in cloudy/humid conditions.': {
    en: 'Critical for grain formation; avoid over-N in cloudy/humid conditions.',
    hi: 'दाना बनने के लिए महत्वपूर्ण; बादल/आर्द्र स्थितियों में अधिक N से बचें।',
    bn: 'দানা গঠনের জন্য গুরুত্বপূর্ণ; মেঘলা/আর্দ্র অবস্থায় অতিরিক্ত N এড়িয়ে চলুন।',
  },
  'Use traps for monitoring; spray only if infestation crosses thresholds.': {
    en: 'Use traps for monitoring; spray only if infestation crosses thresholds.',
    hi: 'निगरानी के लिए ट्रैप का उपयोग करें; केवल संक्रमण सीमा पार करने पर ही स्प्रे करें।',
    bn: 'পর্যবেক্ষণের জন্য ট্র্যাপ ব্যবহার করুন; সংক্রমণ সীমা অতিক্রম করলেই স্প্রে করুন।',
  },

  // Wheat irrigation notes
  'Most critical irrigation for wheat. If rainfall occurred recently and soil is moist, adjust accordingly.': {
    en: 'Most critical irrigation for wheat. If rainfall occurred recently and soil is moist, adjust accordingly.',
    hi: 'गेहूं के लिए सबसे महत्वपूर्ण सिंचाई। यदि हाल ही में बारिश हुई और मिट्टी नम है, तो तदनुसार समायोजित करें।',
    bn: 'গমের জন্য সবচেয়ে গুরুত্বপূর্ণ সেচ। সম্প্রতি বৃষ্টি হলে এবং মাটি আর্দ্র থাকলে সেই অনুযায়ী সামঞ্জস্য করুন।',
  },
  'Avoid water stress; do not over-irrigate in cold foggy spells.': {
    en: 'Avoid water stress; do not over-irrigate in cold foggy spells.',
    hi: 'पानी की कमी से बचें; ठंडे कोहरे में अधिक सिंचाई न करें।',
    bn: 'জলের চাপ এড়িয়ে চলুন; ঠান্ডা কুয়াশায় অতিরিক্ত সেচ দেবেন না।',
  },
  'Supports spike development; ensure good drainage after irrigation.': {
    en: 'Supports spike development; ensure good drainage after irrigation.',
    hi: 'बाली विकास में सहायक; सिंचाई के बाद अच्छी जल निकासी सुनिश्चित करें।',
    bn: 'শীষ বিকাশে সহায়ক; সেচের পরে ভালো নিষ্কাশন নিশ্চিত করুন।',
  },
  'Avoid stress; irrigate in morning hours when possible.': {
    en: 'Avoid stress; irrigate in morning hours when possible.',
    hi: 'तनाव से बचें; संभव हो तो सुबह के समय सिंचाई करें।',
    bn: 'চাপ এড়িয়ে চলুন; সম্ভব হলে সকালে সেচ দিন।',
  },
  'Last critical irrigation; stop irrigation 10–12 days before harvest.': {
    en: 'Last critical irrigation; stop irrigation 10–12 days before harvest.',
    hi: 'आखिरी महत्वपूर्ण सिंचाई; फसल कटाई से 10-12 दिन पहले सिंचाई बंद करें।',
    bn: 'শেষ গুরুত্বপূর্ণ সেচ; ফসল কাটার 10-12 দিন আগে সেচ বন্ধ করুন।',
  },
  'Use soil-test based recommendations; place fertilizer below seed zone where applicable.': {
    en: 'Use soil-test based recommendations; place fertilizer below seed zone where applicable.',
    hi: 'मृदा परीक्षण आधारित सिफारिशें उपयोग करें; जहां लागू हो बीज क्षेत्र के नीचे उर्वरक रखें।',
    bn: 'মাটি পরীক্ষা ভিত্তিক সুপারিশ ব্যবহার করুন; যেখানে প্রযোজ্য বীজ অঞ্চলের নিচে সার রাখুন।',
  },
  'Split N reduces lodging risk and improves grain filling.': {
    en: 'Split N reduces lodging risk and improves grain filling.',
    hi: 'विभाजित N गिरने का खतरा कम करता है और दाना भरने में सुधार करता है।',
    bn: 'বিভক্ত N হেলে পড়ার ঝুঁকি কমায় এবং দানা ভরাট উন্নত করে।',
  },
  'In humid/foggy weather, rust risk rises. Use resistant varieties and spray only if symptoms appear.': {
    en: 'In humid/foggy weather, rust risk rises. Use resistant varieties and spray only if symptoms appear.',
    hi: 'आर्द्र/कोहरे वाले मौसम में रस्ट का खतरा बढ़ जाता है। प्रतिरोधी किस्में उपयोग करें और लक्षण दिखने पर ही स्प्रे करें।',
    bn: 'আর্দ্র/কুয়াশা আবহাওয়ায় মরিচার ঝুঁকি বাড়ে। প্রতিরোধী জাত ব্যবহার করুন এবং লক্ষণ দেখা দিলেই স্প্রে করুন।',
  },

  // Generic/Vegetable notes
  'Keep soil consistently moist for establishment; avoid waterlogging. Mulch helps in hot weather.': {
    en: 'Keep soil consistently moist for establishment; avoid waterlogging. Mulch helps in hot weather.',
    hi: 'स्थापना के लिए मिट्टी को लगातार नम रखें; जलभराव से बचें। गर्म मौसम में मल्च मदद करता है।',
    bn: 'স্থাপনের জন্য মাটি ক্রমাগত আর্দ্র রাখুন; জলাবদ্ধতা এড়িয়ে চলুন। গরম আবহাওয়ায় মালচ সাহায্য করে।',
  },
  'Irrigate during dry spells; skip after good rainfall. Ensure drainage to prevent fungal diseases.': {
    en: 'Irrigate during dry spells; skip after good rainfall. Ensure drainage to prevent fungal diseases.',
    hi: 'शुष्क अवधि में सिंचाई करें; अच्छी बारिश के बाद छोड़ें। फफूंद रोग रोकने के लिए जल निकासी सुनिश्चित करें।',
    bn: 'শুষ্ক সময়ে সেচ দিন; ভালো বৃষ্টির পরে এড়িয়ে যান। ছত্রাক রোগ প্রতিরোধে নিষ্কাশন নিশ্চিত করুন।',
  },
  'Irrigate every 2 days (adjust for soil type); avoid wetting foliage late evening.': {
    en: 'Irrigate every 2 days (adjust for soil type); avoid wetting foliage late evening.',
    hi: 'हर 2 दिन सिंचाई करें (मिट्टी के प्रकार के अनुसार समायोजित करें); शाम को पत्तियों को गीला करने से बचें।',
    bn: 'প্রতি 2 দিন সেচ দিন (মাটির ধরন অনুযায়ী সামঞ্জস্য করুন); সন্ধ্যায় পাতা ভেজানো এড়িয়ে চলুন।',
  },
  'Reduce irrigation close to harvest to improve quality and reduce post-harvest rot.': {
    en: 'Reduce irrigation close to harvest to improve quality and reduce post-harvest rot.',
    hi: 'गुणवत्ता सुधारने और फसल के बाद सड़न कम करने के लिए कटाई के करीब सिंचाई कम करें।',
    bn: 'গুণমান উন্নত করতে এবং ফসল কাটার পরে পচা কমাতে কাটার কাছাকাছি সেচ কমান।',
  },
  'Incorporate compost and basal P & K. Use soil test when available. Apply biofertilizers if using organic methods.': {
    en: 'Incorporate compost and basal P & K. Use soil test when available. Apply biofertilizers if using organic methods.',
    hi: 'कम्पोस्ट और आधार P & K मिलाएं। उपलब्ध होने पर मृदा परीक्षण का उपयोग करें। जैविक विधियों में जैव उर्वरक लगाएं।',
    bn: 'কম্পোস্ট এবং বেসাল P & K মেশান। উপলব্ধ হলে মাটি পরীক্ষা ব্যবহার করুন। জৈব পদ্ধতিতে জৈব সার প্রয়োগ করুন।',
  },
  'Split nitrogen improves uptake. If leaf yellowing/poor growth, consider micronutrients (Zn/B) as per symptoms.': {
    en: 'Split nitrogen improves uptake. If leaf yellowing/poor growth, consider micronutrients (Zn/B) as per symptoms.',
    hi: 'विभाजित नाइट्रोजन अवशोषण सुधारता है। पत्ती पीली/खराब वृद्धि पर लक्षणों के अनुसार सूक्ष्म पोषक (Zn/B) पर विचार करें।',
    bn: 'বিভক্ত নাইট্রোজেন শোষণ উন্নত করে। পাতা হলুদ/দুর্বল বৃদ্ধিতে লক্ষণ অনুযায়ী মাইক্রোনিউট্রিয়েন্ট (Zn/B) বিবেচনা করুন।',
  },
  'Use traps for monitoring; keep field clean to reduce pest carryover.': {
    en: 'Use traps for monitoring; keep field clean to reduce pest carryover.',
    hi: 'निगरानी के लिए ट्रैप का उपयोग करें; कीट वहन कम करने के लिए खेत साफ रखें।',
    bn: 'পর্যবেক্ষণের জন্য ট্র্যাপ ব্যবহার করুন; পোকা বহন কমাতে মাঠ পরিষ্কার রাখুন।',
  },
  'Avoid overhead irrigation at night; ensure airflow. Use recommended protectant fungicide only if risk is high.': {
    en: 'Avoid overhead irrigation at night; ensure airflow. Use recommended protectant fungicide only if risk is high.',
    hi: 'रात में ऊपरी सिंचाई से बचें; वायु प्रवाह सुनिश्चित करें। उच्च जोखिम पर ही अनुशंसित रक्षक फफूंदनाशक उपयोग करें।',
    bn: 'রাতে ওভারহেড সেচ এড়িয়ে চলুন; বায়ুপ্রবাহ নিশ্চিত করুন। উচ্চ ঝুঁকিতেই প্রস্তাবিত প্রতিরক্ষামূলক ছত্রাকনাশক ব্যবহার করুন।',
  },
};

// Helper function to get translated text with fallback
const getHeuristicTranslation = (text: string): LocalizedText3 => {
  return HEURISTIC_TRANSLATIONS[text] || { en: text, hi: text, bn: text };
};

const getHeuristicNotesTranslation = (text: string): LocalizedText3 => {
  return HEURISTIC_NOTES_TRANSLATIONS[text] || { en: text, hi: text, bn: text };
};

// Generate a localized plan title based on crop name
const generatePlanTitleI18n = (cropName: string): LocalizedText3 => {
  return {
    en: `${cropName} Farming Plan`,
    hi: `${cropName} खेती योजना`,
    bn: `${cropName} চাষ পরিকল্পনা`,
  };
};

// Generate a localized plan overview based on crop name
const generatePlanOverviewI18n = (cropName: string, plantingDateISO: string, harvestDateISO: string): LocalizedText3 => {
  return {
    en: `Complete farming schedule for ${cropName} from planting (${plantingDateISO}) to harvest (${harvestDateISO}). Follow the daily tasks for best results.`,
    hi: `${cropName} के लिए संपूर्ण खेती कार्यक्रम, बुवाई (${plantingDateISO}) से कटाई (${harvestDateISO}) तक। सर्वोत्तम परिणामों के लिए दैनिक कार्यों का पालन करें।`,
    bn: `${cropName}-এর জন্য সম্পূর্ণ চাষ সময়সূচি, রোপণ (${plantingDateISO}) থেকে ফসল কাটা (${harvestDateISO}) পর্যন্ত। সেরা ফলাফলের জন্য দৈনিক কাজগুলি অনুসরণ করুন।`,
  };
};

const buildHeuristicPlan = (params: {
  cropType: string;
  cropName: string;
  areaAcres: number;
  plantingDate: Date;
  expectedHarvestDate?: Date | null;
}): Omit<StoredFarmingPlan, 'id' | 'createdAt' | 'updatedAt'> => {
  const { cropType, cropName, areaAcres, plantingDate, expectedHarvestDate } = params;

  const maturityDays = expectedHarvestDate
    ? Math.max(
        1,
        Math.round(
          (expectedHarvestDate.getTime() - plantingDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : inferMaturityDays(cropName || cropType);

  const harvest = expectedHarvestDate || addDays(plantingDate, maturityDays);

  // Remove stored schedule values shortly after the expected harvest date
  // to avoid unnecessary data accumulation.
  const cleanupAfter = addDays(harvest, 1);

  const month = plantingDate.getMonth() + 1;
  const isMonsoonWindow = month >= 6 && month <= 9;

  const wateringRules: FarmingWateringRule[] = [];
  const tasks: FarmingOneOffTask[] = [];
  const recurringTasks: FarmingRecurringTaskRule[] = [];

  const cropKey = (cropName || cropType).trim().toLowerCase();

  const addRecurring = (rule: Omit<FarmingRecurringTaskRule, 'id'> & { id?: string }) => {
    const inferred = (rule.timeOfDay as any) || inferTimeOfDay(rule.type);
    recurringTasks.push({
      id: rule.id || `${sanitizeId(rule.type)}-${sanitizeId(rule.title)}`,
      type: rule.type,
      title: rule.title,
      titleI18n: getHeuristicTranslation(rule.title),
      startDay: rule.startDay,
      endDay: rule.endDay,
      everyDays: rule.everyDays,
      timeOfDay: inferred,
      timeHHmm: rule.timeHHmm || defaultTimeHHmmForTimeOfDay(inferred),
      notes: rule.notes,
      notesI18n: rule.notes ? getHeuristicNotesTranslation(rule.notes) : undefined,
    });
  };

  const addTask = (task: Omit<FarmingOneOffTask, 'id'> & { id?: string }) => {
    const inferred = (task.timeOfDay as any) || inferTimeOfDay(task.type);
    tasks.push({
      id: task.id || `${sanitizeId(task.type)}-${sanitizeId(task.title)}-${task.dueDateISO}`,
      type: task.type,
      title: task.title,
      titleI18n: getHeuristicTranslation(task.title),
      dueDateISO: task.dueDateISO,
      timeOfDay: inferred,
      timeHHmm: task.timeHHmm || defaultTimeHHmmForTimeOfDay(inferred),
      notes: task.notes,
      notesI18n: task.notes ? getHeuristicNotesTranslation(task.notes) : undefined,
    });
  };

  // Field scouting is universally useful.
  addRecurring({
    type: 'field',
    title: 'Field scouting (pests, disease, weeds, moisture)',
    startDay: 7,
    endDay: maturityDays,
    everyDays: 7,
    notes:
      'Walk the plot early morning; check undersides of leaves, new growth, and waterlogging. Act only if thresholds are met.',
  });

  // Drainage checks during monsoon.
  if (isMonsoonWindow) {
    addRecurring({
      type: 'field',
      title: 'Check drainage & remove standing water (monsoon)',
      startDay: 0,
      endDay: maturityDays,
      everyDays: 5,
      notes: 'Prevent root rot and nutrient loss; keep bunds/field channels clear.',
    });
  }

  // Crop-specific schedules (practical, non-pretend “live weather”).
  if (cropKey.includes('rice') || cropKey.includes('paddy')) {
    wateringRules.push(
      {
        startDay: 0,
        endDay: 30,
        everyDays: 1,
        notes:
          'Maintain shallow water layer (2–3 cm) after establishment; skip if continuous rainfall and waterlogging risk.',
        notesI18n: getHeuristicNotesTranslation('Maintain shallow water layer (2–3 cm) after establishment; skip if continuous rainfall and waterlogging risk.'),
      },
      {
        startDay: 31,
        endDay: Math.max(31, maturityDays - 15),
        everyDays: 2,
        notes:
          'Irrigate to keep soil moist; avoid long dry gaps during tillering and panicle initiation.',
        notesI18n: getHeuristicNotesTranslation('Irrigate to keep soil moist; avoid long dry gaps during tillering and panicle initiation.'),
      },
      {
        startDay: Math.max(0, maturityDays - 14),
        endDay: maturityDays,
        everyDays: 9999,
        notes: 'Stop irrigation ~10–14 days before harvest to improve grain maturity and ease harvesting.',
        notesI18n: getHeuristicNotesTranslation('Stop irrigation ~10–14 days before harvest to improve grain maturity and ease harvesting.'),
      }
    );

    addTask({
      type: 'fertilizer',
      title: 'Basal fertilization (FYM/compost + recommended NPK) and zinc if needed',
      dueDateISO: toISODate(plantingDate),
      notes:
        'Apply well-decomposed FYM/compost. Use soil-test based NPK; consider zinc sulfate in zinc-deficient areas.',
    });

    addTask({
      type: 'fertilizer',
      title: 'Top dress nitrogen (tillering stage)',
      dueDateISO: toISODate(addDays(plantingDate, 25)),
      notes: 'Split N improves uptake; apply just before irrigation or rainfall.',
    });

    addTask({
      type: 'fertilizer',
      title: 'Top dress nitrogen/potash (panicle initiation)',
      dueDateISO: toISODate(addDays(plantingDate, 55)),
      notes: 'Critical for grain formation; avoid over-N in cloudy/humid conditions.',
    });

    addTask({
      type: 'pest',
      title: 'Install pheromone/light traps (stem borer/leaf folder monitoring)',
      dueDateISO: toISODate(addDays(plantingDate, 10)),
      notes: 'Use traps for monitoring; spray only if infestation crosses thresholds.',
    });
  } else if (cropKey.includes('wheat')) {
    // Wheat irrigation is milestone-based.
    addTask({
      type: 'watering',
      title: 'Irrigation #1 (Crown Root Initiation - CRI)',
      dueDateISO: toISODate(addDays(plantingDate, 21)),
      notes:
        'Most critical irrigation for wheat. If rainfall occurred recently and soil is moist, adjust accordingly.',
    });
    addTask({
      type: 'watering',
      title: 'Irrigation #2 (Tillering)',
      dueDateISO: toISODate(addDays(plantingDate, 40)),
      notes: 'Avoid water stress; do not over-irrigate in cold foggy spells.',
    });
    addTask({
      type: 'watering',
      title: 'Irrigation #3 (Jointing/Booting)',
      dueDateISO: toISODate(addDays(plantingDate, 60)),
      notes: 'Supports spike development; ensure good drainage after irrigation.',
    });
    addTask({
      type: 'watering',
      title: 'Irrigation #4 (Heading/Flowering)',
      dueDateISO: toISODate(addDays(plantingDate, 80)),
      notes: 'Avoid stress; irrigate in morning hours when possible.',
    });
    addTask({
      type: 'watering',
      title: 'Irrigation #5 (Milking/Dough stage)',
      dueDateISO: toISODate(addDays(plantingDate, 95)),
      notes: 'Last critical irrigation; stop irrigation 10–12 days before harvest.',
    });

    addTask({
      type: 'fertilizer',
      title: 'Basal dose (FYM/compost + recommended NPK)',
      dueDateISO: toISODate(plantingDate),
      notes: 'Use soil-test based recommendations; place fertilizer below seed zone where applicable.',
    });
    addTask({
      type: 'fertilizer',
      title: 'Top dress nitrogen (after first irrigation / CRI)',
      dueDateISO: toISODate(addDays(plantingDate, 22)),
      notes: 'Split N reduces lodging risk and improves grain filling.',
    });

    addTask({
      type: 'disease',
      title: 'Rust/leaf blight monitoring and preventive spray decision',
      dueDateISO: toISODate(addDays(plantingDate, 55)),
      notes:
        'In humid/foggy weather, rust risk rises. Use resistant varieties and spray only if symptoms appear.',
    });
  } else {
    // Generic schedule for vegetables/other crops.
    wateringRules.push(
      {
        startDay: 0,
        endDay: 14,
        everyDays: 1,
        notes:
          'Keep soil consistently moist for establishment; avoid waterlogging. Mulch helps in hot weather.',
        notesI18n: getHeuristicNotesTranslation('Keep soil consistently moist for establishment; avoid waterlogging. Mulch helps in hot weather.'),
      },
      {
        startDay: 15,
        endDay: Math.max(15, maturityDays - 10),
        everyDays: 2,
        notes:
          isMonsoonWindow
            ? 'Irrigate during dry spells; skip after good rainfall. Ensure drainage to prevent fungal diseases.'
            : 'Irrigate every 2 days (adjust for soil type); avoid wetting foliage late evening.',
        notesI18n: isMonsoonWindow
          ? getHeuristicNotesTranslation('Irrigate during dry spells; skip after good rainfall. Ensure drainage to prevent fungal diseases.')
          : getHeuristicNotesTranslation('Irrigate every 2 days (adjust for soil type); avoid wetting foliage late evening.'),
      },
      {
        startDay: Math.max(0, maturityDays - 9),
        endDay: maturityDays,
        everyDays: 3,
        notes: 'Reduce irrigation close to harvest to improve quality and reduce post-harvest rot.',
        notesI18n: getHeuristicNotesTranslation('Reduce irrigation close to harvest to improve quality and reduce post-harvest rot.'),
      }
    );

    addTask({
      type: 'fertilizer',
      title: 'Basal nutrition (FYM/compost + recommended NPK)',
      dueDateISO: toISODate(plantingDate),
      notes:
        'Incorporate compost and basal P & K. Use soil test when available. Apply biofertilizers if using organic methods.',
    });

    addTask({
      type: 'fertilizer',
      title: 'Top dressing (nitrogen) + micronutrient check',
      dueDateISO: toISODate(addDays(plantingDate, 25)),
      notes:
        'Split nitrogen improves uptake. If leaf yellowing/poor growth, consider micronutrients (Zn/B) as per symptoms.',
    });

    addTask({
      type: 'pest',
      title: 'Install sticky/pheromone traps (monitoring)',
      dueDateISO: toISODate(addDays(plantingDate, 10)),
      notes: 'Use traps for monitoring; keep field clean to reduce pest carryover.',
    });

    addTask({
      type: 'disease',
      title: 'Preventive fungal risk check (humidity/leaf wetness)',
      dueDateISO: toISODate(addDays(plantingDate, 20)),
      notes:
        'Avoid overhead irrigation at night; ensure airflow. Use recommended protectant fungicide only if risk is high.',
    });
  }

  // Universal harvest task.
  addTask({
    type: 'harvest',
    title: 'Harvest window starts (plan labor, bags, storage, drying)',
    dueDateISO: toISODate(harvest),
    notes:
      'Harvest at physiological maturity; avoid harvesting immediately after rain. Dry/grade produce for better price.',
  });

  // Remove duplicate tasks (same id) just in case.
  const uniqueTasks = Object.values(
    tasks.reduce<Record<string, FarmingOneOffTask>>((acc, t) => {
      acc[t.id] = t;
      return acc;
    }, {})
  ).sort((a, b) => a.dueDateISO.localeCompare(b.dueDateISO));

  const plantingISO = toISODate(plantingDate);
  const harvestISO = toISODate(harvest);

  return {
    cropType,
    cropName,
    areaAcres,
    planTitleI18n: generatePlanTitleI18n(cropName || cropType),
    planOverviewI18n: generatePlanOverviewI18n(cropName || cropType, plantingISO, harvestISO),
    plantingDateISO: plantingISO,
    expectedHarvestDateISO: harvestISO,
    cleanupAfterISO: toISODate(cleanupAfter),
    wateringRules,
    recurringTasks,
    tasks: uniqueTasks,
    status: 'active',
    source: 'heuristic',
  };
};

const plansCollectionRef = (userId: string) =>
  collection(db, 'users', userId, 'farmingPlans');

const expandInRangeFromRules = (params: {
  plan: StoredFarmingPlan;
  startISO: string;
  endISO: string;
  language?: string;
}): FarmingTaskInstance[] => {
  const { plan, startISO, endISO } = params;
  const lang = normalizeLanguage(params.language);

  const planting = parseLooseDate(plan.plantingDateISO);
  if (!planting) return [];

  const planStartISO = plan.plantingDateISO;
  const planEndISO = plan.expectedHarvestDateISO;
  const safeStartISO = clampISO(startISO, planStartISO, planEndISO);
  const safeEndISO = clampISO(endISO, planStartISO, planEndISO);
  if (safeEndISO < safeStartISO) return [];

  const inWindow = (iso: string) => iso >= safeStartISO && iso <= safeEndISO;

  const results: FarmingTaskInstance[] = [];

  // Helper to get localized title with heuristic fallback for old plans
  const getLocalizedTitle = (titleI18n: LocalizedText3 | undefined, fallbackTitle: string): string => {
    const fromI18n = pickI18n(titleI18n, lang);
    if (fromI18n) return fromI18n;
    // Try heuristic translations for known texts
    const heuristic = HEURISTIC_TRANSLATIONS[fallbackTitle];
    if (heuristic) return pickI18n(heuristic, lang) || fallbackTitle;
    return fallbackTitle;
  };

  // Helper to get localized notes with heuristic fallback for old plans
  const getLocalizedNotes = (notesI18n: LocalizedText3 | undefined, fallbackNotes: string | undefined): string | undefined => {
    if (!fallbackNotes) return undefined;
    const fromI18n = pickI18n(notesI18n, lang);
    if (fromI18n) return fromI18n;
    // Try heuristic translations for known texts
    const heuristic = HEURISTIC_NOTES_TRANSLATIONS[fallbackNotes];
    if (heuristic) return pickI18n(heuristic, lang) || fallbackNotes;
    return fallbackNotes;
  };

  // One-off tasks.
  for (const t of plan.tasks || []) {
    if (inWindow(t.dueDateISO)) {
      const timeOfDay = (t.timeOfDay as any) || inferTimeOfDay(t.type);
      results.push({
        planId: plan.id,
        cropName: plan.cropName,
        planTitle: pickI18n(plan.planTitleI18n, lang) || plan.cropName,
        planExpectedHarvestDateISO: plan.expectedHarvestDateISO,
        type: t.type,
        title: getLocalizedTitle(t.titleI18n, t.title),
        dueDateISO: t.dueDateISO,
        timeOfDay,
        timeHHmm: t.timeHHmm || defaultTimeHHmmForTimeOfDay(timeOfDay),
        notes: getLocalizedNotes(t.notesI18n, t.notes),
      });
    }
  }

  // Recurring tasks.
  for (const r of plan.recurringTasks || []) {
    const first = addDays(planting, r.startDay);
    const last = addDays(planting, r.endDay);

    // Skip if everyDays is unreasonably large (effectively disabled)
    if (r.everyDays >= 9999) continue;

    let cursor = new Date(first);
    const rangeStart = parseLooseDate(safeStartISO) || cursor;
    while (cursor < rangeStart) {
      cursor = addDays(cursor, r.everyDays);
      if (cursor > last) break;
    }

    // Mathematical expansion: generate one task for each interval
    while (cursor <= last) {
      const due = toISODate(cursor);
      if (inWindow(due)) {
        const timeOfDay = (r.timeOfDay as any) || inferTimeOfDay(r.type);
        results.push({
          planId: plan.id,
          cropName: plan.cropName,
          planTitle: pickI18n(plan.planTitleI18n, lang) || plan.cropName,
          planExpectedHarvestDateISO: plan.expectedHarvestDateISO,
          type: r.type,
          title: getLocalizedTitle(r.titleI18n, r.title),
          dueDateISO: due,
          timeOfDay,
          timeHHmm: r.timeHHmm || defaultTimeHHmmForTimeOfDay(timeOfDay),
          notes: getLocalizedNotes(r.notesI18n, r.notes),
        });
      }
      if (due > safeEndISO) break;
      cursor = addDays(cursor, r.everyDays);
    }
  }

  // Watering rules - expand mathematically into individual watering events.
  for (const w of plan.wateringRules || []) {
    if (w.everyDays >= 9999) continue;

    const first = addDays(planting, w.startDay);
    const last = addDays(planting, w.endDay);

    let cursor = new Date(first);
    const rangeStart = parseLooseDate(safeStartISO) || cursor;
    while (cursor < rangeStart) {
      cursor = addDays(cursor, w.everyDays);
      if (cursor > last) break;
    }

    // Mathematical expansion: e.g., every 3 days becomes day 0, 3, 6, 9...
    while (cursor <= last) {
      const due = toISODate(cursor);
      if (inWindow(due)) {
        const timeOfDay = (w.timeOfDay as TimeOfDay) || 'morning';
        const defaultWateringTitle = 'Water/irrigate (as per stage)';
        results.push({
          planId: plan.id,
          cropName: plan.cropName,
          planTitle: pickI18n(plan.planTitleI18n, lang) || plan.cropName,
          planExpectedHarvestDateISO: plan.expectedHarvestDateISO,
          type: 'watering',
          title: getLocalizedTitle(w.titleI18n, w.title || defaultWateringTitle),
          dueDateISO: due,
          timeOfDay,
          timeHHmm: w.timeHHmm || defaultTimeHHmmForTimeOfDay(timeOfDay),
          notes: getLocalizedNotes(w.notesI18n, w.notes),
        });
      }
      if (due > safeEndISO) break;
      cursor = addDays(cursor, w.everyDays);
    }
  }

  // Deduplicate by (planId + dueDate + title)
  const unique = Object.values(
    results.reduce<Record<string, FarmingTaskInstance>>((acc, task) => {
      const key = `${task.planId}|${task.dueDateISO}|${task.title}`;
      acc[key] = task;
      return acc;
    }, {})
  );

  unique.sort((a, b) => {
    const byDate = a.dueDateISO.localeCompare(b.dueDateISO);
    if (byDate !== 0) return byDate;
    return (a.title || '').localeCompare(b.title || '');
  });

  return unique;
};

export const getActiveFarmingPlansForCurrentUser = async (params?: {
  language?: string;
}): Promise<FarmingPlanSummary[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  const lang = normalizeLanguage(params?.language);
  const q = query(plansCollectionRef(user.uid), where('status', '==', 'active'));
  const snap = await getDocs(q);

  const todayISO = toISODate(new Date());

  const plans = snap.docs
    .map((d) => d.data() as StoredFarmingPlan)
    .filter(Boolean);

  const summaries = plans.map((p) => {
    // Compute a lightweight "next task" preview in the next 7 days.
    const upcoming = expandUpcomingFromRules({ plan: p, windowDays: 7, language: params?.language });
    const next = upcoming[0];

    const updatedAtISO = (() => {
      try {
        const dt = (p.updatedAt as any)?.toDate?.();
        return dt ? toISODate(dt) : undefined;
      } catch {
        return undefined;
      }
    })();

    return {
      id: p.id,
      cropName: p.cropName,
      cropType: p.cropType,
      areaAcres: p.areaAcres,
      plantingDateISO: p.plantingDateISO,
      expectedHarvestDateISO: p.expectedHarvestDateISO,
      status: p.status,
      planTitle: pickI18n(p.planTitleI18n, lang) || p.cropName,
      planOverview: pickI18n(p.planOverviewI18n, lang),
      source: p.source,
      updatedAtISO,
      nextTaskDateISO: next?.dueDateISO,
      nextTaskTitle: next?.title,
      nextTaskCountIn7Days: upcoming.length,
    } satisfies FarmingPlanSummary;
  });

  // Sort: plans with nearest upcoming task first, otherwise by harvest date.
  summaries.sort((a, b) => {
    const aNext = a.nextTaskDateISO || '9999-12-31';
    const bNext = b.nextTaskDateISO || '9999-12-31';
    const byNext = aNext.localeCompare(bNext);
    if (byNext !== 0) return byNext;
    const byHarvest = a.expectedHarvestDateISO.localeCompare(b.expectedHarvestDateISO);
    if (byHarvest !== 0) return byHarvest;
    // Recently updated plans first.
    const aUpd = a.updatedAtISO || todayISO;
    const bUpd = b.updatedAtISO || todayISO;
    const byUpd = bUpd.localeCompare(aUpd);
    if (byUpd !== 0) return byUpd;
    return a.planTitle.localeCompare(b.planTitle);
  });

  return summaries;
};

export const getFarmingPlanForCurrentUser = async (planId: string): Promise<StoredFarmingPlan | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  const ref = doc(plansCollectionRef(user.uid), planId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as StoredFarmingPlan;
};

export const getFarmingTasksForPlanInRangeForCurrentUser = async (params: {
  planId: string;
  startISO: string;
  endISO: string;
  language?: string;
}): Promise<FarmingTaskInstance[]> => {
  const plan = await getFarmingPlanForCurrentUser(params.planId);
  if (!plan) return [];
  return expandInRangeFromRules({
    plan,
    startISO: params.startISO,
    endISO: params.endISO,
    language: params.language,
  });
};

export const getFarmingTasksForPlanOnDateForCurrentUser = async (params: {
  planId: string;
  dateISO: string;
  language?: string;
}): Promise<FarmingTaskInstanceDetailed[]> => {
  const tasks = await getFarmingTasksForPlanInRangeForCurrentUser({
    planId: params.planId,
    startISO: params.dateISO,
    endISO: params.dateISO,
    language: params.language,
  });

  return tasks.map((t) => {
    const timeOfDay = (t.timeOfDay as any) || inferTimeOfDay(t.type);
    const timeHHmm = t.timeHHmm || defaultTimeHHmmForTimeOfDay(timeOfDay);
    const waterAmountHint = t.type === 'watering' ? extractWaterAmountHint(t.notes) : undefined;
    return {
      ...t,
      timeOfDay,
      timeHHmm,
      waterAmountHint,
    };
  });
};

export const upsertFarmingPlanForCurrentUser = async (params: {
  cropType: string;
  cropName: string;
  areaAcres: number;
  plantingDate: string;
  expectedHarvestDate?: string;
  source?: string;
}): Promise<{ planId: string }> => {
  const user = auth.currentUser;
  if (!user) throw new Error('User must be signed in to save a farming plan.');

  const planting = parseLooseDate(params.plantingDate);
  if (!planting) throw new Error('Invalid planting date.');

  const expectedHarvest = params.expectedHarvestDate
    ? parseLooseDate(params.expectedHarvestDate)
    : null;

  const cropName = (params.cropName || params.cropType || '').trim();
  const cropType = (params.cropType || cropName).trim();

  const areaKeyRaw = String(Math.round((Number(params.areaAcres) || 0) * 100) / 100).replace('.', 'p');
  const planId = `${sanitizeId(cropName || cropType)}-${toISODate(planting)}-a${sanitizeId(areaKeyRaw)}`;

  const now = Timestamp.now();
  const ref = doc(plansCollectionRef(user.uid), planId);
  const existingSnap = await getDoc(ref);
  const existing = existingSnap.exists() ? (existingSnap.data() as StoredFarmingPlan) : null;

  // Generate and store the plan only once. If already present, we reuse it.
  const hasGeminiContent = !!existing?.planTitleI18n && !!existing?.planOverviewI18n;

  const alreadyAttemptedGemini = !!existing?.geminiGenerationAttemptedAt;

  if (isGeminiConfigured() && !hasGeminiContent && !alreadyAttemptedGemini) {
    const plantingISO = toISODate(planting);
    const cropDisplay = cropName || cropType;

    let generated: Awaited<ReturnType<typeof generateLocalizedFarmingPlanV1>> | null = null;
    try {
      generated = await generateLocalizedFarmingPlanV1({
        cropType,
        cropName: cropDisplay,
        areaAcres: Number(params.areaAcres) || 0,
        plantingDateISO: plantingISO,
        expectedHarvestDateISO: expectedHarvest ? toISODate(expectedHarvest) : undefined,
        country: 'India',
      });
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : 'Gemini plan generation failed';
      await setDoc(
        ref,
        {
          geminiGenerationAttemptedAt: now,
          geminiGenerationError: message,
          updatedAt: now,
        } as Partial<StoredFarmingPlan>,
        { merge: true }
      );
      generated = null;
    }

    if (!generated) {
      // Fall back to heuristic plan so the user can still create a plan.
      const base = buildHeuristicPlan({
        cropType,
        cropName: cropDisplay,
        areaAcres: Number(params.areaAcres) || 0,
        plantingDate: planting,
        expectedHarvestDate: expectedHarvest,
      });

      const planDoc: StoredFarmingPlan = {
        ...base,
        id: planId,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        source: params.source || base.source,
        geminiGenerationAttemptedAt: now,
        geminiGenerationError: existing?.geminiGenerationError || 'Gemini plan generation failed',
      };

      await setDoc(ref, planDoc, { merge: true });
      return { planId };
    }

    let expectedHarvestDateISO =
      generated?.dates?.expectedHarvestDateISO ||
      (expectedHarvest ? toISODate(expectedHarvest) : plantingISO);

    // Safety: ensure harvest date is after planting date.
    if (expectedHarvestDateISO <= plantingISO) {
      expectedHarvestDateISO = toISODate(addDays(planting, 1));
    }

    const harvest =
      parseLooseDate(expectedHarvestDateISO) ||
      (expectedHarvest ? expectedHarvest : addDays(planting, inferMaturityDays(cropDisplay)));
    const cleanupAfterISO = toISODate(addDays(harvest, 1));

    const wateringRules: FarmingWateringRule[] = (generated.wateringRules || []).map((w, idx) => ({
      startDay: Number(w.startDay) || 0,
      endDay: Number(w.endDay) || 0,
      everyDays: Math.max(1, Number(w.everyDays) || 1),
      timeOfDay: (w.timeOfDay as TimeOfDay) || undefined,
      timeHHmm: w.timeHHmm || undefined,
      title: (w.title?.en || '').trim(),
      titleI18n: w.title,
      notes: (w.notes?.en || '').trim(),
      notesI18n: w.notes,
    }));

    const recurringTasks: FarmingRecurringTaskRule[] = (generated.recurringTasks || []).map((r, idx) => {
      const titleEn = (r.title?.en || '').trim();
      const inferred = inferTimeOfDay(((r.type as FarmingTaskType) || 'general'));
      const timeOfDay = (r.timeOfDay as TimeOfDay) || inferred;
      return {
        id: `${sanitizeId(r.type)}-${sanitizeId(titleEn || `task-${idx}`)}`,
        type: (r.type as FarmingTaskType) || 'general',
        title: titleEn || 'Task',
        titleI18n: r.title,
        startDay: Number(r.startDay) || 0,
        endDay: Number(r.endDay) || 0,
        everyDays: Math.max(1, Number(r.everyDays) || 7),
        timeOfDay,
        timeHHmm: r.timeHHmm || defaultTimeHHmmForTimeOfDay(timeOfDay),
        notes: (r.notes?.en || '').trim(),
        notesI18n: r.notes,
      };
    });

    const tasks: FarmingOneOffTask[] = (generated.oneOffTasks || []).map((t, idx) => {
      const titleEn = (t.title?.en || '').trim();
      const due = (t.dueDateISO || '').trim();
      const inferred = inferTimeOfDay(((t.type as FarmingTaskType) || 'general'));
      const timeOfDay = (t.timeOfDay as TimeOfDay) || inferred;
      return {
        id: `${sanitizeId(t.type)}-${sanitizeId(titleEn || `task-${idx}`)}-${due}`,
        type: (t.type as FarmingTaskType) || 'general',
        title: titleEn || 'Task',
        titleI18n: t.title,
        dueDateISO: due,
        timeOfDay,
        timeHHmm: t.timeHHmm || defaultTimeHHmmForTimeOfDay(timeOfDay),
        notes: (t.notes?.en || '').trim(),
        notesI18n: t.notes,
      };
    });

    const planDoc: StoredFarmingPlan = {
      id: planId,
      cropType,
      cropName: cropDisplay,
      areaAcres: Number(params.areaAcres) || 0,
      planTitleI18n: generated.title,
      planOverviewI18n: generated.overview,
      plantingDateISO: generated.dates.plantingDateISO,
      expectedHarvestDateISO,
      cleanupAfterISO,
      wateringRules,
      recurringTasks,
      tasks,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      status: 'active',
      source: params.source || 'gemini',
      generatedAt: now,
      geminiGenerationAttemptedAt: now,
      geminiGenerationError: '',
    };

    await setDoc(ref, planDoc, { merge: true });
    return { planId };
  }

  // Fallback: heuristic schedule (kept for offline/misconfigured Gemini).
  const base = buildHeuristicPlan({
    cropType,
    cropName: cropName || cropType,
    areaAcres: Number(params.areaAcres) || 0,
    plantingDate: planting,
    expectedHarvestDate: expectedHarvest,
  });

  const planDoc: StoredFarmingPlan = {
    ...base,
    id: planId,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    source: params.source || base.source,
  };

  await setDoc(ref, planDoc, { merge: true });
  return { planId };
};

export const cleanupExpiredFarmingPlansForCurrentUser = async (): Promise<{ deleted: number }> => {
  const user = auth.currentUser;
  if (!user) return { deleted: 0 };

  const todayISO = toISODate(new Date());
  const q = query(plansCollectionRef(user.uid), where('cleanupAfterISO', '<', todayISO));
  const snap = await getDocs(q);

  let deleted = 0;
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
    deleted++;
  }

  return { deleted };
};

const expandUpcomingFromRules = (params: {
  plan: StoredFarmingPlan;
  windowDays: number;
  language?: string;
}): FarmingTaskInstance[] => {
  const { plan, windowDays } = params;
  const lang = normalizeLanguage(params.language);

  // MATHEMATICAL EXPANSION ENGINE
  // This function takes Gemini-generated rules (e.g., "water every 3 days from day 0 to 30")
  // and expands them into individual calendar entries (day 0, day 3, day 6, day 9...)
  // The calendar UI shows these expanded entries in the user's language.

  const planting = parseLooseDate(plan.plantingDateISO);
  if (!planting) return [];

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = addDays(start, windowDays);

  const inWindow = (iso: string) => iso >= toISODate(start) && iso <= toISODate(end);

  const results: FarmingTaskInstance[] = [];

  // Helper to get localized title with heuristic fallback for old plans
  const getLocalizedTitleUpcoming = (titleI18n: LocalizedText3 | undefined, fallbackTitle: string): string => {
    const fromI18n = pickI18n(titleI18n, lang);
    if (fromI18n) return fromI18n;
    const heuristic = HEURISTIC_TRANSLATIONS[fallbackTitle];
    if (heuristic) return pickI18n(heuristic, lang) || fallbackTitle;
    return fallbackTitle;
  };

  // Helper to get localized notes with heuristic fallback for old plans
  const getLocalizedNotesUpcoming = (notesI18n: LocalizedText3 | undefined, fallbackNotes: string | undefined): string | undefined => {
    if (!fallbackNotes) return undefined;
    const fromI18n = pickI18n(notesI18n, lang);
    if (fromI18n) return fromI18n;
    const heuristic = HEURISTIC_NOTES_TRANSLATIONS[fallbackNotes];
    if (heuristic) return pickI18n(heuristic, lang) || fallbackNotes;
    return fallbackNotes;
  };

  // One-off tasks.
  for (const t of plan.tasks || []) {
    if (inWindow(t.dueDateISO)) {
      results.push({
        planId: plan.id,
        cropName: plan.cropName,
        planTitle: pickI18n(plan.planTitleI18n, lang) || plan.cropName,
        planExpectedHarvestDateISO: plan.expectedHarvestDateISO,
        type: t.type,
        title: getLocalizedTitleUpcoming(t.titleI18n, t.title),
        dueDateISO: t.dueDateISO,
        notes: getLocalizedNotesUpcoming(t.notesI18n, t.notes),
      });
    }
  }

  // Recurring tasks.
  for (const r of plan.recurringTasks || []) {
    const first = addDays(planting, r.startDay);
    const last = addDays(planting, r.endDay);

    // Find the first occurrence on/after start.
    let cursor = new Date(first);
    // Align cursor to >= today.
    while (cursor < start) {
      cursor = addDays(cursor, r.everyDays);
      if (cursor > last) break;
    }

    while (cursor <= end && cursor <= last) {
      const due = toISODate(cursor);
      results.push({
        planId: plan.id,
        cropName: plan.cropName,
        planTitle: pickI18n(plan.planTitleI18n, lang) || plan.cropName,
        planExpectedHarvestDateISO: plan.expectedHarvestDateISO,
        type: r.type,
        title: getLocalizedTitleUpcoming(r.titleI18n, r.title),
        dueDateISO: due,
        notes: getLocalizedNotesUpcoming(r.notesI18n, r.notes),
      });
      cursor = addDays(cursor, r.everyDays);
    }
  }

  // Watering rules: surface as “Water crop” occurrences (rule-based).
  for (const w of plan.wateringRules || []) {
    if (w.everyDays >= 9999) continue; // stop-irrigation rule

    const first = addDays(planting, w.startDay);
    const last = addDays(planting, w.endDay);

    let cursor = new Date(first);
    while (cursor < start) {
      cursor = addDays(cursor, w.everyDays);
      if (cursor > last) break;
    }

    while (cursor <= end && cursor <= last) {
      const due = toISODate(cursor);
      const defaultWateringTitle = 'Water/irrigate (as per stage)';
      results.push({
        planId: plan.id,
        cropName: plan.cropName,
        planTitle: pickI18n(plan.planTitleI18n, lang) || plan.cropName,
        planExpectedHarvestDateISO: plan.expectedHarvestDateISO,
        type: 'watering',
        title: getLocalizedTitleUpcoming(w.titleI18n, w.title || defaultWateringTitle),
        dueDateISO: due,
        notes: getLocalizedNotesUpcoming(w.notesI18n, w.notes),
      });
      cursor = addDays(cursor, w.everyDays);
    }
  }

  return results;
};

export const getUpcomingFarmingTasksForCurrentUser = async (params?: {
  windowDays?: number;
  language?: string;
}): Promise<FarmingTaskInstance[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  const windowDays = Math.max(1, Math.floor(params?.windowDays ?? 7));

  const q = query(plansCollectionRef(user.uid), where('status', '==', 'active'));
  const snap = await getDocs(q);

  const plans = snap.docs
    .map((d) => d.data() as StoredFarmingPlan)
    .filter(Boolean);

  const expanded = plans.flatMap((p) =>
    expandUpcomingFromRules({ plan: p, windowDays, language: params?.language })
  );

  // Deduplicate by (planId + dueDate + title).
  const unique = Object.values(
    expanded.reduce<Record<string, FarmingTaskInstance>>((acc, task) => {
      const key = `${task.planId}|${task.dueDateISO}|${task.title}`;
      acc[key] = task;
      return acc;
    }, {})
  ).sort((a, b) => {
    const byDate = a.dueDateISO.localeCompare(b.dueDateISO);
    if (byDate !== 0) return byDate;
    const byHarvest = (a.planExpectedHarvestDateISO || '').localeCompare(b.planExpectedHarvestDateISO || '');
    if (byHarvest !== 0) return byHarvest;
    const byPlan = (a.planTitle || a.cropName || '').localeCompare(b.planTitle || b.cropName || '');
    if (byPlan !== 0) return byPlan;
    return (a.title || '').localeCompare(b.title || '');
  });

  return unique;
};

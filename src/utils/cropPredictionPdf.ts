import { Platform } from 'react-native';
import type { CropPredictionResult } from '../services/gemini';

import { localizeNumber } from './numberLocalization';

export type CropPredictionPdfLevel = 'low' | 'medium' | 'high';

export interface GenerateCropPredictionPdfParams {
  predictionData: CropPredictionResult;
  farmerName?: string;
  language: string;
  appName?: string;
  t?: (key: string, options?: Record<string, any>) => string;
}

export interface GenerateCropPredictionPdfResult {
  filename: string;
  // Native-only: points to a file URI in app document dir
  uri?: string;
}

const coerceLanguage = (language: string): 'en' | 'hi' | 'bn' => {
  if (language === 'hi' || language === 'bn' || language === 'en') return language;
  return 'en';
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatDateForFilename = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
};

const MONTH_SHORT: Record<'en' | 'hi' | 'bn', string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  hi: ['जन', 'फ़र', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुल', 'अग', 'सित', 'अक्त', 'नव', 'दिस'],
  bn: ['জানু', 'ফেব', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুল', 'আগ', 'সেপ', 'অক্টো', 'নভে', 'ডিস'],
};

const formatDateTimeForDisplayLocalized = (d: Date, lang: 'en' | 'hi' | 'bn') => {
  // Example: 16 Jan 2026, 14:35 (localized digits + month)
  const day = pad2(d.getDate());
  const month = MONTH_SHORT[lang][d.getMonth()] || MONTH_SHORT.en[d.getMonth()];
  const year = String(d.getFullYear());
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());

  const display = `${day} ${month} ${year}, ${hh}:${min}`;
  return localizeNumber(display, lang);
};

const sanitizeForFilename = (value: string) => {
  const cleaned = (value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-_.]/g, '')
    .replace(/-+/g, '-');
  return cleaned.length > 0 ? cleaned : 'farmer';
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

/**
 * Format and localize a number based on language
 */
const formatNumberLocalized = (value: number, lang: 'en' | 'hi' | 'bn'): string => {
  return localizeNumber(String(Math.round(value)), lang);
};

/**
 * Format a decimal number with given precision and localize based on language
 */
const formatDecimalLocalized = (value: number, decimals: number, lang: 'en' | 'hi' | 'bn'): string => {
  return localizeNumber(value.toFixed(decimals), lang);
};

const levelFromPercent = (percent: number): CropPredictionPdfLevel => {
  const p = clampPercent(percent);
  if (p >= 70) return 'high';
  if (p >= 40) return 'medium';
  return 'low';
};

const riskFromSignals = (params: {
  confidencePercent: number;
  climateScore: number;
  healthPercent: number;
}): CropPredictionPdfLevel => {
  const { confidencePercent, climateScore, healthPercent } = params;

  // Conservative heuristic: if any core signal is low, risk is higher.
  const min = Math.min(
    clampPercent(confidencePercent),
    clampPercent(climateScore),
    clampPercent(healthPercent)
  );

  if (min < 40) return 'high';
  if (min < 70) return 'medium';
  return 'low';
};

const levelLabel = (level: CropPredictionPdfLevel, lang: 'en' | 'hi' | 'bn') => {
  switch (lang) {
    case 'hi':
      return level === 'high' ? 'उच्च' : level === 'medium' ? 'मध्यम' : 'कम';
    case 'bn':
      return level === 'high' ? 'উচ্চ' : level === 'medium' ? 'মাঝারি' : 'কম';
    default:
      return level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low';
  }
};

const safeT = (
  t: GenerateCropPredictionPdfParams['t'] | undefined,
  key: string,
  fallback: string,
  options?: Record<string, any>
) => {
  try {
    const translated = t?.(key, options);
    if (typeof translated === 'string' && translated.trim().length > 0 && translated !== key) {
      return translated;
    }
  } catch {
    // ignore
  }
  return fallback;
};

const buildKeyInsights = (params: {
  predictionData: CropPredictionResult;
  lang: 'en' | 'hi' | 'bn';
  t?: GenerateCropPredictionPdfParams['t'];
}) => {
  const { predictionData, lang, t } = params;

  const yieldKg = predictionData.financialConfidence?.predictedYieldKg ?? 0;
  const yieldTons = predictionData.financialProjection?.yieldTons ?? 0;
  const price = predictionData.financialProjection?.marketPricePerKgInr ?? 0;
  const revenue = predictionData.financialProjection?.projectedRevenueInr ?? 0;
  const confidence = predictionData.financialConfidence?.confidencePercent ?? 0;
  const climate = predictionData.financialConfidence?.climateScore ?? 0;
  const health = predictionData.cropHealth?.healthPercent ?? 0;

  // Keep these short; PDF is farmer-friendly.
  const insights: string[] = [];

  // Pass localized numbers to translation function
  const localizedYieldKg = formatNumberLocalized(yieldKg, lang);
  const localizedYieldTons = formatDecimalLocalized(yieldTons, 1, lang);
  const localizedRevenue = formatNumberLocalized(revenue, lang);
  const localizedPrice = formatNumberLocalized(price, lang);
  const localizedConfidence = formatNumberLocalized(confidence, lang);
  const localizedClimate = formatNumberLocalized(climate, lang);
  const localizedClimate100 = formatNumberLocalized(100, lang);
  const localizedHealth = formatNumberLocalized(health, lang);

  insights.push(
    safeT(
      t,
      'pdf.insight.yield',
      lang === 'hi'
        ? `अनुमानित उपज: ${localizedYieldKg} किग्रा (लगभग ${localizedYieldTons} टन)`
        : lang === 'bn'
          ? `আনুমানিক ফলন: ${localizedYieldKg} কেজি (প্রায় ${localizedYieldTons} টন)`
          : `Estimated yield: ${localizedYieldKg} kg (~${localizedYieldTons} tons)`,
      { yieldKg: localizedYieldKg, yieldTons: localizedYieldTons }
    )
  );

  insights.push(
    safeT(
      t,
      'pdf.insight.revenue',
      lang === 'hi'
        ? `अनुमानित आय: ₹${localizedRevenue} (₹${localizedPrice}/किग्रा के आसपास)`
        : lang === 'bn'
          ? `আনুমানিক আয়: ₹${localizedRevenue} (প্রায় ₹${localizedPrice}/কেজি)`
          : `Projected revenue: ₹${localizedRevenue} (~₹${localizedPrice}/kg)`,
      { revenue: localizedRevenue, price: localizedPrice }
    )
  );

  insights.push(
    safeT(
      t,
      'pdf.insight.confidence',
      lang === 'hi'
        ? `विश्वास स्तर: ${localizedConfidence}% • जलवायु स्कोर: ${localizedClimate}/${localizedClimate100}`
        : lang === 'bn'
          ? `আস্থা: ${localizedConfidence}% • জলবায়ু স্কোর: ${localizedClimate}/${localizedClimate100}`
          : `Confidence: ${localizedConfidence}% • Climate score: ${localizedClimate}/100`,
      { confidence: localizedConfidence, climate: localizedClimate, climate100: localizedClimate100 }
    )
  );

  insights.push(
    safeT(
      t,
      'pdf.insight.health',
      lang === 'hi'
        ? `फसल स्वास्थ्य: ${localizedHealth}% (${levelLabel(levelFromPercent(health), lang)})`
        : lang === 'bn'
          ? `ফসলের স্বাস্থ্য: ${localizedHealth}% (${levelLabel(levelFromPercent(health), lang)})`
          : `Crop health: ${localizedHealth}% (${levelLabel(levelFromPercent(health), lang)})`,
      { health: localizedHealth }
    )
  );

  return insights;
};

const cssForLevel = (level: CropPredictionPdfLevel) => {
  switch (level) {
    case 'high':
      return { bg: '#DCFCE7', fg: '#166534', border: '#86EFAC' };
    case 'medium':
      return { bg: '#FEF9C3', fg: '#854D0E', border: '#FDE047' };
    default:
      return { bg: '#FEE2E2', fg: '#991B1B', border: '#FCA5A5' };
  }
};

const buildReportHtml = (params: {
  predictionData: CropPredictionResult;
  farmerName: string;
  generatedAt: Date;
  lang: 'en' | 'hi' | 'bn';
  appName: string;
  t?: GenerateCropPredictionPdfParams['t'];
}) => {
  const { predictionData, farmerName, generatedAt, lang, appName, t } = params;

  const ICONS = {
    calendar: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 3v3M16 3v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 8h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="2"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" stroke-width="2"/></svg>`,
    sprout: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 21V11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 11c0-4-3-7-7-7 0 4 3 7 7 7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 11c0-4 3-7 7-7 0 4-3 7-7 7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
    coin: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 3c4.418 0 8 1.79 8 4s-3.582 4-8 4-8-1.79-8-4 3.582-4 8-4Z" stroke="currentColor" stroke-width="2"/><path d="M4 7v5c0 2.21 3.582 4 8 4s8-1.79 8-4V7" stroke="currentColor" stroke-width="2"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 3 20 7v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
    heart: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 21s-7-4.35-9.33-8.14C.36 9.38 2.28 5.5 6.5 5.5c2.02 0 3.54 1.03 4.5 2.26C11.96 6.53 13.48 5.5 15.5 5.5c4.22 0 6.14 3.88 3.83 7.36C19 16.65 12 21 12 21Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
    lightbulb: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 18h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 22h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 2a7 7 0 0 0-4 12c.7.6 1 1.2 1 2v.5h6V16c0-.8.3-1.4 1-2A7 7 0 0 0 12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  };

  const sectionTitle = (params: { icon: string; text: string; accent: string }) => {
    const { icon, text, accent } = params;
    return `
      <div class="sectionTitleRow">
        <div class="iconBadge" style="background:${accent};">${icon}</div>
        <div class="sectionTitle">${text}</div>
      </div>
    `;
  };

  const confidence = predictionData.financialConfidence?.confidencePercent ?? 0;
  const climate = predictionData.financialConfidence?.climateScore ?? 0;
  const yieldKg = predictionData.financialConfidence?.predictedYieldKg ?? 0;

  const revenue = predictionData.financialProjection?.projectedRevenueInr ?? 0;
  const marketPrice = predictionData.financialProjection?.marketPricePerKgInr ?? 0;
  const yieldTons = predictionData.financialProjection?.yieldTons ?? 0;

  const healthPercent = predictionData.cropHealth?.healthPercent ?? 0;
  const healthStatus = predictionData.cropHealth?.status ?? '';
  const healthNotes = predictionData.cropHealth?.notes ?? '';

  const soil = predictionData.riskAnalysis?.soilHealth ?? '';
  const climateCond = predictionData.riskAnalysis?.climateCondition ?? '';
  const otherRisks = predictionData.riskAnalysis?.additionalRisks ?? '';

  const recommendation = predictionData.recommendation ?? '';

  const healthLevel = levelFromPercent(healthPercent);
  const riskLevel = riskFromSignals({
    confidencePercent: confidence,
    climateScore: climate,
    healthPercent,
  });

  const healthChip = cssForLevel(healthLevel);
  const riskChip = cssForLevel(riskLevel);

  const reportTitle = safeT(
    t,
    'pdf.cropPredictionReportTitle',
    lang === 'hi'
      ? 'फसल भविष्यवाणी रिपोर्ट'
      : lang === 'bn'
        ? 'ফসল পূর্বাভাস রিপোর্ট'
        : 'Crop Prediction Report'
  );

  const keyInsightsTitle = safeT(
    t,
    'pdf.keyInsights',
    lang === 'hi' ? 'मुख्य निष्कर्ष' : lang === 'bn' ? 'মূল অন্তর্দৃষ্টি' : 'Key insights'
  );

  const footerNote = safeT(
    t,
    'pdf.generatedByApp',
    lang === 'hi'
      ? 'ऐप द्वारा जनरेट किया गया'
      : lang === 'bn'
        ? 'অ্যাপ দ্বারা তৈরি'
        : 'Generated by the app'
  );

  const analysisDateLabel = safeT(
    t,
    'pdf.analysisDateTime',
    lang === 'hi'
      ? 'विश्लेषण की तारीख/समय'
      : lang === 'bn'
        ? 'বিশ্লেষণের তারিখ/সময়'
        : 'Date & time of analysis'
  );

  const farmerLabel = safeT(
    t,
    'pdf.farmerName',
    lang === 'hi' ? 'किसान का नाम' : lang === 'bn' ? 'কৃষকের নাম' : 'Farmer name'
  );

  const sections = {
    financialConfidence: safeT(
      t,
      'result.financialConfidenceTitle',
      lang === 'hi' ? 'वित्तीय विश्वास' : lang === 'bn' ? 'আর্থিক আস্থা' : 'Financial Confidence'
    ),
    financialProjection: safeT(
      t,
      'result.financialProjectionTitle',
      lang === 'hi' ? 'वित्तीय अनुमान' : lang === 'bn' ? 'আর্থিক পূর্বাভাস' : 'Financial Projection'
    ),
    cropHealth: safeT(
      t,
      'result.cropHealthTitle',
      lang === 'hi' ? 'फसल स्वास्थ्य' : lang === 'bn' ? 'ফসলের স্বাস্থ্য' : 'Crop Health'
    ),
    riskAnalysis: safeT(
      t,
      'result.riskAnalysisTitle',
      lang === 'hi' ? 'जोखिम विश्लेषण' : lang === 'bn' ? 'ঝুঁকি বিশ্লেষণ' : 'Risk analysis'
    ),
    recommendation: safeT(
      t,
      'result.recommendationTitle',
      lang === 'hi' ? 'सिफारिश' : lang === 'bn' ? 'সুপারিশ' : 'Recommendation'
    ),
  };

  const insights = buildKeyInsights({ predictionData, lang, t });

  // Clean, minimal, printable layout. Avoid local images for iOS WKWebView.
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @page { margin: 26px; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      line-height: 1.45;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    :root {
      --bg: #FFFFFF;
      --surface: #F8FAFC;
      --card: #FFFFFF;
      --border: #E2E8F0;
      --text: #0F172A;
      --muted: #475569;
      --muted2: #64748B;
      --shadow: rgba(15, 23, 42, 0.06);
      --space-1: 6px;
      --space-2: 10px;
      --space-3: 14px;
      --space-4: 18px;
      --space-5: 22px;
      --radius-lg: 16px;
      --radius-md: 12px;
      --accent: #16A34A;
      --accent2: #22C55E;
      --accent3: #0EA5E9;
      --warn: #F59E0B;
    }

    .container { width: 100%; }

    .header {
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
      background: linear-gradient(135deg, rgba(34,197,94,0.12), rgba(14,165,233,0.10) 55%, rgba(248,250,252,1));
      box-shadow: 0 10px 24px var(--shadow);
    }

    .topRow { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brandMark {
      width: 34px; height: 34px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      box-shadow: 0 10px 18px rgba(22,163,74,0.18);
    }
    .brandMark svg { width: 18px; height: 18px; }
    .appName { font-size: 13px; font-weight: 800; color: #0F172A; letter-spacing: 0.2px; }
    .title { font-size: 24px; font-weight: 900; margin: var(--space-2) 0 var(--space-3); }
    .subtitle { font-size: 12px; color: var(--muted); font-weight: 700; }

    .meta {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
      font-size: 12px;
      color: var(--muted);
    }

    .metaBox {
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.92);
      border-radius: var(--radius-md);
      padding: 12px 12px;
      min-width: 220px;
      flex: 1;
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .metaIcon {
      width: 32px;
      height: 32px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #FFFFFF;
      border: 1px solid var(--border);
      color: var(--muted);
      flex: 0 0 auto;
    }
    .metaIcon svg { width: 16px; height: 16px; }

    .label { font-weight: 900; color: #334155; font-size: 11px; text-transform: uppercase; letter-spacing: 0.35px; }
    .value { margin-top: 5px; font-weight: 800; color: var(--text); font-size: 13px; }

    .section {
      margin-top: var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
      background: var(--card);
      box-shadow: 0 10px 20px var(--shadow);
    }

    .sectionTitleRow { display: flex; align-items: center; gap: 10px; margin: 0 0 var(--space-3); }
    .iconBadge {
      width: 30px;
      height: 30px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0F172A;
      border: 1px solid rgba(15,23,42,0.06);
    }
    .iconBadge svg { width: 16px; height: 16px; }
    .sectionTitle { font-size: 15px; font-weight: 900; color: #111827; letter-spacing: 0.2px; }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }

    .row {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 12px 12px;
      background: linear-gradient(180deg, rgba(248,250,252,1), rgba(255,255,255,1));
    }

    .rowKey { font-size: 11px; font-weight: 900; color: var(--muted); text-transform: uppercase; letter-spacing: 0.35px; }
    .rowVal { margin-top: 8px; font-size: 16px; font-weight: 900; color: var(--text); }
    .rowSub { margin-top: 6px; font-size: 12px; color: var(--muted2); font-weight: 700; }

    .chip {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 999px;
      border: 1px solid;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.2px;
      vertical-align: middle;
    }

    .textBlock {
      font-size: 13px;
      color: var(--text);
      font-weight: 700;
      white-space: pre-wrap;
    }

    ul { margin: var(--space-2) 0 0; padding-left: 18px; }
    li { margin: 7px 0; color: var(--text); font-weight: 700; }

    .footer {
      margin-top: var(--space-4);
      padding-top: var(--space-3);
      border-top: 1px dashed #CBD5E1;
      font-size: 11px;
      color: var(--muted2);
      text-align: center;
    }

    @media print {
      .section { break-inside: avoid; }
      .row { break-inside: avoid; }
    }

    /* Small screens: single column */
    @media (max-width: 520px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="topRow">
        <div class="brand">
          <div class="brandMark">${ICONS.sprout}</div>
          <div>
            <div class="appName">${appName}</div>
            <div class="subtitle">${safeT(t, 'result.subtitle', 'Based on your inputs')}</div>
          </div>
        </div>
      </div>
      <div class="title">${reportTitle}</div>
      <div class="meta">
        <div class="metaBox">
          <div class="metaIcon">${ICONS.user}</div>
          <div>
            <div class="label">${farmerLabel}</div>
            <div class="value">${farmerName}</div>
          </div>
        </div>
        <div class="metaBox">
          <div class="metaIcon">${ICONS.calendar}</div>
          <div>
            <div class="label">${analysisDateLabel}</div>
            <div class="value">${formatDateTimeForDisplayLocalized(generatedAt, lang)}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      ${sectionTitle({ icon: ICONS.sprout, text: sections.financialConfidence, accent: 'rgba(34,197,94,0.18)' })}
      <div class="grid">
        <div class="row">
          <div class="rowKey">${safeT(t, 'result.predictedYieldForArea', 'Predicted yield')}</div>
          <div class="rowVal">${formatNumberLocalized(yieldKg, lang)} ${safeT(t, 'units.kg', 'kg')}</div>
          <div class="rowSub">${formatDecimalLocalized(yieldTons, 1, lang)} ${safeT(t, 'units.tons', 'tons')}</div>
        </div>
        <div class="row">
          <div class="rowKey">${safeT(t, 'result.confidencePercent', 'Confidence')}</div>
          <div class="rowVal">${formatNumberLocalized(confidence, lang)}%</div>
          <div class="rowSub">${safeT(t, 'result.climateScore', 'Climate score')}: ${formatNumberLocalized(climate, lang)}/100</div>
        </div>
      </div>
    </div>

    <div class="section">
      ${sectionTitle({ icon: ICONS.coin, text: sections.financialProjection, accent: 'rgba(245,158,11,0.16)' })}
      <div class="grid">
        <div class="row">
          <div class="rowKey">${safeT(t, 'result.totalRevenue', 'Projected revenue')}</div>
          <div class="rowVal">₹${formatNumberLocalized(revenue, lang)}</div>
          <div class="rowSub">${safeT(t, 'result.marketPrice', 'Market price')}: ₹${formatNumberLocalized(marketPrice, lang)}/${safeT(t, 'units.kg', 'kg')}</div>
        </div>
        <div class="row">
          <div class="rowKey">${safeT(t, 'result.yieldTons', 'Yield')}</div>
          <div class="rowVal">${formatDecimalLocalized(yieldTons, 1, lang)} ${safeT(t, 'units.tons', 'tons')}</div>
          <div class="rowSub">${safeT(t, 'units.kg', 'kg')}: ${formatNumberLocalized(yieldKg, lang)}</div>
        </div>
      </div>
    </div>

    <div class="section">
      ${sectionTitle({ icon: ICONS.heart, text: sections.cropHealth, accent: 'rgba(14,165,233,0.14)' })}
      <div style="margin-bottom: 10px;">
        <span class="chip" style="background:${healthChip.bg}; color:${healthChip.fg}; border-color:${healthChip.border};">
          ${levelLabel(healthLevel, lang)}
        </span>
        <span style="margin-left: 10px; font-weight: 900;">${formatNumberLocalized(healthPercent, lang)}%</span>
      </div>
      <div class="textBlock">
        ${healthStatus ? `<div><strong>${safeT(t, 'result.healthStatus', 'Status')}:</strong> ${healthStatus}</div>` : ''}
        ${healthNotes ? `<div style=\"margin-top:6px;\"><strong>${safeT(t, 'result.healthNotes', 'Notes')}:</strong> ${healthNotes}</div>` : ''}
      </div>
    </div>

    <div class="section">
      ${sectionTitle({ icon: ICONS.shield, text: sections.riskAnalysis, accent: 'rgba(245,158,11,0.14)' })}
      <div style="margin-bottom: 10px;">
        <span class="chip" style="background:${riskChip.bg}; color:${riskChip.fg}; border-color:${riskChip.border};">
          ${levelLabel(riskLevel, lang)}
        </span>
      </div>
      <div class="textBlock">
        ${soil ? `<div><strong>${safeT(t, 'result.soilHealth', 'Soil')}:</strong> ${soil}</div>` : ''}
        ${climateCond ? `<div style=\"margin-top:6px;\"><strong>${safeT(t, 'result.climateCondition', 'Climate')}:</strong> ${climateCond}</div>` : ''}
        ${otherRisks ? `<div style=\"margin-top:6px;\"><strong>${safeT(t, 'result.additionalRisks', 'Other risks')}:</strong> ${otherRisks}</div>` : ''}
      </div>
    </div>

    <div class="section">
      ${sectionTitle({ icon: ICONS.lightbulb, text: sections.recommendation, accent: 'rgba(34,197,94,0.14)' })}
      <div class="textBlock">${recommendation}</div>
    </div>

    <div class="section">
      ${sectionTitle({ icon: ICONS.sprout, text: keyInsightsTitle, accent: 'rgba(14,165,233,0.12)' })}
      <ul>
        ${insights.map((s) => `<li>${s}</li>`).join('')}
      </ul>
    </div>

    <div class="footer">${footerNote}</div>
  </div>
</body>
</html>`;
};

const buildFilename = (params: { farmerName: string; date: Date }) => {
  const safeFarmer = sanitizeForFilename(params.farmerName);
  const datePart = formatDateForFilename(params.date);
  return `crop-prediction_${safeFarmer}_${datePart}.pdf`;
};

// Web-only: build PDF by rendering the HTML to canvas (supports all scripts/fonts via rasterization).
const downloadPdfOnWeb = async (params: {
  html: string;
  filename: string;
}): Promise<void> => {
  const { html, filename } = params;

  const doc = (globalThis as any)?.document;
  if (!doc || !doc.body) {
    throw new Error('Web PDF download is not available in this environment.');
  }

  // Dynamic imports keep native bundles smaller.
  const [{ jsPDF }, html2canvasModule] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const html2canvas: any = (html2canvasModule as any).default ?? html2canvasModule;

  const container = doc.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px'; // approx A4 width in px at 96 DPI
  container.style.background = 'white';
  container.innerHTML = html;
  doc.body.appendChild(container);

  try {
    // Render the body content only.
    const target = container.querySelector('body') as any;
    const canvas = await html2canvas(target ?? container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#FFFFFF',
      logging: false,
    });

    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgData = canvas.toDataURL('image/png');

    // Fit to width; then paginate by slicing height.
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 0;
    let remaining = imgHeight;

    // Add first page.
    pdf.addImage(imgData, 'PNG', 0, y, imgWidth, imgHeight);
    remaining -= pageHeight;

    // For subsequent pages, we re-add the same image shifted up.
    while (remaining > 0) {
      pdf.addPage();
      y = -(imgHeight - remaining);
      pdf.addImage(imgData, 'PNG', 0, y, imgWidth, imgHeight);
      remaining -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    doc.body.removeChild(container);
  }
};

export const generateCropPredictionPdf = async (
  params: GenerateCropPredictionPdfParams
): Promise<GenerateCropPredictionPdfResult> => {
  const lang = coerceLanguage(params.language);
  const farmerName = (params.farmerName || '').trim() || 'Farmer';
  const generatedAt = new Date();
  const filename = buildFilename({ farmerName, date: generatedAt });

  const appName =
    (params.appName || '').trim() ||
    (lang === 'hi' ? 'कृषकसारथी' : lang === 'bn' ? 'কৃষকসারথি' : 'KrishakSarthi');

  const html = buildReportHtml({
    predictionData: params.predictionData,
    farmerName,
    generatedAt,
    lang,
    appName,
    t: params.t,
  });

  if (Platform.OS === 'web') {
    await downloadPdfOnWeb({ html, filename });
    return { filename };
  }

  // Native: expo-print writes to cache; we copy to documentDirectory for persistence.
  const Print = await import('expo-print');
  const FileSystem = await import('expo-file-system');

  // expo-file-system has different export shapes across TS/JS builds.
  // Prefer default export if present.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const FS: any = (FileSystem as any).default ?? FileSystem;

  const result = await Print.printToFileAsync({ html });

  const destDir = FS.documentDirectory as string | null | undefined;
  if (!destDir) {
    // Extremely rare, but handle gracefully.
    return { filename, uri: result.uri };
  }

  const destUri = `${destDir}${filename}`;

  try {
    const info = await FS.getInfoAsync(destUri);
    if (info.exists) {
      await FS.deleteAsync(destUri, { idempotent: true });
    }
  } catch {
    // ignore
  }

  await FS.copyAsync({ from: result.uri, to: destUri });

  return { filename, uri: destUri };
};

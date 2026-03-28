import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  InteractionManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, Lightbulb, Volume2, Square, TrendingUp, Activity, AlertTriangle, DollarSign, Download } from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { localizeNumber } from '../utils/numberLocalization';
import MovingBackgroundCircle from '@/components/MovingBackgroundCircle';
import { getCurrentUser } from '../services/auth';

type PredictionResultScreenRouteProp = RouteProp<
  RootStackParamList,
  'PredictionResult'
>;

type PredictionResultScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'PredictionResult'
>;

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const formatNumberForSpeech = (value: number, decimals?: number) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  if (typeof decimals === 'number') {
    // Use western digits here; we optionally localize digits later, after range normalization.
    const fixed = num.toFixed(decimals);
    return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  }
  return String(Math.round(num));
};

const normalizeForSpeech = (text: string) => {
  return (text || '')
    .replace(/[₹]/g, '')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const MetricBar = (props: {
  label: string;
  valueText: string;
  percent: number;
  color: string;
  gradientColors?: readonly [string, string, ...string[]];
}) => {
  const { label, valueText, percent, color, gradientColors } = props;
  return (
    <View className="mb-5">
      <View className="flex-row justify-between items-end mb-2.5">
        <Text className="text-gray-600 text-xs font-bold tracking-wide uppercase opacity-80">{label}</Text>
        <Text className="text-gray-900 text-sm font-extrabold">{valueText}</Text>
      </View>
      <View
        style={{
          height: 12,
          borderRadius: 999,
          backgroundColor: '#F3F4F6',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.04)',
        }}
      >
        {gradientColors ? (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              width: `${clampPercent(percent)}%`,
              height: '100%',
              borderRadius: 999,
            }}
          />
        ) : (
          <View
            style={{
              width: `${clampPercent(percent)}%`,
              height: '100%',
              borderRadius: 999,
              backgroundColor: color,
            }}
          />
        )}
      </View>
    </View>
  );
};

export const PredictionResultScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<PredictionResultScreenNavigationProp>();
  const route = useRoute<PredictionResultScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState<string>('en-IN');
  const [speechVoice, setSpeechVoice] = useState<string | undefined>(undefined);

  // Get prediction data from route params
  const { predictionData, farmerName: farmerNameFromRoute } = route.params;

  const formatNumber = (value: number) =>
    localizeNumber(String(Math.round(value)), i18n.language);
  const formatPercent = (value: number) => `${formatNumber(value)}%`;

  const replaceNumericRangesForSpeech = useCallback(
    (text: string) => {
      const toWord = (() => {
        const translated = t('speech.to');
        return translated === 'speech.to' ? 'to' : translated;
      })();

      // Replace 4-5 / 4–5 / 4—5 with “4 to 5” (language-aware)
      // Support ASCII + Devanagari + Bengali digits so we don't end up with TTS reading "minus".
      return text.replace(
        /([0-9\u0966-\u096F\u09E6-\u09EF]+)\s*[-–—]\s*([0-9\u0966-\u096F\u09E6-\u09EF]+)/g,
        `$1 ${toWord} $2`
      );
    },
    [t]
  );

  const speechCandidates = useMemo(() => {
    // Some Android/iOS devices ship Bengali voices as bn-BD (not bn-IN).
    switch (i18n.language) {
      case 'hi':
        return ['hi-IN', 'hi'];
      case 'bn':
        return ['bn-BD', 'bn-IN', 'bn'];
      default:
        return ['en-IN', 'en-US', 'en'];
    }
  }, [i18n.language]);

  const speechRate = useMemo(() => {
    // Slightly slower helps clarity for Indic scripts on many TTS engines.
    if (i18n.language === 'bn') return 0.86;
    if (i18n.language === 'hi') return 0.9;
    return 1.0;
  }, [i18n.language]);

  useEffect(() => {
    let cancelled = false;

    const pickVoice = async () => {
      try {
        // Immediately align language (prevents early speak calls using the default en-IN).
        if (!cancelled) {
          setSpeechLanguage(speechCandidates[0]);
          setSpeechVoice(undefined);
        }

        const voices = await Speech.getAvailableVoicesAsync();
        const normalizedCandidates = speechCandidates.map((c) => c.toLowerCase());

        // 1) Exact match by language tag.
        const exact = voices.find((v) =>
          v?.language && normalizedCandidates.includes(String(v.language).toLowerCase())
        );

        // 2) Prefix match (e.g., "hi" matches "hi-IN").
        const prefix =
          exact ||
          voices.find((v) => {
            const vLang = String(v?.language || '').toLowerCase();
            return normalizedCandidates.some((c) => vLang.startsWith(c.split('-')[0]));
          });

        const chosen = prefix;
        if (!cancelled) {
          setSpeechLanguage(chosen?.language || speechCandidates[0]);
          setSpeechVoice(chosen?.identifier);
        }
      } catch {
        if (!cancelled) {
          setSpeechLanguage(speechCandidates[0]);
          setSpeechVoice(undefined);
        }
      }
    };

    pickVoice();
    return () => {
      cancelled = true;
    };
  }, [speechCandidates]);

  const buildSpeechText = useCallback(() => {
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

    const kgWord = (() => {
      const translated = t('units.kg');
      return translated === 'units.kg' ? 'kg' : translated;
    })();
    const percentWord = (() => {
      const translated = t('units.percent');
      return translated === 'units.percent' ? 'percent' : translated;
    })();
    const rupeesWord = (() => {
      const translated = t('units.rupees');
      return translated === 'units.rupees' ? 'rupees' : translated;
    })();
    const perKgWord = (() => {
      const translated = t('units.perKgSpeech');
      return translated === 'units.perKgSpeech' ? 'per kilogram' : translated;
    })();
    const tonsWord = (() => {
      const translated = t('units.tons');
      return translated === 'units.tons' ? 'tons' : translated;
    })();
    const outOf100 = (() => {
      const translated = t('speech.outOf100');
      return translated === 'speech.outOf100' ? 'out of 100' : translated;
    })();

    const speakInt = (n: number) => formatNumberForSpeech(n);
    const speakFloat = (n: number) => formatNumberForSpeech(n, 2);

    const lines = [
      `${t('result.financialConfidenceTitle')}.`,
      `${t('result.predictedYieldForArea')}: ${speakInt(yieldKg)} ${kgWord}.`,
      `${t('result.confidencePercent')}: ${speakInt(confidence)} ${percentWord}.`,
      `${t('result.climateScore')}: ${speakInt(climate)} ${outOf100}.`,

      `${t('result.cropHealthTitle')}.`,
      `${t('result.healthPercent')}: ${speakInt(healthPercent)} ${percentWord}.`,
      `${t('result.healthStatus')}: ${healthStatus}.`,
      healthNotes ? `${t('result.healthNotes')}: ${healthNotes}.` : '',

      `${t('result.financialProjectionTitle')}.`,
      `${t('result.totalRevenue')}: ${speakInt(revenue)} ${rupeesWord}.`,
      `${t('result.marketPrice')}: ${speakInt(marketPrice)} ${rupeesWord} ${perKgWord}.`,
      `${t('result.yieldTons')}: ${speakFloat(yieldTons)} ${tonsWord}.`,

      `${t('result.riskAnalysisTitle')}.`,
      `${t('result.soilHealth')}: ${soil}.`,
      `${t('result.climateCondition')}: ${climateCond}.`,
      `${t('result.additionalRisks')}: ${otherRisks}.`,

      `${t('result.recommendationTitle')}.`,
      recommendation,
    ].filter(Boolean);

    const withRanges = replaceNumericRangesForSpeech(lines.join(' '));

    // Localize digits only after range normalization; otherwise localized digits won't match
    // range regexes and some TTS engines will literally say "minus".
    const withLocalizedDigits =
      i18n.language === 'hi' || i18n.language === 'bn'
        ? localizeNumber(withRanges, i18n.language)
        : withRanges;

    return normalizeForSpeech(withLocalizedDigits);
  }, [i18n.language, predictionData, replaceNumericRangesForSpeech, t]);

  const stopSpeech = useCallback(() => {
    Speech.stop();
    setIsSpeaking(false);
  }, []);

  const toggleSpeech = useCallback(() => {
    if (isSpeaking) {
      stopSpeech();
      return;
    }

    const text = buildSpeechText();
    if (!text) return;

    setIsSpeaking(true);
    Speech.speak(text, {
      language: speechLanguage,
      voice: speechVoice,
      rate: speechRate,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, [buildSpeechText, isSpeaking, speechLanguage, speechRate, speechVoice, stopSpeech]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      Speech.stop();
      setIsSpeaking(false);
    });
    return unsubscribe;
  }, [navigation]);

  const title = (() => {
    const translated = t('result.title');
    return translated === 'result.title' ? 'Results' : translated;
  })();

  const handleDownloadPdf = useCallback(async () => {
    if (isGeneratingPdf) return;

    setIsGeneratingPdf(true);
    try {
      // Let current UI interactions finish (keeps UI responsive).
      await new Promise<void>((resolve) => InteractionManager.runAfterInteractions(() => resolve()));

      const currentUser = getCurrentUser();
      const farmerName =
        (farmerNameFromRoute || '').trim() ||
        (currentUser?.displayName || '').trim() ||
        t('pdf.defaultFarmerName') ||
        'Farmer';

      const { generateCropPredictionPdf } = await import('../utils/cropPredictionPdf');

      const result = await generateCropPredictionPdf({
        predictionData,
        farmerName,
        language: i18n.language,
        appName: t('roleSelection.title') || 'KrishakSarthi',
        t: (key: string, options?: Record<string, any>) => (t(key, options) as string),
      });

      if (Platform.OS !== 'web' && result.uri) {
        const Sharing = await import('expo-sharing');
        const canShare = await Sharing.isAvailableAsync();

        if (canShare) {
          await Sharing.shareAsync(result.uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: result.filename,
          });
        }

        Alert.alert(
          t('pdf.successTitle') || 'PDF Ready',
          t('pdf.successMessage') || 'Your PDF has been generated. You can now save or share it.'
        );
        return;
      }

      // Web: the utility triggers a direct download.
      Alert.alert(
        t('pdf.successTitle') || 'PDF Ready',
        t('pdf.webDownloadedMessage') || 'Your PDF download should start automatically.'
      );
    } catch (e: any) {
      console.error('PDF generation failed:', e);
      Alert.alert(
        t('pdf.errorTitle') || 'PDF Error',
        (t('pdf.errorMessage') || 'Failed to generate PDF. Please try again.') +
          (e?.message ? `\n\n${e.message}` : '')
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [farmerNameFromRoute, i18n.language, isGeneratingPdf, predictionData, t]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8FAFC' }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 120 }}
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        {/* Header */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            paddingTop: insets.top + 14,
            paddingBottom: 22,
            paddingHorizontal: 18,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 3,
            marginBottom: 8,
          }}
        >

          <MovingBackgroundCircle
            size={250}
            speed={0.9}
            opacity={0.12}
            color="#32a892"
          />
          <MovingBackgroundCircle
            size={300}
            speed={0.85}
            opacity={0.1}
            color="#40a832"
          />

          <View
            onTouchEnd={() => {
              stopSpeech();
              navigation.goBack();
            }}
          >
            <BackButton />
          </View>

          <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: '#DCFCE7',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={26} color="#16A34A" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#111827', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
                {title}
              </Text>
              <Text style={{ color: '#6B7280', marginTop: 2, fontSize: 14, fontWeight: '500' }}>
                {t('result.subtitle')}
              </Text>
            </View>

            <TouchableOpacity
              onPress={toggleSpeech}
              activeOpacity={0.7}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            >
              {isSpeaking ? (
                <Square size={20} color="#EF4444" strokeWidth={2.5} fill="#EF4444" />
              ) : (
                <Volume2 size={22} color="#4B5563" strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-6" style={{ paddingTop: 16 }}>
          {/* Financial Confidence */}
          <View
            className="rounded-2xl p-5 mb-6"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#DCFCE7',
              borderWidth: 1.5,
              shadowColor: '#22C55E',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.12,
              shadowRadius: 14,
              elevation: 6,
            }}
          >
            <View className="flex-row items-center gap-3 mb-4">
              <View className="bg-green-100 p-2 rounded-xl">
                <TrendingUp size={22} color="#16A34A" strokeWidth={2.5} />
              </View>
              <Text className="text-gray-900 text-lg font-extrabold flex-1">
                {t('result.financialConfidenceTitle')}
              </Text>
            </View>

            <Text className="text-green-700 text-3xl font-extrabold mb-1">
              {`${formatNumber(predictionData.financialConfidence.predictedYieldKg)} ${t('units.kgShort')}`}
            </Text>
            <Text className="text-gray-500 text-sm mb-4">
              {t('result.predictedYieldForArea')}
            </Text>

            <MetricBar
              label={t('result.confidencePercent')}
              valueText={formatPercent(predictionData.financialConfidence.confidencePercent)}
              percent={predictionData.financialConfidence.confidencePercent}
              color="#22C55E"
              gradientColors={['#22C55E', '#4ADE80']}
            />

            <MetricBar
              label={t('result.climateScore')}
              valueText={`${formatNumber(predictionData.financialConfidence.climateScore)}/100`}
              percent={predictionData.financialConfidence.climateScore}
              color="#3B82F6"
            />
          </View>

          {/* Financial Projection */}
          <View
            className="rounded-2xl p-5 mb-6"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#DBEAFE',
              borderWidth: 1.5,
              shadowColor: '#3B82F6',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.10,
              shadowRadius: 14,
              elevation: 6,
            }}
          >
            <View className="flex-row items-center gap-3 mb-4">
              <View className="bg-blue-100 p-2 rounded-xl">
                <DollarSign size={22} color="#2563EB" strokeWidth={2.5} />
              </View>
              <Text className="text-gray-900 text-lg font-extrabold flex-1">
                {t('result.financialProjectionTitle')}
              </Text>
            </View>

            <Text className="text-blue-700 text-3xl font-extrabold mb-4">
              {`₹${formatNumber(predictionData.financialProjection.projectedRevenueInr)}`}
            </Text>

            <View className="flex-row justify-between">
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text className="text-gray-600 text-xs font-semibold mb-1">
                  {t('result.marketPrice')}
                </Text>
                <Text className="text-gray-900 text-base font-bold">
                  {`₹${formatNumber(predictionData.financialProjection.marketPricePerKgInr)}/${t('units.kg')}`}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-gray-600 text-xs font-semibold mb-1">
                  {t('result.yieldTons')}
                </Text>
                <Text className="text-gray-900 text-base font-bold">
                  {`${localizeNumber(String(predictionData.financialProjection.yieldTons), i18n.language)} ${t('units.tonsShort')}`}
                </Text>
              </View>
            </View>
          </View>

          {/* Crop Health */}
          <View
            className="rounded-2xl p-5 mb-6"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E0E7FF',
              borderWidth: 1.5,
              shadowColor: '#6366F1',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.10,
              shadowRadius: 14,
              elevation: 6,
            }}
          >
            <View className="flex-row items-center gap-3 mb-4">
              <View className="bg-indigo-100 p-2 rounded-xl">
                <Activity size={22} color="#4F46E5" strokeWidth={2.5} />
              </View>
              <Text className="text-gray-900 text-lg font-extrabold flex-1">
                {t('result.cropHealthTitle')}
              </Text>
            </View>

            <MetricBar
              label={t('result.healthPercent')}
              valueText={formatPercent(predictionData.cropHealth.healthPercent)}
              percent={predictionData.cropHealth.healthPercent}
              color="#6366F1"
              gradientColors={['#6366F1', '#818CF8']}
            />

            <View className="flex-row" style={{ gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text className="text-gray-600 text-xs font-semibold mb-1">
                  {t('result.healthStatus')}
                </Text>
                <Text className="text-gray-900 text-base font-bold">
                  {predictionData.cropHealth.status}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text className="text-gray-600 text-xs font-semibold mb-1">
                {t('result.healthNotes')}
              </Text>
              <Text className="text-gray-900 text-base font-bold">
                {predictionData.cropHealth.notes}
              </Text>
            </View>
          </View>

          {/* Risk Analysis */}
          <View
            className="rounded-2xl p-5"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#FFE4E6',
              borderWidth: 1.5,
              shadowColor: '#FB7185',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.10,
              shadowRadius: 14,
              elevation: 6,
            }}
          >
            <View className="flex-row items-center gap-3 mb-4">
              <View className="bg-red-100 p-2 rounded-xl">
                <AlertTriangle size={22} color="#DC2626" strokeWidth={2.5} />
              </View>
              <Text className="text-gray-900 text-lg font-extrabold flex-1">
                {t('result.riskAnalysisTitle')}
              </Text>
            </View>

            <View className="mb-4">
              <Text className="text-gray-600 text-xs font-semibold mb-1">
                {t('result.soilHealth')}
              </Text>
              <Text className="text-gray-900 text-base font-bold">
                {predictionData.riskAnalysis.soilHealth}
              </Text>
            </View>

            <View className="mb-4">
              <Text className="text-gray-600 text-xs font-semibold mb-1">
                {t('result.climateCondition')}
              </Text>
              <Text className="text-gray-900 text-base font-bold">
                {predictionData.riskAnalysis.climateCondition}
              </Text>
            </View>

            <View>
              <Text className="text-gray-600 text-xs font-semibold mb-1">
                {t('result.additionalRisks')}
              </Text>
              <Text className="text-gray-900 text-base font-bold">
                {predictionData.riskAnalysis.additionalRisks}
              </Text>
            </View>
          </View>

          {/* Recommendation */}
          <View
            className="rounded-2xl p-5 mt-6"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E5E7EB',
              borderWidth: 1.5,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: '#FEF3C7',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Lightbulb size={22} color="#92400E" strokeWidth={2.3} />
              </View>
              <Text className="text-gray-900 text-lg font-extrabold">
                {t('result.recommendationTitle')}
              </Text>
            </View>
            <Text className="text-gray-700 text-base" style={{ lineHeight: 22 }}>
              {predictionData.recommendation}
            </Text>
          </View>
        </View>
        </ScrollView>

        {/* Fixed Bottom Download Button */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 18,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12) + 10,
            backgroundColor: 'rgba(248, 250, 252, 0.96)',
            borderTopWidth: 1,
            borderTopColor: 'rgba(15, 23, 42, 0.08)',
          }}
        >
          <TouchableOpacity
            onPress={handleDownloadPdf}
            activeOpacity={0.8}
            disabled={isGeneratingPdf}
            style={{
              height: 52,
              borderRadius: 16,
              backgroundColor: isGeneratingPdf ? '#94A3B8' : '#16A34A',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
              shadowColor: '#000',
              shadowOpacity: 0.10,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            {isGeneratingPdf ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Download size={20} color="#FFFFFF" strokeWidth={2.5} />
            )}
            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 15 }}>
              {isGeneratingPdf
                ? t('pdf.generating') || 'Generating PDF...'
                : t('pdf.downloadPdf') || 'Download PDF'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
} 

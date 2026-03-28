import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { ArrowLeft, FileText, Paperclip, ClipboardList, Camera, Volume2, Square, RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { analyzeDocument, isGeminiConfigured } from '../services/gemini';

type DocumentAnalyzerScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'DocumentAnalyzer'
>;

interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  actionRequired: string;
}

export const DocumentAnalyzerScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<DocumentAnalyzerScreenNavigationProp>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{
    name: string;
    uri: string;
    size?: number;
    mimeType?: string;
  } | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsVoiceId, setTtsVoiceId] = useState<string | undefined>(undefined);
  const speakSessionRef = useRef(0);

  const appLanguage = i18n.language || 'en';

  const handleDocumentUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'image/jpeg',
          'image/jpg',
          'image/png',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedDocument({
          name: file.name,
          uri: file.uri,
          size: file.size,
          mimeType: file.mimeType,
        });
        setAnalysisError(null);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const handleCameraCapture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos of documents.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedDocument({
          name: `document_${Date.now()}.jpg`,
          uri: asset.uri,
          size: asset.fileSize,
          mimeType: 'image/jpeg',
        });
        setAnalysisError(null);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    }
  };

  const handleAnalyze = async () => {
    if (!selectedDocument) return;

    // Check if Gemini is configured
    if (!isGeminiConfigured()) {
      Alert.alert('Configuration Error', 'Gemini API is not configured. Please add GEMINI_API_KEY to your environment.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await analyzeDocument({
        fileUri: selectedDocument.uri,
        fileName: selectedDocument.name,
        mimeType: selectedDocument.mimeType,
        language: appLanguage,
      });

      setAnalysisResult(result);
      setHasAnalyzed(true);
    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze document';
      setAnalysisError(errorMessage);
      Alert.alert('Analysis Error', errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReupload = () => {
    setSelectedDocument(null);
    setHasAnalyzed(false);
    setIsAnalyzing(false);
    setAnalysisResult(null);
    setAnalysisError(null);
    Speech.stop();
    setIsSpeaking(false);
  };

  const handleReanalyze = async () => {
    // Re-analyze in current app language
    if (!selectedDocument) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await analyzeDocument({
        fileUri: selectedDocument.uri,
        fileName: selectedDocument.name,
        mimeType: selectedDocument.mimeType,
        language: appLanguage,
      });

      setAnalysisResult(result);
    } catch (error) {
      console.error('Re-analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze document';
      setAnalysisError(errorMessage);
      Alert.alert('Analysis Error', errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getTtsLanguage = (lang: string): string => {
    // Best-effort mapping for Expo Speech.
    // If a specific locale isn't available, the OS will fallback.
    if (lang === 'hi') return 'hi-IN';
    if (lang === 'bn') return 'bn-IN';
    return 'en-IN';
  };

  const resolveVoiceForLanguage = async (languageTag: string) => {
    try {
      const voices = await Speech.getAvailableVoicesAsync();

      // Filter voices matching the language
      const matchingVoices = voices.filter((v) =>
        typeof v.language === 'string' &&
        v.language.toLowerCase().startsWith(languageTag.toLowerCase())
      );

      if (matchingVoices.length === 0) {
        setTtsVoiceId(undefined);
        return;
      }

      // Try to find female voices using multiple detection strategies
      const femaleVoice = matchingVoices.find((v) => {
        const name = v.name?.toLowerCase() || '';
        const identifier = v.identifier?.toLowerCase() || '';

        // Check for explicit female indicators
        if (name.includes('female') || identifier.includes('female')) return true;
        if (name.includes('woman') || identifier.includes('woman')) return true;

        // Common female voice names across platforms
        const femaleNames = [
          'samantha', 'karen', 'moira', 'tessa', 'monica', 'paulina',
          'fiona', 'kate', 'sara', 'nicky', 'amelie', 'anna', 'ellen',
          'alice', 'alison', 'emma', 'emily', 'heather', 'laura', 'melina',
          'zira', 'hazel', 'susan', 'vicki', 'victoria', 'kyoko', 'mei-jia',
          'sin-ji', 'ting-ting', 'yuna', 'nora', 'zosia', 'luciana', 'joana'
        ];

        // Check if voice name contains any known female voice names
        if (femaleNames.some(fname => name.includes(fname) || identifier.includes(fname))) {
          return true;
        }

        // On Android, female voices often have identifiers ending in -female or containing #female
        if (identifier.includes('-female') || identifier.includes('#female')) return true;

        // Some platforms use quality indicators - prefer enhanced/premium voices
        if (name.includes('enhanced') || name.includes('premium')) return true;

        return false;
      });

      // If we found a female voice, use it. Otherwise, use the first available voice
      // and rely on pitch adjustment to make it sound more feminine
      const selectedVoice = femaleVoice || matchingVoices[0];
      setTtsVoiceId(selectedVoice?.identifier);

      // Log for debugging
      console.log('Selected voice:', selectedVoice?.name, selectedVoice?.identifier);
    } catch (error) {
      console.error('Error resolving voice:', error);
      setTtsVoiceId(undefined);
    }
  };

  useEffect(() => {
    // Pre-warm TTS voices to reduce first-play latency.
    resolveVoiceForLanguage(getTtsLanguage(appLanguage));
    // Stop any speaking when leaving screen.
    return () => {
      Speech.stop();
      speakSessionRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appLanguage]);

  const buildSpeechChunks = (): string[] => {
    if (!analysisResult) return [];
    const paragraph = analysisResult.actionRequired?.trim()
      ? `${analysisResult.summary.trim()}\n\n${analysisResult.actionRequired.trim()}`
      : analysisResult.summary.trim();

    const points = (analysisResult.keyPoints || [])
      .map((p, idx) => `${idx + 1}. ${p}`)
      .join('\n');

    const listChunk = points.trim().length > 0 ? `${t('analyzer.keyPoints')}:\n${points}` : '';
    return [paragraph, listChunk].filter((x) => x && x.trim().length > 0);
  };

  const stopSpeaking = () => {
    Speech.stop();
    speakSessionRef.current += 1;
    setIsSpeaking(false);
  };

  const handleSpeak = async () => {
    if (!analysisResult) return;

    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    const chunks = buildSpeechChunks();
    if (!chunks || chunks.length === 0) return;

    // New session id to prevent race conditions.
    speakSessionRef.current += 1;
    const sessionId = speakSessionRef.current;

    // Ensure we stop any queued speech before starting.
    Speech.stop();
    setIsSpeaking(true);

    const languageTag = getTtsLanguage(appLanguage);
    const speakNext = (index: number) => {
      if (speakSessionRef.current !== sessionId) return;
      if (index >= chunks.length) {
        setIsSpeaking(false);
        return;
      }

      // Use a small delay between chunks to prevent audio overlap and lag
      const delay = index === 0 ? 0 : 100; // 100ms pause between chunks
      setTimeout(() => {
        if (speakSessionRef.current !== sessionId) return;

        Speech.speak(chunks[index], {
          language: languageTag,
          volume: 1.0,
          rate: 0.95,
          pitch: 1.2,
          voice: ttsVoiceId,
          onDone: () => speakNext(index + 1),
          onStopped: () => setIsSpeaking(false),
          onError: (error) => {
            console.error('TTS Error:', error);
            setIsSpeaking(false);
          },
        });
      }, delay);
    };

    speakNext(0);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="bg-primary px-6 pt-12 pb-6 rounded-b-3xl mb-6">
          <View className="items-center mb-2">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="bg-white/20 rounded-full w-10 h-10 items-center justify-center mb-4"
            >
              <ArrowLeft size={24} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
            <View className="items-center">
              <Text className="text-white text-3xl font-bold text-center">
                {t('analyzer.title')}
              </Text>
              <Text className="text-white/90 text-base mt-1 text-center">
                {t('analyzer.subtitle')}
              </Text>
            </View>
          </View>
        </View>

        <View className="px-6">
          {/* Upload Area */}
          {!hasAnalyzed && (
            <View className="mb-6">
              <Text className="text-gray-900 text-xl font-bold mb-4">
                {t('analyzer.uploadDocument')}
              </Text>

              {/* Upload Options */}
              <View className="flex-row mb-3">
                {/* Upload from Gallery */}
                <TouchableOpacity
                  onPress={handleDocumentUpload}
                  disabled={isAnalyzing}
                  className="flex-1 bg-white rounded-xl p-4 border-2 border-dashed border-gray-300 mr-2"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  <View className="items-center">
                    <View className="bg-primary/10 rounded-full w-12 h-12 items-center justify-center mb-2">
                      <FileText size={28} color="#22C55E" strokeWidth={2} />
                    </View>
                    <Text className="text-gray-900 text-sm font-semibold text-center">
                      {t('analyzer.uploadLabel')}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Take Photo */}
                <TouchableOpacity
                  onPress={handleCameraCapture}
                  disabled={isAnalyzing}
                  className="flex-1 bg-white rounded-xl p-4 border-2 border-dashed border-gray-300 ml-2"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  <View className="items-center">
                    <View className="bg-blue-100 rounded-full w-12 h-12 items-center justify-center mb-2">
                      <Camera size={28} color="#3B82F6" strokeWidth={2} />
                    </View>
                    <Text className="text-gray-900 text-sm font-semibold text-center">
                      Take Photo
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Selected Document Display */}
              {selectedDocument && (
                <View
                  className="bg-white rounded-xl p-4 mb-3"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  <View className="flex-row items-center">
                    <View className="bg-primary/10 rounded-lg p-2 mr-3">
                      <Paperclip size={20} color="#22C55E" strokeWidth={2} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-900 text-sm font-semibold" numberOfLines={1}>
                        {selectedDocument.name}
                      </Text>
                      {selectedDocument.size && (
                        <Text className="text-gray-500 text-xs">
                          {(selectedDocument.size / 1024).toFixed(1)} KB
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedDocument(null);
                        setAnalysisError(null);
                      }}
                      className="bg-red-100 rounded-full p-2"
                    >
                      <Text className="text-red-600 text-xs font-semibold">✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Supported Formats */}
              <View className="flex-row items-center justify-center mb-2">
                <Text className="text-gray-500 text-sm">
                  {t('analyzer.supportedFormats')}: JPG, PNG (Images only)
                </Text>
              </View>

              {/* Error Display */}
              {analysisError && (
                <View className="bg-red-50 rounded-xl p-4 mb-4 border border-red-200">
                  <Text className="text-red-700 text-sm text-center">{analysisError}</Text>
                </View>
              )}

              {/* Analyze Button */}
              <TouchableOpacity
                onPress={handleAnalyze}
                disabled={!selectedDocument || isAnalyzing}
                className={`rounded-xl py-4 mt-6 ${!selectedDocument || isAnalyzing
                  ? 'bg-gray-300'
                  : 'bg-primary'
                  }`}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Text className="text-white text-center text-lg font-semibold">
                  {t('analyzer.analyzeButton')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Processing State */}
          {isAnalyzing && (
            <View className="bg-white rounded-xl p-8 mb-6">
              <View className="items-center">
                <ActivityIndicator size="large" color="#22C55E" />
                <Text className="text-gray-900 text-lg font-semibold mt-4">
                  {t('analyzer.analyzing')}
                </Text>
                <Text className="text-gray-600 text-sm mt-2 text-center">
                  {t('analyzer.analyzingHint')}
                </Text>
              </View>
            </View>
          )}

          {/* Result Container */}
          {hasAnalyzed && !isAnalyzing && analysisResult && (
            <View>
              {/* Paragraph (explains entire document) */}
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-gray-900 text-xl font-bold">
                    {t('analyzer.summary')}
                  </Text>

                  <View className="flex-row items-center">
                    {/* Re-analyze (icon only) */}
                    <TouchableOpacity
                      onPress={handleReanalyze}
                      accessibilityRole="button"
                      accessibilityLabel={t('analyzer.reanalyze')}
                      className="bg-white rounded-full w-11 h-11 items-center justify-center border border-gray-200 mr-2"
                      style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.06,
                        shadowRadius: 2,
                        elevation: 2,
                      }}
                    >
                      <RefreshCw size={20} color="#22C55E" strokeWidth={2} />
                    </TouchableOpacity>

                    {/* Listen/Stop (icon only) */}
                    <TouchableOpacity
                      onPress={handleSpeak}
                      accessibilityRole="button"
                      accessibilityLabel={isSpeaking ? t('analyzer.stop') : t('analyzer.listen')}
                      className={`rounded-full w-11 h-11 items-center justify-center border ${isSpeaking ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                        }`}
                      style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.06,
                        shadowRadius: 2,
                        elevation: 2,
                      }}
                    >
                      {isSpeaking ? (
                        <Square size={20} color="#EF4444" strokeWidth={2} />
                      ) : (
                        <Volume2 size={20} color="#22C55E" strokeWidth={2} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
                <View
                  className="bg-white rounded-xl p-5"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  <View className="flex-row items-start mb-3">
                    <ClipboardList size={24} color="#3B82F6" strokeWidth={2} />
                    <Text className="flex-1 text-gray-700 text-base leading-6 ml-3">
                      {analysisResult.actionRequired?.trim()
                        ? `${analysisResult.summary}\n\n${analysisResult.actionRequired}`
                        : analysisResult.summary}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Important Parts (visual list) */}
              <View className="mb-6">
                <Text className="text-gray-900 text-xl font-bold mb-4">
                  {t('analyzer.keyPoints')}
                </Text>
                <View
                  className="bg-white rounded-xl p-5"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  {analysisResult.keyPoints.map((point: string, index: number) => (
                    <View key={index} className="flex-row items-start mb-3">
                      <View className="bg-primary/10 rounded-full w-6 h-6 items-center justify-center mr-3 mt-0.5">
                        <Text className="text-primary text-xs font-bold">
                          {index + 1}
                        </Text>
                      </View>
                      <Text className="flex-1 text-gray-700 text-base">
                        {point}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Re-upload Button */}
              <TouchableOpacity
                onPress={handleReupload}
                className="bg-white border-2 border-primary rounded-xl py-4 mb-4"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <Text className="text-primary text-center text-lg font-semibold">
                  {t('analyzer.uploadNew')}
                </Text>
              </TouchableOpacity>

              {/* Info Note */}
              <View className="px-4">
                <Text className="text-gray-500 text-sm text-center leading-5">
                  {t('analyzer.infoNote')}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Animated,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { ArrowLeft, FileText, Paperclip, ClipboardList, Camera, Volume2, Square, RefreshCw, Sparkles, Upload } from 'lucide-react-native';
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
  const insets = useSafeAreaInsets();
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

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const uploadCardScale = useRef(new Animated.Value(0.95)).current;
  const cameraCardScale = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const appLanguage = i18n.language || 'en';

  // Entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(uploadCardScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(cameraCardScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for analyzing state
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

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
    <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      {/* Decorative Background Elements */}
      <View style={StyleSheet.absoluteFill}>
        <View style={{
          position: 'absolute',
          top: -120,
          right: -80,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: '#DCFCE7',
          opacity: 0.3,
        }} />
        <View style={{
          position: 'absolute',
          bottom: -100,
          left: -60,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: '#BBF7D0',
          opacity: 0.25,
        }} />
        <View style={{
          position: 'absolute',
          top: '40%',
          right: -40,
          width: 150,
          height: 150,
          borderRadius: 75,
          backgroundColor: '#D1FAE5',
          opacity: 0.2,
        }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Gradient Header */}
        <LinearGradient
          colors={['#22C55E', '#16A34A', '#15803D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 16,
            paddingBottom: 40,
            paddingHorizontal: 24,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            shadowColor: '#16A34A',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 12,
          }}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 24,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 5,
                elevation: 3,
                alignSelf: 'flex-start',
                marginBottom: 24,
              }}
            >
              <ArrowLeft size={20} color="#16A34A" strokeWidth={2.5} />
              <Text style={{ 
                color: "#16A34A",
                fontWeight: '600',
                fontSize: 15,
              }}>
                {(() => {
                  try {
                    const translated = t('common.back');
                    return translated === 'common.back' ? 'Back' : translated;
                  } catch {
                    return 'Back';
                  }
                })()}
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                borderRadius: 20,
                padding: 16,
                shadowColor: '#fff',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
              }}>
                <FileText size={40} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 32,
                  fontWeight: 'bold',
                  color: '#FFFFFF',
                  marginBottom: 6,
                  letterSpacing: 0.5,
                }}>
                  {t('analyzer.title')}
                </Text>
                <Text style={{
                  fontSize: 15,
                  color: 'rgba(255, 255, 255, 0.95)',
                  lineHeight: 20,
                }}>
                  {t('analyzer.subtitle')}
                </Text>
              </View>
            </View>
          </Animated.View>
        </LinearGradient>

        <Animated.View style={{ 
          paddingHorizontal: 24, 
          marginTop: 28,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}>
          {/* Upload Area */}
          {!hasAnalyzed && (
            <View style={{ marginBottom: 24 }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                gap: 8, 
                marginBottom: 20 
              }}>
                <Sparkles size={24} color="#16A34A" strokeWidth={2.5} />
                <Text style={{
                  fontSize: 22,
                  fontWeight: 'bold',
                  color: '#111827',
                }}>
                  {t('analyzer.uploadDocument')}
                </Text>
              </View>

              {/* Premium Upload Cards */}
              <View style={{ flexDirection: 'row', marginBottom: 20, gap: 16 }}>
                {/* Upload from Gallery */}
                <Animated.View style={{ 
                  flex: 1,
                  transform: [{ scale: uploadCardScale }],
                }}>
                  <TouchableOpacity
                    onPress={handleDocumentUpload}
                    disabled={isAnalyzing}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 20,
                      padding: 24,
                      borderWidth: 2,
                      borderColor: '#DCFCE7',
                      shadowColor: '#22C55E',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15,
                      shadowRadius: 12,
                      elevation: 6,
                    }}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <LinearGradient
                        colors={['#22C55E', '#16A34A']}
                        style={{
                          borderRadius: 60,
                          width: 68,
                          height: 68,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 16,
                          shadowColor: '#22C55E',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                          elevation: 5,
                        }}
                      >
                        <Upload size={34} color="#FFFFFF" strokeWidth={2.5} />
                      </LinearGradient>
                      <Text style={{
                        color: '#111827',
                        fontSize: 14,
                        fontWeight: '700',
                        textAlign: 'center',
                      }}>
                        {t('analyzer.uploadLabel')}
                      </Text>
                      <Text style={{
                        color: '#64748B',
                        fontSize: 11,
                        marginTop: 4,
                        textAlign: 'center',
                      }}>
                        JPG, PNG
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>

                {/* Take Photo */}
                <Animated.View style={{ 
                  flex: 1,
                  transform: [{ scale: cameraCardScale }],
                }}>
                  <TouchableOpacity
                    onPress={handleCameraCapture}
                    disabled={isAnalyzing}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 20,
                      padding: 24,
                      borderWidth: 2,
                      borderColor: '#D1FAE5',
                      shadowColor: '#10B981',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15,
                      shadowRadius: 12,
                      elevation: 6,
                    }}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        style={{
                          borderRadius: 60,
                          width: 68,
                          height: 68,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 16,
                          shadowColor: '#10B981',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                          elevation: 5,
                        }}
                      >
                        <Camera size={34} color="#FFFFFF" strokeWidth={2.5} />
                      </LinearGradient>
                      <Text style={{
                        color: '#111827',
                        fontSize: 14,
                        fontWeight: '700',
                        textAlign: 'center',
                      }}>
                        Take Photo
                      </Text>
                      <Text style={{
                        color: '#64748B',
                        fontSize: 11,
                        marginTop: 4,
                        textAlign: 'center',
                      }}>
                        Use Camera
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* Selected Document Display */}
              {selectedDocument && (
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: '#DCFCE7',
                    shadowColor: '#22C55E',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 6,
                    elevation: 3,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      backgroundColor: 'rgba(34, 197, 94, 0.15)',
                      borderRadius: 12,
                      padding: 10,
                      marginRight: 12,
                    }}>
                      <Paperclip size={22} color="#22C55E" strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        color: '#111827',
                        fontSize: 14,
                        fontWeight: '600',
                      }} numberOfLines={1}>
                        {selectedDocument.name}
                      </Text>
                      {selectedDocument.size && (
                        <Text style={{
                          color: '#64748B',
                          fontSize: 12,
                          marginTop: 2,
                        }}>
                          {(selectedDocument.size / 1024).toFixed(1)} KB
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedDocument(null);
                        setAnalysisError(null);
                      }}
                      style={{
                        backgroundColor: '#FEE2E2',
                        borderRadius: 20,
                        width: 32,
                        height: 32,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#DC2626', fontSize: 14, fontWeight: 'bold' }}>✕</Text>
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
                <View style={{
                  backgroundColor: '#FEF2F2',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#FECACA',
                }}>
                  <Text style={{ color: '#991B1B', fontSize: 14, textAlign: 'center' }}>
                    {analysisError}
                  </Text>
                </View>
              )}

              {/* Premium Analyze Button */}
              <LinearGradient
                colors={!selectedDocument || isAnalyzing 
                  ? ['#D1D5DB', '#9CA3AF'] 
                  : ['#22C55E', '#16A34A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 18,
                  marginTop: 24,
                  shadowColor: !selectedDocument || isAnalyzing ? '#000' : '#22C55E',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <TouchableOpacity
                  onPress={handleAnalyze}
                  disabled={!selectedDocument || isAnalyzing}
                  style={{
                    paddingVertical: 18,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <Sparkles size={22} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 18,
                    fontWeight: 'bold',
                    letterSpacing: 0.5,
                  }}>
                    {t('analyzer.analyzeButton')}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}

          {/* Premium Processing State */}
          {isAnalyzing && (
            <Animated.View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 40,
              marginBottom: 24,
              alignItems: 'center',
              borderWidth: 2,
              borderColor: '#DCFCE7',
              shadowColor: '#22C55E',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 8,
              transform: [{ scale: pulseAnim }],
            }}>
              <View style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderRadius: 60,
                padding: 20,
                marginBottom: 20,
              }}>
                <ActivityIndicator size="large" color="#22C55E" />
              </View>
              <Text style={{
                color: '#111827',
                fontSize: 20,
                fontWeight: 'bold',
                marginBottom: 8,
              }}>
                {t('analyzer.analyzing')}
              </Text>
              <Text style={{
                color: '#64748B',
                fontSize: 14,
                textAlign: 'center',
                lineHeight: 20,
              }}>
                {t('analyzer.analyzingHint')}
              </Text>
            </Animated.View>
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
        </Animated.View>
      </ScrollView>
    </View>
  );
};

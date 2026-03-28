import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Animated,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { FileText, Paperclip, ClipboardList, Camera, Volume2, Square, RefreshCw, Sparkles, Upload, MessageCircle, Mic, Send, X } from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { analyzeDocument, askQuestionAboutDocument, isGeminiConfigured, transcribeAudio } from '../services/gemini';
import Loader_One from '../components/Loader_One';

type DocumentAnalyzerScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'DocumentAnalyzer'
>;

interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  actionRequired: string;
}

interface QAMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export const DocumentAnalyzerScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<DocumentAnalyzerScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const isMountedRef = useRef(true);
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

  // Ask Question (document Q&A) state
  const [qaVisible, setQaVisible] = useState(false);
  const [qaInput, setQaInput] = useState('');
  const [qaMessages, setQaMessages] = useState<QAMessage[]>([]);
  const [qaIsTyping, setQaIsTyping] = useState(false);
  const [qaIsRecording, setQaIsRecording] = useState(false);
  const qaScrollViewRef = useRef<ScrollView>(null);
  const qaPulseAnim = useRef(new Animated.Value(1)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const uploadCardScale = useRef(new Animated.Value(0.95)).current;
  const cameraCardScale = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const appLanguage = i18n.language || 'en';

  // Entrance animations
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  // Pulsing animation for Q&A recording indicator
  useEffect(() => {
    if (qaIsRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(qaPulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(qaPulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      qaPulseAnim.setValue(1);
    }
  }, [qaIsRecording]);

  // Auto-scroll in Q&A modal
  useEffect(() => {
    if (!qaVisible) return;
    setTimeout(() => {
      qaScrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [qaMessages, qaIsTyping, qaVisible]);

  const handleDocumentUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
          'application/pdf',
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
    setQaVisible(false);
    setQaInput('');
    setQaMessages([]);
    setQaIsTyping(false);
    setQaIsRecording(false);
    void cleanupRecording();
    Speech.stop();
    setIsSpeaking(false);
  };

  const cleanupRecording = async () => {
    try {
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch {
          // ignore
        }
        recordingRef.current = null;
      }
    } catch {
      // ignore
    } finally {
      setQaIsRecording(false);
    }
  };

  const startQaRecording = async () => {
    try {
      // Request permissions
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          t('chatbot.permissionDenied') || 'Permission Denied',
          t('chatbot.microphonePermission') || 'Microphone permission is required for voice input.'
        );
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        isMeteringEnabled: true,
        android: {
          extension: '.m4a',
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: 'mpeg4AAC',
          audioQuality: 127,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;
      setQaIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert(
        t('chatbot.error') || 'Error',
        'Failed to start voice recording. Please try again.'
      );
    }
  };

  const stopQaRecording = async () => {
    try {
      if (!recordingRef.current) return;

      setQaIsRecording(false);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        Alert.alert(t('chatbot.error') || 'Error', 'No audio recorded');
        return;
      }

      // Show processing indicator
      setQaInput(t('chatbot.processing') || 'Processing audio...');

      // Detect language
      const currentLanguage = i18n.language || 'en';

      // Send audio file to Gemini API for transcription
      try {
        console.log('Sending audio to Gemini API for transcription...');

        const transcribedText = await transcribeAudio({
          audioUri: uri,
          language: currentLanguage,
        });

        console.log('Transcription successful:', transcribedText);

        if (transcribedText && transcribedText.trim()) {
          setQaInput(transcribedText);
        } else {
          throw new Error('No transcription received');
        }
      } catch (apiError: any) {
        console.error('Speech-to-text API error:', apiError);
        setQaInput('');
        Alert.alert(
          t('chatbot.error') || 'Error',
          apiError.message || 'Voice recognition failed. Please try again or type your question.'
        );
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setQaIsRecording(false);
      setQaInput('');
    }
  };

  const openQaModal = () => {
    if (!selectedDocument) return;
    setQaVisible(true);
  };

  const closeQaModal = async () => {
    await cleanupRecording();
    setQaVisible(false);
    setQaIsTyping(false);
  };

  const handleSendQuestion = async () => {
    const question = qaInput.trim();
    if (!question) return;
    if (!selectedDocument) return;

    if (!isGeminiConfigured()) {
      Alert.alert('Configuration Error', 'Gemini API is not configured. Please add GEMINI_API_KEY to your environment.');
      return;
    }

    const userMessage: QAMessage = {
      id: Date.now().toString(),
      text: question,
      isUser: true,
      timestamp: new Date(),
    };

    setQaMessages((prev) => [...prev, userMessage]);
    setQaInput('');
    setQaIsTyping(true);

    try {
      const answer = await askQuestionAboutDocument({
        fileUri: selectedDocument.uri,
        fileName: selectedDocument.name,
        mimeType: selectedDocument.mimeType,
        question,
        language: appLanguage,
      });

      if (!isMountedRef.current) return;

      const botMessage: QAMessage = {
        id: (Date.now() + 1).toString(),
        text: answer,
        isUser: false,
        timestamp: new Date(),
      };
      setQaMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      console.error('Document Q&A error:', err);
      if (!isMountedRef.current) return;

      // Show error message in chat instead of alert
      const errorMessage: QAMessage = {
        id: (Date.now() + 1).toString(),
        text: err?.message || 'Failed to answer your question. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      setQaMessages((prev) => [...prev, errorMessage]);
    } finally {
      if (isMountedRef.current) setQaIsTyping(false);
    }
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
        {/* Professional White Header */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            paddingTop: insets.top + 16,
            paddingBottom: 32,
            paddingHorizontal: 24,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={{ marginBottom: 20 }}>
              <BackButton />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{
                backgroundColor: '#F0FDF4',
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: '#BBF7D0',
              }}>
                <FileText size={32} color="#16A34A" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: '#111827',
                  marginBottom: 4,
                  letterSpacing: -0.5,
                }}>
                  {t('analyzer.title')}
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: '#6B7280',
                  lineHeight: 20,
                  fontWeight: '500',
                }}>
                  {t('analyzer.subtitle')}
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>

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
                      minHeight: 180,
                    }}
                  >
                    <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
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
                      <View style={{ height: 56, justifyContent: 'center' }}>
                        <Text style={{
                          color: '#111827',
                          fontSize: 14,
                          fontWeight: '700',
                          textAlign: 'center',
                          paddingHorizontal: 4,
                        }}>
                          {t('analyzer.uploadLabel')}
                        </Text>
                        <Text style={{
                          color: '#64748B',
                          fontSize: 11,
                          marginTop: 4,
                          textAlign: 'center',
                        }}>
                          PDF, JPG, PNG
                        </Text>
                      </View>
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
                      minHeight: 180,
                    }}
                  >
                    <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
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
                      <View style={{ height: 56, justifyContent: 'center' }}>
                        <Text style={{
                          color: '#111827',
                          fontSize: 14,
                          fontWeight: '700',
                          textAlign: 'center',
                          paddingHorizontal: 4,
                        }}>
                          {t('disease.takePhoto', 'Take Photo')}
                        </Text>
                        <Text style={{
                          color: '#64748B',
                          fontSize: 11,
                          marginTop: 4,
                          textAlign: 'center',
                        }}>
                          {t('disease.useCamera', 'Use Camera')}
                        </Text>
                      </View>
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
                  {t('analyzer.supportedFormats')}: PDF, JPG, PNG
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
            }}>
              <Loader_One size={100} />
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
              <LinearGradient
                colors={['#22C55E', '#16A34A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 14,
                  marginBottom: 14,
                  shadowColor: '#22C55E',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.2,
                  shadowRadius: 10,
                  elevation: 6,
                }}
              >
                <TouchableOpacity
                  onPress={openQaModal}
                  activeOpacity={0.9}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <MessageCircle size={20} color="#FFFFFF" strokeWidth={2.4} />
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: '700',
                    letterSpacing: 0.2,
                  }}>
                    {t('analyzer.askQuestion', 'Ask Question')}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>

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

      {/* Ask Question Modal */}
      <Modal
        visible={qaVisible}
        animationType="slide"
        transparent
        onRequestClose={closeQaModal}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(17, 24, 39, 0.35)',
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 16),
          paddingHorizontal: 14,
        }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            style={{ flex: 1 }}
          >
            <View style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.18,
              shadowRadius: 18,
              elevation: 12,
            }}>
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottomWidth: 1,
                  borderBottomColor: '#E5E7EB',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{
                    color: '#111827',
                    fontSize: 18,
                    fontWeight: '700',
                    marginBottom: 2,
                  }}>
                    {t('analyzer.askQuestionTitle', 'Ask a question about this document')}
                  </Text>
                  <Text style={{
                    color: '#6B7280',
                    fontSize: 13,
                    fontWeight: '500',
                  }}>
                    {t('analyzer.askQuestionHint', 'Gemini will answer using only this document.')}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={closeQaModal}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: '#F3F4F6',
                    borderRadius: 12,
                    width: 36,
                    height: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 12,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}
                >
                  <X size={18} color="#6B7280" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <ScrollView
                ref={qaScrollViewRef}
                style={{ flex: 1, backgroundColor: '#F8FAFC' }}
                contentContainerStyle={{ padding: 14, paddingBottom: 18 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {qaMessages.length === 0 && (
                  <View style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 18,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '700', marginBottom: 6 }}>
                      {t('analyzer.askQuestion', 'Ask Question')}
                    </Text>
                    <Text style={{ color: '#475569', fontSize: 13, lineHeight: 18 }}>
                      {t('analyzer.askQuestionEmpty', 'Try: “What is the deadline?” or “How much is the amount mentioned?”')}
                    </Text>
                  </View>
                )}

                {qaMessages.map((m) => (
                  <View
                    key={m.id}
                    style={{
                      alignItems: m.isUser ? 'flex-end' : 'flex-start',
                      marginTop: 10,
                    }}
                  >
                    <View style={{
                      maxWidth: '92%',
                      backgroundColor: m.isUser ? '#16A34A' : '#FFFFFF',
                      borderRadius: 18,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderWidth: m.isUser ? 0 : 1,
                      borderColor: '#E5E7EB',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.04,
                      shadowRadius: 2,
                      elevation: 1,
                    }}>
                      <Text style={{
                        color: m.isUser ? '#FFFFFF' : '#0F172A',
                        fontSize: 14,
                        lineHeight: 20,
                      }}>
                        {m.text}
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: 11,
                      color: '#94A3B8',
                      marginTop: 4,
                    }}>
                      {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))}

                {qaIsTyping && (
                  <View style={{ alignItems: 'flex-start', marginTop: 10 }}>
                    <View style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 18,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}>
                      <ActivityIndicator size="small" color="#16A34A" />
                      <Text style={{ color: '#334155', fontSize: 13, fontWeight: '600' }}>
                        {t('analyzer.thinking', 'Thinking...')}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: '#FFFFFF',
                borderTopWidth: 1,
                borderTopColor: '#E5E7EB',
              }}>
                {qaIsRecording && (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingBottom: 8,
                    gap: 8,
                  }}>
                    <Animated.View style={{ transform: [{ scale: qaPulseAnim }] }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                    </Animated.View>
                    <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>
                      {t('chatbot.recording', 'Recording...')}
                    </Text>
                  </View>
                )}

                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <Animated.View style={{ transform: [{ scale: qaIsRecording ? qaPulseAnim : 1 }] }}>
                    <TouchableOpacity
                      onPress={qaIsRecording ? stopQaRecording : startQaRecording}
                      activeOpacity={0.85}
                      disabled={qaIsTyping}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: qaIsRecording ? '#EF4444' : '#E2E8F0',
                        borderWidth: 1,
                        borderColor: qaIsRecording ? '#FCA5A5' : '#CBD5E1',
                      }}
                    >
                      <Mic size={18} color={qaIsRecording ? '#FFFFFF' : '#334155'} strokeWidth={2.4} />
                    </TouchableOpacity>
                  </Animated.View>

                  <View style={{
                    flex: 1,
                    backgroundColor: '#F1F5F9',
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    paddingHorizontal: 12,
                    minHeight: 44,
                    justifyContent: 'center',
                  }}>
                    <TextInput
                      placeholder={t('analyzer.askQuestionPlaceholder', 'Type your question...')}
                      placeholderTextColor="#94A3B8"
                      value={qaInput}
                      onChangeText={setQaInput}
                      editable={!qaIsTyping}
                      multiline
                      onSubmitEditing={handleSendQuestion}
                      style={{
                        fontSize: 14,
                        color: '#0F172A',
                        lineHeight: 20,
                        paddingVertical: 10,
                        textAlignVertical: 'center',
                      }}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={handleSendQuestion}
                    activeOpacity={0.9}
                    disabled={!qaInput.trim() || qaIsTyping || qaIsRecording}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: (!qaInput.trim() || qaIsTyping || qaIsRecording) ? '#CBD5E1' : '#16A34A',
                    }}
                  >
                    <Send size={18} color="#FFFFFF" strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

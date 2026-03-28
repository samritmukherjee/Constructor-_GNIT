import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { useTranslation } from 'react-i18next';
import { FormattedText } from './FormattedText';
import { transcribeAudio } from '../services/gemini';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatbotModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ChatbotModal: React.FC<ChatbotModalProps> = ({ visible, onClose }) => {
  const { t, i18n } = useTranslation();
  const scrollViewRef = useRef<ScrollView>(null);
  const isMountedRef = useRef(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: t('chatbot.welcomeMessage') || 'Hello! How can I help you today?',
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isCallingMe, setIsCallingMe] = useState(false);

  // Typing dots animation
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  // Pulsing animation for recording indicator
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Typing dots animation
  useEffect(() => {
    if (isTyping) {
      const animateDot = (anim: Animated.Value, delay: number) => {
        return Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]);
      };

      Animated.loop(
        Animated.parallel([
          animateDot(dot1Anim, 0),
          animateDot(dot2Anim, 200),
          animateDot(dot3Anim, 400),
        ])
      ).start();
    } else {
      dot1Anim.setValue(0);
      dot2Anim.setValue(0);
      dot3Anim.setValue(0);
    }
  }, [isTyping]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isTyping]);

  const startRecording = async () => {
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
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert(
        t('chatbot.error') || 'Error',
        'Failed to start voice recording. Please try again.'
      );
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) {
        return;
      }

      setIsRecording(false);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        Alert.alert(t('chatbot.error') || 'Error', 'No audio recorded');
        return;
      }

      // Show processing indicator
      setInputText(t('chatbot.processing') || 'Processing audio...');

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
          setInputText(transcribedText);
        } else {
          throw new Error('No transcription received');
        }
      } catch (apiError: any) {
        console.error('Speech-to-text API error:', apiError);
        setInputText('');
        Alert.alert(
          t('chatbot.error') || 'Error',
          apiError.message || 'Voice recognition failed. Please try again or type your message.'
        );
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
      setInputText('');
    }
  };

  const speakText = async (text: string) => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }

    // Detect language from text content
    const hasBengali = /[\u0980-\u09FF]/.test(text);
    const hasHindi = /[\u0900-\u097F]/.test(text);
    
    let languageCode = 'en-US';
    
    if (hasBengali) {
      languageCode = 'bn-IN';
    } else if (hasHindi) {
      languageCode = 'hi-IN';
    }

    console.log('Speaking with language:', languageCode);

    setIsSpeaking(true);
    
    Speech.speak(text, {
      language: languageCode,
      onDone: () => {
        setIsSpeaking(false);
      },
      onStopped: () => {
        setIsSpeaking(false);
      },
      onError: (error) => {
        console.error('Speech error:', error);
        setIsSpeaking(false);
      },
    });
  };

  const handleCallMe = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert(
        t('chatbot.error') || 'Error',
        'Please log in first to use the voice call feature.'
      );
      return;
    }

    setIsCallingMe(true);
    try {
      // Try Firebase Auth phoneNumber first, then fallback to Firestore profile
      let userPhone = user.phoneNumber;

      if (!userPhone) {
        // Read phone number from Firestore user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const profile = userDoc.data();
          userPhone = profile.phoneNumber || profile.mobileNumber || null;
        }
      }

      if (!userPhone) {
        Alert.alert(
          t('chatbot.error') || 'Error',
          'Phone number not found in your profile. Please update your profile with a phone number.'
        );
        setIsCallingMe(false);
        return;
      }

      // Ensure E.164 format
      if (!userPhone.startsWith('+')) {
        userPhone = '+91' + userPhone.replace(/^0+/, '');
      }

      console.log('Initiating voice call to:', userPhone);
      const response = await fetch('https://whatsapp-service-2.onrender.com/voice/vapi/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to: userPhone, lang: 'hi' }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          t('chatbot.callInitiated') || 'Call Initiated!',
          t('chatbot.callInitiatedMsg') || 'You will receive a call shortly from our farming assistant. Pick up to ask your questions by voice!'
        );
      } else {
        throw new Error(data.message || 'Failed to initiate call');
      }
    } catch (err: any) {
      console.error('Call initiation failed:', err);
      Alert.alert(
        t('chatbot.error') || 'Error',
        err.message || 'Could not initiate voice call. Please try again.'
      );
    } finally {
      setIsCallingMe(false);
    }
  };

  const handleSend = async () => {
    const userText = inputText.trim();
    if (!userText) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: userText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      console.log('Sending request to RAG:', userText);
      
      const response = await fetch('https://rag-xru1.onrender.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: userText,
        }),
      });

      console.log('Response status:', response.status);

      const responseText = await response.text();
      console.log('Response text:', responseText);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      const reply = data.answer || data.response || data.message || JSON.stringify(data);

      if (!isMountedRef.current) return;

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: reply,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      console.error('RAG response error:', err);
      if (!isMountedRef.current) return;

      Alert.alert(
        t('chatbot.error') || 'Error',
        `Could not reach AI service: ${err.message}`
      );
    } finally {
      if (isMountedRef.current) setIsTyping(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        className="flex-1 bg-white"
      >
        {/* Header */}
        <View className="bg-white px-6 pt-12 pb-4 flex-row items-center justify-between border-b border-gray-200">
          <View className="flex-1">
            <Text className="text-gray-800 text-xl font-semibold">
              {t('chatbot.title') || 'AI Assistant'}
            </Text>
            <Text className="text-gray-500 text-sm">
              {t('chatbot.subtitle') || 'Ask me anything about farming'}
            </Text>
          </View>
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={handleCallMe}
              disabled={isCallingMe}
              className={`rounded-full w-10 h-10 items-center justify-center mr-2 ${isCallingMe ? 'bg-green-100' : 'bg-green-50 border border-green-200'}`}
            >
              {isCallingMe ? (
                <ActivityIndicator size="small" color="#16a34a" />
              ) : (
                <Ionicons name="call" size={20} color="#16a34a" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              className="bg-gray-100 rounded-full w-10 h-10 items-center justify-center"
            >
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-4 py-4"
          contentContainerStyle={{ paddingBottom: 16 }}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((message) => (
            <View
              key={message.id}
              className={`mb-4 ${message.isUser ? 'items-end' : 'items-start'}`}
            >
              <View className="flex-row items-end">
                {!message.isUser && (
                  <TouchableOpacity
                    onPress={() => speakText(message.text)}
                    className="bg-gray-100 rounded-full w-8 h-8 items-center justify-center mr-2 border border-gray-200"
                  >
                    <Ionicons
                      name={isSpeaking ? "volume-high" : "volume-medium"}
                      size={14}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                )}
                <View
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.isUser
                      ? 'bg-primary rounded-br-md'
                      : 'bg-gray-50 border border-gray-100 rounded-bl-md'
                    }`}
                >
                  <FormattedText text={message.text} isUser={message.isUser} />
                </View>
              </View>
              <Text className={`text-xs text-gray-400 mt-1.5 ${!message.isUser ? 'ml-10' : ''}`}>
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ))}

          {isTyping && (
            <View className="items-start mb-4">
              <View className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md px-5 py-4 ml-10">
                <View className="flex-row items-center space-x-1">
                  {[dot1Anim, dot2Anim, dot3Anim].map((anim, index) => (
                    <Animated.View
                      key={index}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#9CA3AF',
                        marginHorizontal: 2,
                        opacity: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1],
                        }),
                        transform: [
                          {
                            translateY: anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -6],
                            }),
                          },
                        ],
                      }}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Area */}
        <View className="px-4 py-3 bg-white border-t border-gray-100">
          {isRecording && (
            <View className="flex-row items-center justify-center mb-3 py-2 bg-red-50 rounded-lg">
              <Animated.View
                style={{
                  transform: [{ scale: pulseAnim }],
                }}
              >
                <View className="bg-red-500 rounded-full w-2.5 h-2.5 mr-2" />
              </Animated.View>
              <Text className="text-red-500 text-sm font-medium">
                {t('chatbot.recording') || 'Recording...'}
              </Text>
            </View>
          )}
          <View className="flex-row items-center bg-gray-50 rounded-full px-2 border border-gray-200">
            <Animated.View
              style={{
                transform: [{ scale: isRecording ? pulseAnim : 1 }],
              }}
            >
              <TouchableOpacity
                onPress={isRecording ? stopRecording : startRecording}
                className={`w-10 h-10 rounded-full items-center justify-center ${isRecording ? 'bg-red-500' : 'bg-gray-200'
                  }`}
              >
                <Ionicons
                  name={isRecording ? "stop" : "mic"}
                  size={20}
                  color={isRecording ? '#fff' : '#6B7280'}
                />
              </TouchableOpacity>
            </Animated.View>
            <TextInput
              className="flex-1 py-3 px-3 text-base text-gray-800"
              placeholder={t('chatbot.inputPlaceholder') || 'Type your message...'}
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              multiline
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim()}
              className={`w-10 h-10 rounded-full items-center justify-center ${inputText.trim() ? 'bg-primary' : 'bg-gray-200'
                }`}
            >
              <Ionicons
                name="send"
                size={18}
                color={inputText.trim() ? '#fff' : '#9CA3AF'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

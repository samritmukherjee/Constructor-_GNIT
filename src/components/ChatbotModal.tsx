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
} from 'react-native';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';
import { getGeminiChatResponse } from '../services/gemini';
import { FormattedText } from './FormattedText';

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

  const generateResponse = (input: string): string => {
    const lowerInput = input.toLowerCase();

    // Greetings
    if (lowerInput.match(/\b(hi|hello|hey|namaste)\b/)) {
      return t('chatbot.responses.greeting');
    }

    // Crop-related queries
    if (lowerInput.includes('crop') || lowerInput.includes('plant') || lowerInput.includes('farming') || lowerInput.includes('cultivation')) {
      return t('chatbot.responses.crop');
    }

    // Disease/Pest queries
    if (lowerInput.includes('disease') || lowerInput.includes('pest') || lowerInput.includes('sick') || lowerInput.includes('problem') || lowerInput.includes('infection')) {
      return t('chatbot.responses.disease');
    }

    // Weather queries
    if (lowerInput.includes('weather') || lowerInput.includes('rain') || lowerInput.includes('temperature') || lowerInput.includes('humidity')) {
      return t('chatbot.responses.weather');
    }

    // Document queries
    if (lowerInput.includes('document') || lowerInput.includes('paper') || lowerInput.includes('certificate') || lowerInput.includes('form')) {
      return t('chatbot.responses.document');
    }

    // Fertilizer queries
    if (lowerInput.includes('fertilizer') || lowerInput.includes('manure') || lowerInput.includes('compost') || lowerInput.includes('nutrients')) {
      return t('chatbot.responses.fertilizer');
    }

    // Irrigation/Water queries
    if (lowerInput.includes('water') || lowerInput.includes('irrigation') || lowerInput.includes('watering')) {
      return t('chatbot.responses.water');
    }

    // Harvest queries
    if (lowerInput.includes('harvest') || lowerInput.includes('yield') || lowerInput.includes('produce')) {
      return t('chatbot.responses.harvest');
    }

    // Price/Market queries
    if (lowerInput.includes('price') || lowerInput.includes('market') || lowerInput.includes('sell')) {
      return t('chatbot.responses.price');
    }

    // Help/Features
    if (lowerInput.includes('help') || lowerInput.includes('feature') || lowerInput.includes('how') || lowerInput.includes('what can')) {
      return t('chatbot.responses.help');
    }

    // Thank you
    if (lowerInput.includes('thank') || lowerInput.includes('thanks')) {
      return t('chatbot.responses.thanks');
    }

    // Default response
    return t('chatbot.responses.default');
  };

  const startRecording = async () => {
    // Voice input temporarily disabled - please type your message
    Alert.alert(
      t('chatbot.info') || 'Info',
      'Voice input is temporarily unavailable. Please type your message instead.'
    );
  };

  const stopRecording = async () => {
    // Voice input disabled
    setIsRecording(false);
  };

  const speakText = async (text: string) => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }

    const languageCode = i18n.language === 'bn' ? 'bn-IN' : i18n.language === 'hi' ? 'hi-IN' : 'en-US';

    setIsSpeaking(true);
    Speech.speak(text, {
      language: languageCode,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
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
      const historyForGemini = messages.slice(-12).map((m) => ({
        role: m.isUser ? ('user' as const) : ('model' as const),
        text: m.text,
      }));

      const reply = await getGeminiChatResponse({
        userText,
        language: i18n.language,
        history: historyForGemini,
      });

      if (!isMountedRef.current) return;

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: reply,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error('Gemini response error:', err);
      if (!isMountedRef.current) return;

      const fallbackMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: generateResponse(userText),
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackMessage]);

      Alert.alert(
        t('chatbot.error') || 'Error',
        t('chatbot.aiError') ||
        'Could not reach AI service. Showing a fallback response.'
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
        className="flex-1 bg-white"
      >
        {/* Header */}
        <View className="bg-primary px-6 pt-12 pb-4 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-white text-2xl font-bold">
              {t('chatbot.title') || 'AI Assistant'}
            </Text>
            <Text className="text-white/80 text-sm">
              {t('chatbot.subtitle') || 'Ask me anything about farming'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="bg-white/20 rounded-full w-10 h-10 items-center justify-center"
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-4 py-4"
          contentContainerStyle={{ paddingBottom: 16 }}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              className={`mb-3 ${message.isUser ? 'items-end' : 'items-start'}`}
            >
              <View className="flex-row items-start">
                {!message.isUser && (
                  <TouchableOpacity
                    onPress={() => speakText(message.text)}
                    className="bg-gray-200 rounded-full w-8 h-8 items-center justify-center mr-2"
                    style={{ marginTop: 4 }}
                  >
                    <Ionicons
                      name={isSpeaking ? "volume-high" : "volume-medium"}
                      size={16}
                      color="#4B5563"
                    />
                  </TouchableOpacity>
                )}
                <View
                  className={`max-w-[90%] rounded-2xl px-4 py-3 ${message.isUser
                      ? 'bg-primary'
                      : 'bg-gray-100'
                    }`}
                >
                  <FormattedText text={message.text} isUser={message.isUser} />
                </View>
              </View>
              <Text className={`text-xs text-gray-400 mt-1 ${!message.isUser ? 'ml-10' : ''}`}>
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ))}

          {isTyping && (
            <View className="items-start mb-3">
              <View className="bg-gray-100 rounded-2xl px-4 py-3">
                <Text className="text-gray-500">Typing...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Area */}
        <View className="px-4 py-3 border-t border-gray-200">
          {isRecording && (
            <View className="flex-row items-center justify-center mb-2 py-2">
              <Animated.View
                style={{
                  transform: [{ scale: pulseAnim }],
                }}
              >
                <View className="bg-red-500 rounded-full w-3 h-3 mr-2" />
              </Animated.View>
              <Text className="text-red-500 text-sm font-semibold">
                {t('chatbot.recording') || 'Recording...'}
              </Text>
            </View>
          )}
          <View className="flex-row items-center bg-gray-100 rounded-full px-4">
            <Animated.View
              style={{
                transform: [{ scale: isRecording ? pulseAnim : 1 }],
              }}
            >
              <TouchableOpacity
                onPress={isRecording ? stopRecording : startRecording}
                className={`w-12 h-12 rounded-full items-center justify-center ${isRecording ? 'bg-red-500' : 'bg-gray-300'
                  }`}
              >
                <Ionicons
                  name={isRecording ? "stop" : "mic"}
                  size={22}
                  color="#fff"
                />
              </TouchableOpacity>
            </Animated.View>
            <TextInput
              className="flex-1 py-4 text-base text-gray-800"
              placeholder={t('chatbot.inputPlaceholder') || 'Type your message...'}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              multiline
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim()}
              className={`w-12 h-12 rounded-full items-center justify-center ${inputText.trim() ? 'bg-primary' : 'bg-gray-300'
                }`}
            >
              <Ionicons
                name="send"
                size={22}
                color={inputText.trim() ? '#fff' : '#999'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Linking,
  Keyboard,
} from 'react-native';
import {
  ArrowLeft,
  Send,
  Phone,
  MapPin,
  Image as ImageIcon,
  CheckCheck,
  Check,
  Video,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type ChatScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Chat'
>;

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'location';
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

export const ChatScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const route = useRoute<ChatScreenRouteProp>();
  const scrollViewRef = useRef<ScrollView>(null);

  const { contactName, contactPhone, userType } = route.params || {
    contactName: 'Contact',
    contactPhone: '+91 9876543210',
    userType: 'buyer',
  };

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I am interested in your tomatoes. What is the current price?',
      sender: 'other',
      timestamp: new Date(Date.now() - 3600000),
      status: 'read',
      type: 'text',
    },
    {
      id: '2',
      text: 'Hello! The price is ₹40 per kg. I have 500 kg available.',
      sender: 'me',
      timestamp: new Date(Date.now() - 3000000),
      status: 'read',
      type: 'text',
    },
    {
      id: '3',
      text: 'Great! Can you share your location? I would like to visit.',
      sender: 'other',
      timestamp: new Date(Date.now() - 2400000),
      status: 'read',
      type: 'text',
    },
    {
      id: '4',
      text: 'Sure! Here is my location:',
      sender: 'me',
      timestamp: new Date(Date.now() - 1800000),
      status: 'read',
      type: 'text',
    },
    {
      id: '5',
      text: '',
      sender: 'me',
      timestamp: new Date(Date.now() - 1799000),
      status: 'read',
      type: 'location',
      location: {
        latitude: 22.5726,
        longitude: 88.3639,
        address: 'Kolkata, West Bengal',
      },
    },
  ]);

  const tr = (key: string, fallback: string) => {
    try {
      return i18n.exists(key) ? (t(key) as string) : fallback;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  const handleSendMessage = () => {
    if (message.trim().length === 0) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: message.trim(),
      sender: 'me',
      timestamp: new Date(),
      status: 'sent',
      type: 'text',
    };

    setMessages((prev) => [...prev, newMessage]);
    setMessage('');

    // Scroll to bottom after sending message
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Simulate message delivery
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === newMessage.id ? { ...msg, status: 'delivered' } : msg
        )
      );
    }, 1000);
  };

  const handleShareLocation = () => {
    Alert.alert(
      tr('chat.shareLocation', 'Share Location'),
      tr('chat.shareLocationConfirm', 'Do you want to share your current location?'),
      [
        {
          text: tr('chat.cancel', 'Cancel'),
          style: 'cancel',
        },
        {
          text: tr('chat.share', 'Share'),
          onPress: () => {
            const locationMessage: Message = {
              id: Date.now().toString(),
              text: '',
              sender: 'me',
              timestamp: new Date(),
              status: 'sent',
              type: 'location',
              location: {
                latitude: 22.5726,
                longitude: 88.3639,
                address: 'Your Current Location, Kolkata',
              },
            };
            setMessages((prev) => [...prev, locationMessage]);
          },
        },
      ]
    );
  };

  const handlePhoneCall = () => {
    const phoneNumber = contactPhone.replace(/\s+/g, '');
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert(
        tr('chat.error', 'Error'),
        tr('chat.phoneError', 'Unable to make phone call')
      );
    });
  };

  const handleVideoCall = () => {
    Alert.alert(
      tr('chat.videoCall', 'Video Call'),
      tr('chat.videoCallMsg', `Start a video call with ${contactName}?`),
      [
        {
          text: tr('chat.cancel', 'Cancel'),
          style: 'cancel',
        },
        {
          text: tr('chat.call', 'Call'),
          onPress: () => {
            // Here you would integrate with video call service
            Alert.alert(
              tr('chat.comingSoon', 'Coming Soon'),
              tr('chat.videoCallFeature', 'Video call feature will be available soon!')
            );
          },
        },
      ]
    );
  };

  const handleOpenLocation = (latitude: number, longitude: number) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}`,
    });
    
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert(
          tr('chat.error', 'Error'),
          tr('chat.mapError', 'Unable to open maps')
        );
      });
    }
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  const renderMessageStatus = (status: Message['status']) => {
    if (status === 'sent') {
      return <Check size={12} color="#667781" strokeWidth={2.5} />;
    } else if (status === 'delivered') {
      return <CheckCheck size={12} color="#667781" strokeWidth={2.5} />;
    } else {
      return <CheckCheck size={12} color="#53BDEB" strokeWidth={2.5} />;
    }
  };

  return (
    <View className="flex-1 bg-[#128C7E]">
      <SafeAreaView className="flex-1 bg-[#128C7E]">
        {/* Header */}
        <View className="bg-[#128C7E] px-4 pt-8 pb-4 flex-row items-center justify-between"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 6,
          }}
        >
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="mr-4 p-1"
              activeOpacity={0.6}
            >
              <ArrowLeft size={26} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity 
              className="bg-white/35 rounded-full w-12 h-12 items-center justify-center mr-3"
              activeOpacity={0.7}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.15,
                shadowRadius: 2,
                elevation: 2,
              }}
            >
              <Text className="text-white text-[19px] font-bold">
                {contactName.charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
            <View className="flex-1 justify-center">
              <Text className="text-white text-[19px] font-bold leading-tight" numberOfLines={1}>
                {contactName}
              </Text>
              <Text className="text-white text-[14px] font-normal mt-1">
                {tr('chat.online', 'Online')}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={handleVideoCall}
              className="w-11 h-11 items-center justify-center mr-2"
              activeOpacity={0.6}
            >
              <Video size={23} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePhoneCall}
              className="w-11 h-11 items-center justify-center"
              activeOpacity={0.6}
            >
              <Phone size={23} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View className="flex-1 bg-[#ECE5DD]">
            {/* Messages */}
            <ScrollView
              ref={scrollViewRef}
              className="flex-1 px-4"
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
          {messages.map((msg) => (
            <View
              key={msg.id}
              className={`mb-2.5 ${
                msg.sender === 'me' ? 'items-end' : 'items-start'
              }`}
            >
              {msg.type === 'text' ? (
                <View
                  className={`max-w-[82%] rounded-lg px-3.5 py-2.5 ${
                    msg.sender === 'me'
                      ? 'bg-[#DCF8C6] rounded-tr-none'
                      : 'bg-white rounded-tl-none'
                  }`}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: msg.sender === 'other' ? 0.1 : 0.08,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  <Text
                    className={`text-[15.5px] leading-5 ${
                      msg.sender === 'me' ? 'text-gray-900' : 'text-gray-900'
                    }`}
                  >
                    {msg.text}
                  </Text>
                  <View className="flex-row items-center justify-end mt-1 -mb-0.5">
                    <Text
                      className={`text-[11px] ${
                        msg.sender === 'me' ? 'text-gray-600' : 'text-gray-500'
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </Text>
                    {msg.sender === 'me' && (
                      <View className="ml-1">
                        {renderMessageStatus(msg.status)}
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                // Location message
                <TouchableOpacity
                  onPress={() =>
                    msg.location &&
                    handleOpenLocation(
                      msg.location.latitude,
                      msg.location.longitude
                    )
                  }
                  className={`w-[280px] rounded-xl overflow-hidden ${
                    msg.sender === 'me' ? 'rounded-tr-none' : 'rounded-tl-none'
                  }`}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 4,
                  }}
                  activeOpacity={0.8}
                >
                  {/* Map placeholder */}
                  <View className="bg-green-100 h-40 items-center justify-center">
                    <MapPin size={56} color="#16A34A" strokeWidth={2} />
                  </View>
                  {/* Location info */}
                  <View className="bg-white p-4">
                    <View className="flex-row items-center mb-2">
                      <MapPin size={18} color="#16A34A" strokeWidth={2.5} />
                      <Text className="text-gray-900 font-bold text-[16px] ml-2">
                        {tr('chat.location', 'Location')}
                      </Text>
                    </View>
                    <Text className="text-gray-700 text-[14px] mb-3 leading-5">
                      {msg.location?.address}
                    </Text>
                    <Text className="text-green-600 text-[13.5px] font-semibold">
                      {tr('chat.tapToOpen', 'Tap to open in maps')}
                    </Text>
                    <View className="flex-row items-center justify-end mt-2.5">
                      <Text className="text-[11px] text-gray-500">
                        {formatTime(msg.timestamp)}
                      </Text>
                      {msg.sender === 'me' && (
                        <View className="ml-1">
                          {renderMessageStatus(msg.status)}
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>

            {/* Input Area */}
            <View className="bg-[#F0F0F0] px-3 py-3 pb-4">
              <View className="flex-row items-end">
            {userType === 'farmer' && (
              <TouchableOpacity
                onPress={handleShareLocation}
                className="bg-white rounded-full w-12 h-12 items-center justify-center mr-2"
                activeOpacity={0.7}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.12,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                <MapPin size={24} color="#16A34A" strokeWidth={2} />
              </TouchableOpacity>
            )}
            <View className="flex-1 bg-white rounded-[24px] px-5 py-3 flex-row items-center mr-2"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.12,
                shadowRadius: 2,
                elevation: 2,
              }}
            >
              <TextInput
                className="flex-1 text-[16px] text-gray-900 max-h-24"
                placeholder={tr('chat.typeMessage', 'Type a message...')}
                placeholderTextColor="#9CA3AF"
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
              />
            </View>
            <TouchableOpacity
              onPress={handleSendMessage}
              className="bg-[#128C7E] rounded-full w-12 h-12 items-center justify-center"
              activeOpacity={0.7}
              disabled={message.trim().length === 0}
              style={{
                opacity: message.trim().length === 0 ? 0.5 : 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 2,
              }}
            >
              <Send size={20} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

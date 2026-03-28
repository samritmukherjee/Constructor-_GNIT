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
  Alert,
  Keyboard,
  Linking,
} from 'react-native';
import {
  MapPin,
  Send,
} from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { auth } from '../config/firebase';
import {
  ChatMessage,
  getOrCreateChatThread,
  markChatThreadRead,
  sendChatMessage,
  sendChatLocationMessage,
  subscribeToChatMessages,
  sendChatNotificationToFarmer,
} from '../services/chat';
import { detectCurrentLocation } from '../services/location';

type ChatScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Chat'
>;

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

type UiMessage = {
  id: string;
  text: string;
  type: 'text' | 'location';
  location?: { lat: number; lng: number };
  senderId: string;
  createdAt: Date;
};

export const ChatScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const route = useRoute<ChatScreenRouteProp>();
  const scrollViewRef = useRef<ScrollView>(null);

  const {
    contactName,
    contactPhone,
    userType,
    dealId,
    buyerId,
    buyerName,
    farmerId,
    farmerName,
  } = route.params || {
    contactName: 'Contact',
    contactPhone: '',
    userType: 'buyer',
  };

  const [message, setMessage] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const tr = (key: string, fallback: string) => {
    try {
      return i18n.exists(key) ? (t(key) as string) : fallback;
    } catch {
      return fallback;
    }
  };

  // Wait for auth to initialize
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      // console.log('ChatScreen - Auth state changed:', user ? `User ${user.uid}` : 'No user');
      setAuthReady(true);
      if (!user) {
        console.warn('ChatScreen: No authenticated user');
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Initialize chat thread
  useEffect(() => {
    if (!authReady) return; // Wait for auth to initialize

    const user = auth.currentUser;
    if (!user) {
      console.error('ChatScreen: Cannot initialize chat - no authenticated user');
      Alert.alert(
        tr('chat.error', 'Error'),
        tr('chat.notSignedIn', 'Please sign in to use chat. Try logging out and back in.')
      );
      return;
    }

    // console.log('Initializing chat for user:', user.uid);

    if (!buyerId || !farmerId) {
      // Backwards-compat navigation (no IDs). Keep screen functional but without DB chat.
      setThreadId(null);
      return;
    }

    let cancelled = false;
    setLoadingThread(true);
    getOrCreateChatThread({
      buyerId,
      farmerId,
      buyerName,
      farmerName,
      dealId,
    })
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          Alert.alert(tr('chat.error', 'Error'), res.message);
          setThreadId(null);
          return;
        }
        setThreadId(res.thread.id);
        
        // If buyer initiated chat with farmer, send notification to farmer
        if (userType === 'buyer' && user.uid === buyerId && farmerId) {
          sendChatNotificationToFarmer({
            farmerId: farmerId,
            buyerId: user.uid,
            buyerName: buyerName || 'A Buyer',
            threadId: res.thread.id,
          }).catch((e) => {
            console.warn('Failed to send chat notification:', e);
            // Don't alert user - notification failure is not critical
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buyerId, farmerId, buyerName, farmerName, dealId, authReady, userType]);

  useEffect(() => {
    if (!threadId) return;
    const unsub = subscribeToChatMessages(threadId, (msgs: ChatMessage[]) => {
      const mapped: UiMessage[] = msgs.map((m) => ({
        id: m.id,
        text: m.text,
        type: (m as any).type === 'location' ? 'location' : 'text',
        location: (m as any).location,
        senderId: m.senderId,
        createdAt: (m.createdAt?.toDate?.() ?? new Date()) as Date,
      }));
      setMessages(mapped);
    });
    return unsub;
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    // Mark as read when chat opens.
    markChatThreadRead(threadId);
  }, [threadId]);

  useEffect(() => {
    const myId = auth.currentUser?.uid;
    if (!threadId || !myId || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last?.senderId && last.senderId !== myId) {
      // New incoming message while screen is open => clear unread.
      markChatThreadRead(threadId);
    }
  }, [messages.length, threadId]);

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

  const handleSendMessage = async () => {
    const user = auth.currentUser;
    if (!user) {
      console.error('handleSendMessage: No authenticated user');
      Alert.alert(tr('chat.error', 'Error'), tr('chat.notSignedIn', 'Please sign in again. Try logging out and back in.'));
      return;
    }
    // console.log('Sending message as user:', user.uid);
    if (!threadId) {
      Alert.alert(
        tr('chat.error', 'Error'),
        tr('chat.missingChatContext', 'Chat is not available for this contact yet.')
      );
      return;
    }

    const text = message.trim();
    if (!text) return;

    setMessage('');
    const res = await sendChatMessage({ threadId, text });
    if (!res.success) {
      Alert.alert(tr('chat.error', 'Error'), res.message);
    }
  };

  const openInMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(tr('chat.error', 'Error'), tr('chat.openMapsFailed', 'Unable to open maps.'));
    });
  };

  const handleShareLocation = async () => {
    const user = auth.currentUser;
    if (!user) {
      console.error('handleShareLocation: No authenticated user');
      Alert.alert(tr('chat.error', 'Error'), tr('chat.notSignedIn', 'Please sign in again. Try logging out and back in.'));
      return;
    }
    // console.log('Sharing location as user:', user.uid);
    if (!threadId) {
      Alert.alert(
        tr('chat.error', 'Error'),
        tr('chat.missingChatContext', 'Chat is not available for this contact yet.')
      );
      return;
    }
    if (sendingLocation) return;

    setSendingLocation(true);
    try {
      const res = await detectCurrentLocation();
      if (!res.ok) {
        Alert.alert(tr('chat.error', 'Error'), tr('chat.locationPermission', 'Please allow location permission.'));
        return;
      }

      const lat = res.location.coords.latitude;
      const lng = res.location.coords.longitude;
      const sendRes = await sendChatLocationMessage({ threadId, lat, lng });
      if (!sendRes.success) {
        Alert.alert(tr('chat.error', 'Error'), sendRes.message);
        return;
      }
    } finally {
      setSendingLocation(false);
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
            <View className="mr-4">
              <BackButton />
            </View>
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
              onPress={handleShareLocation}
              activeOpacity={0.7}
              disabled={sendingLocation || !threadId}
              style={{
                opacity: sendingLocation || !threadId ? 0.5 : 1,
                padding: 8,
              }}
            >
              <MapPin size={24} color="#fff" strokeWidth={2.5} />
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
              {messages.map((msg) => {
                const myId = auth.currentUser?.uid;
                const isMe = !!myId && msg.senderId === myId;
                return (
                  <View
                    key={msg.id}
                    className={`mb-2.5 ${isMe ? 'items-end' : 'items-start'
                      }`}
                  >
                    <View
                      className={`max-w-[82%] rounded-lg px-3.5 py-2.5 ${isMe ? 'bg-[#DCF8C6] rounded-tr-none' : 'bg-white rounded-tl-none'
                        }`}
                      style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: isMe ? 0.08 : 0.1,
                        shadowRadius: 2,
                        elevation: 2,
                      }}
                    >
                      {msg.type === 'location' && msg.location ? (
                        <>
                          <Text className="text-[15.5px] leading-5 text-gray-900">
                            {tr('chat.locationShared', 'Location shared')}
                          </Text>
                          <Text className="text-[13px] text-gray-700 mt-1">
                            {msg.location.lat.toFixed(6)}, {msg.location.lng.toFixed(6)}
                          </Text>
                          <TouchableOpacity
                            onPress={() => openInMaps(msg.location!.lat, msg.location!.lng)}
                            activeOpacity={0.8}
                            style={{ marginTop: 10, alignSelf: 'flex-start' }}
                          >
                            <View
                              style={{
                                backgroundColor: '#128C7E',
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}
                            >
                              <MapPin size={16} color="#fff" strokeWidth={2.5} />
                              <Text style={{ color: '#fff', fontWeight: '900', marginLeft: 8 }}>
                                {tr('chat.openInMaps', 'Open in Maps')}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <Text className="text-[15.5px] leading-5 text-gray-900">{msg.text}</Text>
                      )}
                      <View className="flex-row items-center justify-end mt-1 -mb-0.5">
                        <Text className={`text-[11px] ${isMe ? 'text-gray-600' : 'text-gray-500'}`}>
                          {formatTime(msg.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Input Area */}
            <View className="bg-[#F0F0F0] px-4 py-3">
              <View className="flex-row items-center">
                {/* Removed location button (requested) */}
                <View
                  className="flex-1 bg-white rounded-[22px] px-4 py-2 flex-row items-center mr-2"
                  style={{
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
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
                  className="bg-[#128C7E] rounded-full w-11 h-11 items-center justify-center"
                  activeOpacity={0.7}
                  disabled={message.trim().length === 0}
                  style={{
                    opacity: message.trim().length === 0 ? 0.5 : 1,
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

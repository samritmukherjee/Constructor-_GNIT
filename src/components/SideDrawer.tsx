import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Animated,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Sprout, FileText, Leaf, MessageCircle, ShoppingCart, X, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface SideDrawerProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: 'Profile' | 'CropPrediction' | 'DocumentAnalyzer' | 'CropDiseaseDetection' | 'ContactBuyer') => void;
  onChatbotOpen: () => void;
  notificationCount?: number;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  visible,
  onClose,
  onNavigate,
  onChatbotOpen,
  notificationCount = 0,
}) => {
  const { t, i18n } = useTranslation();

  // Animation refs
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const item1Anim = useRef(new Animated.Value(0)).current;
  const item2Anim = useRef(new Animated.Value(0)).current;
  const item3Anim = useRef(new Animated.Value(0)).current;
  const item4Anim = useRef(new Animated.Value(0)).current;
  const item5Anim = useRef(new Animated.Value(0)).current;
  const item6Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset all animations
      slideAnim.setValue(300);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      item1Anim.setValue(0);
      item2Anim.setValue(0);
      item3Anim.setValue(0);
      item4Anim.setValue(0);
      item5Anim.setValue(0);
      item6Anim.setValue(0);

      // Start popup animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Stagger menu items with 50ms delay
      setTimeout(() => {
        Animated.timing(item1Anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }, 150);
      setTimeout(() => {
        Animated.timing(item2Anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }, 200);
      setTimeout(() => {
        Animated.timing(item3Anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }, 250);
      setTimeout(() => {
        Animated.timing(item4Anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }, 300);
      setTimeout(() => {
        Animated.timing(item5Anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }, 350);
      setTimeout(() => {
        Animated.timing(item6Anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }, 400);
    } else {
      slideAnim.setValue(300);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      item1Anim.setValue(0);
      item2Anim.setValue(0);
      item3Anim.setValue(0);
      item4Anim.setValue(0);
      item5Anim.setValue(0);
      item6Anim.setValue(0);
    }
  }, [visible]);

  const tr = (key: string, fallback: string) => {
    try {
      if (!i18n || !i18n.isInitialized) {
        return fallback;
      }
      return t(key) || fallback;
    } catch {
      return fallback;
    }
  };

  const handleNavigate = (screen: 'Profile' | 'CropPrediction' | 'DocumentAnalyzer' | 'CropDiseaseDetection' | 'ContactBuyer') => {
    onClose();
    onNavigate(screen);
  };

  const handleChatbot = () => {
    onClose();
    onChatbotOpen();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            opacity: fadeAnim,
          }
        ]}>
          <TouchableWithoutFeedback>
            <Animated.View style={{
              position: 'absolute',
              right: 16,
              top: 60,
              bottom: 60,
              width: 260,
              borderRadius: 24,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 24,
              elevation: 12,
              transform: [
                { translateX: slideAnim },
                { scale: scaleAnim },
              ],
            }}>
              {/* Solid Background */}
              <View style={StyleSheet.absoluteFill}>
                <LinearGradient
                  colors={['#FFFFFF', '#F9FAFB']}
                  style={StyleSheet.absoluteFill}
                />
              </View>

              {/* Content Container */}
              <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                <ScrollView 
                  style={{ flex: 1 }}
                  contentContainerStyle={{ flexGrow: 1 }}
                  showsVerticalScrollIndicator={false}
                >
                {/* Premium Gradient Header - Capsule Design */}
                <View style={{
                  paddingTop: 16,
                  paddingHorizontal: 14,
                  paddingBottom: 14,
                }}>
                  <LinearGradient
                    colors={['#22C55E', '#16A34A', '#15803D']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 20,
                      shadowColor: '#16A34A',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                  >
                    <TouchableOpacity
                      onPress={onClose}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                        borderRadius: 12,
                        width: 28,
                        height: 28,
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                      }}
                    >
                      <X size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                        borderRadius: 12,
                        padding: 8,
                      }}>
                        <Sprout size={20} color="#FFFFFF" strokeWidth={2.5} />
                      </View>
                      <View style={{ flex: 1, paddingRight: 30 }}>
                        <Text style={{
                          fontSize: 18,
                          fontWeight: 'bold',
                          color: '#FFFFFF',
                          letterSpacing: 0.3,
                        }}>
                          {tr('drawer.title', 'Menu')}
                        </Text>
                        <Text style={{
                          fontSize: 10,
                          color: 'rgba(255, 255, 255, 0.85)',
                          marginTop: 1,
                        }}>
                          {tr('drawer.subtitle', 'Navigate features')}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>

                {/* Menu Items Container */}
                <View style={{ padding: 14 }}>
                  {/* Profile */}
                  <Animated.View style={{
                    opacity: item1Anim,
                    transform: [{
                      translateX: item1Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0],
                      })
                    }]
                  }}>
                    <TouchableOpacity
                    onPress={() => handleNavigate('Profile')}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      padding: 12,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: '#DCFCE7',
                      shadowColor: '#22C55E',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    <LinearGradient
                      colors={['#22C55E', '#16A34A']}
                      style={{
                        borderRadius: 12,
                        width: 38,
                        height: 38,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <User size={20} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: '#1F2937',
                        marginBottom: 1,
                      }}>
                        {tr('drawer.profile', 'My Profile')}
                      </Text>
                      <Text style={{
                        fontSize: 10,
                        color: '#6B7280',
                      }}>
                        {tr('drawer.profileSubtitle', 'Manage account')}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#9CA3AF" strokeWidth={2} />
                  </TouchableOpacity>
                  </Animated.View>

                  {/* Crop Prediction */}
                  <Animated.View style={{
                    opacity: item2Anim,
                    transform: [{
                      translateX: item2Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0],
                      })
                    }]
                  }}>
                    <TouchableOpacity
                    onPress={() => handleNavigate('CropPrediction')}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      padding: 12,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: '#D1FAE5',
                      shadowColor: '#10B981',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      style={{
                        borderRadius: 12,
                        width: 38,
                        height: 38,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Sprout size={20} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: '#1F2937',
                        marginBottom: 1,
                      }}>
                        {tr('prediction.title', 'Crop Prediction')}
                      </Text>
                      <Text style={{
                        fontSize: 10,
                        color: '#6B7280',
                      }}>
                        {tr('prediction.subtitle', 'Predict yield')}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#9CA3AF" strokeWidth={2} />
                  </TouchableOpacity>
                  </Animated.View>

                  {/* Document Analyzer */}
                  <Animated.View style={{
                    opacity: item3Anim,
                    transform: [{
                      translateX: item3Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0],
                      })
                    }]
                  }}>
                    <TouchableOpacity
                    onPress={() => handleNavigate('DocumentAnalyzer')}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      padding: 12,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: '#DBEAFE',
                      shadowColor: '#3B82F6',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    <LinearGradient
                      colors={['#3B82F6', '#2563EB']}
                      style={{
                        borderRadius: 12,
                        width: 38,
                        height: 38,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileText size={20} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: '#1F2937',
                        marginBottom: 1,
                      }}>
                        {tr('documentAnalyzer.title', 'Doc Analyzer')}
                      </Text>
                      <Text style={{
                        fontSize: 10,
                        color: '#6B7280',
                      }}>
                        {tr('documentAnalyzer.subtitle', 'Analyze docs')}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#9CA3AF" strokeWidth={2} />
                  </TouchableOpacity>
                  </Animated.View>

                  {/* Crop Disease Detection */}
                  <Animated.View style={{
                    opacity: item4Anim,
                    transform: [{
                      translateX: item4Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0],
                      })
                    }]
                  }}>
                    <TouchableOpacity
                    onPress={() => handleNavigate('CropDiseaseDetection')}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      padding: 12,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: '#FEF3C7',
                      shadowColor: '#F59E0B',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    <LinearGradient
                      colors={['#F59E0B', '#D97706']}
                      style={{
                        borderRadius: 12,
                        width: 38,
                        height: 38,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Leaf size={20} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: '#1F2937',
                        marginBottom: 1,
                      }}>
                        {tr('cropDisease.title', 'Disease Detect')}
                      </Text>
                      <Text style={{
                        fontSize: 10,
                        color: '#6B7280',
                      }}>
                        {tr('cropDisease.subtitle', 'Detect diseases')}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#9CA3AF" strokeWidth={2} />
                  </TouchableOpacity>
                  </Animated.View>

                  {/* Contact Buyer */}
                  <Animated.View style={{
                    opacity: item5Anim,
                    transform: [{
                      translateX: item5Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0],
                      })
                    }]
                  }}>
                    <TouchableOpacity
                    onPress={() => handleNavigate('ContactBuyer')}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      padding: 12,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: '#E9D5FF',
                      shadowColor: '#9333EA',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    <LinearGradient
                      colors={['#9333EA', '#7C3AED']}
                      style={{
                        borderRadius: 12,
                        width: 38,
                        height: 38,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ShoppingCart size={20} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                    {notificationCount > 0 && (
                      <View style={{
                        position: 'absolute',
                        top: 8,
                        left: 42,
                        backgroundColor: '#EF4444',
                        borderRadius: 10,
                        width: 20,
                        height: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: '#FFFFFF',
                      }}>
                        <Text style={{
                          color: '#FFFFFF',
                          fontSize: 9,
                          fontWeight: 'bold',
                        }}>
                          {notificationCount > 9 ? '9+' : notificationCount}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: '#1F2937',
                        marginBottom: 1,
                      }}>
                        {tr('drawer.contactBuyer', 'Contact Buyer')}
                      </Text>
                      <Text style={{
                        fontSize: 10,
                        color: '#6B7280',
                      }}>
                        {tr('drawer.contactBuyerSubtitle', 'Connect buyers')}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#9CA3AF" strokeWidth={2} />
                  </TouchableOpacity>
                  </Animated.View>

                  {/* AI Chatbot */}
                  <Animated.View style={{
                    opacity: item6Anim,
                    transform: [{
                      translateX: item6Anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0],
                      })
                    }]
                  }}>
                    <TouchableOpacity
                    onPress={handleChatbot}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: '#E0E7FF',
                      shadowColor: '#6366F1',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    <LinearGradient
                      colors={['#6366F1', '#4F46E5']}
                      style={{
                        borderRadius: 12,
                        width: 38,
                        height: 38,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MessageCircle size={20} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: '#1F2937',
                        marginBottom: 1,
                      }}>
                        {tr('chatbot.title', 'AI Assistant')}
                      </Text>
                      <Text style={{
                        fontSize: 10,
                        color: '#6B7280',
                      }}>
                        {tr('chatbot.subtitle', 'Get advice')}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#9CA3AF" strokeWidth={2} />
                  </TouchableOpacity>
                  </Animated.View>
                </View>
              </ScrollView>

              {/* Version Info - Fixed at Bottom */}
              <View style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderTopWidth: 1,
                borderTopColor: '#F3F4F6',
              }}>
                <View style={{
                  backgroundColor: '#F0FDF4',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: '#BBF7D0',
                }}>
                  <Text style={{
                    fontSize: 10,
                    color: '#15803D',
                    fontWeight: '700',
                    letterSpacing: 0.3,
                  }}>
                    {tr('drawer.version', 'Version')} 1.0.0
                  </Text>
                </View>
              </View>
            </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
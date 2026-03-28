import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Bug, AlertTriangle, Heart, TrendingUp, Pill, Shield, Sparkles, CheckCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type DiseaseResultScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'DiseaseResult'
>;

type DiseaseResultScreenRouteProp = RouteProp<
  RootStackParamList,
  'DiseaseResult'
>;

export const DiseaseResultScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<DiseaseResultScreenNavigationProp>();
  const route = useRoute<DiseaseResultScreenRouteProp>();
  const insets = useSafeAreaInsets();
  
  const { cropImage, cropType, cropAge, weather, diseaseResult } = route.params;

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const imageScale = useRef(new Animated.Value(0.9)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;

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
      Animated.spring(imageScale, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Use Gemini AI results if available, otherwise use hardcoded demo data
  const diseaseData = diseaseResult || {
    diseaseName: 'Leaf Blight',
    severity: 'medium',
    treatment: 'Use fungicide spray every 7-10 days. Apply copper-based fungicide or mancozeb.',
    prevention: 'Avoid excess water and ensure proper drainage. Remove infected leaves immediately.',
    healthPercentage: 70,
    recoveryChance: 'high',
    isNotCrop: false,
    warningMessage: '',
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return { bg: '#DCFCE7', border: '#BBF7D0', text: '#15803D' };
      case 'medium':
        return { bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' };
      case 'high':
        return { bg: '#FEE2E2', border: '#FECACA', text: '#991B1B' };
      default:
        return { bg: '#F3F4F6', border: '#E5E7EB', text: '#4B5563' };
    }
  };

  const getRecoveryColor = (recovery: string) => {
    switch (recovery) {
      case 'high':
        return '#22C55E';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getHealthBarGradient = (percentage: number): [string, string] => {
    if (percentage >= 70) return ['#22C55E', '#16A34A'];
    if (percentage >= 40) return ['#F59E0B', '#D97706'];
    return ['#EF4444', '#DC2626'];
  };

  const handleBackToDashboard = () => {
    navigation.navigate('Dashboard');
  };

  const handleScanAnother = () => {
    navigation.navigate('CropDiseaseDetection');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Decorative Background Elements */}
      <View style={StyleSheet.absoluteFill}>
        <View style={{
          position: 'absolute',
          top: -100,
          right: -70,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: '#DCFCE7',
          opacity: 0.25,
        }} />
        <View style={{
          position: 'absolute',
          bottom: -80,
          left: -50,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: '#D1FAE5',
          opacity: 0.2,
        }} />
        <View style={{
          position: 'absolute',
          top: '35%',
          right: -30,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: '#BBF7D0',
          opacity: 0.18,
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
            paddingBottom: 32,
            paddingHorizontal: 24,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            shadowColor: '#16A34A',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 12,
            marginBottom: 24,
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
                marginBottom: 20,
              }}
            >
              <ArrowLeft size={20} color="#16A34A" strokeWidth={2.5} />
              <Text style={{ 
                color: '#16A34A',
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
                padding: 14,
              }}>
                <Sparkles size={36} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 30,
                  fontWeight: 'bold',
                  color: '#FFFFFF',
                  letterSpacing: 0.5,
                }}>
                  {t('diseaseResult.title')}
                </Text>
              </View>
            </View>
          </Animated.View>
        </LinearGradient>

        <Animated.View style={{ 
          paddingHorizontal: 24,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}>
          {/* Crop Image with Premium Card */}
          {cropImage && (
            <Animated.View style={{ 
              marginBottom: 24,
              transform: [{ scale: imageScale }],
            }}>
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                padding: 12,
                borderWidth: 2,
                borderColor: '#DCFCE7',
                shadowColor: '#22C55E',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 10,
              }}>
                <Image
                  source={{ uri: cropImage }}
                  style={{
                    width: '100%',
                    height: 240,
                    borderRadius: 18,
                  }}
                  resizeMode="cover"
                />
              </View>
            </Animated.View>
          )}

          {/* Analysis Details Card */}
          <Animated.View style={{ 
            transform: [{ scale: cardScale }],
          }}>
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 20,
              marginBottom: 20,
              borderWidth: 2,
              borderColor: '#DBEAFE',
              shadowColor: '#3B82F6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 6,
            }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                marginBottom: 16 
              }}>
                <View style={{
                  backgroundColor: '#DBEAFE',
                  borderRadius: 16,
                  padding: 12,
                  marginRight: 12,
                }}>
                  <CheckCircle size={24} color="#3B82F6" strokeWidth={2.5} />
                </View>
                <Text style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: '#1E40AF',
                }}>
                  {t('diseaseResult.analysisDetails')}
                </Text>
              </View>
              <View style={{ gap: 10 }}>
                <Text style={{
                  fontSize: 15,
                  color: '#1E3A8A',
                  lineHeight: 22,
                }}>
                  • {t('disease.cropType')}: <Text style={{ fontWeight: '700' }}>{cropType || t('common.unknown')}</Text>
                </Text>
                {cropAge && (
                  <Text style={{
                    fontSize: 15,
                    color: '#1E3A8A',
                    lineHeight: 22,
                  }}>
                    • {t('disease.cropAge')}: <Text style={{ fontWeight: '700' }}>{cropAge} {t('disease.days')}</Text>
                  </Text>
                )}
                <Text style={{
                  fontSize: 15,
                  color: '#1E3A8A',
                  lineHeight: 22,
                }}>
                  • {t('disease.recentWeather')}: <Text style={{ fontWeight: '700' }}>{t(`disease.weatherConditions.${weather}`)}</Text>
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Warning Message - Show if not a crop */}
          {diseaseData.isNotCrop && (
            <View style={{
              backgroundColor: '#FFF7ED',
              borderRadius: 20,
              padding: 20,
              marginBottom: 20,
              borderWidth: 2,
              borderColor: '#FDBA74',
              shadowColor: '#F97316',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 6,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <LinearGradient
                  colors={['#F97316', '#EA580C']}
                  style={{
                    borderRadius: 16,
                    width: 52,
                    height: 52,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 16,
                    marginTop: 4,
                  }}
                >
                  <AlertTriangle size={28} color="#FFFFFF" strokeWidth={2.5} />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    color: '#9A3412',
                    fontWeight: 'bold',
                    fontSize: 19,
                    marginBottom: 12,
                  }}>
                    {t('diseaseResult.warning')}
                  </Text>
                  <Text style={{
                    color: '#C2410C',
                    fontSize: 15,
                    lineHeight: 22,
                    marginBottom: 16,
                  }}>
                    {diseaseData.warningMessage || t('diseaseResult.notCropWarning')}
                  </Text>
                  <TouchableOpacity
                    onPress={handleScanAnother}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#F97316', '#EA580C']}
                      style={{
                        borderRadius: 16,
                        paddingVertical: 14,
                        alignItems: 'center',
                        shadowColor: '#F97316',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 5,
                      }}
                    >
                      <Text style={{
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontWeight: 'bold',
                      }}>
                        {t('diseaseResult.uploadNewImage')}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Only show disease analysis if it's a crop */}
          {!diseaseData.isNotCrop && (
            <>
              {/* Detected Disease Card with Gradient */}
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                padding: 22,
                marginBottom: 18,
                borderWidth: 2,
                borderColor: '#FECACA',
                shadowColor: '#DC2626',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.15,
                shadowRadius: 14,
                elevation: 8,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <LinearGradient
                    colors={['#DC2626', '#991B1B']}
                    style={{
                      borderRadius: 20,
                      width: 60,
                      height: 60,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                      shadowColor: '#DC2626',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                    }}
                  >
                    <Bug size={30} color="#FFFFFF" strokeWidth={2.5} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      color: '#9CA3AF',
                      fontSize: 11,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: 1.2,
                      marginBottom: 6,
                    }}>
                      {t('diseaseResult.detectedDisease')}
                    </Text>
                    <Text style={{
                      color: '#1F2937',
                      fontSize: 21,
                      fontWeight: 'bold',
                      lineHeight: 28,
                    }}>
                      {diseaseData.diseaseName}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Severity & Recovery Cards Row */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
                {/* Severity Card */}
                <View style={{
                  flex: 1,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 18,
                  borderWidth: 2,
                  borderColor: getSeverityColor(diseaseData.severity).border,
                  shadowColor: '#F97316',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 10,
                  elevation: 5,
                }}>
                  <View style={{
                    backgroundColor: getSeverityColor(diseaseData.severity).bg,
                    borderRadius: 14,
                    width: 44,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 14,
                  }}>
                    <AlertTriangle size={22} color={getSeverityColor(diseaseData.severity).text} strokeWidth={2.5} />
                  </View>
                  <Text style={{
                    color: '#6B7280',
                    fontSize: 12,
                    fontWeight: '600',
                    marginBottom: 6,
                  }}>
                    {t('diseaseResult.severity')}
                  </Text>
                  <Text style={{
                    color: getSeverityColor(diseaseData.severity).text,
                    fontSize: 15,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                  }}>
                    {t(`diseaseResult.severityLevels.${diseaseData.severity}`)}
                  </Text>
                </View>

                {/* Recovery Chance Card */}
                <View style={{
                  flex: 1,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 18,
                  borderWidth: 2,
                  borderColor: '#E9D5FF',
                  shadowColor: '#A855F7',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 10,
                  elevation: 5,
                }}>
                  <View style={{
                    backgroundColor: '#F3E8FF',
                    borderRadius: 14,
                    width: 44,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 14,
                  }}>
                    <TrendingUp size={22} color="#A855F7" strokeWidth={2.5} />
                  </View>
                  <Text style={{
                    color: '#6B7280',
                    fontSize: 12,
                    fontWeight: '600',
                    marginBottom: 6,
                  }}>
                    {t('diseaseResult.recoveryChance')}
                  </Text>
                  <Text style={{
                    color: getRecoveryColor(diseaseData.recoveryChance),
                    fontSize: 15,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                  }}>
                    {t(`diseaseResult.recoveryChances.${diseaseData.recoveryChance}`)}
                  </Text>
                </View>
              </View>

              {/* Crop Health Card with Gradient Progress Bar */}
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                padding: 22,
                marginBottom: 24,
                borderWidth: 2,
                borderColor: '#D1FAE5',
                shadowColor: '#22C55E',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 12,
                elevation: 6,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                  <LinearGradient
                    colors={['#22C55E', '#16A34A']}
                    style={{
                      borderRadius: 18,
                      width: 56,
                      height: 56,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                    }}
                  >
                    <Heart size={26} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      color: '#9CA3AF',
                      fontSize: 11,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: 1.2,
                      marginBottom: 6,
                    }}>
                      {t('diseaseResult.cropHealth')}
                    </Text>
                    <Text style={{
                      color: '#1F2937',
                      fontSize: 28,
                      fontWeight: 'bold',
                    }}>
                      {diseaseData.healthPercentage}%
                    </Text>
                  </View>
                </View>
                
                {/* Gradient Progress Bar */}
                <View style={{
                  backgroundColor: '#F3F4F6',
                  height: 14,
                  borderRadius: 10,
                  overflow: 'hidden',
                }}>
                  <LinearGradient
                    colors={getHealthBarGradient(diseaseData.healthPercentage)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      height: '100%',
                      width: `${diseaseData.healthPercentage}%`,
                      borderRadius: 10,
                    }}
                  />
                </View>
              </View>

              {/* Recommendations Section */}
              <View style={{ marginBottom: 24 }}>
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  marginBottom: 20 
                }}>
                  <View style={{
                    width: 5,
                    height: 32,
                    backgroundColor: '#22C55E',
                    borderRadius: 4,
                    marginRight: 12,
                  }} />
                  <Text style={{
                    fontSize: 24,
                    fontWeight: 'bold',
                    color: '#111827',
                  }}>
                    {t('diseaseResult.recommendations')}
                  </Text>
                </View>

                {/* Treatment Card */}
                <View style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 24,
                  padding: 20,
                  marginBottom: 16,
                  borderWidth: 2,
                  borderColor: '#D1FAE5',
                  shadowColor: '#22C55E',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 12,
                  elevation: 6,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <LinearGradient
                      colors={['#22C55E', '#16A34A']}
                      style={{
                        borderRadius: 16,
                        width: 48,
                        height: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16,
                        marginTop: 4,
                      }}
                    >
                      <Pill size={24} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        color: '#15803D',
                        fontWeight: 'bold',
                        fontSize: 18,
                        marginBottom: 12,
                      }}>
                        {t('diseaseResult.treatment')}
                      </Text>
                      <Text style={{
                        color: '#166534',
                        fontSize: 15,
                        lineHeight: 23,
                      }}>
                        {diseaseData.treatment}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Prevention Card */}
                <View style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 24,
                  padding: 20,
                  borderWidth: 2,
                  borderColor: '#DBEAFE',
                  shadowColor: '#3B82F6',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 12,
                  elevation: 6,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <LinearGradient
                      colors={['#3B82F6', '#2563EB']}
                      style={{
                        borderRadius: 16,
                        width: 48,
                        height: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16,
                        marginTop: 4,
                      }}
                    >
                      <Shield size={24} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        color: '#1E40AF',
                        fontWeight: 'bold',
                        fontSize: 18,
                        marginBottom: 12,
                      }}>
                        {t('diseaseResult.prevention')}
                      </Text>
                      <Text style={{
                        color: '#1E3A8A',
                        fontSize: 15,
                        lineHeight: 23,
                      }}>
                        {diseaseData.prevention}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Action Buttons */}
          <View style={{ gap: 14 }}>
            <TouchableOpacity
              onPress={handleBackToDashboard}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#22C55E', '#16A34A', '#15803D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  paddingVertical: 18,
                  alignItems: 'center',
                  shadowColor: '#22C55E',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 17,
                  fontWeight: 'bold',
                  letterSpacing: 0.5,
                }}>
                  {t('diseaseResult.backToDashboard')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleScanAnother}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                paddingVertical: 18,
                alignItems: 'center',
                borderWidth: 2,
                borderColor: '#22C55E',
                shadowColor: '#22C55E',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Text style={{
                color: '#16A34A',
                fontSize: 17,
                fontWeight: 'bold',
                letterSpacing: 0.5,
              }}>
                {t('diseaseResult.scanAnother')}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};
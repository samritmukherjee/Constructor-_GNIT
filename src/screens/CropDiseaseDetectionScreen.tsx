import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Scan, Camera, Image as ImageIcon, Sparkles, Upload, X } from 'lucide-react-native';
import { CustomInput } from '../components/CustomInput';
import { Dropdown } from '../components/Dropdown';
import { RootStackParamList } from '../navigation/AppNavigator';
import { localizeNumber, delocalizeNumber } from '../utils/numberLocalization';
import { detectCropDisease } from '../services/gemini';
import { getWeatherForCurrentLocation, getWeatherConditionKey } from '../services/weather';

type CropDiseaseDetectionScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CropDiseaseDetection'
>;

interface FormData {
  cropImage: string | null;
  cropAge: string;
  cropType: string;
  otherCropType: string;
  recentWeather: string;
}

export const CropDiseaseDetectionScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<CropDiseaseDetectionScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    cropImage: null,
    cropAge: '',
    cropType: '',
    otherCropType: '',
    recentWeather: '',
  });

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cameraCardScale = useRef(new Animated.Value(0.95)).current;
  const galleryCardScale = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
      Animated.spring(cameraCardScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(galleryCardScale, {
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

  const CROP_TYPES = [
    { label: t('disease.cropTypes.rice'), value: 'rice' },
    { label: t('disease.cropTypes.wheat'), value: 'wheat' },
    { label: t('disease.cropTypes.potato'), value: 'potato' },
    { label: t('disease.cropTypes.tomato'), value: 'tomato' },
    { label: t('disease.cropTypes.cotton'), value: 'cotton' },
    { label: t('disease.cropTypes.sugarcane'), value: 'sugarcane' },
    { label: t('disease.cropTypes.maize'), value: 'maize' },
    { label: t('disease.cropTypes.soybean'), value: 'soybean' },
    { label: t('disease.cropTypes.chili'), value: 'chili' },
    { label: t('disease.cropTypes.onion'), value: 'onion' },
    { label: t('disease.cropTypes.banana'), value: 'banana' },
    { label: t('disease.cropTypes.mango'), value: 'mango' },
    { label: t('disease.cropTypes.tea'), value: 'tea' },
    { label: t('disease.cropTypes.coffee'), value: 'coffee' },
    { label: t('disease.cropTypes.groundnut'), value: 'groundnut' },
    { label: t('disease.cropTypes.other'), value: 'other' },
  ];

  const handleFieldChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const pickImageFromCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert(
        t('disease.permissions.title'),
        t('disease.permissions.camera')
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1.0,
    });

    if (!result.canceled && result.assets[0]) {
      handleFieldChange('cropImage', result.assets[0].uri);
    }
  };

  const pickImageFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert(
        t('disease.permissions.title'),
        t('disease.permissions.gallery')
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1.0,
    });

    if (!result.canceled && result.assets[0]) {
      handleFieldChange('cropImage', result.assets[0].uri);
    }
  };

  const canAnalyze = () => {
    // Only image is required, other fields are optional
    return formData.cropImage !== null;
  };

  const handleAnalyze = async () => {
    if (!canAnalyze()) {
      Alert.alert(t('disease.imageRequired'));
      return;
    }

    setIsAnalyzing(true);

    try {
      // Auto-detect weather from user's location
      const weatherData = await getWeatherForCurrentLocation();
      const weatherCondition = weatherData 
        ? getWeatherConditionKey(weatherData.current.weatherCode) 
        : 'unknown';

      // Determine final crop type (use 'unknown' if not provided)
      const finalCropType = formData.cropType === 'other' 
        ? formData.otherCropType 
        : formData.cropType || 'unknown';

      // Call Gemini API to analyze the crop disease
      const result = await detectCropDisease({
        input: {
          imageUri: formData.cropImage!,
          cropType: finalCropType,
          cropAge: formData.cropAge || '',
          weather: weatherCondition,
        },
        language: i18n.language,
      });

      setIsAnalyzing(false);

      // Navigate to disease result screen with Gemini analysis
      navigation.navigate('DiseaseResult', {
        cropImage: formData.cropImage!,
        cropType: finalCropType,
        cropAge: formData.cropAge,
        weather: weatherCondition,
        diseaseResult: result,
      });
    } catch (error) {
      setIsAnalyzing(false);
      console.error('Disease detection error:', error);
      Alert.alert(
        t('common.error'),
        error instanceof Error 
          ? error.message 
          : t('disease.analysisFailed')
      );
    }
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
                padding: 16,
                shadowColor: '#fff',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
              }}>
                <Scan size={40} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 32,
                  fontWeight: 'bold',
                  color: '#FFFFFF',
                  letterSpacing: 0.5,
                }}>
                  {t('disease.title')}
                </Text>
              </View>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* Upload Image Section */}
        <Animated.View style={{ 
          paddingHorizontal: 24, 
          marginTop: 28,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}>
          {/* Section Title with Icon */}
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
              {t('disease.uploadImage')}
            </Text>
          </View>

          {formData.cropImage ? (
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 16,
              marginBottom: 20,
              borderWidth: 2,
              borderColor: '#DCFCE7',
              shadowColor: '#22C55E',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 6,
            }}>
              <Image
                source={{ uri: formData.cropImage }}
                style={{
                  width: '100%',
                  height: 280,
                  borderRadius: 16,
                }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => handleFieldChange('cropImage', null)}
                activeOpacity={0.85}
                style={{
                  position: 'absolute',
                  top: 24,
                  right: 24,
                  backgroundColor: '#EF4444',
                  borderRadius: 20,
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#EF4444',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <X size={24} color="#FFFFFF" strokeWidth={3} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', marginBottom: 20, gap: 16 }}>
              {/* Camera Card */}
              <Animated.View style={{ 
                flex: 1,
                transform: [{ scale: cameraCardScale }],
              }}>
                <TouchableOpacity
                  onPress={pickImageFromCamera}
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
                      <Camera size={34} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                    <Text style={{
                      color: '#111827',
                      fontSize: 14,
                      fontWeight: '700',
                      textAlign: 'center',
                    }}>
                      {t('disease.takePhoto')}
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

              {/* Gallery Card */}
              <Animated.View style={{ 
                flex: 1,
                transform: [{ scale: galleryCardScale }],
              }}>
                <TouchableOpacity
                  onPress={pickImageFromGallery}
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
                      <ImageIcon size={34} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                    <Text style={{
                      color: '#111827',
                      fontSize: 14,
                      fontWeight: '700',
                      textAlign: 'center',
                    }}>
                      {t('disease.choosePhoto')}
                    </Text>
                    <Text style={{
                      color: '#64748B',
                      fontSize: 11,
                      marginTop: 4,
                      textAlign: 'center',
                    }}>
                      From Gallery
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}
        </Animated.View>

        {/* Crop Details Card */}
        <Animated.View style={{
          paddingHorizontal: 24,
          marginTop: 8,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 20,
            borderWidth: 2,
            borderColor: '#DCFCE7',
            shadowColor: '#22C55E',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 6,
            marginBottom: 20,
          }}>
            {/* Crop Age Field */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontSize: 15,
                fontWeight: '700',
                color: '#374151',
                marginBottom: 10,
              }}>
                {t('disease.cropAge')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <CustomInput
                    label=""
                    value={localizeNumber(formData.cropAge, i18n.language)}
                    onChangeText={(value) => {
                      const delocalized = delocalizeNumber(value, i18n.language);
                      handleFieldChange('cropAge', delocalized);
                    }}
                    placeholder={localizeNumber(t('disease.cropAgePlaceholder'), i18n.language)}
                    keyboardType="numeric"
                  />
                </View>
                {formData.cropAge && (
                  <Text style={{
                    color: '#6B7280',
                    marginLeft: 12,
                    fontWeight: '600',
                  }}>
                    {t('disease.days')}
                  </Text>
                )}
              </View>
            </View>

            {/* Crop Type Dropdown */}
            <View style={{ marginBottom: formData.cropType === 'other' ? 20 : 0 }}>
              <Text style={{
                fontSize: 15,
                fontWeight: '700',
                color: '#374151',
                marginBottom: 10,
              }}>
                {t('disease.cropType')}
              </Text>
              <Dropdown
                value={formData.cropType}
                onSelect={(item) => {
                  const value = typeof item === 'string' ? item : item.value;
                  handleFieldChange('cropType', value);
                  // Clear other crop type if not selecting 'other'
                  if (value !== 'other') {
                    handleFieldChange('otherCropType', '');
                  }
                }}
                options={CROP_TYPES}
                placeholder={t('disease.cropTypePlaceholder')}
              />
            </View>

            {/* Other Crop Type Input - Only show if 'other' is selected */}
            {formData.cropType === 'other' && (
              <View>
                <Text style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: '#374151',
                  marginBottom: 10,
                }}>
                  {t('disease.otherCropType')}
                </Text>
                <CustomInput
                  label=""
                  value={formData.otherCropType}
                  onChangeText={(value) => handleFieldChange('otherCropType', value)}
                  placeholder={t('disease.otherCropTypePlaceholder')}
                />
              </View>
            )}
          </View>

          {/* Premium Analyze Button */}
          <TouchableOpacity
            onPress={handleAnalyze}
            disabled={!canAnalyze() || isAnalyzing}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={canAnalyze() && !isAnalyzing 
                ? ['#22C55E', '#16A34A', '#15803D'] 
                : ['#D1D5DB', '#9CA3AF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 20,
                paddingVertical: 18,
                paddingHorizontal: 24,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                shadowColor: canAnalyze() && !isAnalyzing ? '#22C55E' : '#9CA3AF',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              {isAnalyzing ? (
                <Animated.View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: 12,
                  transform: [{ scale: pulseAnim }],
                }}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 17,
                    fontWeight: '700',
                    letterSpacing: 0.5,
                  }}>
                    {t('disease.analyzing')}
                  </Text>
                </Animated.View>
              ) : (
                <>
                  <Sparkles size={24} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 17,
                    fontWeight: '700',
                    letterSpacing: 0.5,
                  }}>
                    {t('disease.analyzeButton')}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
};
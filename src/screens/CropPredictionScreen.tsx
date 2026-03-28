import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
  Animated,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sprout, Calendar, MapPin, Leaf, Info, Sparkles } from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CustomInput } from '../components/CustomInput';
import { DatePicker } from '../components/DatePicker';
import { Dropdown } from '../components/Dropdown';
import { RootStackParamList } from '../navigation/AppNavigator';
import { localizeNumber, delocalizeNumber } from '../utils/numberLocalization';
import MovingBackgroundCircle from '@/components/MovingBackgroundCircle';
import { upsertFarmingPlanForCurrentUser } from '../services/farmingPlan';

type CropPredictionScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CropPrediction'
>;

interface FormData {
  cropType: string;
  acres: string;
  sellingPricePerKgInr: string;
  plantingDate: string;
  harvestDate: string;
  soilType: string;
  farmingMethod: string;
  additionalInfo: string;
  location: string;
}

interface FormErrors {
  [key: string]: string;
}

export const CropPredictionScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<CropPredictionScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const otherLabel = useMemo(() => {
    try {
      const translated = t('prediction.other');
      return translated === 'prediction.other' ? 'Other' : translated;
    } catch {
      return 'Other';
    }
  }, [t, i18n.language]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    cropType: '',
    acres: '',
    sellingPricePerKgInr: '',
    plantingDate: '',
    harvestDate: '',
    soilType: '',
    farmingMethod: '',
    additionalInfo: '',
    location: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;

  // State for showing custom input fields
  const [showCustomCropType, setShowCustomCropType] = useState(false);
  const [showCustomSoilType, setShowCustomSoilType] = useState(false);
  const [showCustomFarmingMethod, setShowCustomFarmingMethod] = useState(false);
  const [customCropType, setCustomCropType] = useState('');
  const [customSoilType, setCustomSoilType] = useState('');
  const [customFarmingMethod, setCustomFarmingMethod] = useState('');

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
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Get translated dropdown options
  const getCropTypes = () => [
    { label: t('prediction.cropTypes.rice'), value: 'rice' },
    { label: t('prediction.cropTypes.wheat'), value: 'wheat' },
    { label: t('prediction.cropTypes.cotton'), value: 'cotton' },
    { label: t('prediction.cropTypes.sugarcane'), value: 'sugarcane' },
    { label: t('prediction.cropTypes.corn'), value: 'corn' },
    { label: t('prediction.cropTypes.potato'), value: 'potato' },
    { label: t('prediction.cropTypes.tomato'), value: 'tomato' },
    { label: t('prediction.cropTypes.onion'), value: 'onion' },
    { label: otherLabel, value: 'other' },
  ];

  const getSoilTypes = () => [
    { label: t('prediction.soilTypes.alluvial'), value: 'alluvial' },
    { label: t('prediction.soilTypes.black'), value: 'black' },
    { label: t('prediction.soilTypes.red'), value: 'red' },
    { label: t('prediction.soilTypes.laterite'), value: 'laterite' },
    { label: t('prediction.soilTypes.desert'), value: 'desert' },
    { label: t('prediction.soilTypes.mountain'), value: 'mountain' },
    { label: otherLabel, value: 'other' },
  ];

  const getFarmingMethods = () => [
    { label: t('prediction.farmingMethods.traditional'), value: 'traditional' },
    { label: t('prediction.farmingMethods.organic'), value: 'organic' },
    { label: t('prediction.farmingMethods.modern'), value: 'modern' },
    { label: otherLabel, value: 'other' },
  ];

  const parseUserDate = useCallback(
    (value: string): Date | null => {
      const raw = (value || '').trim();
      if (!raw) return null;

      // Normalize localized digits to western digits.
      const normalized = delocalizeNumber(raw, i18n.language)
        .replace(/\s+/g, '')
        .replace(/\./g, '/')
        .replace(/\\/g, '/')
        .replace(/,/g, '/');

      const coerceTwoDigitYear = (year: number, digits: number): number => {
        if (!Number.isFinite(year)) return year;
        if (digits === 2) {
          // Common UX: treat 2-digit years as 20xx.
          return 2000 + year;
        }
        return year;
      };

      // Accept formats:
      // - DD/MM/YYYY, DD/MM/YY
      // - DD-MM-YYYY, DD-MM-YY
      // - YYYY-MM-DD, YY-MM-DD
      const ddmmyyyy = normalized.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
      if (ddmmyyyy) {
        const dd = Number(ddmmyyyy[1]);
        const mm = Number(ddmmyyyy[2]);
        const yearRaw = ddmmyyyy[3];
        const yyyy = coerceTwoDigitYear(Number(yearRaw), yearRaw.length);
        if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
        if (yyyy < 1900 || yyyy > 2100) return null;
        if (mm < 1 || mm > 12) return null;
        if (dd < 1 || dd > 31) return null;

        const d = new Date(yyyy, mm - 1, dd);
        // Guard against overflow (e.g., 31/02/2026)
        if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
        return d;
      }

      const yyyymmdd = normalized.match(/^(\d{2}|\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (yyyymmdd) {
        const yearRaw = yyyymmdd[1];
        const yyyy = coerceTwoDigitYear(Number(yearRaw), yearRaw.length);
        const mm = Number(yyyymmdd[2]);
        const dd = Number(yyyymmdd[3]);
        if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
        if (yyyy < 1900 || yyyy > 2100) return null;
        if (mm < 1 || mm > 12) return null;
        if (dd < 1 || dd > 31) return null;

        const d = new Date(yyyy, mm - 1, dd);
        if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
        return d;
      }

      return null;
    },
    [i18n.language]
  );

  const computeDurationDays = useCallback(
    (plantingDate: string, harvestDate: string): number | null => {
      const start = parseUserDate(plantingDate);
      const end = parseUserDate(harvestDate);
      if (!start || !end) return null;
      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (!Number.isFinite(diffDays) || diffDays <= 0) return null;
      return diffDays;
    },
    [parseUserDate]
  );

  const validateField = (name: keyof FormData, value: string): string => {
    switch (name) {
      case 'cropType':
        return !value ? t('prediction.errors.required') : '';
      case 'acres':
        return !value
          ? t('prediction.errors.required')
          : isNaN(Number(value)) || Number(value) <= 0
            ? t('prediction.errors.invalidAcres')
            : '';
      case 'sellingPricePerKgInr':
        return !value
          ? t('prediction.errors.required')
          : isNaN(Number(value)) || Number(value) <= 0
            ? t('prediction.errors.invalidSellingPrice')
            : '';
      case 'plantingDate':
        return !value
          ? t('prediction.errors.required')
          : parseUserDate(value)
            ? ''
            : (t('prediction.errors.invalidPlantingDate') as string);
      case 'harvestDate': {
        if (!value) return t('prediction.errors.required');
        const harvest = parseUserDate(value);
        if (!harvest) return t('prediction.errors.invalidHarvestDate') as string;
        const planting = parseUserDate(formData.plantingDate);
        if (planting && harvest.getTime() <= planting.getTime()) {
          return (t('prediction.errors.invalidDateRange') as string);
        }
        return '';
      }
      case 'soilType':
        return !value ? t('prediction.errors.required') : '';
      case 'farmingMethod':
        return !value ? t('prediction.errors.required') : '';
      case 'location':
        return !value ? t('prediction.errors.required') : '';
      default:
        return '';
    }
  };

  const handleFieldChange = (name: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const requiredFields: (keyof FormData)[] = [
      'cropType',
      'acres',
      'sellingPricePerKgInr',
      'plantingDate',
      'harvestDate',
      'soilType',
      'farmingMethod',
      'location',
    ];

    requiredFields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Import the prediction function
      const { getCropPrediction } = await import('../services/gemini');

      // Delocalize the acres value for API call
      const delocalizedAcres = delocalizeNumber(formData.acres, i18n.language);

      // Delocalize selling price for API call
      const delocalizedSellingPricePerKgInr = delocalizeNumber(
        formData.sellingPricePerKgInr,
        i18n.language
      );

      // Delocalize growing period for API call
      const durationDays = computeDurationDays(formData.plantingDate, formData.harvestDate);

      // Get multilingual crop name translations
      const getCropNameI18n = (cropValue: string): Record<string, string> => {
        // Map of crop translation keys
        const cropKeyMap: Record<string, string> = {
          'rice': 'prediction.cropTypes.rice',
          'wheat': 'prediction.cropTypes.wheat',
          'cotton': 'prediction.cropTypes.cotton',
          'sugarcane': 'prediction.cropTypes.sugarcane',
          'corn': 'prediction.cropTypes.corn',
          'potato': 'prediction.cropTypes.potato',
          'tomato': 'prediction.cropTypes.tomato',
          'onion': 'prediction.cropTypes.onion',
          'other': 'prediction.other',
        };

        const translationKey = cropKeyMap[cropValue];
        
        if (!translationKey) {
          // For custom crop types, return the custom value for all languages
          return { en: cropValue, hi: cropValue, bn: cropValue };
        }

        // Get translations for all supported languages
        return {
          en: i18n.t(translationKey, { lng: 'en' }),
          hi: i18n.t(translationKey, { lng: 'hi' }),
          bn: i18n.t(translationKey, { lng: 'bn' }),
        };
      };

      const cropNameI18n = getCropNameI18n(formData.cropType);

      // Store only the essential schedule values for reminders/task feed.
      // This is best-effort and should not block predictions.
      try {
        await upsertFarmingPlanForCurrentUser({
          cropType: formData.cropType,
          cropName: cropNameI18n[i18n.language] || cropNameI18n.en || formData.cropType,
          areaAcres: Number(delocalizedAcres),
          plantingDate: delocalizeNumber(formData.plantingDate, i18n.language),
          expectedHarvestDate: delocalizeNumber(formData.harvestDate, i18n.language),
          source: 'cropPredictionForm',
        });
      } catch (e) {
        console.warn('Failed to save farming plan (non-blocking):', e);
      }

      // Call Gemini API for crop prediction
      const predictionResult = await getCropPrediction({
        input: {
          cropType: formData.cropType,
          acres: delocalizedAcres,
          sellingPricePerKgInr: delocalizedSellingPricePerKgInr,
          plantingDate: delocalizeNumber(formData.plantingDate, i18n.language),
          harvestDate: delocalizeNumber(formData.harvestDate, i18n.language),
          growingPeriodDays: durationDays ?? undefined,
          soilType: formData.soilType,
          farmingMethod: formData.farmingMethod,
          additionalInfo: formData.additionalInfo,
          location: formData.location,
        },
        language: i18n.language,
      });

      console.log('Prediction result:', predictionResult);

      // Navigate to results screen with prediction data
      navigation.navigate('PredictionResult', {
        predictionData: predictionResult,
      });
    } catch (error) {
      console.error('Prediction error:', error);
      // Show error alert
      Alert.alert(
        t('prediction.errors.error') || 'Error',
        t('prediction.errors.predictionFailed') || 'Failed to get prediction. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    return (
      formData.cropType &&
      formData.acres &&
      formData.sellingPricePerKgInr &&
      formData.plantingDate &&
      formData.harvestDate &&
      formData.soilType &&
      formData.farmingMethod &&
      formData.location &&
      !errors.cropType &&
      !errors.acres &&
      !errors.sellingPricePerKgInr &&
      !errors.plantingDate &&
      !errors.harvestDate &&
      !errors.soilType &&
      !errors.farmingMethod &&
      !errors.location
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>

      <MovingBackgroundCircle
        size={200}
        speed={0.7}
        opacity={0.12}
        color="#22C55E"
      />
      <MovingBackgroundCircle
        size={250}
        speed={0.6}
        opacity={0.1}
        color="#16a149"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Minimalistic Header */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              paddingTop: insets.top + 12,
              paddingBottom: 20,
              paddingHorizontal: 24,
              shadowColor: '#16A34A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <Animated.View style={{ opacity: fadeAnim }}>
              <View style={{ marginBottom: 20 }}>
                <BackButton />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  backgroundColor: '#DCFCE7',
                  borderRadius: 12,
                  padding: 10,
                }}>
                  <Sprout size={24} color="#16A34A" strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 24,
                    fontWeight: 'bold',
                    color: '#111827',
                    marginBottom: 2,
                    letterSpacing: -0.5,
                  }}>
                    {t('prediction.title')}
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    color: '#6B7280',
                    lineHeight: 20,
                  }}>
                    {t('prediction.subtitle')}
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
            {/* Section Title */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 20,
                fontWeight: '700',
                color: '#1F2937',
              }}>
                {t('prediction.cropInfo') || 'Crop Information'}
              </Text>
            </View>

            {/* Crop Information Card */}
            <Animated.View style={{ transform: [{ scale: cardScale }] }}>
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 20,
                marginBottom: 24,
                shadowColor: '#16A34A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 6,
              }}>

                <Dropdown
                  label={t('prediction.cropType')}
                  placeholder={t('prediction.cropTypePlaceholder')}
                  value={showCustomCropType ? otherLabel : (formData.cropType ? getCropTypes().find(c => c.value === formData.cropType)?.label || '' : '')}
                  options={getCropTypes()}
                  onSelect={(value) => {
                    const val = typeof value === 'string' ? value : (value as any)?.value || value;
                    if (val === 'other') {
                      setShowCustomCropType(true);
                    } else {
                      setShowCustomCropType(false);
                      setCustomCropType('');
                      handleFieldChange('cropType', val);
                    }
                  }}
                  error={errors.cropType}
                />

                {showCustomCropType && (
                  <CustomInput
                    label={t('prediction.customCropTypeLabel') || 'Specify Crop Type'}
                    placeholder={t('prediction.customCropTypePlaceholder') || 'Enter crop type'}
                    value={customCropType}
                    onChangeText={(value) => {
                      setCustomCropType(value);
                      handleFieldChange('cropType', value);
                    }}
                    error={errors.cropType}
                  />
                )}

                <CustomInput
                  label={t('prediction.acres')}
                  placeholder={localizeNumber(t('prediction.acresPlaceholder'), i18n.language)}
                  value={localizeNumber(formData.acres, i18n.language)}
                  onChangeText={(value) => {
                    const delocalized = delocalizeNumber(value, i18n.language);
                    handleFieldChange('acres', delocalized);
                  }}
                  keyboardType="numeric"
                  error={errors.acres}
                />

                <CustomInput
                  label={t('prediction.sellingPricePerKg')}
                  placeholder={localizeNumber(t('prediction.sellingPricePerKgPlaceholder'), i18n.language)}
                  value={localizeNumber(formData.sellingPricePerKgInr, i18n.language)}
                  onChangeText={(value) => {
                    const delocalized = delocalizeNumber(value, i18n.language);
                    handleFieldChange('sellingPricePerKgInr', delocalized);
                  }}
                  keyboardType="number-pad"
                  error={errors.sellingPricePerKgInr}
                />
              </View>
            </Animated.View>

            {/* Timeline Section */}
            <View className="mb-6">
              <Text className="text-gray-900 text-xl font-bold mb-4">
                {t('prediction.timeline')}
              </Text>

              <DatePicker
                label={t('prediction.plantingDate')}
                placeholder={t('prediction.plantingDatePlaceholder')}
                value={formData.plantingDate}
                onDateSelect={(date) => handleFieldChange('plantingDate', date)}
                error={errors.plantingDate}
                maxDate={new Date(2100, 11, 31)}
              />

              <DatePicker
                label={t('prediction.harvestDate')}
                placeholder={t('prediction.harvestDatePlaceholder')}
                value={formData.harvestDate}
                onDateSelect={(date) => handleFieldChange('harvestDate', date)}
                error={errors.harvestDate}
                minDate={formData.plantingDate ? (() => {
                  const plantDate = parseUserDate(formData.plantingDate);
                  if (plantDate) {
                    const nextDay = new Date(plantDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    return nextDay;
                  }
                  return undefined;
                })() : undefined}
                maxDate={new Date(2100, 11, 31)}
              />
            </View>

            {/* Soil & Method Section */}
            <View className="mb-6">
              <Text className="text-gray-900 text-xl font-bold mb-4">
                {t('prediction.soilMethod')}
              </Text>

              <Dropdown
                label={t('prediction.soilType')}
                placeholder={t('prediction.soilTypePlaceholder')}
                value={showCustomSoilType ? otherLabel : (formData.soilType ? getSoilTypes().find(s => s.value === formData.soilType)?.label || '' : '')}
                options={getSoilTypes()}
                onSelect={(value) => {
                  const val = typeof value === 'string' ? value : (value as any)?.value || value;
                  if (val === 'other') {
                    setShowCustomSoilType(true);
                    // Don't set formData yet, wait for user to type
                  } else {
                    setShowCustomSoilType(false);
                    setCustomSoilType('');
                    handleFieldChange('soilType', val);
                  }
                }}
                error={errors.soilType}
              />

              {showCustomSoilType && (
                <CustomInput
                  label={t('prediction.customSoilTypeLabel') || 'Specify Soil Type'}
                  placeholder={t('prediction.customSoilTypePlaceholder') || 'Enter soil type'}
                  value={customSoilType}
                  onChangeText={(value) => {
                    setCustomSoilType(value);
                    handleFieldChange('soilType', value);
                  }}
                  error={errors.soilType}
                />
              )}

              <Dropdown
                label={t('prediction.farmingMethod')}
                placeholder={t('prediction.farmingMethodPlaceholder')}
                value={showCustomFarmingMethod ? otherLabel : (formData.farmingMethod ? getFarmingMethods().find(f => f.value === formData.farmingMethod)?.label || '' : '')}
                options={getFarmingMethods()}
                onSelect={(value) => {
                  const val = typeof value === 'string' ? value : (value as any)?.value || value;
                  if (val === 'other') {
                    setShowCustomFarmingMethod(true);
                    // Don't set formData yet, wait for user to type
                  } else {
                    setShowCustomFarmingMethod(false);
                    setCustomFarmingMethod('');
                    handleFieldChange('farmingMethod', val);
                  }
                }}
                error={errors.farmingMethod}
              />

              {showCustomFarmingMethod && (
                <CustomInput
                  label={t('prediction.customFarmingMethodLabel') || 'Specify Farming Method'}
                  placeholder={t('prediction.customFarmingMethodPlaceholder') || 'Enter farming method'}
                  value={customFarmingMethod}
                  onChangeText={(value) => {
                    setCustomFarmingMethod(value);
                    handleFieldChange('farmingMethod', value);
                  }}
                  error={errors.farmingMethod}
                />
              )}
            </View>

            {/* Location Section */}
            <View className="mb-6">
              <Text className="text-gray-900 text-xl font-bold mb-4">
                {t('prediction.locationSection')}
              </Text>

              <CustomInput
                label={t('prediction.location')}
                placeholder={t('prediction.locationPlaceholder')}
                value={formData.location}
                onChangeText={(value) => handleFieldChange('location', value)}
                error={errors.location}
              />
            </View>

            {/* Additional Information Section */}
            <View className="mb-6">
              <Text className="text-gray-900 text-xl font-bold mb-4">
                {t('prediction.additionalDetails')}
              </Text>

              <View className="mb-4">
                <Text className="text-gray-700 text-base font-medium mb-2">
                  {t('prediction.additionalInfo')}
                </Text>
                <TextInput
                  className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-base min-h-[100px]"
                  placeholder={t('prediction.additionalInfoPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  value={formData.additionalInfo}
                  onChangeText={(value) => handleFieldChange('additionalInfo', value)}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                />
                <Text className="text-gray-500 text-sm mt-1">
                  {t('prediction.optional')}
                </Text>
              </View>
            </View>

            {/* Premium Submit Button */}
            <LinearGradient
              colors={!isFormValid() || isLoading
                ? ['#D1D5DB', '#9CA3AF']
                : ['#22C55E', '#16A34A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 18,
                marginTop: 8,
                marginBottom: 24,
                shadowColor: !isFormValid() || isLoading ? '#000' : '#22C55E',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!isFormValid() || isLoading}
                style={{
                  paddingVertical: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>

                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 18,
                      fontWeight: 'bold',
                      letterSpacing: 0.5,
                    }}>
                      {t('prediction.submitButton')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};
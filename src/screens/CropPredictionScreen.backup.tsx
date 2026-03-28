import React, { useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Sprout, Calendar, MapPin, Leaf, Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CustomInput } from '../components/CustomInput';
import { Dropdown } from '../components/Dropdown';
import { RootStackParamList } from '../navigation/AppNavigator';
import { localizeNumber, delocalizeNumber } from '../utils/numberLocalization';

type CropPredictionScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CropPrediction'
>;

interface FormData {
  cropType: string;
  acres: string;
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
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    cropType: '',
    acres: '',
    plantingDate: '',
    harvestDate: '',
    soilType: '',
    farmingMethod: '',
    additionalInfo: '',
    location: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // State for showing custom input fields
  const [showCustomCropType, setShowCustomCropType] = useState(false);
  const [showCustomSoilType, setShowCustomSoilType] = useState(false);
  const [showCustomFarmingMethod, setShowCustomFarmingMethod] = useState(false);
  const [customCropType, setCustomCropType] = useState('');
  const [customSoilType, setCustomSoilType] = useState('');
  const [customFarmingMethod, setCustomFarmingMethod] = useState('');

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
    { label: 'Other', value: 'other' },
  ];

  const getSoilTypes = () => [
    { label: t('prediction.soilTypes.alluvial'), value: 'alluvial' },
    { label: t('prediction.soilTypes.black'), value: 'black' },
    { label: t('prediction.soilTypes.red'), value: 'red' },
    { label: t('prediction.soilTypes.laterite'), value: 'laterite' },
    { label: t('prediction.soilTypes.desert'), value: 'desert' },
    { label: t('prediction.soilTypes.mountain'), value: 'mountain' },
    { label: 'Other', value: 'other' },
  ];

  const getFarmingMethods = () => [
    { label: t('prediction.farmingMethods.traditional'), value: 'traditional' },
    { label: t('prediction.farmingMethods.organic'), value: 'organic' },
    { label: t('prediction.farmingMethods.modern'), value: 'modern' },
    { label: 'Other', value: 'other' },
  ];

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
      case 'plantingDate':
        return !value ? t('prediction.errors.required') : '';
      case 'harvestDate':
        return !value ? t('prediction.errors.required') : '';
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
    // Auto-format date fields (DD/MM/YYYY) with localized numerals
    if (name === 'plantingDate' || name === 'harvestDate') {
      // Delocalize to get western numerals, then remove all non-numeric characters
      const delocalizedValue = delocalizeNumber(value, i18n.language);
      const cleanValue = delocalizedValue.replace(/[^0-9]/g, '');

      // Format as DD/MM/YYYY in western numerals first
      let formattedValue = cleanValue;
      if (cleanValue.length >= 2) {
        formattedValue = cleanValue.slice(0, 2);
        if (cleanValue.length >= 4) {
          formattedValue += '/' + cleanValue.slice(2, 4) + '/' + cleanValue.slice(4, 8);
        } else if (cleanValue.length > 2) {
          formattedValue += '/' + cleanValue.slice(2);
        }
      }

      // Localize the formatted date for display
      const localizedValue = localizeNumber(formattedValue, i18n.language);

      setFormData((prev) => ({ ...prev, [name]: localizedValue }));
      const error = validateField(name, formattedValue);
      setErrors((prev) => ({ ...prev, [name]: error }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const requiredFields: (keyof FormData)[] = [
      'cropType',
      'acres',
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

      // Delocalize dates for API call
      const delocalizedPlantingDate = delocalizeNumber(formData.plantingDate, i18n.language);
      const delocalizedHarvestDate = delocalizeNumber(formData.harvestDate, i18n.language);

      // Call Gemini API for crop prediction
      const predictionResult = await getCropPrediction({
        input: {
          cropType: formData.cropType,
          acres: delocalizedAcres,
          plantingDate: delocalizedPlantingDate,
          harvestDate: delocalizedHarvestDate,
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
      formData.plantingDate &&
      formData.harvestDate &&
      formData.soilType &&
      formData.farmingMethod &&
      formData.location &&
      !errors.cropType &&
      !errors.acres &&
      !errors.plantingDate &&
      !errors.harvestDate &&
      !errors.soilType &&
      !errors.farmingMethod &&
      !errors.location
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#F9FAFB' }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Header with Gradient */}
        <LinearGradient
          colors={['#22C55E', '#16A34A', '#15803D']}
          style={{
            paddingTop: insets.top + 16,
            paddingBottom: 32,
            paddingHorizontal: 24,
          }}
        >
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
              {t('common.back') || 'Back'}
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 16,
              padding: 12,
            }}>
              <Sprout size={32} color="#FFFFFF" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#FFFFFF' }}>
                {t('prediction.title')}
              </Text>
              <Text style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.9)', marginTop: 4 }}>
                {t('prediction.subtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 20, marginTop: -16 }}>
          {/* Crop Information Card */}
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 4,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <LinearGradient
                colors={['#22C55E', '#16A34A']}
                style={{
                  borderRadius: 12,
                  padding: 8,
                }}
              >
                <Leaf size={20} color="#FFFFFF" strokeWidth={2.5} />
              </LinearGradient>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 }}>
                {t('prediction.cropInfo')}
              </Text>
            </View>

            <Dropdown
              label={t('prediction.cropType')}
              placeholder={t('prediction.cropTypePlaceholder')}
              value={showCustomCropType ? 'Other' : (formData.cropType ? getCropTypes().find(c => c.value === formData.cropType)?.label || '' : '')}
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
                label="Specify Crop Type"
                placeholder="Enter crop type"
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
          </View>

          {/* Timeline Section */}
          <View className="mb-6">
            <Text className="text-gray-900 text-xl font-bold mb-4">
              {t('prediction.timeline')}
            </Text>

            <CustomInput
              label={t('prediction.plantingDate')}
              placeholder={t('prediction.plantingDatePlaceholder')}
              value={formData.plantingDate}
              onChangeText={(value) => handleFieldChange('plantingDate', value)}
              keyboardType="number-pad"
              error={errors.plantingDate}
            />

            <CustomInput
              label={t('prediction.harvestDate')}
              placeholder={t('prediction.harvestDatePlaceholder')}
              value={formData.harvestDate}
              onChangeText={(value) => handleFieldChange('harvestDate', value)}
              keyboardType="number-pad"
              error={errors.harvestDate}
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
              value={showCustomSoilType ? 'Other' : (formData.soilType ? getSoilTypes().find(s => s.value === formData.soilType)?.label || '' : '')}
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
                label="Specify Soil Type"
                placeholder="Enter soil type"
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
              value={showCustomFarmingMethod ? 'Other' : (formData.farmingMethod ? getFarmingMethods().find(f => f.value === formData.farmingMethod)?.label || '' : '')}
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
                label="Specify Farming Method"
                placeholder="Enter farming method"
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

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!isFormValid() || isLoading}
            className={`rounded-xl py-4 mb-6 ${!isFormValid() || isLoading ? 'bg-gray-300' : 'bg-green-500'
              }`}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center text-lg font-semibold" numberOfLines={1} adjustsFontSizeToFit>
                {t('prediction.submitButton')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
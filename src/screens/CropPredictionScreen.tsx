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
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
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
  ];

  const getSoilTypes = () => [
    { label: t('prediction.soilTypes.alluvial'), value: 'alluvial' },
    { label: t('prediction.soilTypes.black'), value: 'black' },
    { label: t('prediction.soilTypes.red'), value: 'red' },
    { label: t('prediction.soilTypes.laterite'), value: 'laterite' },
    { label: t('prediction.soilTypes.desert'), value: 'desert' },
    { label: t('prediction.soilTypes.mountain'), value: 'mountain' },
  ];

  const getFarmingMethods = () => [
    { label: t('prediction.farmingMethods.traditional'), value: 'traditional' },
    { label: t('prediction.farmingMethods.organic'), value: 'organic' },
    { label: t('prediction.farmingMethods.modern'), value: 'modern' },
  ];

  const getLocations = () => [
    { label: t('prediction.locations.nadia'), value: 'nadia' },
    { label: t('prediction.locations.mumbai'), value: 'mumbai' },
    { label: t('prediction.locations.delhi'), value: 'delhi' },
    { label: t('prediction.locations.bangalore'), value: 'bangalore' },
    { label: t('prediction.locations.chennai'), value: 'chennai' },
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
      // Simulate API call
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      console.log('Prediction submitted:', formData);
      // Navigate to results screen
      navigation.navigate('PredictionResult');
    } catch (error) {
      console.error('Prediction error:', error);
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
      className="flex-1 bg-gray-50"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="bg-primary px-6 pt-12 pb-6 rounded-b-3xl mb-6">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="bg-white/20 rounded-full w-10 h-10 items-center justify-center mr-4"
            >
              <ArrowLeft size={24} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-3xl font-bold">
                {t('prediction.title')}
              </Text>
              <Text className="text-white/90 text-base mt-1">
                {t('prediction.subtitle')}
              </Text>
            </View>
          </View>
        </View>

        <View className="px-6">
          {/* Crop Information Section */}
          <View className="mb-6">
            <Text className="text-gray-900 text-xl font-bold mb-4">
              {t('prediction.cropInfo')}
            </Text>

            <Dropdown
              label={t('prediction.cropType')}
              placeholder={t('prediction.cropTypePlaceholder')}
              value={formData.cropType ? getCropTypes().find(c => c.value === formData.cropType)?.label || '' : ''}
              options={getCropTypes()}
              onSelect={(value) => {
                const val = typeof value === 'string' ? value : (value as any)?.value || value;
                handleFieldChange('cropType', val);
              }}
              error={errors.cropType}
            />

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
              value={formData.soilType ? getSoilTypes().find(s => s.value === formData.soilType)?.label || '' : ''}
              options={getSoilTypes()}
              onSelect={(value) => {
                const val = typeof value === 'string' ? value : (value as any)?.value || value;
                handleFieldChange('soilType', val);
              }}
              error={errors.soilType}
            />

            <Dropdown
              label={t('prediction.farmingMethod')}
              placeholder={t('prediction.farmingMethodPlaceholder')}
              value={formData.farmingMethod ? getFarmingMethods().find(f => f.value === formData.farmingMethod)?.label || '' : ''}
              options={getFarmingMethods()}
              onSelect={(value) => {
                const val = typeof value === 'string' ? value : (value as any)?.value || value;
                handleFieldChange('farmingMethod', val);
              }}
              error={errors.farmingMethod}
            />
          </View>

          {/* Location Section */}
          <View className="mb-6">
            <Text className="text-gray-900 text-xl font-bold mb-4">
              {t('prediction.locationSection')}
            </Text>

            <Dropdown
              label={t('prediction.location')}
              placeholder={t('prediction.locationPlaceholder')}
              value={formData.location ? getLocations().find(l => l.value === formData.location)?.label || '' : ''}
              options={getLocations()}
              onSelect={(value) => {
                const val = typeof value === 'string' ? value : (value as any)?.value || value;
                handleFieldChange('location', val);
              }}
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
            className={`rounded-xl py-4 mb-6 ${
              !isFormValid() || isLoading ? 'bg-gray-300' : 'bg-green-500'
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

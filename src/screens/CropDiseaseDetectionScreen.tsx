import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { CustomInput } from '../components/CustomInput';
import { Dropdown } from '../components/Dropdown';
import { RootStackParamList } from '../navigation/AppNavigator';
import { localizeNumber, delocalizeNumber } from '../utils/numberLocalization';

type CropDiseaseDetectionScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CropDiseaseDetection'
>;

interface FormData {
  cropImage: string | null;
  cropAge: string;
  cropType: string;
  recentWeather: string;
}

export const CropDiseaseDetectionScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<CropDiseaseDetectionScreenNavigationProp>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    cropImage: null,
    cropAge: '',
    cropType: '',
    recentWeather: '',
  });

  const CROP_TYPES = [
    { label: t('disease.cropTypes.rice'), value: 'rice' },
    { label: t('disease.cropTypes.wheat'), value: 'wheat' },
    { label: t('disease.cropTypes.potato'), value: 'potato' },
  ];

  const WEATHER_CONDITIONS = [
    { label: t('disease.weatherConditions.rainy'), value: 'rainy' },
    { label: t('disease.weatherConditions.dry'), value: 'dry' },
    { label: t('disease.weatherConditions.humid'), value: 'humid' },
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
      quality: 0.8,
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
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      handleFieldChange('cropImage', result.assets[0].uri);
    }
  };

  const canAnalyze = () => {
    return (
      formData.cropImage !== null &&
      formData.cropType !== '' &&
      formData.recentWeather !== ''
    );
  };

  const handleAnalyze = async () => {
    if (!canAnalyze()) {
      Alert.alert(t('disease.imageRequired'));
      return;
    }

    setIsAnalyzing(true);

    // Simulate AI analysis with delay
    setTimeout(() => {
      setIsAnalyzing(false);
      // Navigate to disease result screen (to be created)
      navigation.navigate('DiseaseResult', {
        cropImage: formData.cropImage!,
        cropType: formData.cropType,
        cropAge: formData.cropAge,
        weather: formData.recentWeather,
      });
    }, 2500);
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 32 }}
      >
        {/* Header */}
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mb-4"
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-gray-800">
            {t('disease.title')}
          </Text>
        </View>

        {/* Crop Image Upload Section */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-gray-700 mb-2">
            {t('disease.uploadImage')} *
          </Text>
          <Text className="text-sm text-gray-500 mb-3">
            {t('disease.instruction')}
          </Text>

          {formData.cropImage ? (
            <View className="relative">
              <Image
                source={{ uri: formData.cropImage }}
                className="w-full h-64 rounded-xl"
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => handleFieldChange('cropImage', null)}
                className="absolute top-2 right-2 bg-red-500 rounded-full w-8 h-8 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={pickImageFromCamera}
                className="flex-1 bg-green-50 border-2 border-green-200 rounded-xl p-4 items-center"
              >
                <Ionicons name="camera" size={32} color="#16a34a" />
                <Text className="text-green-700 font-semibold mt-2">
                  {t('disease.takePhoto')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={pickImageFromGallery}
                className="flex-1 bg-blue-50 border-2 border-blue-200 rounded-xl p-4 items-center"
              >
                <Ionicons name="images" size={32} color="#2563eb" />
                <Text className="text-blue-700 font-semibold mt-2">
                  {t('disease.choosePhoto')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Crop Age Field */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-gray-700 mb-2">
            {t('disease.cropAge')}
          </Text>
          <View className="flex-row items-center">
            <View className="flex-1">
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
              <Text className="text-gray-600 ml-3">
                {t('disease.days')}
              </Text>
            )}
          </View>
        </View>

        {/* Crop Type Dropdown */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-gray-700 mb-2">
            {t('disease.cropType')} *
          </Text>
          <Dropdown
            value={formData.cropType}
            onSelect={(item) => {
              const value = typeof item === 'string' ? item : item.value;
              handleFieldChange('cropType', value);
            }}
            options={CROP_TYPES}
            placeholder={t('disease.cropTypePlaceholder')}
          />
        </View>

        {/* Recent Weather Dropdown */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-gray-700 mb-2">
            {t('disease.recentWeather')} *
          </Text>
          <Dropdown
            value={formData.recentWeather}
            onSelect={(item) => {
              const value = typeof item === 'string' ? item : item.value;
              handleFieldChange('recentWeather', value);
            }}
            options={WEATHER_CONDITIONS}
            placeholder={t('disease.recentWeatherPlaceholder')}
          />
        </View>

        {/* Analyze Button */}
        <TouchableOpacity
          onPress={handleAnalyze}
          disabled={!canAnalyze() || isAnalyzing}
          className={`rounded-xl py-4 items-center ${
            canAnalyze() && !isAnalyzing
              ? 'bg-green-600'
              : 'bg-gray-300'
          }`}
        >
          {isAnalyzing ? (
            <View className="flex-row items-center">
              <ActivityIndicator color="#fff" />
              <Text className="text-white text-lg font-semibold ml-2" numberOfLines={1} adjustsFontSizeToFit>
                {t('disease.analyzing')}
              </Text>
            </View>
          ) : (
            <Text className="text-white text-lg font-semibold px-4" numberOfLines={1} adjustsFontSizeToFit>
              {t('disease.analyzeButton')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

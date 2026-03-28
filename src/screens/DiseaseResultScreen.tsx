import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Bug, AlertTriangle, Heart, TrendingUp, Pill, Shield } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
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
        return 'bg-green-100 text-green-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'high':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getRecoveryColor = (recovery: string) => {
    switch (recovery) {
      case 'high':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getHealthBarColor = (percentage: number) => {
    if (percentage >= 70) return 'bg-green-500';
    if (percentage >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleBackToDashboard = () => {
    navigation.navigate('Dashboard');
  };

  const handleScanAnother = () => {
    navigation.navigate('CropDiseaseDetection');
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ 
          padding: 24, 
          paddingBottom: Math.max(insets.bottom, 24) + 24 
        }}
      >
        {/* Header */}
        <View className="mb-8">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mb-6 w-10 h-10 items-center justify-center bg-gray-100 rounded-full"
          >
            <ArrowLeft size={20} color="#000" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-gray-900 mb-2">
            {t('diseaseResult.title')}
          </Text>
          <View className="w-16 h-1 bg-green-600 rounded-full" />
        </View>

        {/* Crop Image */}
        {cropImage && (
          <View className="mb-8">
            <View className="bg-white rounded-2xl p-2 shadow-md">
              <Image
                source={{ uri: cropImage }}
                className="w-full h-56 rounded-xl"
                resizeMode="cover"
              />
            </View>
          </View>
        )}

        {/* Analysis Details Card */}
        <View className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 mb-6">
          <Text className="text-blue-900 font-bold text-lg mb-3">
            {t('diseaseResult.analysisDetails')}
          </Text>
          <View className="space-y-2">
            <Text className="text-blue-800 text-base">
              • {t('disease.cropType')}: {cropType || t('common.unknown')}
            </Text>
            {cropAge && (
              <Text className="text-blue-800 text-base">
                • {t('disease.cropAge')}: {cropAge} {t('disease.days')}
              </Text>
            )}
            <Text className="text-blue-800 text-base">
              • {t('disease.recentWeather')}: {t(`disease.weatherConditions.${weather}`)}
            </Text>
          </View>
        </View>

        {/* Warning Message - Show if not a crop */}
        {diseaseData.isNotCrop && (
          <View className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-6 mb-6">
            <View className="flex-row items-start">
              <View className="bg-orange-200 rounded-full w-12 h-12 items-center justify-center mr-4 mt-1">
                <AlertTriangle size={28} color="#EA580C" strokeWidth={2.5} />
              </View>
              <View className="flex-1">
                <Text className="text-orange-900 font-bold text-xl mb-3">
                  {t('diseaseResult.warning')}
                </Text>
                <Text className="text-orange-800 text-base leading-6">
                  {diseaseData.warningMessage || t('diseaseResult.notCropWarning')}
                </Text>
                <TouchableOpacity
                  onPress={handleScanAnother}
                  className="bg-orange-600 rounded-xl py-3 mt-4 items-center"
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-base font-bold">
                    {t('diseaseResult.uploadNewImage')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Only show disease analysis if it's a crop */}
        {!diseaseData.isNotCrop && (
          <>
            {/* Detected Disease Card */}
            <View className="bg-white border-2 border-red-200 rounded-2xl p-5 mb-6 shadow-lg">
              <View className="flex-row items-center">
                <View className="bg-red-100 rounded-2xl w-14 h-14 items-center justify-center mr-4">
                  <Bug size={28} color="#DC2626" strokeWidth={2.5} />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">
                    {t('diseaseResult.detectedDisease')}
                  </Text>
                  <Text className="text-gray-900 text-xl font-bold leading-tight">
                    {diseaseData.diseaseName}
                  </Text>
                </View>
              </View>
            </View>

            {/* Severity Card */}
            <View className="bg-white rounded-2xl p-5 mb-6 shadow-md">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-orange-100 rounded-2xl w-12 h-12 items-center justify-center mr-4">
                    <AlertTriangle size={24} color="#F97316" strokeWidth={2.5} />
                  </View>
                  <Text className="text-gray-700 text-base font-semibold">
                    {t('diseaseResult.severity')}
                  </Text>
                </View>
                <View
                  className={`px-5 py-2.5 rounded-xl ${getSeverityColor(
                    diseaseData.severity
                  )}`}
                >
                  <Text className="font-bold text-sm uppercase tracking-wide">
                    {t(`diseaseResult.severityLevels.${diseaseData.severity}`)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Crop Health Bar */}
            <View className="bg-white rounded-2xl p-5 mb-6 shadow-md">
              <View className="flex-row items-center mb-4">
                <View className="bg-green-100 rounded-2xl w-12 h-12 items-center justify-center mr-4">
                  <Heart size={24} color="#22C55E" strokeWidth={2.5} fill="#22C55E" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">
                    {t('diseaseResult.cropHealth')}
                  </Text>
                  <Text className="text-gray-900 text-2xl font-bold">
                    {diseaseData.healthPercentage}%
                  </Text>
                </View>
              </View>
              
              {/* Progress Bar */}
              <View className="bg-gray-200 h-4 rounded-full overflow-hidden">
                <View
                  className={`h-full ${getHealthBarColor(
                    diseaseData.healthPercentage
                  )} rounded-full`}
                  style={{ width: `${diseaseData.healthPercentage}%` }}
                />
              </View>
            </View>

            {/* Recovery Chance Card */}
            <View className="bg-white rounded-2xl p-5 mb-6 shadow-md">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center" style={{ flex: 0, flexShrink: 1 }}>
                  <View className="bg-purple-100 rounded-2xl w-12 h-12 items-center justify-center mr-4">
                    <TrendingUp size={24} color="#A855F7" strokeWidth={2.5} />
                  </View>
                  <Text className="text-gray-700 text-base font-semibold">
                    {t('diseaseResult.recoveryChance')}
                  </Text>
                </View>
                <Text
                  className={`text-xl font-bold uppercase tracking-wide ml-4 ${getRecoveryColor(
                    diseaseData.recoveryChance
                  )}`}
                  numberOfLines={1}
                >
                  {t(`diseaseResult.recoveryChances.${diseaseData.recoveryChance}`)}
                </Text>
              </View>
            </View>

            {/* Recommendations Section */}
            <View className="mb-8">
              <View className="flex-row items-center mb-5">
                <View className="w-1 h-7 bg-green-600 rounded-full mr-3" />
                <Text className="text-2xl font-bold text-gray-900">
                  {t('diseaseResult.recommendations')}
                </Text>
              </View>

              {/* Treatment Card */}
              <View className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-5 mb-5">
                <View className="flex-row items-start">
                  <View className="bg-green-600 rounded-xl w-10 h-10 items-center justify-center mr-4 mt-1">
                    <Pill size={22} color="#FFFFFF" strokeWidth={2.5} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-green-900 font-bold text-lg mb-3">
                      {t('diseaseResult.treatment')}
                    </Text>
                    <Text className="text-green-800 text-base leading-6">
                      {diseaseData.treatment}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Prevention Card */}
              <View className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-5">
                <View className="flex-row items-start">
                  <View className="bg-blue-600 rounded-xl w-10 h-10 items-center justify-center mr-4 mt-1">
                    <Shield size={22} color="#FFFFFF" strokeWidth={2.5} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-blue-900 font-bold text-lg mb-3">
                      {t('diseaseResult.prevention')}
                    </Text>
                    <Text className="text-blue-800 text-base leading-6">
                      {diseaseData.prevention}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Action Buttons */}
        <View className="space-y-4">
          <TouchableOpacity
            onPress={handleBackToDashboard}
            className="bg-green-600 rounded-2xl py-4 items-center shadow-md"
            activeOpacity={0.8}
          >
            <Text className="text-white text-lg font-bold">
              {t('diseaseResult.backToDashboard')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleScanAnother}
            className="bg-white border-2 border-green-600 rounded-2xl py-4 items-center shadow-sm"
            activeOpacity={0.8}
          >
            <Text className="text-green-600 text-lg font-bold">
              {t('diseaseResult.scanAnother')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
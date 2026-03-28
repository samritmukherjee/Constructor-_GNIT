import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type PredictionResultScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'PredictionResult'
>;

// Hardcoded prediction results for UI
const PREDICTION_RESULTS = [
  {
    id: 1,
    label: 'expectedYield',
    value: '18–22 Quintals',
    icon: 'Wheat',
    bgColor: '#DCFCE7',
    iconColor: '#16A34A',
    textColor: '#166534',
  },
  {
    id: 2,
    label: 'cropHealth',
    value: 'Good',
    icon: 'Heart',
    bgColor: '#FEE2E2',
    iconColor: '#EF4444',
    textColor: '#991B1B',
  },
  {
    id: 3,
    label: 'riskLevel',
    value: 'Low',
    icon: 'CheckCircle',
    bgColor: '#E0E7FF',
    iconColor: '#6366F1',
    textColor: '#3730A3',
  },
  {
    id: 4,
    label: 'waterRequirement',
    value: 'Medium',
    icon: 'Droplets',
    bgColor: '#DBEAFE',
    iconColor: '#3B82F6',
    textColor: '#1E40AF',
  },
  {
    id: 5,
    label: 'fertilizerSuggestion',
    value: 'Nitrogen-based',
    icon: 'Flask',
    bgColor: '#FEF3C7',
    iconColor: '#F59E0B',
    textColor: '#92400E',
  },
  {
    id: 6,
    label: 'harvestReadiness',
    value: 'On Time',
    icon: 'Clock',
    bgColor: '#FBCFE8',
    iconColor: '#EC4899',
    textColor: '#9F1239',
  },
];

export const PredictionResultScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<PredictionResultScreenNavigationProp>();

  const handleBackToDashboard = () => {
    navigation.navigate('Dashboard');
  };

  const handleNewPrediction = () => {
    navigation.navigate('CropPrediction');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="bg-green-500 px-6 pt-12 pb-8 rounded-b-3xl mb-6">
          <View className="items-center">
            <View className="bg-white/20 rounded-full w-20 h-20 items-center justify-center mb-4">
              <LucideIcons.Sparkles size={48} color="#fff" strokeWidth={2} />
            </View>
            <Text className="text-white text-3xl font-bold text-center">
              {t('result.title')}
            </Text>
            <Text className="text-white/90 text-base mt-2 text-center">
              {t('result.subtitle')}
            </Text>
          </View>
        </View>

        <View className="px-6">
          {/* Results Section */}
          <View className="mb-8">
            <Text className="text-gray-900 text-xl font-bold mb-5">
              {t('result.predictionResults')}
            </Text>

            <View>
              {PREDICTION_RESULTS.map((result) => {
                const IconComponent = (LucideIcons as any)[result.icon];
                if (!IconComponent) return null;
                
                return (
                  <View
                    key={result.id}
                    className="rounded-full px-6 py-4 flex-row items-center mb-4"
                    style={{
                      backgroundColor: result.bgColor,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    <View className="mr-4">
                      <IconComponent size={32} color={result.iconColor} strokeWidth={2.5} />
                    </View>
                    <View className="flex-1">
                      <Text 
                        className="text-xs font-medium mb-1"
                        style={{ color: result.textColor }}
                      >
                        {t(`result.${result.label}`)}
                      </Text>
                      <Text
                        className="text-base font-bold"
                        style={{ color: result.textColor }}
                      >
                        {t(`result.values.${result.label}`)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Recommendation Card */}
          <View
            className="bg-blue-50 rounded-xl p-5 mb-6 border border-blue-100"
          >
            <View className="flex-row items-start mb-3">
              <LucideIcons.Lightbulb size={28} color="#1E40AF" strokeWidth={2} />
              <Text className="text-blue-900 text-lg font-bold flex-1 ml-3">
                {t('result.recommendationTitle')}
              </Text>
            </View>
            <Text className="text-blue-800 text-base leading-6">
              {t('result.recommendationText')}
            </Text>
          </View>

          {/* Action Buttons */}
          <View>
            {/* Primary Button - Back to Dashboard */}
            <TouchableOpacity
              onPress={handleBackToDashboard}
              className="bg-green-500 rounded-xl py-4 mb-6"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Text className="text-white text-center text-lg font-semibold">
                {t('result.backToDashboard')}
              </Text>
            </TouchableOpacity>

            {/* Secondary Button - New Prediction */}
            <TouchableOpacity
              onPress={handleNewPrediction}
              className="bg-white border-2 border-green-500 rounded-xl py-4"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}
            >
              <Text className="text-green-500 text-center text-lg font-semibold">
                {t('result.newPrediction')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Info Note */}
          <View className="mt-6 px-4">
            <Text className="text-gray-500 text-sm text-center leading-5">
              {t('result.infoNote')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 

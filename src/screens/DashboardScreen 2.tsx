import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ChatbotModal } from '../components/ChatbotModal';

type DashboardScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Dashboard'
>;

// Mock data for the dashboard
const FARMING_UPDATES = [
  {
    id: '1',
    title: 'Rice Yield Expected to Increase',
    description: 'West Bengal farmers report positive crop growth this season with improved irrigation facilities.',
    region: 'West Bengal',
  },
  {
    id: '2',
    title: 'Drought Alert Issued',
    description: 'Maharashtra regions facing water scarcity. Farmers advised to adopt water conservation methods.',
    region: 'Maharashtra',
  },
  {
    id: '3',
    title: 'New Organic Farming Initiative',
    description: 'Punjab government launches support program for organic farming with subsidies and training.',
    region: 'Punjab',
  },
  {
    id: '4',
    title: 'Wheat Market Price Surge',
    description: 'Wheat prices increase by 15% due to high demand. Good news for wheat farmers.',
    region: 'Haryana',
  },
];

const WEATHER_DATA = {
  temperature: 32,
  rain: 'Yes',
  humidity: 78,
  condition: 'Partly Cloudy',
};

const FARM_SUMMARY = {
  crops: 'Rice',
  area: 2,
  status: 'Healthy',
};

export const DashboardScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const [isChatbotVisible, setIsChatbotVisible] = useState(false);

  const handlePredictCrop = () => {
    navigation.navigate('CropPrediction');
  };

  const handleDocumentAnalyzer = () => {
    navigation.navigate('DocumentAnalyzer');
  };

  const handleDiseaseDetection = () => {
    navigation.navigate('CropDiseaseDetection');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="bg-primary px-6 pt-6 pb-8 rounded-b-3xl">
          <View className="flex-row justify-between items-center mb-2">
            <View>
              <Text className="text-white text-3xl font-bold">
                {t('dashboard.greeting')}
              </Text>
              <Text className="text-white/90 text-base mt-1">
                {t('dashboard.subtitle')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              className="bg-white/20 rounded-full w-12 h-12 items-center justify-center"
            >
              <Text className="text-white text-xl font-bold">👤</Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View className="mt-4 space-y-3">
            {/* Quick Prediction Button */}
            <TouchableOpacity
              onPress={handlePredictCrop}
              className="bg-green-500 rounded-xl p-4 flex-row items-center justify-between shadow-md"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View className="flex-row items-center">
                <View className="bg-white/20 rounded-full w-12 h-12 items-center justify-center mr-3">
                  <Text className="text-2xl">🌾</Text>
                </View>
                <View>
                  <Text className="text-white text-lg font-bold">
                    {t('dashboard.predictCrop')}
                  </Text>
                  <Text className="text-white/90 text-sm">
                    {t('dashboard.predictSubtitle')}
                  </Text>
                </View>
              </View>
              <Text className="text-white text-2xl">→</Text>
            </TouchableOpacity>

            {/* Document Analyzer Button */}
            <TouchableOpacity
              onPress={handleDocumentAnalyzer}
              className="bg-blue-500 rounded-xl p-4 flex-row items-center justify-between shadow-md"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View className="flex-row items-center">
                <View className="bg-white/20 rounded-full w-12 h-12 items-center justify-center mr-3">
                  <Text className="text-2xl">📄</Text>
                </View>
                <View>
                  <Text className="text-white text-lg font-bold">
                    {t('dashboard.analyzeDocument')}
                  </Text>
                  <Text className="text-white/90 text-sm">
                    {t('dashboard.analyzeDocumentSubtitle')}
                  </Text>
                </View>
              </View>
              <Text className="text-white text-2xl">→</Text>
            </TouchableOpacity>

            {/* Disease Detection Button */}
            <TouchableOpacity
              onPress={handleDiseaseDetection}
              className="bg-orange-500 rounded-xl p-4 flex-row items-center justify-between shadow-md"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View className="flex-row items-center">
                <View className="bg-white/20 rounded-full w-12 h-12 items-center justify-center mr-3">
                  <Text className="text-2xl">🔬</Text>
                </View>
                <View>
                  <Text className="text-white text-lg font-bold">
                    {t('disease.title')}
                  </Text>
                  <Text className="text-white/90 text-sm">
                    {t('disease.instruction')}
                  </Text>
                </View>
              </View>
              <Text className="text-white text-2xl">→</Text>
            </TouchableOpacity>
          </View>

          {/* Weather Forecast */}
          <View className="mt-4">
            <Text className="text-gray-900 text-xl font-bold mb-3 px-2">
              {t('dashboard.weather.title')}
            </Text>
            <View
              className="bg-white rounded-xl p-5 shadow-sm"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 2,
              }}
            >
              <View className="flex-row items-center mb-4">
                <Text className="text-6xl mr-4">☀️</Text>
                <View>
                  <Text className="text-4xl font-bold text-gray-900">
                    {WEATHER_DATA.temperature}°C
                  </Text>
                  <Text className="text-gray-600 text-base">
                    {WEATHER_DATA.condition}
                  </Text>
                </View>
              </View>
              
              <View className="flex-row justify-between pt-4 border-t border-gray-100">
                <View className="items-center flex-1">
                  <Text className="text-3xl mb-1">💧</Text>
                  <Text className="text-gray-600 text-sm">
                    {t('dashboard.weather.rain')}
                  </Text>
                  <Text className="text-gray-900 text-base font-semibold">
                    {WEATHER_DATA.rain}
                  </Text>
                </View>
                <View className="items-center flex-1 border-l border-gray-100">
                  <Text className="text-3xl mb-1">💨</Text>
                  <Text className="text-gray-600 text-sm">
                    {t('dashboard.weather.humidity')}
                  </Text>
                  <Text className="text-gray-900 text-base font-semibold">
                    {WEATHER_DATA.humidity}%
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Farm Summary */}
          <View className="mt-4">
            <Text className="text-gray-900 text-xl font-bold mb-3 px-2">
              {t('dashboard.farmSummary.title')}
            </Text>
            <View
              className="bg-white rounded-xl p-5 shadow-sm"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 2,
              }}
            >
              <View className="space-y-4">
                <View className="flex-row items-center">
                  <View className="bg-green-100 rounded-full w-12 h-12 items-center justify-center mr-4">
                    <Text className="text-2xl">🌾</Text>
                  </View>
                  <View>
                    <Text className="text-gray-600 text-sm">
                      {t('dashboard.farmSummary.crops')}
                    </Text>
                    <Text className="text-gray-900 text-lg font-semibold">
                      {FARM_SUMMARY.crops}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center">
                  <View className="bg-blue-100 rounded-full w-12 h-12 items-center justify-center mr-4">
                    <Text className="text-2xl">📏</Text>
                  </View>
                  <View>
                    <Text className="text-gray-600 text-sm">
                      {t('dashboard.farmSummary.area')}
                    </Text>
                    <Text className="text-gray-900 text-lg font-semibold">
                      {FARM_SUMMARY.area} {t('dashboard.farmSummary.acres')}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center">
                  <View className="bg-yellow-100 rounded-full w-12 h-12 items-center justify-center mr-4">
                    <Text className="text-2xl">💚</Text>
                  </View>
                  <View>
                    <Text className="text-gray-600 text-sm">
                      {t('dashboard.farmSummary.status')}
                    </Text>
                    <Text className="text-green-600 text-lg font-semibold">
                      {t('dashboard.farmSummary.healthy')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Farming Feed */}
          <View className="mt-4">
            <Text className="text-gray-900 text-xl font-bold mb-3 px-2">
              {t('dashboard.farmingFeed.title')}
            </Text>
            <View className="space-y-3">
              {FARMING_UPDATES.map((update) => (
                <View
                  key={update.id}
                  className="bg-white rounded-xl p-4 shadow-sm"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  <View className="flex-row items-start mb-2">
                    <View className="bg-primary/10 rounded-lg px-3 py-1">
                      <Text className="text-primary text-xs font-semibold">
                        📍 {update.region}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-gray-900 text-base font-bold mb-2">
                    {update.title}
                  </Text>
                  <Text className="text-gray-600 text-sm leading-5">
                    {update.description}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating Chat Button */}
      <TouchableOpacity
        onPress={() => setIsChatbotVisible(true)}
        className="absolute bottom-6 right-6 bg-green-500 rounded-full w-16 h-16 items-center justify-center shadow-lg"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 8,
        }}
      >
        <Text className="text-4xl">💬</Text>
      </TouchableOpacity>

      {/* Chatbot Modal */}
      <ChatbotModal
        visible={isChatbotVisible}
        onClose={() => setIsChatbotVisible(false)}
      />
    </SafeAreaView>
  );
};

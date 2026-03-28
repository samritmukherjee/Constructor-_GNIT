import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { HandHeart, Sun, Droplets, Wind, Wheat, Ruler, Heart, MapPin, Cloud, CloudRain, CloudDrizzle, CloudSnow, CloudLightning, CloudFog } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ChatbotModal } from '../components/ChatbotModal';
import { SideDrawer } from '../components/SideDrawer';
import { localizeNumber } from '../utils/numberLocalization';
import { getWeatherForCurrentLocation, WeatherData, getWeatherIcon, getWeatherConditionKey } from '../services/weather';

type DashboardScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Dashboard'
>;

export const DashboardScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const [isChatbotVisible, setIsChatbotVisible] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [weatherError, setWeatherError] = useState(false);
  // Hardcoded: 2 buyers have contacted this farmer
  const notificationCount = 2;

  // Safe translation helper
  const tr = (key: string, fallback?: string) => {
    try {
      if (!i18n || !i18n.isInitialized) {
        return fallback || key;
      }
      const translated = t(key);
      return translated || fallback || key;
    } catch (error) {
      console.error('Translation error:', error);
      return fallback || key;
    }
  };

  // Fetch weather data on component mount
  useEffect(() => {
    fetchWeather();
  }, []);

  const fetchWeather = async () => {
    setIsLoadingWeather(true);
    setWeatherError(false);
    
    try {
      const data = await getWeatherForCurrentLocation();
      if (data) {
        setWeatherData(data);
      } else {
        setWeatherError(true);
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      setWeatherError(true);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // Get weather icon component based on weather code
  const getWeatherIconComponent = (weatherCode: number, size: number = 56, color: string = '#FFA500') => {
    const iconType = getWeatherIcon(weatherCode);
    
    switch (iconType) {
      case 'clear':
        return <Sun size={size} color={color} strokeWidth={2} />;
      case 'partly-cloudy':
        return <Cloud size={size} color="#94A3B8" strokeWidth={2} />;
      case 'cloudy':
        return <Cloud size={size} color="#64748B" strokeWidth={2} />;
      case 'fog':
        return <CloudFog size={size} color="#9CA3AF" strokeWidth={2} />;
      case 'drizzle':
        return <CloudDrizzle size={size} color="#60A5FA" strokeWidth={2} />;
      case 'rain':
        return <CloudRain size={size} color="#3B82F6" strokeWidth={2} />;
      case 'heavy-rain':
        return <CloudRain size={size} color="#1E40AF" strokeWidth={2} />;
      case 'snow':
        return <CloudSnow size={size} color="#93C5FD" strokeWidth={2} />;
      case 'thunderstorm':
        return <CloudLightning size={size} color="#7C3AED" strokeWidth={2} />;
      default:
        return <Sun size={size} color={color} strokeWidth={2} />;
    }
  };

  // Format time for hourly forecast (e.g., "14:00" -> "2 PM")
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    const hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours} ${ampm}`;
  };

  // Translated farming updates
  const FARMING_UPDATES = [
    {
      id: '1',
      title: tr('dashboard.farmingFeed.update1Title', 'Rice Yield Expected to Increase'),
      description: tr('dashboard.farmingFeed.update1Description', 'West Bengal farmers report positive crop growth this season.'),
      region: tr('dashboard.farmingFeed.update1Region', 'West Bengal'),
    },
    {
      id: '2',
      title: tr('dashboard.farmingFeed.update2Title', 'Drought Alert Issued'),
      description: tr('dashboard.farmingFeed.update2Description', 'Maharashtra regions facing water scarcity.'),
      region: tr('dashboard.farmingFeed.update2Region', 'Maharashtra'),
    },
    {
      id: '3',
      title: tr('dashboard.farmingFeed.update3Title', 'New Organic Farming Initiative'),
      description: tr('dashboard.farmingFeed.update3Description', 'Punjab government launches support program for organic farming.'),
      region: tr('dashboard.farmingFeed.update3Region', 'Punjab'),
    },
    {
      id: '4',
      title: tr('dashboard.farmingFeed.update4Title', 'Wheat Market Price Surge'),
      description: tr('dashboard.farmingFeed.update4Description', 'Wheat prices increase by 15% due to high demand.'),
      region: tr('dashboard.farmingFeed.update4Region', 'Haryana'),
    },
  ];

  const FARM_SUMMARY = {
    crops: tr('dashboard.crops.rice', 'Rice'),
    area: 2,
    status: tr('dashboard.farmSummary.healthy', 'Healthy'),
  };

  const handleDrawerNavigate = (screen: 'Profile' | 'CropPrediction' | 'DocumentAnalyzer' | 'CropDiseaseDetection' | 'ContactBuyer') => {
    navigation.navigate(screen);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="bg-primary px-6 pt-12 pb-8 rounded-b-3xl">
          <View className="flex-row items-center mb-4">
            <View className="flex-1">
              <View className="flex-row items-center">
                <HandHeart size={32} color="#fff" strokeWidth={2} />
                <Text className="text-white text-3xl font-bold ml-2">
                  {tr('dashboard.greeting', 'Hello Farmer!')}
                </Text>
              </View>
              <Text className="text-white/90 text-base mt-1">
                {tr('dashboard.subtitle', 'Welcome to KrishakSharthi')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsDrawerVisible(true)}
              className="bg-white/20 rounded-full w-12 h-12 items-center justify-center ml-4"
            >
              <Ionicons name="menu" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Weather Forecast */}
        <View className="px-6 mt-4">
          <Text className="text-gray-900 text-xl font-bold mb-3">
            {tr('dashboard.weather.title', "Today's Weather")}
          </Text>
          
          {isLoadingWeather ? (
            <View
              className="bg-white rounded-xl p-5 shadow-sm items-center justify-center"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 2,
                minHeight: 200,
              }}
            >
              <ActivityIndicator size="large" color="#22C55E" />
              <Text className="text-gray-600 text-base mt-3">
                {tr('dashboard.weather.loading', 'Loading weather...')}
              </Text>
            </View>
          ) : weatherError || !weatherData ? (
            <View
              className="bg-white rounded-xl p-5 shadow-sm items-center justify-center"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 2,
                minHeight: 200,
              }}
            >
              <Text className="text-gray-600 text-base mb-3">
                {tr('dashboard.weather.error', 'Unable to load weather')}
              </Text>
              <TouchableOpacity
                onPress={fetchWeather}
                className="bg-primary rounded-lg px-4 py-2"
              >
                <Text className="text-white font-semibold">
                  {tr('dashboard.weather.retry', 'Retry')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
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
              {/* Current Weather */}
              <View className="flex-row items-center mb-4">
                {getWeatherIconComponent(weatherData.current.weatherCode)}
                <View className="ml-4">
                  <Text className="text-4xl font-bold text-gray-900">
                    {localizeNumber(weatherData.current.temperature, i18n.language)}°C
                  </Text>
                  <Text className="text-gray-600 text-base">
                    {tr(`dashboard.weather.conditions.${getWeatherConditionKey(weatherData.current.weatherCode)}`, 'Partly Cloudy')}
                  </Text>
                </View>
              </View>
              
              {/* Current Weather Details */}
              <View className="flex-row justify-between pt-4 border-t border-gray-100 mb-4">
                <View className="items-center flex-1">
                  <Droplets size={32} color="#3B82F6" strokeWidth={2} />
                  <Text className="text-gray-600 text-sm mt-2">
                    {tr('dashboard.weather.precipitation', 'Precipitation')}
                  </Text>
                  <Text className="text-gray-900 text-base font-semibold">
                    {localizeNumber(weatherData.current.precipitation, i18n.language)} mm
                  </Text>
                </View>
                <View className="items-center flex-1 border-l border-gray-100">
                  <Wind size={32} color="#10B981" strokeWidth={2} />
                  <Text className="text-gray-600 text-sm mt-2">
                    {tr('dashboard.weather.humidity', 'Humidity')}
                  </Text>
                  <Text className="text-gray-900 text-base font-semibold">
                    {localizeNumber(weatherData.current.humidity, i18n.language)}%
                  </Text>
                </View>
              </View>

              {/* Hourly Forecast */}
              <View className="pt-4 border-t border-gray-100">
                <Text className="text-gray-900 text-base font-bold mb-3">
                  {tr('dashboard.weather.hourlyForecast', 'Hourly Forecast')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: 16 }}
                >
                  {weatherData.hourly.map((hour, index) => (
                    <View
                      key={index}
                      className="items-center mr-4 bg-gray-50 rounded-lg p-3"
                      style={{ minWidth: 80 }}
                    >
                      <Text className="text-gray-600 text-xs font-semibold mb-2">
                        {formatTime(hour.time)}
                      </Text>
                      {getWeatherIconComponent(hour.weatherCode, 32, '#FFA500')}
                      <Text className="text-gray-900 text-lg font-bold mt-2">
                        {localizeNumber(hour.temperature, i18n.language)}°
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <Droplets size={12} color="#3B82F6" strokeWidth={2} />
                        <Text className="text-gray-600 text-xs ml-1">
                          {localizeNumber(hour.precipitation, i18n.language)}mm
                        </Text>
                      </View>
                      <View className="flex-row items-center mt-1">
                        <Wind size={12} color="#10B981" strokeWidth={2} />
                        <Text className="text-gray-600 text-xs ml-1">
                          {localizeNumber(hour.humidity, i18n.language)}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
        </View>

        {/* Farm Summary */}
        <View className="px-6 mt-6">
          <Text className="text-gray-900 text-xl font-bold mb-3">
            {tr('dashboard.farmSummary.title', 'Farm Summary')}
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
            <View className="flex-row items-center mb-5">
              <View className="bg-green-100 rounded-full w-12 h-12 items-center justify-center mr-4">
                <Wheat size={24} color="#22C55E" strokeWidth={2} />
              </View>
              <View>
                <Text className="text-gray-600 text-sm">
                  {tr('dashboard.farmSummary.crops', 'Crops')}
                </Text>
                <Text className="text-gray-900 text-lg font-semibold">
                  {FARM_SUMMARY.crops}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center mb-5">
              <View className="bg-blue-100 rounded-full w-12 h-12 items-center justify-center mr-4">
                <Ruler size={24} color="#3B82F6" strokeWidth={2} />
              </View>
              <View>
                <Text className="text-gray-600 text-sm">
                  {tr('dashboard.farmSummary.area', 'Area')}
                </Text>
                <Text className="text-gray-900 text-lg font-semibold">
                  {localizeNumber(FARM_SUMMARY.area, i18n.language)} {tr('dashboard.farmSummary.acres', 'acres')}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="bg-yellow-100 rounded-full w-12 h-12 items-center justify-center mr-4">
                <Heart size={24} color="#EAB308" strokeWidth={2} fill="#EAB308" />
              </View>
              <View>
                <Text className="text-gray-600 text-sm">
                  {tr('dashboard.farmSummary.status', 'Status')}
                </Text>
                <Text className="text-green-600 text-lg font-semibold">
                  {tr('dashboard.farmSummary.healthy', 'Healthy')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Farming Feed */}
        <View className="px-6 mt-6">
          <Text className="text-gray-900 text-xl font-bold mb-3">
            {tr('dashboard.farmingFeed.title', 'Farming Updates')}
          </Text>
          <View>
            {FARMING_UPDATES.map((update, index) => (
              <View
                key={update.id}
                className="bg-white rounded-xl p-4 shadow-sm"
                style={{
                  marginBottom: index < FARMING_UPDATES.length - 1 ? 16 : 0,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                <View className="flex-row items-start mb-2">
                  <View className="bg-primary/10 rounded-lg px-3 py-1 flex-row items-center">
                    <MapPin size={12} color="#22C55E" strokeWidth={2} />
                    <Text className="text-primary text-xs font-semibold ml-1">
                      {update.region}
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
      </ScrollView>

      {/* Chatbot Modal */}
      <ChatbotModal
        visible={isChatbotVisible}
        onClose={() => setIsChatbotVisible(false)}
      />

      {/* Side Drawer */}
      <SideDrawer
        visible={isDrawerVisible}
        onClose={() => setIsDrawerVisible(false)}
        onNavigate={handleDrawerNavigate}
        onChatbotOpen={() => setIsChatbotVisible(true)}
        notificationCount={notificationCount}
      />
    </SafeAreaView>
  );
};

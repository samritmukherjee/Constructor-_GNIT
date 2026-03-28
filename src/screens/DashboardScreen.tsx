import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Animated,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HandHeart, Sun, Droplets, Wind, Wheat, Ruler, Heart, MapPin, Cloud, CloudRain, CloudDrizzle, CloudSnow, CloudLightning, CloudFog, Sprout, Tractor, Leaf } from 'lucide-react-native';
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
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const weatherCardScale = useRef(new Animated.Value(0.9)).current;
  const farmCardScale = useRef(new Animated.Value(0.9)).current;
  
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
    
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Animate weather and farm cards when data loads
  useEffect(() => {
    if (!isLoadingWeather) {
      Animated.parallel([
        Animated.spring(weatherCardScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(farmCardScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoadingWeather]);

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
    <View className="flex-1">
      {/* Village Sky Gradient Background */}
      <LinearGradient
        colors={['#E0F2FE', '#F0F9FF', '#F0FDF4', '#FFFBEB']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Decorative Background Elements - Sun and Clouds */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Sun Glow */}
        <View style={{
          position: 'absolute',
          top: 60,
          right: 30,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: '#FCD34D',
          opacity: 0.2,
        }} />
        {/* Cloud-like shapes */}
        <View style={{
          position: 'absolute',
          top: 150,
          left: 20,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: '#FFFFFF',
          opacity: 0.3,
        }} />
        <View style={{
          position: 'absolute',
          bottom: 100,
          right: 40,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: '#BBF7D0',
          opacity: 0.15,
        }} />
      </View>

      {/* Professional Navbar (Fixed) */}
      <View
        className="bg-white/90 backdrop-blur flex-row items-center justify-between border-b border-gray-100"
        style={{
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 12,
          paddingHorizontal: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 4,
          zIndex: 10,
        }}
      >
        <Animated.View 
          className="flex-row items-center"
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }}
        >
          <View style={{
            shadowColor: '#16A34A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 5,
            borderRadius: 14,
            backgroundColor: 'white',
          }}>
            <Image
              source={require('../../public/KrishakSarthiLogoPNG.png')}
              style={{ width: 48, height: 48, borderRadius: 14 }}
              resizeMode="contain"
            />
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text
              style={{
                color: '#16A34A',
                fontSize: 16,
                fontWeight: '600',
                letterSpacing: -0.2,
              }}
            >
              {tr('roleSelection.title', 'KrishakSarthi')}
            </Text>
            <View
              style={{
                height: 2,
                width: '100%',
                backgroundColor: '#22C55E',
                borderRadius: 1,
                marginTop: 2,
              }}
            />
          </View>
        </Animated.View>

        <TouchableOpacity
          onPress={() => setIsDrawerVisible(true)}
          style={{
            borderRadius: 14,
            backgroundColor: '#F0FDF4',
            padding: 10,
            shadowColor: '#16A34A',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Ionicons name="menu-outline" size={28} color="#16A34A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting Section - Village Theme */}
        <Animated.View 
          style={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 12,
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Sprout size={20} color="#22C55E" strokeWidth={2.5} />
            <Text 
              style={{ 
                color: '#16A34A', 
                fontSize: 14, 
                fontWeight: '700',
                letterSpacing: 0.5,
                marginLeft: 8,
                textTransform: 'uppercase'
              }}
            >
              {tr('dashboard.greeting', 'Hello Farmer!')}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Leaf size={16} color="#16A34A" strokeWidth={2.5} />
            <Text 
              style={{ 
                color: '#6B7280', 
                fontSize: 14, 
                fontWeight: '500',
                marginLeft: 8,
                lineHeight: 20,
              }}
            >
              {tr('dashboard.subtitle', 'Welcome to your smart farming assistant')}
            </Text>
          </View>
        </Animated.View>

        {/* Weather Forecast - Village Theme */}
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Sun size={24} color="#F59E0B" strokeWidth={2.5} />
            <Text 
              style={{ 
                color: '#111827', 
                fontSize: 20, 
                fontWeight: '800',
                marginLeft: 10,
                letterSpacing: -0.3,
              }}
            >
              {tr('dashboard.weather.title', "Today's Weather")}
            </Text>
          </View>

          {isLoadingWeather ? (
            <LinearGradient
              colors={['#FFFFFF', '#F0F9FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                padding: 24,
                shadowColor: '#0EA5E9',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 16,
                elevation: 5,
                minHeight: 200,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator size="large" color="#22C55E" />
              <Text className="text-gray-600 text-base mt-3">
                {tr('dashboard.weather.loading', 'Loading weather...')}
              </Text>
            </LinearGradient>
          ) : weatherError || !weatherData ? (
            <LinearGradient
              colors={['#FFFFFF', '#FEF2F2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                padding: 24,
                shadowColor: '#EF4444',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.10,
                shadowRadius: 16,
                elevation: 5,
                minHeight: 200,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text className="text-gray-600 text-base mb-3">
                {tr('dashboard.weather.error', 'Unable to load weather')}
              </Text>
              <TouchableOpacity
                onPress={fetchWeather}
                style={{
                  backgroundColor: '#22C55E',
                  borderRadius: 20,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  shadowColor: '#16A34A',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text className="text-white font-semibold">
                  {tr('dashboard.weather.retry', 'Retry')}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          ) : (
            <Animated.View style={{ transform: [{ scale: weatherCardScale }] }}>
              <LinearGradient
                colors={['#FFFFFF', '#E0F2FE', '#DBEAFE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 24,
                padding: 24,
                borderWidth: 2,
                borderColor: '#BAE6FD',
                shadowColor: '#0EA5E9',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 20,
                elevation: 6,
              }}
            >
              {/* Current Weather with Village Sky Theme */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <LinearGradient
                  colors={['#FEF3C7', '#FDE68A', '#FCD34D']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 40,
                    width: 65,
                    height: 65,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#F59E0B',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  {getWeatherIconComponent(weatherData.current.weatherCode, 34, '#F59E0B')}
                </LinearGradient>
                <View style={{ marginLeft: 14, flex: 1 }}>
                  <Text 
                    style={{ 
                      fontSize: 36, 
                      fontWeight: '900', 
                      color: '#111827',
                      letterSpacing: -1.2,
                      lineHeight: 40,
                    }}
                  >
                    {localizeNumber(weatherData.current.temperature, i18n.language)}°
                  </Text>
                  <Text 
                    style={{ 
                      fontSize: 13, 
                      fontWeight: '600', 
                      color: '#374151',
                      marginTop: 2,
                      lineHeight: 16,
                    }}
                  >
                    {tr(`dashboard.weather.conditions.${getWeatherConditionKey(weatherData.current.weatherCode)}`, 'Partly Cloudy')}
                  </Text>
                </View>
              </View>

                {/* Current Weather Details */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-around',
                paddingTop: 12,
                paddingBottom: 12,
                borderTopWidth: 2,
                borderTopColor: 'rgba(255, 255, 255, 0.5)',
                marginBottom: 12,
              }}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <View style={{
                    backgroundColor: '#DBEAFE',
                    borderRadius: 35,
                    width: 48,
                    height: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                    shadowColor: '#3B82F6',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  }}>
                    <Droplets size={22} color="#3B82F6" strokeWidth={2.5} />
                  </View>
                  <Text 
                    style={{ 
                      color: '#6B7280', 
                      fontSize: 11, 
                      fontWeight: '600',
                      marginBottom: 3,
                      textAlign: 'center',
                    }}
                  >
                    {tr('dashboard.weather.precipitation', 'Precipitation')}
                  </Text>
                  <Text 
                    style={{ 
                      color: '#111827', 
                      fontSize: 16, 
                      fontWeight: '800',
                      letterSpacing: -0.3,
                    }}
                  >
                    {localizeNumber(weatherData.current.precipitation, i18n.language)} mm
                  </Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <View style={{
                    backgroundColor: '#D1FAE5',
                    borderRadius: 35,
                    width: 48,
                    height: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                    shadowColor: '#10B981',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  }}>
                    <Wind size={22} color="#10B981" strokeWidth={2.5} />
                  </View>
                  <Text 
                    style={{ 
                      color: '#6B7280', 
                      fontSize: 11, 
                      fontWeight: '600',
                      marginBottom: 3,
                      textAlign: 'center',
                    }}
                  >
                    {tr('dashboard.weather.humidity', 'Humidity')}
                  </Text>
                  <Text 
                    style={{ 
                      color: '#111827', 
                      fontSize: 16, 
                      fontWeight: '800',
                      letterSpacing: -0.3,
                    }}
                  >
                    {localizeNumber(weatherData.current.humidity, i18n.language)}%
                  </Text>
                </View>
              </View>

                {/* Hourly Forecast */}
              <View style={{ 
                paddingTop: 12, 
                borderTopWidth: 2, 
                borderTopColor: 'rgba(255, 255, 255, 0.5)' 
              }}>
                <Text 
                  style={{ 
                    color: '#111827', 
                    fontSize: 15, 
                    fontWeight: '800',
                    marginBottom: 10,
                    letterSpacing: -0.2,
                  }}
                >
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
                      style={{
                        marginRight: 12,
                        minWidth: 85,
                        backgroundColor: 'rgba(255, 255, 255, 0.6)',
                        borderRadius: 16,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.8)',
                        alignItems: 'center',
                      }}
                    >
                      <Text 
                        style={{
                          color: '#374151',
                          fontSize: 12,
                          fontWeight: '700',
                          marginBottom: 8,
                        }}
                      >
                        {formatTime(hour.time)}
                      </Text>
                      {getWeatherIconComponent(hour.weatherCode, 32, '#F59E0B')}
                      <Text 
                        style={{
                          color: '#111827',
                          fontSize: 20,
                          fontWeight: '800',
                          marginTop: 8,
                        }}
                      >
                        {localizeNumber(hour.temperature, i18n.language)}°
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        <Droplets size={10} color="#3B82F6" strokeWidth={2} />
                        <Text 
                          style={{
                            color: '#6B7280',
                            fontSize: 12,
                            marginLeft: 4,
                          }}
                        >
                          {localizeNumber(hour.precipitation, i18n.language)}mm
                        </Text>
                      </View>
                    </View>
                  ))}
                  </ScrollView>
                </View>
              </LinearGradient>
            </Animated.View>
          )}
        </View>

        {/* Farm Summary - Village Theme */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Wheat size={24} color="#16A34A" strokeWidth={2.5} />
            <Text 
              style={{ 
                color: '#111827', 
                fontSize: 20, 
                fontWeight: '800',
                marginLeft: 10,
                letterSpacing: -0.3,
              }}
            >
              {tr('dashboard.farmSummary.title', 'Farm Summary')}
            </Text>
          </View>

          <Animated.View style={{ transform: [{ scale: farmCardScale }] }}>
            <LinearGradient
              colors={['#FFFFFF', '#F0FDF4', '#ECFDF5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                padding: 24,
                borderWidth: 2,
                borderColor: '#BBF7D0',
                shadowColor: '#22C55E',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 20,
                elevation: 6,
              }}
            >
              {/* Crop Info */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <LinearGradient
                  colors={['#22C55E', '#16A34A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 50,
                    width: 68,
                    height: 68,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 18,
                    shadowColor: '#16A34A',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 6,
                  }}
                >
                  <Wheat size={34} color="#FFFFFF" strokeWidth={2.5} />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text 
                    style={{ 
                      color: '#6B7280', 
                      fontSize: 14, 
                      fontWeight: '600',
                      marginBottom: 6,
                    }}
                  >
                    {tr('dashboard.farmSummary.crops', 'Crops')}
                  </Text>
                  <Text 
                    style={{ 
                      color: '#111827', 
                      fontSize: 22, 
                      fontWeight: '800',
                      letterSpacing: -0.5,
                      lineHeight: 28,
                    }}
                  >
                    {FARM_SUMMARY.crops}
                  </Text>
                </View>
              </View>

              {/* Area Info */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 50,
                    width: 68,
                    height: 68,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 18,
                    shadowColor: '#2563EB',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 6,
                  }}
                >
                  <Ruler size={34} color="#FFFFFF" strokeWidth={2.5} />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text 
                    style={{ 
                      color: '#6B7280', 
                      fontSize: 14, 
                      fontWeight: '600',
                      marginBottom: 6,
                    }}
                  >
                    {tr('dashboard.farmSummary.area', 'Area')}
                  </Text>
                  <Text 
                    style={{ 
                      color: '#111827', 
                      fontSize: 22, 
                      fontWeight: '800',
                      letterSpacing: -0.5,
                      lineHeight: 28,
                    }}
                  >
                    {localizeNumber(FARM_SUMMARY.area, i18n.language)} {tr('dashboard.farmSummary.acres', 'acres')}
                  </Text>
                </View>
              </View>

              {/* Status Info */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <LinearGradient
                  colors={['#EAB308', '#CA8A04']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 50,
                    width: 68,
                    height: 68,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 18,
                    shadowColor: '#CA8A04',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 6,
                  }}
                >
                  <Heart size={34} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text 
                    style={{ 
                      color: '#6B7280', 
                      fontSize: 14, 
                      fontWeight: '600',
                      marginBottom: 8,
                    }}
                  >
                    {tr('dashboard.farmSummary.status', 'Status')}
                  </Text>
                  <View style={{ 
                    backgroundColor: '#D1FAE5',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    alignSelf: 'flex-start',
                    shadowColor: '#10B981',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  }}>
                    <Text 
                      style={{ 
                        color: '#047857', 
                        fontSize: 18, 
                        fontWeight: '800',
                        letterSpacing: -0.3,
                      }}
                    >
                      {tr('dashboard.farmSummary.healthy', 'Healthy')}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Farming Feed - Village Theme */}
        <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Tractor size={24} color="#DC2626" strokeWidth={2.5} />
            <Text 
              style={{ 
                color: '#111827', 
                fontSize: 20, 
                fontWeight: '800',
                marginLeft: 10,
                letterSpacing: -0.3,
              }}
            >
              {tr('dashboard.farmingFeed.title', 'Farming Updates')}
            </Text>
          </View>

          <View>
            {FARMING_UPDATES.map((update, index) => (
              <Animated.View
                key={update.id}
                style={{
                  marginBottom: index < FARMING_UPDATES.length - 1 ? 16 : 0,
                  opacity: fadeAnim,
                }}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#FFFBEB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 20,
                    padding: 20,
                    borderWidth: 1.5,
                    borderColor: '#FDE68A',
                    shadowColor: '#F59E0B',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 4,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                    <LinearGradient
                      colors={['#22C55E', '#16A34A']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        borderRadius: 14,
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        flexDirection: 'row',
                        alignItems: 'center',
                        shadowColor: '#16A34A',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4,
                        elevation: 2,
                      }}
                    >
                      <MapPin size={13} color="#FFFFFF" strokeWidth={2.5} />
                      <Text 
                        style={{ 
                          color: '#FFFFFF', 
                          fontSize: 13, 
                          fontWeight: '800',
                          marginLeft: 6,
                        }}
                      >
                        {update.region}
                      </Text>
                    </LinearGradient>
                  </View>
                  <Text 
                    style={{ 
                      color: '#111827', 
                      fontSize: 16, 
                      fontWeight: '800',
                      marginBottom: 8,
                      lineHeight: 24,
                      letterSpacing: -0.3,
                    }}
                  >
                    {update.title}
                  </Text>
                  <Text 
                    style={{ 
                      color: '#6B7280', 
                      fontSize: 14, 
                      fontWeight: '500',
                      lineHeight: 22,
                    }}
                  >
                    {update.description}
                  </Text>
                </LinearGradient>
              </Animated.View>
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
    </View>
  );
};

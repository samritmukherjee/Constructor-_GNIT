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
  Modal,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HandHeart, Sun, Droplets, Wind, Wheat, Ruler, Heart, MapPin, Cloud, CloudRain, CloudDrizzle, CloudSnow, CloudLightning, CloudFog, Sprout, Tractor, Leaf, Moon, X, Newspaper, TrendingUp, CloudSun, Scale, Cpu, Calendar, ExternalLink, RefreshCcw, LogOut } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ChatbotModal } from '../components/ChatbotModal';
import { SideDrawer } from '../components/SideDrawer';
import { CustomAlert } from '../components/CustomAlert';
import { WeatherIcon } from '../components/WeatherIcon';
import { localizeNumber } from '../utils/numberLocalization';
import { getWeatherForCurrentLocation, WeatherData, getWeatherConditionKey, getWeatherIllustrationKey } from '../services/weather';
import { getAgriculturalNews, NewsArticle } from '../services/news';
import { auth } from '../config/firebase';
import {
  cleanupExpiredFarmingPlansForCurrentUser,
  getActiveFarmingPlansForCurrentUser,
  FarmingPlanSummary,
} from '../services/farmingPlan';

type DashboardScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Dashboard'
>;

export const DashboardScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const insets = useSafeAreaInsets();

  // Exit app confirmation state
  const [showExitAlert, setShowExitAlert] = useState(false);

  // Handle back button to show exit confirmation
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        setShowExitAlert(true);
        return true; // Prevent default back behavior
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );
  const [isChatbotVisible, setIsChatbotVisible] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [weatherError, setWeatherError] = useState(false);

  // Farming tasks state (actionable reminders)
  const [farmingPlans, setFarmingPlans] = useState<FarmingPlanSummary[]>([]);
  const [isLoadingFarmingPlans, setIsLoadingFarmingPlans] = useState(true);

  // News state
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [showArticleModal, setShowArticleModal] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const weatherCardScale = useRef(new Animated.Value(0.9)).current;
  const farmCardScale = useRef(new Animated.Value(0.9)).current;

  // Hardcoded: 2 buyers have contacted this farmer
  const notificationCount = 2;

  // Localized month names for date formatting
  const MONTH_NAMES_SHORT: Record<string, string[]> = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    hi: ['जन', 'फर', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुल', 'अग', 'सित', 'अक्टू', 'नव', 'दिस'],
    bn: ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগ', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'],
  };

  // Format ISO date to localized format (e.g., "25 জানু 2026" for Bengali)
  const formatLocalizedDate = (isoDate: string): string => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const monthNames = MONTH_NAMES_SHORT[i18n.language] || MONTH_NAMES_SHORT.en;
    const monthName = monthNames[month - 1] || monthNames[0];
    const localizedDay = localizeNumber(day, i18n.language);
    const localizedYear = localizeNumber(year, i18n.language);
    return `${localizedDay} ${monthName} ${localizedYear}`;
  };

  // Safe translation helper
  const tr = (key: string, fallback?: string, options?: Record<string, unknown>) => {
    try {
      if (!i18n || !i18n.isInitialized) {
        return fallback || key;
      }
      const translated = t(key, options as any);
      return typeof translated === 'string' && translated.length > 0
        ? translated
        : fallback || key;
    } catch (error) {
      console.error('Translation error:', error);
      return fallback || key;
    }
  };

  async function refreshFarmingPlans() {
    setIsLoadingFarmingPlans(true);
    try {
      // Only clean up and fetch if the user is signed in.
      if (auth.currentUser) {
        await cleanupExpiredFarmingPlansForCurrentUser();
        const plans = await getActiveFarmingPlansForCurrentUser({ language: i18n.language });
        setFarmingPlans(plans);
      } else {
        setFarmingPlans([]);
      }
    } catch (error) {
      console.error('Error loading farming plans:', error);
      setFarmingPlans([]);
    } finally {
      setIsLoadingFarmingPlans(false);
    }
  }

  // Fetch weather data and news on component mount
  useEffect(() => {
    fetchWeather();
    refreshFarmingPlans();

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

  // Refresh tasks whenever the dashboard comes back into focus (e.g., after creating a plan).
  useFocusEffect(
    React.useCallback(() => {
      refreshFarmingPlans();
    }, [])
  );

  // Re-fetch news when language changes
  useEffect(() => {
    if (i18n.language) {
      fetchNews();
    }
  }, [i18n.language]);

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

  const fetchNews = async (forceRefresh: boolean = false) => {
    setIsLoadingNews(true);
    try {
      const user = auth.currentUser;
      // Extract state from user display name or email
      // Expected format: "Name - State" or fallback to West Bengal
      const userState = user?.displayName?.split(' - ')[1] || 'West Bengal';

      // Get current language from i18n
      const currentLanguage = i18n.language || 'en';

      const articles = await getAgriculturalNews(userState, 3, currentLanguage, { forceRefresh });
      setNewsArticles(articles);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setIsLoadingNews(false);
    }
  };

  const openArticle = (article: NewsArticle) => {
    setSelectedArticle(article);
    setShowArticleModal(true);
  };

  const getCategoryIcon = (category: NewsArticle['category'], size: number = 16) => {
    switch (category) {
      case 'weather':
        return <CloudSun size={size} color="#3B82F6" strokeWidth={2.5} />;
      case 'market':
        return <TrendingUp size={size} color="#10B981" strokeWidth={2.5} />;
      case 'policy':
        return <Scale size={size} color="#8B5CF6" strokeWidth={2.5} />;
      case 'technology':
        return <Cpu size={size} color="#F59E0B" strokeWidth={2.5} />;
      default:
        return <Leaf size={size} color="#22C55E" strokeWidth={2.5} />;
    }
  };

  const getCategoryLabel = (category: NewsArticle['category']) => {
    switch (category) {
      case 'weather':
        return tr('dashboard.news.categories.weather', 'Weather');
      case 'market':
        return tr('dashboard.news.categories.market', 'Market');
      case 'policy':
        return tr('dashboard.news.categories.policy', 'Policy');
      case 'technology':
        return tr('dashboard.news.categories.technology', 'Technology');
      default:
        return tr('dashboard.news.categories.agriculture', 'Agriculture');
    }
  };

  const getRegionLabel = (region: string) => {
    const normalized = (region || '').trim().toLowerCase();
    if (normalized === 'west bengal' || normalized === 'wb') {
      return tr('states.westBengal', 'West Bengal');
    }
    if (normalized === 'india') {
      return tr('states.india', 'India');
    }
    return region;
  };

  const getCategoryColor = (category: NewsArticle['category']): [string, string] => {
    switch (category) {
      case 'weather': return ['#DBEAFE', '#BFDBFE'];
      case 'market': return ['#D1FAE5', '#A7F3D0'];
      case 'policy': return ['#EDE9FE', '#DDD6FE'];
      case 'technology': return ['#FEF3C7', '#FDE68A'];
      default: return ['#DCFCE7', '#BBF7D0'];
    }
  };

  // Get weather icon component based on weather code
  // Check if it's nighttime (6 PM to 6 AM)
  const isNightTime = (date: Date = new Date()) => {
    const hours = date.getHours();
    return hours >= 18 || hours < 6;
  };

  // Get weather icon component based on weather code and time of day
  const getWeatherIconComponent = (weatherCode: number, timeString?: string, size: number = 56) => {
    const checkTime = timeString ? new Date(timeString) : new Date();
    const isNight = isNightTime(checkTime);

    const key = getWeatherIllustrationKey(weatherCode, { isNight });
    return <WeatherIcon iconKey={key} size={size} />;
  };

  // Format time for hourly forecast (e.g., "14:00" -> "2 PM", "00:00" -> "12 am")
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    const hours = date.getHours();
    const isPM = hours >= 12;
    const displayHours = hours % 12 || 12;
    const ampmText = isPM
      ? tr('dashboard.weather.pm', 'PM')
      : tr('dashboard.weather.am', 'AM');
    return `${localizeNumber(displayHours, i18n.language)} ${ampmText.toLowerCase()}`;
  };

  // Get time period label based on hour of day
  const getTimePeriod = (hour: number): string => {
    if (hour >= 0 && hour <= 4) {
      return tr('dashboard.weather.night', 'night');
    } else if (hour >= 5 && hour <= 11) {
      return tr('dashboard.weather.morning', 'morning');
    } else if (hour >= 12 && hour <= 15) {
      return tr('dashboard.weather.noon', 'noon');
    } else if (hour >= 16 && hour <= 18) {
      return tr('dashboard.weather.evening', 'evening');
    } else {
      return tr('dashboard.weather.night', 'night');
    }
  };

  // News will now come from Perplexity API instead of hardcoded data

  const FARM_SUMMARY = {
    crops: tr('dashboard.crops.rice', 'Rice'),
    area: 2,
    status: tr('dashboard.farmSummary.healthy', 'Healthy'),
  };

  const handleDrawerNavigate = (screen: 'Profile' | 'CropPrediction' | 'DocumentAnalyzer' | 'CropDiseaseDetection' | 'ContactBuyer') => {
    navigation.navigate(screen);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#FFFFFF' }}>
      {/* Wallpaper Background Decoration */}
      <View
        style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: '#FEF3C7',
          opacity: 0.5,
          zIndex: 0,
        }}
      />

      {/* Navbar with Title and Subtitle */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 12,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
          zIndex: 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image
            source={require('../../public/KrishakSarthiLogoPNG.png')}
            style={{ width: 48, height: 48, marginRight: 12 }}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '800',
                color: '#111827',
                letterSpacing: -0.5,
              }}
            >
              {tr('dashboard.title', 'কৃষকসার্থী')}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: '#6B7280',
                marginTop: 2,
              }}
            >
              {tr('dashboard.subtitle', 'আপনার স্মার্ট কৃষি সহায়ক')}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setIsDrawerVisible(true)}
          style={{
            padding: 8,
          }}
        >
          <Ionicons name="menu-outline" size={28} color="#000000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        showsVerticalScrollIndicator={false}
      >

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
                colors={['#FFFFFF', '#F0F9FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#BAE6FD',
                  shadowColor: '#0EA5E9',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {/* Main Weather Icon and Condition */}
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <LinearGradient
                    colors={['#FEF3C7', '#FDE68A', '#FCD34D']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 35,
                      width: 70,
                      height: 70,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                      shadowColor: '#F59E0B',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 6,
                      elevation: 3,
                    }}
                  >
                    <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                      {getWeatherIconComponent(weatherData.current.weatherCode, undefined, 50)}
                    </View>
                  </LinearGradient>
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: '#0F172A',
                    textAlign: 'center',
                    marginBottom: 4,
                  }}>
                    {tr(`dashboard.weather.conditions.${getWeatherConditionKey(weatherData.current.weatherCode)}`, 'Partly Cloudy')}
                  </Text>
                  <Text style={{
                    fontSize: 32,
                    fontWeight: '800',
                    color: '#1E293B',
                    letterSpacing: -1,
                  }}>
                    {localizeNumber(Math.round(weatherData.current.temperature), i18n.language)}°
                  </Text>
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: '#64748B',
                    marginTop: 2,
                  }}>
                    {tr('dashboard.weather.feelsLike', 'Feels like')} {localizeNumber(Math.round(weatherData.current.temperature - 2), i18n.language)}°
                  </Text>
                </View>

                {/* Weather Info Circles */}
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  marginBottom: 14,
                }}>
                  {/* Precipitation */}
                  <View style={{ alignItems: 'center' }}>
                    <LinearGradient
                      colors={['#DBEAFE', '#BFDBFE']}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 6,
                        shadowColor: '#3B82F6',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.12,
                        shadowRadius: 4,
                        elevation: 2,
                      }}
                    >
                      <Droplets size={22} color="#2563EB" strokeWidth={2.5} />
                    </LinearGradient>
                  <Text style={{
                      fontSize: 10,
                      fontWeight: '600',
                      color: '#64748B',
                      marginBottom: 2,
                    }}>
                      {tr('dashboard.weather.precipitation', 'Precipitation')}
                    </Text>
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: '#0F172A',
                    }}>
                      {localizeNumber(weatherData.current.precipitation, i18n.language)} mm
                    </Text>
                  </View>

                  {/* Humidity */}
                  <View style={{ alignItems: 'center' }}>
                    <LinearGradient
                      colors={['#D1FAE5', '#A7F3D0']}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 6,
                        shadowColor: '#10B981',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.12,
                        shadowRadius: 4,
                        elevation: 2,
                      }}
                    >
                      <Wind size={22} color="#059669" strokeWidth={2.5} />
                    </LinearGradient>
                    <Text style={{
                      fontSize: 10,
                      fontWeight: '600',
                      color: '#64748B',
                      marginBottom: 2,
                    }}>
                      {tr('dashboard.weather.humidity', 'Humidity')}
                    </Text>
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: '#0F172A',
                    }}>
                      {localizeNumber(weatherData.current.humidity, i18n.language)}%
                    </Text>
                  </View>
                </View>

                {/* Hourly Forecast */}
                <View>
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '800',
                    color: '#0F172A',
                    marginBottom: 10,
                    letterSpacing: -0.2,
                  }}>
                    {tr('dashboard.weather.hourlyForecast', 'Hourly Forecast')}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: 10 }}
                  >
                    {weatherData.hourly.slice(0, 24).map((hour, index) => {
                      const hourDate = new Date(hour.time);
                      const hourOfDay = hourDate.getHours();
                      const timePeriod = getTimePeriod(hourOfDay);
                      return (
                        <LinearGradient
                          key={index}
                          colors={['#FFFFFF', '#F8FAFC']}
                          style={{
                            marginRight: 8,
                            minWidth: 70,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 14,
                            padding: 10,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                          }}
                        >
                          <Text style={{
                            color: '#475569',
                            fontSize: 10,
                            fontWeight: '600',
                            marginBottom: 4,
                          }}>
                            {formatTime(hour.time)}
                          </Text>
                          <Text style={{
                            color: '#9CA3AF',
                            fontSize: 8,
                            fontWeight: '500',
                            marginBottom: 8,
                            textTransform: 'capitalize',
                          }}>
                            {timePeriod}
                          </Text>
                          <View style={{ alignItems: 'center', justifyContent: 'center', height: 34, width: 34, marginBottom: 8 }}>
                            {getWeatherIconComponent(hour.weatherCode, hour.time, 32)}
                          </View>
                          <Text style={{
                            color: '#0F172A',
                            fontSize: 16,
                            fontWeight: '800',
                            marginBottom: 6,
                          }}>
                            {localizeNumber(Math.round(hour.temperature), i18n.language)}°
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Droplets size={9} color="#3B82F6" strokeWidth={2} />
                            <Text style={{
                              color: '#64748B',
                              fontSize: 10,
                              marginLeft: 2,
                              fontWeight: '600',
                            }}>
                              {localizeNumber(hour.precipitation, i18n.language)}mm
                            </Text>
                          </View>
                        </LinearGradient>
                      );
                    })}
                  </ScrollView>
                </View>
              </LinearGradient>
            </Animated.View>
          )}
        </View>

        {/* Farming Plans (Carousel) */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Calendar size={24} color="#16A34A" strokeWidth={2.5} />
              <Text
                style={{
                  color: '#111827',
                  fontSize: 20,
                  fontWeight: '800',
                  marginLeft: 10,
                  letterSpacing: -0.3,
                }}
              >
                {t('dashboard.farmingPlans.title')}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                onPress={refreshFarmingPlans}
                disabled={isLoadingFarmingPlans}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isLoadingFarmingPlans ? '#E5E7EB' : '#DCFCE7',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isLoadingFarmingPlans ? '#E5E7EB' : '#BBF7D0',
                }}
              >
                <RefreshCcw
                  size={14}
                  color={isLoadingFarmingPlans ? '#9CA3AF' : '#16A34A'}
                  strokeWidth={2.5}
                />
                <Text
                  style={{
                    marginLeft: 6,
                    color: isLoadingFarmingPlans ? '#9CA3AF' : '#166534',
                    fontSize: 12,
                    fontWeight: '800',
                  }}
                >
                  {t('dashboard.farmingPlans.refresh')}
                </Text>
              </TouchableOpacity>
              {isLoadingFarmingPlans && (
                <ActivityIndicator size="small" color="#22C55E" />
              )}
            </View>
          </View>

          {isLoadingFarmingPlans ? (
            <View
              style={{
                backgroundColor: '#F9FAFB',
                borderRadius: 20,
                padding: 30,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            >
              <ActivityIndicator size="large" color="#22C55E" />
              <Text
                style={{
                  color: '#6B7280',
                  fontSize: 14,
                  fontWeight: '600',
                  marginTop: 12,
                }}
              >
                {t('dashboard.farmingPlans.loading')}
              </Text>
            </View>
          ) : farmingPlans.length === 0 ? (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            >
              <Text style={{ color: '#111827', fontSize: 16, fontWeight: '800' }}>
                {t('dashboard.farmingPlans.emptyTitle')}
              </Text>
              <Text
                style={{
                  color: '#6B7280',
                  fontSize: 13,
                  fontWeight: '600',
                  marginTop: 6,
                  lineHeight: 18,
                }}
              >
                {t('dashboard.farmingPlans.emptyBody')}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('CropPrediction')}
                style={{
                  marginTop: 14,
                  backgroundColor: '#16A34A',
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
                  {t('dashboard.farmingPlans.createPlan')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 10 }}
            >
              {farmingPlans.map((plan) => {
                const nextLabel = plan.nextTaskDateISO && plan.nextTaskTitle
                  ? `${formatLocalizedDate(plan.nextTaskDateISO)} • ${plan.nextTaskTitle}`
                  : t('dashboard.farmingPlans.noUpcoming');

                return (
                  <LinearGradient
                    key={plan.id}
                    colors={['#FFFFFF', '#F0FDF4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 290,
                      marginRight: 12,
                      borderRadius: 18,
                      padding: 16,
                      borderWidth: 1.5,
                      borderColor: '#BBF7D0',
                      shadowColor: '#16A34A',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.08,
                      shadowRadius: 10,
                      elevation: 3,
                    }}
                  >
                    <Text style={{ color: '#111827', fontSize: 16, fontWeight: '900' }} numberOfLines={2}>
                      {plan.planTitle}
                    </Text>

                    <View style={{ marginTop: 10, gap: 6 }}>
                      <Text style={{ color: '#374151', fontSize: 12, fontWeight: '700' }}>
                        {t('dashboard.farmingPlans.planting', { date: formatLocalizedDate(plan.plantingDateISO) })}
                      </Text>
                      <Text style={{ color: '#374151', fontSize: 12, fontWeight: '700' }}>
                        {t('dashboard.farmingPlans.harvest', { date: formatLocalizedDate(plan.expectedHarvestDateISO) })}
                      </Text>
                      <Text style={{ color: '#166534', fontSize: 12, fontWeight: '900', marginTop: 2 }} numberOfLines={2}>
                        {t('dashboard.farmingPlans.nextTask', { text: nextLabel })}
                      </Text>
                      <Text style={{ color: '#166534', fontSize: 12, fontWeight: '800' }}>
                        {t('dashboard.farmingPlans.tasksNext7Days', { countText: localizeNumber(plan.nextTaskCountIn7Days || 0, i18n.language) })}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => navigation.navigate('PlanCalendar', { planId: plan.id, planTitle: plan.planTitle })}
                      style={{
                        marginTop: 14,
                        backgroundColor: '#16A34A',
                        borderRadius: 14,
                        paddingVertical: 12,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>
                        {t('dashboard.farmingPlans.viewPlan')}
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Agricultural News */}
        <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Newspaper size={24} color="#DC2626" strokeWidth={2.5} />
              <Text
                style={{
                  color: '#111827',
                  fontSize: 20,
                  fontWeight: '800',
                  marginLeft: 10,
                  letterSpacing: -0.3,
                }}
              >
                {tr('dashboard.news.title', 'Agricultural News')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                onPress={() => fetchNews(true)}
                disabled={isLoadingNews}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isLoadingNews ? '#E5E7EB' : '#DCFCE7',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isLoadingNews ? '#E5E7EB' : '#BBF7D0',
                }}
              >
                <RefreshCcw size={14} color={isLoadingNews ? '#9CA3AF' : '#16A34A'} strokeWidth={2.5} />
                <Text style={{
                  marginLeft: 6,
                  color: isLoadingNews ? '#9CA3AF' : '#166534',
                  fontSize: 12,
                  fontWeight: '800',
                }}>
                  {tr('dashboard.news.refresh', 'Refresh')}
                </Text>
              </TouchableOpacity>
              {isLoadingNews && (
                <ActivityIndicator size="small" color="#22C55E" />
              )}
            </View>
          </View>

          {isLoadingNews ? (
            <View style={{
              backgroundColor: '#F9FAFB',
              borderRadius: 20,
              padding: 40,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}>
              <ActivityIndicator size="large" color="#22C55E" />
              <Text style={{
                color: '#6B7280',
                fontSize: 14,
                fontWeight: '600',
                marginTop: 12,
              }}>
                {tr('dashboard.news.loading', 'Loading latest news...')}
              </Text>
            </View>
          ) : newsArticles.length === 0 ? (
            <View style={{
              backgroundColor: '#FEF2F2',
              borderRadius: 20,
              padding: 30,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#FECACA',
            }}>
              <Newspaper size={40} color="#DC2626" strokeWidth={1.5} />
              <Text style={{
                color: '#991B1B',
                fontSize: 16,
                fontWeight: '700',
                marginTop: 12,
              }}>
                {tr('dashboard.news.empty', 'No news available')}
              </Text>
              <TouchableOpacity
                onPress={() => fetchNews(true)}
                style={{
                  backgroundColor: '#DC2626',
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  marginTop: 16,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                  {tr('dashboard.news.retry', 'Retry')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {newsArticles.map((article, index) => (
                <Animated.View
                  key={article.id}
                  style={{
                    marginBottom: index < newsArticles.length - 1 ? 16 : 0,
                    opacity: fadeAnim,
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => openArticle(article)}
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
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                        <LinearGradient
                          colors={getCategoryColor(article.category)}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            flexDirection: 'row',
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 2,
                            elevation: 1,
                          }}
                        >
                          {getCategoryIcon(article.category, 14)}
                          <Text
                            style={{
                              color: '#111827',
                              fontSize: 11,
                              fontWeight: '800',
                              marginLeft: 5,
                            }}
                          >
                            {getCategoryLabel(article.category)}
                          </Text>
                        </LinearGradient>

                        <LinearGradient
                          colors={['#22C55E', '#16A34A']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            flexDirection: 'row',
                            alignItems: 'center',
                            shadowColor: '#16A34A',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.15,
                            shadowRadius: 2,
                            elevation: 1,
                          }}
                        >
                          <MapPin size={12} color="#FFFFFF" strokeWidth={2.5} />
                          <Text
                            style={{
                              color: '#FFFFFF',
                              fontSize: 11,
                              fontWeight: '800',
                              marginLeft: 5,
                            }}
                          >
                            {getRegionLabel(article.region)}
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
                        {article.title}
                      </Text>

                      <Text
                        style={{
                          color: '#6B7280',
                          fontSize: 14,
                          fontWeight: '500',
                          lineHeight: 22,
                          marginBottom: 12,
                        }}
                        numberOfLines={3}
                      >
                        {article.summary}
                      </Text>

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Calendar size={14} color="#9CA3AF" strokeWidth={2} />
                          <Text style={{
                            color: '#9CA3AF',
                            fontSize: 13,
                            fontWeight: '600',
                            marginLeft: 5,
                          }}>
                            {article.source}
                          </Text>
                        </View>

                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#F59E0B',
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                        }}>
                          <Text style={{
                            color: '#FFFFFF',
                            fontSize: 11,
                            fontWeight: '800',
                            marginRight: 4,
                          }}>
                            {tr('dashboard.news.readMore', 'Read More')}
                          </Text>
                          <ExternalLink size={11} color="#FFFFFF" strokeWidth={2.5} />
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          )}
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

      {/* Full Article Modal */}
      <Modal
        visible={showArticleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowArticleModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}>
          <View style={{
            flex: 1,
            marginTop: 60,
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
          }}>
            {selectedArticle && (
              <>
                {/* Modal Header */}
                <LinearGradient
                  colors={['#F59E0B', '#F97316', '#EA580C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderTopLeftRadius: 30,
                    borderTopRightRadius: 30,
                    paddingHorizontal: 20,
                    paddingTop: 20,
                    paddingBottom: 24,
                    shadowColor: '#F59E0B',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Newspaper size={24} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={{
                        color: '#FFFFFF',
                        fontSize: 18,
                        fontWeight: '800',
                        marginLeft: 10,
                        letterSpacing: -0.3,
                      }}>
                        {tr('dashboard.news.fullArticle', 'Full Article')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowArticleModal(false)}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: 20,
                        padding: 8,
                      }}
                    >
                      <X size={20} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>

                  {/* Category and Region Tags */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <View style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    }}>
                      {getCategoryIcon(selectedArticle.category, 14)}
                      <Text style={{
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: '800',
                        marginLeft: 5,
                      }}>
                        {getCategoryLabel(selectedArticle.category)}
                      </Text>
                    </View>

                    <View style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    }}>
                      <MapPin size={12} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={{
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: '800',
                        marginLeft: 5,
                      }}>
                        {getRegionLabel(selectedArticle.region)}
                      </Text>
                    </View>

                    <View style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    }}>
                      <Calendar size={12} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={{
                        color: '#FFFFFF',
                        fontSize: 11,
                        fontWeight: '700',
                        marginLeft: 5,
                      }}>
                        {localizeNumber(selectedArticle.publishedAt, i18n.language)}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>

                {/* Modal Content */}
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Title */}
                  <Text style={{
                    color: '#111827',
                    fontSize: 24,
                    fontWeight: '800',
                    lineHeight: 32,
                    marginBottom: 16,
                    letterSpacing: -0.5,
                  }}>
                    {selectedArticle.title}
                  </Text>

                  {/* Source */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    backgroundColor: '#F3F4F6',
                    borderRadius: 12,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}>
                    <Newspaper size={18} color="#6B7280" strokeWidth={2} />
                    <Text style={{
                      color: '#6B7280',
                      fontSize: 15,
                      fontWeight: '600',
                      marginLeft: 8,
                    }}>
                      {tr('dashboard.news.source', 'Source')}: {selectedArticle.source}
                    </Text>
                  </View>

                  {/* Summary */}
                  <View style={{
                    backgroundColor: '#FFF7ED',
                    borderLeftWidth: 4,
                    borderLeftColor: '#F59E0B',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 24,
                  }}>
                    <Text style={{
                      color: '#92400E',
                      fontSize: 13,
                      fontWeight: '800',
                      letterSpacing: 0.5,
                      marginBottom: 8,
                    }}>
                      {tr('dashboard.news.summary', 'Summary')}
                    </Text>
                    <Text style={{
                      color: '#78350F',
                      fontSize: 17,
                      fontWeight: '600',
                      lineHeight: 26,
                    }}>
                      {selectedArticle.summary}
                    </Text>
                  </View>

                  {/* Full Content */}
                  <Text style={{
                    color: '#374151',
                    fontSize: 18,
                    fontWeight: '500',
                    lineHeight: 30,
                    textAlign: 'justify',
                  }}>
                    {selectedArticle.fullContent}
                  </Text>

                  {/* Footer */}
                  <View style={{
                    marginTop: 32,
                    paddingTop: 20,
                    borderTopWidth: 1,
                    borderTopColor: '#E5E7EB',
                  }}>
                    <Text style={{
                      color: '#9CA3AF',
                      fontSize: 12,
                      fontWeight: '600',
                      textAlign: 'center',
                    }}>
                      {tr('dashboard.news.footer', 'Stay informed with the latest agricultural news')}
                    </Text>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Exit App Confirmation Alert */}
      <CustomAlert
        visible={showExitAlert}
        type="warning"
        icon={LogOut}
        title={t('exitApp.title')}
        message={t('exitApp.message')}
        buttons={[
          {
            text: t('exitApp.cancel'),
            style: 'cancel',
            onPress: () => setShowExitAlert(false),
          },
          {
            text: t('exitApp.confirm'),
            style: 'destructive',
            onPress: () => BackHandler.exitApp(),
          },
        ]}
        onClose={() => setShowExitAlert(false)}
      />
    </View>
  );
};

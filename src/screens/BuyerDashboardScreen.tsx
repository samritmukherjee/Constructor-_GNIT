import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloudSun, Cpu, Leaf, MapPin, Menu, Newspaper, RefreshCcw, Scale, TrendingUp, Users, X, Sun, Droplets, Wind } from 'lucide-react-native';
import { WeatherIcon } from '../components/WeatherIcon';
import { getWeatherForCurrentLocation, WeatherData, getWeatherConditionKey, getWeatherIllustrationKey } from '../services/weather';
import MovingBackgroundCircle from '../components/MovingBackgroundCircle';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { BuyerSideDrawer } from '../components/BuyerSideDrawer';
import { localizeNumber } from '../utils/numberLocalization';
import { getAgriculturalNews, NewsArticle } from '../services/news';
import { getBuyerMarketDeals } from '../services/products';
import { auth } from '../config/firebase';

type BuyerDashboardNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'BuyerDashboard'
>;

export const BuyerDashboardScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<BuyerDashboardNavigationProp>(); const insets = useSafeAreaInsets();
  const [drawerVisible, setDrawerVisible] = useState(false);

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [weatherError, setWeatherError] = useState(false);
  const weatherCardScale = useRef(new Animated.Value(0.9)).current;

  // News state
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [showArticleModal, setShowArticleModal] = useState(false);

  // Unread deals/notifications
  const [unreadDealsCount, setUnreadDealsCount] = useState(0);

  // Prevent navigating back to auth (or exiting) from dashboard
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => true;
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const tr = (key: string, fallback: string) => {
    try {
      return i18n.exists(key) ? (t(key) as string) : fallback;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  useEffect(() => {
    if (!isLoadingWeather) {
      Animated.spring(weatherCardScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
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

  const isNightTime = (date: Date = new Date()) => {
    const hours = date.getHours();
    return hours >= 18 || hours < 6;
  };

  const getWeatherIconComponent = (weatherCode: number, timeString?: string, size: number = 56) => {
    const checkTime = timeString ? new Date(timeString) : new Date();
    const isNight = isNightTime(checkTime);
    const key = getWeatherIllustrationKey(weatherCode, { isNight });
    return <WeatherIcon iconKey={key} size={size} />;
  };

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    const hours = date.getHours();
    const isPM = hours >= 12;
    const displayHours = hours % 12 || 12;
    const ampmText = isPM ? 'PM' : 'AM';
    return `${localizeNumber(displayHours, i18n.language)} ${ampmText.toLowerCase()}`;
  };

  const getTimePeriod = (hour: number): string => {
    if (hour >= 0 && hour <= 4) return tr('dashboard.weather.night', 'night');
    else if (hour >= 5 && hour <= 11) return tr('dashboard.weather.morning', 'morning');
    else if (hour >= 12 && hour <= 15) return tr('dashboard.weather.noon', 'noon');
    else if (hour >= 16 && hour <= 18) return tr('dashboard.weather.evening', 'evening');
    else return tr('dashboard.weather.night', 'night');
  };

  // Localized month names for date formatting
  const MONTH_NAMES_SHORT: Record<string, string[]> = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    hi: ['जन', 'फर', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुल', 'अग', 'सित', 'अक्टू', 'नव', 'दिस'],
    bn: ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগ', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'],
  };

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

  const fetchNews = async (forceRefresh: boolean = false) => {
    setIsLoadingNews(true);
    try {
      const user = auth.currentUser;
      const userState = user?.displayName?.includes(' - ')
        ? user.displayName.split(' - ')[1]
        : 'West Bengal';
      const currentLanguage = i18n.language || 'en';

      const articles = await getAgriculturalNews(userState || 'West Bengal', 3, currentLanguage, { forceRefresh });
      setNewsArticles(articles);
    } catch (error) {
      console.error('Error fetching buyer news:', error);
      setNewsArticles([]);
    } finally {
      setIsLoadingNews(false);
    }
  };

  useEffect(() => {
    fetchNews(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (i18n.language) {
      fetchNews(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  // Track unread deals count
  useFocusEffect(
    React.useCallback(() => {
      const loadUnreadCount = async () => {
        try {
          const user = auth.currentUser;
          if (user) {
            const deals = await getBuyerMarketDeals(user.uid);
            const unreadCount = deals.filter((d) => d.buyerSeen === false).length;
            setUnreadDealsCount(unreadCount);
          }
        } catch (error) {
          console.error('Error loading unread count:', error);
        }
      };
      loadUnreadCount();
    }, [])
  );

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

  const getCategoryColor = (category: NewsArticle['category']): [string, string] => {
    switch (category) {
      case 'weather': return ['#DBEAFE', '#BFDBFE'];
      case 'market': return ['#D1FAE5', '#A7F3D0'];
      case 'policy': return ['#EDE9FE', '#DDD6FE'];
      case 'technology': return ['#FEF3C7', '#FDE68A'];
      default: return ['#DCFCE7', '#BBF7D0'];
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



  // Available crops
  const AVAILABLE_CROPS = [
    {
      id: '1',
      name: tr('buyerDashboard.crops.rice', 'Rice'),
      price: 40,
      location: tr('buyerDashboard.locations.nadia', 'Nadia, WB'),
      icon: '🌾',
    },
    {
      id: '2',
      name: tr('buyerDashboard.crops.wheat', 'Wheat'),
      price: 35,
      location: tr('buyerDashboard.locations.punjab', 'Punjab'),
      icon: '🌾',
    },
    {
      id: '3',
      name: tr('buyerDashboard.crops.potato', 'Potato'),
      price: 25,
      location: tr('buyerDashboard.locations.bihar', 'Bihar'),
      icon: '🥔',
    },
    {
      id: '4',
      name: tr('buyerDashboard.crops.tomato', 'Tomato'),
      price: 30,
      location: tr('buyerDashboard.locations.maharashtra', 'Maharashtra'),
      icon: '🍅',
    },
  ];

  // Market summary stats
  const MARKET_SUMMARY = {
    activeSellers: 120,
    availableCrops: tr('buyerDashboard.summary.availableCropsValue', 'Rice, Wheat, Potato'),
    averagePrice: 38,
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Village Sky Gradient Background */}
      {/* Clean Background with hint of blue */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }]}>
        <LinearGradient
          colors={['#FFFFFF', '#F0F9FF', '#E0F2FE']}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Moving Background Circles */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <MovingBackgroundCircle size={250} speed={15} color="#3B82F6" opacity={0.05} />
        <MovingBackgroundCircle size={180} speed={25} color="#60A5FA" opacity={0.08} />
        <MovingBackgroundCircle size={300} speed={10} color="#BFDBFE" opacity={0.06} />
      </View>



      {/* Header with Menu */}
      {/* Header with Menu */}
      <View style={{
        paddingTop: Math.max(insets.top, 12) + 12,
        paddingBottom: 16,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            source={require('../../public/KrishakSarthiLogoPNG.png')}
            style={{ width: 32, height: 32, marginRight: 12 }}
            resizeMode="contain"
          />
          <View>
            <Text style={{ color: '#111827', fontSize: 20, fontWeight: '800' }}>
              {tr('roleSelection.title', 'KrishakSarthi')}
            </Text>
            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
              {tr('buyerDashboard.subtitle', 'Connecting you with fresh produce')}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setDrawerVisible(true)}
          style={{
            backgroundColor: '#F9FAFB',
            borderRadius: 12,
            padding: 10,
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}
          activeOpacity={0.7}
        >
          <Menu size={24} color="#111827" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        showsVerticalScrollIndicator={false}
      >

        {/* Weather Forecast */}
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
                borderWidth: 1,
                borderColor: '#E0F2FE',
                minHeight: 200,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator size="large" color="#22C55E" />
              <Text style={{ color: '#4B5563', fontSize: 16, marginTop: 12 }}>
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
                borderWidth: 1,
                borderColor: '#FECACA',
                minHeight: 200,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#4B5563', fontSize: 16, marginBottom: 12 }}>
                {tr('dashboard.weather.error', 'Unable to load weather')}
              </Text>
              <TouchableOpacity
                onPress={fetchWeather}
                style={{
                  backgroundColor: '#22C55E',
                  borderRadius: 20,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  {tr('dashboard.weather.retry', 'Retry')}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          ) : (
            <Animated.View style={{ transform: [{ scale: weatherCardScale }] }}>
              <LinearGradient
                colors={['#E0F2FE', '#BFDBFE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 24,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: '#BFDBFE',
                }}
              >
                {/* Main Weather Icon and Condition */}
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <LinearGradient
                    colors={['#FFFFFF', '#F8FAFC']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 40,
                      width: 80,
                      height: 80,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                      shadowColor: '#94A3B8',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                      elevation: 3,
                      borderWidth: 1,
                      borderColor: '#F1F5F9',
                    }}
                  >
                    <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                      {getWeatherIconComponent(weatherData.current.weatherCode, undefined, 50)}
                    </View>
                  </LinearGradient>
                  <Text style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: '#334155',
                    textAlign: 'center',
                    marginBottom: 6,
                    letterSpacing: -0.2,
                  }}>
                    {tr(`dashboard.weather.conditions.${getWeatherConditionKey(weatherData.current.weatherCode)}`, 'Partly Cloudy')}
                  </Text>
                  <Text style={{
                    fontSize: 42,
                    fontWeight: '800',
                    color: '#0F172A',
                    letterSpacing: -1.5,
                  }}>
                    {localizeNumber(Math.round(weatherData.current.temperature), i18n.language)}°
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '500',
                    color: '#64748B',
                    marginTop: 4,
                  }}>
                    {tr('dashboard.weather.feelsLike', 'Feels like')} {localizeNumber(Math.round(weatherData.current.temperature - 2), i18n.language)}°
                  </Text>
                </View>

                {/* Weather Info Circles */}
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  marginBottom: 20,
                  backgroundColor: 'rgba(255, 255, 255, 0.4)',
                  borderRadius: 16,
                  paddingVertical: 16,
                  marginHorizontal: 4,
                }}>
                  {/* Precipitation */}
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 8,
                        shadowColor: '#CBD5E1',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 2,
                      }}
                    >
                      <Droplets size={20} color="#3B82F6" strokeWidth={2.5} />
                    </View>
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
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 8,
                        shadowColor: '#CBD5E1',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 2,
                      }}
                    >
                      <Wind size={20} color="#059669" strokeWidth={2.5} />
                    </View>
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
                            borderColor: 'rgba(255,255,255,0.6)',
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

        {/* Latest News */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>
              {tr('buyerDashboard.news.title', 'Latest Agricultural News')}
            </Text>
            <TouchableOpacity
              onPress={() => fetchNews(true)}
              activeOpacity={0.8}
              disabled={isLoadingNews}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isLoadingNews ? '#E5E7EB' : '#BBF7D0',
                backgroundColor: '#FFFFFF',
              }}
            >
              <RefreshCcw size={14} color={isLoadingNews ? '#9CA3AF' : '#16A34A'} strokeWidth={2.5} />
              <Text style={{
                marginLeft: 6,
                color: isLoadingNews ? '#9CA3AF' : '#166534',
                fontSize: 12,
                fontWeight: '800',
              }}>
                {tr('buyerDashboard.news.refresh', 'Refresh')}
              </Text>
              {isLoadingNews && (
                <View style={{ marginLeft: 8 }}>
                  <ActivityIndicator size="small" color="#22C55E" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {isLoadingNews ? (
            <View style={{
              backgroundColor: '#F9FAFB',
              borderRadius: 20,
              padding: 32,
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
                {tr('buyerDashboard.news.loading', 'Loading latest news...')}
              </Text>
            </View>
          ) : newsArticles.length === 0 ? (
            <View style={{
              backgroundColor: '#FEF2F2',
              borderRadius: 20,
              padding: 26,
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
                textAlign: 'center',
              }}>
                {tr('buyerDashboard.news.empty', 'No news available')}
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
                  {tr('buyerDashboard.news.retry', 'Retry')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {newsArticles.map((article, index) => (
                <TouchableOpacity
                  key={article.id}
                  activeOpacity={0.85}
                  onPress={() => openArticle(article)}
                  style={{ marginBottom: index < newsArticles.length - 1 ? 16 : 0 }}
                >
                  <LinearGradient
                    colors={['#FFFFFF', '#FFFBEB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 20,
                      padding: 18,
                      borderWidth: 1.5,
                      borderColor: '#FDE68A',
                      shadowColor: '#F59E0B',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.1,
                      shadowRadius: 12,
                      elevation: 4,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
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
                        }}
                      >
                        {getCategoryIcon(article.category, 14)}
                        <Text style={{
                          color: '#111827',
                          fontSize: 11,
                          fontWeight: '800',
                          marginLeft: 5,
                        }}>
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
                        }}
                      >
                        <MapPin size={13} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={{
                          color: '#FFFFFF',
                          fontSize: 11,
                          fontWeight: '800',
                          marginLeft: 5,
                        }}>
                          {getRegionLabel(article.region || '')}
                        </Text>
                      </LinearGradient>
                    </View>

                    <Text style={{ color: '#111827', fontSize: 16, fontWeight: '900', marginBottom: 8 }}>
                      {article.title}
                    </Text>
                    <Text style={{ color: '#6B7280', fontSize: 13, fontWeight: '700', marginBottom: 10 }}>
                      {formatLocalizedDate(article.publishedAt)} • {article.source}
                    </Text>
                    <Text style={{ color: '#6B7280', fontSize: 14, lineHeight: 20 }} numberOfLines={3}>
                      {article.summary}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>


      </ScrollView>

      {/* Full Article Modal */}
      <Modal
        visible={showArticleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowArticleModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            maxHeight: '85%',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900', flex: 1, paddingRight: 12 }} numberOfLines={2}>
                {selectedArticle?.title || tr('buyerDashboard.news.article', 'News')}
              </Text>
              <Pressable
                onPress={() => setShowArticleModal(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} color="#111827" strokeWidth={2.5} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {selectedArticle?.category && (
                <LinearGradient
                  colors={getCategoryColor(selectedArticle.category)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  {getCategoryIcon(selectedArticle.category, 14)}
                  <Text style={{ color: '#111827', fontSize: 11, fontWeight: '800', marginLeft: 5 }}>
                    {getCategoryLabel(selectedArticle.category)}
                  </Text>
                </LinearGradient>
              )}

              {selectedArticle?.region && (
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
                  }}
                >
                  <MapPin size={13} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800', marginLeft: 5 }}>
                    {getRegionLabel(selectedArticle.region)}
                  </Text>
                </LinearGradient>
              )}
            </View>

            <Text style={{ color: '#6B7280', fontSize: 13, fontWeight: '700', marginTop: 10 }}>
              {selectedArticle?.publishedAt ? formatLocalizedDate(selectedArticle.publishedAt) : ''}
              {selectedArticle?.source ? ` • ${selectedArticle.source}` : ''}
            </Text>

            <ScrollView
              style={{ marginTop: 14 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={{ color: '#374151', fontSize: 14, lineHeight: 22, fontWeight: '600' }}>
                {selectedArticle?.fullContent || selectedArticle?.summary || ''}
              </Text>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Side Drawer */}
      <BuyerSideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onNavigate={(screen) => {
          setDrawerVisible(false);
          navigation.navigate(screen);
        }}
        unreadCount={unreadDealsCount}
      />
    </View>
  );
};
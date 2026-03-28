import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingBag, TrendingUp, Package, MapPin, Phone, Users, Leaf } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Dropdown } from '../components/Dropdown';
import { LANGUAGES } from '../constants/data';
import { localizeNumber } from '../utils/numberLocalization';

type BuyerDashboardNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'BuyerDashboard'
>;

export const BuyerDashboardScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<BuyerDashboardNavigationProp>(); const insets = useSafeAreaInsets(); const [selectedLanguage, setSelectedLanguage] = useState(i18n.language || 'en');

  // Handle language change
  const handleLanguageChange = (value: string | { label: string; value: string }) => {
    try {
      const valueString = typeof value === 'string' ? value : value.value;
      const selectedLang = LANGUAGES.find((lang) => {
        try {
          return t(lang.labelKey) === valueString;
        } catch {
          return lang.value.toUpperCase() === valueString;
        }
      });
      if (selectedLang) {
        setSelectedLanguage(selectedLang.value);
        // Save language preference (which also changes the language)
        import('../i18n/i18n').then(({ saveLanguage }) => {
          saveLanguage(selectedLang.value);
        });
      }
    } catch (error) {
      console.error('Language change error:', error);
    }
  };

  const tr = (key: string, fallback: string) => {
    try {
      return i18n.exists(key) ? (t(key) as string) : fallback;
    } catch {
      return fallback;
    }
  };

  // Market updates translated
  const MARKET_UPDATES = [
    {
      id: '1',
      title: tr('buyerDashboard.marketFeed.update1Title', 'Rice prices increased in West Bengal'),
      description: tr('buyerDashboard.marketFeed.update1Description', 'Market demand for rice has surged by 20% this month.'),
      region: tr('buyerDashboard.marketFeed.update1Region', 'West Bengal'),
    },
    {
      id: '2',
      title: tr('buyerDashboard.marketFeed.update2Title', 'Fresh vegetables available from local farmers'),
      description: tr('buyerDashboard.marketFeed.update2Description', 'Seasonal vegetables ready for bulk purchase.'),
      region: tr('buyerDashboard.marketFeed.update2Region', 'Punjab'),
    },
    {
      id: '3',
      title: tr('buyerDashboard.marketFeed.update3Title', 'Organic wheat harvest completed'),
      description: tr('buyerDashboard.marketFeed.update3Description', 'Premium quality organic wheat available at competitive prices.'),
      region: tr('buyerDashboard.marketFeed.update3Region', 'Haryana'),
    },
  ];

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
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Professional Navbar (Fixed) */}
      <View
        className="bg-white px-4 py-3 flex-row items-center justify-between border-b border-gray-100 shadow-sm"
        style={{
          paddingTop: Math.max(insets.top, 12),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 3,
          zIndex: 10,
        }}
      >
        <View className="flex-row items-center">
          <Image
            source={require('../../public/KrishakSarthiLogoPNG.png')}
            style={{ width: 40, height: 40, borderRadius: 8 }}
            resizeMode="contain"
          />
        </View>

        <TouchableOpacity
          className="p-2"
        >
          <Ionicons name="person-circle-outline" size={32} color="#16A34A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting Section */}
        <View className="px-6 py-6 bg-white">
          <Text className="text-gray-500 text-sm font-medium uppercase tracking-wider">
            {tr('buyerDashboard.greeting', 'Hello Buyer!')}
          </Text>
          <Text className="text-gray-900 text-3xl font-bold mt-2 mb-1 leading-tight" style={{ lineHeight: 44 }}>
            {tr('roleSelection.title', 'KrishakSarthi')}
          </Text>
          <Text className="text-gray-600 text-base mt-2">
            {tr('buyerDashboard.subtitle', 'Connecting you with fresh produce')}
          </Text>
        </View>

        {/* Language Selector */}
        <View className="px-6 mt-4">
          <Dropdown
            label={tr('buyerDashboard.language', 'Language')}
            placeholder={tr('buyerDashboard.languagePlaceholder', 'Select language')}
            value={
              LANGUAGES.find((l) => l.value === selectedLanguage)
                ? (() => {
                  try {
                    const lang = LANGUAGES.find((l) => l.value === selectedLanguage);
                    return lang ? t(lang.labelKey) : '';
                  } catch {
                    return '';
                  }
                })()
                : ''
            }
            options={LANGUAGES.map((lang) => {
              try {
                return t(lang.labelKey);
              } catch {
                return lang.value.toUpperCase();
              }
            })}
            onSelect={handleLanguageChange}
          />
        </View>

        {/* Market Summary */}
        <View className="px-6 mt-6">
          <Text className="text-gray-900 text-xl font-bold mb-3">
            {tr('buyerDashboard.summary.title', 'Market Summary')}
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
                <Users size={24} color="#16A34A" strokeWidth={2} />
              </View>
              <View>
                <Text className="text-gray-600 text-sm">
                  {tr('buyerDashboard.summary.activeSellers', 'Active Sellers')}
                </Text>
                <Text className="text-gray-900 text-lg font-semibold">
                  {localizeNumber(MARKET_SUMMARY.activeSellers, i18n.language)}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center mb-5">
              <View className="bg-blue-100 rounded-full w-12 h-12 items-center justify-center mr-4">
                <Leaf size={24} color="#3B82F6" strokeWidth={2} />
              </View>
              <View className="flex-1">
                <Text className="text-gray-600 text-sm">
                  {tr('buyerDashboard.summary.availableCrops', 'Available Crops')}
                </Text>
                <Text className="text-gray-900 text-base font-semibold">
                  {MARKET_SUMMARY.availableCrops}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="bg-yellow-100 rounded-full w-12 h-12 items-center justify-center mr-4">
                <TrendingUp size={24} color="#EAB308" strokeWidth={2} />
              </View>
              <View>
                <Text className="text-gray-600 text-sm">
                  {tr('buyerDashboard.summary.averagePrice', 'Average Price')}
                </Text>
                <Text className="text-gray-900 text-lg font-semibold">
                  ₹{localizeNumber(MARKET_SUMMARY.averagePrice, i18n.language)}/
                  {tr('buyerDashboard.summary.perKg', 'kg')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-6 mt-6">
          <Text className="text-gray-900 text-xl font-bold mb-3">
            {tr('buyerDashboard.quickActions.title', 'Quick Actions')}
          </Text>
          <View className="flex-row justify-between">
            <TouchableOpacity
              onPress={() => navigation.navigate('ViewAllCrops')}
              className="bg-white rounded-xl p-4 flex-1 mr-2 shadow-sm items-center"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 2,
              }}
              activeOpacity={0.7}
            >
              <View className="bg-green-100 rounded-full w-12 h-12 items-center justify-center mb-2">
                <Package size={24} color="#16A34A" strokeWidth={2} />
              </View>
              <Text className="text-gray-900 text-sm font-semibold text-center">
                {tr('buyerDashboard.quickActions.viewAllCrops', 'View All Crops')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('ContactFarmer')}
              className="bg-white rounded-xl p-4 flex-1 ml-2 shadow-sm items-center"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 2,
              }}
              activeOpacity={0.7}
            >
              <View className="bg-blue-100 rounded-full w-12 h-12 items-center justify-center mb-2">
                <Phone size={24} color="#3B82F6" strokeWidth={2} />
              </View>
              <Text className="text-gray-900 text-sm font-semibold text-center">
                {tr('buyerDashboard.quickActions.contactFarmer', 'Contact Farmer')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Available Crops */}
        <View className="px-6 mt-6">
          <Text className="text-gray-900 text-xl font-bold mb-3">
            {tr('buyerDashboard.availableCrops.title', 'Available Crops')}
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {AVAILABLE_CROPS.map((crop, index) => {
              return (
                <View
                  key={crop.id}
                  className="bg-white rounded-xl p-4 shadow-sm mb-4"
                  style={{
                    width: '48%',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  <View className="items-center mb-3">
                    <Text className="text-4xl mb-2">{crop.icon}</Text>
                    <Text className="text-gray-900 text-base font-bold">
                      {crop.name}
                    </Text>
                  </View>
                  <View className="border-t border-gray-100 pt-3">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-gray-600 text-xs">
                        {tr('buyerDashboard.availableCrops.price', 'Price')}
                      </Text>
                      <Text className="text-green-600 text-sm font-bold">
                        ₹{localizeNumber(crop.price, i18n.language)}/
                        {tr('buyerDashboard.summary.perKg', 'kg')}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <MapPin size={12} color="#9CA3AF" strokeWidth={2} />
                      <Text className="text-gray-500 text-xs ml-1" numberOfLines={1}>
                        {crop.location}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Market Feed */}
        <View className="px-6 mt-6">
          <Text className="text-gray-900 text-xl font-bold mb-3">
            {tr('buyerDashboard.marketFeed.title', 'Market Updates')}
          </Text>
          <View>
            {MARKET_UPDATES.map((update, index) => {
              return (
                <View
                  key={update.id}
                  className="bg-white rounded-xl p-4 shadow-sm"
                  style={{
                    marginBottom: index < MARKET_UPDATES.length - 1 ? 16 : 0,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  <View className="flex-row items-start mb-2">
                    <View className="bg-green-600/10 rounded-lg px-3 py-1 flex-row items-center">
                      <MapPin size={12} color="#16A34A" strokeWidth={2} />
                      <Text className="text-green-600 text-xs font-semibold ml-1">
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
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dropdown } from '../components/Dropdown';
import { LANGUAGES } from '../constants/data';
import { RootStackParamList } from '../navigation/AppNavigator';

type RoleSelectionNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RoleSelection'
>;

export const RoleSelectionScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<RoleSelectionNavigationProp>();
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language || 'en');
  const insets = useSafeAreaInsets();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const tr = (key: string, fallback: string) => {
    try {
      return i18n.exists(key) ? (t(key) as string) : fallback;
    } catch {
      return fallback;
    }
  };

  // Animation on mount
  useEffect(() => {
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

  // Change language when selected
  useEffect(() => {
    if (selectedLanguage) {
      i18n.changeLanguage(selectedLanguage);
      // Save language preference
      import('../i18n/i18n').then(({ saveLanguage }) => {
        saveLanguage(selectedLanguage);
      });
    }
  }, [selectedLanguage]);

  const handleRoleSelection = (role: 'farmer' | 'buyer') => {
    if (role === 'farmer') {
      navigation.navigate('SignIn');
    } else {
      navigation.navigate('BuyerSignIn');
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ 
        padding: 24, 
        paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 60 : 40),
        paddingBottom: Math.max(insets.bottom, 24) + 24,
        justifyContent: 'center',
        minHeight: '100%'
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="mb-12 items-center" style={{ marginTop: 20 }}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }}
        >
          <Text 
            className="text-4xl font-bold text-gray-900 mb-2 text-center"
            style={{ 
              lineHeight: 56,
              paddingTop: 8,
              paddingBottom: 8,
              includeFontPadding: false,
            }}
          >
            {tr('roleSelection.title', 'KrishakSarthi')}
          </Text>
        </Animated.View>
        <Text className="text-gray-600 text-base text-center" style={{ marginTop: 4 }}>
          {tr('roleSelection.subtitle', 'Select your role to continue')}
        </Text>
      </View>

      {/* Language Selection */}
      <View className="mb-8">
        <Dropdown
          label={tr('roleSelection.language', 'Language')}
          placeholder={tr('roleSelection.languagePlaceholder', 'Select language')}
          value={
            LANGUAGES.find((l) => l.value === selectedLanguage)
              ? t(
                  LANGUAGES.find(
                    (l) => l.value === selectedLanguage
                  )!.labelKey
                )
              : ''
          }
          options={LANGUAGES.map((lang) => t(lang.labelKey))}
          onSelect={(value) => {
            const selectedLang = LANGUAGES.find(
              (lang) => t(lang.labelKey) === value
            );
            if (selectedLang) {
              setSelectedLanguage(selectedLang.value);
            }
          }}
        />
      </View>

      {/* Role Cards */}
      <View className="mb-6">
        {/* Farmer Card */}
        <TouchableOpacity
          onPress={() => handleRoleSelection('farmer')}
          className="bg-white border-2 border-primary rounded-xl p-6 mb-4 shadow-sm"
          activeOpacity={0.7}
        >
          <View className="items-center">
            <View className="bg-primary/10 rounded-full w-20 h-20 items-center justify-center mb-4">
              <Text className="text-4xl">🌾</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-2">
              {tr('roleSelection.farmer', 'Farmer')}
            </Text>
            <Text className="text-gray-600 text-center text-base">
              {tr('roleSelection.farmerDescription', 'Access farming tools, predictions, and resources')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Buyer Card */}
        <TouchableOpacity
          onPress={() => handleRoleSelection('buyer')}
          className="bg-white border-2 border-green-600 rounded-xl p-6 shadow-sm"
          activeOpacity={0.7}
        >
          <View className="items-center">
            <View className="bg-green-600/10 rounded-full w-20 h-20 items-center justify-center mb-4">
              <Text className="text-4xl">🛒</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-2">
              {tr('roleSelection.buyer', 'Buyer')}
            </Text>
            <Text className="text-gray-600 text-center text-base">
              {tr('roleSelection.buyerDescription', 'Connect with farmers and purchase agricultural products')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Footer Note */}
      <View className="mt-8">
        <Text className="text-gray-500 text-sm text-center">
          {tr('roleSelection.footerNote', 'Choose the role that best describes you')}
        </Text>
      </View>
    </ScrollView>
  );
};
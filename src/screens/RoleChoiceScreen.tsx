import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Sprout, ShoppingBasket } from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import { RootStackParamList } from '../navigation/AppNavigator';
import { TouchableOpacity } from 'react-native';

type RoleChoiceNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RoleChoice'
>;

export const RoleChoiceScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<RoleChoiceNavigationProp>();
  const insets = useSafeAreaInsets();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const [farmerScale] = useState(new Animated.Value(1));
  const [buyerScale] = useState(new Animated.Value(1));

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

  const handleRoleSelection = (role: 'farmer' | 'buyer') => {
    navigation.navigate('SignUp', { role });
  };

  const handlePressIn = (scale: Animated.Value) => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (scale: Animated.Value) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View className="flex-1">
      {/* Gradient Background */}
      <LinearGradient
        colors={['#F0FDF4', '#FFFFFF', '#F0FDF4']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Decorative Background Circles */}
      <View style={StyleSheet.absoluteFill}>
        <View style={{
          position: 'absolute',
          top: -100,
          right: -50,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: '#BBF7D0',
          opacity: 0.2,
        }} />
        <View style={{
          position: 'absolute',
          bottom: -80,
          left: -60,
          width: 250,
          height: 250,
          borderRadius: 125,
          backgroundColor: '#86EFAC',
          opacity: 0.15,
        }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: Math.max(insets.top, 50) + 20,
          paddingBottom: Math.max(insets.bottom, 24) + 20,
          justifyContent: 'center',
          minHeight: '100%'
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <View className="mb-8">
          <BackButton />
        </View>

        {/* Header Section */}
        <View className="items-center" style={{ marginBottom: 40 }}>
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
              alignItems: 'center',
            }}
          >
            {/* Title */}
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <Text
                className="font-bold text-gray-900 text-center"
                style={{
                  fontSize: 32,
                  lineHeight: 42,
                  letterSpacing: -0.5,
                  paddingVertical: 8,
                }}
              >
                {tr('roleChoice.title', 'Choose Your Role')}
              </Text>
              <View style={{
                height: 4,
                width: 60,
                backgroundColor: '#22C55E',
                borderRadius: 2,
                marginTop: 8,
              }} />
            </View>
            
            {/* Subtitle */}
            <Text 
              className="text-gray-500 text-center"
              style={{ 
                fontSize: 15,
                lineHeight: 22,
                maxWidth: 300,
                marginTop: 8,
              }}
            >
              {tr('roleChoice.subtitle', 'Select how you want to use KrishakSarthi')}
            </Text>
          </Animated.View>
        </View>

        {/* Role Cards */}
        <View style={{ gap: 20, marginBottom: 24 }}>
          {/* Farmer Card */}
          <Animated.View style={{ transform: [{ scale: farmerScale }] }}>
            <Pressable
              onPress={() => handleRoleSelection('farmer')}
              onPressIn={() => handlePressIn(farmerScale)}
              onPressOut={() => handlePressOut(farmerScale)}
            >
              <LinearGradient
                colors={['#FFFFFF', '#F0FDF4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 50,
                  paddingVertical: 24,
                  paddingHorizontal: 28,
                  borderWidth: 2,
                  borderColor: '#22C55E',
                  shadowColor: '#22C55E',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.15,
                  shadowRadius: 16,
                  elevation: 5,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <LinearGradient
                  colors={['#22C55E', '#16A34A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 40,
                    width: 70,
                    height: 70,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 20,
                    shadowColor: '#16A34A',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 6,
                  }}
                >
                  <Sprout size={36} color="#FFFFFF" strokeWidth={2.5} />
                </LinearGradient>
                
                <View style={{ flex: 1 }}>
                  <Text 
                    className="font-bold text-gray-900"
                    style={{ fontSize: 22, lineHeight: 28, marginBottom: 6, letterSpacing: 0.3 }}
                  >
                    {tr('roleChoice.farmer', 'Farmer')}
                  </Text>
                  
                  <Text 
                    className="text-gray-600"
                    style={{ fontSize: 13, lineHeight: 19 }}
                  >
                    {tr('roleChoice.farmerDescription', 'Access farming tools, predictions, and resources')}
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Buyer Card */}
          <Animated.View style={{ transform: [{ scale: buyerScale }] }}>
            <Pressable
              onPress={() => handleRoleSelection('buyer')}
              onPressIn={() => handlePressIn(buyerScale)}
              onPressOut={() => handlePressOut(buyerScale)}
            >
              <LinearGradient
                colors={['#FFFFFF', '#ECFDF5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 50,
                  paddingVertical: 24,
                  paddingHorizontal: 28,
                  borderWidth: 2,
                  borderColor: '#10B981',
                  shadowColor: '#10B981',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.15,
                  shadowRadius: 16,
                  elevation: 5,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 40,
                    width: 70,
                    height: 70,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 20,
                    shadowColor: '#059669',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 6,
                  }}
                >
                  <ShoppingBasket size={36} color="#FFFFFF" strokeWidth={2.5} />
                </LinearGradient>
                
                <View style={{ flex: 1 }}>
                  <Text 
                    className="font-bold text-gray-900"
                    style={{ fontSize: 22, lineHeight: 28, marginBottom: 6, letterSpacing: 0.3 }}
                  >
                    {tr('roleChoice.buyer', 'Buyer')}
                  </Text>
                  
                  <Text 
                    className="text-gray-600"
                    style={{ fontSize: 13, lineHeight: 19 }}
                  >
                    {tr('roleChoice.buyerDescription', 'Connect with farmers and purchase agricultural products')}
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
};

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrendingUp, MapPin, Users, Leaf, Menu } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { BuyerSideDrawer } from '../components/BuyerSideDrawer';
import { localizeNumber } from '../utils/numberLocalization';

type BuyerDashboardNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'BuyerDashboard'
>;

export const BuyerDashboardScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<BuyerDashboardNavigationProp>(); const insets = useSafeAreaInsets();
  const [drawerVisible, setDrawerVisible] = useState(false);

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
    <View style={{ flex: 1 }}>
      {/* Village Sky Gradient Background */}
      <LinearGradient
        colors={['#E0F2FE', '#F0F9FF', '#F0FDF4', '#FFFBEB']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Decorative Background Elements */}
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



      {/* Header with Menu */}
      <View style={{
        paddingTop: Math.max(insets.top, 12) + 12,
        paddingBottom: 16,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
            backgroundColor: '#F3F4F6',
            borderRadius: 12,
            padding: 10,
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

        {/* Market Summary */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 16 }}>
            {tr('buyerDashboard.summary.title', 'Market Summary')}
          </Text>
          <LinearGradient
            colors={['#FFFFFF', '#F8FAFC']}
            style={{
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              shadowColor: '#3B82F6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <LinearGradient
                colors={['#DBEAFE', '#BFDBFE']}
                style={{
                  borderRadius: 16,
                  width: 56,
                  height: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}
              >
                <Users size={28} color="#3B82F6" strokeWidth={2.5} />
              </LinearGradient>
              <View>
                <Text style={{ color: '#6B7280', fontSize: 13, fontWeight: '600' }}>
                  {tr('buyerDashboard.summary.activeSellers', 'Active Sellers')}
                </Text>
                <Text style={{ color: '#111827', fontSize: 22, fontWeight: '800', marginTop: 2 }}>
                  {localizeNumber(MARKET_SUMMARY.activeSellers, i18n.language)}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <LinearGradient
                colors={['#D1FAE5', '#A7F3D0']}
                style={{
                  borderRadius: 16,
                  width: 56,
                  height: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}
              >
                <Leaf size={28} color="#10B981" strokeWidth={2.5} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#6B7280', fontSize: 13, fontWeight: '600' }}>
                  {tr('buyerDashboard.summary.availableCrops', 'Available Crops')}
                </Text>
                <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                  {MARKET_SUMMARY.availableCrops}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LinearGradient
                colors={['#FEF3C7', '#FDE68A']}
                style={{
                  borderRadius: 16,
                  width: 56,
                  height: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}
              >
                <TrendingUp size={28} color="#F59E0B" strokeWidth={2.5} />
              </LinearGradient>
              <View>
                <Text style={{ color: '#6B7280', fontSize: 13, fontWeight: '600' }}>
                  {tr('buyerDashboard.summary.averagePrice', 'Average Price')}
                </Text>
                <Text style={{ color: '#111827', fontSize: 22, fontWeight: '800', marginTop: 2 }}>
                  ₹{localizeNumber(MARKET_SUMMARY.averagePrice, i18n.language)}/
                  {tr('buyerDashboard.summary.perKg', 'kg')}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Available Crops */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 16 }}>
            {tr('buyerDashboard.availableCrops.title', 'Available Crops')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {AVAILABLE_CROPS.map((crop, index) => {
              return (
                <LinearGradient
                  key={crop.id}
                  colors={['#FFFFFF', '#F8FAFC']}
                  style={{
                    width: '48%',
                    borderRadius: 18,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    shadowColor: '#3B82F6',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  <View style={{ alignItems: 'center', marginBottom: 12 }}>
                    <View style={{
                      backgroundColor: '#F0F9FF',
                      borderRadius: 16,
                      width: 64,
                      height: 64,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                    }}>
                      <Text style={{ fontSize: 36 }}>{crop.icon}</Text>
                    </View>
                    <Text style={{ color: '#111827', fontSize: 16, fontWeight: '800' }}>
                      {crop.name}
                    </Text>
                  </View>
                  <View style={{
                    borderTopWidth: 1,
                    borderTopColor: '#F3F4F6',
                    paddingTop: 12,
                  }}>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}>
                      <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '600' }}>
                        {tr('buyerDashboard.availableCrops.price', 'Price')}
                      </Text>
                      <Text style={{ color: '#10B981', fontSize: 15, fontWeight: '800' }}>
                        ₹{localizeNumber(crop.price, i18n.language)}/
                        {tr('buyerDashboard.summary.perKg', 'kg')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MapPin size={13} color="#9CA3AF" strokeWidth={2} />
                      <Text style={{
                        color: '#6B7280',
                        fontSize: 12,
                        marginLeft: 4,
                        fontWeight: '600',
                        flex: 1,
                      }} numberOfLines={1}>
                        {crop.location}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              );
            })}
          </View>
        </View>

        {/* Market Feed */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 16 }}>
            {tr('buyerDashboard.marketFeed.title', 'Market Updates')}
          </Text>
          <View>
            {MARKET_UPDATES.map((update, index) => {
              return (
                <LinearGradient
                  key={update.id}
                  colors={['#FFFFFF', '#F8FAFC']}
                  style={{
                    borderRadius: 18,
                    padding: 18,
                    marginBottom: index < MARKET_UPDATES.length - 1 ? 16 : 0,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    shadowColor: '#10B981',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <LinearGradient
                      colors={['#D1FAE5', '#A7F3D0']}
                      style={{
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <MapPin size={13} color="#10B981" strokeWidth={2.5} />
                      <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>
                        {update.region}
                      </Text>
                    </LinearGradient>
                  </View>
                  <Text style={{ color: '#111827', fontSize: 16, fontWeight: '800', marginBottom: 8 }}>
                    {update.title}
                  </Text>
                  <Text style={{ color: '#6B7280', fontSize: 14, lineHeight: 20 }}>
                    {update.description}
                  </Text>
                </LinearGradient>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Side Drawer */}
      <BuyerSideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onNavigate={(screen) => {
          setDrawerVisible(false);
          navigation.navigate(screen);
        }}
      />
    </View>
  );
};
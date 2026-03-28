import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { MapPin, Phone, User } from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { localizeNumber } from '../utils/numberLocalization';

type ViewAllCropsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ViewAllCrops'
>;

export const ViewAllCropsScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<ViewAllCropsNavigationProp>();

  const tr = (key: string, fallback: string) => {
    try {
      return i18n.exists(key) ? (t(key) as string) : fallback;
    } catch {
      return fallback;
    }
  };

  // Hardcoded crops data with farmer information
  const ALL_CROPS = [
    {
      id: '1',
      name: tr('viewAllCrops.crops.rice', 'Rice'),
      price: 40,
      quantity: 500,
      location: tr('viewAllCrops.locations.nadia', 'Nadia, West Bengal'),
      farmerName: tr('viewAllCrops.farmers.ramesh', 'Ramesh Kumar'),
      phone: '9876543210',
      icon: '🌾',
      quality: tr('viewAllCrops.quality.premium', 'Premium'),
    },
    {
      id: '2',
      name: tr('viewAllCrops.crops.wheat', 'Wheat'),
      price: 35,
      quantity: 800,
      location: tr('viewAllCrops.locations.punjab', 'Ludhiana, Punjab'),
      farmerName: tr('viewAllCrops.farmers.gurpreet', 'Gurpreet Singh'),
      phone: '9988776655',
      icon: '🌾',
      quality: tr('viewAllCrops.quality.organic', 'Organic'),
    },
    {
      id: '3',
      name: tr('viewAllCrops.crops.potato', 'Potato'),
      price: 25,
      quantity: 1000,
      location: tr('viewAllCrops.locations.bihar', 'Patna, Bihar'),
      farmerName: tr('viewAllCrops.farmers.rajesh', 'Rajesh Sharma'),
      phone: '9123456789',
      icon: '🥔',
      quality: tr('viewAllCrops.quality.fresh', 'Fresh'),
    },
    {
      id: '4',
      name: tr('viewAllCrops.crops.tomato', 'Tomato'),
      price: 30,
      quantity: 600,
      location: tr('viewAllCrops.locations.maharashtra', 'Nashik, Maharashtra'),
      farmerName: tr('viewAllCrops.farmers.suresh', 'Suresh Patil'),
      phone: '9765432108',
      icon: '🍅',
      quality: tr('viewAllCrops.quality.fresh', 'Fresh'),
    },
    {
      id: '5',
      name: tr('viewAllCrops.crops.onion', 'Onion'),
      price: 28,
      quantity: 700,
      location: tr('viewAllCrops.locations.maharashtra', 'Nashik, Maharashtra'),
      farmerName: tr('viewAllCrops.farmers.amit', 'Amit Desai'),
      phone: '9834567890',
      icon: '🧅',
      quality: tr('viewAllCrops.quality.premium', 'Premium'),
    },
    {
      id: '6',
      name: tr('viewAllCrops.crops.sugarcane', 'Sugarcane'),
      price: 45,
      quantity: 1200,
      location: tr('viewAllCrops.locations.up', 'Lucknow, Uttar Pradesh'),
      farmerName: tr('viewAllCrops.farmers.vijay', 'Vijay Yadav'),
      phone: '9456789012',
      icon: '🎋',
      quality: tr('viewAllCrops.quality.premium', 'Premium'),
    },
    {
      id: '7',
      name: tr('viewAllCrops.crops.cotton', 'Cotton'),
      price: 55,
      quantity: 400,
      location: tr('viewAllCrops.locations.gujarat', 'Ahmedabad, Gujarat'),
      farmerName: tr('viewAllCrops.farmers.bharat', 'Bharat Patel'),
      phone: '9687654321',
      icon: '☁️',
      quality: tr('viewAllCrops.quality.organic', 'Organic'),
    },
    {
      id: '8',
      name: tr('viewAllCrops.crops.corn', 'Corn'),
      price: 32,
      quantity: 550,
      location: tr('viewAllCrops.locations.karnataka', 'Bangalore, Karnataka'),
      farmerName: tr('viewAllCrops.farmers.krishna', 'Krishna Reddy'),
      phone: '9845678901',
      icon: '🌽',
      quality: tr('viewAllCrops.quality.fresh', 'Fresh'),
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="bg-green-600 px-6 pt-12 pb-6 rounded-b-3xl">
          <View className="mb-4">
            <BackButton />
          </View>
          <Text className="text-white text-3xl font-bold">
            {tr('viewAllCrops.title', 'All Available Crops')}
          </Text>
          <Text className="text-white/90 text-base mt-1">
            {tr('viewAllCrops.subtitle', 'Browse and connect with farmers')}
          </Text>
        </View>

        {/* Crops List */}
        <View className="px-6 mt-6">
          {ALL_CROPS.map((crop, index) => {
            return (
              <View
                key={crop.id}
                className="bg-white rounded-xl p-4 shadow-sm mb-4"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
              {/* Crop Header */}
              <View className="flex-row items-center mb-3">
                <Text className="text-4xl mr-3">{crop.icon}</Text>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-900 text-xl font-bold">
                      {crop.name}
                    </Text>
                    <View className="bg-green-100 px-3 py-1 rounded-full">
                      <Text className="text-green-600 text-xs font-semibold">
                        {crop.quality}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Price & Quantity */}
              <View className="flex-row justify-between mb-3 pb-3 border-b border-gray-100">
                <View>
                  <Text className="text-gray-600 text-xs mb-1">
                    {tr('viewAllCrops.price', 'Price')}
                  </Text>
                  <Text className="text-green-600 text-lg font-bold">
                    ₹{localizeNumber(crop.price, i18n.language)}/
                    {tr('viewAllCrops.perKg', 'kg')}
                  </Text>
                </View>
                <View>
                  <Text className="text-gray-600 text-xs mb-1">
                    {tr('viewAllCrops.available', 'Available')}
                  </Text>
                  <Text className="text-gray-900 text-lg font-bold">
                    {localizeNumber(crop.quantity, i18n.language)} {tr('viewAllCrops.kg', 'kg')}
                  </Text>
                </View>
              </View>

              {/* Farmer Info */}
              <View className="mb-3">
                <View className="flex-row items-center mb-2">
                  <User size={16} color="#6B7280" strokeWidth={2} />
                  <Text className="text-gray-600 text-xs ml-2">
                    {tr('viewAllCrops.farmer', 'Farmer')}
                  </Text>
                </View>
                <Text className="text-gray-900 text-base font-semibold ml-6">
                  {crop.farmerName}
                </Text>
              </View>

              {/* Location */}
              <View className="mb-3">
                <View className="flex-row items-center">
                  <MapPin size={16} color="#6B7280" strokeWidth={2} />
                  <Text className="text-gray-600 text-sm ml-2">
                    {crop.location}
                  </Text>
                </View>
              </View>

              {/* Contact Button */}
              <TouchableOpacity
                className="bg-green-600 rounded-lg py-3 flex-row items-center justify-center"
                activeOpacity={0.7}
              >
                <Phone size={18} color="#fff" strokeWidth={2} />
                <Text className="text-white text-base font-semibold ml-2">
                  {tr('viewAllCrops.contact', 'Contact')} - {crop.phone}
                </Text>
              </TouchableOpacity>
            </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
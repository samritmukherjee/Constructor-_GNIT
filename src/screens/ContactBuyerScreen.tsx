import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Alert,
} from 'react-native';
import { ArrowLeft, Phone, MessageCircle, Mail, User, MapPin, Bell } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type ContactBuyerNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ContactBuyer'
>;

interface BuyerContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  hasNotification: boolean;
}

export const ContactBuyerScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<ContactBuyerNavigationProp>();
  // Hardcoded: 2 buyers have contacted this farmer
  const [notifications] = useState(2);

  const tr = (key: string, fallback: string) => {
    try {
      return i18n.exists(key) ? (t(key) as string) : fallback;
    } catch {
      return fallback;
    }
  };

  // Hardcoded buyer contacts with notifications
  const BUYER_CONTACTS: BuyerContact[] = [
    {
      id: '1',
      name: tr('contactBuyer.buyers.name1', 'Wholesale Market Delhi'),
      phone: '+91 9876543210',
      email: 'delhi@wholesale.com',
      address: tr('contactBuyer.buyers.address1', 'Azadpur Mandi, Delhi'),
      description: tr('contactBuyer.buyers.desc1', 'Large wholesale buyer for grains and vegetables'),
      hasNotification: true, // This buyer contacted the farmer
    },
    {
      id: '2',
      name: tr('contactBuyer.buyers.name2', 'Organic Foods Mumbai'),
      phone: '+91 9988776655',
      email: 'mumbai@organicfoods.com',
      address: tr('contactBuyer.buyers.address2', 'Vashi Market, Mumbai'),
      description: tr('contactBuyer.buyers.desc2', 'Organic produce buyer with premium rates'),
      hasNotification: true, // This buyer contacted the farmer
    },
    {
      id: '3',
      name: tr('contactBuyer.buyers.name3', 'Fresh Mart Kolkata'),
      phone: '+91 9123456789',
      email: 'kolkata@freshmart.com',
      address: tr('contactBuyer.buyers.address3', 'Kolkata, West Bengal'),
      description: tr('contactBuyer.buyers.desc3', 'Regular buyer for fresh vegetables and fruits'),
      hasNotification: false, // This buyer has not contacted yet
    },
  ];

  const handlePhoneCall = (phone: string) => {
    const phoneNumber = phone.replace(/\s+/g, '');
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        tr('contactBuyer.phoneError', 'Unable to make phone call')
      );
    });
  };

  const handleSMS = (phone: string) => {
    const phoneNumber = phone.replace(/\s+/g, '');
    Linking.openURL(`sms:${phoneNumber}`).catch(() => {
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        tr('contactBuyer.smsError', 'Unable to send SMS')
      );
    });
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        tr('contactBuyer.emailError', 'Unable to send email')
      );
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="bg-primary px-6 pt-12 pb-6 rounded-b-3xl">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mb-4"
          >
            <View className="flex-row items-center">
              <ArrowLeft size={24} color="#fff" strokeWidth={2} />
              <Text className="text-white text-lg font-medium ml-2">
                {tr('contactBuyer.back', 'Back')}
              </Text>
            </View>
          </TouchableOpacity>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-white text-3xl font-bold">
                {tr('contactBuyer.title', 'Contact Buyer')}
              </Text>
              <Text className="text-white/90 text-base mt-1">
                {tr('contactBuyer.subtitle', 'Connect with interested buyers')}
              </Text>
            </View>
            {notifications > 0 && (
              <View className="bg-orange-500 rounded-full w-12 h-12 items-center justify-center">
                <Bell size={24} color="#fff" strokeWidth={2} />
                <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-6 h-6 items-center justify-center">
                  <Text className="text-white text-xs font-bold">{notifications}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Info Card */}
        <View className="px-6 mt-6">
          <View
            className="bg-green-50 rounded-xl p-4 mb-6"
            style={{
              borderLeftWidth: 4,
              borderLeftColor: '#22C55E',
            }}
          >
            <Text className="text-green-900 text-base font-semibold mb-2">
              {tr('contactBuyer.infoTitle', 'New Buyer Requests')}
            </Text>
            <Text className="text-green-700 text-sm leading-5">
              {tr('contactBuyer.infoText', 'You have buyer inquiries! Connect with buyers looking for your crops. Orange notification badges show active requests.')}
            </Text>
          </View>
        </View>

        {/* Buyer Contact Cards */}
        <View className="px-6">
          <Text className="text-gray-900 text-xl font-bold mb-4">
            {tr('contactBuyer.interestedBuyers', 'Interested Buyers')}
          </Text>

          {BUYER_CONTACTS.map((buyer) => {
            return (
              <View
                key={buyer.id}
                className="bg-white rounded-xl p-5 shadow-sm mb-4"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 2,
                  borderWidth: buyer.hasNotification ? 2 : 0,
                  borderColor: buyer.hasNotification ? '#FB923C' : 'transparent',
                }}
              >
                {/* Notification Badge */}
                {buyer.hasNotification && (
                  <View className="absolute -top-2 -right-2 bg-orange-500 rounded-full w-8 h-8 items-center justify-center z-10">
                    <Bell size={16} color="#fff" strokeWidth={2} />
                  </View>
                )}

                {/* Buyer Name */}
                <View className="flex-row items-center mb-3">
                  <View className="bg-primary/10 rounded-full w-12 h-12 items-center justify-center mr-3">
                    <User size={24} color="#22C55E" strokeWidth={2} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 text-lg font-bold">
                      {buyer.name}
                    </Text>
                    <Text className="text-gray-600 text-sm">
                      {buyer.description}
                    </Text>
                  </View>
                </View>

                {/* Address */}
                <View className="flex-row items-center mb-3 ml-1">
                  <MapPin size={16} color="#6B7280" strokeWidth={2} />
                  <Text className="text-gray-600 text-sm ml-2">
                    {buyer.address}
                  </Text>
                </View>

                {/* Contact Buttons */}
                <View className="space-y-2">
                  {/* Phone */}
                  <TouchableOpacity
                    onPress={() => handlePhoneCall(buyer.phone)}
                    className="bg-primary rounded-lg py-3 flex-row items-center justify-center mb-2"
                    activeOpacity={0.7}
                  >
                    <Phone size={18} color="#fff" strokeWidth={2} />
                    <Text className="text-white text-base font-semibold ml-2">
                      {tr('contactBuyer.call', 'Call')} - {buyer.phone}
                    </Text>
                  </TouchableOpacity>

                  {/* SMS */}
                  <TouchableOpacity
                    onPress={() => handleSMS(buyer.phone)}
                    className="bg-blue-600 rounded-lg py-3 flex-row items-center justify-center mb-2"
                    activeOpacity={0.7}
                  >
                    <MessageCircle size={18} color="#fff" strokeWidth={2} />
                    <Text className="text-white text-base font-semibold ml-2">
                      {tr('contactBuyer.sms', 'Send SMS')}
                    </Text>
                  </TouchableOpacity>

                  {/* Email */}
                  <TouchableOpacity
                    onPress={() => handleEmail(buyer.email)}
                    className="bg-gray-600 rounded-lg py-3 flex-row items-center justify-center"
                    activeOpacity={0.7}
                  >
                    <Mail size={18} color="#fff" strokeWidth={2} />
                    <Text className="text-white text-base font-semibold ml-2">
                      {tr('contactBuyer.email', 'Email')} - {buyer.email}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
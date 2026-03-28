import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Alert,
} from 'react-native';
import { ArrowLeft, Phone, MessageCircle, Mail, User, MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type ContactFarmerNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ContactFarmer'
>;

export const ContactFarmerScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<ContactFarmerNavigationProp>();

  const tr = (key: string, fallback: string) => {
    try {
      return i18n.exists(key) ? (t(key) as string) : fallback;
    } catch {
      return fallback;
    }
  };

  // Hardcoded support contact information
  const SUPPORT_CONTACTS = [
    {
      id: '1',
      name: tr('contactFarmer.support.name1', 'Farmer Support Center'),
      phone: '+91 9876543210',
      email: 'support@krishaksarthi.com',
      address: tr('contactFarmer.support.address1', 'Kolkata, West Bengal'),
      description: tr('contactFarmer.support.desc1', 'Main support center for buyer-farmer connections'),
    },
    {
      id: '2',
      name: tr('contactFarmer.support.name2', 'Regional Helpline'),
      phone: '+91 9988776655',
      email: 'regional@krishaksarthi.com',
      address: tr('contactFarmer.support.address2', 'Delhi, NCR'),
      description: tr('contactFarmer.support.desc2', 'Regional support for North India'),
    },
    {
      id: '3',
      name: tr('contactFarmer.support.name3', 'Customer Care'),
      phone: '+91 9123456789',
      email: 'care@krishaksarthi.com',
      address: tr('contactFarmer.support.address3', 'Mumbai, Maharashtra'),
      description: tr('contactFarmer.support.desc3', '24/7 customer care for immediate assistance'),
    },
  ];

  const handlePhoneCall = (phone: string) => {
    const phoneNumber = phone.replace(/\s+/g, '');
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert(
        tr('contactFarmer.error', 'Error'),
        tr('contactFarmer.phoneError', 'Unable to make phone call')
      );
    });
  };

  const handleSMS = (phone: string) => {
    const phoneNumber = phone.replace(/\s+/g, '');
    Linking.openURL(`sms:${phoneNumber}`).catch(() => {
      Alert.alert(
        tr('contactFarmer.error', 'Error'),
        tr('contactFarmer.smsError', 'Unable to send SMS')
      );
    });
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert(
        tr('contactFarmer.error', 'Error'),
        tr('contactFarmer.emailError', 'Unable to send email')
      );
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="bg-green-600 px-6 pt-12 pb-6 rounded-b-3xl">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mb-4"
          >
            <View className="flex-row items-center">
              <ArrowLeft size={24} color="#fff" strokeWidth={2} />
              <Text className="text-white text-lg font-medium ml-2">
                {tr('contactFarmer.back', 'Back')}
              </Text>
            </View>
          </TouchableOpacity>
          <Text className="text-white text-3xl font-bold">
            {tr('contactFarmer.title', 'Contact Farmer')}
          </Text>
          <Text className="text-white/90 text-base mt-1">
            {tr('contactFarmer.subtitle', 'Get in touch with our support team')}
          </Text>
        </View>

        {/* Info Card */}
        <View className="px-6 mt-6">
          <View
            className="bg-blue-50 rounded-xl p-4 mb-6"
            style={{
              borderLeftWidth: 4,
              borderLeftColor: '#3B82F6',
            }}
          >
            <Text className="text-blue-900 text-base font-semibold mb-2">
              {tr('contactFarmer.infoTitle', 'How to Connect')}
            </Text>
            <Text className="text-blue-700 text-sm leading-5">
              {tr('contactFarmer.infoText', 'Contact our support team to get connected with farmers. We help facilitate direct communication between buyers and farmers.')}
            </Text>
          </View>
        </View>

        {/* Contact Cards */}
        <View className="px-6">
          <Text className="text-gray-900 text-xl font-bold mb-4">
            {tr('contactFarmer.supportTeam', 'Support Team')}
          </Text>

          {SUPPORT_CONTACTS.map((contact) => {
            return (
              <View
                key={contact.id}
                className="bg-white rounded-xl p-5 shadow-sm mb-4"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
              {/* Contact Name */}
              <View className="flex-row items-center mb-3">
                <View className="bg-green-100 rounded-full w-12 h-12 items-center justify-center mr-3">
                  <User size={24} color="#16A34A" strokeWidth={2} />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 text-lg font-bold">
                    {contact.name}
                  </Text>
                  <Text className="text-gray-600 text-sm">
                    {contact.description}
                  </Text>
                </View>
              </View>

              {/* Address */}
              <View className="flex-row items-center mb-3 ml-1">
                <MapPin size={16} color="#6B7280" strokeWidth={2} />
                <Text className="text-gray-600 text-sm ml-2">
                  {contact.address}
                </Text>
              </View>

              {/* Contact Buttons */}
              <View className="space-y-2">
                {/* Phone */}
                <TouchableOpacity
                  onPress={() => handlePhoneCall(contact.phone)}
                  className="bg-green-600 rounded-lg py-3 flex-row items-center justify-center mb-2"
                  activeOpacity={0.7}
                >
                  <Phone size={18} color="#fff" strokeWidth={2} />
                  <Text className="text-white text-base font-semibold ml-2">
                    {tr('contactFarmer.call', 'Call')} - {contact.phone}
                  </Text>
                </TouchableOpacity>

                {/* SMS */}
                <TouchableOpacity
                  onPress={() => handleSMS(contact.phone)}
                  className="bg-blue-600 rounded-lg py-3 flex-row items-center justify-center mb-2"
                  activeOpacity={0.7}
                >
                  <MessageCircle size={18} color="#fff" strokeWidth={2} />
                  <Text className="text-white text-base font-semibold ml-2">
                    {tr('contactFarmer.sms', 'SMS')}
                  </Text>
                </TouchableOpacity>

                {/* Email */}
                <TouchableOpacity
                  onPress={() => handleEmail(contact.email)}
                  className="bg-purple-600 rounded-lg py-3 flex-row items-center justify-center"
                  activeOpacity={0.7}
                >
                  <Mail size={18} color="#fff" strokeWidth={2} />
                  <Text className="text-white text-base font-semibold ml-2">
                    {tr('contactFarmer.email', 'Email')}
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
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { User, Sprout, FileText, Leaf, MessageCircle, ShoppingCart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface SideDrawerProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: 'Profile' | 'CropPrediction' | 'DocumentAnalyzer' | 'CropDiseaseDetection' | 'ContactBuyer') => void;
  onChatbotOpen: () => void;
  notificationCount?: number;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  visible,
  onClose,
  onNavigate,
  onChatbotOpen,
  notificationCount = 0,
}) => {
  const { t, i18n } = useTranslation();

  const tr = (key: string, fallback: string) => {
    try {
      if (!i18n || !i18n.isInitialized) {
        return fallback;
      }
      return t(key) || fallback;
    } catch {
      return fallback;
    }
  };

  const handleNavigate = (screen: 'Profile' | 'CropPrediction' | 'DocumentAnalyzer' | 'CropDiseaseDetection' | 'ContactBuyer') => {
    onClose();
    onNavigate(screen);
  };

  const handleChatbot = () => {
    onClose();
    onChatbotOpen();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/50">
          <TouchableWithoutFeedback>
            <View className="absolute right-0 top-0 bottom-0 w-80 bg-white">
              <ScrollView className="flex-1">
                {/* Header */}
                <View className="bg-primary px-6 pt-16 pb-8">
                  <TouchableOpacity
                    onPress={onClose}
                    className="absolute top-12 right-6 z-10"
                  >
                    <Ionicons name="close" size={28} color="#fff" />
                  </TouchableOpacity>
                  <Text className="text-white text-2xl font-bold">
                    {tr('drawer.title', 'Menu')}
                  </Text>
                  <Text className="text-white/80 text-sm mt-1">
                    {tr('drawer.subtitle', 'Navigate to features')}
                  </Text>
                </View>

                {/* Menu Items */}
                <View className="p-6">
                  {/* Profile */}
                  <TouchableOpacity
                    onPress={() => handleNavigate('Profile')}
                    className="flex-row items-center py-4 border-b border-gray-100"
                  >
                    <View className="bg-primary/10 rounded-full w-12 h-12 items-center justify-center">
                      <User size={24} color="#22C55E" strokeWidth={2} />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-gray-900 text-base font-semibold">
                        {tr('drawer.profile', 'My Profile')}
                      </Text>
                      <Text className="text-gray-500 text-sm">
                        {tr('drawer.profileSubtitle', 'Manage your account settings')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Crop Prediction */}
                  <TouchableOpacity
                    onPress={() => handleNavigate('CropPrediction')}
                    className="flex-row items-center py-4 border-b border-gray-100"
                  >
                    <View className="bg-green-100 rounded-full w-12 h-12 items-center justify-center">
                      <Sprout size={24} color="#16A34A" strokeWidth={2} />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-gray-900 text-base font-semibold">
                        {tr('prediction.title', 'Crop Prediction')}
                      </Text>
                      <Text className="text-gray-500 text-sm">
                        {tr('prediction.subtitle', 'Enter crop details for prediction')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Document Analyzer */}
                  <TouchableOpacity
                    onPress={() => handleNavigate('DocumentAnalyzer')}
                    className="flex-row items-center py-4 border-b border-gray-100"
                  >
                    <View className="bg-blue-100 rounded-full w-12 h-12 items-center justify-center">
                      <FileText size={24} color="#3B82F6" strokeWidth={2} />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-gray-900 text-base font-semibold">
                        {tr('documentAnalyzer.title', 'Document Analyzer')}
                      </Text>
                      <Text className="text-gray-500 text-sm">
                        {tr('documentAnalyzer.subtitle', 'Analyze farming documents')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Crop Disease Detection */}
                  <TouchableOpacity
                    onPress={() => handleNavigate('CropDiseaseDetection')}
                    className="flex-row items-center py-4 border-b border-gray-100"
                  >
                    <View className="bg-yellow-100 rounded-full w-12 h-12 items-center justify-center">
                      <Leaf size={24} color="#EAB308" strokeWidth={2} />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-gray-900 text-base font-semibold">
                        {tr('cropDisease.title', 'Disease Detection')}
                      </Text>
                      <Text className="text-gray-500 text-sm">
                        {tr('cropDisease.subtitle', 'Detect crop diseases')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Contact Buyer */}
                  <TouchableOpacity
                    onPress={() => handleNavigate('ContactBuyer')}
                    className="flex-row items-center py-4 border-b border-gray-100"
                  >
                    <View className="bg-purple-100 rounded-full w-12 h-12 items-center justify-center relative">
                      <ShoppingCart size={24} color="#9333EA" strokeWidth={2} />
                      {notificationCount > 0 && (
                        <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                          <Text className="text-white text-xs font-bold">
                            {notificationCount > 9 ? '9+' : notificationCount}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-gray-900 text-base font-semibold">
                        {tr('drawer.contactBuyer', 'Contact Buyer')}
                      </Text>
                      <Text className="text-gray-500 text-sm">
                        {tr('drawer.contactBuyerSubtitle', 'Connect with interested buyers')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* AI Chatbot */}
                  <TouchableOpacity
                    onPress={handleChatbot}
                    className="flex-row items-center py-4"
                  >
                    <View className="bg-indigo-100 rounded-full w-12 h-12 items-center justify-center">
                      <MessageCircle size={24} color="#6366F1" strokeWidth={2} />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-gray-900 text-base font-semibold">
                        {tr('chatbot.title', 'AI Assistant')}
                      </Text>
                      <Text className="text-gray-500 text-sm">
                        {tr('chatbot.subtitle', 'Get farming advice')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Version Info */}
                <View className="px-6 pb-8">
                  <Text className="text-gray-400 text-xs text-center">
                    {tr('drawer.version', 'Version')} 1.0.0
                  </Text>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
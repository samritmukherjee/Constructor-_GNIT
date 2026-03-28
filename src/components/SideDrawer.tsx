import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface SideDrawerProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: 'Profile' | 'CropPrediction' | 'DocumentAnalyzer' | 'CropDiseaseDetection') => void;
  onChatbotOpen: () => void;
}

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.90;

export const SideDrawer: React.FC<SideDrawerProps> = ({ visible, onClose, onNavigate, onChatbotOpen }) => {
  const { t } = useTranslation();
  const slideAnim = React.useRef(new Animated.Value(DRAWER_WIDTH)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: DRAWER_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleNavigate = (screen: 'Profile' | 'CropPrediction' | 'DocumentAnalyzer' | 'CropDiseaseDetection') => {
    onClose();
    setTimeout(() => onNavigate(screen), 300);
  };

  const handleChatbot = () => {
    onClose();
    setTimeout(() => onChatbotOpen(), 300);
  };

  const menuItems = [
    {
      id: 'profile',
      screen: 'Profile' as const,
      icon: '👤',
      title: t('drawer.profile'),
      subtitle: t('drawer.profileSubtitle'),
      color: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      id: 'prediction',
      screen: 'CropPrediction' as const,
      icon: '🌾',
      title: t('dashboard.predictCrop'),
      subtitle: t('dashboard.predictSubtitle'),
      color: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      id: 'analyzer',
      screen: 'DocumentAnalyzer' as const,
      icon: '📄',
      title: t('dashboard.analyzeDocument'),
      subtitle: t('dashboard.analyzeDocumentSubtitle'),
      color: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      id: 'disease',
      screen: 'CropDiseaseDetection' as const,
      icon: '🔬',
      title: t('disease.title'),
      subtitle: t('disease.instruction'),
      color: 'bg-orange-100',
      iconColor: 'text-orange-600',
    },
    {
      id: 'chatbot',
      screen: null,
      icon: '💬',
      title: t('chatbot.title'),
      subtitle: t('chatbot.subtitle'),
      color: 'bg-teal-100',
      iconColor: 'text-teal-600',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Overlay */}
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Drawer */}
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View className="bg-primary pt-12 pb-6 px-6">
            <View className="flex-row items-center justify-between mb-2">
              <View>
                <Text className="text-white text-2xl font-bold">
                  {t('drawer.title')}
                </Text>
                <Text className="text-white/80 text-sm mt-1">
                  {t('drawer.subtitle')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="bg-white/20 rounded-full w-10 h-10 items-center justify-center"
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Menu Items */}
          <View className="flex-1 px-4 py-6">
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => item.screen ? handleNavigate(item.screen) : handleChatbot()}
                className="bg-white rounded-xl p-4 mb-3 flex-row items-center shadow-sm"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              >
                <View className={`${item.color} rounded-full w-14 h-14 items-center justify-center mr-4`}>
                  <Text className="text-3xl">{item.icon}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 text-base font-bold mb-1">
                    {item.title}
                  </Text>
                  <Text className="text-gray-600 text-xs" numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Footer */}
          <View className="px-6 py-4 border-t border-gray-200">
            <Text className="text-gray-500 text-xs text-center">
              {t('drawer.version')} 1.0.0
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#F9FAFB',
  },
});

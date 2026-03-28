import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  X,
  LucideIcon,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface CustomAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  type?: AlertType;
  title: string;
  message: string;
  buttons?: CustomAlertButton[];
  onClose?: () => void;
  icon?: LucideIcon;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  type = 'info',
  title,
  message,
  buttons = [{ text: 'OK', style: 'default' }],
  onClose,
  icon: CustomIcon,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getAlertConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: CustomIcon || CheckCircle,
          colors: ['#22C55E', '#16A34A'] as [string, string],
          bgColor: '#DCFCE7',
          borderColor: '#BBF7D0',
          iconColor: '#FFFFFF',
        };
      case 'error':
        return {
          icon: CustomIcon || XCircle,
          colors: ['#EF4444', '#DC2626'] as [string, string],
          bgColor: '#FEE2E2',
          borderColor: '#FECACA',
          iconColor: '#FFFFFF',
        };
      case 'warning':
        return {
          icon: CustomIcon || AlertTriangle,
          colors: ['#F59E0B', '#D97706'] as [string, string],
          bgColor: '#FEF3C7',
          borderColor: '#FDE68A',
          iconColor: '#FFFFFF',
        };
      case 'info':
      default:
        return {
          icon: CustomIcon || Info,
          colors: ['#3B82F6', '#2563EB'] as [string, string],
          bgColor: '#DBEAFE',
          borderColor: '#BFDBFE',
          iconColor: '#FFFFFF',
        };
    }
  };

  const config = getAlertConfig();
  const IconComponent = config.icon;

  const handleButtonPress = (button: CustomAlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onClose) {
      onClose();
    }
  };

  const getButtonStyles = (buttonStyle?: string) => {
    switch (buttonStyle) {
      case 'cancel':
        return {
          bg: '#F3F4F6',
          text: '#6B7280',
          border: '#E5E7EB',
        };
      case 'destructive':
        return {
          bg: '#FEE2E2',
          text: '#DC2626',
          border: '#FECACA',
        };
      default:
        return {
          bg: config.bgColor,
          text: config.colors[1],
          border: config.borderColor,
        };
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.alertContainer,
            {
              transform: [
                {
                  scale: scaleAnim,
                },
              ],
            },
          ]}
        >
          {/* Main Alert Card */}
          <View style={styles.alertCard}>
            {/* Icon Header */}
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={config.colors}
                style={styles.iconGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <IconComponent size={32} color={config.iconColor} strokeWidth={2.5} />
              </LinearGradient>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {buttons.map((button, index) => {
                const buttonStyles = getButtonStyles(button.style);
                const isLastButton = index === buttons.length - 1;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      {
                        backgroundColor: buttonStyles.bg,
                        borderColor: buttonStyles.border,
                        marginRight: isLastButton ? 0 : 12,
                        flex: 1,
                      },
                    ]}
                    onPress={() => handleButtonPress(button)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        {
                          color: buttonStyles.text,
                          fontWeight: button.style === 'cancel' ? '600' : '700',
                        },
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertContainer: {
    width: '100%',
    maxWidth: Math.min(SCREEN_WIDTH - 48, 400),
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  content: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: 16,
    letterSpacing: 0.3,
  },
});

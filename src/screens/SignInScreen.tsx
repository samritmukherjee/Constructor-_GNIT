import React, { useState, useEffect } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Sprout, ShoppingBasket, Phone, Mail, LogIn, LogOut } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomInput } from '../components/CustomInput';
import { CustomAlert } from '../components/CustomAlert';
import MovingBackgroundCircle from '../components/MovingBackgroundCircle';
import { RootStackParamList } from '../navigation/AppNavigator';
import { 
  sendPhoneOTP, 
  fetchCurrentUserProfile, 
  signInWithPhone,
  signIn
} from '../services/auth';
import { formatPhoneNumber, testAPIConnection } from '../services/twilio';
import { localizeNumber, delocalizeNumber } from '../utils/numberLocalization';

type SignInScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SignIn'
>;

type SignInScreenRouteProp = RouteProp<RootStackParamList, 'SignIn'>;

type AuthMethod = 'phone' | 'email';

interface FormData {
  phoneNumber: string;
  email: string;
  password: string;
  otp: string;
}

interface FormErrors {
  [key: string]: string;
}

export const SignInScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<SignInScreenNavigationProp>();
  const route = useRoute<SignInScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [showExitAlert, setShowExitAlert] = useState(false);
  const role = route.params?.role;
  const [formData, setFormData] = useState<FormData>({
    phoneNumber: '',
    email: '',
    password: '',
    otp: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // Handle back button press to show exit confirmation
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        setShowExitAlert(true);
        return true; // Prevent default back behavior
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  // Load saved language on mount
  useEffect(() => {
    const loadSavedLanguage = async () => {
      try {
        const { loadLanguage } = await import('../i18n/i18n');
        await loadLanguage();
      } catch (error) {
        console.error('Error loading language:', error);
      }
    };
    loadSavedLanguage();
  }, []);

  // OTP timer countdown
  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpTimer]);

  const tr = (key: string, fallback: string) => {
    try {
      return i18n.exists(key) ? (t(key) as string) : fallback;
    } catch {
      return fallback;
    }
  };

  const validateField = (name: keyof FormData, value: string): string => {
    switch (name) {
      case 'phoneNumber':
        if (authMethod !== 'phone') return '';
        return !value.trim()
          ? tr('signIn.errors.required', 'Required')
          : !/^[6-9]\d{9}$/.test(value)
            ? tr('signIn.errors.invalidMobile', 'Enter a valid 10-digit mobile number')
            : '';
      case 'email':
        if (authMethod !== 'email') return '';
        return !value.trim()
          ? tr('signIn.errors.required', 'Required')
          : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
            ? tr('signIn.errors.invalidEmail', 'Enter a valid email')
            : '';
      case 'password':
        if (authMethod !== 'email') return '';
        return !value
          ? tr('signIn.errors.required', 'Required')
          : value.length < 6
            ? tr('signIn.errors.passwordTooShort', 'Password must be at least 6 characters')
            : '';
      case 'otp':
        if (authMethod !== 'phone') return '';
        return !value
          ? tr('signIn.errors.required', 'Required')
          : !/^\d{6}$/.test(value)
            ? tr('signIn.errors.invalidOTP', 'OTP must be 6 digits')
            : '';
      default:
        return '';
    }
  };

  const handleFieldChange = (name: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSendOTP = async () => {
    // Validate phone number first
    const phoneError = validateField('phoneNumber', formData.phoneNumber);
    if (phoneError) {
      setErrors((prev) => ({ ...prev, phoneNumber: phoneError }));
      return;
    }

    setIsSendingOtp(true);
    try {
      // Test API connection first
      console.log('Testing API connection before sending OTP...');
      const connectionTest = await testAPIConnection();
      if (!connectionTest.success) {
        Alert.alert(
          tr('signIn.signInTitle', 'Sign In'),
          `${tr('signIn.errors.connectionFailed', 'Unable to connect to server')}: ${connectionTest.message}\n\n${tr('signIn.errors.checkInternet', 'Please check your internet connection and try again.')}`
        );
        return;
      }
      console.log('API connection successful:', connectionTest.message);
      
      const formattedPhone = formatPhoneNumber(formData.phoneNumber, '+91');
      
      // Send OTP via backend - this will call the Twilio API
      console.log('Sending OTP to:', formattedPhone);
      const result = await sendPhoneOTP(formattedPhone);

      if (!result.success) {
        Alert.alert(
          tr('signIn.signInTitle', 'Sign In'), 
          `${result.message}\n\n${tr('signIn.errors.checkInternet', 'Please check your internet connection and try again.')}`
        );
        return;
      }

      setOtpSent(true);
      setOtpTimer(60); // 60 seconds resend timer
      Alert.alert(
        tr('signIn.otpSent', 'OTP Sent'),
        tr('signIn.otpSentMessage', 'A 6-digit OTP has been sent to your phone number.')
      );
    } catch (error) {
      console.error('Send OTP error:', error);
      Alert.alert(
        tr('signIn.signInTitle', 'Sign In'),
        tr('signIn.errors.otpSendFailed', 'Failed to send OTP. Please check your internet connection and try again.')
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    let requiredFields: (keyof FormData)[] = [];
    
    if (authMethod === 'phone') {
      requiredFields = otpSent ? ['phoneNumber', 'otp'] : ['phoneNumber'];
    } else {
      requiredFields = ['email', 'password'];
    }

    requiredFields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    // Check OTP requirement for phone auth
    if (authMethod === 'phone' && !otpSent) {
      Alert.alert(
        tr('signIn.signInTitle', 'Sign In'),
        tr('signIn.errors.sendOTPFirst', 'Please send OTP first')
      );
      return;
    }

    if (!validateForm()) return;

    setIsSigningIn(true);
    try {
      let result;
      
      // Sign in based on selected method
      if (authMethod === 'phone') {
        const formattedPhone = formatPhoneNumber(formData.phoneNumber, '+91');
        result = await signInWithPhone(formattedPhone, formData.otp);
      } else {
        // Email sign in
        result = await signIn(formData.email.trim(), formData.password);
      }
      
      if (!result.success) {
        Alert.alert(
          tr('signIn.signInTitle', 'Sign In'),
          result.message
        );
        return;
      }

      // Fetch user profile to determine role
      const profileResult = await fetchCurrentUserProfile();
      let userRole = role || 'farmer';
      
      if (profileResult.success && profileResult.profile) {
        userRole = profileResult.profile.role || profileResult.profile.userType || 'farmer';
      }

      // Navigate based on role
      if (userRole === 'buyer') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'BuyerDashboard' }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Dashboard' }],
        });
      }
    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert(
        tr('signIn.signInTitle', 'Sign In'),
        tr('signIn.errors.default', 'Sign in failed. Please try again.')
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const isFormValid = () => {
    if (authMethod === 'phone') {
      return (
        formData.phoneNumber &&
        formData.otp &&
        !errors.phoneNumber &&
        !errors.otp &&
        otpSent
      );
    } else {
      return (
        formData.email &&
        formData.password &&
        !errors.email &&
        !errors.password
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
      style={{ backgroundColor: '#F7FAF7' }}
    >
      {/* Slow Moving Background */}
      <MovingBackgroundCircle size={260} speed={0.35} opacity={0.06} color="#16A34A" />
      <MovingBackgroundCircle size={180} speed={0.25} opacity={0.045} color="#22C55E" />

      {/* Decorative Background Shape */}
      <View style={{
        position: 'absolute',
        top: -100,
        right: -50,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: '#E8F5E9',
        opacity: 0.35,
      }} />
      <View style={{
        position: 'absolute',
        bottom: -80,
        left: -60,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: '#F1F8E9',
        opacity: 0.3,
      }} />
      
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: Math.max(insets.bottom, 24) + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button - Shows exit confirmation since this is the root auth screen */}
        <View className="mb-8">
          <TouchableOpacity
            onPress={() => setShowExitAlert(true)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              backgroundColor: '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 4,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Ionicons name="arrow-back" size={22} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Header - Innovative Design with Icon */}
        <View className="mb-10">
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: role === 'farmer' ? '#16A34A' : role === 'buyer' ? '#10B981' : '#059669',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
                shadowColor: role === 'farmer' ? '#16A34A' : '#10B981',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}>
                {role === 'farmer' ? (
                  <Sprout size={26} color="white" strokeWidth={2.5} />
                ) : role === 'buyer' ? (
                  <ShoppingBasket size={26} color="white" strokeWidth={2.5} />
                ) : (
                  <LogIn size={26} color="white" strokeWidth={2.5} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text 
                  className="text-gray-900 font-extrabold" 
                  style={{ fontSize: 30, lineHeight: 36, letterSpacing: -0.5 }}
                >
                  {role === 'farmer'
                    ? tr('signIn.farmerTitle', 'Farmer Sign In')
                    : role === 'buyer'
                      ? tr('signIn.buyerTitle', 'Buyer Sign In')
                      : tr('signIn.signInTitle', 'Sign In')}
                </Text>
              </View>
            </View>
            <Text className="text-gray-600" style={{ fontSize: 14, marginTop: 4 }}>
              {tr('signIn.subtitle', 'Sign in to continue')}
            </Text>
          </View>
        </View>

        {/* Auth Method Toggle */}
        <View style={{
          backgroundColor: 'white',
          borderRadius: 20,
          padding: 6,
          marginBottom: 16,
          flexDirection: 'row',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 3,
        }}>
          <TouchableOpacity
            onPress={() => {
              setAuthMethod('phone');
              setFormData(prev => ({ ...prev, email: '', password: '' }));
              setErrors({});
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 16,
              backgroundColor: authMethod === 'phone' ? '#16A34A' : 'transparent',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            <Phone size={16} color={authMethod === 'phone' ? 'white' : '#6B7280'} style={{ marginRight: 8 }} />
            <Text style={{
              color: authMethod === 'phone' ? 'white' : '#6B7280',
              fontWeight: '600',
              fontSize: 15,
            }}>
              {tr('signIn.phoneMethod', 'Phone')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setAuthMethod('email');
              setFormData(prev => ({ ...prev, phoneNumber: '', otp: '' }));
              setOtpSent(false);
              setErrors({});
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 16,
              backgroundColor: authMethod === 'email' ? '#16A34A' : 'transparent',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            <Mail size={16} color={authMethod === 'email' ? 'white' : '#6B7280'} style={{ marginRight: 8 }} />
            <Text style={{
              color: authMethod === 'email' ? 'white' : '#6B7280',
              fontWeight: '600',
              fontSize: 15,
            }}>
              {tr('signIn.emailMethod', 'Email')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sign In Form */}
        <View style={{
          backgroundColor: 'white',
          borderRadius: 20,
          padding: 24,
          marginBottom: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 3,
        }}>
          {/* Phone Auth Fields */}
          {authMethod === 'phone' && (
          <>
          {/* Phone Number with Send OTP Button */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
              {tr('signIn.mobileNumber', 'Mobile Number')}
            </Text>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F9FAFB',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  borderWidth: 1,
                  borderColor: errors.phoneNumber ? '#EF4444' : '#E5E7EB',
                }}>
                  <Text style={{ fontSize: 16, color: '#6B7280', marginRight: 8 }}>
                    {tr('signIn.countryCode', '+91')}
                  </Text>
                  <TextInput
                    style={{ flex: 1, paddingVertical: 14, fontSize: 16, color: '#111827' }}
                    placeholder={tr('signIn.mobileNumberPlaceholder', '9876543210')}
                    value={localizeNumber(formData.phoneNumber, i18n.language)}
                    onChangeText={(value) => {
                      const delocalized = delocalizeNumber(value, i18n.language);
                      handleFieldChange('phoneNumber', delocalized);
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!otpSent}
                  />
                </View>
                {errors.phoneNumber && (
                  <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>
                    {errors.phoneNumber}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={handleSendOTP}
                disabled={isSendingOtp || otpTimer > 0 || !formData.phoneNumber}
                style={{
                  marginLeft: 10,
                  backgroundColor: (isSendingOtp || otpTimer > 0 || !formData.phoneNumber) ? '#D1D5DB' : '#16A34A',
                  height: 50,
                  width: 110,
                  borderRadius: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                {isSendingOtp ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text
                    style={{ color: 'white', fontWeight: '600', fontSize: 14, textAlign: 'center' }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {otpTimer > 0
                      ? `${otpTimer}${tr('signIn.secondsShort', 's')}`
                      : otpSent
                        ? tr('signIn.resendOTP', 'Resend')
                        : tr('signIn.sendOTP', 'Send OTP')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* OTP Input - Only show after OTP is sent */}
          {otpSent && (
            <View>
              <CustomInput
                label={tr('signIn.otp', 'Enter OTP')}
                placeholder={tr('signIn.otpPlaceholder', 'Enter 6-digit OTP')}
                value={formData.otp}
                onChangeText={(value) => handleFieldChange('otp', value)}
                keyboardType="number-pad"
                maxLength={6}
                error={errors.otp}
              />
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                {tr('signIn.otpHelp', 'Enter the OTP sent to your phone')}
              </Text>
            </View>
          )}
          </>
          )}

          {/* Email Auth Fields */}
          {authMethod === 'email' && (
            <>
              <CustomInput
                label={tr('signIn.email', 'Email')}
                placeholder={tr('signIn.emailPlaceholder', 'Enter your email')}
                value={formData.email}
                onChangeText={(value) => handleFieldChange('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
              />
              <CustomInput
                label={tr('signIn.password', 'Password')}
                placeholder={tr('signIn.passwordPlaceholder', 'Enter your password')}
                value={formData.password}
                onChangeText={(value) => handleFieldChange('password', value)}
                secureTextEntry
                error={errors.password}
              />
            </>
          )}
        </View>

        {/* Sign In Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isFormValid() || isSigningIn}
          style={{
            backgroundColor: (!isFormValid() || isSigningIn) ? '#D1D5DB' : '#16A34A',
            borderRadius: 12,
            paddingVertical: 16,
            marginBottom: 20,
            shadowColor: '#16A34A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: (!isFormValid() || isSigningIn) ? 0 : 0.3,
            shadowRadius: 8,
            elevation: (!isFormValid() || isSigningIn) ? 0 : 4,
          }}
        >
          {isSigningIn ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text 
              style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: '600' }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {tr('signIn.signInButton', 'Sign In')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 12 }}>
          <Text style={{ color: '#4B5563', fontSize: 16, textAlign: 'center', lineHeight: 22 }}>
            {tr('signIn.noAccount', "Don't have an account?")}{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('RoleChoice')}>
            <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 16, lineHeight: 22 }}>
              {tr('signIn.signUp', 'Sign Up')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Exit App Confirmation Alert */}
      <CustomAlert
        visible={showExitAlert}
        type="warning"
        icon={LogOut}
        title={tr('exitApp.title', 'Exit App')}
        message={tr('exitApp.message', 'Are you sure you want to exit the app?')}
        buttons={[
          {
            text: tr('exitApp.cancel', 'Cancel'),
            style: 'cancel',
            onPress: () => setShowExitAlert(false),
          },
          {
            text: tr('exitApp.confirm', 'Exit'),
            style: 'destructive',
            onPress: () => BackHandler.exitApp(),
          },
        ]}
        onClose={() => setShowExitAlert(false)}
      />
    </KeyboardAvoidingView>
  );
};

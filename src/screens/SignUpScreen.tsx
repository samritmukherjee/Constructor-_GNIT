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
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { 
  Sprout, 
  ShoppingBasket, 
  Phone, 
  Mail,
  ArrowLeft,
  Send,
  KeyRound,
  Eye,
  EyeOff,
  ChevronRight,
  User,
  MapPin,
  Tractor,
  LandPlot,
  Globe,
  LogIn,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RouteProp, useRoute } from '@react-navigation/native';
import { CustomInput } from '../components/CustomInput';
import { Dropdown } from '../components/Dropdown';
import { INDIAN_STATES, FARMER_TYPES, LANGUAGES, INDIAN_DISTRICTS } from '../constants/data';
import { RootStackParamList } from '../navigation/AppNavigator';
import { localizeNumber, delocalizeNumber } from '../utils/numberLocalization';
import {
  signUpWithPhone,
  signUp,
  saveCurrentUserProfile,
  updateCurrentAuthProfile,
  sendPhoneOTP,
} from '../services/auth';
import { detectCurrentLocation } from '../services/location';
import { formatPhoneNumber, testAPIConnection } from '../services/twilio';

type SignUpScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SignUp'
>;

type SignUpScreenRouteProp = RouteProp<RootStackParamList, 'SignUp'>;

type AuthMethod = 'phone' | 'email';

interface FormData {
  fullName: string;
  phoneNumber: string;
  email: string;
  password: string;
  otp: string;
  state: string;
  district: string;
  preferredLanguage: string;
  farmerType: string;
  landSize: string;
}

interface FormErrors {
  [key: string]: string;
}

export const SignUpScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<SignUpScreenNavigationProp>();
  const route = useRoute<SignUpScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const role = route.params?.role || 'farmer';
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    phoneNumber: '',
    email: '',
    password: '',
    otp: '',
    state: '',
    district: '',
    preferredLanguage: i18n.language || 'en',
    farmerType: '',
    landSize: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);

  // Theme colors based on role
  const primaryColor = role === 'farmer' ? '#16A34A' : '#10B981';
  const gradientColors = role === 'farmer' 
    ? ['#16A34A', '#15803D'] as const
    : ['#10B981', '#059669'] as const;

  // Load saved language on mount
  useEffect(() => {
    const loadSavedLanguage = async () => {
      try {
        const { loadLanguage } = await import('../i18n/i18n');
        await loadLanguage();
        setFormData(prev => ({ ...prev, preferredLanguage: i18n.language || 'en' }));
      } catch (error) {
        console.error('Error loading language:', error);
      }
    };
    loadSavedLanguage();
  }, []);

  // Auto-detect location on sign up
  useEffect(() => {
    const detect = async () => {
      const res = await detectCurrentLocation();
      if (!res.ok) {
        if (res.reason === 'services-disabled') {
          Alert.alert(
            tr('signUp.locationRequiredTitle', 'Location Required'),
            tr('signUp.turnOnLocationServices', 'Please turn on Location Services to auto-fill your location.')
          );
          return;
        }
        if (res.reason === 'permission-denied') {
          Alert.alert(
            tr('signUp.locationRequiredTitle', 'Location Required'),
            tr('signUp.allowLocationPermission', 'Please allow location permission to auto-fill your location.')
          );
        }
        return;
      }

      setFormData((prev) => ({
        ...prev,
        state: res.location.stateValue || prev.state,
        district: res.location.districtValue || prev.district,
      }));
    };

    detect();
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
      case 'fullName':
        return !value.trim() ? tr('signUp.errors.required', 'Required') : '';
      case 'phoneNumber':
        // Phone is now required for both auth methods
        return !value.trim()
          ? tr('signUp.errors.required', 'Required')
          : !/^[6-9]\d{9}$/.test(value)
            ? tr('signUp.errors.invalidMobile', 'Enter a valid 10-digit mobile number')
            : '';
      case 'email':
        if (authMethod === 'phone') return ''; // Email optional for phone auth
        return !value.trim()
          ? tr('signUp.errors.required', 'Required')
          : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
            ? tr('signUp.errors.invalidEmail', 'Enter a valid email address')
            : '';
      case 'password':
        if (authMethod === 'phone') return ''; // Password not needed for phone auth
        return !value
          ? tr('signUp.errors.required', 'Required')
          : value.length < 6
            ? tr('signUp.errors.passwordTooShort', 'Password must be at least 6 characters')
            : '';
      case 'otp':
        if (authMethod === 'email') return ''; // OTP not needed for email auth
        return !value
          ? tr('signUp.errors.required', 'Required')
          : !/^\d{6}$/.test(value)
            ? tr('signUp.errors.invalidOTP', 'OTP must be 6 digits')
            : '';
      case 'state':
      case 'district':
      case 'preferredLanguage':
      case 'farmerType':
      case 'landSize':
        return !value.trim() ? tr('signUp.errors.required', 'Required') : '';
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

    setIsLoading(true);
    try {
      // Test API connection first
      console.log('Testing API connection before sending OTP...');
      const connectionTest = await testAPIConnection();
      if (!connectionTest.success) {
        Alert.alert(
          tr('signUp.title', 'Sign Up'),
          `Unable to connect to server: ${connectionTest.message}\n\nPlease check your internet connection and try again.`
        );
        setIsLoading(false);
        return;
      }
      console.log('API connection successful:', connectionTest.message);
      
      const formattedPhone = formatPhoneNumber(formData.phoneNumber, '+91');
      const result = await sendPhoneOTP(formattedPhone);

      if (!result.success) {
        Alert.alert(
          tr('signUp.title', 'Sign Up'), 
          result.message + '\n\nIf the problem persists, please check your internet connection.'
        );
        return;
      }

      setOtpSent(true);
      setOtpTimer(60); // 60 seconds resend timer
      Alert.alert(
        tr('signUp.otpSent', 'OTP Sent'),
        tr('signUp.otpSentMessage', 'A 6-digit OTP has been sent to your phone number.')
      );
    } catch (error) {
      console.error('Send OTP error:', error);
      Alert.alert(
        tr('signUp.title', 'Sign Up'),
        tr('signUp.errors.otpSendFailed', 'Failed to send OTP. Please check your internet connection and try again.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    let requiredFields: (keyof FormData)[] = ['fullName', 'phoneNumber'];
    
    // Add auth-specific required fields
    if (authMethod === 'phone') {
      requiredFields.push('otp');
    } else {
      requiredFields.push('email', 'password');
    }
    
    // Add farmer-specific fields only for farmers
    if (role === 'farmer') {
      requiredFields.push(
        'state',
        'district',
        'preferredLanguage',
        'farmerType',
        'landSize'
      );
    }

    requiredFields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    // Check OTP requirement for phone auth
    if (authMethod === 'phone' && !otpSent) {
      Alert.alert(
        tr('signUp.title', 'Sign Up'),
        tr('signUp.errors.sendOTPFirst', 'Please send OTP first')
      );
      return;
    }

    setIsLoading(true);
    try {
      let result;
      
      // Sign up based on selected method
      if (authMethod === 'phone') {
        const formattedPhone = formatPhoneNumber(formData.phoneNumber, '+91');
        result = await signUpWithPhone(formattedPhone, formData.otp);
      } else {
        // Email sign up
        result = await signUp(formData.email.trim(), formData.password);
      }

      if (!result.success) {
        Alert.alert(tr('signUp.title', 'Sign Up'), result.message);
        return;
      }

      // Store display name in Firebase Auth
      if (formData.fullName?.trim()) {
        await updateCurrentAuthProfile({ displayName: formData.fullName.trim() });
      }

      // Save profile to Firestore with role
      const profileData: any = {
        fullName: formData.fullName,
        role: role,
        notificationsEnabled: true,
        profilePhoto: null,
      };

      // Add authentication method details
      const formattedPhone = formatPhoneNumber(formData.phoneNumber, '+91');
      profileData.phoneNumber = formattedPhone;
      profileData.mobileNumber = formattedPhone;
      
      if (authMethod === 'phone') {
        profileData.isPhoneVerified = true;
      } else {
        profileData.email = formData.email.trim();
        profileData.isEmailVerified = true;
      }

      // Persist location for all roles
      if (formData.state) profileData.state = formData.state;
      if (formData.district) profileData.district = formData.district;

      // Add farmer-specific fields only for farmers
      if (role === 'farmer') {
        profileData.preferredLanguage = formData.preferredLanguage;
        profileData.farmerType = formData.farmerType;
        profileData.landSize = formData.landSize;
      }

      await saveCurrentUserProfile(profileData);

      // New users always see onboarding
      const targetScreen = role === 'buyer' ? 'BuyerDashboard' : 'Dashboard';
      navigation.reset({
        index: 0,
        routes: [{ name: 'GetStarted', params: { targetScreen } }],
      });
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert(tr('signUp.title', 'Sign Up'), tr('signUp.errors.default', 'Sign up failed.'));
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    const requiredFields: (keyof FormData)[] = ['fullName', 'phoneNumber'];
    
    // Add auth-specific required fields
    if (authMethod === 'phone') {
      requiredFields.push('otp');
    } else {
      requiredFields.push('email', 'password');
    }
    
    // Add farmer-specific fields only for farmers
    if (role === 'farmer') {
      requiredFields.push(
        'state',
        'district',
        'preferredLanguage',
        'farmerType',
        'landSize'
      );
    }
    
    // Check all required fields are filled and have no errors
    const allFieldsFilled = requiredFields.every((field) => formData[field as keyof FormData]);
    // Only check errors for required fields, not all fields in errors object
    const noErrors = requiredFields.every((field) => !errors[field]);
    
    // For phone auth, also require OTP to be sent
    if (authMethod === 'phone') {
      return allFieldsFilled && noErrors && otpSent;
    }
    
    // For email auth, just check fields and errors
    return allFieldsFilled && noErrors;
  };

  // Change language when preferred language is selected
  useEffect(() => {
    if (formData.preferredLanguage) {
      import('../i18n/i18n').then(({ saveLanguage }) => {
        saveLanguage(formData.preferredLanguage);
      });
    }
  }, [formData.preferredLanguage]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      style={{ backgroundColor: '#F8FAFC' }}
    >
      {/* Gradient Header */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 260,
          borderBottomLeftRadius: 40,
          borderBottomRightRadius: 40,
        }}
      >
        {/* Decorative circles */}
        <View style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: 'rgba(255,255,255,0.1)',
        }} />
        <View style={{
          position: 'absolute',
          top: 80,
          left: -40,
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: 'rgba(255,255,255,0.08)',
        }} />
        <View style={{
          position: 'absolute',
          bottom: 40,
          right: 40,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: 'rgba(255,255,255,0.12)',
        }} />
      </LinearGradient>
      
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Content */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 24 }}>
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <ArrowLeft size={22} color="white" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Header Text */}
          <View style={{ marginBottom: 28 }}>
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.2)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              {role === 'farmer' ? (
                <Sprout size={28} color="white" strokeWidth={2.5} />
              ) : (
                <ShoppingBasket size={28} color="white" strokeWidth={2.5} />
              )}
            </View>
            <Text style={{ 
              fontSize: 30, 
              fontWeight: '800', 
              color: 'white',
              marginBottom: 6,
              letterSpacing: -0.5,
            }}>
              {tr('signUp.title', role === 'farmer' ? 'Farmer Sign Up' : 'Buyer Sign Up')}
            </Text>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)' }}>
              {tr('signUp.phoneAuth', 'Create your account to get started')}
            </Text>
          </View>
        </View>

        {/* Form Card */}
        <View style={{
          marginHorizontal: 20,
          backgroundColor: 'white',
          borderRadius: 24,
          padding: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 24,
          elevation: 8,
        }}>
          {/* Auth Method Toggle */}
          <View style={{
            backgroundColor: '#F1F5F9',
            borderRadius: 16,
            padding: 4,
            marginBottom: 24,
            flexDirection: 'row',
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
                borderRadius: 12,
                backgroundColor: authMethod === 'phone' ? primaryColor : 'transparent',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Phone size={18} color={authMethod === 'phone' ? 'white' : '#64748B'} strokeWidth={2} />
              <Text style={{
                color: authMethod === 'phone' ? 'white' : '#64748B',
                fontWeight: '600',
                fontSize: 14,
              }}>
                {tr('signUp.phoneMethod', 'Phone')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setAuthMethod('email');
                setFormData(prev => ({ ...prev, otp: '' }));
                setOtpSent(false);
                setErrors({});
              }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: authMethod === 'email' ? primaryColor : 'transparent',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Mail size={18} color={authMethod === 'email' ? 'white' : '#64748B'} strokeWidth={2} />
              <Text style={{
                color: authMethod === 'email' ? 'white' : '#64748B',
                fontWeight: '600',
                fontSize: 14,
              }}>
                {tr('signUp.emailMethod', 'Email')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Account Information Section */}
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 16 }}>
            {tr('signUp.accountInfo', 'Account Information')}
          </Text>
          
          {/* Full Name Input */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
              {tr('signUp.fullName', 'Full Name')}
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
              borderRadius: 14,
              paddingHorizontal: 16,
              height: 52,
              borderWidth: 1.5,
              borderColor: errors.fullName ? '#EF4444' : '#E2E8F0',
            }}>
              <User size={18} color="#64748B" strokeWidth={2} style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, fontSize: 16, color: '#1E293B', fontWeight: '500' }}
                placeholder={tr('signUp.fullNamePlaceholder', 'Enter your full name')}
                placeholderTextColor="#94A3B8"
                value={formData.fullName}
                onChangeText={(value) => handleFieldChange('fullName', value)}
              />
            </View>
            {errors.fullName && (
              <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>
                {errors.fullName}
              </Text>
            )}
          </View>

          {/* Phone Auth Fields */}
          {authMethod === 'phone' && (
            <>
              {/* Phone Number with Send OTP Button */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                  {tr('signUp.phoneNumber', 'Phone Number')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#F8FAFC',
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      height: 52,
                      borderWidth: 1.5,
                      borderColor: errors.phoneNumber ? '#EF4444' : '#E2E8F0',
                    }}>
                      <Phone size={18} color="#64748B" strokeWidth={2} style={{ marginRight: 10 }} />
                      <Text style={{ fontSize: 16, color: '#64748B', marginRight: 8 }}>+91</Text>
                      <TextInput
                        style={{ flex: 1, fontSize: 16, color: '#1E293B', fontWeight: '500' }}
                        placeholder={tr('signUp.phoneNumberPlaceholder', '9876543210')}
                        placeholderTextColor="#94A3B8"
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
                      <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>
                        {errors.phoneNumber}
                      </Text>
                    )}
                  </View>
                  {/* Send OTP Button - Fixed size */}
                  <TouchableOpacity
                    onPress={handleSendOTP}
                    disabled={isLoading || otpTimer > 0 || !formData.phoneNumber}
                    style={{
                      backgroundColor: (isLoading || otpTimer > 0 || !formData.phoneNumber) ? '#CBD5E1' : primaryColor,
                      width: 90,
                      height: 52,
                      borderRadius: 14,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Send size={16} color="white" strokeWidth={2.5} />
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>
                          {otpTimer > 0 
                            ? `${otpTimer}s` 
                            : otpSent 
                              ? tr('signUp.resendOTP', 'Resend')
                              : tr('signUp.sendOTP', 'OTP')}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* OTP Input - Only show after OTP is sent */}
              {otpSent && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                    {tr('signUp.otp', 'Enter OTP')}
                  </Text>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F8FAFC',
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    height: 52,
                    borderWidth: 1.5,
                    borderColor: errors.otp ? '#EF4444' : '#E2E8F0',
                  }}>
                    <KeyRound size={18} color="#64748B" strokeWidth={2} style={{ marginRight: 10 }} />
                    <TextInput
                      style={{ flex: 1, fontSize: 16, color: '#1E293B', fontWeight: '500', letterSpacing: 4 }}
                      placeholder={tr('signUp.otpPlaceholder', '● ● ● ● ● ●')}
                      placeholderTextColor="#94A3B8"
                      value={formData.otp}
                      onChangeText={(value) => handleFieldChange('otp', value)}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  {errors.otp && (
                    <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>
                      {errors.otp}
                    </Text>
                  )}
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>
                    {tr('signUp.otpHelp', 'Enter the OTP sent to your phone')}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Email Auth Fields */}
          {authMethod === 'email' && (
            <>
              {/* Phone Number for Email Auth */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                  {tr('signUp.phoneNumber', 'Phone Number')}
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  height: 52,
                  borderWidth: 1.5,
                  borderColor: errors.phoneNumber ? '#EF4444' : '#E2E8F0',
                }}>
                  <Phone size={18} color="#64748B" strokeWidth={2} style={{ marginRight: 10 }} />
                  <Text style={{ fontSize: 16, color: '#64748B', marginRight: 8 }}>+91</Text>
                  <TextInput
                    style={{ flex: 1, fontSize: 16, color: '#1E293B', fontWeight: '500' }}
                    placeholder={tr('signUp.phoneNumberPlaceholder', '9876543210')}
                    placeholderTextColor="#94A3B8"
                    value={localizeNumber(formData.phoneNumber, i18n.language)}
                    onChangeText={(value) => {
                      const delocalized = delocalizeNumber(value, i18n.language);
                      handleFieldChange('phoneNumber', delocalized);
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
                {errors.phoneNumber && (
                  <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>
                    {errors.phoneNumber}
                  </Text>
                )}
              </View>

              {/* Email Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                  {tr('signUp.email', 'Email')}
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  height: 52,
                  borderWidth: 1.5,
                  borderColor: errors.email ? '#EF4444' : '#E2E8F0',
                }}>
                  <Mail size={18} color="#64748B" strokeWidth={2} style={{ marginRight: 10 }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 16, color: '#1E293B', fontWeight: '500' }}
                    placeholder={tr('signUp.emailPlaceholder', 'Enter your email')}
                    placeholderTextColor="#94A3B8"
                    value={formData.email}
                    onChangeText={(value) => handleFieldChange('email', value)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                {errors.email && (
                  <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>
                    {errors.email}
                  </Text>
                )}
              </View>

              {/* Password Input */}
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                  {tr('signUp.password', 'Password')}
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  height: 52,
                  borderWidth: 1.5,
                  borderColor: errors.password ? '#EF4444' : '#E2E8F0',
                }}>
                  <KeyRound size={18} color="#64748B" strokeWidth={2} style={{ marginRight: 10 }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 16, color: '#1E293B', fontWeight: '500' }}
                    placeholder={tr('signUp.passwordPlaceholder', 'Enter your password')}
                    placeholderTextColor="#94A3B8"
                    value={formData.password}
                    onChangeText={(value) => handleFieldChange('password', value)}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                      <EyeOff size={20} color="#64748B" strokeWidth={2} />
                    ) : (
                      <Eye size={20} color="#64748B" strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>
                    {errors.password}
                  </Text>
                )}
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>
                  {tr('signUp.passwordHelp', 'Minimum 6 characters')}
                </Text>
              </View>
            </>
          )}

          {/* Farmer-Specific Fields */}
          {role === 'farmer' && (
            <>
              {/* Personal Information Section */}
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 16, marginTop: 16 }}>
                {tr('signUp.personalInfo', 'Personal Information')}
              </Text>

              <Dropdown
                label={tr('signUp.state', 'State')}
                placeholder={tr('signUp.statePlaceholder', 'Select your state')}
                value={
                  INDIAN_STATES.find((s) => s.value === formData.state)
                    ? (() => {
                        try {
                          const state = INDIAN_STATES.find((s) => s.value === formData.state);
                          return state ? t(state.labelKey) : '';
                        } catch {
                          return '';
                        }
                      })()
                    : ''
                }
                options={INDIAN_STATES.map((state) => {
                  try {
                    return t(state.labelKey);
                  } catch {
                    return state.value;
                  }
                })}
                onSelect={(value) => {
                  try {
                    const selectedState = INDIAN_STATES.find(
                      (state) => {
                        try {
                          return t(state.labelKey) === value;
                        } catch {
                          return state.value === value;
                        }
                      }
                    );
                    if (selectedState) {
                      handleFieldChange('state', selectedState.value);
                    }
                  } catch (error) {
                    console.error('State selection error:', error);
                  }
                }}
                error={errors.state}
              />

              <Dropdown
                label={tr('signUp.district', 'District')}
                placeholder={tr('signUp.districtPlaceholder', 'Select your district')}
                value={
                  INDIAN_DISTRICTS.find((d) => d.value === formData.district)
                    ? (() => {
                        try {
                          const district = INDIAN_DISTRICTS.find((d) => d.value === formData.district);
                          return district ? t(district.labelKey) : '';
                        } catch {
                          return '';
                        }
                      })()
                    : ''
                }
                options={INDIAN_DISTRICTS.map((district) => {
                  try {
                    return t(district.labelKey);
                  } catch {
                    return district.value;
                  }
                })}
                onSelect={(value) => {
                  try {
                    const selectedDistrict = INDIAN_DISTRICTS.find(
                      (district) => {
                        try {
                          return t(district.labelKey) === value;
                        } catch {
                          return district.value === value;
                        }
                      }
                    );
                    if (selectedDistrict) {
                      handleFieldChange('district', selectedDistrict.value);
                    }
                  } catch (error) {
                    console.error('District selection error:', error);
                  }
                }}
                error={errors.district}
                disabled={!formData.state}
              />

              {/* Farming Information Section */}
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 16, marginTop: 16 }}>
                {tr('signUp.farmingInfo', 'Farming Information')}
              </Text>

              <Dropdown
                label={tr('signUp.farmerType', 'Farmer Type')}
                placeholder={tr('signUp.farmerTypePlaceholder', 'Select farmer type')}
                value={
                  FARMER_TYPES.find((f) => f.value === formData.farmerType)
                    ? (() => {
                        try {
                          const type = FARMER_TYPES.find((f) => f.value === formData.farmerType);
                          return type ? t(type.labelKey) : '';
                        } catch {
                          return '';
                        }
                      })()
                    : ''
                }
                options={FARMER_TYPES.map((type) => {
                  try {
                    return t(type.labelKey);
                  } catch {
                    return type.value;
                  }
                })}
                onSelect={(value) => {
                  try {
                    const selectedType = FARMER_TYPES.find(
                      (type) => {
                        try {
                          return t(type.labelKey) === value;
                        } catch {
                          return type.value === value;
                        }
                      }
                    );
                    if (selectedType) {
                      handleFieldChange('farmerType', selectedType.value);
                    }
                  } catch (error) {
                    console.error('Farmer type selection error:', error);
                  }
                }}
                error={errors.farmerType}
              />

              <CustomInput
                label={tr('signUp.landSize', 'Land Size')}
                placeholder={tr('signUp.landSizePlaceholder', 'Enter land size')}
                value={formData.landSize}
                onChangeText={(value) => handleFieldChange('landSize', value)}
                keyboardType="decimal-pad"
                suffix={tr('signUp.acres', 'acres')}
                error={errors.landSize}
              />
            </>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!isFormValid() || isLoading}
            style={{
              backgroundColor: (!isFormValid() || isLoading) ? '#CBD5E1' : primaryColor,
              borderRadius: 14,
              height: 52,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 20,
              flexDirection: 'row',
              gap: 8,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={{ color: 'white', fontSize: 17, fontWeight: '700' }}>
                  {tr('signUp.createAccount', 'Create Account')}
                </Text>
                <ChevronRight size={20} color="white" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign In Link */}
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'center', 
          alignItems: 'center',
          marginTop: 24,
          marginHorizontal: 20,
        }}>
          <Text style={{ color: '#64748B', fontSize: 15 }}>
            {tr('signUp.alreadyHaveAccount', 'Already have an account?')}{' '}
          </Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('SignIn', { role })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 15 }}>
              {tr('signUp.signIn', 'Sign In')}
            </Text>
            <LogIn size={16} color={primaryColor} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

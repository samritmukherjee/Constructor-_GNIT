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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { UserPlus, ArrowLeft } from 'lucide-react-native';
import { CustomInput, PasswordInput } from '../components/CustomInput';
import { RootStackParamList } from '../navigation/AppNavigator';
import {   
  signUp,
  saveCurrentUserProfile,
  updateCurrentAuthProfile,
} from '../services/auth';

type BuyerSignUpNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'BuyerSignUp'
>;

interface FormData {
  fullName: string;
  mobileNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  [key: string]: string;
}

export const BuyerSignUpScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<BuyerSignUpNavigationProp>();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    mobileNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

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
        return !value.trim() ? tr('buyerSignUp.errors.required', 'Required') : '';
      case 'mobileNumber':
        return !value.trim()
          ? tr('buyerSignUp.errors.required', 'Required')
          : !/^\d{10}$/.test(value)
          ? tr('buyerSignUp.errors.invalidMobile', 'Enter a valid 10-digit mobile number')
          : '';
      case 'email':
        // Email is optional for buyers
        if (!value.trim()) return '';
        return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
          ? tr('buyerSignUp.errors.invalidEmail', 'Enter a valid email address')
          : '';
      case 'password':
        return !value
          ? tr('buyerSignUp.errors.required', 'Required')
          : value.length < 6
          ? tr('buyerSignUp.errors.passwordMinLength', 'Password must be at least 6 characters')
          : '';
      case 'confirmPassword':
        return !value
          ? tr('buyerSignUp.errors.required', 'Required')
          : value !== formData.password
          ? tr('buyerSignUp.errors.passwordMismatch', 'Passwords do not match')
          : '';
      default:
        return '';
    }
  };

  const handleFieldChange = (name: keyof FormData, value: string) => {
    // For mobile number, only allow digits
    if (name === 'mobileNumber') {
      value = value.replace(/[^0-9]/g, '');
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));

    // Re-validate confirm password if password changes
    if (name === 'password' && formData.confirmPassword) {
      const confirmError = validateField(
        'confirmPassword',
        formData.confirmPassword
      );
      setErrors((prev) => ({ ...prev, confirmPassword: confirmError }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const requiredFields: (keyof FormData)[] = [
      'fullName',
      'mobileNumber',
      'password',
      'confirmPassword',
    ];

    requiredFields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    // Validate email only if provided
    if (formData.email.trim()) {
      const emailError = validateField('email', formData.email);
      if (emailError) newErrors.email = emailError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Using mobile number as email format for Firebase auth
      const authEmail = `${formData.mobileNumber}@buyer.krishaksarthi.app`;
      
      const result = await signUp(authEmail, formData.password);
      if (!result.success) {
        Alert.alert(
          tr('buyerSignUp.title', 'Create Buyer Account'),
          result.message
        );
        return;
      }

      // Update display name
      await updateCurrentAuthProfile({ displayName: formData.fullName });

      // Save buyer profile data
      const buyerProfile = {
        fullName: formData.fullName,
        mobileNumber: formData.mobileNumber,
        email: formData.email || '',
        role: 'buyer',
        preferredLanguage: i18n.language,
        createdAt: new Date().toISOString(),
      };

      await saveCurrentUserProfile(buyerProfile);

      Alert.alert(
        tr('buyerSignUp.success', 'Success'),
        tr('buyerSignUp.accountCreated', 'Your buyer account has been created successfully!'),
        [
          {
            text: tr('buyerSignUp.continue', 'Continue'),
            onPress: () => navigation.navigate('BuyerDashboard'),
          },
        ]
      );
    } catch (error) {
      console.error('Buyer sign up error:', error);
      Alert.alert(
        tr('buyerSignUp.title', 'Create Buyer Account'),
        tr('buyerSignUp.errors.default', 'Account creation failed. Please try again.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    return (
      formData.fullName &&
      formData.mobileNumber &&
      formData.password &&
      formData.confirmPassword &&
      !errors.fullName &&
      !errors.mobileNumber &&
      !errors.email &&
      !errors.password &&
      !errors.confirmPassword
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      style={{ backgroundColor: '#FAFAFA' }}
    >
      {/* Decorative Background Shapes */}
      <View style={{
        position: 'absolute',
        top: -100,
        right: -50,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: '#E8F5E9',
        opacity: 0.5,
      }} />
      <View style={{
        position: 'absolute',
        bottom: -80,
        left: -60,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: '#F1F8E9',
        opacity: 0.4,
      }} />
      
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button - Professional Capsule Design */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mb-8"
          style={{
            alignSelf: 'flex-start',
            backgroundColor: '#D1F4E0',
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 24,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            shadowColor: '#16A34A',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 5,
            elevation: 3,
          }}
        >
          <ArrowLeft size={20} color="#16A34A" strokeWidth={2.5} />
          <Text 
            className="text-green-600 font-semibold" 
            style={{ 
              fontSize: 15, 
              lineHeight: 20, 
              letterSpacing: 0.3,
              flexShrink: 0,
              minWidth: 70,
            }}
            numberOfLines={1}
          >
            {tr('buyerSignUp.back', 'ফিরে যান')}
          </Text>
        </TouchableOpacity>

        {/* Header - Innovative Design with Icon */}
        <View className="mb-10">
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: '#16A34A',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
                shadowColor: '#16A34A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}>
                <UserPlus size={26} color="white" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text 
                  className="text-gray-900 font-extrabold" 
                  style={{ fontSize: 30, lineHeight: 36, letterSpacing: -0.5 }}
                >
                  {tr('buyerSignUp.title', 'Create Buyer Account')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Form - Card Style */}
        <View style={{
          backgroundColor: 'white',
          borderRadius: 20,
          padding: 20,
          marginBottom: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 3,
        }}>
          <View style={{ gap: 8 }}>
            <CustomInput
              label={tr('buyerSignUp.fullName', 'Full Name')}
              placeholder={tr('buyerSignUp.fullNamePlaceholder', 'John Doe')}
              value={formData.fullName}
              onChangeText={(value) => handleFieldChange('fullName', value)}
              error={errors.fullName}
            />

            <CustomInput
              label={tr('buyerSignUp.mobileNumber', 'Mobile Number')}
              placeholder={tr('buyerSignUp.mobileNumberPlaceholder', '9876543210')}
              value={formData.mobileNumber}
              onChangeText={(value) => handleFieldChange('mobileNumber', value)}
              keyboardType="phone-pad"
              maxLength={10}
              error={errors.mobileNumber}
            />

            <CustomInput
              label={tr('buyerSignUp.email', 'Email (Optional)')}
              placeholder={tr('buyerSignUp.emailPlaceholder', 'your@email.com')}
              value={formData.email}
              onChangeText={(value) => handleFieldChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <PasswordInput
              label={tr('buyerSignUp.password', 'Password')}
              placeholder={tr('buyerSignUp.passwordPlaceholder', 'Enter password')}
              value={formData.password}
              onChangeText={(value) => handleFieldChange('password', value)}
              error={errors.password}
            />

            <PasswordInput
              label={tr('buyerSignUp.confirmPassword', 'Confirm Password')}
              placeholder={tr('buyerSignUp.confirmPasswordPlaceholder', 'Re-enter password')}
              value={formData.confirmPassword}
              onChangeText={(value) => handleFieldChange('confirmPassword', value)}
              error={errors.confirmPassword}
            />
          </View>
        </View>

        {/* Submit Button - Capsule Design */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isFormValid() || isLoading}
          className="mb-6"
          style={{ 
            paddingVertical: 16, 
            paddingHorizontal: 24,
            borderRadius: 50,
            backgroundColor: !isFormValid() || isLoading ? '#E0E0E0' : '#16A34A',
            shadowColor: !isFormValid() || isLoading ? '#999' : '#16A34A',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
            elevation: 5,
          }}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text 
              className="text-white text-center font-bold" 
              style={{ fontSize: 17, lineHeight: 24, letterSpacing: 0.5 }}
              numberOfLines={1}
            >
              {tr('buyerSignUp.createAccount', 'Create Buyer Account')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Sign In Link - Modern Style */}
        <View className="flex-row justify-center items-center flex-wrap" style={{ paddingVertical: 8 }}>
          <Text className="text-gray-600 text-center" style={{ fontSize: 15, lineHeight: 22, marginRight: 4 }}>
            {tr('buyerSignUp.alreadyHaveAccount', 'Already have an account?')}
          </Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('BuyerSignIn')} 
            style={{ 
              paddingVertical: 6, 
              paddingHorizontal: 12,
              backgroundColor: '#E8F5E9',
              borderRadius: 12,
            }}
          >
            <Text 
              className="text-green-600 font-bold" 
              style={{ fontSize: 15, lineHeight: 20, letterSpacing: 0.3 }}
              numberOfLines={1}
            >
              {tr('buyerSignUp.signInButton', 'Sign In')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
import React, { useState } from 'react';
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
      className="flex-1 bg-white"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mb-6"
        >
          <Text className="text-green-600 text-lg font-medium">
            ← {tr('buyerSignUp.back', 'Back')}
          </Text>
        </TouchableOpacity>

        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-gray-900 mb-2">
            {tr('buyerSignUp.title', 'Create Buyer Account')}
          </Text>
          <Text className="text-gray-600 text-base">
            {tr('buyerSignUp.subtitle', 'Join as a buyer to connect with farmers')}
          </Text>
        </View>

        {/* Form */}
        <View className="mb-6">
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

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isFormValid() || isLoading}
          className={`rounded-xl py-4 mb-6 ${
            !isFormValid() || isLoading ? 'bg-gray-300' : 'bg-green-600'
          }`}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center text-lg font-semibold">
              {tr('buyerSignUp.createAccount', 'Create Buyer Account')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Sign In Link */}
        <View className="flex-row justify-center items-center flex-wrap">
          <Text className="text-gray-600 text-base text-center">
            {tr('buyerSignUp.alreadyHaveAccount', 'Already have an account?')}{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('BuyerSignIn')}>
            <Text className="text-green-600 font-semibold text-base">
              {tr('buyerSignUp.signInButton', 'Sign In')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
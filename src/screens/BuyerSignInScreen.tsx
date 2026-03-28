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
import { CustomInput, PasswordInput } from '../components/CustomInput';
import { RootStackParamList } from '../navigation/AppNavigator';
import { signIn } from '../services/auth';

type BuyerSignInNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'BuyerSignIn'
>;

interface FormData {
  mobileNumber: string;
  password: string;
}

interface FormErrors {
  [key: string]: string;
}

export const BuyerSignInScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<BuyerSignInNavigationProp>();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    mobileNumber: '',
    password: '',
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
      case 'mobileNumber':
        return !value.trim()
          ? tr('buyerSignIn.errors.required', 'Required')
          : !/^\d{10}$/.test(value)
          ? tr('buyerSignIn.errors.invalidMobile', 'Enter a valid 10-digit mobile number')
          : '';
      case 'password':
        return !value ? tr('buyerSignIn.errors.required', 'Required') : '';
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
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const requiredFields: (keyof FormData)[] = ['mobileNumber', 'password'];

    requiredFields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Using mobile number as email format for Firebase auth
      const email = `${formData.mobileNumber}@buyer.krishaksarthi.app`;
      const result = await signIn(email, formData.password);
      
      if (!result.success) {
        const title = tr('buyerSignIn.title', 'Buyer Sign In');

        if (result.errorCode === 'auth/user-not-found') {
          Alert.alert(
            title,
            tr('buyerSignIn.errors.noAccount', "No account found. Don't have an account? Sign Up."),
            [
              { text: tr('buyerSignIn.cancel', 'Cancel'), style: 'cancel' },
              {
                text: tr('buyerSignIn.signUpButton', 'Sign Up'),
                onPress: () => navigation.navigate('BuyerSignUp'),
              },
            ]
          );
          return;
        }

        Alert.alert(title, result.message);
        return;
      }

      // Navigate to buyer dashboard (for now, use regular dashboard)
      navigation.navigate('BuyerDashboard');
    } catch (error) {
      console.error('Buyer sign in error:', error);
      Alert.alert(
        tr('buyerSignIn.title', 'Buyer Sign In'), 
        tr('buyerSignIn.errors.default', 'Sign in failed.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    return (
      formData.mobileNumber &&
      formData.password &&
      !errors.mobileNumber &&
      !errors.password
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
          <Text className="text-primary text-lg font-medium">
            ← {tr('buyerSignIn.back', 'Back')}
          </Text>
        </TouchableOpacity>

        {/* Header */}
        <View className="mb-12">
          <Text className="text-4xl font-bold text-gray-900 mb-2">
            {tr('buyerSignIn.title', 'Buyer Sign In')}
          </Text>
          <Text className="text-gray-600 text-base">
            {tr('buyerSignIn.subtitle', 'Welcome back, buyer')}
          </Text>
        </View>

        {/* Login Form */}
        <View className="mb-6">
          <CustomInput
            label={tr('buyerSignIn.mobileNumber', 'Mobile Number')}
            placeholder={tr('buyerSignIn.mobileNumberPlaceholder', '9876543210')}
            value={formData.mobileNumber}
            onChangeText={(value) => handleFieldChange('mobileNumber', value)}
            keyboardType="phone-pad"
            maxLength={10}
            error={errors.mobileNumber}
          />

          <PasswordInput
            label={tr('buyerSignIn.password', 'Password')}
            placeholder={tr('buyerSignIn.passwordPlaceholder', 'Enter your password')}
            value={formData.password}
            onChangeText={(value) => handleFieldChange('password', value)}
            error={errors.password}
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
              {tr('buyerSignIn.signInButton', 'Sign In')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View className="flex-row justify-center items-center flex-wrap">
          <Text className="text-gray-600 text-base text-center">
            {tr('buyerSignIn.noAccount', "Don't have an account?")}{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('BuyerSignUp')}>
            <Text className="text-green-600 font-semibold text-base">
              {tr('buyerSignIn.signUpButton', 'Sign Up')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
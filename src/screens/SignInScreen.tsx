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
import { Dropdown } from '../components/Dropdown';
import { LANGUAGES } from '../constants/data';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  signIn,
  signInWithGoogle,
} from '../services/auth';

type SignInScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SignIn'
>;

interface FormData {
  email: string;
  password: string;
  preferredLanguage: string;
}

interface FormErrors {
  [key: string]: string;
}

export const SignInScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<SignInScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    preferredLanguage: i18n.language || 'en',
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
      case 'email':
        return !value.trim()
          ? tr('signIn.errors.required', 'Required')
          : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
          ? tr('signIn.errors.invalidEmail', 'Enter a valid email address')
          : '';
      case 'password':
        return !value ? tr('signIn.errors.required', 'Required') : '';
      default:
        return '';
    }
  };

  const handleFieldChange = (name: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const requiredFields: (keyof FormData)[] = ['email', 'password'];

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
      const result = await signIn(formData.email, formData.password);
      if (!result.success) {
        const title = tr('signIn.title', 'Sign In');

        if (result.errorCode === 'auth/user-not-found') {
          Alert.alert(
            title,
            "No account found for this email. Don't have an account? Sign Up.",
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign Up',
                onPress: () => navigation.navigate('SignUp'),
              },
            ]
          );
          return;
        }

        Alert.alert(title, result.message);
        return;
      }

      navigation.navigate('Dashboard');
    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert(tr('signIn.title', 'Sign In'), tr('signIn.errors.default', 'Sign in failed.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLoading) return;

    // This project intentionally supports Google sign-in only on web.
    // Native Google sign-in requires OAuth client IDs (Android/iOS) which we are not using.
    if (Platform.OS !== 'web') {
      Alert.alert(
        tr('signIn.title', 'Sign In'),
        'Google sign-in is available on web only. Please sign in with email/password on mobile.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      if (!result.success) {
        Alert.alert(tr('signIn.title', 'Sign In'), result.message);
        return;
      }
      navigation.navigate('Dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    return (
      formData.email &&
      formData.password &&
      !errors.email &&
      !errors.password
    );
  };

  // Change language when preferred language is selected
  useEffect(() => {
    if (formData.preferredLanguage) {
      i18n.changeLanguage(formData.preferredLanguage);
      // Save language preference
      import('../i18n/i18n').then(({ saveLanguage }) => {
        saveLanguage(formData.preferredLanguage);
      });
    }
  }, [formData.preferredLanguage]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-12 mt-12">
          <Text className="text-4xl font-bold text-gray-900 mb-2">
            {tr('signIn.title', 'Sign In')}
          </Text>
          <Text className="text-gray-600 text-base">
            {tr('signIn.subtitle', 'Welcome back')}
          </Text>
        </View>

        {/* Language Selection */}
        <View className="mb-8">
          <Dropdown
            label={tr('signIn.preferredLanguage', 'Preferred language')}
            placeholder={tr('signIn.languagePlaceholder', 'Select language')}
            value={
              LANGUAGES.find((l) => l.value === formData.preferredLanguage)
                ? (() => {
                    try {
                      const lang = LANGUAGES.find(
                        (l) => l.value === formData.preferredLanguage
                      );
                      return lang ? t(lang.labelKey) : '';
                    } catch {
                      return '';
                    }
                  })()
                : ''
            }
            options={LANGUAGES.map((lang) => {
              try {
                return t(lang.labelKey);
              } catch {
                return lang.value.toUpperCase();
              }
            })}
            onSelect={(value) => {
              try {
                const selectedLang = LANGUAGES.find(
                  (lang) => {
                    try {
                      return t(lang.labelKey) === value;
                    } catch {
                      return lang.value.toUpperCase() === value;
                    }
                  }
                );
                if (selectedLang) {
                  handleFieldChange('preferredLanguage', selectedLang.value);
                }
              } catch (error) {
                console.error('Language selection error:', error);
              }
            }}
          />
        </View>

        {/* Login Form */}
        <View className="mb-6">
          <CustomInput
            label={tr('signIn.email', 'Email')}
            placeholder={tr('signIn.emailPlaceholder', 'Enter your email')}
            value={formData.email}
            onChangeText={(value) => handleFieldChange('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <PasswordInput
            label={tr('signIn.password', 'Password')}
            placeholder={tr('signIn.passwordPlaceholder', 'Enter your password')}
            value={formData.password}
            onChangeText={(value) => handleFieldChange('password', value)}
            error={errors.password}
          />

          {/* Forgot Password Link */}
          <TouchableOpacity className="mb-4">
            <Text className="text-primary text-right text-base font-medium">
              {tr('signIn.forgotPassword', 'Forgot password?')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isFormValid() || isLoading}
          className={`rounded-xl py-4 mb-6 ${
            !isFormValid() || isLoading ? 'bg-gray-300' : 'bg-primary'
          }`}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center text-lg font-semibold">
              {tr('signIn.signInButton', 'Sign In')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Google Sign In (web only) */}
        {Platform.OS === 'web' ? (
          <TouchableOpacity
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            className={`rounded-xl py-4 mb-6 border ${
              isLoading
                ? 'border-gray-300 bg-gray-50'
                : 'border-gray-300 bg-white'
            }`}
          >
            <Text
              className={`text-center text-lg font-semibold ${
                isLoading ? 'text-gray-400' : 'text-gray-900'
              }`}
            >
              {tr('signIn.googleButton', 'Sign in with Google')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Sign Up Link */}
        <View className="flex-row justify-center items-center flex-wrap">
          <Text className="text-gray-600 text-base text-center">
            {tr('signIn.noAccount', "Don't have an account?")}{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text className="text-primary font-semibold text-base">
              {tr('signIn.signUp', 'Sign Up')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
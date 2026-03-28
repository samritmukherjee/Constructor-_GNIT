import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CustomInput, PasswordInput } from '../components/CustomInput';
import { Dropdown } from '../components/Dropdown';
import { LANGUAGES } from '../constants/data';
import { RootStackParamList } from '../navigation/AppNavigator';
import { localizeNumber, delocalizeNumber } from '../utils/numberLocalization';

type SignInScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SignIn'
>;

interface FormData {
  mobileNumber: string;
  password: string;
  preferredLanguage: string;
}

interface FormErrors {
  [key: string]: string;
}

export const SignInScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<SignInScreenNavigationProp>();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    mobileNumber: '',
    password: '',
    preferredLanguage: i18n.language || 'en',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const validateField = (name: keyof FormData, value: string): string => {
    switch (name) {
      case 'mobileNumber':
        return !value.trim()
          ? t('signIn.errors.required')
          : !/^\d{10}$/.test(value)
          ? t('signIn.errors.invalidMobile')
          : '';
      case 'password':
        return !value ? t('signIn.errors.required') : '';
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
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log('Sign in:', formData);
      // Navigate to Dashboard on successful login
      navigation.navigate('Dashboard');
    } catch (error) {
      console.error('Sign in error:', error);
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
        contentContainerStyle={{ padding: 24, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-12 mt-12">
          <Text className="text-4xl font-bold text-gray-900 mb-2">
            {t('signIn.title')}
          </Text>
          <Text className="text-gray-600 text-base">
            {t('signIn.subtitle')}
          </Text>
        </View>

        {/* Language Selection */}
        <View className="mb-8">
          <Dropdown
            label={t('signIn.preferredLanguage')}
            placeholder={t('signIn.languagePlaceholder')}
            value={
              LANGUAGES.find((l) => l.value === formData.preferredLanguage)
                ? t(
                    LANGUAGES.find(
                      (l) => l.value === formData.preferredLanguage
                    )!.labelKey
                  )
                : ''
            }
            options={LANGUAGES.map((lang) => t(lang.labelKey))}
            onSelect={(value) => {
              const selectedLang = LANGUAGES.find(
                (lang) => t(lang.labelKey) === value
              );
              if (selectedLang) {
                handleFieldChange('preferredLanguage', selectedLang.value);
              }
            }}
          />
        </View>

        {/* Login Form */}
        <View className="mb-6">
          <CustomInput
            label={t('signIn.mobileNumber')}
            placeholder={localizeNumber(t('signIn.mobileNumberPlaceholder'), i18n.language)}
            value={localizeNumber(formData.mobileNumber, i18n.language)}
            onChangeText={(value) => {
              const delocalized = delocalizeNumber(value, i18n.language);
              handleFieldChange('mobileNumber', delocalized);
            }}
            keyboardType="phone-pad"
            maxLength={10}
            error={errors.mobileNumber}
          />

          <PasswordInput
            label={t('signIn.password')}
            placeholder={t('signIn.passwordPlaceholder')}
            value={formData.password}
            onChangeText={(value) => handleFieldChange('password', value)}
            error={errors.password}
          />

          {/* Forgot Password Link */}
          <TouchableOpacity className="mb-4">
            <Text className="text-primary text-right text-base font-medium">
              {t('signIn.forgotPassword')}
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
              {t('signIn.signInButton')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View className="flex-row justify-center items-center flex-wrap">
          <Text className="text-gray-600 text-base text-center">
            {t('signIn.noAccount')}{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text className="text-primary font-semibold text-base">
              {t('signIn.signUp')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

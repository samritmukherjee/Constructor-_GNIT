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
import { INDIAN_STATES, FARMER_TYPES, LANGUAGES } from '../constants/data';
import { RootStackParamList } from '../navigation/AppNavigator';
import { localizeNumber, delocalizeNumber } from '../utils/numberLocalization';

type SignUpScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SignUp'
>;

interface FormData {
  fullName: string;
  mobileNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
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
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    mobileNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    state: '',
    district: '',
    preferredLanguage: 'en',
    farmerType: '',
    landSize: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const validateField = (name: keyof FormData, value: string): string => {
    switch (name) {
      case 'fullName':
        return !value.trim() ? t('signUp.errors.required') : '';
      case 'mobileNumber':
        return !value.trim()
          ? t('signUp.errors.required')
          : !/^\d{10}$/.test(value)
          ? t('signUp.errors.invalidMobile')
          : '';
      case 'email':
        return value.trim() &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
          ? t('signUp.errors.invalidEmail')
          : '';
      case 'password':
        return !value
          ? t('signUp.errors.required')
          : value.length < 6
          ? t('signUp.errors.passwordMinLength')
          : '';
      case 'confirmPassword':
        return !value
          ? t('signUp.errors.required')
          : value !== formData.password
          ? t('signUp.errors.passwordMismatch')
          : '';
      case 'state':
      case 'preferredLanguage':
      case 'farmerType':
      case 'landSize':
        return !value.trim() ? t('signUp.errors.required') : '';
      default:
        return '';
    }
  };

  const handleFieldChange = (name: keyof FormData, value: string) => {
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
      'state',
      'preferredLanguage',
      'farmerType',
      'landSize',
    ];

    requiredFields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    // Validate optional email if provided
    if (formData.email) {
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
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log('Form submitted:', formData);
      // Handle successful signup (e.g., navigate to home screen)
    } catch (error) {
      console.error('Signup error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    const requiredFields = [
      'fullName',
      'mobileNumber',
      'password',
      'confirmPassword',
      'state',
      'preferredLanguage',
      'farmerType',
      'landSize',
    ];
    return (
      requiredFields.every((field) => formData[field as keyof FormData]) &&
      Object.keys(errors).every((key) => !errors[key])
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
        <View className="mb-8 mt-4">
          <Text className="text-3xl font-bold text-gray-900 mb-2">
            {t('signUp.title')}
          </Text>
        </View>

        {/* Preferred Language Section - Moved to Top */}
        <View className="mb-6">
          <Dropdown
            label={t('signUp.preferredLanguage')}
            placeholder={t('signUp.languagePlaceholder')}
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
            error={errors.preferredLanguage}
          />
        </View>

        {/* Account Information Section */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-gray-800 mb-4">
            {t('signUp.accountInfo')}
          </Text>

          <CustomInput
            label={t('signUp.fullName')}
            placeholder={t('signUp.fullNamePlaceholder')}
            value={formData.fullName}
            onChangeText={(value) => handleFieldChange('fullName', value)}
            error={errors.fullName}
          />

          <CustomInput
            label={t('signUp.mobileNumber')}
            placeholder={localizeNumber(t('signUp.mobileNumberPlaceholder'), i18n.language)}
            value={localizeNumber(formData.mobileNumber, i18n.language)}
            onChangeText={(value) => {
              const delocalized = delocalizeNumber(value, i18n.language);
              handleFieldChange('mobileNumber', delocalized);
            }}
            keyboardType="phone-pad"
            maxLength={10}
            error={errors.mobileNumber}
          />

          <CustomInput
            label={t('signUp.email')}
            placeholder={t('signUp.emailPlaceholder')}
            value={formData.email}
            onChangeText={(value) => handleFieldChange('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <PasswordInput
            label={t('signUp.password')}
            placeholder={t('signUp.passwordPlaceholder')}
            value={formData.password}
            onChangeText={(value) => handleFieldChange('password', value)}
            error={errors.password}
          />

          <PasswordInput
            label={t('signUp.confirmPassword')}
            placeholder={t('signUp.confirmPasswordPlaceholder')}
            value={formData.confirmPassword}
            onChangeText={(value) =>
              handleFieldChange('confirmPassword', value)
            }
            error={errors.confirmPassword}
          />
        </View>

        {/* Personal Information Section */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-gray-800 mb-4">
            {t('signUp.personalInfo')}
          </Text>

          <Dropdown
            label={t('signUp.state')}
            placeholder={t('signUp.statePlaceholder')}
            value={formData.state}
            options={INDIAN_STATES}
            onSelect={(value) => handleFieldChange('state', value)}
            error={errors.state}
          />

          <CustomInput
            label={t('signUp.district')}
            placeholder={t('signUp.districtPlaceholder')}
            value={formData.district}
            onChangeText={(value) => handleFieldChange('district', value)}
            editable={!!formData.state}
          />
        </View>

        {/* Farming Information Section */}
        <View className="mb-8">
          <Text className="text-xl font-semibold text-gray-800 mb-4">
            {t('signUp.farmingInfo')}
          </Text>

          <Dropdown
            label={t('signUp.farmerType')}
            placeholder={t('signUp.farmerTypePlaceholder')}
            value={
              FARMER_TYPES.find((f) => f.value === formData.farmerType)
                ? t(
                    FARMER_TYPES.find((f) => f.value === formData.farmerType)!
                      .labelKey
                  )
                : ''
            }
            options={FARMER_TYPES.map((type) => t(type.labelKey))}
            onSelect={(value) => {
              const selectedType = FARMER_TYPES.find(
                (type) => t(type.labelKey) === value
              );
              if (selectedType) {
                handleFieldChange('farmerType', selectedType.value);
              }
            }}
            error={errors.farmerType}
          />

          <CustomInput
            label={t('signUp.landSize')}
            placeholder={t('signUp.landSizePlaceholder')}
            value={formData.landSize}
            onChangeText={(value) => handleFieldChange('landSize', value)}
            keyboardType="decimal-pad"
            suffix={t('signUp.acres')}
            error={errors.landSize}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isFormValid() || isLoading}
          className={`rounded-xl py-4 mb-4 ${
            !isFormValid() || isLoading ? 'bg-gray-300' : 'bg-primary'
          }`}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center text-lg font-semibold">
              {isLoading ? t('signUp.creating') : t('signUp.createAccount')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Sign In Link */}
        <View className="flex-row justify-center items-center flex-wrap">
          <Text className="text-gray-600 text-base text-center">
            {t('signUp.alreadyHaveAccount')}{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text className="text-primary font-semibold text-base">
              {t('signUp.signIn')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

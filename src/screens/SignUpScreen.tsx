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
import { INDIAN_STATES, FARMER_TYPES, LANGUAGES } from '../constants/data';
import { RootStackParamList } from '../navigation/AppNavigator';
import { localizeNumber, delocalizeNumber } from '../utils/numberLocalization';
import {
  signUp,
  signInWithGoogle,
  saveCurrentUserProfile,
  updateCurrentAuthProfile,
} from '../services/auth';

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
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
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
      case 'mobileNumber':
        return !value.trim()
          ? tr('signUp.errors.required', 'Required')
          : !/^\d{10}$/.test(value)
            ? tr('signUp.errors.invalidMobile', 'Enter a valid 10-digit mobile number')
            : '';
      case 'email':
        return !value.trim()
          ? tr('signUp.errors.required', 'Required')
          : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
            ? tr('signUp.errors.invalidEmail', 'Enter a valid email address')
            : '';
      case 'password':
        return !value
          ? tr('signUp.errors.required', 'Required')
          : value.length < 6
            ? tr('signUp.errors.passwordMinLength', 'Password must be at least 6 characters')
            : '';
      case 'confirmPassword':
        return !value
          ? tr('signUp.errors.required', 'Required')
          : value !== formData.password
            ? tr('signUp.errors.passwordMismatch', 'Passwords do not match')
            : '';
      case 'state':
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
      'email',
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const result = await signUp(formData.email, formData.password);
      if (!result.success) {
        Alert.alert(tr('signUp.title', 'Sign Up'), result.message);
        return;
      }

      // Store display name in Firebase Auth
      if (formData.fullName?.trim()) {
        await updateCurrentAuthProfile({ displayName: formData.fullName.trim() });
      }

      // Save profile to Firestore
      await saveCurrentUserProfile({
        fullName: formData.fullName,
        mobileNumber: formData.mobileNumber,
        email: formData.email,
        state: formData.state,
        district: formData.district,
        preferredLanguage: formData.preferredLanguage,
        farmerType: formData.farmerType,
        landSize: formData.landSize,
        notificationsEnabled: true,
        profilePhoto: null,
      });

      navigation.navigate('Dashboard');
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert(tr('signUp.title', 'Sign Up'), tr('signUp.errors.default', 'Sign up failed.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (googleBusy || isLoading) return;

    // This project intentionally supports Google sign-up only on web.
    // Native Google sign-in requires OAuth client IDs (Android/iOS) which we are not using.
    if (Platform.OS !== 'web') {
      Alert.alert(
        tr('signUp.title', 'Sign Up'),
        tr('signUp.googleNativeNotSupported', 'Google sign-up is available on web only. Please sign up with email/password on mobile.')
      );
      return;
    }

    setGoogleBusy(true);
    try {
      const result = await signInWithGoogle();
      if (!result.success) {
        Alert.alert(tr('signUp.title', 'Sign Up'), result.message);
        return;
      }
      navigation.navigate('Dashboard');
    } catch (error) {
      console.error('Google sign-up error:', error);
      Alert.alert(tr('signUp.title', 'Sign Up'), tr('signUp.googleError', 'Google sign-up failed.'));
    } finally {
      setGoogleBusy(false);
    }
  };

  const isFormValid = () => {
    const requiredFields = [
      'fullName',
      'mobileNumber',
      'email',
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
        contentContainerStyle={{ padding: 24, paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-8 mt-4">
          <Text className="text-3xl font-bold text-gray-900 mb-2">
            {tr('signUp.title', 'Sign Up')}
          </Text>
        </View>

        {/* Preferred Language Section - Moved to Top */}
        <View className="mb-6">
          <Dropdown
            label={tr('signUp.preferredLanguage', 'Preferred Language')}
            placeholder={tr('signUp.languagePlaceholder', 'Select language')}
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
            error={errors.preferredLanguage}
          />
        </View>

        {/* Account Information Section */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-gray-800 mb-4">
            {tr('signUp.accountInfo', 'Account Information')}
          </Text>

          <CustomInput
            label={tr('signUp.fullName', 'Full Name')}
            placeholder={tr('signUp.fullNamePlaceholder', 'Enter your full name')}
            value={formData.fullName}
            onChangeText={(value) => handleFieldChange('fullName', value)}
            error={errors.fullName}
          />

          <CustomInput
            label={tr('signUp.mobileNumber', 'Mobile Number')}
            placeholder={localizeNumber(tr('signUp.mobileNumberPlaceholder', 'Enter 10-digit mobile number'), i18n.language)}
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
            label={tr('signUp.email', 'Email')}
            placeholder={tr('signUp.emailPlaceholder', 'Enter your email')}
            value={formData.email}
            onChangeText={(value) => handleFieldChange('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <PasswordInput
            label={tr('signUp.password', 'Password')}
            placeholder={tr('signUp.passwordPlaceholder', 'Enter password (min 6 characters)')}
            value={formData.password}
            onChangeText={(value) => handleFieldChange('password', value)}
            error={errors.password}
          />

          <PasswordInput
            label={tr('signUp.confirmPassword', 'Confirm Password')}
            placeholder={tr('signUp.confirmPasswordPlaceholder', 'Re-enter your password')}
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
            {tr('signUp.personalInfo', 'Personal Information')}
          </Text>

          <Dropdown
            label={tr('signUp.state', 'State')}
            placeholder={tr('signUp.statePlaceholder', 'Select your state')}
            value={formData.state}
            options={INDIAN_STATES}
            onSelect={(value) =>
              handleFieldChange(
                'state',
                typeof value === 'string' ? value : value.value
              )
            }
            error={errors.state}
          />

          <CustomInput
            label={tr('signUp.district', 'District')}
            placeholder={tr('signUp.districtPlaceholder', 'Enter your district')}
            value={formData.district}
            onChangeText={(value) => handleFieldChange('district', value)}
            editable={!!formData.state}
          />
        </View>

        {/* Farming Information Section */}
        <View className="mb-8">
          <Text className="text-xl font-semibold text-gray-800 mb-4">
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
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isFormValid() || isLoading}
          className={`rounded-xl py-4 mb-4 ${!isFormValid() || isLoading ? 'bg-gray-300' : 'bg-primary'
            }`}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center text-lg font-semibold">
              {isLoading ? tr('signUp.creating', 'Creating...') : tr('signUp.createAccount', 'Create Account')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Google Sign Up (web only) */}
        {Platform.OS === 'web' ? (
          <TouchableOpacity
            onPress={handleGoogleSignUp}
            disabled={googleBusy || isLoading}
            className={`rounded-xl py-4 mb-6 border ${googleBusy || isLoading
                ? 'border-gray-300 bg-gray-50'
                : 'border-gray-300 bg-white'
              }`}
          >
            <Text
              className={`text-center text-lg font-semibold ${googleBusy || isLoading ? 'text-gray-400' : 'text-gray-900'
                }`}
            >
              {tr('signUp.googleButton', 'Sign up with Google')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Sign In Link */}
        <View className="flex-row justify-center items-center flex-wrap">
          <Text className="text-gray-600 text-base text-center">
            {tr('signUp.alreadyHaveAccount', 'Already have an account?')}{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text className="text-primary font-semibold text-base">
              {tr('signUp.signIn', 'Sign In')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
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
import { Sprout, ShoppingBasket } from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import { RouteProp, useRoute } from '@react-navigation/native';
import { CustomInput, PasswordInput } from '../components/CustomInput';
import { Dropdown } from '../components/Dropdown';
import { INDIAN_STATES, FARMER_TYPES, LANGUAGES, INDIAN_DISTRICTS } from '../constants/data';
import { RootStackParamList } from '../navigation/AppNavigator';
import { localizeNumber, delocalizeNumber } from '../utils/numberLocalization';
import {
  signUp,
  saveCurrentUserProfile,
  updateCurrentAuthProfile,
  signInWithGoogle,
} from '../services/auth';
import { detectCurrentLocation } from '../services/location';

type SignUpScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SignUp'
>;

type SignUpScreenRouteProp = RouteProp<RootStackParamList, 'SignUp'>;

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
  const route = useRoute<SignUpScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const role = route.params?.role || 'farmer';
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    mobileNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    state: '',
    district: '',
    preferredLanguage: i18n.language || 'en',
    farmerType: '',
    landSize: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // Load saved language on mount
  useEffect(() => {
    const loadSavedLanguage = async () => {
      try {
        const { loadLanguage } = await import('../i18n/i18n');
        await loadLanguage();
        // Update preferredLanguage in form data to match current language
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

      // Prefer mapped values so dropdown shows correctly; otherwise keep existing.
      setFormData((prev) => ({
        ...prev,
        state: res.location.stateValue || prev.state,
        district: res.location.districtValue || prev.district,
      }));
    };

    // Don’t block UI; best-effort.
    detect();
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
    ];
    
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

      // Save profile to Firestore with role
      const profileData: any = {
        fullName: formData.fullName,
        mobileNumber: formData.mobileNumber,
        email: formData.email,
        role: role, // Save the role
        notificationsEnabled: true,
        profilePhoto: null,
      };

      // Persist detected/manual location for all roles (buyer + farmer)
      if (formData.state) profileData.state = formData.state;
      if (formData.district) profileData.district = formData.district;

      // Add farmer-specific fields only for farmers
      if (role === 'farmer') {
        profileData.preferredLanguage = formData.preferredLanguage;
        profileData.farmerType = formData.farmerType;
        profileData.landSize = formData.landSize;
      }

      await saveCurrentUserProfile(profileData);

      // Navigate based on role
      if (role === 'buyer') {
        navigation.navigate('BuyerDashboard');
      } else {
        navigation.navigate('Dashboard');
      }
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
      
      // Save role to profile for Google sign-ups
      await saveCurrentUserProfile({ role });
      
      // Navigate based on role
      if (role === 'buyer') {
        navigation.navigate('BuyerDashboard');
      } else {
        navigation.navigate('Dashboard');
      }
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
    ];
    
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
    
    return (
      requiredFields.every((field) => formData[field as keyof FormData]) &&
      Object.keys(errors).every((key) => !errors[key])
    );
  };

  // Change language when preferred language is selected
  useEffect(() => {
    if (formData.preferredLanguage) {
      // Save language preference (which also changes the language)
      import('../i18n/i18n').then(({ saveLanguage }) => {
        saveLanguage(formData.preferredLanguage);
      });
    }
  }, [formData.preferredLanguage]);

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
        {/* Back Button */}
        <View className="mb-8">
          <BackButton />
        </View>

        {/* Back Button - Professional Capsule Design */}
        <View style={{ display: 'none' }}>
          {(() => {
            try {
              const translated = t('common.back');
              return translated === 'common.back' ? 'Back' : translated;
            } catch {
                return 'Back';
              }
            })()}
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
                backgroundColor: role === 'farmer' ? '#16A34A' : '#10B981',
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
                ) : (
                  <ShoppingBasket size={26} color="white" strokeWidth={2.5} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text 
                  className="text-gray-900 font-extrabold" 
                  style={{ fontSize: 30, lineHeight: 36, letterSpacing: -0.5 }}
                >
                  {tr('signUp.title', role === 'farmer' ? 'Farmer Sign Up' : 'Buyer Sign Up')}
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
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 3,
        }}>
          {/* Account Information Section */}
          <Text 
            className="text-gray-800 font-bold" 
            style={{ fontSize: 16, marginBottom: 12, letterSpacing: 0.3 }}
          >
            {tr('signUp.accountInfo', 'Account Information')}
          </Text>
          
          <View style={{ gap: 8 }}>
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

          {/* Farmer-Specific Fields */}
          {role === 'farmer' && (
            <>
              {/* Personal Information Section */}
              <Text 
                className="text-gray-800 font-bold" 
                style={{ fontSize: 16, marginBottom: 12, marginTop: 16, letterSpacing: 0.3 }}
              >
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
          <Text 
            className="text-gray-800 font-bold" 
            style={{ fontSize: 16, marginBottom: 12, marginTop: 16, letterSpacing: 0.3 }}
          >
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
          <TouchableOpacity onPress={() => navigation.navigate('SignIn', { role })}>
            <Text className="text-primary font-semibold text-base">
              {tr('signUp.signIn', 'Sign In')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
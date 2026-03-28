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
import { Sprout, ArrowLeft } from 'lucide-react-native';
import { CustomInput, PasswordInput } from '../components/CustomInput';
import { RootStackParamList } from '../navigation/AppNavigator';
import { signIn } from '../services/auth';

type SignInScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SignIn'
>;

interface FormData {
  email: string;
  password: string;
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
      case 'email':
        return !value.trim()
          ? tr('signIn.errors.required', 'Required')
          : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
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
      // Using email directly for Firebase auth
      const result = await signIn(formData.email, formData.password);

      if (!result.success) {
        const title = tr('signIn.title', 'Farmer Sign In');

        if (result.errorCode === 'auth/user-not-found') {
          Alert.alert(
            title,
            tr('signIn.errors.noAccount', "No account found. Don't have an account? Sign Up."),
            [
              { text: tr('signIn.cancel', 'Cancel'), style: 'cancel' },
              {
                text: tr('signIn.signUp', 'Sign Up'),
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
      console.error('Farmer sign in error:', error);
      Alert.alert(
        tr('signIn.title', 'Farmer Sign In'),
        tr('signIn.errors.default', 'Sign in failed.')
      );
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
      style={{ backgroundColor: '#FAFAFA' }}
    >
      {/* Decorative Background Shape */}
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
        contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: Math.max(insets.bottom, 24) + 40 }}
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
            {tr('signIn.back', 'ফিরে যান')}
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
                <Sprout size={26} color="white" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text 
                  className="text-gray-900 font-extrabold" 
                  style={{ fontSize: 32, lineHeight: 38, letterSpacing: -0.5 }}
                >
                  {tr('signIn.title', 'Farmer Sign In')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Login Form - Card Style */}
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
              label={tr('signIn.email', 'Email')}
              placeholder={tr('signIn.emailPlaceholder', 'your@email.com')}
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
              {tr('signIn.signInButton', 'Sign In')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Sign Up Link - Modern Style */}
        <View className="flex-row justify-center items-center flex-wrap" style={{ paddingVertical: 8 }}>
          <Text className="text-gray-600 text-center" style={{ fontSize: 15, lineHeight: 22, marginRight: 4 }}>
            {tr('signIn.noAccount', "Don't have an account?")}
          </Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('SignUp')} 
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
              {tr('signIn.signUp', 'Sign Up')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
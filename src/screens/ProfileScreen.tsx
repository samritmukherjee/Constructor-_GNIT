import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { User, Mail, Phone, MapPin, Globe, Sprout, Bell, ArrowLeft, ShoppingBag } from 'lucide-react-native';
import { CustomInput } from '../components/CustomInput';
import { Dropdown } from '../components/Dropdown';
import { INDIAN_STATES, FARMER_TYPES, LANGUAGES, INDIAN_DISTRICTS } from '../constants/data';
import { RootStackParamList } from '../navigation/AppNavigator';
import { saveLanguage } from '../i18n/i18n';
import { localizeNumber } from '../utils/numberLocalization';
import {
  fetchCurrentUserProfile,
  logout,
  onAuthStateChange,
  saveCurrentUserProfile,
  updateCurrentAuthProfile,
  uploadProfilePicture,
} from '../services/auth';

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Profile'
>;

interface ProfileData {
  fullName: string;
  mobileNumber: string;
  email: string;
  state: string;
  district: string;
  preferredLanguage: string;
  farmerType: string;
  landSize: string;
  notificationsEnabled: boolean;
  profilePhoto: string | null;
  userType?: 'farmer' | 'buyer'; // Add user type
  companyName?: string; // For buyers
  businessType?: string; // For buyers
}

export const ProfileScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const [initialData, setInitialData] = useState<ProfileData>({
    fullName: '',
    mobileNumber: '',
    email: '',
    state: '',
    district: '',
    preferredLanguage: i18n.language,
    farmerType: '',
    landSize: '',
    notificationsEnabled: true,
    profilePhoto: null,
    userType: 'farmer', // default
    companyName: '',
    businessType: '',
  });

  const [profileData, setProfileData] = useState<ProfileData>(initialData);

  const tr = (key: string, fallback: string) => {
    try {
      return i18n.exists(key) ? (t(key) as string) : fallback;
    } catch {
      return fallback;
    }
  };

  // Check if there are any changes
  useEffect(() => {
    const changed = JSON.stringify(profileData) !== JSON.stringify(initialData);
    setHasChanges(changed);
  }, [profileData, initialData]);

  // Load profile from Firebase Auth + Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (!user) {
        navigation.navigate('SignIn', {});
        return;
      }

      setIsProfileLoading(true);
      try {
        const profileResult = await fetchCurrentUserProfile();
        const stored: any = profileResult.success ? profileResult.profile : {};

        const next: ProfileData = {
          fullName: (stored.fullName as string) || user.displayName || '',
          mobileNumber: (stored.mobileNumber as string) || '',
          email: (stored.email as string) || user.email || '',
          state: (stored.state as string) || '',
          district: (stored.district as string) || '',
          preferredLanguage: (stored.preferredLanguage as string) || i18n.language,
          farmerType: (stored.farmerType as string) || '',
          landSize: (stored.landSize as string) || '',
          userType: (stored.userType as 'farmer' | 'buyer') || 'farmer',
          companyName: (stored.companyName as string) || '',
          businessType: (stored.businessType as string) || '',
          notificationsEnabled:
            typeof stored.notificationsEnabled === 'boolean'
              ? stored.notificationsEnabled
              : true,
          profilePhoto:
            (stored.profilePhoto as string) || user.photoURL || null,
        };

        setInitialData(next);
        setProfileData(next);
      } catch (e) {
        console.error('Profile load error:', e);
      } finally {
        setIsProfileLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Change language when preferred language changes
  useEffect(() => {
    if (profileData.preferredLanguage) {
      // Save language preference (which also changes the language)
      saveLanguage(profileData.preferredLanguage);
    }
  }, [profileData.preferredLanguage]);

  const handleFieldChange = (field: keyof ProfileData, value: any) => {
    setProfileData((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        tr('profile.permissions.title', 'Permissions Required'),
        tr('profile.permissions.message', 'Please grant access to your photo library to change your profile picture.')
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      handleFieldChange('profilePhoto', result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        tr('profile.permissions.cameraTitle', 'Camera Permission Required'),
        tr('profile.permissions.cameraMessage', 'Please grant camera access to take a photo.')
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      handleFieldChange('profilePhoto', result.assets[0].uri);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      tr('profile.photoOptions.title', 'Change Profile Photo'),
      tr('profile.photoOptions.message', 'Choose an option'),
      [
        { text: tr('profile.photoOptions.camera', 'Take Photo'), onPress: takePhoto },
        { text: tr('profile.photoOptions.gallery', 'Choose from Library'), onPress: pickImage },
        { text: tr('profile.photoOptions.cancel', 'Cancel'), style: 'cancel' },
      ]
    );
  };

  const handleSaveChanges = async () => {
    setIsLoading(true);
    try {
      let photoURL = profileData.profilePhoto;

      // 1. If photo changed and is a local URI, upload it first
      if (
        profileData.profilePhoto &&
        profileData.profilePhoto !== initialData.profilePhoto &&
        (profileData.profilePhoto.startsWith('file://') ||
          profileData.profilePhoto.startsWith('content://') ||
          !profileData.profilePhoto.startsWith('http'))
      ) {
        const uploadedURL = await uploadProfilePicture(profileData.profilePhoto);
        if (uploadedURL) {
          photoURL = uploadedURL;
        }
      }

      const updatedProfile = {
        ...profileData,
        profilePhoto: photoURL,
      };

      // 2. Persist to Firestore
      await saveCurrentUserProfile(updatedProfile);

      // 3. Keep Auth displayName/photoURL in sync
      if (profileData.fullName?.trim()) {
        await updateCurrentAuthProfile({
          displayName: profileData.fullName.trim(),
          photoURL: photoURL ?? undefined,
        });
      }

      setProfileData(updatedProfile);
      setInitialData(updatedProfile);
      Alert.alert(
        tr('profile.success.title', 'Success'),
        tr('profile.success.message', 'Profile updated successfully!')
      );
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert(tr('profile.error.title', 'Error'), tr('profile.error.message', 'Failed to update profile. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      tr('profile.logout.confirmTitle', 'Confirm Logout'),
      tr('profile.logout.confirmMessage', 'Are you sure you want to logout?'),
      [
        { text: tr('profile.logout.cancel', 'Cancel'), style: 'cancel' },
        {
          text: tr('profile.logout.confirm', 'Logout'),
          style: 'destructive',
          onPress: async () => {
            const result = await logout();
            if (!result.success) {
              Alert.alert(tr('profile.error.title', 'Error'), result.message);
              return;
            }
            navigation.navigate('SignIn', {});
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Village Sky Gradient Background */}
      <LinearGradient
        colors={['#E0F2FE', '#F0F9FF', '#F0FDF4', '#FFFBEB']}
        locations={[0, 0.3, 0.7, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      
      {/* Decorative Background Elements */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        {/* Sun Glow */}
        <View style={{
          position: 'absolute',
          top: 60,
          right: 30,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: '#FCD34D',
          opacity: 0.2,
        }} />
        {/* Cloud-like shapes */}
        <View style={{
          position: 'absolute',
          top: 150,
          left: 20,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: '#FFFFFF',
          opacity: 0.3,
        }} />
        <View style={{
          position: 'absolute',
          bottom: 100,
          right: 40,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: '#BBF7D0',
          opacity: 0.15,
        }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Gradient */}
        <LinearGradient
          colors={profileData.userType === 'buyer' ? ['#3B82F6', '#2563EB', '#1D4ED8'] : ['#22C55E', '#16A34A', '#15803D']}
          style={{
            paddingTop: insets.top + 20,
            paddingBottom: 80,
            paddingHorizontal: 20,
          }}
        >
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 5,
            elevation: 3,
            alignSelf: 'flex-start',
            marginBottom: 20,
          }}
        >
          <ArrowLeft size={20} color={profileData.userType === 'buyer' ? '#3B82F6' : '#16A34A'} strokeWidth={2.5} />
          <Text 
            style={{ 
              color: profileData.userType === 'buyer' ? '#3B82F6' : '#16A34A',
              fontWeight: '600',
              fontSize: 15, 
              lineHeight: 20, 
              letterSpacing: 0.3,
              flexShrink: 0,
              minWidth: 70,
            }}
            numberOfLines={1}
          >
            {tr('profile.back', 'Back')}
          </Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 28, fontWeight: '700', color: '#FFFFFF' }}>
          {tr('profile.title', 'My Profile')}
        </Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16 }}>
        {isProfileLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={profileData.userType === 'buyer' ? '#3B82F6' : '#22C55E'} />
          </View>
        ) : (
          <>
            {/* Profile Card - Unique & Stylish */}
            <View style={{
              marginTop: -70,
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 24,
              shadowColor: profileData.userType === 'buyer' ? '#3B82F6' : '#22C55E',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 8,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: profileData.userType === 'buyer' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            }}>
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={showImageOptions}
                  activeOpacity={0.8}
                  style={{ position: 'relative', marginBottom: 20 }}
                >
                  {/* Outer animated ring */}
                  <View style={{
                    width: 150,
                    height: 150,
                    borderRadius: 75,
                    backgroundColor: profileData.userType === 'buyer' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 8,
                  }}>
                    <LinearGradient
                      colors={profileData.userType === 'buyer' ? ['#3B82F6', '#2563EB', '#1D4ED8'] : ['#22C55E', '#16A34A', '#15803D']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        width: 134,
                        height: 134,
                        borderRadius: 67,
                        padding: 5,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View style={{
                        width: 124,
                        height: 124,
                        borderRadius: 62,
                        backgroundColor: '#F9FAFB',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        borderWidth: 3,
                        borderColor: '#FFFFFF',
                      }}>
                        {profileData.profilePhoto ? (
                          <Image
                            source={{ uri: profileData.profilePhoto }}
                            style={{ width: '100%', height: '100%' }}
                          />
                        ) : (
                          <User size={54} color="#9CA3AF" strokeWidth={1.5} />
                        )}
                      </View>
                    </LinearGradient>
                  </View>
                  
                  {/* Camera button with pulse effect */}
                  <LinearGradient
                    colors={profileData.userType === 'buyer' ? ['#3B82F6', '#2563EB'] : ['#22C55E', '#16A34A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      position: 'absolute',
                      bottom: 5,
                      right: 5,
                      borderRadius: 25,
                      padding: 12,
                      borderWidth: 4,
                      borderColor: '#FFFFFF',
                      shadowColor: profileData.userType === 'buyer' ? '#3B82F6' : '#22C55E',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                  >
                    <Ionicons name="camera" size={22} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
                
                {/* Stylish "Tap to change" text with icon */}
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: 6,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: profileData.userType === 'buyer' ? 'rgba(59, 130, 246, 0.06)' : 'rgba(34, 197, 94, 0.06)',
                  borderRadius: 20,
                }}>
                  <View style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: profileData.userType === 'buyer' ? '#3B82F6' : '#22C55E',
                  }} />
                  <Text style={{ 
                    fontSize: 13, 
                    color: profileData.userType === 'buyer' ? '#2563EB' : '#16A34A',
                    fontWeight: '600',
                    letterSpacing: 0.3,
                  }}>
                    {tr('profile.tapToChange', 'Tap to change')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Basic Information Section */}
            <View style={{ marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <User size={20} color={profileData.userType === 'buyer' ? '#3B82F6' : '#22C55E'} strokeWidth={2.5} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                  {tr('profile.basicInfo', 'Basic Information')}
                </Text>
              </View>

              <LinearGradient
                colors={['#FFFFFF', '#F8FAFC']}
                style={{
                  borderRadius: 20,
                  padding: 20,
                  gap: 14,
                  shadowColor: profileData.userType === 'buyer' ? '#3B82F6' : '#22C55E',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 4,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              >
                <CustomInput
                  label={tr('profile.fullName', 'Full Name')}
                  placeholder={tr('profile.fullNamePlaceholder', 'Enter your full name')}
                  value={profileData.fullName}
                  onChangeText={(value) => handleFieldChange('fullName', value)}
                />

                <CustomInput
                  label={tr('profile.mobileNumber', 'Mobile Number')}
                  placeholder={localizeNumber(tr('profile.mobileNumberPlaceholder', 'Enter mobile number'), i18n.language)}
                  value={localizeNumber(profileData.mobileNumber, i18n.language)}
                  editable={false}
                  style={{ backgroundColor: '#F3F4F6' }}
                />

                <CustomInput
                  label={tr('profile.email', 'Email')}
                  placeholder={tr('profile.emailPlaceholder', 'Enter your email')}
                  value={profileData.email}
                  onChangeText={(value) => handleFieldChange('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </LinearGradient>
            </View>

            {/* Location Information Section */}
            {(profileData.state || profileData.district) && (
              <View style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <MapPin size={20} color={profileData.userType === 'buyer' ? '#3B82F6' : '#22C55E'} strokeWidth={2.5} />
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                    {tr('profile.locationInfo', 'Location Information')}
                  </Text>
                </View>

                <LinearGradient
                  colors={['#FFFFFF', '#F8FAFC']}
                  style={{
                    borderRadius: 20,
                    padding: 20,
                    gap: 14,
                    shadowColor: profileData.userType === 'buyer' ? '#3B82F6' : '#22C55E',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 4,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}
                >
                  <CustomInput
                    label={tr('profile.state', 'State')}
                    placeholder={tr('profile.statePlaceholder', 'Select your state')}
                    value={
                      INDIAN_STATES.find((s) => s.value === profileData.state)
                        ? t(INDIAN_STATES.find((s) => s.value === profileData.state)!.labelKey)
                        : profileData.state
                    }
                    editable={false}
                    style={{ backgroundColor: '#F3F4F6' }}
                  />

                  <CustomInput
                    label={tr('profile.district', 'District')}
                    placeholder={tr('profile.districtPlaceholder', 'Enter your district')}
                    value={
                      INDIAN_DISTRICTS.find((d) => d.value === profileData.district)
                        ? t(INDIAN_DISTRICTS.find((d) => d.value === profileData.district)!.labelKey)
                        : profileData.district
                    }
                    editable={false}
                    style={{ backgroundColor: '#F3F4F6' }}
                  />
                </LinearGradient>
              </View>
            )}

            {/* Language Preference Section */}
            <View style={{ marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Globe size={20} color={profileData.userType === 'buyer' ? '#3B82F6' : '#22C55E'} strokeWidth={2.5} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                  {tr('profile.languagePreference', 'Language Preference')}
                </Text>
              </View>

              <LinearGradient
                colors={['#FFFFFF', '#F8FAFC']}
                style={{
                  borderRadius: 20,
                  padding: 20,
                  shadowColor: profileData.userType === 'buyer' ? '#3B82F6' : '#22C55E',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 4,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              >
                <Dropdown
                  label={tr('profile.preferredLanguage', 'Preferred Language')}
                  placeholder={tr('profile.languagePlaceholder', 'Select language')}
                  value={
                    LANGUAGES.find((l) => l.value === profileData.preferredLanguage)
                      ? t(
                        LANGUAGES.find(
                          (l) => l.value === profileData.preferredLanguage
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
              </LinearGradient>
            </View>

            {/* Farming Information Section - Only for Farmers */}
            {profileData.userType === 'farmer' && (
              <View style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Sprout size={20} color="#22C55E" strokeWidth={2.5} />
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                    {tr('profile.farmingInfo', 'Farming Information')}
                  </Text>
                </View>

                <LinearGradient
                  colors={['#FFFFFF', '#F8FAFC']}
                  style={{
                    borderRadius: 20,
                    padding: 20,
                    gap: 14,
                    shadowColor: '#22C55E',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 4,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}
                >
                  <CustomInput
                    label={tr('profile.farmerType', 'Farmer Type')}
                    placeholder={tr('profile.farmerTypePlaceholder', 'Select farmer type')}
                    value={
                      FARMER_TYPES.find((f) => f.value === profileData.farmerType)
                        ? t(FARMER_TYPES.find((f) => f.value === profileData.farmerType)!.labelKey)
                        : ''
                    }
                    editable={false}
                    style={{ backgroundColor: '#F3F4F6' }}
                  />

                  <CustomInput
                    label={tr('profile.landSize', 'Land Size')}
                    placeholder={tr('profile.landSizePlaceholder', 'Enter land size')}
                    value={profileData.landSize}
                    onChangeText={(value) => handleFieldChange('landSize', value)}
                    keyboardType="decimal-pad"
                    suffix={tr('profile.acres', 'acres')}
                  />
                </LinearGradient>
              </View>
            )}

            {/* Business Information Section - Only for Buyers */}
            {profileData.userType === 'buyer' && (
              <View style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <ShoppingBag size={20} color="#3B82F6" strokeWidth={2.5} />
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                    {tr('profile.businessInfo', 'Business Information')}
                  </Text>
                </View>

                <LinearGradient
                  colors={['#FFFFFF', '#F8FAFC']}
                  style={{
                    borderRadius: 20,
                    padding: 20,
                    gap: 14,
                    shadowColor: '#3B82F6',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 4,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}
                >
                  <CustomInput
                    label={tr('profile.companyName', 'Company Name')}
                    placeholder={tr('profile.companyNamePlaceholder', 'Enter your company name')}
                    value={profileData.companyName || ''}
                    onChangeText={(value) => handleFieldChange('companyName', value)}
                  />

                  <CustomInput
                    label={tr('profile.businessType', 'Business Type')}
                    placeholder={tr('profile.businessTypePlaceholder', 'e.g., Wholesaler, Retailer, Restaurant')}
                    value={profileData.businessType || ''}
                    onChangeText={(value) => handleFieldChange('businessType', value)}
                  />
                </LinearGradient>
              </View>
            )}

            {/* Preferences Section */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Bell size={20} color={profileData.userType === 'buyer' ? '#3B82F6' : '#22C55E'} strokeWidth={2.5} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                  {tr('profile.preferences', 'Preferences')}
                </Text>
              </View>

              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 18,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
                    {tr('profile.enableNotification', 'Enable Notifications')}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#6B7280' }}>
                    {tr('profile.notificationDesc', 'Get updates on your crops and weather')}
                  </Text>
                </View>
                <Switch
                  value={profileData.notificationsEnabled}
                  onValueChange={(value) =>
                    handleFieldChange('notificationsEnabled', value)
                  }
                  trackColor={{ false: '#D1D5DB', true: profileData.userType === 'buyer' ? '#BFDBFE' : '#86EFAC' }}
                  thumbColor={profileData.notificationsEnabled ? (profileData.userType === 'buyer' ? '#3B82F6' : '#22C55E') : '#9CA3AF'}
                />
              </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              onPress={handleSaveChanges}
              disabled={!hasChanges || isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={!hasChanges || isLoading ? ['#D1D5DB', '#9CA3AF'] : (profileData.userType === 'buyer' ? ['#3B82F6', '#2563EB'] : ['#22C55E', '#16A34A'])}
                style={{
                  borderRadius: 16,
                  paddingVertical: 16,
                  marginBottom: 12,
                  shadowColor: !hasChanges || isLoading ? 'transparent' : (profileData.userType === 'buyer' ? '#3B82F6' : '#22C55E'),
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: '#FFFFFF', textAlign: 'center', fontSize: 16, fontWeight: '700' }}>
                    {tr('profile.saveChanges', 'Save Changes')}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.8}
              style={{
                borderRadius: 16,
                paddingVertical: 16,
                borderWidth: 2,
                borderColor: '#EF4444',
                backgroundColor: '#FEF2F2',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#EF4444', textAlign: 'center', fontSize: 16, fontWeight: '700' }}>
                {tr('profile.logoutButton', 'Logout')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      </ScrollView>
    </View>
  );
};
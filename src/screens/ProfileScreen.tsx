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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore
import { Ionicons } from '@expo/vector-icons';
import { CustomInput } from '../components/CustomInput';
import { Dropdown } from '../components/Dropdown';
import { INDIAN_STATES, FARMER_TYPES, LANGUAGES } from '../constants/data';
import { RootStackParamList } from '../navigation/AppNavigator';
import { saveLanguage } from '../i18n/i18n';
import { localizeNumber } from '../utils/numberLocalization';
import {
  fetchCurrentUserProfile,
  logout,
  onAuthStateChange,
  saveCurrentUserProfile,
  updateCurrentAuthProfile,
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
        navigation.navigate('SignIn');
        return;
      }

      setIsProfileLoading(true);
      try {
        const profileResult = await fetchCurrentUserProfile();
        const stored = profileResult.success ? profileResult.profile : {};

        const next: ProfileData = {
          fullName: (stored.fullName as string) || user.displayName || '',
          mobileNumber: (stored.mobileNumber as string) || '',
          email: (stored.email as string) || user.email || '',
          state: (stored.state as string) || '',
          district: (stored.district as string) || '',
          preferredLanguage: (stored.preferredLanguage as string) || i18n.language,
          farmerType: (stored.farmerType as string) || '',
          landSize: (stored.landSize as string) || '',
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
      i18n.changeLanguage(profileData.preferredLanguage);
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
      // Persist to Firestore
      await saveCurrentUserProfile({
        fullName: profileData.fullName,
        mobileNumber: profileData.mobileNumber,
        email: profileData.email,
        state: profileData.state,
        district: profileData.district,
        preferredLanguage: profileData.preferredLanguage,
        farmerType: profileData.farmerType,
        landSize: profileData.landSize,
        notificationsEnabled: profileData.notificationsEnabled,
        profilePhoto: profileData.profilePhoto,
      });

      // Keep Auth displayName in sync (useful for Google + email users)
      if (profileData.fullName?.trim()) {
        await updateCurrentAuthProfile({
          displayName: profileData.fullName.trim(),
          photoURL: profileData.profilePhoto ?? undefined,
        });
      }

      setInitialData(profileData);
      Alert.alert(tr('profile.success.title', 'Success'), tr('profile.success.message', 'Profile updated successfully!'));
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert(tr('profile.error.title', 'Error'), tr('profile.error.message', 'Failed to update profile. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      tr('profile.logoutConfirm.title', 'Confirm Logout'),
      tr('profile.logoutConfirm.message', 'Are you sure you want to logout?'),
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
            navigation.navigate('SignIn');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="bg-primary pt-12 pb-8 px-6">
        <Text className="text-3xl font-bold text-white mb-1">
          {tr('profile.title', 'Profile')}
        </Text>
        <Text className="text-white/80 text-base">
          {tr('profile.subtitle', 'Manage your account')}
        </Text>
      </View>

      <View className="px-6">
        {isProfileLoading ? (
          <View className="py-10 items-center">
            <ActivityIndicator />
          </View>
        ) : null}

        {/* Profile Picture */}
        <View className="items-center -mt-16 mb-8">
          <TouchableOpacity
            onPress={showImageOptions}
            className="relative"
            activeOpacity={0.7}
          >
            <View className="w-32 h-32 rounded-full bg-white border-4 border-white shadow-lg items-center justify-center overflow-hidden">
              {profileData.profilePhoto ? (
                <Image
                  source={{ uri: profileData.profilePhoto }}
                  className="w-full h-full"
                />
              ) : (
                <Ionicons name="person" size={55} color="#9CA3AF" />
              )}
            </View>
            <View className="absolute bottom-0 right-0 bg-primary rounded-full p-2 border-2 border-white">
              <Ionicons name="camera" size={18} color="white" />
            </View>
          </TouchableOpacity>
          <Text className="text-gray-500 text-sm mt-2">
            {tr('profile.tapToChange', 'Tap to change')}
          </Text>
        </View>

        {/* Basic Information Section */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-gray-800 mb-4">
            {tr('profile.basicInfo', 'Basic Information')}
          </Text>

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
        </View>

        {/* Location Information Section */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-gray-800 mb-4">
            {tr('profile.locationInfo', 'Location Information')}
          </Text>

          <Dropdown
            label={tr('profile.state', 'State')}
            placeholder={tr('profile.statePlaceholder', 'Select your state')}
            value={profileData.state}
            options={INDIAN_STATES}
            onSelect={(value) => handleFieldChange('state', value)}
          />

          <CustomInput
            label={tr('profile.district', 'District')}
            placeholder={tr('profile.districtPlaceholder', 'Enter your district')}
            value={profileData.district}
            onChangeText={(value) => handleFieldChange('district', value)}
          />
        </View>

        {/* Language Preference Section */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-gray-800 mb-4">
            {tr('profile.languagePreference', 'Language Preference')}
          </Text>

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
        </View>

        {/* Farming Information Section */}
        <View className="mb-6">
          <Text className="text-xl font-semibold text-gray-800 mb-4">
            {tr('profile.farmingInfo', 'Farming Information')}
          </Text>

          <Dropdown
            label={tr('profile.farmerType', 'Farmer Type')}
            placeholder={tr('profile.farmerTypePlaceholder', 'Select farmer type')}
            value={
              FARMER_TYPES.find((f) => f.value === profileData.farmerType)
                ? t(
                    FARMER_TYPES.find((f) => f.value === profileData.farmerType)!
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
          />

          <CustomInput
            label={tr('profile.landSize', 'Land Size')}
            placeholder={tr('profile.landSizePlaceholder', 'Enter land size')}
            value={profileData.landSize}
            onChangeText={(value) => handleFieldChange('landSize', value)}
            keyboardType="decimal-pad"
            suffix={tr('profile.acres', 'acres')}
          />
        </View>

        {/* Preferences Section */}
        <View className="mb-8">
          <Text className="text-xl font-semibold text-gray-800 mb-4">
            {tr('profile.preferences', 'Preferences')}
          </Text>

          <View className="bg-gray-50 rounded-xl p-4 flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-gray-900 font-medium text-base mb-1">
                {tr('profile.enableNotification', 'Enable Notifications')}
              </Text>
              <Text className="text-gray-600 text-sm">
                {tr('profile.notificationDesc', 'Get updates on your crops and weather')}
              </Text>
            </View>
            <Switch
              value={profileData.notificationsEnabled}
              onValueChange={(value) =>
                handleFieldChange('notificationsEnabled', value)
              }
              trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
              thumbColor={profileData.notificationsEnabled ? '#22C55E' : '#9CA3AF'}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          onPress={handleSaveChanges}
          disabled={!hasChanges || isLoading}
          className={`rounded-xl py-4 mb-4 ${
            !hasChanges || isLoading ? 'bg-gray-300' : 'bg-primary'
          }`}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center text-lg font-semibold" numberOfLines={1} adjustsFontSizeToFit>
              {tr('profile.saveChanges', 'Save Changes')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogout}
          className="rounded-xl py-4 border-2 border-red-500 mb-4"
        >
          <Text className="text-red-500 text-center text-lg font-semibold" numberOfLines={1} adjustsFontSizeToFit>
            {tr('profile.logout', 'Logout')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
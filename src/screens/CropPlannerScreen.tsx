import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Calendar, Leaf, Ruler, Sprout, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import MovingBackgroundCircle from '@/components/MovingBackgroundCircle';
import { CustomInput } from '../components/CustomInput';
import { DatePicker } from '../components/DatePicker';
import { Dropdown } from '../components/Dropdown';
import { RootStackParamList } from '../navigation/AppNavigator';
import { delocalizeNumber } from '../utils/numberLocalization';
import { upsertFarmingPlanForCurrentUser } from '../services/farmingPlan';
import { requestTaskNotificationPermissionAsync, schedulePlanTaskNotificationsAsync } from '../services/notifications';
import BackButton from '@/components/BackButton';

type CropPlannerNav = NativeStackNavigationProp<RootStackParamList, 'CropPrediction'>;

type FormData = {
  cropType: string;
  cropName: string;
  areaAcres: string;
  plantingDate: string;
  expectedHarvestDate: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const CROP_VALUES = [
  'rice',
  'wheat',
  'corn',
  'potato',
  'tomato',
  'onion',
  'cotton',
  'sugarcane',
  'other',
] as const;

const parseDdMmYyyy = (value: string): Date | null => {
  const raw = (value || '').trim();
  if (!raw) return null;
  const parts = raw.split('/');
  if (parts.length !== 3) return null;
  const dd = Number(parts[0]);
  const mm = Number(parts[1]);
  const yyyy = Number(parts[2]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
};

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const formatDdMmYyyy = (date: Date) => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
};

const inferMaturityDays = (cropNameOrType: string) => {
  const c = (cropNameOrType || '').trim().toLowerCase();
  if (c.includes('rice') || c.includes('paddy')) return 120;
  if (c.includes('wheat')) return 120;
  if (c.includes('maize') || c.includes('corn')) return 100;
  if (c.includes('potato')) return 95;
  if (c.includes('tomato')) return 95;
  if (c.includes('onion')) return 125;
  if (c.includes('cotton')) return 160;
  if (c.includes('sugarcane')) return 330;
  return 110;
};

export const CropPlannerScreen = () => {
  const navigation = useNavigation<CropPlannerNav>();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();

  const tr = (key: string, fallback?: string, options?: Record<string, unknown>): string => {
    try {
      if (!i18n || !i18n.isInitialized) return fallback || key;

      const translated = t(key, {
        ...(options || {}),
        defaultValue: fallback || key,
        returnObjects: false,
      } as any) as unknown;

      if (typeof translated === 'string') return translated;
      if (typeof translated === 'number' || typeof translated === 'boolean') return String(translated);

      return fallback || key;
    } catch {
      return fallback || key;
    }
  };

  const CROP_OPTIONS = useMemo(
    () =>
      CROP_VALUES.map((value) => ({
        value,
        label: tr(`cropPlanner.cropOptions.${value}`, value),
      })),
    [i18n.language]
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const cardScale = useRef(new Animated.Value(0.96)).current;

  const [isSaving, setIsSaving] = useState(false);
  const [showCustomCropModal, setShowCustomCropModal] = useState(false);
  const [customCropInput, setCustomCropInput] = useState('');
  const [form, setForm] = useState<FormData>({
    cropType: '',
    cropName: '',
    areaAcres: '',
    plantingDate: '',
    expectedHarvestDate: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, cardScale]);

  const estimatedHarvestLabel = useMemo(() => {
    const planting = parseDdMmYyyy(form.plantingDate);
    if (!planting) return null;

    if (form.expectedHarvestDate) {
      const provided = parseDdMmYyyy(form.expectedHarvestDate);
      return provided ? form.expectedHarvestDate : null;
    }

    const cropKey = form.cropName || form.cropType;
    const days = inferMaturityDays(cropKey);
    return formatDdMmYyyy(addDays(planting, days));
  }, [form.plantingDate, form.expectedHarvestDate, form.cropName, form.cropType]);

  const setField = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!form.cropType) next.cropType = tr('cropPlanner.errors.cropTypeRequired', 'Crop type is required.');
    if (!form.cropName.trim()) next.cropName = tr('cropPlanner.errors.cropNameRequired', 'Crop name is required.');

    const acres = Number(delocalizeNumber(form.areaAcres, 'en'));
    if (!form.areaAcres) next.areaAcres = tr('cropPlanner.errors.areaRequired', 'Area is required.');
    else if (!Number.isFinite(acres) || acres <= 0) {
      next.areaAcres = tr('cropPlanner.errors.areaInvalid', 'Enter a valid area in acres.');
    }

    const planting = parseDdMmYyyy(form.plantingDate);
    if (!form.plantingDate) next.plantingDate = tr('cropPlanner.errors.plantingRequired', 'Planting date is required.');
    else if (!planting) next.plantingDate = tr('cropPlanner.errors.dateFormat', 'Use DD/MM/YYYY format.');

    if (form.expectedHarvestDate) {
      const harvest = parseDdMmYyyy(form.expectedHarvestDate);
      if (!harvest) next.expectedHarvestDate = tr('cropPlanner.errors.dateFormat', 'Use DD/MM/YYYY format.');
      if (planting && harvest && harvest.getTime() <= planting.getTime()) {
        next.expectedHarvestDate = tr(
          'cropPlanner.errors.harvestAfterPlanting',
          'Harvest date must be after planting date.'
        );
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onCreatePlan = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const areaAcres = Number(delocalizeNumber(form.areaAcres, 'en'));

      const { planId } = await upsertFarmingPlanForCurrentUser({
        cropType: form.cropType,
        cropName: form.cropName,
        areaAcres,
        plantingDate: form.plantingDate,
        expectedHarvestDate: form.expectedHarvestDate || undefined,
        source: 'cropPlanner',
      });

      Alert.alert(
        tr('cropPlanner.alerts.createdTitle', 'Plan created'),
        `Your farming plan is saved. Expected harvest date: ${estimatedHarvestLabel || tr('cropPlanner.na', 'N/A')}. Notifications can remind you at the right time for each task. If you do not allow notifications, your plan will still work but reminders will not appear.`,
        [
          {
            text: 'Not now',
            style: 'cancel',
            onPress: () => navigation.navigate('Dashboard'),
          },
          {
            text: 'Allow notifications',
            onPress: async () => {
              const granted = await requestTaskNotificationPermissionAsync();
              if (granted) {
                await schedulePlanTaskNotificationsAsync({ planId, language: i18n.language });
              }
              navigation.navigate('Dashboard');
            },
          },
        ]
      );
    } catch (e) {
      console.error('Create plan error:', e);
      Alert.alert(
        tr('cropPlanner.alerts.errorTitle', 'Error'),
        tr('cropPlanner.alerts.errorBody', 'Failed to create plan. Please try again.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <MovingBackgroundCircle />

      {/* Header */}
      <View
        style={{
          paddingTop: Math.max(insets.top, 14),
          paddingBottom: 12,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
          backgroundColor: '#FFFFFF',
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F3F4F6',
          }}
        >
          <BackButton />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: '#111827', letterSpacing: -0.4 }}>
            {tr('cropPlanner.title', 'Crop Planner')}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 2 }}>
            {tr('cropPlanner.subtitle', 'Create a schedule for reminders & tasks')}
          </Text>
        </View>

        <View style={{ width: 42, height: 42 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
            paddingTop: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: cardScale }],
            }}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F0FDF4', '#ECFDF5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                padding: 18,
                borderWidth: 1.5,
                borderColor: '#BBF7D0',
                shadowColor: '#16A34A',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 18,
                elevation: 5,
              }}
            >
              {/* Card Title */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    backgroundColor: '#DCFCE7',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#BBF7D0',
                  }}
                >
                  <Sprout size={22} color="#16A34A" strokeWidth={2.6} />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#111827' }}>
                    {tr('cropPlanner.cardTitle', 'Plan details')}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 2 }}>
                    {tr(
                      'cropPlanner.cardSubtitle',
                      'We’ll generate watering, fertilizer, and scouting reminders'
                    )}
                  </Text>
                </View>
              </View>

              {/* Crop type */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: '#374151', fontWeight: '700', marginBottom: 8, fontSize: 15 }}>
                  {tr('cropPlanner.fields.cropType', 'Crop Type')}
                </Text>
                <Dropdown
                  placeholder={tr('cropPlanner.fields.cropTypePlaceholder', 'Select crop')}
                  value={form.cropType}
                  options={CROP_OPTIONS}
                  onSelect={(opt) => {
                    const selected = typeof opt === 'string' ? opt : opt.value;
                    setField('cropType', selected);

                    // Open modal for custom crop entry
                    if (selected === 'other') {
                      setCustomCropInput('');
                      setShowCustomCropModal(true);
                    } else {
                      // Auto-fill crop name for predefined crops
                      const label = typeof opt === 'string' ? opt : opt.label;
                      setField('cropName', label);
                    }
                  }}
                  error={errors.cropType}
                />
              </View>

              {/* Crop name */}
              <CustomInput
                label={tr('cropPlanner.fields.cropName', 'Crop Name')}
                value={form.cropName}
                onChangeText={(v) => setField('cropName', v)}
                placeholder={tr('cropPlanner.fields.cropNamePlaceholder', 'e.g., Boro rice / Wheat / Tomato')}
                error={errors.cropName}
              />

              {/* Area */}
              <View style={{ marginTop: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ruler size={18} color="#16A34A" strokeWidth={2.4} />
                  <Text style={{ marginLeft: 8, color: '#374151', fontWeight: '700', fontSize: 15 }}>
                    {tr('cropPlanner.fields.plotArea', 'Plot Area')}
                  </Text>
                </View>
                <CustomInput
                  label={tr('cropPlanner.fields.areaAcres', 'Area (acres)')}
                  value={form.areaAcres}
                  onChangeText={(v) => setField('areaAcres', v)}
                  placeholder={tr('cropPlanner.fields.areaPlaceholder', 'e.g., 2')}
                  keyboardType="numeric"
                  error={errors.areaAcres}
                />
              </View>

              {/* Dates */}
              <View style={{ marginTop: 4 }}>
                <DatePicker
                  label={tr('cropPlanner.fields.plantingDate', 'Planting Date')}
                  value={form.plantingDate}
                  onDateSelect={(v) => setField('plantingDate', v)}
                  error={errors.plantingDate}
                />

                <View style={{ height: 12 }} />

                <DatePicker
                  label={tr('cropPlanner.fields.harvestDateOptional', 'Expected Harvest Date (optional)')}
                  placeholder={
                    estimatedHarvestLabel
                      ? tr('cropPlanner.fields.harvestSuggested', 'Suggested: {{date}}', {
                        date: estimatedHarvestLabel,
                      })
                      : tr('cropPlanner.fields.selectDate', 'Select date')
                  }
                  value={form.expectedHarvestDate}
                  onDateSelect={(v) => setField('expectedHarvestDate', v)}
                  error={errors.expectedHarvestDate}
                  minDate={parseDdMmYyyy(form.plantingDate) || undefined}
                />

                {estimatedHarvestLabel ? (
                  <View
                    style={{
                      marginTop: 10,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: '#BBF7D0',
                      backgroundColor: '#F0FDF4',
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Target size={18} color="#16A34A" strokeWidth={2.5} />
                    <Text style={{ marginLeft: 8, color: '#14532D', fontWeight: '800', fontSize: 13 }}>
                      {tr('cropPlanner.expectedHarvest', 'Expected harvest: {{date}}', {
                        date: estimatedHarvestLabel,
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Footer note */}
              <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center' }}>
                <Leaf size={16} color="#16A34A" strokeWidth={2.5} />
                <Text style={{ marginLeft: 8, color: '#6B7280', fontWeight: '600', fontSize: 12, flex: 1, lineHeight: 16 }}>
                  {tr(
                    'cropPlanner.footerNote',
                    'Reminders are stored only until your crop cycle ends, then cleaned up automatically.'
                  )}
                </Text>
              </View>

              {/* CTA */}
              <TouchableOpacity
                onPress={onCreatePlan}
                disabled={isSaving}
                activeOpacity={0.9}
                style={{ marginTop: 16 }}
              >
                <LinearGradient
                  colors={['#22C55E', '#16A34A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 18,
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#16A34A',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.2,
                    shadowRadius: 16,
                    elevation: 6,
                    flexDirection: 'row',
                  }}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Calendar size={18} color="#FFFFFF" strokeWidth={2.6} />
                  )}
                  <Text style={{ marginLeft: 10, color: '#FFFFFF', fontWeight: '900', fontSize: 15 }}>
                    {isSaving
                      ? tr('cropPlanner.creating', 'Creating…')
                      : tr('cropPlanner.createPlan', 'Create Plan')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Custom Crop Modal */}
      {showCustomCropModal && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 8,
              minWidth: '80%',
            }}
          >
            <LinearGradient
              colors={['#F0FDF4', '#ECFDF5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 20,
                padding: 20,
                borderWidth: 1.5,
                borderColor: '#BBF7D0',
              }}
            >
              {/* Modal Header */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: '#DCFCE7',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: '#BBF7D0',
                    }}
                  >
                    <Sprout size={20} color="#16A34A" strokeWidth={2.6} />
                  </View>
                </View>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#111827', marginBottom: 4 }}>
                  {tr('cropPlanner.customCrop.title', 'Enter Custom Crop Name')}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '500', color: '#6B7280' }}>
                  {tr('cropPlanner.customCrop.subtitle', 'What crop would you like to plant?')}
                </Text>
              </View>

              {/* Input Field */}
              <View style={{ marginBottom: 16 }}>
                <CustomInput
                  label={tr('cropPlanner.customCrop.inputLabel', 'Crop Name')}
                  value={customCropInput}
                  onChangeText={setCustomCropInput}
                  placeholder={tr(
                    'cropPlanner.customCrop.inputPlaceholder',
                    'e.g., Mango, Lentil, Chickpea'
                  )}
                />
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowCustomCropModal(false);
                    setCustomCropInput('');
                  }}
                  style={{ flex: 1 }}
                >
                  <View
                    style={{
                      borderRadius: 12,
                      paddingVertical: 12,
                      alignItems: 'center',
                      borderWidth: 2,
                      borderColor: '#D1D5DB',
                      backgroundColor: '#F9FAFB',
                    }}
                  >
                    <Text style={{ color: '#374151', fontWeight: '700', fontSize: 14 }}>
                      {tr('common.cancel', 'Cancel')}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (customCropInput.trim()) {
                      setField('cropName', customCropInput.trim());
                      setShowCustomCropModal(false);
                      setCustomCropInput('');
                    } else {
                      Alert.alert(
                        tr('cropPlanner.customCrop.errorTitle', 'Input Required'),
                        tr(
                          'cropPlanner.customCrop.errorMessage',
                          'Please enter a crop name.'
                        )
                      );
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  <LinearGradient
                    colors={['#22C55E', '#16A34A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      borderRadius: 12,
                      paddingVertical: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#16A34A',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.2,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                      {tr('common.confirm', 'Confirm')}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}
    </View>
  );
};

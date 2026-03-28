import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar } from 'react-native-calendars';
import { RootStackParamList } from '../navigation/AppNavigator';
import { localizeNumber } from '../utils/numberLocalization';
import BackButton from '@/components/BackButton';
import {
  getFarmingPlanForCurrentUser,
  getFarmingTasksForPlanInRangeForCurrentUser,
  FarmingTaskInstance,
} from '../services/farmingPlan';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  planId: string;
  planTitle?: string;
};

const toISODate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getMonthRange = (year: number, monthIndex0: number): { startISO: string; endISO: string } => {
  const start = new Date(year, monthIndex0, 1);
  const end = new Date(year, monthIndex0 + 1, 0);
  return { startISO: toISODate(start), endISO: toISODate(end) };
};

// Localized month names
const MONTH_NAMES: Record<string, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  hi: ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  bn: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
};

const getLocalizedMonthYear = (year: number, month: number, language: string): string => {
  const monthNames = MONTH_NAMES[language] || MONTH_NAMES.en;
  const monthName = monthNames[month - 1] || monthNames[0];
  const localizedYear = localizeNumber(year, language);
  return `${monthName} ${localizedYear}`;
};

export const PlanCalendarScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { t, i18n } = useTranslation();

  const { planId, planTitle: initialTitle } = (route.params || {}) as RouteParams;

  const [title, setTitle] = useState(initialTitle || '');
  const [selectedISO, setSelectedISO] = useState<string>(toISODate(new Date()));
  const [visibleMonthISO, setVisibleMonthISO] = useState<string>(toISODate(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<FarmingTaskInstance[]>([]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    for (const task of tasks) {
      const iso = task.dueDateISO;
      if (!iso) continue;
      const existing = marks[iso];
      marks[iso] = {
        ...(existing || {}),
        marked: true,
        dotColor: '#16A34A',
      };
    }

    marks[selectedISO] = {
      ...(marks[selectedISO] || {}),
      selected: true,
      selectedColor: '#16A34A',
      selectedTextColor: '#FFFFFF',
    };

    return marks;
  }, [tasks, selectedISO]);

  async function loadMonthTasks(monthISO: string) {
    setIsLoading(true);
    try {
      // Fetch plan title if missing.
      if (!title) {
        const plan = await getFarmingPlanForCurrentUser(planId);
        if (plan) setTitle((plan.planTitleI18n as any)?.[i18n.language] || (plan.planTitleI18n as any)?.en || plan.cropName);
      }

      const monthDate = new Date(`${monthISO}T00:00:00`);
      const year = monthDate.getFullYear();
      const monthIndex0 = monthDate.getMonth();
      const { startISO, endISO } = getMonthRange(year, monthIndex0);

      const monthTasks = await getFarmingTasksForPlanInRangeForCurrentUser({
        planId,
        startISO,
        endISO,
        language: i18n.language,
      });
      setTasks(monthTasks);
    } catch (e) {
      console.error('Error loading plan calendar:', e);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!planId) return;
    loadMonthTasks(visibleMonthISO);
  }, [planId, visibleMonthISO, i18n.language]);

  const onDayPress = (day: { dateString: string }) => {
    setSelectedISO(day.dateString);
    navigation.navigate('FarmerDailyRoutine', { planId, dateISO: day.dateString, planTitle: title });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ paddingVertical: 10, paddingRight: 12 }}>
            <BackButton />
          </View>
          <Text style={{ color: '#111827', fontSize: 16, fontWeight: '900' }} numberOfLines={1}>
            {t('planCalendar.title')}
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <Text style={{ marginTop: 6, color: '#374151', fontSize: 13, fontWeight: '700' }} numberOfLines={2}>
          {title}
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={{ marginTop: 10, color: '#6B7280', fontWeight: '700' }}>{t('planCalendar.loading')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Calendar
            current={visibleMonthISO}
            markedDates={markedDates}
            onDayPress={onDayPress}
            onMonthChange={(m) => {
              const iso = `${m.year}-${String(m.month).padStart(2, '0')}-01`;
              setVisibleMonthISO(iso);
            }}
            renderHeader={(date) => {
              const d = new Date(date);
              const year = d.getFullYear();
              const month = d.getMonth() + 1;
              return (
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#111827', paddingVertical: 8 }}>
                  {getLocalizedMonthYear(year, month, i18n.language)}
                </Text>
              );
            }}
            dayComponent={({ date, marking }) => {
              const isMarked = marking?.marked;
              const isSelected = marking?.selected;
              const isToday = marking?.today;
              
              return (
                <TouchableOpacity 
                  onPress={() => date && onDayPress({ dateString: date.dateString })}
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: isSelected ? '#16A34A' : isToday ? '#FEF3C7' : 'transparent',
                    borderRadius: 8,
                  }}
                >
                  <Text style={{
                    fontSize: 16,
                    fontWeight: isSelected ? 'bold' : '600',
                    color: isSelected ? '#FFFFFF' : isToday ? '#F59E0B' : '#111827',
                  }}>
                    {date && localizeNumber(date.day, i18n.language)}
                  </Text>
                  {isMarked && (
                    <View 
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: '#16A34A',
                        marginTop: 4,
                      }}
                    />
                  )}
                </TouchableOpacity>
              );
            }}
            theme={{
              todayTextColor: '#16A34A',
              arrowColor: '#16A34A',
              selectedDayBackgroundColor: '#16A34A',
              dotColor: '#16A34A',
            }}
          />

          <View style={{ marginTop: 14, backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1, borderRadius: 14, padding: 12 }}>
            <Text style={{ color: '#166534', fontWeight: '900', marginBottom: 6 }}>{t('planCalendar.tipTitle')}</Text>
            <Text style={{ color: '#166534', fontWeight: '700', lineHeight: 18 }}>{t('planCalendar.tipBody')}</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

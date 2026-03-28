import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import BackButton from '@/components/BackButton';
import {
  FarmingTaskInstanceDetailed,
  TimeOfDay,
  getFarmingTasksForPlanOnDateForCurrentUser,
} from '../services/farmingPlan';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  planId: string;
  dateISO: string;
  planTitle?: string;
};

const order: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];

const formatTimeHHmm = (timeHHmm: string): string => {
  const raw = (timeHHmm || '').trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return raw;
  let hh = Number(m[1]);
  const mm = m[2];
  if (!Number.isFinite(hh)) return raw;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${mm} ${ampm}`;
};

export const FarmerDailyRoutine = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { t, i18n } = useTranslation();

  const { planId, dateISO, planTitle } = (route.params || {}) as RouteParams;

  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<FarmingTaskInstanceDetailed[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const dayTasks = await getFarmingTasksForPlanOnDateForCurrentUser({
          planId,
          dateISO,
          language: i18n.language,
        });
        if (mounted) setTasks(dayTasks);
      } catch (e) {
        console.error('Error loading daily routine:', e);
        if (mounted) setTasks([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    if (planId && dateISO) load();
    return () => {
      mounted = false;
    };
  }, [planId, dateISO, i18n.language]);

  const grouped = useMemo(() => {
    const map: Record<TimeOfDay, FarmingTaskInstanceDetailed[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };

    for (const task of tasks) {
      const key: TimeOfDay = task.timeOfDay || 'afternoon';
      map[key].push(task);
    }

    for (const k of order) {
      map[k].sort((a, b) => (a.type || '').localeCompare(b.type || ''));
    }

    return map;
  }, [tasks]);

  const timeLabel = (tod: TimeOfDay): string => {
    switch (tod) {
      case 'morning':
        return t('dailyRoutine.morning');
      case 'afternoon':
        return t('dailyRoutine.afternoon');
      case 'evening':
        return t('dailyRoutine.evening');
      case 'night':
        return t('dailyRoutine.night');
      default:
        return t('dailyRoutine.afternoon');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ paddingVertical: 10, paddingRight: 12 }}>
            <BackButton />
          </View>
          <Text style={{ color: '#111827', fontSize: 16, fontWeight: '900' }} numberOfLines={1}>
            {t('dailyRoutine.title')}
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <Text style={{ marginTop: 6, color: '#374151', fontSize: 13, fontWeight: '700' }} numberOfLines={2}>
          {planTitle ? `${planTitle} • ${dateISO}` : dateISO}
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={{ marginTop: 10, color: '#6B7280', fontWeight: '700' }}>{t('dailyRoutine.loading')}</Text>
        </View>
      ) : tasks.length === 0 ? (
        <View style={{ padding: 18 }}>
          <View style={{ backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' }}>
            <Text style={{ color: '#111827', fontWeight: '900', fontSize: 15 }}>{t('dailyRoutine.emptyTitle')}</Text>
            <Text style={{ marginTop: 6, color: '#6B7280', fontWeight: '700', lineHeight: 18 }}>{t('dailyRoutine.emptyBody')}</Text>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {order.map((tod) => {
            const list = grouped[tod];
            if (!list || list.length === 0) return null;
            return (
              <View key={tod} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 14 }}>
                <Text style={{ color: '#111827', fontWeight: '900', fontSize: 14 }}>{timeLabel(tod)}</Text>
                <View style={{ marginTop: 10, gap: 10 }}>
                  {list.map((task) => (
                    <View key={`${task.planId}-${task.dueDateISO}-${task.title}`} style={{ backgroundColor: '#F0FDF4', borderRadius: 14, borderWidth: 1, borderColor: '#BBF7D0', padding: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: '#111827', fontWeight: '900', fontSize: 14, flex: 1 }}>{task.title}</Text>
                        <Text style={{ color: '#166534', fontWeight: '900', fontSize: 12, marginLeft: 8 }}>{formatTimeHHmm(task.timeHHmm)}</Text>
                      </View>
                      {task.notes ? (
                        <Text style={{ marginTop: 6, color: '#374151', fontWeight: '700', lineHeight: 18 }}>{task.notes}</Text>
                      ) : null}
                      {task.waterAmountHint ? (
                        <Text style={{ marginTop: 4, color: '#166534', fontWeight: '700', fontSize: 12 }}>{t('dailyRoutine.waterAmount', { amount: task.waterAmountHint })}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

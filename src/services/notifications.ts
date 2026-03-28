import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import {
  FarmingTaskInstanceDetailed,
  TimeOfDay,
  getFarmingPlanForCurrentUser,
  getFarmingTasksForPlanInRangeForCurrentUser,
} from './farmingPlan';

const ANDROID_CHANNEL_ID = 'farming-tasks';
const STORAGE_KEY_PREFIX = 'notifIds:farmingPlan:';

export const configureNotificationsAsync = async () => {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Farming Tasks',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16A34A',
    });
  } catch (e) {
    console.warn('Failed to configure notification channel:', e);
  }
};

export const requestTaskNotificationPermissionAsync = async (): Promise<boolean> => {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;

    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted === true;
  } catch (e) {
    console.warn('Failed to request notification permissions:', e);
    return false;
  }
};

const defaultTimeHHmmForTimeOfDay = (tod: TimeOfDay): string => {
  switch (tod) {
    case 'morning':
      return '07:00';
    case 'afternoon':
      return '13:00';
    case 'evening':
      return '18:00';
    case 'night':
      return '20:30';
    default:
      return '13:00';
  }
};

const dateFromISOAndTime = (dateISO: string, timeHHmm: string): Date | null => {
  try {
    const [hhStr, mmStr] = (timeHHmm || '').split(':');
    const hh = Number(hhStr);
    const mm = Number(mmStr);

    const base = new Date(`${dateISO}T00:00:00`);
    if (Number.isNaN(base.getTime())) return null;

    base.setHours(Number.isFinite(hh) ? hh : 13, Number.isFinite(mm) ? mm : 0, 0, 0);
    return base;
  } catch {
    return null;
  }
};

const getStoredIdsKey = (planId: string) => `${STORAGE_KEY_PREFIX}${planId}`;

const cancelPreviouslyScheduledForPlanAsync = async (planId: string) => {
  try {
    const raw = await AsyncStorage.getItem(getStoredIdsKey(planId));
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    if (!Array.isArray(ids) || ids.length === 0) return;

    await Promise.all(
      ids.map(async (id) => {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch {
          // ignore per-id failures
        }
      })
    );
  } catch (e) {
    console.warn('Failed to cancel previous plan notifications:', e);
  }
};

export const schedulePlanTaskNotificationsAsync = async (params: {
  planId: string;
  windowDays?: number;
  language?: string;
}): Promise<{ scheduledCount: number }> => {
  const windowDays = Math.max(1, Math.min(120, params.windowDays ?? 45));

  const plan = await getFarmingPlanForCurrentUser(params.planId);
  if (!plan) return { scheduledCount: 0 };

  const start = new Date();
  const startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

  const end = new Date(start);
  end.setDate(end.getDate() + windowDays);
  const endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

  const tasks = await getFarmingTasksForPlanInRangeForCurrentUser({
    planId: params.planId,
    startISO,
    endISO,
    language: params.language,
  });

  const now = new Date();

  const detailed: FarmingTaskInstanceDetailed[] = tasks.map((t: any) => {
    const timeOfDay: TimeOfDay = (t.timeOfDay as TimeOfDay) || 'afternoon';
    const timeHHmm = (t.timeHHmm as string) || defaultTimeHHmmForTimeOfDay(timeOfDay);
    return {
      ...(t as any),
      timeOfDay,
      timeHHmm,
    };
  });

  detailed.sort((a, b) => {
    const byDate = a.dueDateISO.localeCompare(b.dueDateISO);
    if (byDate !== 0) return byDate;
    return (a.timeHHmm || '').localeCompare(b.timeHHmm || '');
  });

  // Keep a safe cap to avoid OS scheduling limits.
  const upcoming = detailed
    .map((task) => {
      const triggerDate = dateFromISOAndTime(task.dueDateISO, task.timeHHmm || '13:00');
      return { task, triggerDate };
    })
    .filter((x) => x.triggerDate && x.triggerDate.getTime() > now.getTime())
    .slice(0, 60);

  await configureNotificationsAsync();
  await cancelPreviouslyScheduledForPlanAsync(params.planId);

  const ids: string[] = [];

  for (const { task, triggerDate } of upcoming) {
    if (!triggerDate) continue;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time to ${task.title}`,
          body: task.planTitle ? task.planTitle : task.cropName,
          sound: 'default',
          data: {
            planId: task.planId,
            dueDateISO: task.dueDateISO,
            taskTitle: task.title,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          channelId: ANDROID_CHANNEL_ID,
        },
      });
      ids.push(id);
    } catch (e) {
      console.warn('Failed scheduling notification for task:', task.title, e);
    }
  }

  try {
    await AsyncStorage.setItem(getStoredIdsKey(params.planId), JSON.stringify(ids));
  } catch {
    // ignore
  }

  return { scheduledCount: ids.length };
};

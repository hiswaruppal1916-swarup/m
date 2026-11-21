/**
 * Native Android Companion Bridge
 * Connects the MediTime PWA to Android AlarmManager, Lock-Screen AlarmActivity,
 * Home Screen Widget, and Offline Bi-directional Synchronization.
 */

import { registerPlugin, Capacitor } from '@capacitor/core';
import { db } from '../db';
import type { AlarmInstance, Medicine } from '../types';
import { recordDoseAction, formatFriendlyTime, onAlarmsSynced } from './scheduler';

export interface DevicePermissionStatus {
  notificationsGranted: boolean;
  exactAlarmGranted: boolean;
  batteryOptimizationIgnored: boolean;
  canDrawOverlays: boolean;
  isNative: boolean;
  manufacturer?: string;
  brand?: string;
  model?: string;
  androidSdk?: number;
}

export interface NativeAlarmPayload {
  id: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  triggerTimeMs: number;
  instructions?: string;
  soundTone?: string;
  triggerType?: string;
}

export interface WidgetDataPayload {
  total: number;
  taken: number;
  remaining: number;
  missed: number;
  date: string;
  nextMedName?: string;
  nextMedTime?: string;
  nextMedDosage?: string;
  status?: string;
}

export interface PendingNativeAction {
  action: 'taken' | 'snooze' | 'stop' | 'skip';
  alarmId: string;
  timestamp: number;
}

interface MediTimeNativePluginInterface {
  checkDevicePermissions(): Promise<DevicePermissionStatus>;
  requestExactAlarmPermission(): Promise<void>;
  requestBatteryOptimizationExemption(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  openManufacturerSettings(): Promise<void>;
  scheduleNativeAlarm(options: NativeAlarmPayload): Promise<void>;
  cancelNativeAlarm(options: { id: string }): Promise<void>;
  cancelAllNativeAlarms(): Promise<void>;
  updateWidgetData(data: WidgetDataPayload): Promise<void>;
  getPendingNativeActions(): Promise<{ actions: PendingNativeAction[] }>;
  clearPendingNativeActions(): Promise<void>;
  triggerTestAlarm(options?: { medicineName?: string; dosage?: string }): Promise<void>;
}

// Register native plugin
const NativePlugin = registerPlugin<MediTimeNativePluginInterface>('MediTimeNative');

/**
 * Check if the application is running inside the native Android container
 */
export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Live Device & Permission Diagnostics
 */
export async function checkDevicePermissions(): Promise<DevicePermissionStatus> {
  if (!isNativeAndroid()) {
    // Web / PWA mode fallback diagnostics
    const hasNotification = typeof window !== 'undefined' && 'Notification' in window;
    const notifPermission = hasNotification ? Notification.permission === 'granted' : false;

    return {
      notificationsGranted: notifPermission,
      exactAlarmGranted: false,
      batteryOptimizationIgnored: false,
      canDrawOverlays: false,
      isNative: false,
      manufacturer: 'Web Browser / PWA',
      brand: 'Standard Web'
    };
  }

  try {
    return await NativePlugin.checkDevicePermissions();
  } catch (err) {
    console.warn('[NativeBridge] checkDevicePermissions error:', err);
    return {
      notificationsGranted: false,
      exactAlarmGranted: false,
      batteryOptimizationIgnored: false,
      canDrawOverlays: false,
      isNative: true
    };
  }
}

export async function requestExactAlarmPermission(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await NativePlugin.requestExactAlarmPermission();
  } catch (e) {
    console.error(e);
  }
}

export async function requestBatteryOptimizationExemption(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await NativePlugin.requestBatteryOptimizationExemption();
  } catch (e) {
    console.error(e);
  }
}

export async function openNotificationSettings(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await NativePlugin.openNotificationSettings();
  } catch (e) {
    console.error(e);
  }
}

export async function openManufacturerSettings(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await NativePlugin.openManufacturerSettings();
  } catch (e) {
    console.error(e);
  }
}

export async function triggerTestNativeAlarm(medicineName: string = 'Pantoprazole 40mg', dosage: string = '40mg'): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await NativePlugin.triggerTestAlarm({ medicineName, dosage });
  } catch (e) {
    console.error(e);
  }
}

/**
 * Synchronize daily scheduled alarms to the Android Native AlarmManager
 * and refresh the Home Screen Widget with up-to-date counts.
 */
export async function syncAlarmsToNative(
  alarms: AlarmInstance[],
  medicines: Medicine[],
  dateStr: string
): Promise<void> {
  if (!isNativeAndroid()) return;

  try {
    const medMap = new Map<string, Medicine>(medicines.map(m => [m.id, m]));
    const now = Date.now();

    // 1. Schedule future alarms
    for (const alarm of alarms) {
      // Do not schedule if already completed or skipped
      if (alarm.status === 'taken' || alarm.status === 'skipped') {
        await NativePlugin.cancelNativeAlarm({ id: alarm.id }).catch(() => {});
        continue;
      }

      const med = medMap.get(alarm.medicineId);
      if (!med || !med.active) continue;

      const triggerMs = new Date(alarm.scheduledTime).getTime();
      // Only schedule future or due alarms (with 5 min grace)
      if (triggerMs >= now - 5 * 60 * 1000) {
        await NativePlugin.scheduleNativeAlarm({
          id: alarm.id,
          medicineName: med.name,
          dosage: med.dosage,
          scheduledTime: alarm.scheduledTime,
          triggerTimeMs: Math.max(triggerMs, now + 1000), // at least 1s in future
          instructions: med.instructions || '',
          triggerType: alarm.triggerType
        }).catch(() => {});
      }
    }

    // 2. Compute Widget Statistics
    const total = alarms.length;
    const taken = alarms.filter(a => a.status === 'taken').length;
    const missed = alarms.filter(a => a.status === 'missed').length;
    const remaining = total - taken - missed;

    // Find next upcoming medicine
    const upcomingAlarms = alarms
      .filter(a => a.status === 'pending' || a.status === 'due' || a.status === 'snoozed')
      .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

    let nextMedName = '';
    let nextMedTime = '';
    let nextMedDosage = '';

    if (upcomingAlarms.length > 0) {
      const nextAlarm = upcomingAlarms[0];
      const nextMed = medMap.get(nextAlarm.medicineId);
      if (nextMed) {
        nextMedName = nextMed.name;
        nextMedDosage = nextMed.dosage;
        nextMedTime = formatFriendlyTime(nextAlarm.scheduledTime);
      }
    }

    await NativePlugin.updateWidgetData({
      total,
      taken,
      remaining: Math.max(0, remaining),
      missed,
      date: dateStr,
      nextMedName,
      nextMedTime,
      nextMedDosage,
      status: total > 0 ? (remaining === 0 ? 'All doses taken today' : 'All reminders active') : 'No medicines scheduled'
    }).catch(() => {});

  } catch (err) {
    console.warn('[NativeBridge] syncAlarmsToNative error:', err);
  }
}

/**
 * Synchronize actions taken from Android Native Lock-Screen or Notifications back into Dexie/IndexedDB
 */
export async function syncPendingNativeActions(): Promise<number> {
  if (!isNativeAndroid()) return 0;

  try {
    const res = await NativePlugin.getPendingNativeActions();
    const actions = res.actions || [];
    if (actions.length === 0) return 0;

    let appliedCount = 0;
    for (const item of actions) {
      const alarm = await db.alarmInstances.get(item.alarmId);
      if (alarm) {
        // Idempotent dose action
        await recordDoseAction(item.alarmId, item.action);
        appliedCount++;
      }
    }

    await NativePlugin.clearPendingNativeActions();
    return appliedCount;
  } catch (err) {
    console.warn('[NativeBridge] syncPendingNativeActions error:', err);
    return 0;
  }
}

// Automatically subscribe to scheduler events so native AlarmManager and Widget stay in sync
if (typeof window !== 'undefined') {
  onAlarmsSynced(async (alarms, dateStr) => {
    try {
      const medicines = await db.medicines.toArray();
      await syncAlarmsToNative(alarms, medicines, dateStr);
    } catch (err) {
      console.warn('[NativeBridge] onAlarmsSynced handler error:', err);
    }
  });
}

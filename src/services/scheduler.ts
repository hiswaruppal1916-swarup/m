import { db } from '../db';
import type { 
  Meal, 
  MealLog, 
  MedicationSchedule, 
  AlarmInstance, 
  MedicationLog,
  AdherenceStats
} from '../types';

/**
 * Format a Date object to YYYY-MM-DD string in local time
 */
export function formatLocalDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format Date to HH:mm (24-hour local format)
 */
export function formatLocalTime(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format time to friendly 12-hour AM/PM string
 */
export function formatFriendlyTime(timeStr: string | Date): string {
  const d = typeof timeStr === 'string' ? new Date(timeStr) : timeStr;
  if (isNaN(d.getTime())) {
    // If it's a HH:mm string like "08:30"
    if (typeof timeStr === 'string' && /^\d{2}:\d{2}$/.test(timeStr)) {
      const [h, m] = timeStr.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const hours12 = h % 12 || 12;
      return `${hours12}:${String(m).padStart(2, '0')} ${period}`;
    }
    return String(timeStr);
  }
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${period}`;
}

/**
 * Combine a date string (YYYY-MM-DD) and a time string (HH:mm) into a local Date
 */
export function parseDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/**
 * Pure calculation function: Compute target Date for a schedule given meal data and date.
 * This is pure and easily unit-tested.
 */
export function calculateScheduleTime(
  schedule: MedicationSchedule,
  meal: Meal | undefined,
  mealLog: MealLog | undefined,
  dateStr: string
): Date {
  // Rule 1: Fixed time schedule is strictly independent of meals
  if (schedule.scheduleType === 'fixed_time' || !schedule.mealId) {
    const fixedTime = schedule.fixedTime || '09:00';
    return parseDateTime(dateStr, fixedTime);
  }

  // Base meal planned time
  const mealPlannedTime = meal?.plannedTime || '08:00';
  const plannedMealDate = parseDateTime(dateStr, mealPlannedTime);

  switch (schedule.scheduleType) {
    case 'before_meal':
    case 'empty_stomach': {
      // Planned meal minus interval minutes
      const targetTime = new Date(plannedMealDate.getTime() - schedule.intervalMinutes * 60 * 1000);
      return targetTime;
    }

    case 'with_meal': {
      // If meal has actual start time logged, align with it; otherwise planned meal time
      if (mealLog?.actualStartTime) {
        return new Date(mealLog.actualStartTime);
      }
      return plannedMealDate;
    }

    case 'after_meal': {
      // If meal completed, calculate strictly from actual completion time!
      if (mealLog?.status === 'completed' && mealLog.actualCompletionTime) {
        const completionDate = new Date(mealLog.actualCompletionTime);
        return new Date(completionDate.getTime() + schedule.intervalMinutes * 60 * 1000);
      }
      // If not completed yet, base on planned meal time + interval
      return new Date(plannedMealDate.getTime() + schedule.intervalMinutes * 60 * 1000);
    }

    default:
      return parseDateTime(dateStr, schedule.fixedTime || '09:00');
  }
}

/**
 * Generate or reconcile alarm instances for a given date in IndexedDB.
 * Prevents duplicates. Respects active weekdays, start/end dates, and existing logs.
 */
export async function syncAlarmsForDate(dateStr: string = formatLocalDate()): Promise<AlarmInstance[]> {
  const [medicines, schedules, meals, mealLogs, existingAlarms, logs] = await Promise.all([
    db.medicines.where('active').equals(1).toArray(),
    db.medicationSchedules.where('enabled').equals(1).toArray(),
    db.meals.toArray(),
    db.mealLogs.where('date').equals(dateStr).toArray(),
    db.alarmInstances.where('date').equals(dateStr).toArray(),
    db.medicationLogs.toArray()
  ]);

  const mealMap = new Map<string, Meal>(meals.map(m => [m.id, m]));
  const mealLogMap = new Map<string, MealLog>(mealLogs.map(ml => [ml.mealId, ml]));
  const existingAlarmMap = new Map<string, AlarmInstance>(
    existingAlarms.map(a => [`${a.scheduleId}`, a])
  );
  const logAlarmMap = new Map<string, MedicationLog>(
    logs.filter(l => l.alarmInstanceId).map(l => [l.alarmInstanceId!, l])
  );

  const targetDateObj = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = targetDateObj.getDay(); // 0 = Sun
  const now = new Date();
  const gracePeriodMs = 45 * 60 * 1000; // 45 minutes grace before marking missed

  const alarmsToPut: AlarmInstance[] = [];

  for (const schedule of schedules) {
    const med = medicines.find(m => m.id === schedule.medicineId);
    if (!med || !med.active) continue;

    // Check weekday filter
    if (schedule.weekdays && !schedule.weekdays.includes(dayOfWeek)) {
      continue;
    }

    // Check date ranges
    if (schedule.startDate && dateStr < schedule.startDate) continue;
    if (schedule.endDate && dateStr > schedule.endDate) continue;
    if (med.startDate && dateStr < med.startDate) continue;
    if (med.endDate && dateStr > med.endDate) continue;

    const meal = schedule.mealId ? mealMap.get(schedule.mealId) : undefined;
    const mealLog = schedule.mealId ? mealLogMap.get(schedule.mealId) : undefined;

    const computedDate = calculateScheduleTime(schedule, meal, mealLog, dateStr);
    const existing = existingAlarmMap.get(schedule.id);

    // If an existing instance is already taken or skipped, retain status
    if (existing) {
      const correspondingLog = logAlarmMap.get(existing.id);
      if (correspondingLog || existing.status === 'taken' || existing.status === 'skipped') {
        // Keep as is, do not overwrite historical user action
        continue;
      }

      // If snoozed and snooze period is active, check snooze
      if (existing.status === 'snoozed' && existing.snoozeUntil) {
        const snoozeDate = new Date(existing.snoozeUntil);
        if (now >= snoozeDate) {
          existing.status = 'due';
        }
        alarmsToPut.push(existing);
        continue;
      }

      // If after_meal and meal is completed, dynamically update time if it changed
      if (schedule.scheduleType === 'after_meal' && mealLog?.status === 'completed') {
        existing.scheduledTime = computedDate.toISOString();
        existing.triggerType = 'meal_actual';
        existing.mealLogId = mealLog.id;
      }

      // Check due vs pending vs missed
      const scheduledTimeMs = new Date(existing.scheduledTime).getTime();
      const isToday = dateStr === formatLocalDate();

      if (isToday) {
        if (now.getTime() >= scheduledTimeMs && now.getTime() <= scheduledTimeMs + gracePeriodMs) {
          existing.status = 'due';
        } else if (now.getTime() > scheduledTimeMs + gracePeriodMs) {
          // Beyond grace period and not taken: Mark missed
          existing.status = 'missed';
        } else {
          existing.status = 'pending';
        }
      } else if (dateStr < formatLocalDate()) {
        // Past days: if not taken/skipped, it was missed
        existing.status = 'missed';
      } else {
        // Future days: NEVER mark missed!
        existing.status = 'pending';
      }

      existing.updatedAt = new Date().toISOString();
      alarmsToPut.push(existing);
    } else {
      // Create fresh instance
      const isToday = dateStr === formatLocalDate();
      const scheduledTimeMs = computedDate.getTime();
      let status: AlarmInstance['status'] = 'pending';

      if (isToday) {
        if (now.getTime() >= scheduledTimeMs && now.getTime() <= scheduledTimeMs + gracePeriodMs) {
          status = 'due';
        } else if (now.getTime() > scheduledTimeMs + gracePeriodMs) {
          status = 'missed';
        }
      } else if (dateStr < formatLocalDate()) {
        status = 'missed';
      }

      const newInstance: AlarmInstance = {
        id: `alarm_${schedule.id}_${dateStr}`,
        medicineId: med.id,
        scheduleId: schedule.id,
        date: dateStr,
        scheduledTime: computedDate.toISOString(),
        status,
        triggerType: schedule.scheduleType === 'fixed_time' 
          ? 'fixed' 
          : mealLog?.status === 'completed' ? 'meal_actual' : 'meal_planned',
        mealLogId: mealLog?.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      alarmsToPut.push(newInstance);
    }
  }

  if (alarmsToPut.length > 0) {
    await db.alarmInstances.bulkPut(alarmsToPut);
  }

  return await db.alarmInstances.where('date').equals(dateStr).toArray();
}

/**
 * Handle Meal Finished confirmation:
 * 1. Saves or updates MealLog with actual completion timestamp.
 * 2. Finds all after_meal schedules for this meal.
 * 3. Dynamically recalculates their reminder times.
 * 4. Returns the updated medicine list for user visual confirmation!
 */
export async function confirmMealCompleted(
  mealId: string,
  actualCompletionTime: Date = new Date(),
  dateStr: string = formatLocalDate()
): Promise<{ updatedMedicines: { name: string; dosage: string; oldTime?: string; newTime: string }[] }> {
  // 1. Get meal
  const meal = await db.meals.get(mealId);
  if (!meal) throw new Error(`Meal ${mealId} not found`);

  // 2. Upsert MealLog
  const mealLogId = `meallog_${mealId}_${dateStr}`;
  const existingMealLog = await db.mealLogs.get(mealLogId);

  const mealLog: MealLog = {
    id: mealLogId,
    date: dateStr,
    mealId,
    plannedTime: meal.plannedTime,
    actualStartTime: existingMealLog?.actualStartTime || meal.plannedTime,
    actualCompletionTime: actualCompletionTime.toISOString(),
    status: 'completed'
  };
  await db.mealLogs.put(mealLog);

  // 3. Find affected schedules
  const afterMealSchedules = await db.medicationSchedules
    .where('scheduleType')
    .equals('after_meal')
    .filter(s => s.mealId === mealId && s.enabled)
    .toArray();

  const updatedMedicines: { name: string; dosage: string; oldTime?: string; newTime: string }[] = [];

  for (const schedule of afterMealSchedules) {
    const med = await db.medicines.get(schedule.medicineId);
    if (!med || !med.active) continue;

    const alarmId = `alarm_${schedule.id}_${dateStr}`;
    const alarm = await db.alarmInstances.get(alarmId);

    // If medicine was already taken, do not reschedule!
    if (alarm && (alarm.status === 'taken' || alarm.status === 'skipped')) {
      continue;
    }

    const oldTimeFormatted = alarm ? formatFriendlyTime(alarm.scheduledTime) : undefined;
    
    // New reminder time = completion time + interval minutes
    const newScheduledDate = new Date(actualCompletionTime.getTime() + schedule.intervalMinutes * 60 * 1000);
    const newTimeFormatted = formatFriendlyTime(newScheduledDate);

    const now = new Date();
    let newStatus: AlarmInstance['status'] = 'pending';
    if (now >= newScheduledDate) {
      newStatus = 'due';
    }

    const updatedAlarm: AlarmInstance = {
      id: alarmId,
      medicineId: med.id,
      scheduleId: schedule.id,
      date: dateStr,
      scheduledTime: newScheduledDate.toISOString(),
      status: newStatus,
      triggerType: 'meal_actual',
      mealLogId: mealLog.id,
      createdAt: alarm?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.alarmInstances.put(updatedAlarm);

    updatedMedicines.push({
      name: med.name,
      dosage: med.dosage,
      oldTime: oldTimeFormatted,
      newTime: newTimeFormatted
    });
  }

  return { updatedMedicines };
}

/**
 * Record a medicine dose action: Taken, Snooze, or Skip
 */
export async function recordDoseAction(
  alarmId: string,
  action: 'taken' | 'snooze' | 'skip',
  snoozeMinutes: number = 10,
  notes?: string
): Promise<void> {
  const alarm = await db.alarmInstances.get(alarmId);
  if (!alarm) throw new Error(`Alarm instance ${alarmId} not found`);

  const now = new Date();

  if (action === 'taken') {
    alarm.status = 'taken';
    alarm.updatedAt = now.toISOString();
    await db.alarmInstances.put(alarm);

    // Add to MedicationLog
    const log: MedicationLog = {
      id: `log_${alarm.id}_${now.getTime()}`,
      medicineId: alarm.medicineId,
      alarmInstanceId: alarm.id,
      scheduledTime: alarm.scheduledTime,
      actualTakenTime: now.toISOString(),
      status: 'taken',
      notes
    };
    await db.medicationLogs.put(log);
  } else if (action === 'skip') {
    alarm.status = 'skipped';
    alarm.updatedAt = now.toISOString();
    await db.alarmInstances.put(alarm);

    const log: MedicationLog = {
      id: `log_${alarm.id}_${now.getTime()}`,
      medicineId: alarm.medicineId,
      alarmInstanceId: alarm.id,
      scheduledTime: alarm.scheduledTime,
      status: 'skipped',
      notes: notes || 'User skipped this dose'
    };
    await db.medicationLogs.put(log);
  } else if (action === 'snooze') {
    const snoozeUntil = new Date(now.getTime() + snoozeMinutes * 60 * 1000);
    alarm.status = 'snoozed';
    alarm.snoozeUntil = snoozeUntil.toISOString();
    alarm.updatedAt = now.toISOString();
    await db.alarmInstances.put(alarm);
  }
}

/**
 * Revert or correct a medicine log (Audit Trail Support)
 */
export async function correctDoseLog(
  logId: string,
  newStatus: 'taken' | 'skipped' | 'missed',
  reason: string
): Promise<void> {
  const log = await db.medicationLogs.get(logId);
  if (!log) throw new Error(`Log ${logId} not found`);

  log.status = newStatus;
  log.correctedAt = new Date().toISOString();
  log.correctionReason = reason;
  await db.medicationLogs.put(log);

  // Sync corresponding alarm if exists
  if (log.alarmInstanceId) {
    const alarm = await db.alarmInstances.get(log.alarmInstanceId);
    if (alarm) {
      alarm.status = newStatus;
      alarm.updatedAt = new Date().toISOString();
      await db.alarmInstances.put(alarm);
    }
  }
}

/**
 * Calculate adherence statistics
 */
export async function calculateAdherenceStats(
  startDateStr?: string,
  endDateStr?: string
): Promise<AdherenceStats> {
  const todayStr = formatLocalDate();
  const start = startDateStr || todayStr;
  const end = endDateStr || todayStr;

  const alarms = await db.alarmInstances
    .where('date')
    .between(start, end, true, true)
    .toArray();

  let taken = 0;
  let missed = 0;
  let skipped = 0;
  let pending = 0;

  const now = new Date();

  for (const alarm of alarms) {
    if (alarm.status === 'taken') taken++;
    else if (alarm.status === 'skipped') skipped++;
    else if (alarm.status === 'missed') missed++;
    else {
      // Pending or due
      const isPast = new Date(alarm.scheduledTime).getTime() < now.getTime() - 45 * 60 * 1000;
      if (isPast && alarm.date <= todayStr) {
        missed++;
      } else {
        pending++;
      }
    }
  }

  const finishedCount = taken + missed + skipped;
  const adherencePercentage = finishedCount > 0 
    ? Math.round((taken / finishedCount) * 100) 
    : 100;

  // Streak calculation: past 7 days where adherence >= 80%
  let streakDays = 0;
  const testDate = new Date();
  for (let i = 0; i < 30; i++) {
    const curStr = formatLocalDate(testDate);
    const dayAlarms = await db.alarmInstances.where('date').equals(curStr).toArray();
    if (dayAlarms.length === 0) {
      testDate.setDate(testDate.getDate() - 1);
      continue;
    }
    const dayTaken = dayAlarms.filter(a => a.status === 'taken').length;
    const dayFinished = dayAlarms.filter(a => a.status === 'taken' || a.status === 'missed' || a.status === 'skipped').length;
    if (dayFinished > 0 && (dayTaken / dayFinished) >= 0.8) {
      streakDays++;
      testDate.setDate(testDate.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    totalScheduled: alarms.length,
    taken,
    missed,
    skipped,
    pending,
    adherencePercentage,
    streakDays
  };
}

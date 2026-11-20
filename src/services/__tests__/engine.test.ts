import { describe, it, expect } from 'vitest';
import { calculateScheduleTime } from '../scheduler';
import type { MedicationSchedule, Meal } from '../../types';

describe('MediTime Edge Cases & Scheduling Logic', () => {
  const dateStr = '2026-11-20';

  const lunch: Meal = {
    id: 'lunch',
    mealType: 'lunch',
    plannedTime: '13:30',
    enabled: true,
  };

  it('handles multiple medicines having the exact same scheduled time without collision', () => {
    const schedA: MedicationSchedule = {
      id: 'sched_med_a',
      medicineId: 'med_a',
      scheduleType: 'fixed_time',
      fixedTime: '14:00',
      intervalMinutes: 0,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-01-01',
      enabled: true,
    };

    const schedB: MedicationSchedule = {
      id: 'sched_med_b',
      medicineId: 'med_b',
      scheduleType: 'fixed_time',
      fixedTime: '14:00',
      intervalMinutes: 0,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-01-01',
      enabled: true,
    };

    const timeA = calculateScheduleTime(schedA, lunch, undefined, dateStr);
    const timeB = calculateScheduleTime(schedB, lunch, undefined, dateStr);

    expect(timeA.getTime()).toBe(timeB.getTime());
    expect(schedA.id).not.toBe(schedB.id);
  });

  it('guarantees changing meal times never alters fixed-time reminders', () => {
    const fixedSched: MedicationSchedule = {
      id: 'sched_fixed_night',
      medicineId: 'med_night',
      scheduleType: 'fixed_time',
      fixedTime: '22:00',
      intervalMinutes: 0,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-01-01',
      enabled: true,
    };

    const lunchNormal: Meal = { id: 'lunch', mealType: 'lunch', plannedTime: '13:00', enabled: true };
    const lunchDelayed: Meal = { id: 'lunch', mealType: 'lunch', plannedTime: '15:30', enabled: true };

    const time1 = calculateScheduleTime(fixedSched, lunchNormal, undefined, dateStr);
    const time2 = calculateScheduleTime(fixedSched, lunchDelayed, undefined, dateStr);

    expect(time1.getTime()).toBe(time2.getTime());
    expect(time1.getHours()).toBe(22);
    expect(time1.getMinutes()).toBe(0);
  });

  it('calculates 45-minute before lunch window accurately', () => {
    const beforeLunchSched: MedicationSchedule = {
      id: 'sched_before_lunch',
      medicineId: 'med_c',
      scheduleType: 'before_meal',
      mealId: 'lunch',
      intervalMinutes: 45, // 13:30 - 45 mins = 12:45
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-01-01',
      enabled: true,
    };

    const target = calculateScheduleTime(beforeLunchSched, lunch, undefined, dateStr);
    expect(target.getHours()).toBe(12);
    expect(target.getMinutes()).toBe(45);
  });
});

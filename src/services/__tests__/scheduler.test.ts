import { describe, it, expect } from 'vitest';
import { 
  calculateScheduleTime, 
  formatFriendlyTime 
} from '../scheduler';
import type { MedicationSchedule, Meal, MealLog } from '../../types';

describe('MediTime Hybrid Scheduling Engine', () => {
  const dateStr = '2026-11-20';
  const breakfast: Meal = {
    id: 'breakfast',
    mealType: 'breakfast',
    plannedTime: '08:00',
    enabled: true,
  };

  it('calculates fixed-time schedule strictly independent of meals', () => {
    const fixedSchedule: MedicationSchedule = {
      id: 'sched_fixed',
      medicineId: 'med_atorvastatin',
      scheduleType: 'fixed_time',
      fixedTime: '21:30',
      intervalMinutes: 0,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-01-01',
      enabled: true,
    };

    const targetDate = calculateScheduleTime(fixedSchedule, breakfast, undefined, dateStr);
    expect(targetDate.getHours()).toBe(21);
    expect(targetDate.getMinutes()).toBe(30);
  });

  it('calculates before-meal schedule as planned meal minus interval', () => {
    const beforeMealSchedule: MedicationSchedule = {
      id: 'sched_before',
      medicineId: 'med_pantoprazole',
      scheduleType: 'before_meal',
      mealId: 'breakfast',
      intervalMinutes: 30, // 30 mins before 08:00 -> 07:30
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-01-01',
      enabled: true,
    };

    const targetDate = calculateScheduleTime(beforeMealSchedule, breakfast, undefined, dateStr);
    expect(targetDate.getHours()).toBe(7);
    expect(targetDate.getMinutes()).toBe(30);
  });

  it('calculates empty-stomach schedule with custom interval before meal', () => {
    const emptyStomachSchedule: MedicationSchedule = {
      id: 'sched_empty',
      medicineId: 'med_thyroxine',
      scheduleType: 'empty_stomach',
      mealId: 'breakfast',
      intervalMinutes: 60, // 60 mins before 08:00 -> 07:00
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-01-01',
      enabled: true,
    };

    const targetDate = calculateScheduleTime(emptyStomachSchedule, breakfast, undefined, dateStr);
    expect(targetDate.getHours()).toBe(7);
    expect(targetDate.getMinutes()).toBe(0);
  });

  it('calculates after-meal baseline when meal is not yet completed', () => {
    const afterMealSchedule: MedicationSchedule = {
      id: 'sched_after',
      medicineId: 'med_metformin',
      scheduleType: 'after_meal',
      mealId: 'breakfast',
      intervalMinutes: 15, // 15 mins after 08:00 -> 08:15
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-01-01',
      enabled: true,
    };

    const uncompletedMealLog: MealLog = {
      id: 'log_b',
      date: dateStr,
      mealId: 'breakfast',
      plannedTime: '08:00',
      status: 'upcoming',
    };

    const targetDate = calculateScheduleTime(afterMealSchedule, breakfast, uncompletedMealLog, dateStr);
    expect(targetDate.getHours()).toBe(8);
    expect(targetDate.getMinutes()).toBe(15);
  });

  it('DYNAMICALLY recalculates after-meal schedule from actual meal completion time', () => {
    const afterMealSchedule: MedicationSchedule = {
      id: 'sched_after',
      medicineId: 'med_metformin',
      scheduleType: 'after_meal',
      mealId: 'breakfast',
      intervalMinutes: 15,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-01-01',
      enabled: true,
    };

    // User finishes breakfast late at 08:40 AM
    const completedLateMealLog: MealLog = {
      id: 'log_b',
      date: dateStr,
      mealId: 'breakfast',
      plannedTime: '08:00',
      actualCompletionTime: '2026-11-20T08:40:00',
      status: 'completed',
    };

    // Reminder must be 08:40 + 15 mins = 08:55 AM!
    const targetDate = calculateScheduleTime(afterMealSchedule, breakfast, completedLateMealLog, dateStr);
    expect(targetDate.getHours()).toBe(8);
    expect(targetDate.getMinutes()).toBe(55);
  });

  it('calculates with-meal schedule correctly', () => {
    const withMealSchedule: MedicationSchedule = {
      id: 'sched_with',
      medicineId: 'med_multivitamin',
      scheduleType: 'with_meal',
      mealId: 'breakfast',
      intervalMinutes: 0,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-01-01',
      enabled: true,
    };

    const targetDate = calculateScheduleTime(withMealSchedule, breakfast, undefined, dateStr);
    expect(targetDate.getHours()).toBe(8);
    expect(targetDate.getMinutes()).toBe(0);
  });

  it('correctly formats friendly 12-hour AM/PM time strings', () => {
    expect(formatFriendlyTime('08:15')).toBe('8:15 AM');
    expect(formatFriendlyTime('13:30')).toBe('1:30 PM');
    expect(formatFriendlyTime('21:00')).toBe('9:00 PM');
    expect(formatFriendlyTime('00:05')).toBe('12:05 AM');
  });
});

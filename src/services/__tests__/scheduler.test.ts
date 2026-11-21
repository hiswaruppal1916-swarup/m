import { describe, it, expect } from 'vitest';
import { 
  calculateScheduleTime, 
  formatFriendlyTime,
  calculateAdherence,
  formatLocalDate,
  parseDateTime 
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

  // TEST SUITE: Part 1 - Medicine G & Medicine T synchronization
  it('correctly computes Medicine G (Breakfast, Before Meal, 15m) and Medicine T (Breakfast, After Meal, 5m)', () => {
    const medGSchedule: MedicationSchedule = {
      id: 'sched_med_g',
      medicineId: 'med_g',
      scheduleType: 'before_meal',
      mealId: 'breakfast',
      intervalMinutes: 15, // 15 mins before 08:00 -> 07:45 AM
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-01-01',
      enabled: true,
    };

    const medTSchedule: MedicationSchedule = {
      id: 'sched_med_t',
      medicineId: 'med_t',
      scheduleType: 'after_meal',
      mealId: 'breakfast',
      intervalMinutes: 5, // 5 mins after 08:00 -> 08:05 AM
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-01-01',
      enabled: true,
    };

    const timeG = calculateScheduleTime(medGSchedule, breakfast, undefined, dateStr);
    const timeT = calculateScheduleTime(medTSchedule, breakfast, undefined, dateStr);

    expect(timeG.getHours()).toBe(7);
    expect(timeG.getMinutes()).toBe(45);
    expect(formatFriendlyTime(timeG)).toBe('7:45 AM');

    expect(timeT.getHours()).toBe(8);
    expect(timeT.getMinutes()).toBe(5);
    expect(formatFriendlyTime(timeT)).toBe('8:05 AM');

    // Chronological order: Medicine G occurs before Medicine T
    expect(timeG.getTime()).toBeLessThan(timeT.getTime());
  });

  // TEST SUITE: Part 2 - Adherence Math Verification (Eliminating 100% bug on 0 doses)
  describe('Adherence Mathematics Engine', () => {
    it('returns N/A (null percentage) when zero eligible doses exist (CRITICAL BUG FIX)', () => {
      const res = calculateAdherence(0, 0, 0);
      expect(res.totalEligible).toBe(0);
      expect(res.adherencePercentage).toBeNull();
      expect(res.displayPercentage).toBe('N/A');
    });

    it('returns 100% when 1 dose is taken with 0 missed or skipped', () => {
      const res = calculateAdherence(1, 0, 0);
      expect(res.totalEligible).toBe(1);
      expect(res.adherencePercentage).toBe(100);
      expect(res.displayPercentage).toBe('100%');
    });

    it('returns 0% when 1 dose is missed with 0 taken', () => {
      const res = calculateAdherence(0, 1, 0);
      expect(res.totalEligible).toBe(1);
      expect(res.adherencePercentage).toBe(0);
      expect(res.displayPercentage).toBe('0%');
    });

    it('returns 0% when 1 dose is skipped with 0 taken', () => {
      const res = calculateAdherence(0, 0, 1);
      expect(res.totalEligible).toBe(1);
      expect(res.adherencePercentage).toBe(0);
      expect(res.displayPercentage).toBe('0%');
    });

    it('calculates transparent adherence across mixed doses (3 taken, 1 missed, 1 skipped -> 60%)', () => {
      const res = calculateAdherence(3, 1, 1);
      expect(res.totalEligible).toBe(5);
      expect(res.adherencePercentage).toBe(60);
      expect(res.displayPercentage).toBe('60%');
    });
  });

  // TEST SUITE: Local Timezone-Safe Date Calculations
  describe('Timezone & Date Utilities', () => {
    it('formats local dates consistently as YYYY-MM-DD', () => {
      const testDate = new Date(2026, 10, 21, 14, 30, 0); // Month 10 is November
      expect(formatLocalDate(testDate)).toBe('2026-11-21');
    });

    it('parses local date and time without UTC conversion drift', () => {
      const parsed = parseDateTime('2026-11-21', '08:30');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(10);
      expect(parsed.getDate()).toBe(21);
      expect(parsed.getHours()).toBe(8);
      expect(parsed.getMinutes()).toBe(30);
    });
  });
});

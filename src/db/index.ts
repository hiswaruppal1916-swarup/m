import Dexie, { type EntityTable } from 'dexie';
import type { 
  Medicine, 
  Meal, 
  MealLog, 
  MedicationSchedule, 
  AlarmInstance, 
  MedicationLog, 
  UserSettings 
} from '../types';

export class MediTimeDB extends Dexie {
  medicines!: EntityTable<Medicine, 'id'>;
  meals!: EntityTable<Meal, 'id'>;
  mealLogs!: EntityTable<MealLog, 'id'>;
  medicationSchedules!: EntityTable<MedicationSchedule, 'id'>;
  alarmInstances!: EntityTable<AlarmInstance, 'id'>;
  medicationLogs!: EntityTable<MedicationLog, 'id'>;
  settings!: EntityTable<UserSettings, 'id'>;

  constructor() {
    super('MediTimeDB');
    this.version(1).stores({
      medicines: 'id, active, category, createdAt',
      meals: 'id, mealType, enabled',
      mealLogs: 'id, date, mealId, [date+mealId], status',
      medicationSchedules: 'id, medicineId, scheduleType, mealId, enabled',
      alarmInstances: 'id, date, medicineId, scheduleId, [date+medicineId], status, scheduledTime',
      medicationLogs: 'id, medicineId, alarmInstanceId, scheduledTime, status, actualTakenTime',
      settings: 'id'
    });
  }
}

export const db = new MediTimeDB();

// Default meals
export const DEFAULT_MEALS: Meal[] = [
  { id: 'breakfast', mealType: 'breakfast', plannedTime: '08:00', enabled: true },
  { id: 'lunch', mealType: 'lunch', plannedTime: '13:30', enabled: true },
  { id: 'dinner', mealType: 'dinner', plannedTime: '20:30', enabled: true },
  { id: 'snacks', mealType: 'snacks', plannedTime: '17:00', enabled: false },
];

export const DEFAULT_SETTINGS: UserSettings = {
  id: 'current_user',
  language: 'en',
  voiceEnabled: true,
  voiceLang: 'en',
  voiceSpeed: 1.0,
  soundVolume: 0.8,
  alarmSound: 'gentle_chime',
  highContrast: false,
  caregiverModeEnabled: false,
  patientName: 'Care Recipient',
  onboardingCompleted: false,
};

/**
 * Initialize DB defaults (default meals, default settings)
 */
export async function initializeDatabase(): Promise<void> {
  const mealCount = await db.meals.count();
  if (mealCount === 0) {
    await db.meals.bulkAdd(DEFAULT_MEALS);
  }

  const settings = await db.settings.get('current_user');
  if (!settings) {
    await db.settings.add(DEFAULT_SETTINGS);
  }
}

/**
 * Load realistic sample data for quick preview / testing
 */
export async function seedDemoData(): Promise<void> {
  const medCount = await db.medicines.count();
  if (medCount > 0) return; // Do not overwrite user data

  const today = new Date().toISOString().split('T')[0];

  const sampleMeds: { medicine: Medicine; schedules: MedicationSchedule[] }[] = [
    {
      medicine: {
        id: 'med_pantoprazole',
        name: 'Pantoprazole (প্যান্টোপ্রাজল)',
        dosage: '40 mg - 1 Capsule',
        category: 'capsule',
        frequency: 'once_daily',
        instructions: 'Take 30 minutes before breakfast with a glass of water on empty stomach.',
        startDate: today,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      schedules: [
        {
          id: 'sched_pantoprazole_1',
          medicineId: 'med_pantoprazole',
          scheduleType: 'before_meal',
          mealId: 'breakfast',
          intervalMinutes: 30,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          startDate: today,
          enabled: true
        }
      ]
    },
    {
      medicine: {
        id: 'med_metformin',
        name: 'Metformin (মেটফর্মিন)',
        dosage: '500 mg - 1 Tablet',
        category: 'tablet',
        frequency: 'twice_daily',
        instructions: 'Take 15 minutes after food to prevent stomach upset.',
        startDate: today,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      schedules: [
        {
          id: 'sched_metformin_b',
          medicineId: 'med_metformin',
          scheduleType: 'after_meal',
          mealId: 'breakfast',
          intervalMinutes: 15,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          startDate: today,
          enabled: true
        },
        {
          id: 'sched_metformin_d',
          medicineId: 'med_metformin',
          scheduleType: 'after_meal',
          mealId: 'dinner',
          intervalMinutes: 15,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          startDate: today,
          enabled: true
        }
      ]
    },
    {
      medicine: {
        id: 'med_atorvastatin',
        name: 'Atorvastatin (অ্যাটোরভাস্টাটিন)',
        dosage: '10 mg - 1 Tablet',
        category: 'tablet',
        frequency: 'once_daily',
        instructions: 'Take fixed at night before bedtime.',
        startDate: today,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      schedules: [
        {
          id: 'sched_atorvastatin_1',
          medicineId: 'med_atorvastatin',
          scheduleType: 'fixed_time',
          fixedTime: '21:30',
          intervalMinutes: 0,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          startDate: today,
          enabled: true
        }
      ]
    }
  ];

  for (const item of sampleMeds) {
    await db.medicines.add(item.medicine);
    for (const sched of item.schedules) {
      await db.medicationSchedules.add(sched);
    }
  }
}

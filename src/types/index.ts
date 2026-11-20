export type MedicineCategory = 
  | 'tablet' 
  | 'capsule' 
  | 'syrup' 
  | 'injection' 
  | 'drops' 
  | 'inhaler' 
  | 'topical' 
  | 'other';

export type FrequencyType = 
  | 'once_daily' 
  | 'twice_daily' 
  | 'thrice_daily' 
  | 'custom';

export type ScheduleType = 
  | 'before_meal' 
  | 'after_meal' 
  | 'with_meal' 
  | 'empty_stomach' 
  | 'fixed_time' 
  | 'custom';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type MealStatus = 
  | 'upcoming' 
  | 'started' 
  | 'completed' 
  | 'delayed' 
  | 'not_confirmed';

export type AlarmStatus = 
  | 'pending' 
  | 'due' 
  | 'taken' 
  | 'snoozed' 
  | 'skipped' 
  | 'missed';

export type TriggerType = 
  | 'fixed' 
  | 'meal_planned' 
  | 'meal_actual' 
  | 'snooze';

export type LogStatus = 'taken' | 'skipped' | 'missed';

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  category: MedicineCategory;
  image?: string;
  prescriptionImage?: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  frequency: FrequencyType;
  instructions?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Meal {
  id: string; // e.g. 'breakfast'
  mealType: MealType;
  plannedTime: string; // HH:mm
  enabled: boolean;
}

export interface MealLog {
  id: string;
  date: string; // YYYY-MM-DD
  mealId: string;
  plannedTime: string; // HH:mm
  actualStartTime?: string; // ISO
  actualCompletionTime?: string; // ISO
  status: MealStatus;
}

export interface MedicationSchedule {
  id: string;
  medicineId: string;
  scheduleType: ScheduleType;
  mealId?: string; // 'breakfast' | 'lunch' | 'dinner' | 'snacks'
  fixedTime?: string; // HH:mm
  intervalMinutes: number; // e.g., 30 for 30m before/after
  weekdays: number[]; // [0,1,2,3,4,5,6] (0=Sun)
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  enabled: boolean;
}

export interface AlarmInstance {
  id: string;
  medicineId: string;
  scheduleId: string;
  date: string; // YYYY-MM-DD
  scheduledTime: string; // ISO 8601
  status: AlarmStatus;
  triggerType: TriggerType;
  mealLogId?: string;
  snoozeUntil?: string; // ISO 8601
  createdAt: string;
  updatedAt?: string;
}

export interface MedicationLog {
  id: string;
  medicineId: string;
  alarmInstanceId?: string;
  scheduledTime: string; // ISO 8601
  actualTakenTime?: string; // ISO 8601
  status: LogStatus;
  notes?: string;
  correctedAt?: string;
  correctionReason?: string;
}

export interface UserSettings {
  id: string;
  language: 'en' | 'bn';
  voiceEnabled: boolean;
  voiceLang: 'en' | 'bn';
  voiceSpeed: number; // 0.8 - 1.2
  soundVolume: number; // 0.1 - 1.0
  alarmSound: 'gentle_chime' | 'medical_beep' | 'zen_bell';
  highContrast: boolean;
  caregiverModeEnabled: boolean;
  caregiverName?: string;
  caregiverContact?: string;
  patientName?: string;
  onboardingCompleted: boolean;
}

export interface AdherenceStats {
  totalScheduled: number;
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
  adherencePercentage: number;
  streakDays: number;
}

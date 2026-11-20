import { useEffect, useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Home, 
  Pill, 
  Calendar, 
  History as HistoryIcon, 
  Settings as SettingsIcon, 
  Download, 
  Wifi, 
  WifiOff 
} from 'lucide-react';

import { db, initializeDatabase, DEFAULT_SETTINGS } from './db';
import type { 
  Medicine, 
  MedicationSchedule, 
  AlarmInstance 
} from './types';
import { 
  formatLocalDate, 
  syncAlarmsForDate 
} from './services/scheduler';
import { translations } from './services/i18n';
import { showWebNotification } from './services/notifications';

// Components
import { Dashboard } from './components/Dashboard';
import { MedicineList } from './components/MedicineList';
import { MedicineModal } from './components/MedicineModal';
import { MealTracker } from './components/MealTracker';
import { DailySchedule } from './components/DailySchedule';
import { AlarmModal } from './components/AlarmModal';
import { MealConfirmedModal } from './components/MealConfirmedModal';
import { HistoryView } from './components/HistoryView';
import { ReportsView } from './components/ReportsView';
import { CaregiverView } from './components/CaregiverView';
import { SettingsView } from './components/SettingsView';
import { CompatibilityView } from './components/CompatibilityView';
import { OnboardingModal } from './components/OnboardingModal';

export function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'medicines' | 'schedule' | 'history' | 'settings' | 'meals' | 'reports' | 'caregiver' | 'diagnostics'>('home');
  const [selectedDate, setSelectedDate] = useState<string>(formatLocalDate());
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  // Modal states
  const [isMedicineModalOpen, setIsMedicineModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<MedicationSchedule | null>(null);

  const [activeAlarm, setActiveAlarm] = useState<{ alarm: AlarmInstance; medicine: Medicine } | null>(null);
  const [mealFeedback, setMealFeedback] = useState<{
    mealName: string;
    completionTime: string;
    updatedMedicines: any[];
  } | null>(null);

  // DB initialization
  useEffect(() => {
    initializeDatabase().then(() => {
      syncAlarmsForDate();
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Capture PWA installation prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Standalone check
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // Reactive DB queries
  const medicines = useLiveQuery(() => db.medicines.toArray()) || [];
  const schedules = useLiveQuery(() => db.medicationSchedules.toArray()) || [];
  const meals = useLiveQuery(() => db.meals.toArray()) || [];
  const todayStr = formatLocalDate();
  const mealLogs = useLiveQuery(() => db.mealLogs.where('date').equals(todayStr).toArray()) || [];
  const todayAlarms = useLiveQuery(() => db.alarmInstances.where('date').equals(todayStr).toArray()) || [];
  const selectedDateAlarms = useLiveQuery(() => db.alarmInstances.where('date').equals(selectedDate).toArray()) || [];
  const medicationLogs = useLiveQuery(() => db.medicationLogs.toArray()) || [];
  const userSettings = useLiveQuery(() => db.settings.get('current_user')) || DEFAULT_SETTINGS;

  // Active Layer 1 Application Alarm Scheduler: checks every 10 seconds for due alarms
  const lastAlarmTriggerRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkAlarmsInterval = setInterval(async () => {
      const now = new Date();
      const alarms = await db.alarmInstances.where('date').equals(todayStr).toArray();

      for (const alarm of alarms) {
        if (alarm.status === 'pending' || alarm.status === 'due') {
          const scheduledMs = new Date(alarm.scheduledTime).getTime();
          if (now.getTime() >= scheduledMs) {
            // Trigger alarm if not currently triggering
            if (!lastAlarmTriggerRef.current.has(alarm.id)) {
              lastAlarmTriggerRef.current.add(alarm.id);

              const med = await db.medicines.get(alarm.medicineId);
              if (med && med.active) {
                // Update alarm status to due
                alarm.status = 'due';
                await db.alarmInstances.put(alarm);

                // Show in-app full-screen alarm modal
                setActiveAlarm({ alarm, medicine: med });

                // Fire Web Notification as well
                showWebNotification('MediTime: Medicine Alert!', {
                  body: `Time to take ${med.name} (${med.dosage})`,
                  tag: alarm.id,
                });
              }
            }
          }
        }
      }
    }, 8000);

    return () => clearInterval(checkAlarmsInterval);
  }, [todayStr]);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      alert(
        userSettings.language === 'bn'
          ? 'অ্যাপ ইনস্টল করতে আপনার ব্রাউজারের থ্রি-ডট মেনু থেকে "Install app" বা "Add to Home screen" নির্বাচন করুন।'
          : 'To install MediTime, tap the browser menu (⋮) and choose "Install app" or "Add to Home screen".'
      );
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  const handleToggleLanguage = async () => {
    const newLang = userSettings.language === 'en' ? 'bn' : 'en';
    await db.settings.update(userSettings.id, {
      language: newLang,
      voiceLang: newLang,
    });
  };

  const t = translations[userSettings.language];
  const isBn = userSettings.language === 'bn';

  // Compute live adherence stats
  const finishedLogs = todayAlarms.filter(a => a.status === 'taken' || a.status === 'missed' || a.status === 'skipped');
  const takenCount = todayAlarms.filter(a => a.status === 'taken').length;
  const missedCount = todayAlarms.filter(a => a.status === 'missed').length;
  const skippedCount = todayAlarms.filter(a => a.status === 'skipped').length;
  const pendingCount = todayAlarms.filter(a => a.status === 'pending' || a.status === 'due').length;
  const adherencePercentage = finishedLogs.length > 0 
    ? Math.round((takenCount / finishedLogs.length) * 100) 
    : 100;

  const stats = {
    totalScheduled: todayAlarms.length,
    taken: takenCount,
    missed: missedCount,
    skipped: skippedCount,
    pending: pendingCount,
    adherencePercentage,
    streakDays: 3, // Initial healthy momentum
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-700 to-teal-500 flex items-center justify-center shadow-md shadow-teal-700/20">
              <Pill className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                {t.appName}
              </h1>
              <p className="text-[10px] text-teal-700 font-bold uppercase tracking-wider">
                {t.tagline}
              </p>
            </div>
          </div>

          {/* Quick utility controls */}
          <div className="flex items-center gap-2">
            {/* Online / Offline status badge */}
            <div
              className={`p-1.5 rounded-xl flex items-center gap-1 text-[11px] font-bold ${
                isOnline ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
              }`}
              title={isOnline ? t.onlineMode : t.offlineMode}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </div>

            {/* Install PWA Button */}
            {!isInstalled && (
              <button
                onClick={handleInstallApp}
                className="py-1 px-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
                title={t.installApp}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.installApp}</span>
              </button>
            )}

            {/* Language Switcher Toggle */}
            <button
              onClick={handleToggleLanguage}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition border border-slate-200 cursor-pointer"
              title="Toggle English / বাংলা"
            >
              {userSettings.language === 'en' ? 'বাংলা' : 'EN'}
            </button>
          </div>
        </div>

        {/* Secondary Navigation Pills for Extra Views */}
        <div className="max-w-md mx-auto flex items-center gap-2 overflow-x-auto pt-2 pb-0.5 no-scrollbar text-xs">
          <button
            onClick={() => setActiveTab('meals')}
            className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'meals'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🍽️ {isBn ? 'খাবার ট্র্যাকার' : 'Meal Tracker'}
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-teal-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📊 {isBn ? 'রিপোর্ট ও অ্যানালিটিক্স' : 'Clinical Reports'}
          </button>

          <button
            onClick={() => setActiveTab('caregiver')}
            className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'caregiver'
                ? 'bg-teal-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🤝 {isBn ? 'কেয়ারগিভার মোড' : 'Caregiver'}
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'bg-teal-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🛡️ {isBn ? 'অ্যালার্ম যাচাই' : 'Diagnostics'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto p-4">
        {activeTab === 'home' && (
          <Dashboard
            medicines={medicines}
            alarms={todayAlarms}
            meals={meals}
            mealLogs={mealLogs}
            stats={stats}
            settings={userSettings}
            onNavigate={(tab) => setActiveTab(tab as any)}
            onTriggerAlarm={(alarm, med) => setActiveAlarm({ alarm, medicine: med })}
            onMealConfirmedFeedback={(mealName, time, updatedMeds) => {
              setMealFeedback({ mealName, completionTime: time, updatedMedicines: updatedMeds });
            }}
          />
        )}

        {activeTab === 'medicines' && (
          <MedicineList
            medicines={medicines}
            schedules={schedules}
            meals={meals}
            language={userSettings.language}
            onAddMedicine={() => {
              setEditingMedicine(null);
              setEditingSchedule(null);
              setIsMedicineModalOpen(true);
            }}
            onEditMedicine={(med, sched) => {
              setEditingMedicine(med);
              setEditingSchedule(sched || null);
              setIsMedicineModalOpen(true);
            }}
            onRefresh={() => syncAlarmsForDate()}
          />
        )}

        {activeTab === 'meals' && (
          <MealTracker
            meals={meals}
            mealLogs={mealLogs}
            language={userSettings.language}
            onMealConfirmedFeedback={(mealName, time, updatedMeds) => {
              setMealFeedback({ mealName, completionTime: time, updatedMedicines: updatedMeds });
            }}
            onRefresh={() => syncAlarmsForDate()}
          />
        )}

        {activeTab === 'schedule' && (
          <DailySchedule
            medicines={medicines}
            alarms={selectedDateAlarms}
            selectedDate={selectedDate}
            settings={userSettings}
            onSelectDate={(d) => {
              setSelectedDate(d);
              syncAlarmsForDate(d);
            }}
            onTriggerAlarm={(alarm, med) => setActiveAlarm({ alarm, medicine: med })}
            onRefresh={() => syncAlarmsForDate(selectedDate)}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            logs={medicationLogs}
            medicines={medicines}
            settings={userSettings}
            onRefresh={() => syncAlarmsForDate()}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            stats={stats}
            medicines={medicines}
            logs={medicationLogs}
            settings={userSettings}
          />
        )}

        {activeTab === 'caregiver' && (
          <CaregiverView
            settings={userSettings}
            stats={stats}
            onRefresh={() => syncAlarmsForDate()}
          />
        )}

        {activeTab === 'diagnostics' && (
          <CompatibilityView language={userSettings.language} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={userSettings}
            meals={meals}
            onRefresh={() => syncAlarmsForDate()}
          />
        )}
      </main>

      {/* Primary Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 py-2">
        <div className="max-w-md mx-auto grid grid-cols-5 px-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center py-1 transition cursor-pointer ${
              activeTab === 'home' ? 'text-teal-700 font-black' : 'text-slate-400 font-medium hover:text-slate-600'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-1">{t.navHome}</span>
          </button>

          <button
            onClick={() => setActiveTab('medicines')}
            className={`flex flex-col items-center justify-center py-1 transition cursor-pointer ${
              activeTab === 'medicines' ? 'text-teal-700 font-black' : 'text-slate-400 font-medium hover:text-slate-600'
            }`}
          >
            <Pill className="w-5 h-5" />
            <span className="text-[10px] mt-1">{t.navMedicines}</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex flex-col items-center justify-center py-1 transition cursor-pointer ${
              activeTab === 'schedule' ? 'text-teal-700 font-black' : 'text-slate-400 font-medium hover:text-slate-600'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] mt-1">{t.navSchedule}</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center py-1 transition cursor-pointer ${
              activeTab === 'history' ? 'text-teal-700 font-black' : 'text-slate-400 font-medium hover:text-slate-600'
            }`}
          >
            <HistoryIcon className="w-5 h-5" />
            <span className="text-[10px] mt-1">{t.navHistory}</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center py-1 transition cursor-pointer ${
              activeTab === 'settings' ? 'text-teal-700 font-black' : 'text-slate-400 font-medium hover:text-slate-600'
            }`}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px] mt-1">{t.navSettings}</span>
          </button>
        </div>
      </nav>

      {/* Full-Screen Alarm Interface Modal */}
      {activeAlarm && (
        <AlarmModal
          alarm={activeAlarm.alarm}
          medicine={activeAlarm.medicine}
          language={userSettings.language}
          voiceEnabled={userSettings.voiceEnabled}
          soundVolume={userSettings.soundVolume}
          alarmSound={userSettings.alarmSound}
          onClose={() => {
            setActiveAlarm(null);
            syncAlarmsForDate();
          }}
        />
      )}

      {/* Medicine Add/Edit Form Modal */}
      {isMedicineModalOpen && (
        <MedicineModal
          initialMedicine={editingMedicine}
          initialSchedule={editingSchedule}
          meals={meals}
          language={userSettings.language}
          onClose={() => setIsMedicineModalOpen(false)}
          onSaved={() => syncAlarmsForDate()}
        />
      )}

      {/* Meal Confirmation & Dynamic Rescheduling Feedback Modal */}
      {mealFeedback && (
        <MealConfirmedModal
          mealName={mealFeedback.mealName}
          completionTime={mealFeedback.completionTime}
          updatedMedicines={mealFeedback.updatedMedicines}
          language={userSettings.language}
          onClose={() => setMealFeedback(null)}
        />
      )}

      {/* First-Time Onboarding Flow */}
      {!userSettings.onboardingCompleted && (
        <OnboardingModal
          settings={userSettings}
          meals={meals}
          onComplete={() => syncAlarmsForDate()}
        />
      )}
    </div>
  );
}

export default App;

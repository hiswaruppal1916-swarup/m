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
  WifiOff,
  CheckCircle2
} from 'lucide-react';

import { db, initializeDatabase, DEFAULT_SETTINGS } from './db';
import type { 
  Medicine, 
  MedicationSchedule, 
  AlarmInstance 
} from './types';
import { 
  formatLocalDate, 
  syncAlarmsForDate,
  calculateAdherence 
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

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
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true) {
      setIsInstalled(true);
    }

    // Notification click routing handler from Service Worker
    const handleSwMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'OPEN_ALARM_FROM_NOTIFICATION' && event.data.alarmId) {
        const alarm = await db.alarmInstances.get(event.data.alarmId);
        if (alarm) {
          const med = await db.medicines.get(alarm.medicineId);
          if (med) {
            setActiveAlarm({ alarm, medicine: med });
          }
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  // Reactive DB queries
  const medicines = useLiveQuery(() => db.medicines.toArray()) || [];
  const schedules = useLiveQuery(() => db.medicationSchedules.toArray()) || [];
  const meals = useLiveQuery(() => db.meals.toArray()) || [];
  const todayStr = formatLocalDate();
  const mealLogs = useLiveQuery(() => db.mealLogs.where('date').equals(todayStr).toArray()) || [];
  const allAlarms = useLiveQuery(() => db.alarmInstances.toArray()) || [];
  const todayAlarms = useLiveQuery(() => db.alarmInstances.where('date').equals(todayStr).toArray()) || [];
  const selectedDateAlarms = useLiveQuery(() => db.alarmInstances.where('date').equals(selectedDate).toArray()) || [];
  const medicationLogs = useLiveQuery(() => db.medicationLogs.toArray()) || [];
  const userSettings = useLiveQuery(() => db.settings.get('current_user')) || DEFAULT_SETTINGS;

  // Active Layer 1 Application Alarm Scheduler: checks every 6 seconds for due alarms
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

                // Independent Medicine Notification
                const privacy = userSettings.notificationPrivacy || 'full';
                const notifBody = privacy === 'full'
                  ? `Time to take ${med.name} (${med.dosage})`
                  : 'It is time to take your prescribed medicine.';

                showWebNotification('MediTime — Medicine Reminder', {
                  body: notifBody,
                  tag: alarm.id,
                  data: { alarmId: alarm.id, medicineId: med.id }
                });
              }
            }
          }
        }
      }
    }, 6000);

    return () => clearInterval(checkAlarmsInterval);
  }, [todayStr, userSettings.notificationPrivacy]);

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

  // Trigger test alarm screen for users to verify their alarm tone, volume, voice & buttons
  const handleTriggerTestAlarm = () => {
    let testMed = medicines.find(m => m.active);
    if (!testMed) {
      testMed = {
        id: 'med_test_preview',
        name: userSettings.language === 'bn' ? 'মেটফর্মিন ৫০০ মি.গ্রা.' : 'Metformin (500mg)',
        dosage: '500 mg - 1 Tablet',
        category: 'tablet',
        frequency: 'once_daily',
        instructions: userSettings.language === 'bn' ? 'খাবারের পর পানি সহ গ্রহণ করুন' : 'Take after breakfast with water',
        startDate: todayStr,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    const testAlarm: AlarmInstance = {
      id: `test_alarm_${Date.now()}`,
      medicineId: testMed.id,
      scheduleId: 'test_sched',
      date: todayStr,
      scheduledTime: new Date().toISOString(),
      status: 'due',
      triggerType: 'fixed',
      createdAt: new Date().toISOString()
    };
    setActiveAlarm({ alarm: testAlarm, medicine: testMed });
  };

  const t = translations[userSettings.language];
  const isBn = userSettings.language === 'bn';

  // Compute live adherence stats transparently (using mathematical formula)
  const takenCount = todayAlarms.filter(a => a.status === 'taken').length;
  const missedCount = todayAlarms.filter(a => a.status === 'missed').length;
  const skippedCount = todayAlarms.filter(a => a.status === 'skipped').length;
  const pendingCount = todayAlarms.filter(a => a.status === 'pending' || a.status === 'due').length;
  const { adherencePercentage } = calculateAdherence(takenCount, missedCount, skippedCount);

  const stats = {
    totalScheduled: todayAlarms.length,
    taken: takenCount,
    missed: missedCount,
    skipped: skippedCount,
    pending: pendingCount,
    adherencePercentage,
    streakDays: 3,
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
            onNavigateToMedicines={() => setActiveTab('medicines')}
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
            medicines={medicines}
            logs={medicationLogs}
            alarms={allAlarms}
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
          <CompatibilityView 
            language={userSettings.language}
            onTriggerTestAlarm={handleTriggerTestAlarm}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={userSettings}
            meals={meals}
            onRefresh={() => syncAlarmsForDate()}
            onTriggerTestAlarm={handleTriggerTestAlarm}
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

      {/* Full-Screen Smart Alarm Interface Modal */}
      {activeAlarm && (
        <AlarmModal
          alarm={activeAlarm.alarm}
          medicine={activeAlarm.medicine}
          settings={userSettings}
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
          onClose={() => {
            setIsMedicineModalOpen(false);
            setEditingMedicine(null);
            setEditingSchedule(null);
          }}
          onSaved={async (savedMedicineName?: string) => {
            setIsMedicineModalOpen(false);
            setEditingMedicine(null);
            setEditingSchedule(null);
            setActiveTab('medicines');
            await syncAlarmsForDate();
            const displayName = savedMedicineName || (userSettings.language === 'bn' ? 'ওষুধ' : 'Medicine');
            setToastMessage(
              userSettings.language === 'bn'
                ? `"${displayName}" সফলভাবে সংরক্ষিত হয়েছে!`
                : `"${displayName}" saved successfully!`
            );
          }}
        />
      )}

      {/* Floating Success Toast Banner */}
      {toastMessage && (
        <div 
          role="status" 
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-teal-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-teal-500/40 animate-in fade-in slide-in-from-top-3 duration-200 max-w-sm w-[92%] sm:w-auto"
        >
          <CheckCircle2 className="w-5 h-5 text-teal-300 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold flex-1 leading-snug">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-teal-200 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer shrink-0"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
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

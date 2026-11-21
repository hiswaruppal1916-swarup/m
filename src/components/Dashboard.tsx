import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Utensils, 
  PlusCircle, 
  ArrowRight, 
  AlertCircle, 
  Calendar,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import type { 
  AlarmInstance, 
  Medicine, 
  Meal, 
  MealLog, 
  AdherenceStats,
  UserSettings
} from '../types';
import { 
  formatLocalDate, 
  formatFriendlyTime, 
  confirmMealCompleted 
} from '../services/scheduler';
import { translations } from '../services/i18n';
import { playSuccessChime } from '../services/sound';

interface DashboardProps {
  medicines: Medicine[];
  alarms: AlarmInstance[];
  meals: Meal[];
  mealLogs: MealLog[];
  stats: AdherenceStats;
  settings: UserSettings;
  onNavigate: (tab: string) => void;
  onTriggerAlarm: (alarm: AlarmInstance, medicine: Medicine) => void;
  onMealConfirmedFeedback: (mealName: string, time: string, updatedMeds: any[]) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  medicines,
  alarms,
  meals,
  mealLogs,
  stats,
  settings,
  onNavigate,
  onTriggerAlarm,
  onMealConfirmedFeedback,
}) => {
  const t = translations[settings.language];
  const isBn = settings.language === 'bn';
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = formatLocalDate(currentTime);

  // Time of day greeting
  const hour = currentTime.getHours();
  const greeting = 
    hour < 12 ? t.greetingMorning :
    hour < 17 ? t.greetingAfternoon :
    hour < 21 ? t.greetingEvening : t.greetingNight;

  // Format today's date in local friendly string
  const friendlyDate = currentTime.toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  // Medicine mapping lookup
  const medicineMap = new Map<string, Medicine>(medicines.map(m => [m.id, m]));
  const mealMap = new Map<string, Meal>(meals.map(m => [m.id, m]));
  const mealLogMap = new Map<string, MealLog>(mealLogs.map(ml => [ml.mealId, ml]));

  // Find next upcoming or due dose
  const sortedAlarms = [...alarms].sort((a, b) => 
    new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
  );

  const nextDueAlarm = sortedAlarms.find(a => a.status === 'due' || a.status === 'pending');
  const nextMedicine = nextDueAlarm ? medicineMap.get(nextDueAlarm.medicineId) : undefined;

  // Current or next relevant meal for quick confirmation
  const activeMeal = meals.find(m => {
    if (!m.enabled) return false;
    const log = mealLogMap.get(m.id);
    return log?.status !== 'completed';
  }) || meals[0];

  const activeMealLog = activeMeal ? mealLogMap.get(activeMeal.id) : undefined;

  // Meal finish handler
  const handleMealFinished = async (mealId: string) => {
    const meal = mealMap.get(mealId);
    if (!meal) return;

    playSuccessChime();
    const now = new Date();
    const result = await confirmMealCompleted(mealId, now, todayStr);
    
    const mealNameDisplay = isBn
      ? meal.mealType === 'breakfast' ? 'সকালের নাস্তা' :
        meal.mealType === 'lunch' ? 'দুপুরের খাবার' :
        meal.mealType === 'dinner' ? 'রাতের খাবার' : 'বিকেলের নাশতা'
      : meal.mealType.toUpperCase();

    onMealConfirmedFeedback(
      mealNameDisplay,
      formatFriendlyTime(now),
      result.updatedMedicines
    );
  };

  const handleQuickTake = async (alarm: AlarmInstance) => {
    const med = medicineMap.get(alarm.medicineId);
    if (!med) return;
    onTriggerAlarm(alarm, med);
  };

  return (
    <div className="space-y-5 pb-8 animate-in fade-in duration-300">
      {/* Top Greeting & Date Header */}
      <div className="bg-gradient-to-br from-teal-700 via-teal-800 to-slate-900 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-44 h-44 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex justify-between items-start relative z-10">
          <div>
            <span className="text-teal-200 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {friendlyDate}
            </span>
            <h1 className="text-2xl font-black mt-1">
              {greeting}{settings.patientName ? `, ${settings.patientName}` : ''}!
            </h1>
            <p className="text-teal-100/90 text-sm mt-0.5">
              {isBn ? 'আপনার স্বাস্থ্যই আমাদের অগ্রাধিকার।' : 'Keeping your health on schedule.'}
            </p>
          </div>

          {/* Adherence Streak Badge */}
          {stats.streakDays > 0 && (
            <div className="bg-white/15 border border-white/20 rounded-2xl p-2.5 text-center min-w-[70px]">
              <Sparkles className="w-4 h-4 text-amber-300 mx-auto" />
              <span className="text-base font-black text-white">{stats.streakDays}</span>
              <p className="text-[10px] text-teal-200 uppercase font-semibold">
                {isBn ? 'দিন স্ট্রিক' : 'Day Streak'}
              </p>
            </div>
          )}
        </div>

        {/* Adherence Progress Bar */}
        <div className="mt-5 pt-4 border-t border-teal-600/50">
          <div className="flex justify-between text-xs font-semibold mb-1.5">
            <span className="text-teal-100">{t.todayProgress}</span>
            <span className="text-white font-bold">
              {stats.adherencePercentage !== null ? `${stats.adherencePercentage}%` : (isBn ? 'প্রযোজ্য নয় (N/A)' : 'N/A')}
            </span>
          </div>
          <div className="w-full h-3 bg-teal-950/60 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${stats.adherencePercentage ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 text-center">
          <span className="text-xs text-slate-500 font-medium block">{t.totalMedicines}</span>
          <span className="text-lg font-black text-slate-800">{stats.totalScheduled}</span>
        </div>
        <div className="bg-emerald-50/80 p-3 rounded-2xl shadow-sm border border-emerald-100 text-center">
          <span className="text-xs text-emerald-700 font-medium block">{t.takenToday}</span>
          <span className="text-lg font-black text-emerald-600">{stats.taken}</span>
        </div>
        <div className="bg-teal-50/80 p-3 rounded-2xl shadow-sm border border-teal-100 text-center">
          <span className="text-xs text-teal-700 font-medium block">{t.upcomingToday}</span>
          <span className="text-lg font-black text-teal-600">{stats.pending}</span>
        </div>
        <div className="bg-red-50/80 p-3 rounded-2xl shadow-sm border border-red-100 text-center">
          <span className="text-xs text-red-700 font-medium block">{t.missedToday}</span>
          <span className="text-lg font-black text-red-600">{stats.missed}</span>
        </div>
      </div>

      {/* Next Medicine Due Card */}
      {nextDueAlarm && nextMedicine ? (
        <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-teal-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
                {t.nextMedicine}
              </span>
            </div>
            <span className="text-xs font-extrabold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              {formatFriendlyTime(nextDueAlarm.scheduledTime)}
            </span>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{nextMedicine.name}</h3>
              <p className="text-teal-600 font-semibold text-sm mt-0.5">{nextMedicine.dosage}</p>
              {nextMedicine.instructions && (
                <p className="text-xs text-slate-500 mt-1.5">ℹ️ {nextMedicine.instructions}</p>
              )}
            </div>

            <button
              onClick={() => handleQuickTake(nextDueAlarm)}
              className="py-3 px-5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold rounded-2xl shadow-md transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <CheckCircle2 className="w-5 h-5" />
              {t.takeNow}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-teal-50/60 border border-teal-100 rounded-3xl p-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-teal-600 mx-auto mb-1" />
          <h4 className="font-bold text-slate-800 text-sm">{t.noUpcoming}</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBn ? 'আপনার সমস্ত নির্ধারিত ওষুধ নিয়মিত গ্রহণ সম্পন্ন হয়েছে।' : 'All scheduled doses for today have been taken!'}
          </p>
        </div>
      )}

      {/* Smart Meal Tracker Card */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-teal-500/10 border border-amber-200/60 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Utensils className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{t.mealTracker}</h3>
              <p className="text-xs text-slate-500">
                {isBn ? 'খাবার সমাপ্তির ভিত্তিতে ওষুধ হিসাব' : 'Recalculates after-meal doses safely'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('meals')}
            className="text-xs font-semibold text-amber-800 hover:underline flex items-center gap-0.5"
          >
            {t.viewAll} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Meal Status Pills */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {meals.slice(0, 3).map((meal) => {
            const log = mealLogMap.get(meal.id);
            const isCompleted = log?.status === 'completed';
            const mealTitle = isBn
              ? meal.mealType === 'breakfast' ? 'নাস্তা' :
                meal.mealType === 'lunch' ? 'দুপুর' : 'রাত'
              : meal.mealType.toUpperCase();

            return (
              <div
                key={meal.id}
                className={`p-2.5 rounded-2xl border text-center transition ${
                  isCompleted
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <span className="text-xs font-bold block">{mealTitle}</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {isCompleted && log?.actualCompletionTime
                    ? `✓ ${formatFriendlyTime(log.actualCompletionTime)}`
                    : formatFriendlyTime(meal.plannedTime)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Big "I HAVE FINISHED MY MEAL" button */}
        {activeMeal && activeMealLog?.status !== 'completed' && (
          <button
            onClick={() => handleMealFinished(activeMeal.id)}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-extrabold text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Utensils className="w-4 h-4" />
            {t.finishedMealBtn} ({activeMeal.mealType.toUpperCase()})
          </button>
        )}
      </div>

      {/* Today's Schedule Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base">{t.todaySchedule}</h3>
          <button
            onClick={() => onNavigate('schedule')}
            className="text-xs font-semibold text-teal-700 hover:underline flex items-center gap-1"
          >
            {t.viewAll} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {sortedAlarms.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-100">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">{t.noMedicinesYet}</p>
            <button
              onClick={() => onNavigate('medicines')}
              className="mt-3 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition"
            >
              + {t.addMedicine}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedAlarms.slice(0, 4).map((alarm) => {
              const med = medicineMap.get(alarm.medicineId);
              if (!med) return null;

              const isTaken = alarm.status === 'taken';
              const isMissed = alarm.status === 'missed';
              const isDue = alarm.status === 'due';

              return (
                <div
                  key={alarm.id}
                  className={`bg-white rounded-2xl p-3.5 border transition flex items-center justify-between ${
                    isDue
                      ? 'border-teal-500 bg-teal-50/30 ring-1 ring-teal-500/30'
                      : isTaken
                      ? 'border-emerald-100 bg-emerald-50/20'
                      : isMissed
                      ? 'border-red-100 bg-red-50/20'
                      : 'border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isTaken
                          ? 'bg-emerald-100 text-emerald-700'
                          : isMissed
                          ? 'bg-red-100 text-red-700'
                          : isDue
                          ? 'bg-teal-600 text-white animate-pulse'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {formatFriendlyTime(alarm.scheduledTime).split(' ')[0]}
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{med.name}</h4>
                      <p className="text-xs text-slate-500">{med.dosage}</p>
                    </div>
                  </div>

                  <div>
                    {isTaken ? (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> {t.takenToday}
                      </span>
                    ) : isMissed ? (
                      <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {t.missedToday}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleQuickTake(alarm)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl transition ${
                          isDue
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isDue ? t.takeNow : t.btnTaken}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={() => onNavigate('medicines')}
          className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:border-teal-300 transition flex items-center gap-2.5 text-left cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
            <PlusCircle className="w-5 h-5 text-teal-700" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-xs">{t.addMedicine}</h4>
            <p className="text-[10px] text-slate-400">
              {isBn ? 'নতুন প্রেসক্রিপশন' : 'New prescription'}
            </p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('diagnostics')}
          className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:border-teal-300 transition flex items-center gap-2.5 text-left cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-sky-700" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-xs">{t.navDiagnostics}</h4>
            <p className="text-[10px] text-slate-400">
              {isBn ? 'অ্যালার্ম যাচাই' : 'System check'}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};

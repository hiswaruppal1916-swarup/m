import React, { useState } from 'react';
import { 
  Settings, 
  Volume2, 
  Mic, 
  Globe, 
  Clock, 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  Check, 
  User, 
  Sparkles 
} from 'lucide-react';
import { db, seedDemoData } from '../db';
import type { Meal, UserSettings } from '../types';
import { playAlarmSound, playSuccessChime } from '../services/sound';
import { voiceService } from '../services/voice';
import { syncAlarmsForDate } from '../services/scheduler';

interface SettingsViewProps {
  settings: UserSettings;
  meals: Meal[];
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  meals,
  onRefresh,
}) => {
  const isBn = settings.language === 'bn';

  const [language, setLanguage] = useState<'en' | 'bn'>(settings.language);
  const [patientName, setPatientName] = useState(settings.patientName || '');
  const [voiceEnabled, setVoiceEnabled] = useState(settings.voiceEnabled);
  const [voiceLang, setVoiceLang] = useState<'en' | 'bn'>(settings.voiceLang);
  const [voiceSpeed, setVoiceSpeed] = useState(settings.voiceSpeed);
  const [soundVolume, setSoundVolume] = useState(settings.soundVolume);
  const [alarmSound, setAlarmSound] = useState(settings.alarmSound);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Meal times state
  const [mealTimes, setMealTimes] = useState<Record<string, string>>(
    meals.reduce((acc, m) => ({ ...acc, [m.id]: m.plannedTime }), {})
  );

  const handleSaveSettings = async () => {
    const updated: UserSettings = {
      ...settings,
      language,
      patientName,
      voiceEnabled,
      voiceLang,
      voiceSpeed,
      soundVolume,
      alarmSound,
    };
    await db.settings.put(updated);

    // Save meals
    for (const meal of meals) {
      if (mealTimes[meal.id]) {
        await db.meals.update(meal.id, { plannedTime: mealTimes[meal.id] });
      }
    }

    await syncAlarmsForDate();
    playSuccessChime();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
    onRefresh();
  };

  const handleTestVoice = () => {
    voiceService.speak({
      language: voiceLang,
      rate: voiceSpeed,
      type: 'due',
    });
  };

  const handleTestSound = () => {
    playAlarmSound(alarmSound, soundVolume);
  };

  const handleLoadDemo = async () => {
    await seedDemoData();
    await syncAlarmsForDate();
    onRefresh();
    alert(isBn ? 'ডেমো প্রেসক্রিপশন সফলভাবে লোড হয়েছে!' : 'Demo prescriptions loaded successfully!');
  };

  const handleExportData = async () => {
    const [medicines, schedules, mealsData, mealLogs, alarmInstances, logs, userSettings] = await Promise.all([
      db.medicines.toArray(),
      db.medicationSchedules.toArray(),
      db.meals.toArray(),
      db.mealLogs.toArray(),
      db.alarmInstances.toArray(),
      db.medicationLogs.toArray(),
      db.settings.toArray(),
    ]);

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      medicines,
      medicationSchedules: schedules,
      meals: mealsData,
      mealLogs,
      alarmInstances,
      medicationLogs: logs,
      settings: userSettings,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meditime_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.medicines) await db.medicines.bulkPut(data.medicines);
        if (data.medicationSchedules) await db.medicationSchedules.bulkPut(data.medicationSchedules);
        if (data.meals) await db.meals.bulkPut(data.meals);
        if (data.mealLogs) await db.mealLogs.bulkPut(data.mealLogs);
        if (data.alarmInstances) await db.alarmInstances.bulkPut(data.alarmInstances);
        if (data.medicationLogs) await db.medicationLogs.bulkPut(data.medicationLogs);

        await syncAlarmsForDate();
        onRefresh();
        alert(isBn ? 'ব্যাকআপ সফলভাবে রিস্টোর করা হয়েছে!' : 'Backup restored successfully!');
      } catch {
        alert(isBn ? 'ফাইল ফরম্যাট সঠিক নয়।' : 'Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = async () => {
    const confirmText = isBn
      ? 'আপনি কি নিশ্চিত যে সমস্ত লোকাল ডাটা মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।'
      : 'Are you sure you want to delete ALL local data? This cannot be undone.';
    if (!window.confirm(confirmText)) return;

    await Promise.all([
      db.medicines.clear(),
      db.medicationSchedules.clear(),
      db.mealLogs.clear(),
      db.alarmInstances.clear(),
      db.medicationLogs.clear(),
    ]);

    await syncAlarmsForDate();
    onRefresh();
    alert(isBn ? 'সমস্ত লোকাল ডাটা সফলভাবে মুছে ফেলা হয়েছে।' : 'All local data has been erased.');
  };

  return (
    <div className="space-y-4 pb-14 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-800 to-slate-900 rounded-3xl p-5 text-white shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black">{isBn ? 'সেটিংস ও পছন্দসমূহ' : 'Settings & Preferences'}</h2>
          <p className="text-xs text-teal-200 mt-0.5">
            {isBn ? 'ভাষা, খাবারের সময়সূচী ও ভয়েস নিয়ন্ত্রণ' : 'Personalize language, meal schedule & audio alert preferences'}
          </p>
        </div>
        <Settings className="w-8 h-8 text-teal-300" />
      </div>

      {/* Language Selector */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Globe className="w-4 h-4 text-teal-600" />
          {isBn ? 'অ্যাপের ভাষা / Language' : 'App Language'}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`py-3 rounded-2xl border text-xs font-bold transition cursor-pointer ${
              language === 'en'
                ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage('bn')}
            className={`py-3 rounded-2xl border text-xs font-bold transition cursor-pointer ${
              language === 'bn'
                ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            বাংলা (Bengali)
          </button>
        </div>
      </div>

      {/* Patient Name */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <User className="w-4 h-4 text-teal-600" />
          {isBn ? 'ব্যবহারকারীর নাম / প্রোফাইল' : 'Patient Name / Profile'}
        </h3>
        <input
          type="text"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          placeholder={isBn ? 'আপনার নাম লিখুন' : 'Enter your name'}
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
        />
      </div>

      {/* Meal Times Configuration */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-600" />
          {isBn ? 'স্বাভাবিক খাবারের সময়সূচী' : 'Default Meal Times'}
        </h3>
        <p className="text-xs text-slate-500">
          {isBn
            ? 'খাবারের আগের বা পরের ওষুধগুলো এই সময়ের ভিত্তিতে স্মরণ করানো হবে।'
            : 'Base timeline used when dynamic completion has not occurred yet.'}
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
          {meals.map((meal) => {
            const title = isBn
              ? meal.mealType === 'breakfast' ? 'সকালের নাস্তা' :
                meal.mealType === 'lunch' ? 'দুপুরের খাবার' :
                meal.mealType === 'dinner' ? 'রাতের খাবার' : 'নাশতা'
              : meal.mealType.toUpperCase();

            return (
              <div key={meal.id} className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="block text-xs font-bold text-slate-700 mb-1">{title}</span>
                <input
                  type="time"
                  value={mealTimes[meal.id] || meal.plannedTime}
                  onChange={(e) => setMealTimes({ ...mealTimes, [meal.id]: e.target.value })}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Voice Reminders */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Mic className="w-4 h-4 text-teal-600" />
            {isBn ? 'কণ্ঠস্বর রিমাইন্ডার (Web Speech)' : 'Voice Announcements'}
          </h3>
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`w-12 h-7 flex items-center rounded-full p-1 transition cursor-pointer ${
              voiceEnabled ? 'bg-teal-600 justify-end' : 'bg-slate-300 justify-start'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
          </button>
        </div>

        {voiceEnabled && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'কণ্ঠস্বরের ভাষা' : 'Announcement Language'}
              </label>
              <select
                value={voiceLang}
                onChange={(e) => setVoiceLang(e.target.value as 'en' | 'bn')}
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-medium"
              >
                <option value="en">English (US/UK)</option>
                <option value="bn">বাংলা (Bengali)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? `পড়ার গতি (${voiceSpeed}x)` : `Speech Rate (${voiceSpeed}x)`}
              </label>
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.1"
                value={voiceSpeed}
                onChange={(e) => setVoiceSpeed(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </div>

            <button
              type="button"
              onClick={handleTestVoice}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5 text-teal-600" />
              {isBn ? 'ভয়েস টেস্ট শুনুন' : 'Test Voice Speech'}
            </button>
          </div>
        )}
      </div>

      {/* Alarm Sound & Synthesizer */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-teal-600" />
          {isBn ? 'অ্যালার্মের শব্দ ও ভলিউম' : 'Alarm Sound & Volume'}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? 'অ্যালার্ম টিউন' : 'Tone Style'}
            </label>
            <select
              value={alarmSound}
              onChange={(e) => setAlarmSound(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-medium"
            >
              <option value="gentle_chime">{isBn ? 'শান্ত সুর (Gentle)' : 'Gentle Chime'}</option>
              <option value="medical_beep">{isBn ? 'মেডিকেল অ্যালার্ম (Urgent)' : 'Medical Alert'}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? `শব্দের মাত্রা (${Math.round(soundVolume * 100)}%)` : `Volume (${Math.round(soundVolume * 100)}%)`}
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={soundVolume}
              onChange={(e) => setSoundVolume(Number(e.target.value))}
              className="w-full accent-teal-600 mt-2"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleTestSound}
          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
        >
          <Volume2 className="w-3.5 h-3.5 text-teal-600" />
          {isBn ? 'শব্দ পরীক্ষা করুন' : 'Test Sound Chime'}
        </button>
      </div>

      {/* Save Settings Button */}
      <button
        onClick={handleSaveSettings}
        className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-black text-sm rounded-2xl shadow-lg shadow-teal-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
      >
        <Check className="w-5 h-5" />
        {savedSuccess
          ? isBn ? 'সেটিংস সংরক্ষিত হয়েছে ✓' : 'Settings Saved Successfully! ✓'
          : isBn ? 'সেটিংস সংরক্ষণ করুন' : 'Save All Preferences'}
      </button>

      {/* Data Management & Seed Demo */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Database className="w-4 h-4 text-teal-600" />
          {isBn ? 'ডাটা ব্যাকআপ ও পরিচালনা' : 'Data Management & Backup'}
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleLoadDemo}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-teal-800 hover:bg-teal-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            {isBn ? 'ডেমো ডাটা লোড' : 'Load Demo Prescriptions'}
          </button>

          <button
            onClick={handleExportData}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            {isBn ? 'ব্যাকআপ ডাউনলোড' : 'Export JSON Backup'}
          </button>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <label className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center justify-center gap-1.5 cursor-pointer text-center">
            <Upload className="w-4 h-4 text-slate-600" />
            <span>{isBn ? 'ব্যাকআপ রিস্টোর' : 'Import JSON Backup'}</span>
            <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
          </label>

          <button
            onClick={handleClearAll}
            className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 hover:bg-red-100 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            {isBn ? 'ডাটা মুছুন' : 'Erase All'}
          </button>
        </div>
      </div>
    </div>
  );
};

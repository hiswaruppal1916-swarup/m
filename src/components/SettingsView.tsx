import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Play,
  Square,
  Music,
  Plus,
  Bell,
  Shield,
  RotateCcw
} from 'lucide-react';
import { db, seedDemoData, DEFAULT_SETTINGS } from '../db';
import type { 
  Meal, 
  UserSettings, 
  AlertMode, 
  CustomAudioTrack 
} from '../types';
import { 
  BUILT_IN_TONES, 
  startSoundPreview, 
  stopSoundPreview, 
  isAlarmAudioPlaying,
  playSuccessChime 
} from '../services/sound';
import { voiceService } from '../services/voice';
import { showWebNotification, requestNotificationPermission } from '../services/notifications';
import { syncAlarmsForDate } from '../services/scheduler';

interface SettingsViewProps {
  settings: UserSettings;
  meals: Meal[];
  onRefresh: () => void;
  onTriggerTestAlarm?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  meals,
  onRefresh,
  onTriggerTestAlarm,
}) => {
  const isBn = settings.language === 'bn';

  const [language, setLanguage] = useState<'en' | 'bn'>(settings.language);
  const [patientName, setPatientName] = useState(settings.patientName || '');
  const [alertMode, setAlertMode] = useState<AlertMode>(settings.alertMode || 'alarm_and_voice');
  const [alarmTone, setAlarmTone] = useState<string>(settings.alarmTone || settings.alarmSound || 'gentle_chime');
  const [voiceEnabled, setVoiceEnabled] = useState(settings.voiceEnabled);
  const [voiceLang, setVoiceLang] = useState<'en' | 'bn'>(settings.voiceLang || 'en');
  const [voiceURI, setVoiceURI] = useState<string>(settings.voiceVoiceURI || '');
  const [voiceSpeed, setVoiceSpeed] = useState(settings.voiceSpeed || 1.0);
  const [soundVolume, setSoundVolume] = useState(settings.soundVolume ?? 0.8);
  const [snoozeDuration, setSnoozeDuration] = useState<number>(settings.snoozeDurationMinutes || 10);
  const [notificationPrivacy, setNotificationPrivacy] = useState<'full' | 'discrete'>(settings.notificationPrivacy || 'full');
  
  // Custom audio tracks from IndexedDB
  const [customTracks, setCustomTracks] = useState<CustomAudioTrack[]>([]);
  const [currentlyPreviewingTone, setCurrentlyPreviewingTone] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Meal times state
  const [mealTimes, setMealTimes] = useState<Record<string, string>>(
    meals.reduce((acc, m) => ({ ...acc, [m.id]: m.plannedTime }), {})
  );

  useEffect(() => {
    loadCustomTracks();
    setAvailableVoices(voiceService.getAvailableVoices());
    return () => {
      stopSoundPreview();
      voiceService.stop();
    };
  }, []);

  const loadCustomTracks = async () => {
    try {
      const tracks = await db.customAudio.toArray();
      setCustomTracks(tracks);
    } catch (err) {
      console.warn('Could not load custom audio tracks:', err);
    }
  };

  const handleSaveSettings = async () => {
    const updated: UserSettings = {
      ...settings,
      language,
      patientName,
      alertMode,
      alarmTone: alarmTone as any,
      alarmSound: (alarmTone.startsWith('custom:') ? 'gentle_chime' : alarmTone) as any,
      voiceEnabled,
      voiceLang,
      voiceVoiceURI: voiceURI || undefined,
      voiceSpeed,
      soundVolume,
      snoozeDurationMinutes: snoozeDuration,
      notificationPrivacy,
      lastSyncTimestamp: new Date().toISOString()
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

  const handleResetToDefault = async () => {
    const confirmMsg = isBn
      ? 'আপনি কি সেটিংস ডিফল্ট মানে রিসেট করতে চান?'
      : 'Reset all reminder preferences to defaults?';
    if (!window.confirm(confirmMsg)) return;

    setAlertMode(DEFAULT_SETTINGS.alertMode);
    setAlarmTone(DEFAULT_SETTINGS.alarmTone);
    setVoiceEnabled(DEFAULT_SETTINGS.voiceEnabled);
    setVoiceLang(DEFAULT_SETTINGS.voiceLang);
    setVoiceSpeed(DEFAULT_SETTINGS.voiceSpeed);
    setSoundVolume(DEFAULT_SETTINGS.soundVolume);
    setSnoozeDuration(DEFAULT_SETTINGS.snoozeDurationMinutes);
    setNotificationPrivacy(DEFAULT_SETTINGS.notificationPrivacy);

    await db.settings.put({ ...DEFAULT_SETTINGS, id: 'current_user', patientName });
    await syncAlarmsForDate();
    onRefresh();
  };

  const handlePlayPreview = (toneId: string, customBlob?: Blob) => {
    if (currentlyPreviewingTone === toneId && isAlarmAudioPlaying()) {
      stopSoundPreview();
      setCurrentlyPreviewingTone(null);
    } else {
      stopSoundPreview();
      setCurrentlyPreviewingTone(toneId);
      startSoundPreview(toneId, soundVolume, customBlob);
    }
  };

  const handleStopPreview = () => {
    stopSoundPreview();
    setCurrentlyPreviewingTone(null);
  };

  const handleTestVoice = () => {
    voiceService.speak({
      medicineName: isBn ? 'মেটফর্মিন ৫০০ মিলিগ্রাম' : 'Metformin 500mg',
      dosage: '500 mg',
      language: voiceLang,
      voiceURI: voiceURI || undefined,
      rate: voiceSpeed,
      type: 'due',
    });
  };

  const handleTestNotification = async () => {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      alert(
        isBn
          ? 'নোটিফিকেশন অনুমতি পাওয়া যায়নি। অনুগ্রহ করে ব্রাউজার সেটিংস থেকে অনুমতি দিন।'
          : 'Notification permission is blocked. Please allow notifications in your browser settings.'
      );
      return;
    }

    const ok = await showWebNotification(
      'MediTime — Medicine Reminder',
      {
        body: isBn
          ? 'টেস্ট রিমাইন্ডার: আপনার প্যান্টোপ্রাজল ৪০ মি.গ্রা. খাওয়ার সময় হয়েছে।'
          : 'Test Reminder: Time to take your Pantoprazole 40mg before breakfast.',
      }
    );

    if (ok) {
      alert(isBn ? 'টেস্ট নোটিফিকেশন সফলভাবে পাঠানো হয়েছে!' : 'Test notification delivered successfully!');
    }
  };

  // Upload Custom Sound from Phone
  const handleUploadCustomSound = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate mime type
    const validMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/x-m4a', 'audio/mp4'];
    const isSupportedType = validMimes.includes(file.type) || file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i);

    if (!isSupportedType) {
      alert(
        isBn
          ? 'অনুগ্রহ করে একটি সমর্থিত অডিও ফাইল নির্বাচন করুন (MP3, WAV, OGG, M4A)।'
          : 'Please select a supported audio file (MP3, WAV, OGG, or M4A).'
      );
      return;
    }

    try {
      const trackId = `custom_${Date.now()}`;
      const newTrack: CustomAudioTrack = {
        id: trackId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        blob: file,
        mimeType: file.type || 'audio/mpeg',
        size: file.size,
        createdAt: new Date().toISOString()
      };

      await db.customAudio.put(newTrack);
      await loadCustomTracks();
      setAlarmTone(`custom:${trackId}`);
      alert(isBn ? 'কাস্টম অডিও সফলভাবে সংরক্ষিত ও নির্বাচিত হয়েছে!' : 'Custom sound saved and selected as your alarm tone!');
    } catch (err) {
      alert(isBn ? 'অডিও ফাইল সংরক্ষণে সমস্যা হয়েছে।' : 'Failed to save custom audio file to storage.');
    }
  };

  const handleDeleteCustomTrack = async (trackId: string) => {
    const confirmMsg = isBn ? 'এই কাস্টম অডিও মুছে ফেলতে চান?' : 'Delete this custom audio track?';
    if (!window.confirm(confirmMsg)) return;

    await db.customAudio.delete(trackId);
    if (alarmTone === `custom:${trackId}`) {
      setAlarmTone('gentle_chime');
    }
    await loadCustomTracks();
  };

  const handleLoadDemo = async () => {
    await seedDemoData();
    await syncAlarmsForDate();
    onRefresh();
    alert(isBn ? 'ডেমো প্রেসক্রিপশন সফলভাবে লোড হয়েছে!' : 'Demo prescriptions loaded successfully!');
  };

  const handleExportData = async () => {
    const [medicines, schedules, mealsData, mealLogs, alarmInstances, logs, userSettings, customAudioList] = await Promise.all([
      db.medicines.toArray(),
      db.medicationSchedules.toArray(),
      db.meals.toArray(),
      db.mealLogs.toArray(),
      db.alarmInstances.toArray(),
      db.medicationLogs.toArray(),
      db.settings.toArray(),
      db.customAudio.toArray(),
    ]);

    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      medicines,
      medicationSchedules: schedules,
      meals: mealsData,
      mealLogs,
      alarmInstances,
      medicationLogs: logs,
      settings: userSettings,
      customAudioMetadata: customAudioList.map(c => ({ id: c.id, name: c.name, size: c.size, mimeType: c.mimeType, createdAt: c.createdAt })),
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
      db.customAudio.clear(),
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
          <h2 className="text-xl font-black">{isBn ? 'রিমাইন্ডার ও অ্যালার্ম সেটিংস' : 'Reminder & Alarm Preferences'}</h2>
          <p className="text-xs text-teal-200 mt-0.5">
            {isBn ? 'সম্পূর্ণ ব্যবহারকারী-নিয়ন্ত্রিত অ্যালার্ম, টিউন ও ভয়েস সেটিংস' : 'Customer-controlled alert modes, sound library & voice preferences'}
          </p>
        </div>
        <Settings className="w-8 h-8 text-teal-300" />
      </div>

      {/* 1. App Language & User Profile */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Globe className="w-4 h-4 text-teal-600" />
          {isBn ? 'অ্যাপের ভাষা / Language' : 'App Language & Profile'}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`py-3 rounded-2xl border text-xs font-bold transition cursor-pointer ${
              language === 'en'
                ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
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
                ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            বাংলা (Bengali)
          </button>
        </div>

        <div className="pt-2">
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-teal-600" />
            {isBn ? 'ব্যবহারকারীর নাম / প্রোফাইল' : 'Patient Name / Profile'}
          </label>
          <input
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder={isBn ? 'যেমন: রহিমা খাতুন' : 'e.g., Jane Doe'}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
          />
        </div>
      </div>

      {/* 2. ALERT MODE SELECTION */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-teal-600" />
          {isBn ? 'সতর্কবার্তা মোড নির্বাচন (Alert Mode)' : 'Alert Mode Selection'}
        </h3>
        <p className="text-xs text-slate-500">
          {isBn
            ? 'ওষুধের সময় হলে মেডিটাইম কিভাবে আপনাকে ডাকবে তা নির্ধারণ করুন।'
            : 'Select how you want to be alerted when a medication reminder becomes due.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {[
            { id: 'alarm_sound', titleEn: 'Alarm Sound', titleBn: 'অ্যালার্ম সাউন্ড', descEn: 'Continuous ringing tone', descBn: 'ক্রমাগত অ্যালার্ম সুর বাজবে' },
            { id: 'voice_reminder', titleEn: 'Voice Reminder', titleBn: 'ভয়েস রিমাইন্ডার', descEn: 'Spoken speech announcement', descBn: 'মুখে বলে স্মরণ করাবে' },
            { id: 'alarm_and_voice', titleEn: 'Alarm + Voice', titleBn: 'অ্যালার্ম + ভয়েস', descEn: 'Both ringing tone & voice', descBn: 'সুর ও ভয়েস একত্রে বাজবে' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setAlertMode(mode.id as AlertMode)}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                alertMode === mode.id
                  ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-500'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="block text-xs font-black">{isBn ? mode.titleBn : mode.titleEn}</span>
              <span className="block text-[10px] text-slate-500 mt-0.5">{isBn ? mode.descBn : mode.descEn}</span>
            </button>
          ))}
        </div>

        {/* Mandatory notification guarantee note */}
        <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-2xl flex items-start gap-2 text-xs text-teal-900">
          <Shield className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
          <span>
            {isBn
              ? 'নিশ্চয়তা: সাউন্ড মোড যাই নির্বাচন করুন না কেন, আপনার ফোনের সিস্টেম নোটিফিকেশন স্বাধীনভাবে সর্বদা সক্রিয় থাকবে।'
              : 'Reliability Guarantee: Medicine notifications always trigger as an independent alert channel regardless of whether Sound, Voice, or Both is selected.'}
          </span>
        </div>
      </div>

      {/* 3. ALARM SOUND LIBRARY (8 Built-in Tones with Preview) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Music className="w-4 h-4 text-teal-600" />
            {isBn ? 'বিল্ট-ইন অ্যালার্ম সাউন্ড লাইব্রেরি' : 'Alarm Sound Library (8 Built-In Tones)'}
          </h3>
          {currentlyPreviewingTone && (
            <button
              onClick={handleStopPreview}
              className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-xl transition flex items-center gap-1 cursor-pointer"
            >
              <Square className="w-3 h-3" />
              <span>{isBn ? 'প্রিভিউ বন্ধ' : 'Stop Preview'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BUILT_IN_TONES.map((tone) => {
            const isSelected = alarmTone === tone.id;
            const isPreviewing = currentlyPreviewingTone === tone.id;

            return (
              <div
                key={tone.id}
                className={`p-3 rounded-2xl border flex items-center justify-between transition ${
                  isSelected
                    ? 'bg-teal-50 border-teal-600 text-teal-950'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div
                  onClick={() => setAlarmTone(tone.id)}
                  className="flex-1 cursor-pointer"
                >
                  <span className="block text-xs font-bold">{isBn ? tone.nameBn : tone.nameEn}</span>
                  <span className="block text-[10px] text-slate-400 font-semibold">{tone.category}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePlayPreview(tone.id)}
                    className={`p-2 rounded-xl transition cursor-pointer ${
                      isPreviewing
                        ? 'bg-teal-700 text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                    title={isPreviewing ? 'Stop Preview' : 'Preview Tone'}
                  >
                    {isPreviewing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAlarmTone(tone.id)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {isSelected ? '✓' : (isBn ? 'নির্বাচন' : 'Select')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Volume slider */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
            <span>{isBn ? 'অ্যালার্ম ভলিউম' : 'Alarm Volume'}</span>
            <span className="text-teal-700 font-black">{Math.round(soundVolume * 100)}%</span>
          </label>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={soundVolume}
            onChange={(e) => setSoundVolume(Number(e.target.value))}
            className="w-full accent-teal-600 cursor-pointer"
          />
        </div>
      </div>

      {/* 4. CUSTOM SOUND FROM PHONE & PLAYLIST */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Music className="w-4 h-4 text-teal-600" />
          {isBn ? 'ফোন হতে নিজস্ব রিংটোন নির্বাচন' : 'Custom Sound From Phone'}
        </h3>
        <p className="text-xs text-slate-500">
          {isBn
            ? 'আপনার ফোনের নিজস্ব অডিও ফাইল (MP3, WAV, OGG, M4A) নির্বাচন করুন। ফাইলটি লোকাল ডেটাবেজে সংরক্ষিত থাকবে।'
            : 'Select an audio file from your phone storage. The file is safely stored in local IndexedDB.'}
        </p>

        {/* Upload Button */}
        <div>
          <label className="py-2.5 px-4 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-2xl text-xs font-bold text-teal-800 transition flex items-center justify-center gap-2 cursor-pointer w-fit">
            <Plus className="w-4 h-4 text-teal-600" />
            <span>{isBn ? 'ফোন হতে অডিও ফাইল যোগ করুন' : 'Choose Sound From My Phone'}</span>
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
              onChange={handleUploadCustomSound}
              className="hidden"
            />
          </label>
        </div>

        {/* Custom Track Playlist List */}
        {customTracks.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-slate-700 block">
              {isBn ? 'সংরক্ষিত কাস্টম প্লেলিস্ট:' : 'Your Custom Audio Playlist:'}
            </span>
            {customTracks.map((track) => {
              const isSelected = alarmTone === `custom:${track.id}`;
              const isPreviewing = currentlyPreviewingTone === track.id;

              return (
                <div
                  key={track.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition ${
                    isSelected ? 'bg-teal-50 border-teal-600 text-teal-900' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div
                    onClick={() => setAlarmTone(`custom:${track.id}`)}
                    className="flex-1 min-w-0 cursor-pointer pr-2"
                  >
                    <span className="block text-xs font-bold truncate">{track.name}</span>
                    <span className="block text-[10px] text-slate-400">
                      {Math.round(track.size / 1024)} KB • {track.mimeType}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePlayPreview(track.id, track.blob)}
                      className={`p-2 rounded-xl transition cursor-pointer ${
                        isPreviewing ? 'bg-teal-700 text-white' : 'bg-white border text-slate-700 hover:bg-slate-200'
                      }`}
                      title={isPreviewing ? 'Stop Preview' : 'Preview'}
                    >
                      {isPreviewing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setAlarmTone(`custom:${track.id}`)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isSelected ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {isSelected ? '✓' : (isBn ? 'নির্বাচন' : 'Select')}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCustomTrack(track.id)}
                      className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. VOICE PREFERENCES */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Mic className="w-4 h-4 text-teal-600" />
            {isBn ? 'কণ্ঠস্বর রিমাইন্ডার পছন্দ (Voice Settings)' : 'Voice Reminder Preferences'}
          </h3>
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`w-12 h-7 flex items-center rounded-full p-1 transition cursor-pointer ${
              voiceEnabled ? 'bg-teal-600 justify-end' : 'bg-slate-300 justify-start'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
          </button>
        </div>

        {voiceEnabled && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'কণ্ঠস্বরের ভাষা' : 'Language'}
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
                  className="w-full accent-teal-600 mt-2 cursor-pointer"
                />
              </div>
            </div>

            {/* Voice dropdown from SpeechSynthesis */}
            {availableVoices.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'ডিভাইসের স্পিচ ভয়েস' : 'Device Speech Voice'}
                </label>
                <select
                  value={voiceURI}
                  onChange={(e) => setVoiceURI(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-medium truncate"
                >
                  <option value="">{isBn ? 'সিস্টেম স্বয়ংক্রিয় ভয়েস' : 'System Default Voice'}</option>
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleTestVoice}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5 text-teal-600" />
              <span>{isBn ? 'ভয়েস টেস্ট শুনুন' : 'Test Spoken Announcement'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 6. SNOOZE & NOTIFICATION PREFERENCES */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-600" />
          {isBn ? 'স্নুজ ও নোটিফিকেশন প্রাইভেসি' : 'Snooze & Notification Privacy'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? 'ডিফল্ট স্নুজ সময়' : 'Default Snooze Duration'}
            </label>
            <select
              value={snoozeDuration}
              onChange={(e) => setSnoozeDuration(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-medium"
            >
              <option value={5}>5 {isBn ? 'মিনিট' : 'Minutes'}</option>
              <option value={10}>10 {isBn ? 'মিনিট' : 'Minutes'}</option>
              <option value={15}>15 {isBn ? 'মিনিট' : 'Minutes'}</option>
              <option value={30}>30 {isBn ? 'মিনিট' : 'Minutes'}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? 'নোটিফিকেশন প্রাইভেসি' : 'Notification Privacy'}
            </label>
            <select
              value={notificationPrivacy}
              onChange={(e) => setNotificationPrivacy(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-medium"
            >
              <option value="full">{isBn ? 'সম্পূর্ণ (ওষুধের নাম ও মাত্রা)' : 'Full (Medicine name & dosage)'}</option>
              <option value="discrete">{isBn ? 'গোপনীয় (সাধারণ রিমাইন্ডার)' : 'Discrete (Generic medicine reminder)'}</option>
            </select>
          </div>
        </div>

        {/* Quick Test Action Buttons */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleTestNotification}
            className="py-2 px-3 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-teal-600" />
            <span>{isBn ? 'টেস্ট নোটিফিকেশন পাঠান' : 'Send Test Notification'}</span>
          </button>

          {onTriggerTestAlarm && (
            <button
              type="button"
              onClick={onTriggerTestAlarm}
              className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-600" />
              <span>{isBn ? 'টেস্ট অ্যালার্ম স্ক্রিন দেখুন' : 'Trigger Test Alarm Screen'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 7. MEAL TIMES CONFIGURATION */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-600" />
          {isBn ? 'স্বাভাবিক খাবারের সময়সূচী' : 'Base Meal Times Schedule'}
        </h3>
        <p className="text-xs text-slate-500">
          {isBn
            ? 'খাবারের আগের বা পরের ওষুধগুলো প্রাথমিকভাবে এই সময়ের ভিত্তিতে হিসাব করা হয়।'
            : 'Base timeline used for meal-linked medicines before live dynamic meal completion.'}
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

      {/* 8. SAVE & RESET BUTTONS */}
      <div className="flex gap-2">
        <button
          onClick={handleResetToDefault}
          className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition flex items-center gap-1 cursor-pointer"
          title="Reset preferences to default"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline">{isBn ? 'রিসেট' : 'Reset'}</span>
        </button>

        <button
          onClick={handleSaveSettings}
          className="flex-1 py-3.5 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-black text-sm rounded-2xl shadow-lg shadow-teal-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-5 h-5" />
          <span>
            {savedSuccess
              ? isBn ? 'পছন্দসমূহ সংরক্ষিত হয়েছে ✓' : 'Settings Saved Successfully! ✓'
              : isBn ? 'সকল পছন্দ সংরক্ষণ করুন' : 'Save All Preferences'}
          </span>
        </button>
      </div>

      {/* 9. DATA MANAGEMENT & SEED DEMO */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Database className="w-4 h-4 text-teal-600" />
          {isBn ? 'ডাটা ব্যাকআপ ও পরিচালনা' : 'Data Management & Local Backup'}
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleLoadDemo}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-teal-800 hover:bg-teal-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>{isBn ? 'ডেমো ডাটা লোড' : 'Load Demo Prescriptions'}</span>
          </button>

          <button
            onClick={handleExportData}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>{isBn ? 'ব্যাকআপ ডাউনলোড' : 'Export JSON Backup'}</span>
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
            <span>{isBn ? 'ডাটা মুছুন' : 'Erase All'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

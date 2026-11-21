import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  Square, 
  Utensils, 
  Pill,
  Timer
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { AlarmInstance, Medicine, UserSettings } from '../types';
import { formatFriendlyTime } from '../services/scheduler';
import { playSuccessChime, stopAlarmAudio } from '../services/sound';
import { voiceService } from '../services/voice';
import { alarmEngine, type ActiveAlarmSession } from '../services/alarmEngine';

interface AlarmModalProps {
  alarm: AlarmInstance;
  medicine: Medicine;
  settings: UserSettings;
  onClose: () => void;
}

export const AlarmModal: React.FC<AlarmModalProps> = ({
  alarm,
  medicine,
  settings,
  onClose,
}) => {
  const isBn = settings.language === 'bn';
  const [snoozeMinutes, setSnoozeMinutes] = useState(settings.snoozeDurationMinutes || 10);
  const [isMuted, setIsMuted] = useState(false);
  const [ringingDuration, setRingingDuration] = useState(0);

  useEffect(() => {
    // Start alarm in alarmEngine
    alarmEngine.startAlarm(alarm, medicine, settings);

    const unsubscribe = alarmEngine.subscribe((session: ActiveAlarmSession | null) => {
      if (session) {
        setRingingDuration(session.ringingSeconds);
      }
    });

    return () => {
      unsubscribe();
      // If modal unmounts unexpectedly, ensure audio stops
      alarmEngine.dismiss();
    };
  }, [alarm.id]);

  const toggleMute = () => {
    if (isMuted) {
      // Unmute: restart audio
      setIsMuted(false);
      alarmEngine.startAlarm(alarm, medicine, settings);
    } else {
      // Mute: stop audio but keep modal visible
      setIsMuted(true);
      stopAlarmAudio();
      voiceService.stop();
    }
  };

  const handleTaken = async () => {
    // Celebration confetti
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#0D9488', '#0284C7', '#16A34A', '#F59E0B'],
      });
    } catch {}

    playSuccessChime();

    if (settings.voiceEnabled) {
      voiceService.speak({
        language: settings.voiceLang || settings.language,
        type: 'completed',
      });
    }

    await alarmEngine.handleTaken();
    onClose();
  };

  const handleSnooze = async () => {
    await alarmEngine.handleSnooze(snoozeMinutes);
    onClose();
  };

  const handleStopAlarm = async () => {
    // STOP ALARM: Dismisses active alarm UI, stops sound, strictly preserves dose as PENDING!
    await alarmEngine.handleStopAlarm();
    onClose();
  };

  const handleSkip = async () => {
    await alarmEngine.handleSkip();
    onClose();
  };

  // Format ringing seconds into mm:ss
  const formatRingingTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSec).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-teal-500/40 flex flex-col max-h-[95vh]">
        {/* Pulsing Alarm Header */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 p-6 text-white text-center relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              {isBn ? 'সক্রিয় অ্যালার্ম বাজছে' : 'Active Alarm Ringing'}
            </span>

            {/* Mute / Unmute Button */}
            <button
              onClick={toggleMute}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition text-white cursor-pointer"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-amber-300" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>

          {/* Central Pulsing Bell */}
          <div className="my-2 flex justify-center">
            <div className="w-20 h-20 rounded-full bg-teal-500/30 flex items-center justify-center ring-8 ring-teal-400/20 animate-pulse">
              <Bell className="w-10 h-10 text-white animate-bounce" />
            </div>
          </div>

          <h2 className="text-2xl font-black tracking-tight">
            {isBn ? 'ওষুধ খাওয়ার সময় হয়েছে!' : 'MEDICINE TIME!'}
          </h2>

          <div className="flex items-center justify-center gap-3 text-xs text-teal-100 mt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-teal-300" />
              {formatFriendlyTime(alarm.scheduledTime)}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-teal-200 font-mono font-bold">
              <Timer className="w-3.5 h-3.5" />
              {isBn ? 'বাজছে: ' : 'Ringing: '}{formatRingingTime(ringingDuration)}
            </span>
          </div>

          {ringingDuration >= 240 && (
            <p className="text-[10px] text-amber-200 bg-amber-900/40 px-2 py-0.5 rounded-full inline-block mt-1">
              {isBn ? '৪ মিনিট পেরিয়ে গেছে — ওষুধ গ্রহণ নিশ্চিত করুন' : '4+ min cycle: please take or snooze your medicine'}
            </p>
          )}
        </div>

        {/* Medicine Information Details */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-teal-900 font-bold text-xs uppercase tracking-wider">
              <Pill className="w-4 h-4 text-teal-700" />
              <span>{medicine.category.toUpperCase()}</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900">{medicine.name}</h3>
            <p className="text-teal-800 font-extrabold text-lg">{medicine.dosage}</p>
            {medicine.instructions && (
              <p className="text-slate-600 text-xs mt-2 bg-white/90 p-2.5 rounded-xl border border-teal-100 text-left">
                ⚠️ <strong>{isBn ? 'নির্দেশনা:' : 'Instruction:'}</strong> {medicine.instructions}
              </p>
            )}
          </div>

          {/* Meal context info */}
          {alarm.triggerType === 'meal_actual' && (
            <div className="flex items-center gap-2 text-xs text-teal-800 bg-teal-100/70 p-2.5 rounded-xl border border-teal-200">
              <Utensils className="w-4 h-4 text-teal-700 shrink-0" />
              <span className="font-semibold">
                {isBn
                  ? 'আপনার খাবার সমাপ্তির সাথে সমন্বয় করে হিসাব করা হয়েছে।'
                  : 'Dynamically recalculated from your confirmed meal completion!'}
              </span>
            </div>
          )}

          {/* Action Buttons: TAKEN, SNOOZE, STOP ALARM, SKIP */}
          <div className="space-y-2.5 pt-1">
            {/* 1. LARGE PRIMARY [ TAKEN ] BUTTON */}
            <button
              onClick={handleTaken}
              className="w-full py-4 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-black text-lg rounded-2xl shadow-lg shadow-teal-700/30 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-6 h-6" />
              <span>{isBn ? 'খেয়েছি (TAKEN)' : 'TAKEN'}</span>
            </button>

            {/* 2. [ SNOOZE ] ROW */}
            <div className="flex gap-2">
              <select
                value={snoozeMinutes}
                onChange={(e) => setSnoozeMinutes(Number(e.target.value))}
                aria-label={isBn ? 'স্নুজের সময়সীমা' : 'Snooze duration'}
                className="bg-slate-100 border border-slate-200 rounded-xl px-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value={5}>5 {isBn ? 'মিনিট' : 'mins'}</option>
                <option value={10}>10 {isBn ? 'মিনিট' : 'mins'}</option>
                <option value={15}>15 {isBn ? 'মিনিট' : 'mins'}</option>
                <option value={30}>30 {isBn ? 'মিনিট' : 'mins'}</option>
              </select>

              <button
                onClick={handleSnooze}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-sm rounded-xl shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                <span>{isBn ? 'পরে খাব (SNOOZE)' : 'SNOOZE'}</span>
              </button>
            </div>

            {/* 3. [ STOP ALARM ] BUTTON (Stops audio, keeps dose pending!) */}
            <button
              onClick={handleStopAlarm}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center justify-center gap-1.5 cursor-pointer"
              title={isBn ? 'অ্যালার্ম বন্ধ কিন্তু ওষুধ অমীমাংসিত থাকবে' : 'Stop ringing, keep dose pending'}
            >
              <Square className="w-3.5 h-3.5 text-slate-600" />
              <span>{isBn ? 'অ্যালার্ম বন্ধ করুন (STOP ALARM)' : 'STOP ALARM (KEEP PENDING)'}</span>
            </button>

            {/* 4. [ SKIP ] BUTTON */}
            <button
              onClick={handleSkip}
              className="w-full py-2 bg-transparent hover:bg-red-50 text-slate-500 hover:text-red-700 font-medium text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
              <span>{isBn ? 'এবার খাব না (SKIP)' : 'SKIP THIS DOSE'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

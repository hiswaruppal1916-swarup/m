import React, { useEffect, useState, useRef } from 'react';
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
  Timer,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { AlarmInstance, Medicine, UserSettings } from '../types';
import { formatFriendlyTime } from '../services/scheduler';
import { playSuccessChime, stopAlarmAudio } from '../services/sound';
import { voiceService } from '../services/voice';
import { alarmEngine } from '../services/alarmEngine';

interface AlarmModalProps {
  alarm: AlarmInstance;
  medicine: Medicine;
  settings: UserSettings;
  onClose: () => void;
}

/**
 * Isolated timer component that tracks elapsed ringing seconds independently.
 * CRITICAL FIX: Preventing AlarmModal from re-rendering every 1000ms ensures
 * that mobile touch and pointer events on action buttons are never cancelled
 * or swallowed mid-gesture, completely eliminating the two-tap bug!
 */
const RingingTimerDisplay: React.FC<{ startedAt: number; isBn: boolean }> = ({ startedAt, isBn }) => {
  const [seconds, setSeconds] = useState(() => Math.floor((Date.now() - startedAt) / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const mins = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(remainingSec).padStart(2, '0')}`;

  return (
    <>
      <span className="flex items-center gap-1 text-teal-200 font-mono font-bold">
        <Timer className="w-3.5 h-3.5" />
        {isBn ? 'বাজছে: ' : 'Ringing: '}{timeFormatted}
      </span>
      {seconds >= 240 && (
        <p className="text-[10px] text-amber-200 bg-amber-900/40 px-2 py-0.5 rounded-full inline-block mt-1">
          {isBn ? '৪ মিনিট পেরিয়ে গেছে — ওষুধ গ্রহণ নিশ্চিত করুন' : '4+ min cycle: please take or snooze your medicine'}
        </p>
      )}
    </>
  );
};

export const AlarmModal: React.FC<AlarmModalProps> = ({
  alarm,
  medicine,
  settings,
  onClose,
}) => {
  const isBn = settings.language === 'bn';
  const [snoozeMinutes, setSnoozeMinutes] = useState(settings.snoozeDurationMinutes || 10);
  const [isMuted, setIsMuted] = useState(false);
  const [startedAt] = useState(() => Date.now());

  // Immediate Single-Tap Lock & Processing State
  const [executingAction, setExecutingAction] = useState<'taken' | 'snooze' | 'stop' | 'skip' | null>(null);
  const isActionLockedRef = useRef(false);

  useEffect(() => {
    // Start continuous looping alarm
    alarmEngine.startAlarm(alarm, medicine, settings);

    return () => {
      alarmEngine.dismiss();
    };
  }, [alarm.id]);

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      alarmEngine.startAlarm(alarm, medicine, settings);
    } else {
      setIsMuted(true);
      stopAlarmAudio();
      voiceService.stop();
    }
  };

  /**
   * Action A: TAKEN (Single Tap Guaranteed)
   */
  const handleTaken = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isActionLockedRef.current) return;
    isActionLockedRef.current = true;
    setExecutingAction('taken');

    // 1. Immediately synchronously halt all audio & speech
    stopAlarmAudio();
    voiceService.stop();

    // 2. Play celebratory sound & haptics
    playSuccessChime();
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#0D9488', '#0284C7', '#16A34A', '#F59E0B'],
      });
    } catch {}

    if (settings.voiceEnabled) {
      voiceService.speak({
        language: settings.voiceLang || settings.language,
        type: 'completed',
      });
    }

    // 3. Immediately dismiss modal so user never waits for database latency
    onClose();

    // 4. Record dose in IndexedDB asynchronously
    try {
      await alarmEngine.handleTaken();
    } catch (err) {
      console.error('Error saving taken dose:', err);
    }
  };

  /**
   * Action B: SNOOZE (Single Tap Guaranteed)
   */
  const handleSnooze = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isActionLockedRef.current) return;
    isActionLockedRef.current = true;
    setExecutingAction('snooze');

    stopAlarmAudio();
    voiceService.stop();
    onClose();

    try {
      await alarmEngine.handleSnooze(snoozeMinutes);
    } catch (err) {
      console.error('Error saving snooze:', err);
    }
  };

  /**
   * Action C: STOP ALARM (Single Tap Guaranteed - Keeps dose pending!)
   */
  const handleStopAlarm = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isActionLockedRef.current) return;
    isActionLockedRef.current = true;
    setExecutingAction('stop');

    stopAlarmAudio();
    voiceService.stop();
    onClose();

    try {
      await alarmEngine.handleStopAlarm();
    } catch (err) {
      console.error('Error stopping alarm:', err);
    }
  };

  /**
   * Action D: SKIP (Single Tap Guaranteed)
   */
  const handleSkip = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isActionLockedRef.current) return;
    isActionLockedRef.current = true;
    setExecutingAction('skip');

    stopAlarmAudio();
    voiceService.stop();
    onClose();

    try {
      await alarmEngine.handleSkip();
    } catch (err) {
      console.error('Error recording skipped dose:', err);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 pointer-events-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-teal-500/40 flex flex-col max-h-[95vh] relative z-50 pointer-events-auto">
        {/* Pulsing Alarm Header */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 p-6 text-white text-center relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              {isBn ? 'সক্রিয় অ্যালার্ম বাজছে' : 'Active Alarm Ringing'}
            </span>

            {/* Mute / Unmute Button */}
            <button
              type="button"
              onClick={toggleMute}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 transition text-white cursor-pointer touch-manipulation"
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

          <div className="flex items-center justify-center gap-3 text-xs text-teal-100 mt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-teal-300" />
              {formatFriendlyTime(alarm.scheduledTime)}
            </span>
            <span>•</span>
            <RingingTimerDisplay startedAt={startedAt} isBn={isBn} />
          </div>
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

          {/* Action Buttons: TAKEN, SNOOZE, STOP ALARM, SKIP (Single Tap Responsive) */}
          <div className="space-y-2.5 pt-1">
            {/* 1. LARGE PRIMARY [ TAKEN ] BUTTON */}
            <button
              type="button"
              disabled={isActionLockedRef.current}
              onClick={handleTaken}
              className={`w-full py-4 text-white font-black text-lg rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation select-none active:scale-95 ${
                executingAction === 'taken'
                  ? 'bg-emerald-600 opacity-90'
                  : 'bg-teal-600 hover:bg-teal-700 shadow-teal-700/30'
              }`}
            >
              {executingAction === 'taken' ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>{isBn ? 'গৃহীত হিসেবে সংরক্ষণ হচ্ছে...' : 'Recording Taken...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  <span>{isBn ? 'খেয়েছি (TAKEN)' : 'TAKEN'}</span>
                </>
              )}
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
                type="button"
                disabled={isActionLockedRef.current}
                onClick={handleSnooze}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-sm rounded-xl shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation select-none"
              >
                {executingAction === 'snooze' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
                <span>{isBn ? 'পরে খাব (SNOOZE)' : 'SNOOZE'}</span>
              </button>
            </div>

            {/* 3. [ STOP ALARM ] BUTTON (Stops audio, keeps dose pending!) */}
            <button
              type="button"
              disabled={isActionLockedRef.current}
              onClick={handleStopAlarm}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none"
              title={isBn ? 'অ্যালার্ম বন্ধ কিন্তু ওষুধ অমীমাংসিত থাকবে' : 'Stop ringing, keep dose pending'}
            >
              {executingAction === 'stop' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>{isBn ? 'অ্যালার্ম বন্ধ করুন (STOP ALARM)' : 'STOP ALARM (KEEP PENDING)'}</span>
            </button>

            {/* 4. [ SKIP ] BUTTON */}
            <button
              type="button"
              disabled={isActionLockedRef.current}
              onClick={handleSkip}
              className="w-full py-2 bg-transparent hover:bg-red-50 active:scale-95 text-slate-500 hover:text-red-700 font-medium text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer touch-manipulation select-none"
            >
              {executingAction === 'skip' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{isBn ? 'এবার খাব না (SKIP)' : 'SKIP THIS DOSE'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

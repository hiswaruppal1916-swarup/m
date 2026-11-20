import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2, Clock, AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { AlarmInstance, Medicine } from '../types';
import { formatFriendlyTime, recordDoseAction } from '../services/scheduler';
import { playAlarmSound, playSuccessChime } from '../services/sound';
import { voiceService } from '../services/voice';

interface AlarmModalProps {
  alarm: AlarmInstance;
  medicine: Medicine;
  language: 'en' | 'bn';
  voiceEnabled: boolean;
  soundVolume: number;
  alarmSound: 'gentle_chime' | 'medical_beep' | 'zen_bell';
  onClose: () => void;
}

export const AlarmModal: React.FC<AlarmModalProps> = ({
  alarm,
  medicine,
  language,
  voiceEnabled,
  soundVolume,
  alarmSound,
  onClose,
}) => {
  const [snoozeMinutes, setSnoozeMinutes] = useState(10);
  const [isMuted, setIsMuted] = useState(false);
  const soundIntervalRef = useRef<any>(null);

  useEffect(() => {
    // Initial chime
    playAlarmSound(alarmSound, soundVolume);

    // Initial voice readout
    if (voiceEnabled) {
      voiceService.speak({
        medicineName: medicine.name,
        dosage: medicine.dosage,
        language: language,
        type: 'due',
      });
    }

    // Repeat chime every 6 seconds until dismissed or muted
    soundIntervalRef.current = setInterval(() => {
      if (!isMuted) {
        playAlarmSound(alarmSound, soundVolume);
      }
    }, 6000);

    return () => {
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
      voiceService.stop();
    };
  }, [alarmSound, soundVolume, voiceEnabled, language, medicine, isMuted]);

  const handleTaken = async () => {
    if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    voiceService.stop();

    // Celebration confetti!
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0D9488', '#0284C7', '#16A34A', '#F59E0B'],
    });

    playSuccessChime();

    if (voiceEnabled) {
      voiceService.speak({
        language,
        type: 'completed',
      });
    }

    await recordDoseAction(alarm.id, 'taken');
    onClose();
  };

  const handleSnooze = async () => {
    if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    voiceService.stop();
    await recordDoseAction(alarm.id, 'snooze', snoozeMinutes);
    onClose();
  };

  const handleSkip = async () => {
    if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    voiceService.stop();
    await recordDoseAction(alarm.id, 'skip', 0, 'User skipped dose via alarm interface');
    onClose();
  };

  const isBn = language === 'bn';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-teal-500/30 flex flex-col">
        {/* Pulsing Alarm Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-800 p-6 text-white text-center relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
              {isBn ? 'জরুরী রিমাইন্ডার' : 'Medication Alert'}
            </span>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition text-white"
              title={isMuted ? 'Unmute' : 'Mute Sound'}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-amber-300" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>

          <div className="my-3 flex justify-center">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center animate-ring-pulse">
              <Bell className="w-10 h-10 text-white animate-bounce" />
            </div>
          </div>

          <h2 className="text-2xl font-black tracking-tight">
            {isBn ? 'ওষুধ খাওয়ার সময় হয়েছে!' : 'MEDICINE TIME!'}
          </h2>
          <p className="text-teal-100 text-sm mt-1">
            {isBn ? 'নির্ধারিত সময়: ' : 'Scheduled: '} {formatFriendlyTime(alarm.scheduledTime)}
          </p>
        </div>

        {/* Medicine Information Details */}
        <div className="p-6 space-y-4">
          <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 text-center">
            <h3 className="text-2xl font-bold text-slate-800">{medicine.name}</h3>
            <p className="text-teal-700 font-semibold text-lg mt-1">{medicine.dosage}</p>
            {medicine.instructions && (
              <p className="text-slate-600 text-sm mt-2 bg-white/80 p-2 rounded-lg border border-teal-100/50">
                ⚠️ {medicine.instructions}
              </p>
            )}
          </div>

          {/* Meal Context Badge */}
          {alarm.triggerType === 'meal_actual' && (
            <div className="flex items-center gap-2 text-xs text-teal-800 bg-teal-100/60 p-2.5 rounded-xl border border-teal-200">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <span>
                {isBn
                  ? 'আপনার খাবার সমাপ্তির সময়ের সাথে সমন্বয় করে হিসাব করা হয়েছে।'
                  : 'Time dynamically recalculated from your confirmed meal completion!'}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            {/* BIG TAKEN BUTTON */}
            <button
              onClick={handleTaken}
              className="w-full py-4 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-black text-xl rounded-2xl shadow-lg shadow-teal-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-6 h-6" />
              {isBn ? 'খেয়েছি (TAKEN)' : 'TAKEN'}
            </button>

            {/* SNOOZE SECTION */}
            <div className="flex gap-2">
              <select
                value={snoozeMinutes}
                onChange={(e) => setSnoozeMinutes(Number(e.target.value))}
                aria-label={isBn ? 'স্নুজের সময়সীমা' : 'Snooze duration'}
                className="bg-slate-100 border border-slate-200 rounded-xl px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value={5}>5 {isBn ? 'মিনিট' : 'mins'}</option>
                <option value={10}>10 {isBn ? 'মিনিট' : 'mins'}</option>
                <option value={15}>15 {isBn ? 'মিনিট' : 'mins'}</option>
                <option value={30}>30 {isBn ? 'মিনিট' : 'mins'}</option>
              </select>

              <button
                onClick={handleSnooze}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold rounded-xl shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Clock className="w-5 h-5" />
                {isBn ? 'পরে খাব (SNOOZE)' : 'SNOOZE'}
              </button>
            </div>

            {/* SKIP BUTTON */}
            <button
              onClick={handleSkip}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-sm rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-slate-400" />
              {isBn ? 'এবার খাব না (SKIP)' : 'SKIP THIS DOSE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Bell, 
  ArrowRight, 
  Check, 
  Pill 
} from 'lucide-react';
import { db } from '../db';
import type { UserSettings, Meal } from '../types';
import { requestNotificationPermission } from '../services/notifications';
import { playSuccessChime } from '../services/sound';

interface OnboardingModalProps {
  settings: UserSettings;
  meals: Meal[];
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  settings,
  meals,
  onComplete,
}) => {
  const isBn = settings.language === 'bn';
  const [step, setStep] = useState(1);
  const [mealTimes, setMealTimes] = useState<Record<string, string>>(
    meals.reduce((acc, m) => ({ ...acc, [m.id]: m.plannedTime }), {})
  );

  const handleNext = async () => {
    if (step === 2) {
      // Save meal times
      for (const meal of meals) {
        if (mealTimes[meal.id]) {
          await db.meals.update(meal.id, { plannedTime: mealTimes[meal.id] });
        }
      }
    }

    if (step === 3) {
      // Request permission
      await requestNotificationPermission();
      await db.settings.update(settings.id, { onboardingCompleted: true });
      playSuccessChime();
      onComplete();
      return;
    }

    setStep(step + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-teal-100 flex flex-col">
        {/* Step Indicator */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-800 p-6 text-white text-center">
          <div className="flex justify-center gap-2 mb-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? 'w-8 bg-white' : 'w-2 bg-white/30'
                }`}
              />
            ))}
          </div>

          <h3 className="text-xl font-black">
            {step === 1 && (isBn ? 'মেডিটাইমে স্বাগতম!' : 'Welcome to MediTime!')}
            {step === 2 && (isBn ? 'খাবারের সময়সূচী নির্ধারণ' : 'Set Your Meal Schedule')}
            {step === 3 && (isBn ? 'রিমাইন্ডার ও পারমিশন' : 'Notifications & Alerts')}
          </h3>
          <p className="text-xs text-teal-100 mt-1">
            {step === 1 && (isBn ? 'কখনোই ওষুধ ভুলবেন না।' : 'Never Miss Your Medicine.')}
            {step === 2 && (isBn ? 'আপনার সাধারণ খাবারের সময় নির্বাচন করুন' : 'Your base daily meal routine')}
            {step === 3 && (isBn ? 'সঠিক সময়ে সতর্কবার্তা পেতে প্রস্তুত হন' : 'Get alerted when doses are due')}
          </p>
        </div>

        {/* Step Body */}
        <div className="p-6 space-y-4">
          {step === 1 && (
            <div className="space-y-3 text-center">
              <div className="w-16 h-16 rounded-3xl bg-teal-50 border-2 border-teal-500/20 mx-auto flex items-center justify-center">
                <Pill className="w-8 h-8 text-teal-600" />
              </div>
              <h4 className="font-bold text-slate-800 text-base">
                {isBn ? 'স্মার্ট ও খাবার-সচেতন শিডিউলিং' : 'Smart Meal-Aware Scheduling'}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isBn
                  ? 'সব ওষুধ ঘড়ির নির্দিষ্ট সময়ে খাওয়া যায় না। অনেক ওষুধ খাবারের আগে, খাবারের পরে বা খালি পেটে খেতে হয়। মেডিটাইমের হাইব্রিড ইঞ্জিন স্বয়ংক্রিয়ভাবে সঠিক সময়ে ওষুধ মনে করিয়ে দেয়।'
                  : 'Prescriptions often say "15 mins after lunch" or "30 mins before breakfast". MediTime safely tracks both clock-based and meal-dependent medicines!'}
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                {isBn
                  ? 'আপনার দৈনন্দিন খাবারের আনুমানিক সময় নির্ধারণ করুন (পরে যেকোনো সময় পরিবর্তন করা যাবে):'
                  : 'Configure your typical meal hours (can be adjusted anytime):'}
              </p>

              <div className="space-y-2.5">
                {meals.slice(0, 3).map((meal) => {
                  const title = isBn
                    ? meal.mealType === 'breakfast' ? 'সকালের নাস্তা' :
                      meal.mealType === 'lunch' ? 'দুপুরের খাবার' : 'রাতের খাবার'
                    : meal.mealType.toUpperCase();

                  return (
                    <div key={meal.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-xs font-bold text-slate-800">{title}</span>
                      <input
                        type="time"
                        value={mealTimes[meal.id] || meal.plannedTime}
                        onChange={(e) => setMealTimes({ ...mealTimes, [meal.id]: e.target.value })}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-teal-800"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-center">
              <div className="w-16 h-16 rounded-3xl bg-sky-50 border-2 border-sky-500/20 mx-auto flex items-center justify-center">
                <Bell className="w-8 h-8 text-sky-600 animate-bounce" />
              </div>
              <h4 className="font-bold text-slate-800 text-base">
                {isBn ? 'নোটিফিকেশন সক্রিয় করুন' : 'Enable Notification Alerts'}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isBn
                  ? 'ওষুধ খাওয়ার সময় ব্রাউজারে নোটিফিকেশন পেতে অনুমতি দিন। এটি আপনার কোনো ব্যক্তিগত তথ্য বাইরে পাঠাবে না।'
                  : 'Grant browser notification permission so MediTime can alert you at the prescribed intervals.'}
              </p>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleNext}
            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-black text-sm rounded-2xl shadow-lg shadow-teal-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {step < 3 ? (
              <>
                <span>{isBn ? 'পরবর্তী' : 'Continue'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{isBn ? 'শুরু করুন' : 'Get Started'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

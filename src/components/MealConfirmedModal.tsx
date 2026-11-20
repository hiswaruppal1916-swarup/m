import React from 'react';
import { CheckCircle2, Clock, Utensils } from 'lucide-react';

interface MealConfirmedModalProps {
  mealName: string;
  completionTime: string;
  updatedMedicines: {
    name: string;
    dosage: string;
    oldTime?: string;
    newTime: string;
  }[];
  language: 'en' | 'bn';
  onClose: () => void;
}

export const MealConfirmedModal: React.FC<MealConfirmedModalProps> = ({
  mealName,
  completionTime,
  updatedMedicines,
  language,
  onClose,
}) => {
  const isBn = language === 'bn';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-teal-100 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white text-center">
          <div className="w-14 h-14 rounded-full bg-white/20 mx-auto flex items-center justify-center mb-2">
            <Utensils className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-xl font-bold">
            {isBn ? `${mealName} সম্পন্ন হয়েছে!` : `${mealName} Confirmed!`}
          </h3>
          <p className="text-emerald-100 text-sm mt-1">
            {isBn ? `খাবার শেষ: ${completionTime}` : `Finished at ${completionTime}`}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 font-medium">
            {updatedMedicines.length > 0
              ? isBn
                ? 'আপনার খাবারের সময়ের ভিত্তিতে পরবর্তী ওষুধের রিমাইন্ডার আপডেট করা হয়েছে:'
                : 'Pending after-meal medicine reminders have been dynamically adjusted:'
              : isBn
              ? 'এই খাবারের সাথে কোনো পেন্ডিং ওষুধ যুক্ত নেই।'
              : 'No pending after-meal medications were scheduled for this meal.'}
          </p>

          {updatedMedicines.length > 0 && (
            <div className="space-y-2.5 max-h-56 overflow-y-auto">
              {updatedMedicines.map((med, idx) => (
                <div
                  key={idx}
                  className="bg-teal-50/70 border border-teal-100 p-3 rounded-2xl flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{med.name}</h4>
                    <p className="text-xs text-slate-500">{med.dosage}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 bg-teal-100 px-2.5 py-1 rounded-full">
                      <Clock className="w-3.5 h-3.5" />
                      {med.newTime}
                    </span>
                    {med.oldTime && med.oldTime !== med.newTime && (
                      <p className="text-[10px] text-slate-400 line-through mt-0.5">
                        {med.oldTime}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200/70 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              {isBn
                ? 'স্মার্ট হাইব্রিড ইঞ্জিন নিশ্চিত করে যে আপনার নির্দিষ্ট সময়ের ওষুধ অপরিবর্তিত থাকে এবং খাবারের ওষুধগুলো সঠিক নিয়মে স্মরণ করানো হয়।'
                : 'MediTime guarantees fixed-time medicines remain untouched while meal-dependent medicines calculate safely from actual food intake.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-md transition cursor-pointer"
          >
            {isBn ? 'ঠিক আছে' : 'Got it, thank you'}
          </button>
        </div>
      </div>
    </div>
  );
};

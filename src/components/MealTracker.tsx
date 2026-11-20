import React, { useState } from 'react';
import { 
  Utensils, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Edit2, 
  Save, 
  Coffee, 
  Sun, 
  Moon, 
  Cookie 
} from 'lucide-react';
import { db } from '../db';
import type { Meal, MealLog } from '../types';
import { 
  formatLocalDate, 
  formatFriendlyTime, 
  confirmMealCompleted 
} from '../services/scheduler';
import { playSuccessChime } from '../services/sound';

interface MealTrackerProps {
  meals: Meal[];
  mealLogs: MealLog[];
  language: 'en' | 'bn';
  onMealConfirmedFeedback: (mealName: string, time: string, updatedMeds: any[]) => void;
  onRefresh: () => void;
}

export const MealTracker: React.FC<MealTrackerProps> = ({
  meals,
  mealLogs,
  language,
  onMealConfirmedFeedback,
  onRefresh,
}) => {
  const isBn = language === 'bn';
  const todayStr = formatLocalDate();
  const mealLogMap = new Map<string, MealLog>(mealLogs.map(ml => [ml.mealId, ml]));

  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editedTime, setEditedTime] = useState<string>('08:00');

  const getMealIcon = (type: string) => {
    switch (type) {
      case 'breakfast': return <Coffee className="w-5 h-5 text-amber-600" />;
      case 'lunch': return <Sun className="w-5 h-5 text-amber-500" />;
      case 'dinner': return <Moon className="w-5 h-5 text-indigo-500" />;
      default: return <Cookie className="w-5 h-5 text-orange-500" />;
    }
  };

  const getMealName = (type: string) => {
    if (isBn) {
      switch (type) {
        case 'breakfast': return 'সকালের নাস্তা';
        case 'lunch': return 'দুপুরের খাবার';
        case 'dinner': return 'রাতের খাবার';
        default: return 'বিকেলের নাশতা';
      }
    }
    return type.toUpperCase();
  };

  const handleFinishMeal = async (meal: Meal) => {
    playSuccessChime();
    const now = new Date();
    const result = await confirmMealCompleted(meal.id, now, todayStr);
    onMealConfirmedFeedback(
      getMealName(meal.mealType),
      formatFriendlyTime(now),
      result.updatedMedicines
    );
    onRefresh();
  };

  const handleStartEdit = (meal: Meal) => {
    setEditingMealId(meal.id);
    setEditedTime(meal.plannedTime);
  };

  const handleSaveEdit = async (meal: Meal) => {
    await db.meals.update(meal.id, { plannedTime: editedTime });
    setEditingMealId(null);
    onRefresh();
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-teal-700 rounded-3xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <Utensils className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black">
              {isBn ? 'স্মার্ট খাবার ট্র্যাকার' : 'Smart Meal Tracker'}
            </h2>
            <p className="text-xs text-amber-100 mt-0.5">
              {isBn
                ? 'খাবার সমাপ্তির তথ্য দিলে পরবর্তী ওষুধের সময় নিরাপদভাবে স্বয়ংক্রিয়ভাবে হিসাব হবে।'
                : 'Log completed meals so dependent medicine reminders adjust dynamically.'}
            </p>
          </div>
        </div>
      </div>

      {/* Meal Cards */}
      <div className="space-y-3">
        {meals.map((meal) => {
          const log = mealLogMap.get(meal.id);
          const isCompleted = log?.status === 'completed';
          const isEditing = editingMealId === meal.id;

          // Check if delayed: planned time passed by >45 minutes and not completed
          const [h, m] = meal.plannedTime.split(':').map(Number);
          const plannedDate = new Date();
          plannedDate.setHours(h, m, 0, 0);
          const isDelayed = !isCompleted && new Date().getTime() > plannedDate.getTime() + 45 * 60 * 1000;

          return (
            <div
              key={meal.id}
              className={`bg-white rounded-3xl p-5 border transition shadow-sm ${
                isCompleted
                  ? 'border-emerald-200 bg-emerald-50/20'
                  : isDelayed
                  ? 'border-amber-300 bg-amber-50/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    {getMealIcon(meal.mealType)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{getMealName(meal.mealType)}</h3>
                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="time"
                          value={editedTime}
                          onChange={(e) => setEditedTime(e.target.value)}
                          className="px-2 py-1 text-xs border border-teal-500 rounded-lg bg-white"
                        />
                        <button
                          onClick={() => handleSaveEdit(meal)}
                          className="p-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {isBn ? 'নির্ধারিত: ' : 'Planned: '} {formatFriendlyTime(meal.plannedTime)}
                        </span>
                        <button
                          onClick={() => handleStartEdit(meal)}
                          className="text-slate-400 hover:text-teal-600 ml-1"
                          title="Edit planned time"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status indicator */}
                <div>
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-full">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {isBn ? 'সম্পন্ন' : 'Completed'}
                    </span>
                  ) : isDelayed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      {isBn ? 'দেরি হয়েছে' : 'Delayed'}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                      {isBn ? 'আসন্ন' : 'Upcoming'}
                    </span>
                  )}
                </div>
              </div>

              {/* Action row */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                {isCompleted && log?.actualCompletionTime ? (
                  <p className="text-xs text-slate-600">
                    {isBn ? 'খাবার শেষ হয়েছে: ' : 'Finished at: '}
                    <strong className="text-emerald-700 font-bold">
                      {formatFriendlyTime(log.actualCompletionTime)}
                    </strong>
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    {isDelayed
                      ? isBn ? '⚠️ খাবারের নির্ধারিত সময় পার হয়েছে।' : '⚠️ Planned meal time has passed.'
                      : isBn ? 'খাবার শেষে বোতামটি চাপুন।' : 'Press button when you finish eating.'}
                  </p>
                )}

                {!isCompleted && (
                  <button
                    onClick={() => handleFinishMeal(meal)}
                    className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    {isBn ? 'খাবার খেয়েছি' : 'I HAVE FINISHED'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

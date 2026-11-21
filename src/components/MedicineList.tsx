import React, { useState } from 'react';
import { 
  Plus, 
  Pill, 
  Edit3, 
  Trash2, 
  PauseCircle, 
  PlayCircle, 
  Clock, 
  Utensils,
  Calendar
} from 'lucide-react';
import { db } from '../db';
import type { Medicine, MedicationSchedule, Meal } from '../types';
import { formatFriendlyTime, syncAlarmsForDate } from '../services/scheduler';

interface MedicineListProps {
  medicines: Medicine[];
  schedules: MedicationSchedule[];
  meals: Meal[];
  language: 'en' | 'bn';
  onAddMedicine: () => void;
  onEditMedicine: (med: Medicine, schedule: MedicationSchedule | undefined) => void;
  onRefresh: () => void;
}

export const MedicineList: React.FC<MedicineListProps> = ({
  medicines,
  schedules,
  meals,
  language,
  onAddMedicine,
  onEditMedicine,
  onRefresh,
}) => {
  const isBn = language === 'bn';
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');

  const mealMap = new Map<string, Meal>(meals.map(m => [m.id, m]));
  const scheduleMap = new Map<string, MedicationSchedule>(
    schedules.map(s => [s.medicineId, s])
  );

  const filteredMedicines = medicines.filter(m => {
    if (filter === 'active') return m.active;
    if (filter === 'paused') return !m.active;
    return true;
  });

  const handleToggleActive = async (medicine: Medicine) => {
    const newActiveState = !medicine.active;
    const updated = { ...medicine, active: newActiveState, updatedAt: new Date().toISOString() };
    await db.medicines.put(updated);

    // Sync all corresponding schedules to match medicine status
    const medSchedules = await db.medicationSchedules.where('medicineId').equals(medicine.id).toArray();
    for (const sched of medSchedules) {
      await db.medicationSchedules.update(sched.id, { enabled: newActiveState });
    }

    await syncAlarmsForDate();
    onRefresh();
  };

  const handleDelete = async (medId: string) => {
    const confirmMsg = isBn 
      ? 'আপনি কি নিশ্চিত যে এই ওষুধটি এবং এর সমস্ত সময়সূচী মুছে ফেলতে চান?' 
      : 'Are you sure you want to delete this medicine and all its scheduled reminders?';
    if (!window.confirm(confirmMsg)) return;

    await db.medicines.delete(medId);
    await db.medicationSchedules.where('medicineId').equals(medId).delete();
    await db.alarmInstances.where('medicineId').equals(medId).delete();
    await syncAlarmsForDate();
    onRefresh();
  };

  const getScheduleSummary = (schedule?: MedicationSchedule) => {
    if (!schedule) return isBn ? 'কোনো সময়সূচী নেই' : 'No schedule set';
    if (schedule.scheduleType === 'fixed_time') {
      return `${isBn ? 'নির্দিষ্ট সময়' : 'Fixed'}: ${formatFriendlyTime(schedule.fixedTime || '09:00')}`;
    }
    const meal = schedule.mealId ? mealMap.get(schedule.mealId) : undefined;
    const mealName = isBn 
      ? meal?.mealType === 'breakfast' ? 'নাস্তা' :
        meal?.mealType === 'lunch' ? 'দুপুর' :
        meal?.mealType === 'dinner' ? 'রাত' : 'নাশতা'
      : meal?.mealType.toUpperCase();

    const relationText = 
      schedule.scheduleType === 'before_meal' ? (isBn ? 'খাবারের আগে' : 'Before') :
      schedule.scheduleType === 'after_meal' ? (isBn ? 'খাবারের পর' : 'After') :
      schedule.scheduleType === 'with_meal' ? (isBn ? 'খাবারের সাথে' : 'With') :
      (isBn ? 'খালি পেটে' : 'Empty Stomach');

    return `${relationText} ${mealName || ''} (${schedule.intervalMinutes} ${isBn ? 'মি.' : 'min'})`;
  };

  return (
    <div className="space-y-4 pb-14 animate-in fade-in duration-200">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            {isBn ? 'আমার ওষুধসমূহ' : 'My Medications'}
          </h2>
          <p className="text-xs text-slate-500">
            {isBn ? 'আপনার সমস্ত প্রেসক্রিপশন ও নির্দেশনা' : 'Manage your active & paused prescriptions'}
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex bg-slate-100 p-1 rounded-2xl self-start">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filter === 'all' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600'
            }`}
          >
            {isBn ? 'সকল' : 'All'} ({medicines.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filter === 'active' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600'
            }`}
          >
            {isBn ? 'সক্রিয়' : 'Active'} ({medicines.filter(m => m.active).length})
          </button>
          <button
            onClick={() => setFilter('paused')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filter === 'paused' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600'
            }`}
          >
            {isBn ? 'স্থগিত' : 'Paused'} ({medicines.filter(m => !m.active).length})
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredMedicines.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-sm space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 mx-auto flex items-center justify-center">
            <Pill className="w-7 h-7 text-teal-600" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">
            {isBn ? 'কোনো ওষুধ পাওয়া যায়নি' : 'No Medications Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {isBn
              ? 'আপনার প্রেসক্রিপশনের নতুন ওষুধ যোগ করতে নিচের বোতামে চাপ দিন।'
              : 'Add your prescribed medicines with meal rules or fixed times to start receiving alerts.'}
          </p>
          <button
            onClick={onAddMedicine}
            className="py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs shadow-md transition inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {isBn ? 'ওষুধ যোগ করুন' : 'Add Medication'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMedicines.map((med) => {
            const schedule = scheduleMap.get(med.id);
            const isPaused = !med.active;

            return (
              <div
                key={med.id}
                className={`bg-white rounded-3xl p-4 border transition shadow-sm ${
                  isPaused ? 'border-slate-200 opacity-60 bg-slate-50' : 'border-slate-200 hover:border-teal-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {med.image ? (
                      <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 shrink-0">
                        <img src={med.image} alt={med.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                        <Pill className="w-6 h-6 text-teal-600" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-slate-900 text-base truncate">{med.name}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {med.category}
                        </span>
                        {isPaused && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            {isBn ? 'স্থগিত' : 'Paused'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-teal-700 mt-0.5">{med.dosage}</p>

                      {/* Schedule pill */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-2 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100 w-fit max-w-full">
                        {schedule?.scheduleType === 'fixed_time' ? (
                          <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        ) : (
                          <Utensils className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                        <span className="font-semibold truncate">{getScheduleSummary(schedule)}</span>
                      </div>

                      {/* Date & Weekday indicator */}
                      {schedule && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1.5">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            {schedule.weekdays && schedule.weekdays.length < 7
                              ? (isBn ? 'সপ্তাহের নির্দিষ্ট দিন' : `${schedule.weekdays.length} days/week`)
                              : (isBn ? 'প্রতিদিন' : 'Daily')}
                            {med.startDate ? ` • ${isBn ? 'শুরু' : 'From'}: ${med.startDate}` : ''}
                          </span>
                        </div>
                      )}

                      {med.instructions && (
                        <p className="text-[11px] text-slate-600 mt-2 bg-amber-50/60 p-2 rounded-xl border border-amber-100/50">
                          📝 {med.instructions}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleActive(med)}
                      className={`p-2 rounded-xl transition cursor-pointer ${
                        isPaused
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                      }`}
                      title={isPaused ? 'Resume Medicine' : 'Pause Medicine'}
                    >
                      {isPaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => onEditMedicine(med, schedule)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(med.id)}
                      className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Add Medicine Action Button */}
      <div className="sticky bottom-20 flex justify-end">
        <button
          onClick={onAddMedicine}
          className="py-3 px-5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-black text-sm rounded-2xl shadow-xl shadow-teal-700/30 transition flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>{isBn ? 'ওষুধ যোগ করুন' : 'Add Medicine'}</span>
        </button>
      </div>
    </div>
  );
};

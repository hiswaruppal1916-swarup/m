import React, { useState } from 'react';
import { X, Pill, Clock, Utensils, Calendar, Camera } from 'lucide-react';
import { db } from '../db';
import type { 
  Medicine, 
  MedicationSchedule, 
  MedicineCategory, 
  ScheduleType, 
  FrequencyType, 
  Meal 
} from '../types';
import { formatLocalDate, syncAlarmsForDate } from '../services/scheduler';

interface MedicineModalProps {
  initialMedicine?: Medicine | null;
  initialSchedule?: MedicationSchedule | null;
  meals: Meal[];
  language: 'en' | 'bn';
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORIES: { value: MedicineCategory; labelEn: string; labelBn: string }[] = [
  { value: 'tablet', labelEn: 'Tablet (ট্যাবলেট)', labelBn: 'ট্যাবলেট' },
  { value: 'capsule', labelEn: 'Capsule (ক্যাপসুল)', labelBn: 'ক্যাপসুল' },
  { value: 'syrup', labelEn: 'Syrup (সিরাপ)', labelBn: 'সিরাপ' },
  { value: 'drops', labelEn: 'Drops (ড্রপস)', labelBn: 'ড্রপস' },
  { value: 'inhaler', labelEn: 'Inhaler (ইনহেলার)', labelBn: 'ইনহেলার' },
  { value: 'injection', labelEn: 'Injection (ইনজেকশন)', labelBn: 'ইনজেকশন' },
  { value: 'topical', labelEn: 'Ointment/Cream', labelBn: 'মলম/ক্রিম' },
  { value: 'other', labelEn: 'Other (অন্যান্য)', labelBn: 'অন্যান্য' },
];

export const MedicineModal: React.FC<MedicineModalProps> = ({
  initialMedicine,
  initialSchedule,
  meals,
  language,
  onClose,
  onSaved,
}) => {
  const isBn = language === 'bn';
  const todayStr = formatLocalDate();

  const [name, setName] = useState(initialMedicine?.name || '');
  const [dosage, setDosage] = useState(initialMedicine?.dosage || '');
  const [category, setCategory] = useState<MedicineCategory>(initialMedicine?.category || 'tablet');
  const [frequency, setFrequency] = useState<FrequencyType>(initialMedicine?.frequency || 'once_daily');
  const [scheduleType, setScheduleType] = useState<ScheduleType>(initialSchedule?.scheduleType || 'after_meal');
  const [mealId, setMealId] = useState<string>(initialSchedule?.mealId || meals[0]?.id || 'breakfast');
  const [fixedTime, setFixedTime] = useState<string>(initialSchedule?.fixedTime || '09:00');
  const [intervalMinutes, setIntervalMinutes] = useState<number>(initialSchedule?.intervalMinutes ?? 15);
  const [weekdays, setWeekdays] = useState<number[]>(initialSchedule?.weekdays || [0, 1, 2, 3, 4, 5, 6]);
  const [startDate, setStartDate] = useState<string>(initialMedicine?.startDate || todayStr);
  const [endDate, setEndDate] = useState<string>(initialMedicine?.endDate || '');
  const [instructions, setInstructions] = useState<string>(initialMedicine?.instructions || '');
  const [image, setImage] = useState<string | undefined>(initialMedicine?.image);
  const [error, setError] = useState<string | null>(null);

  const weekdayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdayNamesBn = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

  const toggleWeekday = (day: number) => {
    if (weekdays.includes(day)) {
      if (weekdays.length === 1) return; // Keep at least one
      setWeekdays(weekdays.filter(d => d !== day));
    } else {
      setWeekdays([...weekdays, day].sort());
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(isBn ? 'অনুগ্রহ করে ওষুধের নাম লিখুন' : 'Please enter the medicine name');
      return;
    }
    if (!dosage.trim()) {
      setError(isBn ? 'অনুগ্রহ করে ডোজ বা মাত্রা লিখুন' : 'Please enter the dosage strength');
      return;
    }

    try {
      const medId = initialMedicine?.id || `med_${Date.now()}`;
      const scheduleId = initialSchedule?.id || `sched_${medId}_1`;
      const nowIso = new Date().toISOString();

      const medicineRecord: Medicine = {
        id: medId,
        name: name.trim(),
        dosage: dosage.trim(),
        category,
        frequency,
        startDate,
        endDate: endDate || undefined,
        instructions: instructions.trim() || undefined,
        image,
        active: initialMedicine ? initialMedicine.active : true,
        createdAt: initialMedicine?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      const scheduleRecord: MedicationSchedule = {
        id: scheduleId,
        medicineId: medId,
        scheduleType,
        mealId: scheduleType === 'fixed_time' ? undefined : mealId,
        fixedTime: scheduleType === 'fixed_time' ? fixedTime : undefined,
        intervalMinutes: scheduleType === 'fixed_time' ? 0 : Number(intervalMinutes),
        weekdays,
        startDate,
        endDate: endDate || undefined,
        enabled: true,
      };

      await db.medicines.put(medicineRecord);
      await db.medicationSchedules.put(scheduleRecord);

      // Immediately sync today's alarms so it reflects on the dashboard
      await syncAlarmsForDate(todayStr);

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving prescription');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 my-6 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Pill className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">
                {initialMedicine 
                  ? isBn ? 'ওষুধ সম্পাদনা করুন' : 'Edit Medicine'
                  : isBn ? 'নতুন ওষুধ যোগ করুন' : 'Add New Medicine'}
              </h3>
              <p className="text-teal-100 text-xs">
                {isBn ? 'প্রেসক্রিপশন অনুযায়ী সঠিক তথ্য দিন' : 'Enter details as prescribed by doctor'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
              ⚠️ {error}
            </div>
          )}

          {/* Medicine Name & Dosage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'ওষুধের নাম *' : 'Medicine Name *'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isBn ? 'যেমন: মেটফর্মিন' : 'e.g., Metformin'}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'ডোজ / মাত্রা *' : 'Dosage / Strength *'}
              </label>
              <input
                type="text"
                required
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder={isBn ? 'যেমন: ৫০০ মিলিগ্রাম' : 'e.g., 500 mg, 1 tablet'}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>
          </div>

          {/* Category & Frequency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'ওষুধের ধরন' : 'Category'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MedicineCategory)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {isBn ? cat.labelBn : cat.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'ফ্রিকোয়েন্সি' : 'Frequency'}
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as FrequencyType)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              >
                <option value="once_daily">{isBn ? 'দিনে ১ বার' : 'Once daily'}</option>
                <option value="twice_daily">{isBn ? 'দিনে ২ বার' : 'Twice daily'}</option>
                <option value="thrice_daily">{isBn ? 'দিনে ৩ বার' : 'Three times daily'}</option>
                <option value="custom">{isBn ? 'কাস্টম সময়' : 'Custom schedule'}</option>
              </select>
            </div>
          </div>

          {/* Schedule Engine Type Selector */}
          <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-4 space-y-3">
            <label className="block text-xs font-bold text-teal-900">
              {isBn ? 'স্মার্ট শিডিউল ইঞ্জিন নির্বাচন' : 'Scheduling Engine Relationship'}
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { type: 'after_meal', labelEn: 'After Meal', labelBn: 'খাবারের পর' },
                { type: 'before_meal', labelEn: 'Before Meal', labelBn: 'খাবারের আগে' },
                { type: 'with_meal', labelEn: 'With Meal', labelBn: 'খাবারের সাথে' },
                { type: 'empty_stomach', labelEn: 'Empty Stomach', labelBn: 'খালি পেটে' },
                { type: 'fixed_time', labelEn: 'Fixed Time', labelBn: 'নির্দিষ্ট সময়' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.type}
                  onClick={() => setScheduleType(item.type as ScheduleType)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition text-center cursor-pointer ${
                    scheduleType === item.type
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'bg-white border border-teal-200 text-teal-800 hover:bg-teal-100/50'
                  }`}
                >
                  {isBn ? item.labelBn : item.labelEn}
                </button>
              ))}
            </div>

            {/* Meal relation parameters */}
            {scheduleType !== 'fixed_time' ? (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-teal-900 mb-1 flex items-center gap-1">
                    <Utensils className="w-3.5 h-3.5" />
                    {isBn ? 'সম্পর্কিত খাবার' : 'Related Meal'}
                  </label>
                  <select
                    value={mealId}
                    onChange={(e) => setMealId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    {meals.map((m) => (
                      <option key={m.id} value={m.id}>
                        {isBn
                          ? m.mealType === 'breakfast' ? 'সকালের নাস্তা' :
                            m.mealType === 'lunch' ? 'দুপুরের খাবার' :
                            m.mealType === 'dinner' ? 'রাতের খাবার' : 'বিকেলের নাশতা'
                          : m.mealType.toUpperCase()} ({m.plannedTime})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-teal-900 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {isBn ? 'ব্যবধান (মিনিট)' : 'Interval (Mins)'}
                  </label>
                  <select
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value={0}>0 {isBn ? 'মিনিট' : 'mins'}</option>
                    <option value={5}>5 {isBn ? 'মিনিট' : 'mins'}</option>
                    <option value={15}>15 {isBn ? 'মিনিট' : 'mins'}</option>
                    <option value={30}>30 {isBn ? 'মিনিট' : 'mins'}</option>
                    <option value={45}>45 {isBn ? 'মিনিট' : 'mins'}</option>
                    <option value={60}>60 {isBn ? 'মিনিট' : 'mins'}</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-teal-900 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {isBn ? 'নির্দিষ্ট সময় নির্বাচন (HH:mm)' : 'Exact Clock Time'}
                </label>
                <input
                  type="time"
                  required
                  value={fixedTime}
                  onChange={(e) => setFixedTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>
            )}
          </div>

          {/* Weekdays Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {isBn ? 'সপ্তাহের কার্যদিবস' : 'Active Weekdays'}
            </label>
            <div className="flex gap-1.5 justify-between">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const isSelected = weekdays.includes(day);
                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => toggleWeekday(day)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-teal-600 border-teal-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {isBn ? weekdayNamesBn[day] : weekdayNamesEn[day]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'শুরুর তারিখ' : 'Start Date'}
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'শেষের তারিখ (ঐচ্ছিক)' : 'End Date (Optional)'}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
              />
            </div>
          </div>

          {/* Additional prescription instructions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? 'প্রেসক্রিপশন নির্দেশনা বা সতর্কতা' : 'Prescription Instructions / Notes'}
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={
                isBn
                  ? 'যেমন: প্রচুর পানি সহ খেতে হবে, চিবানো যাবে না ইত্যাদি'
                  : 'e.g., Take with full glass of water, do not crush tablet'
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            />
          </div>

          {/* Local Photo Attachment (Offline Safe FileReader) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" />
              {isBn ? 'ওষুধ বা প্রেসক্রিপশনের ছবি (ঐচ্ছিক)' : 'Medicine / Prescription Photo (Optional)'}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
              />
              {image && (
                <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-300 shrink-0">
                  <img src={image} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          {/* Submit & Cancel Buttons */}
          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm transition cursor-pointer"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-sm shadow-md transition cursor-pointer"
            >
              {isBn ? 'ওষুধ সংরক্ষণ করুন' : 'Save Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

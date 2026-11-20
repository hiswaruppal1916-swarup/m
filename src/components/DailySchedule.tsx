import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  Utensils 
} from 'lucide-react';
import type { AlarmInstance, Medicine, UserSettings } from '../types';
import { 
  formatLocalDate, 
  formatFriendlyTime, 
  recordDoseAction 
} from '../services/scheduler';

interface DailyScheduleProps {
  medicines: Medicine[];
  alarms: AlarmInstance[];
  selectedDate: string;
  settings: UserSettings;
  onSelectDate: (dateStr: string) => void;
  onTriggerAlarm: (alarm: AlarmInstance, med: Medicine) => void;
  onRefresh: () => void;
}

export const DailySchedule: React.FC<DailyScheduleProps> = ({
  medicines,
  alarms,
  selectedDate,
  settings,
  onSelectDate,
  onTriggerAlarm,
  onRefresh,
}) => {
  const isBn = settings.language === 'bn';
  const todayStr = formatLocalDate();
  const medicineMap = new Map<string, Medicine>(medicines.map(m => [m.id, m]));

  const sortedAlarms = [...alarms].sort(
    (a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
  );

  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    onSelectDate(formatLocalDate(d));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    onSelectDate(formatLocalDate(d));
  };

  const handleSetToday = () => {
    onSelectDate(todayStr);
  };

  const handleAction = async (alarm: AlarmInstance, action: 'taken' | 'skip') => {
    await recordDoseAction(alarm.id, action);
    onRefresh();
  };

  const dateObj = new Date(selectedDate + 'T00:00:00');
  const friendlyDate = dateObj.toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Date Navigation Bar */}
      <div className="bg-white rounded-3xl p-3.5 border border-slate-200 shadow-sm flex items-center justify-between">
        <button
          onClick={handlePrevDay}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          title="Previous Day"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-900 font-extrabold text-base">
            <CalendarIcon className="w-4 h-4 text-teal-600" />
            <span>{friendlyDate}</span>
          </div>
          {selectedDate === todayStr ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
              {isBn ? 'আজ' : 'Today'}
            </span>
          ) : (
            <button
              onClick={handleSetToday}
              className="text-[10px] font-bold text-teal-600 hover:underline block mx-auto mt-0.5"
            >
              {isBn ? 'আজকে ফিরে যান' : 'Go to Today'}
            </button>
          )}
        </div>

        <button
          onClick={handleNextDay}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          title="Next Day"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Timeline Schedule List */}
      {sortedAlarms.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-sm space-y-2">
          <Clock className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">
            {isBn ? 'এই দিনে কোনো ওষুধ নির্ধারিত নেই' : 'No Medications Scheduled'}
          </h3>
          <p className="text-xs text-slate-500">
            {isBn ? 'নতুন ওষুধ যোগ করুন বা অন্য দিন দেখুন।' : 'Check another date or add new prescriptions.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-6 before:w-0.5 before:bg-slate-200">
          {sortedAlarms.map((alarm) => {
            const med = medicineMap.get(alarm.medicineId);
            if (!med) return null;

            const isTaken = alarm.status === 'taken';
            const isMissed = alarm.status === 'missed';
            const isSkipped = alarm.status === 'skipped';
            const isDue = alarm.status === 'due';

            return (
              <div key={alarm.id} className="relative flex items-start gap-4 pl-1">
                {/* Timeline node */}
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 z-10 shadow-sm ${
                    isTaken
                      ? 'bg-emerald-600 text-white'
                      : isMissed
                      ? 'bg-red-600 text-white'
                      : isSkipped
                      ? 'bg-amber-500 text-white'
                      : isDue
                      ? 'bg-teal-600 text-white ring-4 ring-teal-200 animate-pulse'
                      : 'bg-white border-2 border-slate-300 text-slate-700'
                  }`}
                >
                  {isTaken ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    formatFriendlyTime(alarm.scheduledTime).split(' ')[0]
                  )}
                </div>

                {/* Card */}
                <div
                  className={`flex-1 bg-white rounded-3xl p-4 border transition shadow-sm ${
                    isDue
                      ? 'border-teal-500 ring-1 ring-teal-400 bg-teal-50/20'
                      : isTaken
                      ? 'border-emerald-100 bg-emerald-50/10'
                      : isMissed
                      ? 'border-red-100 bg-red-50/10'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-slate-900">{med.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {formatFriendlyTime(alarm.scheduledTime)}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-teal-700 mt-0.5">{med.dosage}</p>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isTaken && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                          ✓ {isBn ? 'খাওয়া হয়েছে' : 'Taken'}
                        </span>
                      )}
                      {isMissed && (
                        <span className="text-[11px] font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
                          ✕ {isBn ? 'মিস হয়েছে' : 'Missed'}
                        </span>
                      )}
                      {isSkipped && (
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                          ⊘ {isBn ? 'বাদ দেওয়া' : 'Skipped'}
                        </span>
                      )}
                      {isDue && (
                        <span className="text-[11px] font-black text-teal-800 bg-teal-100 px-2.5 py-1 rounded-full animate-pulse">
                          🔔 {isBn ? 'এখনই খান' : 'Due Now'}
                        </span>
                      )}
                      {alarm.status === 'pending' && (
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                          {isBn ? 'আসন্ন' : 'Upcoming'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Trigger information badge */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1 text-[11px]">
                      {alarm.triggerType === 'meal_actual' ? (
                        <>
                          <Utensils className="w-3 h-3 text-teal-600" />
                          <strong className="text-teal-700">
                            {isBn ? 'খাবার সমাপ্তি অনুসারে সমন্বিত' : 'Recalculated from meal'}
                          </strong>
                        </>
                      ) : alarm.triggerType === 'fixed' ? (
                        <>
                          <Clock className="w-3 h-3 text-sky-600" />
                          <span>{isBn ? 'নির্দিষ্ট সময়' : 'Fixed time'}</span>
                        </>
                      ) : (
                        <>
                          <Utensils className="w-3 h-3 text-amber-600" />
                          <span>{isBn ? 'খাবারের নির্ধারিত সময়' : 'Planned meal rule'}</span>
                        </>
                      )}
                    </span>

                    {/* Actions if not taken */}
                    {!isTaken && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onTriggerAlarm(alarm, med)}
                          className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
                        >
                          {isBn ? 'অ্যালার্ম / গ্রহণ' : 'Take'}
                        </button>
                        <button
                          onClick={() => handleAction(alarm, 'skip')}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-medium transition cursor-pointer"
                        >
                          {isBn ? 'বাদ' : 'Skip'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

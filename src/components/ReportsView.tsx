import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Download, 
  Printer, 
  ShieldCheck, 
  Calendar, 
  HelpCircle,
  CheckCircle2,
  XCircle,
  MinusCircle
} from 'lucide-react';
import type { MedicationLog, Medicine, UserSettings, AlarmInstance } from '../types';
import { formatLocalDate, calculateAdherence } from '../services/scheduler';

interface ReportsViewProps {
  medicines: Medicine[];
  logs: MedicationLog[];
  alarms: AlarmInstance[];
  settings: UserSettings;
}

type DateFilter = 'today' | '7days' | '30days' | 'custom';

export const ReportsView: React.FC<ReportsViewProps> = ({
  medicines,
  logs,
  alarms,
  settings,
}) => {
  const isBn = settings.language === 'bn';
  const todayStr = formatLocalDate();

  const [dateFilter, setDateFilter] = useState<DateFilter>('7days');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatLocalDate(d);
  });
  const [customEnd, setCustomEnd] = useState<string>(todayStr);

  const medicineMap = useMemo(() => new Map<string, Medicine>(medicines.map(m => [m.id, m])), [medicines]);

  // Compute date range based on filter
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (dateFilter === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    }
    if (dateFilter === '7days') {
      const d = new Date();
      d.setDate(now.getDate() - 6);
      return { startDate: formatLocalDate(d), endDate: todayStr };
    }
    if (dateFilter === '30days') {
      const d = new Date();
      d.setDate(now.getDate() - 29);
      return { startDate: formatLocalDate(d), endDate: todayStr };
    }
    return { startDate: customStart, endDate: customEnd };
  }, [dateFilter, todayStr, customStart, customEnd]);

  // Filter alarms for the selected date range
  const filteredAlarms = useMemo(() => {
    return alarms.filter(a => a.date >= startDate && a.date <= endDate);
  }, [alarms, startDate, endDate]);

  // Calculate overall adherence stats transparently
  const overallStats = useMemo(() => {
    let taken = 0;
    let missed = 0;
    let skipped = 0;
    let pending = 0;

    const now = new Date();

    for (const alarm of filteredAlarms) {
      if (alarm.status === 'taken') taken++;
      else if (alarm.status === 'missed') missed++;
      else if (alarm.status === 'skipped') skipped++;
      else {
        // Pending or due
        const isPast = new Date(alarm.scheduledTime).getTime() < now.getTime() - 45 * 60 * 1000;
        if (isPast && alarm.date <= todayStr) {
          missed++;
        } else {
          pending++;
        }
      }
    }

    const { totalEligible, adherencePercentage, displayPercentage } = calculateAdherence(taken, missed, skipped);

    return {
      totalScheduled: filteredAlarms.length,
      taken,
      missed,
      skipped,
      pending,
      totalEligible,
      adherencePercentage,
      displayPercentage,
    };
  }, [filteredAlarms, todayStr]);

  // Individual medicine breakdown
  const medBreakdown = useMemo(() => {
    return medicines.map(med => {
      const medAlarms = filteredAlarms.filter(a => a.medicineId === med.id);
      let taken = 0;
      let missed = 0;
      let skipped = 0;
      let pending = 0;
      const now = new Date();

      for (const a of medAlarms) {
        if (a.status === 'taken') taken++;
        else if (a.status === 'missed') missed++;
        else if (a.status === 'skipped') skipped++;
        else {
          const isPast = new Date(a.scheduledTime).getTime() < now.getTime() - 45 * 60 * 1000;
          if (isPast && a.date <= todayStr) {
            missed++;
          } else {
            pending++;
          }
        }
      }

      const { totalEligible, adherencePercentage, displayPercentage } = calculateAdherence(taken, missed, skipped);

      return {
        med,
        totalScheduled: medAlarms.length,
        totalEligible,
        taken,
        missed,
        skipped,
        pending,
        adherencePercentage,
        displayPercentage,
      };
    });
  }, [medicines, filteredAlarms, todayStr]);

  // Export to CSV for clinician visit
  const handleExportCSV = () => {
    const headers = ['Medicine Name', 'Dosage', 'Date', 'Scheduled Time', 'Status', 'Actual Taken Time', 'Notes'];
    const rows = logs
      .filter(l => {
        const logDate = l.scheduledTime.split('T')[0];
        return logDate >= startDate && logDate <= endDate;
      })
      .map(l => {
        const med = medicineMap.get(l.medicineId);
        return [
          `"${med?.name || 'Unknown'}"`,
          `"${med?.dosage || ''}"`,
          `"${l.scheduledTime.split('T')[0]}"`,
          `"${l.scheduledTime}"`,
          `"${l.status}"`,
          `"${l.actualTakenTime || 'N/A'}"`,
          `"${l.notes || ''}"`
        ];
      });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `meditime_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pb-14 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-slate-900 rounded-3xl p-5 text-white shadow-lg flex items-center justify-between">
        <div>
          <span className="text-teal-300 text-xs font-bold uppercase tracking-wider">
            {isBn ? 'ক্লিনিক্যাল রিপোর্ট ও প্রমাণ' : 'Clinical & Adherence Report'}
          </span>
          <h2 className="text-xl font-black mt-0.5">
            {isBn ? 'মেডিকেশন অ্যানালিটিক্স' : 'Adherence Analytics'}
          </h2>
          <p className="text-xs text-teal-100/80 mt-0.5">
            {isBn ? 'স্বচ্ছ ও নির্ভুল পরিসংখ্যান ডাক্তারের ভিজিটের জন্য' : 'Transparent statistics formatted for doctor visits'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="p-2.5 bg-white/20 hover:bg-white/30 rounded-2xl text-white transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="Download CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="p-2.5 bg-white/20 hover:bg-white/30 rounded-2xl text-white transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="Print Report"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{isBn ? 'প্রিন্ট' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Date Filter Tabs */}
      <div className="bg-white rounded-3xl p-3 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
            <span>{isBn ? 'সময়কাল নির্বাচন:' : 'Time Period:'}</span>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                dateFilter === 'today' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isBn ? 'আজ' : 'Today'}
            </button>
            <button
              onClick={() => setDateFilter('7days')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                dateFilter === '7days' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isBn ? 'গত ৭ দিন' : 'Last 7 Days'}
            </button>
            <button
              onClick={() => setDateFilter('30days')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                dateFilter === '30days' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isBn ? 'গত ৩০ দিন' : 'Last 30 Days'}
            </button>
            <button
              onClick={() => setDateFilter('custom')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                dateFilter === 'custom' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isBn ? 'কাস্টম' : 'Custom'}
            </button>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">{isBn ? 'হতে' : 'From'}</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">{isBn ? 'পর্যন্ত' : 'To'}</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Report Card (Clean, Balanced Typography, No Oversized Percentages) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex flex-col items-center justify-center shrink-0">
              <span className="text-xl font-black text-teal-800">
                {overallStats.displayPercentage}
              </span>
              <span className="text-[9px] font-bold text-teal-600 uppercase tracking-tight">
                {isBn ? 'নিয়মানুবর্তিতা' : 'Adherence'}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {overallStats.adherencePercentage === null
                    ? (isBn ? 'কোনো ওষুধ তথ্য নেই' : 'No Medication Data Available Yet')
                    : overallStats.adherencePercentage >= 80
                    ? (isBn ? 'চমৎকার নিয়মানুবর্তিতা' : 'Optimal Clinical Adherence')
                    : (isBn ? 'উন্নতির সুযোগ রয়েছে' : 'Needs Care & Attention')}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {overallStats.adherencePercentage === null
                  ? (isBn ? 'এই সময়সীমার মধ্যে কোনো ওষুধ গ্রহণের রেকর্ড নেই।' : 'No completed, missed or skipped doses recorded in this period.')
                  : isBn
                  ? `মোট ${overallStats.totalEligible}টি নির্ধারিত ডোজের মধ্যে ${overallStats.taken}টি সঠিকভাবে গৃহীত হয়েছে।`
                  : `${overallStats.taken} of ${overallStats.totalEligible} eligible doses taken on schedule.`}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar (Only rendered when eligible doses exist) */}
        {overallStats.adherencePercentage !== null ? (
          <div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overallStats.adherencePercentage >= 80
                    ? 'bg-gradient-to-r from-teal-500 to-emerald-500'
                    : 'bg-gradient-to-r from-amber-500 to-red-500'
                }`}
                style={{ width: `${overallStats.adherencePercentage}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 font-semibold">
              <span>0%</span>
              <span>80% (Clinical Target)</span>
              <span>100%</span>
            </div>
          </div>
        ) : null}

        {/* Breakdown Metric Counts Grid */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center">
          <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
              {isBn ? 'মোট শিডিউল' : 'Scheduled'}
            </span>
            <span className="text-base font-black text-slate-800">{overallStats.totalScheduled}</span>
          </div>

          <div className="p-2.5 bg-emerald-50/70 rounded-2xl border border-emerald-100">
            <span className="text-[10px] font-bold text-emerald-700 uppercase flex items-center justify-center gap-0.5 mb-0.5">
              <CheckCircle2 className="w-3 h-3" /> {isBn ? 'খাওয়া' : 'Taken'}
            </span>
            <span className="text-base font-black text-emerald-700">{overallStats.taken}</span>
          </div>

          <div className="p-2.5 bg-red-50/70 rounded-2xl border border-red-100">
            <span className="text-[10px] font-bold text-red-700 uppercase flex items-center justify-center gap-0.5 mb-0.5">
              <XCircle className="w-3 h-3" /> {isBn ? 'মিস' : 'Missed'}
            </span>
            <span className="text-base font-black text-red-700">{overallStats.missed}</span>
          </div>

          <div className="p-2.5 bg-amber-50/70 rounded-2xl border border-amber-100">
            <span className="text-[10px] font-bold text-amber-700 uppercase flex items-center justify-center gap-0.5 mb-0.5">
              <MinusCircle className="w-3 h-3" /> {isBn ? 'বাদ' : 'Skipped'}
            </span>
            <span className="text-base font-black text-amber-700">{overallStats.skipped}</span>
          </div>
        </div>

        {/* Pending explanation note */}
        {overallStats.pending > 0 && (
          <p className="text-[11px] text-slate-400 bg-slate-50 p-2 rounded-xl flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {isBn
                ? `${overallStats.pending}টি আসন্ন বা অপেক্ষমাণ ডোজ এখনও হিসেবের বাইরে রয়েছে।`
                : `${overallStats.pending} upcoming doses remain pending and are not counted until due.`}
            </span>
          </p>
        )}
      </div>

      {/* Individual Medicine Analytics */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-teal-600" />
          {isBn ? 'ওষুধ অনুযায়ী পৃথক বিশ্লেষণ' : 'Individual Medicine Analytics'}
        </h3>

        {medBreakdown.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            {isBn ? 'কোনো ওষুধ পাওয়া যায়নি।' : 'No medicines added to MediTime yet.'}
          </div>
        ) : (
          <div className="space-y-3">
            {medBreakdown.map((item) => (
              <div key={item.med.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-black text-slate-900 text-xs">{item.med.name}</h4>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {item.med.dosage}
                    </span>
                  </div>

                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
                    {item.displayPercentage}
                  </span>
                </div>

                {/* Progress bar */}
                {item.adherencePercentage !== null ? (
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-600 rounded-full transition-all"
                      style={{ width: `${item.adherencePercentage}%` }}
                    />
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 italic">
                    {isBn ? 'এখনও কোনো ডোজ গৃহীত বা মিস হয়নি' : 'No eligible doses recorded yet in this range'}
                  </div>
                )}

                {/* Sub metrics */}
                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 pt-1">
                  <span className="text-emerald-700">✓ {item.taken} {isBn ? 'খাওয়া' : 'taken'}</span>
                  <span>•</span>
                  <span className="text-red-700">✕ {item.missed} {isBn ? 'মিস' : 'missed'}</span>
                  <span>•</span>
                  <span className="text-amber-700">⊘ {item.skipped} {isBn ? 'বাদ' : 'skipped'}</span>
                  {item.pending > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-slate-400">{item.pending} {isBn ? 'আসন্ন' : 'pending'}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

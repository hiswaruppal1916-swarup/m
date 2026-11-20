import React from 'react';
import { 
  BarChart3, 
  Download, 
  Printer, 
  ShieldCheck 
} from 'lucide-react';
import type { AdherenceStats, MedicationLog, Medicine, UserSettings } from '../types';

interface ReportsViewProps {
  stats: AdherenceStats;
  medicines: Medicine[];
  logs: MedicationLog[];
  settings: UserSettings;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  stats,
  medicines,
  logs,
  settings,
}) => {
  const isBn = settings.language === 'bn';
  const medicineMap = new Map<string, Medicine>(medicines.map(m => [m.id, m]));

  // Export to CSV for doctor visit
  const handleExportCSV = () => {
    const headers = ['Medicine Name', 'Dosage', 'Scheduled Time', 'Status', 'Actual Taken Time', 'Notes'];
    const rows = logs.map(l => {
      const med = medicineMap.get(l.medicineId);
      return [
        `"${med?.name || 'Unknown'}"`,
        `"${med?.dosage || ''}"`,
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
    link.setAttribute('download', `meditime_adherence_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Medicine breakdown calculation
  const medBreakdown = medicines.map(med => {
    const medLogs = logs.filter(l => l.medicineId === med.id);
    const taken = medLogs.filter(l => l.status === 'taken').length;
    const total = medLogs.length;
    const rate = total > 0 ? Math.round((taken / total) * 100) : 100;
    return { med, taken, total, rate };
  });

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-slate-900 rounded-3xl p-5 text-white shadow-lg flex items-center justify-between">
        <div>
          <span className="text-teal-300 text-xs font-bold uppercase tracking-wider">
            {isBn ? 'ডাক্তারের ভিজিট রিপোর্ট' : 'Doctor & Clinical Report'}
          </span>
          <h2 className="text-xl font-black mt-0.5">
            {isBn ? 'মেডিকেশন অ্যানালিটিক্স' : 'Adherence Analytics'}
          </h2>
          <p className="text-xs text-teal-100/80 mt-0.5">
            {isBn ? 'আপনার স্বাস্থ্য অগ্রগতি ও প্রেসক্রিপশন রিপোর্ট' : 'Verify clinical adherence and export for healthcare team'}
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

      {/* Primary Score Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-teal-50 border-2 border-teal-500/20 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-teal-700">{stats.adherencePercentage}%</span>
            <span className="text-[10px] font-bold text-teal-900 uppercase">
              {isBn ? 'নিয়মানুবর্তিতা' : 'Adherence'}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              <h3 className="font-bold text-slate-800 text-base">
                {stats.adherencePercentage >= 80 
                  ? (isBn ? 'চমৎকার নিয়মানুবর্তিতা!' : 'Excellent Clinical Adherence!')
                  : (isBn ? 'উন্নতির সুযোগ রয়েছে' : 'Moderate Adherence — Needs Care')}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {isBn
                ? 'ডাক্তারি মানদণ্ড অনুযায়ী ৮০% এর বেশি ওষুধ গ্রহণ সুস্থতার জন্য অত্যন্ত কার্যকরী।'
                : 'Maintaining over 80% adherence significantly reduces health complications and improves outcomes.'}
            </p>
          </div>
        </div>

        {/* Quick summary numbers */}
        <div className="grid grid-cols-3 gap-3 w-full sm:w-auto text-center border-t sm:border-t-0 sm:border-l sm:pl-6 border-slate-100 pt-3 sm:pt-0">
          <div>
            <span className="text-xs text-slate-400 block font-medium">{isBn ? 'খাওয়া' : 'Taken'}</span>
            <span className="text-lg font-black text-emerald-600">{stats.taken}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">{isBn ? 'মিস' : 'Missed'}</span>
            <span className="text-lg font-black text-red-600">{stats.missed}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">{isBn ? 'বাদ' : 'Skipped'}</span>
            <span className="text-lg font-black text-amber-600">{stats.skipped}</span>
          </div>
        </div>
      </div>

      {/* Medicine Adherence Breakdown */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-teal-600" />
          {isBn ? 'ওষুধ অনুযায়ী পৃথক হিসাব' : 'Breakdown by Medication'}
        </h3>

        {medBreakdown.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            {isBn ? 'কোনো ওষুধ যোগ করা নেই।' : 'No medications recorded yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {medBreakdown.map(({ med, taken, total, rate }) => (
              <div key={med.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center mb-1.5">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">{med.name}</h4>
                    <span className="text-[10px] text-slate-400">
                      {med.dosage} • {taken}/{total} {isBn ? 'ডোজ গৃহীত' : 'doses taken'}
                    </span>
                  </div>
                  <span className="text-xs font-black text-teal-700">{rate}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-600 rounded-full transition-all"
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

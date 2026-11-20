import React, { useState } from 'react';
import { 
  History, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Edit3, 
  Calendar,
  X 
} from 'lucide-react';
import type { MedicationLog, Medicine, UserSettings } from '../types';
import { formatFriendlyTime, correctDoseLog } from '../services/scheduler';

interface HistoryViewProps {
  logs: MedicationLog[];
  medicines: Medicine[];
  settings: UserSettings;
  onRefresh: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  logs,
  medicines,
  settings,
  onRefresh,
}) => {
  const isBn = settings.language === 'bn';
  const medicineMap = new Map<string, Medicine>(medicines.map(m => [m.id, m]));
  const [filter, setFilter] = useState<'all' | 'taken' | 'missed' | 'skipped'>('all');
  
  // Correction modal state
  const [editingLog, setEditingLog] = useState<MedicationLog | null>(null);
  const [newStatus, setNewStatus] = useState<'taken' | 'skipped' | 'missed'>('taken');
  const [reason, setReason] = useState<string>('');

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime()
  );

  const filteredLogs = sortedLogs.filter(log => {
    if (filter === 'all') return true;
    return log.status === filter;
  });

  const handleOpenCorrection = (log: MedicationLog) => {
    setEditingLog(log);
    setNewStatus(log.status);
    setReason('');
  };

  const handleSaveCorrection = async () => {
    if (!editingLog) return;
    await correctDoseLog(editingLog.id, newStatus, reason || 'Accidental entry corrected by user');
    setEditingLog(null);
    onRefresh();
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            {isBn ? 'ওষুধ গ্রহণের ইতিহাস ও অডিট লগ' : 'Medication History & Audit'}
          </h2>
          <p className="text-xs text-slate-500">
            {isBn ? 'আপনার সমস্ত অতীত রেকর্ড ও পরিবর্তনের হিসাব' : 'Verified log of taken, missed, and corrected doses'}
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex bg-slate-100 p-1 rounded-2xl self-start">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'all' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            {isBn ? 'সকল' : 'All'}
          </button>
          <button
            onClick={() => setFilter('taken')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'taken' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600'
            }`}
          >
            {isBn ? 'খাওয়া হয়েছে' : 'Taken'}
          </button>
          <button
            onClick={() => setFilter('missed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'missed' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600'
            }`}
          >
            {isBn ? 'মিস হয়েছে' : 'Missed'}
          </button>
          <button
            onClick={() => setFilter('skipped')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'skipped' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600'
            }`}
          >
            {isBn ? 'বাদ' : 'Skipped'}
          </button>
        </div>
      </div>

      {/* History List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-sm space-y-2">
          <History className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">
            {isBn ? 'কোনো ইতিহাস রেকর্ড পাওয়া যায়নি' : 'No History Logs Recorded'}
          </h3>
          <p className="text-xs text-slate-500">
            {isBn ? 'ওষুধ খাওয়া বা বাদ দেওয়ার পর এখানে লিপিবদ্ধ হবে।' : 'Logs will appear here once doses are taken, skipped, or missed.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const med = medicineMap.get(log.medicineId);
            const isTaken = log.status === 'taken';
            const isMissed = log.status === 'missed';

            const logDate = new Date(log.scheduledTime);
            const dateStr = logDate.toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            return (
              <div
                key={log.id}
                className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      isTaken
                        ? 'bg-emerald-100 text-emerald-700'
                        : isMissed
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {isTaken ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isMissed ? (
                      <AlertCircle className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {med ? med.name : 'Unknown Medicine'}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {med ? med.dosage : ''}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {dateStr}
                      </span>
                      <span>•</span>
                      <span>
                        {isBn ? 'নির্ধারিত: ' : 'Scheduled: '}
                        {formatFriendlyTime(log.scheduledTime)}
                      </span>
                    </div>

                    {/* Actual taken time if taken */}
                    {isTaken && log.actualTakenTime && (
                      <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                        {isBn ? 'খাওয়ার সময়: ' : 'Recorded at: '}
                        {formatFriendlyTime(log.actualTakenTime)}
                      </p>
                    )}

                    {/* Audit trail notation if corrected */}
                    {log.correctedAt && (
                      <div className="mt-2 text-[10px] bg-amber-50 p-1.5 rounded-lg border border-amber-200 text-amber-900">
                        <strong>{isBn ? 'সংশোধিত: ' : 'Audit Note: '}</strong>
                        {log.correctionReason || 'User corrected status'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status badge & correction button */}
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      isTaken
                        ? 'bg-emerald-100 text-emerald-700'
                        : isMissed
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {isTaken
                      ? isBn ? 'খাওয়া হয়েছে' : 'Taken'
                      : isMissed
                      ? isBn ? 'মিস হয়েছে' : 'Missed'
                      : isBn ? 'বাদ দেওয়া' : 'Skipped'}
                  </span>

                  <button
                    onClick={() => handleOpenCorrection(log)}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition text-[11px] flex items-center gap-1"
                    title="Correct accidental entry"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isBn ? 'সংশোধন' : 'Correct'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accidental Entry Correction Modal */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {isBn ? 'ভুল তথ্য সংশোধন' : 'Audit Correction'}
              </h3>
              <button
                onClick={() => setEditingLog(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'সঠিক অবস্থা নির্বাচন করুন' : 'Correct Status'}
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as 'taken' | 'skipped' | 'missed')}
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold"
              >
                <option value="taken">{isBn ? 'খাওয়া হয়েছে (Taken)' : 'Taken'}</option>
                <option value="skipped">{isBn ? 'বাদ দেওয়া হয়েছে (Skipped)' : 'Skipped'}</option>
                <option value="missed">{isBn ? 'মিস হয়েছে (Missed)' : 'Missed'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'সংশোধনের কারণ' : 'Reason for Audit Correction'}
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={isBn ? 'যেমন: ভুলে চাপ লেগেছিল' : 'e.g., Accidentally tapped taken'}
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingLog(null)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveCorrection}
                className="flex-1 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700"
              >
                {isBn ? 'সংরক্ষণ' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

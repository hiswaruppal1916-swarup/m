import React, { useState } from 'react';
import { 
  Users, 
  Check, 
  Copy, 
  BellRing, 
  Lock, 
  HeartHandshake 
} from 'lucide-react';
import { db } from '../db';
import type { UserSettings, AdherenceStats } from '../types';

interface CaregiverViewProps {
  settings: UserSettings;
  stats: AdherenceStats;
  onRefresh: () => void;
}

export const CaregiverView: React.FC<CaregiverViewProps> = ({
  settings,
  stats,
  onRefresh,
}) => {
  const isBn = settings.language === 'bn';
  const [copied, setCopied] = useState(false);
  const [caregiverName, setCaregiverName] = useState(settings.caregiverName || '');
  const [caregiverContact, setCaregiverContact] = useState(settings.caregiverContact || '');
  const [isSaved, setIsSaved] = useState(false);

  // Invite code based on user profile
  const inviteCode = `MEDI-${Math.abs(settings.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 900000 + 100000)}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleCaregiver = async () => {
    const updated = {
      ...settings,
      caregiverModeEnabled: !settings.caregiverModeEnabled,
    };
    await db.settings.put(updated);
    onRefresh();
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...settings,
      caregiverName,
      caregiverContact,
    };
    await db.settings.put(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    onRefresh();
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-800 to-sky-900 rounded-3xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <HeartHandshake className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black">
              {isBn ? 'কেয়ারগিভার ও পারিবারিক মোড' : 'Family Caregiver Companion'}
            </h2>
            <p className="text-xs text-sky-200 mt-0.5">
              {isBn
                ? 'পরিবারের সদস্য বা অভিভাবককে যুক্ত করে ওষুধের নিয়মিত তথ্য নিশ্চিত করুন।'
                : 'Share schedules and missed-dose alerts with trusted loved ones.'}
            </p>
          </div>
        </div>
      </div>

      {/* Enable Toggle Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">
            {isBn ? 'কেয়ারগিভার মোড সক্রিয় করুন' : 'Enable Caregiver Access'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBn ? 'সম্মতি প্রদান সাপেক্ষে অভিভাবকের সাথে তথ্য শেয়ার' : 'Allow trusted family to monitor dose adherence'}
          </p>
        </div>

        <button
          onClick={handleToggleCaregiver}
          className={`w-14 h-8 flex items-center rounded-full p-1 transition cursor-pointer ${
            settings.caregiverModeEnabled ? 'bg-teal-600 justify-end' : 'bg-slate-300 justify-start'
          }`}
        >
          <div className="w-6 h-6 rounded-full bg-white shadow-md" />
        </button>
      </div>

      {/* Invite Code Generator */}
      {settings.caregiverModeEnabled && (
        <div className="bg-teal-50/70 border border-teal-200 rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-700" />
            <h4 className="font-bold text-slate-900 text-sm">
              {isBn ? 'পারিবারিক আমন্ত্রণ কোড' : 'Family Invitation Code'}
            </h4>
          </div>
          <p className="text-xs text-slate-600">
            {isBn
              ? 'আপনার অভিভাবককে এই কোডটি দিন যাতে তারা আপনার ওষুধ খাওয়ার অগ্রগতি পর্যবেক্ষণ করতে পারেন:'
              : 'Share this secure invitation code with your designated family caregiver:'}
          </p>

          <div className="flex items-center gap-2 bg-white p-3 rounded-2xl border border-teal-200">
            <span className="font-mono text-base font-black tracking-widest text-teal-800 flex-1">
              {inviteCode}
            </span>
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? (isBn ? 'কপি হয়েছে' : 'Copied') : (isBn ? 'কপি' : 'Copy')}
            </button>
          </div>

          <div className="bg-white/80 p-3 rounded-2xl border border-teal-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-semibold">
              {isBn ? 'আজকের ওষুধ গ্রহণের হার:' : "Patient's Today Adherence:"}
            </span>
            <span className="font-black text-teal-700">{stats.adherencePercentage}%</span>
          </div>
        </div>
      )}

      {/* Designated Caregiver Contact */}
      <form onSubmit={handleSaveContact} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <BellRing className="w-4 h-4 text-teal-600" />
          {isBn ? 'অভিভাবকের যোগাযোগ তথ্য' : 'Designated Emergency Contact'}
        </h3>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {isBn ? 'অভিভাবক বা স্বজনের নাম' : 'Caregiver Name'}
          </label>
          <input
            type="text"
            value={caregiverName}
            onChange={(e) => setCaregiverName(e.target.value)}
            placeholder={isBn ? 'যেমন: সন্তান / জীবনসঙ্গী' : 'e.g., Son, Daughter, Spouse'}
            className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {isBn ? 'ফোন নম্বর বা ইমেল' : 'Phone Number or Email'}
          </label>
          <input
            type="text"
            value={caregiverContact}
            onChange={(e) => setCaregiverContact(e.target.value)}
            placeholder="+8801700000000"
            className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-medium"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
        >
          {isSaved ? (isBn ? 'সংরক্ষিত হয়েছে ✓' : 'Saved ✓') : (isBn ? 'তথ্য সংরক্ষণ করুন' : 'Save Contact')}
        </button>
      </form>

      {/* Privacy Notice Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <Lock className="w-4 h-4 text-teal-600" />
          <span>{isBn ? 'গোপনীয়তা ও নিরাপত্তা নিশ্চয়তা' : 'Health Privacy & Consent Safeguards'}</span>
        </div>
        <p>
          {isBn
            ? 'আপনার প্রেসক্রিপশন বা স্বাস্থ্যের কোনো তথ্য আপনার স্পষ্ট অনুমতি ছাড়া কোনো পাবলিক সার্ভারে আপলোড করা হয় না। সমস্ত ডাটা আপনার ডিভাইসেই সংরক্ষিত।'
            : 'MediTime prioritizes patient autonomy. Medical records remain local to your device and are never exposed publicly.'}
        </p>
      </div>
    </div>
  );
};

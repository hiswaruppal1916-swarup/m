import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Bell, 
  Smartphone, 
  Volume2, 
  RefreshCw, 
  BatteryCharging,
  Apple,
  Mic
} from 'lucide-react';
import { 
  runCompatibilityDiagnostics, 
  requestNotificationPermission, 
  showWebNotification, 
  type CompatibilityReport,
  type DeviceCompatibilityItem 
} from '../services/notifications';
import { playAlarmSound } from '../services/sound';
import { voiceService } from '../services/voice';

interface CompatibilityViewProps {
  language: 'en' | 'bn';
  onTriggerTestAlarm?: () => void;
}

export const CompatibilityView: React.FC<CompatibilityViewProps> = ({ 
  language,
  onTriggerTestAlarm 
}) => {
  const isBn = language === 'bn';
  const [report, setReport] = useState<CompatibilityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    const res = await runCompatibilityDiagnostics();
    setReport(res);
    setLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const handleRequestPermission = async () => {
    await requestNotificationPermission();
    await runDiagnostics();
  };

  const handleSendTestNotification = async () => {
    playAlarmSound('gentle_chime', 0.8);
    const ok = await showWebNotification(
      'MediTime — Medicine Reminder',
      {
        body: isBn
          ? 'পরীক্ষামূলক নোটিফিকেশন: আপনার ওষুধের অ্যালার্ট সিস্টেম সঠিকভাবে কার্যকর আছে।'
          : 'Test Alert: Your medicine reminder alert system is functioning properly.',
      }
    );
    setTestSent(ok);
    setTimeout(() => setTestSent(false), 3500);
  };

  const handleTestVoice = () => {
    voiceService.speak({
      language,
      type: 'due',
      medicineName: isBn ? 'মেটফর্মিন' : 'Metformin'
    });
  };

  const renderStatusBadge = (status: DeviceCompatibilityItem['status']) => {
    if (status === 'supported') {
      return (
        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          {isBn ? 'সক্রিয় / সমর্থিত' : 'Supported'}
        </span>
      );
    }
    if (status === 'limited') {
      return (
        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          {isBn ? 'সীমাবদ্ধ' : 'Limited Support'}
        </span>
      );
    }
    return (
      <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full flex items-center gap-1">
        <XCircle className="w-3.5 h-3.5 text-red-600" />
        {isBn ? 'অসমর্থিত' : 'Not Supported'}
      </span>
    );
  };

  return (
    <div className="space-y-4 pb-14 animate-in fade-in duration-200">
      {/* Banner */}
      <div className="bg-gradient-to-r from-sky-800 to-teal-800 rounded-3xl p-5 text-white shadow-lg flex items-center justify-between">
        <div>
          <span className="text-sky-300 text-xs font-bold uppercase tracking-wider">
            {isBn ? 'ডিভাইস সামঞ্জস্যতা কেন্দ্র' : 'Device Compatibility Center'}
          </span>
          <h2 className="text-xl font-black mt-0.5">
            {isBn ? 'অ্যালার্ম ও নোটিফিকেশন সামঞ্জস্যতা' : 'Alarm & Notification Status'}
          </h2>
          <p className="text-xs text-teal-100/80 mt-0.5">
            {isBn ? '১০টি প্রধান হার্ডওয়্যার ও ব্রাউজার সক্ষমতা যাচাই' : '10-point honest hardware & browser capability inspection'}
          </p>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="p-2.5 bg-white/20 hover:bg-white/30 rounded-2xl text-white transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isBn ? 'পুনরায় যাচাই' : 'Recheck'}</span>
        </button>
      </div>

      {/* 10-Point Compatibility Checklist */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">
            {isBn ? '১০টি মূল সিস্টেম চেকের ফলাফল' : '10-Point Device Capability Checklist'}
          </h3>
          {report && (
            <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2.5 py-0.5 rounded-full">
              {report.platform.toUpperCase()}
            </span>
          )}
        </div>

        {report && (
          <div className="space-y-2">
            {report.items.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {isBn ? item.nameBn : item.nameEn}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {isBn ? item.detailBn : item.detailEn}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {item.actionRequired === 'grant_permission' && (
                    <button
                      onClick={handleRequestPermission}
                      className="text-xs font-bold text-teal-700 bg-teal-100 hover:bg-teal-200 px-2.5 py-1 rounded-xl transition cursor-pointer"
                    >
                      {isBn ? 'অনুমতি দিন' : 'Allow'}
                    </button>
                  )}
                  {renderStatusBadge(item.status)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Diagnostic Testing Action Buttons */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={handleSendTestNotification}
            className="py-2.5 px-3 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{testSent ? (isBn ? 'পাঠানো হয়েছে ✓' : 'Sent! ✓') : (isBn ? 'টেস্ট নোটিফিকেশন' : 'Test Notification')}</span>
          </button>

          {onTriggerTestAlarm && (
            <button
              onClick={onTriggerTestAlarm}
              className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{isBn ? 'টেস্ট অ্যালার্ম স্ক্রিন' : 'Test Alarm Screen'}</span>
            </button>
          )}

          <button
            onClick={handleTestVoice}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5 text-teal-600" />
            <span>{isBn ? 'টেস্ট ভয়েস' : 'Test Voice'}</span>
          </button>
        </div>
      </div>

      {/* Platform-Specific Installation & Optimization Guides */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-teal-600" />
          {isBn ? 'ডিভাইস-ভিত্তিক সেরা ইনস্টলেশন গাইড' : 'Device-Specific Installation & Background Guide'}
        </h3>

        {/* iPhone / iPad Guide */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center gap-2 font-black text-xs text-slate-900">
            <Apple className="w-4 h-4 text-slate-800" />
            <span>{isBn ? 'আইফোন / আইপ্যাড (Apple iOS Safari)' : 'Apple iPhone / iPad (Safari)'}</span>
          </div>
          <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside leading-relaxed">
            <li>{isBn ? 'Safari ব্রাউজারে মেডিটাইম খুলুন।' : 'Open MediTime in Safari browser.'}</li>
            <li>{isBn ? 'নিচের Share বোতামে চাপ দিন।' : 'Tap the Share icon at the bottom of the screen.'}</li>
            <li>{isBn ? '"Add to Home Screen" নির্বাচন করুন।' : 'Scroll down and tap "Add to Home Screen".'}</li>
            <li>{isBn ? 'হোম স্ক্রিন আইকন থেকে মেডিটাইম খুলুন এবং নোটিফিকেশন অন করুন।' : 'Open MediTime from your home screen icon and allow notifications.'}</li>
          </ol>
          <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl">
            ℹ️ {isBn
              ? 'আইওএস-এ ওয়েব পুশ নোটিফিকেশন পেতে অ্যাপটি হোম স্ক্রিনে ইনস্টল করা বাধ্যতামূলক।'
              : 'iOS requirement: Web Push notifications require MediTime to be installed on the Home Screen.'}
          </p>
        </div>

        {/* Android Optimization Guide */}
        <div className="p-4 bg-teal-50/70 rounded-2xl border border-teal-200 space-y-2">
          <div className="flex items-center gap-2 font-black text-xs text-teal-950">
            <BatteryCharging className="w-4 h-4 text-teal-700" />
            <span>{isBn ? 'অ্যান্ড্রয়েড ব্যাটারি অপটিমাইজেশন বন্ধ করার নিয়ম' : 'Android Battery & Sleep Optimization'}</span>
          </div>
          <p className="text-xs text-teal-900 leading-relaxed">
            {isBn
              ? 'Samsung, Xiaomi, OnePlus, Vivo, Oppo ডিভাইসগুলোতে কঠোর ব্যাটারি সেভার থাকে। সময়মতো অ্যালার্ম পেতে:'
              : 'Samsung, Xiaomi (MIUI), OnePlus, and Vivo devices aggressively kill background web processes. For timely reminders:'}
          </p>
          <ul className="text-xs text-teal-950 space-y-1 list-disc list-inside leading-relaxed">
            <li>{isBn ? 'সেটিংস > অ্যাপস > ক্রোম/মেডিটাইম > ব্যাটারি > "Unrestricted" নির্বাচন করুন।' : 'Settings > Apps > MediTime / Chrome > Battery > Choose "Unrestricted".'}</li>
            <li>{isBn ? 'মেডিটাইম-এর নোটিফিকেশন পারমিশন অন রাখুন।' : 'Ensure notifications are set to "Urgent / High Priority".'}</li>
            <li>{isBn ? 'অ্যাপকে ব্যাকগ্রাউন্ড ডেটা ব্যবহারের অনুমতি দিন।' : 'Allow background data usage.'}</li>
          </ul>
        </div>
      </div>

      {/* Honest 4-Layer PWA & Android Native Companion Integration Boundary */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-slate-900 text-sm">
            {isBn ? 'PWA অ্যালার্মের কারিগরি সততা ও নেটিভ ইন্টিগ্রেশন প্রস্তুতি' : 'Progressive Enhancement & Native Companion Boundary'}
          </h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {isBn
            ? 'ওয়েব স্ট্যান্ডার্ড অনুযায়ী ব্রাউজার বন্ধ থাকা অবস্থায় ৪ মিনিটের একটানা অডিও লুপ বাজানোর গ্যারান্টি কোনো PWA দিতে পারে না। মেডিটাইম বাস্তবসম্মত ৪-স্তর বিশিষ্ট আর্কিটেকচার অনুসরণ করে:'
            : 'Browser sandboxes do not allow closed web pages to loop continuous audio indefinitely. MediTime uses honest progressive enhancement:'}
        </p>

        <div className="space-y-2 pt-1 text-xs">
          <div className="p-3 bg-teal-50 rounded-2xl border border-teal-100">
            <h4 className="font-black text-teal-900">
              {isBn ? 'লেয়ার ১ — সক্রিয় অ্যাপ (In-App Continuous Alarm)' : 'Level 1 — Active In-App Continuous Alarm'}
            </h4>
            <p className="text-teal-800 text-[11px] mt-0.5">
              {isBn
                ? 'অ্যাপ খোলা থাকা অবস্থায় ৪ মিনিট বা তার বেশি সময় ধরে অবিরাম অ্যালার্ম সুর বাজে, ফুলস্ক্রিন অ্যালার্ম ইন্টারফেস দেখায় এবং ভয়েস ঘোষণা করে।'
                : 'Continuous looping audio (minimum 4-minute cycle), full alarm UI, speech synthesis, haptics until dismissed.'}
            </p>
          </div>

          <div className="p-3 bg-sky-50 rounded-2xl border border-sky-100">
            <h4 className="font-black text-sky-900">
              {isBn ? 'লেয়ার ২ — ব্যাকগ্রাউন্ড নোটিফিকেশন (Service Worker)' : 'Level 2 — Background Web Push & Service Worker'}
            </h4>
            <p className="text-sky-800 text-[11px] mt-0.5">
              {isBn
                ? 'অ্যাপ ব্যাকগ্রাউন্ডে থাকলে সার্ভিস ওয়ার্কারের মাধ্যমে সিস্টেম নোটিফিকেশন পাঠানো হয়, ট্যাপ করলে সাথে সাথে অ্যালার্ম ইন্টারফেস খুলে।'
                : 'System notifications wake the user; clicking the notification immediately focuses MediTime and opens the alarm modal.'}
            </p>
          </div>

          <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
            <h4 className="font-black text-indigo-900">
              {isBn ? 'লেয়ার ৩ — নেটিভ কম্প্যানিয়ন বাউন্ডারি (Android AlarmManager)' : 'Level 3 — Future Android Native Companion Integration Boundary'}
            </h4>
            <p className="text-indigo-800 text-[11px] mt-0.5">
              {isBn
                ? 'ভবিষ্যতে অ্যান্ড্রয়েড নেটিভ এপিকে-এর সাথে যুক্ত হওয়ার জন্য ডেটাবেজ ও এপিআই প্রস্তুত রাখা হয়েছে (Android AlarmManager API)।'
                : 'Architecturally isolated boundary prepared for optional Android Native APK companion using AlarmManager and ACTION_REQUEST_SCHEDULE_EXACT_ALARM.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

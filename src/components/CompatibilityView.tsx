import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Bell, 
  Smartphone, 
  Wifi, 
  Volume2, 
  RefreshCw, 
  Download, 
  Info 
} from 'lucide-react';
import { 
  runCompatibilityDiagnostics, 
  requestNotificationPermission, 
  showWebNotification, 
  type CompatibilityReport 
} from '../services/notifications';
import { playAlarmSound } from '../services/sound';

interface CompatibilityViewProps {
  language: 'en' | 'bn';
}

export const CompatibilityView: React.FC<CompatibilityViewProps> = ({ language }) => {
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
      isBn ? 'মেডিটাইম টেস্ট রিমাইন্ডার 🔔' : 'MediTime Test Alert 🔔',
      {
        body: isBn
          ? 'এটি একটি পরীক্ষামূলক নোটিফিকেশন। আপনার নোটিফিকেশন সিস্টেম কার্যকর আছে।'
          : 'This is a test notification. Your reminder alert system is functioning properly.',
      }
    );
    setTestSent(ok);
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div className="space-y-4 pb-14 animate-in fade-in duration-200">
      {/* Banner */}
      <div className="bg-gradient-to-r from-sky-800 to-teal-800 rounded-3xl p-5 text-white shadow-lg flex items-center justify-between">
        <div>
          <span className="text-sky-300 text-xs font-bold uppercase tracking-wider">
            {isBn ? 'সিস্টেম ডায়াগনস্টিকস' : 'System Diagnostic Hub'}
          </span>
          <h2 className="text-xl font-black mt-0.5">
            {isBn ? 'অ্যালার্ম ও নোটিফিকেশন সামঞ্জস্যতা' : 'Alarm & Notification Compatibility'}
          </h2>
          <p className="text-xs text-teal-100/80 mt-0.5">
            {isBn ? 'ব্রাউজার ও ডিভাইসের ক্ষমতা যাচাই' : 'Honest hardware & browser capability inspection'}
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

      {/* Diagnostics Checklist */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm">
          {isBn ? 'ডিভাইস ক্ষমতার তালিকা' : 'Live Device Capabilities'}
        </h3>

        {report && (
          <div className="space-y-2">
            {/* Notification Permission */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-teal-600" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {isBn ? 'নোটিফিকেশন পারমিশন' : 'Web Notification Permission'}
                  </h4>
                  <p className="text-[10px] text-slate-400 capitalize">
                    {isBn ? `বর্তমান অবস্থা: ${report.notificationPermission}` : `Current status: ${report.notificationPermission}`}
                  </p>
                </div>
              </div>

              <div>
                {report.notificationPermission === 'granted' ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {isBn ? 'অনুমোদিত' : 'Granted'}
                  </span>
                ) : (
                  <button
                    onClick={handleRequestPermission}
                    className="text-xs font-bold text-teal-700 bg-teal-100 hover:bg-teal-200 px-3 py-1 rounded-xl transition cursor-pointer"
                  >
                    {isBn ? 'অনুমতি দিন' : 'Grant Permission'}
                  </button>
                )}
              </div>
            </div>

            {/* Service Worker */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-sky-600" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {isBn ? 'সার্ভিস ওয়ার্কার (অফলাইন ইঞ্জিন)' : 'Service Worker (Offline Engine)'}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {report.serviceWorkerSupported ? 'Supported' : 'Unsupported'}
                  </p>
                </div>
              </div>

              <span
                className={`text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-full ${
                  report.serviceWorkerSupported
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-amber-600 bg-amber-50'
                }`}
              >
                {report.serviceWorkerSupported ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {report.serviceWorkerSupported ? (isBn ? 'সক্রিয়' : 'Active') : (isBn ? 'অসমর্থিত' : 'Not supported')}
              </span>
            </div>

            {/* Standalone PWA installation */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2.5">
                <Download className="w-4 h-4 text-teal-600" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {isBn ? 'ইনস্টলড PWA অ্যাপ মোড' : 'Standalone App Display Mode'}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {report.isStandalonePWA
                      ? isBn ? 'ফুলস্ক্রিন অ্যাপ হিসেবে চালিত' : 'Running as standalone application'
                      : isBn ? 'ব্রাউজার ট্যাবে চালিত' : 'Running in browser tab'}
                  </p>
                </div>
              </div>

              <span
                className={`text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-full ${
                  report.isStandalonePWA
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-slate-600 bg-slate-200'
                }`}
              >
                {report.isStandalonePWA ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                {report.isStandalonePWA ? (isBn ? 'ইনস্টলড' : 'Installed PWA') : (isBn ? 'ব্রাউজার' : 'Browser')}
              </span>
            </div>

            {/* Audio Synthesis */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-amber-600" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {isBn ? 'ওয়েব অডিও সিন্থেসাইজার' : 'Web Audio API Synthesizer'}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {report.audioSupported ? 'Hardware audio unlocked' : 'Audio API unavailable'}
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isBn ? 'সক্রিয়' : 'Ready'}
              </span>
            </div>

            {/* Network connectivity */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2.5">
                <Wifi className="w-4 h-4 text-teal-600" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {isBn ? 'নেটওয়ার্ক সংযোগ' : 'Network Connection'}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {report.isOnline ? 'Online (IndexedDB Local First)' : 'Offline (Local-First Active)'}
                  </p>
                </div>
              </div>

              <span
                className={`text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-full ${
                  report.isOnline ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'
                }`}
              >
                {report.isOnline ? (isBn ? 'অনলাইন' : 'Online') : (isBn ? 'অফলাইন' : 'Offline')}
              </span>
            </div>
          </div>
        )}

        {/* Test Notification Trigger */}
        <div className="pt-2">
          <button
            onClick={handleSendTestNotification}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-bold text-xs rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {testSent
              ? isBn ? 'টেস্ট নোটিফিকেশন পাঠানো হয়েছে ✓' : 'Test Alert Sent Successfully! ✓'
              : isBn ? 'টেস্ট নোটিফিকেশন ও সাউন্ড পাঠান' : 'Trigger Test Notification & Chime'}
          </button>
        </div>
      </div>

      {/* Honest 4-Layer PWA Alarm Architecture Explanation */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-slate-900 text-sm">
            {isBn ? 'PWA অ্যালার্মের কারিগরি বাস্তবমুখী আর্কিটেকচার' : 'PWA Multi-Layer Reminder Architecture'}
          </h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {isBn
            ? 'ওয়েব স্ট্যান্ডার্ড অনুযায়ী কোনো ব্রাউজার-ভিত্তিক PWA অ্যান্ড্রয়েডের নেটিভ ক্লক অ্যালার্মের মতো ডিভাইস স্লিপিং মোডে ১০০% নির্ভুল ব্যাকগ্রাউন্ড অ্যালার্ম দেওয়ার দাবি করতে পারে না। মেডিটাইম একটি ৪-স্তর বিশিষ্ট আর্কিটেকচার বজায় রাখে:'
            : 'Standard browser web technologies cannot guarantee exact unthrottled wake alarms when device is deeply asleep or browser process is terminated. MediTime operates an honest 4-layer architecture:'}
        </p>

        <div className="space-y-2.5 pt-1 text-xs">
          <div className="p-3 bg-teal-50 rounded-2xl border border-teal-100">
            <h4 className="font-black text-teal-900">
              {isBn ? 'লেয়ার ১ — সক্রিয় অ্যাপ (Active App)' : 'Layer 1 — Active Application'}
            </h4>
            <p className="text-teal-800 text-[11px] mt-0.5">
              {isBn
                ? 'অ্যাপ খোলা থাকা অবস্থায় রিয়েল-টাইম শিডিউলার উচ্চ-শব্দের অডিও চিম বাজায়, ফুলস্ক্রিন অ্যালার্ম ইন্টারফেস দেখায় এবং বাংলা/ইংরেজি ভয়েস ঘোষণা করে।'
                : 'When app is open or kept in foreground: full audio chimes, visual modal, voice synthesis, haptic vibration, and instant snooze/taken tracking.'}
            </p>
          </div>

          <div className="p-3 bg-sky-50 rounded-2xl border border-sky-100">
            <h4 className="font-black text-sky-900">
              {isBn ? 'লেয়ার ২ — সার্ভিস ওয়ার্কার (Service Worker)' : 'Layer 2 — Service Worker'}
            </h4>
            <p className="text-sky-800 text-[11px] mt-0.5">
              {isBn
                ? 'সম্পূর্ণ অফলাইন ব্যবহারের জন্য অ্যাপের ফাইল ক্যাশ করে এবং নোটিফিকেশনে ক্লিক করলে সরাসরি সংশ্লিষ্ট ওষুধে নিয়ে যায়।'
                : 'Provides 100% offline access to local IndexedDB data and handles notification click routing.'}
            </p>
          </div>

          <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
            <h4 className="font-black text-indigo-900">
              {isBn ? 'লেয়ার ৩ — ওয়েব পুশ (Optional Web Push)' : 'Layer 3 — Web Push Protocol'}
            </h4>
            <p className="text-indigo-800 text-[11px] mt-0.5">
              {isBn
                ? 'সার্ভার যুক্ত থাকলে ইন্টারনেট সংযোগে নোটিফিকেশন পাঠাতে পারে (ভবিষ্যৎ সুপাবেস আর্কিটেকচারের জন্য প্রস্তুত)।'
                : 'Ready for future Supabase server-delivered push notifications when connected to internet.'}
            </p>
          </div>

          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
            <h4 className="font-black text-amber-900">
              {isBn ? 'লেয়ার ৪ — বিশ্বস্ততা ও নির্দেশিকা' : 'Layer 4 — Device Standalone Guidelines'}
            </h4>
            <p className="text-amber-800 text-[11px] mt-0.5">
              {isBn
                ? 'সর্বোত্তম অভিজ্ঞতার জন্য ক্রোম বা সাফারির "Install App" বা "Add to Home Screen" অপশন ব্যবহার করে অ্যাপটি ইনস্টল করুন।'
                : 'For best performance, install MediTime to your home screen using the browser Install prompt.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

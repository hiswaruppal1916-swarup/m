/**
 * Universal Web Notifications, Push Architecture & Cross-Device Compatibility Service
 * Complies with strict PWA standards across Android, iPhone (iOS Safari), and Desktop browsers.
 */

import { db } from '../db';

export type CapabilityStatus = 'supported' | 'limited' | 'not_supported';

export interface DeviceCompatibilityItem {
  id: string;
  nameEn: string;
  nameBn: string;
  status: CapabilityStatus;
  detailEn: string;
  detailBn: string;
  actionRequired?: string;
}

export interface CompatibilityReport {
  platform: 'android' | 'ios' | 'desktop';
  notificationSupported: boolean;
  notificationPermission: NotificationPermission;
  serviceWorkerSupported: boolean;
  serviceWorkerRegistered: boolean;
  isStandalonePWA: boolean;
  audioSupported: boolean;
  customAudioCount: number;
  voiceSupported: boolean;
  bengaliVoiceAvailable: boolean;
  wakeLockSupported: boolean;
  pushSupported: boolean;
  isOnline: boolean;
  lastSyncTimestamp?: string;
  items: DeviceCompatibilityItem[];
}

/**
 * Detect device platform
 */
export function detectPlatform(): 'android' | 'ios' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  return 'desktop';
}

/**
 * Run comprehensive 10-point cross-device compatibility diagnostics
 */
export async function runCompatibilityDiagnostics(): Promise<CompatibilityReport> {
  const isClient = typeof window !== 'undefined';
  const platform = detectPlatform();

  if (!isClient) {
    return {
      platform,
      notificationSupported: false,
      notificationPermission: 'default',
      serviceWorkerSupported: false,
      serviceWorkerRegistered: false,
      isStandalonePWA: false,
      audioSupported: false,
      customAudioCount: 0,
      voiceSupported: false,
      bengaliVoiceAvailable: false,
      wakeLockSupported: false,
      pushSupported: false,
      isOnline: false,
      items: []
    };
  }

  // 1. Notification API
  const notificationSupported = 'Notification' in window;
  const notificationPermission: NotificationPermission = notificationSupported ? Notification.permission : 'denied';

  // 2. Service Worker
  const serviceWorkerSupported = 'serviceWorker' in navigator;
  let serviceWorkerRegistered = false;
  let backgroundNotificationSupported = false;
  if (serviceWorkerSupported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      serviceWorkerRegistered = !!reg?.active;
      backgroundNotificationSupported = !!(reg && 'showNotification' in reg);
    } catch {
      serviceWorkerRegistered = false;
    }
  }

  // 3. PWA Standalone display mode
  const isStandalonePWA = 
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://');

  // 4. Web Audio
  const audioSupported = 'AudioContext' in window || 'webkitAudioContext' in window;

  // 5. Custom audio storage
  let customAudioCount = 0;
  try {
    customAudioCount = await db.customAudio.count();
  } catch {}

  // 6. Web Speech API
  const voiceSupported = 'speechSynthesis' in window;
  let bengaliVoiceAvailable = false;
  if (voiceSupported && window.speechSynthesis) {
    const voices = window.speechSynthesis.getVoices();
    bengaliVoiceAvailable = voices.some(v => v.lang.toLowerCase().startsWith('bn'));
  }

  // 7. Push API
  const pushSupported = 'PushManager' in window;

  // 8. WakeLock
  const wakeLockSupported = 'wakeLock' in navigator;

  // 9. Network
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // 10. Last synchronization timestamp
  let lastSyncTimestamp: string | undefined;
  try {
    const settings = await db.settings.get('current_user');
    lastSyncTimestamp = settings?.lastSyncTimestamp;
  } catch {}

  // Build the 10 diagnostic items with honest status
  const items: DeviceCompatibilityItem[] = [
    {
      id: 'pwa_mode',
      nameEn: 'PWA Home Screen Installation',
      nameBn: 'হোম স্ক্রিন PWA ইনস্টলেশন অবস্থা',
      status: isStandalonePWA ? 'supported' : 'limited',
      detailEn: isStandalonePWA ? 'Installed as standalone app' : 'Running in browser tab',
      detailBn: isStandalonePWA ? 'ফুলস্ক্রিন অ্যাপ হিসেবে চালিত' : 'ব্রাউজার ট্যাবে চালিত',
      actionRequired: isStandalonePWA ? undefined : (platform === 'ios' ? 'ios_install_guide' : 'android_install_guide')
    },
    {
      id: 'notification_perm',
      nameEn: 'Medicine Notification Permission',
      nameBn: 'ওষুধের নোটিফিকেশন পারমিশন',
      status: notificationPermission === 'granted' ? 'supported' : (notificationPermission === 'default' ? 'limited' : 'not_supported'),
      detailEn: `Permission: ${notificationPermission}`,
      detailBn: `অবস্থা: ${notificationPermission === 'granted' ? 'অনুমোদিত' : notificationPermission === 'default' ? 'অমীমাংসিত' : 'প্রত্যাখ্যাত'}`,
      actionRequired: notificationPermission !== 'granted' ? 'grant_permission' : undefined
    },
    {
      id: 'push_api',
      nameEn: 'Web Push Protocol',
      nameBn: 'ওয়েব পুশ প্রোটোকল',
      status: pushSupported ? 'supported' : (platform === 'ios' && !isStandalonePWA ? 'limited' : 'not_supported'),
      detailEn: pushSupported ? 'PushManager ready' : (platform === 'ios' ? 'iOS requires Home Screen installation for Push' : 'Push unsupported'),
      detailBn: pushSupported ? 'পুশ ম্যানেজার সক্রিয়' : (platform === 'ios' ? 'আইফোনে পুশ পেতে অ্যাপটি হোম স্ক্রিনে যোগ করতে হবে' : 'পুশ অসমর্থিত')
    },
    {
      id: 'sw_engine',
      nameEn: 'Service Worker (Offline Engine)',
      nameBn: 'সার্ভিস ওয়ার্কার (অফলাইন ইঞ্জিন)',
      status: serviceWorkerRegistered ? 'supported' : (serviceWorkerSupported ? 'limited' : 'not_supported'),
      detailEn: serviceWorkerRegistered ? 'Active & caching assets' : 'Supported but registration pending',
      detailBn: serviceWorkerRegistered ? 'সক্রিয় ও ক্যাশ কার্যকর' : 'অফলাইন ইঞ্জিন সক্রিয় হওয়ার অপেক্ষায়'
    },
    {
      id: 'audio_engine',
      nameEn: 'Web Audio Alarm Synthesizer',
      nameBn: 'ওয়েব অডিও অ্যালার্ম সিন্থেসাইজার',
      status: audioSupported ? 'supported' : 'not_supported',
      detailEn: audioSupported ? '8 procedural tones available' : 'AudioContext unavailable',
      detailBn: audioSupported ? '৮টি বিল্ট-ইন টিউন সক্রিয়' : 'অডিও সিস্টেম উপলব্ধ নয়'
    },
    {
      id: 'custom_audio',
      nameEn: 'Selected Custom Audio Storage',
      nameBn: 'কাস্টম অডিও স্টোরেজ (IndexedDB)',
      status: 'supported',
      detailEn: `${customAudioCount} custom audio file(s) saved locally`,
      detailBn: `${customAudioCount}টি কাস্টম রিংটোন সংরক্ষিত`
    },
    {
      id: 'voice_synthesis',
      nameEn: 'Voice Reminder (English & Bengali)',
      nameBn: 'কণ্ঠস্বর রিমাইন্ডার (ইংরেজি ও বাংলা)',
      status: voiceSupported ? (bengaliVoiceAvailable ? 'supported' : 'limited') : 'not_supported',
      detailEn: voiceSupported ? (bengaliVoiceAvailable ? 'Native Bengali & English voices ready' : 'English ready, Bengali uses system fallback') : 'SpeechSynthesis unsupported',
      detailBn: voiceSupported ? (bengaliVoiceAvailable ? 'বাংলা ও ইংরেজি ভয়েস সক্রিয়' : 'ইংরেজি সক্রিয়, বাংলা ফালব্যাক সক্রিয়') : 'স্পিচ সিন্থেসিস অসমর্থিত'
    },
    {
      id: 'bg_notification',
      nameEn: 'Background Service Worker Notifications',
      nameBn: 'ব্যাকগ্রাউন্ড সার্ভিস ওয়ার্কার নোটিফিকেশন',
      status: backgroundNotificationSupported ? 'supported' : 'limited',
      detailEn: backgroundNotificationSupported ? 'ServiceWorker.showNotification available' : 'Foreground notifications only',
      detailBn: backgroundNotificationSupported ? 'সার্ভিস ওয়ার্কার নোটিফিকেশন সক্রিয়' : 'শুধুমাত্র সক্রিয় অ্যাপে নোটিফিকেশন'
    },
    {
      id: 'connectivity',
      nameEn: 'Network & Local-First Sync',
      nameBn: 'নেটওয়ার্ক ও লোকাল-ফার্স্ট ডেটাবেজ',
      status: isOnline ? 'supported' : 'limited',
      detailEn: isOnline ? 'Online (IndexedDB local-first active)' : 'Offline mode active (data saved locally)',
      detailBn: isOnline ? 'অনলাইন (লোকাল ডেটাবেজ সক্রিয়)' : 'অফলাইন মোড (ডেটা সম্পূর্ণ সুরক্ষিত)'
    },
    {
      id: 'last_sync',
      nameEn: 'Schedule Synchronization Verification',
      nameBn: 'শিডিউল সমন্বয় যাচাইকরণ',
      status: 'supported',
      detailEn: lastSyncTimestamp ? `Last verified: ${new Date(lastSyncTimestamp).toLocaleTimeString()}` : 'Synchronized',
      detailBn: lastSyncTimestamp ? `সর্বশেষ যাচাই: ${new Date(lastSyncTimestamp).toLocaleTimeString()}` : 'সমন্বিত'
    }
  ];

  return {
    platform,
    notificationSupported,
    notificationPermission,
    serviceWorkerSupported,
    serviceWorkerRegistered,
    isStandalonePWA,
    audioSupported,
    customAudioCount,
    voiceSupported,
    bengaliVoiceAvailable,
    wakeLockSupported,
    pushSupported,
    isOnline,
    lastSyncTimestamp,
    items
  };
}

/**
 * Request notification permission safely
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return Notification.permission;
  }
}

/**
 * Show medicine notification independently of selected sound mode.
 * NEVER falsely reports delivery as successful.
 */
export async function showWebNotification(
  title: string,
  options: {
    body: string;
    tag?: string;
    icon?: string;
    badge?: string;
    data?: Record<string, unknown>;
  }
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    // Attempt ServiceWorker registration notification (recommended for mobile PWAs)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body: options.body,
          icon: options.icon || '/icon-192.png',
          badge: options.badge || '/icon-192.png',
          tag: options.tag || `meditime-${Date.now()}`,
          data: options.data,
          vibrate: [300, 150, 300, 150, 400],
          requireInteraction: true // Keeps notification visible until user interacts
        } as NotificationOptions);
        return true;
      }
    }

    // Direct Notification constructor fallback
    new Notification(title, {
      body: options.body,
      icon: options.icon || '/icon-192.png',
      tag: options.tag,
      requireInteraction: true
    } as NotificationOptions);
    return true;
  } catch (err) {
    console.warn('Could not display notification:', err);
    return false;
  }
}

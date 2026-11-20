/**
 * Web Notifications, Push Architecture & Compatibility Diagnostics
 */

export interface CompatibilityReport {
  notificationSupported: boolean;
  notificationPermission: NotificationPermission;
  serviceWorkerSupported: boolean;
  serviceWorkerRegistered: boolean;
  isStandalonePWA: boolean;
  audioSupported: boolean;
  wakeLockSupported: boolean;
  pushSupported: boolean;
  isOnline: boolean;
}

/**
 * Check device and browser capabilities
 */
export async function runCompatibilityDiagnostics(): Promise<CompatibilityReport> {
  const isClient = typeof window !== 'undefined';
  if (!isClient) {
    return {
      notificationSupported: false,
      notificationPermission: 'default',
      serviceWorkerSupported: false,
      serviceWorkerRegistered: false,
      isStandalonePWA: false,
      audioSupported: false,
      wakeLockSupported: false,
      pushSupported: false,
      isOnline: false
    };
  }

  const notificationSupported = 'Notification' in window;
  const notificationPermission: NotificationPermission = notificationSupported ? Notification.permission : 'denied';
  const serviceWorkerSupported = 'serviceWorker' in navigator;
  
  let serviceWorkerRegistered = false;
  if (serviceWorkerSupported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      serviceWorkerRegistered = !!reg?.active;
    } catch {
      serviceWorkerRegistered = false;
    }
  }

  // PWA standalone check
  const isStandalonePWA = 
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://');

  const audioSupported = 'AudioContext' in window || 'webkitAudioContext' in window;
  const wakeLockSupported = 'wakeLock' in navigator;
  const pushSupported = 'PushManager' in window;
  const isOnline = navigator.onLine;

  return {
    notificationSupported,
    notificationPermission,
    serviceWorkerSupported,
    serviceWorkerRegistered,
    isStandalonePWA,
    audioSupported,
    wakeLockSupported,
    pushSupported,
    isOnline
  };
}

/**
 * Request Notification Permission from user
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
 * Display a Web Notification (via ServiceWorker if available, or Notification API)
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
    // Attempt ServiceWorker registration notification for mobile PWA support
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body: options.body,
          icon: options.icon || '/icon-192.png',
          badge: options.badge || '/icon-192.png',
          tag: options.tag || 'meditime-reminder',
          data: options.data,
          vibrate: [200, 100, 200]
        } as NotificationOptions);
        return true;
      }
    }

    // Direct Notification fallback
    new Notification(title, {
      body: options.body,
      icon: options.icon || '/icon-192.png',
      tag: options.tag
    });
    return true;
  } catch (err) {
    console.warn('Could not display notification:', err);
    return false;
  }
}

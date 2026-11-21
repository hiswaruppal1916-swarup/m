/**
 * Universal Web Audio Synthesizer & Custom Audio Player
 * Supports:
 * - 8 Built-in procedural alarm tones (100% offline, zero asset dependencies)
 * - Custom audio Blob playback with persistent HTMLAudioElement looping
 * - Unthrottled continuous looping until user dismissal
 * - Safari/iOS and Android autoplay unlock
 * - Previews and celebratory chimes
 */

import type { BuiltInAlarmTone } from '../types';

let audioCtx: AudioContext | null = null;
let currentLoopInterval: any = null;
let customAudioEl: HTMLAudioElement | null = null;
let customAudioUrl: string | null = null;
let previewTimeout: any = null;
let isPlaying = false;

export const BUILT_IN_TONES: { id: BuiltInAlarmTone; nameEn: string; nameBn: string; category: string }[] = [
  { id: 'gentle_chime', nameEn: 'Gentle Chime', nameBn: 'শান্ত সুর (Gentle)', category: 'Gentle' },
  { id: 'classic_alarm', nameEn: 'Classic Clock Alarm', nameBn: 'চিরায়ত বেল অ্যালার্ম', category: 'Classic' },
  { id: 'digital_alarm', nameEn: 'Digital Watch Alarm', nameBn: 'ডিজিটাল বিপ অ্যালার্ম', category: 'Digital' },
  { id: 'bell_alarm', nameEn: 'Bell Alarm', nameBn: 'মন্দির ঘণ্টার সুর', category: 'Bell' },
  { id: 'loud_alarm', nameEn: 'Loud Urgent Alert', nameBn: 'উচ্চ সতর্কবার্তা অ্যালার্ম', category: 'Loud' },
  { id: 'soft_reminder', nameEn: 'Soft Reminder', nameBn: 'কোমল স্মরণকারী সুর', category: 'Soft' },
  { id: 'morning_alarm', nameEn: 'Morning Sunrise Chime', nameBn: 'ভোরের স্নিগ্ধ সুর', category: 'Morning' },
  { id: 'traditional_alarm', nameEn: 'Traditional Phone Buzzer', nameBn: 'ঐতিহ্যবাহী বজার', category: 'Traditional' },
];

/**
 * Get or initialize Web Audio Context with user-gesture unlocking
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Procedural synthesizers for built-in alarm tones
 */
function playTonePattern(tone: BuiltInAlarmTone | string, volume: number = 0.8): number {
  const ctx = getAudioContext();
  if (!ctx) return 2000;

  const now = ctx.currentTime;
  const safeVol = Math.max(0.01, Math.min(1.0, volume));

  switch (tone) {
    case 'classic_alarm': {
      // Rapid alternating mechanical bells (A5 880Hz & C#6 1108Hz)
      const pulseCount = 8;
      const pulseDuration = 0.08;
      for (let i = 0; i < pulseCount; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + i * (pulseDuration + 0.03);
        const freq = i % 2 === 0 ? 880 : 1108;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(safeVol * 0.7, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + pulseDuration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + pulseDuration);
      }
      return 1500;
    }

    case 'digital_alarm': {
      // Classic digital watch beep-beep, beep-beep (2048Hz square wave)
      const beeps = [0, 0.12, 0.35, 0.47];
      beeps.forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + offset;
        osc.type = 'square';
        osc.frequency.setValueAtTime(2048, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(safeVol * 0.4, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.08);
      });
      return 1200;
    }

    case 'bell_alarm': {
      // Resonating tubular bell / chime with metallic harmonics
      const freqs = [523.25, 1046.5, 1567.98, 2093.0];
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(safeVol * 0.7, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      gain.connect(ctx.destination);

      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 1.8 - idx * 0.2);
      });
      return 2000;
    }

    case 'loud_alarm': {
      // Urgent high-visibility siren modulation
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.linearRampToValueAtTime(1400, now + 0.3);
      osc.frequency.linearRampToValueAtTime(700, now + 0.6);
      osc.frequency.linearRampToValueAtTime(1400, now + 0.9);
      osc.frequency.linearRampToValueAtTime(700, now + 1.2);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(safeVol * 0.5, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.3);
      return 1500;
    }

    case 'soft_reminder': {
      // Gentle ambient kalimba / marimba double tap (A4 440Hz, E5 659Hz)
      [440, 659.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + i * 0.22;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(safeVol * 0.6, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.8);
      });
      return 1800;
    }

    case 'morning_alarm': {
      // Uplifting 4-note ascending melody (C5, E5, G5, B5)
      const notes = [523.25, 659.25, 783.99, 987.77];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.16;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(safeVol * 0.6, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.5);
      });
      return 1600;
    }

    case 'traditional_alarm': {
      // Rhythmic telephone dual-frequency warble (440Hz + 480Hz)
      const pulseDuration = 0.15;
      for (let i = 0; i < 4; i++) {
        const start = now + i * 0.22;
        [440, 480].forEach(f => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(f, start);

          gain.gain.setValueAtTime(0.001, start);
          gain.gain.exponentialRampToValueAtTime(safeVol * 0.3, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, start + pulseDuration);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + pulseDuration);
        });
      }
      return 1400;
    }

    case 'gentle_chime':
    default: {
      // Soothing harmonic medical chime (F#5, A#5, C#6)
      const freqs = [739.99, 932.33, 1108.73];
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.exponentialRampToValueAtTime(safeVol * 0.6, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      gainNode.connect(ctx.destination);

      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.12);
        osc.connect(gainNode);
        osc.start(now + idx * 0.12);
        osc.stop(now + 1.4);
      });
      return 1800;
    }
  }
}

/**
 * Trigger physical haptic vibration if supported
 */
export function triggerHaptic(pattern: number[] = [300, 150, 300, 150, 400]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignored if blocked by browser policy
    }
  }
}

/**
 * Start continuous looping alarm audio.
 * Does NOT stop automatically after 1 or 2 seconds.
 * Plays until explicitly stopped via stopAlarmAudio().
 */
export function startAlarmAudio(
  tone: BuiltInAlarmTone | string,
  volume: number = 0.8,
  customBlob?: Blob
): void {
  stopAlarmAudio();
  isPlaying = true;

  if (customBlob) {
    // Play custom uploaded audio file in continuous loop
    try {
      customAudioUrl = URL.createObjectURL(customBlob);
      customAudioEl = new Audio(customAudioUrl);
      customAudioEl.loop = true;
      customAudioEl.volume = Math.max(0.1, Math.min(1.0, volume));
      customAudioEl.play().catch(err => {
        console.warn('Custom audio playback blocked or failed, falling back to gentle chime:', err);
        startProceduralLoop('gentle_chime', volume);
      });
      triggerHaptic();
      return;
    } catch (err) {
      console.warn('Error creating custom audio URL:', err);
    }
  }

  // Play procedural built-in tone in continuous loop
  startProceduralLoop(tone, volume);
}

function startProceduralLoop(tone: BuiltInAlarmTone | string, volume: number): void {
  const periodMs = playTonePattern(tone, volume);
  triggerHaptic();

  currentLoopInterval = setInterval(() => {
    if (!isPlaying) {
      if (currentLoopInterval) clearInterval(currentLoopInterval);
      return;
    }
    playTonePattern(tone, volume);
    triggerHaptic([200, 100, 200]);
  }, periodMs);
}

/**
 * Stop alarm audio immediately
 */
export function stopAlarmAudio(): void {
  isPlaying = false;
  if (currentLoopInterval) {
    clearInterval(currentLoopInterval);
    currentLoopInterval = null;
  }
  if (previewTimeout) {
    clearTimeout(previewTimeout);
    previewTimeout = null;
  }
  if (customAudioEl) {
    try {
      customAudioEl.pause();
      customAudioEl.currentTime = 0;
    } catch {}
    customAudioEl = null;
  }
  if (customAudioUrl) {
    try {
      URL.revokeObjectURL(customAudioUrl);
    } catch {}
    customAudioUrl = null;
  }
}

/**
 * Preview sound for sound selection page (runs for 4 seconds then stops automatically)
 */
export function startSoundPreview(
  tone: BuiltInAlarmTone | string,
  volume: number = 0.8,
  customBlob?: Blob
): void {
  stopAlarmAudio();
  startAlarmAudio(tone, volume, customBlob);
  previewTimeout = setTimeout(() => {
    stopAlarmAudio();
  }, 4500);
}

/**
 * Stop any preview sound
 */
export function stopSoundPreview(): void {
  stopAlarmAudio();
}

/**
 * Returns whether alarm audio is actively playing
 */
export function isAlarmAudioPlaying(): boolean {
  return isPlaying;
}

/**
 * Play celebratory completion chime (for "TAKEN" or "MEAL FINISHED")
 */
export function playSuccessChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });

    triggerHaptic([80, 50, 100]);
  } catch (err) {
    console.warn('Success sound error:', err);
  }
}

/**
 * Backward compatibility alias for single chime trigger
 */
export function playAlarmSound(type: string = 'gentle_chime', volume: number = 0.8): void {
  playTonePattern(type, volume);
}

/**
 * Universal Web Audio Synthesizer & Professional Loud Alarm Engine
 * Features:
 * - 22 Professional, loud, attention-grabbing alarm tones across 4 smartphone categories
 * - Master DynamicsCompressor / Limiter node for loud, punchy, distortion-free audio
 * - Procedural synthesis (100% offline, zero network dependencies)
 * - Custom audio Blob playback with persistent HTMLAudioElement looping
 * - Unthrottled continuous looping until user dismissal
 * - Dedicated preview controllers and celebration chimes
 */

import type { BuiltInAlarmTone, AlarmToneItem } from '../types';

let audioCtx: AudioContext | null = null;
let currentLoopInterval: any = null;
let customAudioEl: HTMLAudioElement | null = null;
let customAudioUrl: string | null = null;
let previewTimeout: any = null;
let isPlaying = false;

export const ALARM_TONE_CATALOG: AlarmToneItem[] = [
  // Category 1 — Classic Phone Alarms
  {
    id: 'classic_repeating_alarm',
    category: 'classic_phone',
    nameEn: 'Classic Repeating Alarm',
    nameBn: 'চিরায়ত রিপিটিং অ্যালার্ম',
    descriptionEn: 'High-energy alternating double bell pulses',
    descriptionBn: 'উচ্চ শক্তিসম্পন্ন দ্বৈত বেলের অবিরাম সুর',
  },
  {
    id: 'traditional_digital_alarm',
    category: 'classic_phone',
    nameEn: 'Traditional Digital Alarm',
    nameBn: 'ঐতিহ্যবাহী ডিজিটাল অ্যালার্ম',
    descriptionEn: 'Crisp digital watch dual-chirp sequence',
    descriptionBn: 'ঘড়ির পরিচিত তীক্ষ্ণ ডিজিটাল বিপ সুর',
  },
  {
    id: 'old_telephone_ring',
    category: 'classic_phone',
    nameEn: 'Old Telephone Ring',
    nameBn: 'পুরোনো টেলিফোনের রিং',
    descriptionEn: 'Vintage dual-frequency electromagnetic bell',
    descriptionBn: 'ভিন্টেজ ল্যান্ডলাইন ফোনের ঘণ্টা',
  },
  {
    id: 'repeating_clock_alarm',
    category: 'classic_phone',
    nameEn: 'Repeating Clock Alarm',
    nameBn: 'ঘড়ির অবিরাম অ্যালার্ম',
    descriptionEn: 'Rapid alternating mechanical clock hammer',
    descriptionBn: 'যান্ত্রিক অ্যালার্ম ঘড়ির দ্রুত সুর',
  },
  {
    id: 'classic_bell_alarm',
    category: 'classic_phone',
    nameEn: 'Classic Bell Alarm',
    nameBn: 'ক্লাসিক বেল অ্যালার্ম',
    descriptionEn: 'Resonating brass bell with natural decay',
    descriptionBn: 'পিতলের বেলের গম্ভীর ও দীর্ঘ সুর',
  },
  {
    id: 'double_bell_alarm',
    category: 'classic_phone',
    nameEn: 'Double Bell Alarm',
    nameBn: 'ডাবল বেল অ্যালার্ম',
    descriptionEn: 'Twin bell alternating strikes with bright harmonics',
    descriptionBn: 'জোড়া বেলের চমৎকার ছন্দোবদ্ধ সুর',
  },

  // Category 2 — Loud Attention Alarms
  {
    id: 'urgent_digital_beep',
    category: 'loud_attention',
    nameEn: 'Urgent Digital Beep',
    nameBn: 'জরুরি ডিজিটাল বিপ',
    descriptionEn: 'High-pitch piercing triple chirp for maximum attention',
    descriptionBn: 'অতি উচ্চ কম্পাঙ্কের তীক্ষ্ণ সংকেত',
  },
  {
    id: 'rapid_repeating_beep',
    category: 'loud_attention',
    nameEn: 'Rapid Repeating Beep',
    nameBn: 'দ্রুত পুনরাবৃত্তিমূলক বিপ',
    descriptionEn: 'Four rapid high-frequency staccato pulses',
    descriptionBn: 'চারটি দ্রুত স্ট্যাকাটো বিপের সিরিজ',
  },
  {
    id: 'loud_electronic_alarm',
    category: 'loud_attention',
    nameEn: 'Loud Electronic Alarm',
    nameBn: 'উচ্চ ইলেকট্রনিক অ্যালার্ম',
    descriptionEn: 'High-intensity dual-tone frequency modulation',
    descriptionBn: 'তীব্র ইলেকট্রনিক সাইরেন সুর',
  },
  {
    id: 'repeating_warning_tone',
    category: 'loud_attention',
    nameEn: 'Repeating Warning Tone',
    nameBn: 'সতর্কতামূলক বিপ সংকেত',
    descriptionEn: 'Alternating high-low attention horn',
    descriptionBn: 'দ্বৈত মাত্রার সতর্কতামূলক হর্ন',
  },
  {
    id: 'high_attention_alarm',
    category: 'loud_attention',
    nameEn: 'High Attention Alarm',
    nameBn: 'তীব্র মনোযোগ আকর্ষণকারী সুর',
    descriptionEn: 'Ascending staccato triad with rapid repeat',
    descriptionBn: 'আরোহী ত্রি-স্বর বিশিষ্ট গভীর সুর',
  },
  {
    id: 'persistent_wakeup_alarm',
    category: 'loud_attention',
    nameEn: 'Persistent Wake-Up Alarm',
    nameBn: 'ঘুম ভাঙানোর অবিরাম অ্যালার্ম',
    descriptionEn: 'Stepped frequency alert designed for deep sleepers',
    descriptionBn: 'গভীর ঘুম থেকে জাগানোর উপযোগী জোরালো সুর',
  },

  // Category 3 — Mechanical and Bell Alarms
  {
    id: 'mechanical_clock_bell',
    category: 'mechanical_bell',
    nameEn: 'Mechanical Clock Bell',
    nameBn: 'যান্ত্রিক ক্লক বেল',
    descriptionEn: 'Warm chiming carriage clock bell with long sustain',
    descriptionBn: 'প্রাচীন মেকানিকাল ঘড়ির ঘণ্টার সুর',
  },
  {
    id: 'double_metal_bell',
    category: 'mechanical_bell',
    nameEn: 'Double Metal Bell',
    nameBn: 'ডাবল মেটাল বেল',
    descriptionEn: 'Dual metallic strikes with harmonic depth',
    descriptionBn: 'ধাতব ঘণ্টার অনুরণনশীল সুর',
  },
  {
    id: 'repeating_metal_ring',
    category: 'mechanical_bell',
    nameEn: 'Repeating Metal Ring',
    nameBn: 'অবিরাম ধাতব রিং',
    descriptionEn: 'Fast metallic chime pulse train',
    descriptionBn: 'ধাতব পাত্রের ছন্দোবদ্ধ দ্রুত রিং',
  },
  {
    id: 'traditional_clock_ring',
    category: 'mechanical_bell',
    nameEn: 'Traditional Clock Ring',
    nameBn: 'ঐতিহ্যবাহী টেবিল ঘড়ির রিং',
    descriptionEn: 'Classic wind-up desk alarm bell mechanism',
    descriptionBn: 'দম দেওয়া টেবিল অ্যালার্ম ঘড়ির সুর',
  },
  {
    id: 'loud_school_bell',
    category: 'mechanical_bell',
    nameEn: 'Loud School Bell',
    nameBn: 'উচ্চ বিদ্যালয় ঘণ্টা',
    descriptionEn: 'Rapid electric tremolo hammer bell',
    descriptionBn: 'বৈদ্যুতিক ঘণ্টার উচ্চ গতির ঝাঁকুনি সুর',
  },

  // Category 4 — Modern Smartphone Alarms
  {
    id: 'digital_wakeup',
    category: 'modern_smartphone',
    nameEn: 'Digital Wake-Up',
    nameBn: 'ডিজিটাল ওয়েক-আপ',
    descriptionEn: 'Modern rising melodic arpeggio with crisp synth',
    descriptionBn: 'আধুনিক স্মার্টফোনের মিষ্টি আরোহী সুর',
  },
  {
    id: 'repeating_pulse_alarm',
    category: 'modern_smartphone',
    nameEn: 'Repeating Pulse Alarm',
    nameBn: 'পালস অ্যালার্ম',
    descriptionEn: 'Contemporary electronic pulse rhythm',
    descriptionBn: 'আধুনিক রিদমিক ইলেকট্রনিক পালস',
  },
  {
    id: 'sharp_electronic_ring',
    category: 'modern_smartphone',
    nameEn: 'Sharp Electronic Ring',
    nameBn: 'তীক্ষ্ণ ইলেকট্রনিক রিং',
    descriptionEn: 'Cutting-edge clean 3000Hz phone ring',
    descriptionBn: 'পরিষ্কার ৩০০০ হার্জের স্মার্টফোন রিং',
  },
  {
    id: 'fast_repeating_tone',
    category: 'modern_smartphone',
    nameEn: 'Fast Repeating Tone',
    nameBn: 'দ্রুত ট্রিপল সুর',
    descriptionEn: 'Modern triple acoustic synthesizer chime',
    descriptionBn: 'ট্রিপল অ্যাকোস্টিক চিমে সংকেত',
  },
  {
    id: 'multilayer_digital_alarm',
    category: 'modern_smartphone',
    nameEn: 'Multi-Layer Digital Alarm',
    nameBn: 'বহুমাত্রিক ডিজিটাল অ্যালার্ম',
    descriptionEn: 'Polyphonic chord alarm with sparkling harmonics',
    descriptionBn: 'পলিসিন্থ সুরের চমৎকার বহুমাত্রিক অ্যালার্ম',
  },
];

// Backward-compatible alias map
export const BUILT_IN_TONES = ALARM_TONE_CATALOG;

/**
 * Get or initialize Web Audio Context with DynamicsCompressor mastering
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
 * Create a mastered compressor node to ensure loud, punchy, distortion-free audio
 */
function createMasterOutput(ctx: AudioContext, volume: number): GainNode {
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-16, ctx.currentTime);
  compressor.knee.setValueAtTime(6, ctx.currentTime);
  compressor.ratio.setValueAtTime(12, ctx.currentTime);
  compressor.attack.setValueAtTime(0.003, ctx.currentTime);
  compressor.release.setValueAtTime(0.12, ctx.currentTime);
  compressor.connect(ctx.destination);

  const masterGain = ctx.createGain();
  const safeVol = Math.max(0.1, Math.min(1.0, volume));
  masterGain.gain.setValueAtTime(safeVol, ctx.currentTime);
  masterGain.connect(compressor);

  return masterGain;
}

/**
 * Map legacy aliases to canonical tone IDs
 */
function normalizeToneId(id: string): string {
  switch (id) {
    case 'gentle_chime':
      return 'classic_bell_alarm';
    case 'classic_alarm':
      return 'classic_repeating_alarm';
    case 'digital_alarm':
      return 'traditional_digital_alarm';
    case 'bell_alarm':
      return 'double_bell_alarm';
    case 'loud_alarm':
    case 'medical_beep':
      return 'urgent_digital_beep';
    case 'soft_reminder':
    case 'morning_alarm':
    case 'zen_bell':
      return 'digital_wakeup';
    case 'traditional_alarm':
      return 'old_telephone_ring';
    default:
      return id;
  }
}

/**
 * Procedural synthesis engine for all 22 alarm sounds
 * Returns the recommended repeat interval in milliseconds
 */
function playTonePattern(rawTone: BuiltInAlarmTone | string, volume: number = 0.8): number {
  const ctx = getAudioContext();
  if (!ctx) return 1500;

  const tone = normalizeToneId(rawTone);
  const now = ctx.currentTime;
  const master = createMasterOutput(ctx, volume);

  switch (tone) {
    // ----------------------------------------------------
    // Category 1 — Classic Phone Alarms
    // ----------------------------------------------------
    case 'classic_repeating_alarm': {
      // Rapid alternating mechanical bell (800Hz / 1060Hz, 8 sharp pulses)
      const pulseCount = 8;
      const pulseDuration = 0.07;
      for (let i = 0; i < pulseCount; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + i * (pulseDuration + 0.035);
        const freq = i % 2 === 0 ? 800 : 1060;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.85, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, start + pulseDuration);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + pulseDuration);
      }
      return 1300;
    }

    case 'traditional_digital_alarm': {
      // Classic Casio/Seiko digital watch dual-chirp (2048Hz / 2500Hz)
      const offsets = [0, 0.1, 0.3, 0.4];
      offsets.forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + offset;
        osc.type = 'square';
        osc.frequency.setValueAtTime(2150, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.5, start + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.07);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.07);
      });
      return 1100;
    }

    case 'old_telephone_ring': {
      // Dual-frequency mechanical telephone warble (440Hz + 480Hz modulated with 20Hz bell clapper)
      const duration = 0.8;
      [440, 480].forEach(f => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now);

        // Clapper tremolo modulation
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        mod.frequency.setValueAtTime(20, now);
        modGain.gain.setValueAtTime(0.3, now);
        mod.connect(modGain.gain);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.45, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + duration);
        mod.start(now);
        mod.stop(now + duration);
      });
      return 1600;
    }

    case 'repeating_clock_alarm': {
      // Rhythmic mechanical alarm clock tick-strike (880Hz / 1175Hz)
      for (let i = 0; i < 6; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + i * 0.12;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 1175, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.8, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.08);
      }
      return 1200;
    }

    case 'classic_bell_alarm': {
      // Resonating brass bell with 4 musical harmonics (660Hz, 1320Hz, 1980Hz, 2640Hz)
      const harmonics = [660, 1320, 1980, 2640];
      harmonics.forEach((h, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(h, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.7 / (idx + 1), now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6 - idx * 0.2);

        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 1.6);
      });
      return 1800;
    }

    case 'double_bell_alarm': {
      // Two alternating bell strikes (700Hz and 950Hz)
      [0, 0.25].forEach((offset, idx) => {
        const freq = idx === 0 ? 700 : 950;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + offset;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.85, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.9);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.9);
      });
      return 1500;
    }

    // ----------------------------------------------------
    // Category 2 — Loud Attention Alarms
    // ----------------------------------------------------
    case 'urgent_digital_beep': {
      // High-pitch 2800Hz piercing triple beep
      [0, 0.08, 0.16].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + offset;
        osc.type = 'square';
        osc.frequency.setValueAtTime(2800, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.6, start + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.055);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.055);
      });
      return 900;
    }

    case 'rapid_repeating_beep': {
      // Fast 4-pulse 1800Hz staccato pattern
      [0, 0.1, 0.2, 0.3].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + offset;
        osc.type = 'square';
        osc.frequency.setValueAtTime(1800, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.55, start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.065);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.065);
      });
      return 1000;
    }

    case 'loud_electronic_alarm': {
      // Frequency-swept siren alarm (800Hz -> 1600Hz -> 800Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1600, now + 0.25);
      osc.frequency.linearRampToValueAtTime(800, now + 0.5);
      osc.frequency.linearRampToValueAtTime(1600, now + 0.75);
      osc.frequency.linearRampToValueAtTime(800, now + 1.0);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.6, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 1.1);
      return 1400;
    }

    case 'repeating_warning_tone': {
      // Alternating high-low attention horn (660Hz / 880Hz)
      [0, 0.25, 0.5, 0.75].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + offset;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(idx % 2 === 0 ? 880 : 660, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.5, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.18);
      });
      return 1400;
    }

    case 'high_attention_alarm': {
      // Piercing staccato triad (1400Hz, 1800Hz, 2200Hz)
      [1400, 1800, 2200].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.1;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.7, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.08);
      });
      return 1100;
    }

    case 'persistent_wakeup_alarm': {
      // Stepped frequency pulse train with high penetration
      [1000, 1250, 1500, 2000].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.12;
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.5, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.09);
      });
      return 1300;
    }

    // ----------------------------------------------------
    // Category 3 — Mechanical and Bell Alarms
    // ----------------------------------------------------
    case 'mechanical_clock_bell': {
      // Carriage clock bell strike with rich acoustic resonance (523Hz + 1046Hz + 1568Hz)
      [523.25, 1046.5, 1568].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.7 / (idx + 1), now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 1.4);
      });
      return 1700;
    }

    case 'double_metal_bell': {
      // Dual metal bar strikes
      [0, 0.18].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + offset;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(idx === 0 ? 830 : 1100, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.8, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.7);
      });
      return 1400;
    }

    case 'repeating_metal_ring': {
      // Fast repeating metal gong strikes
      for (let i = 0; i < 5; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + i * 0.12;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(920, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.75, start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.1);
      }
      return 1200;
    }

    case 'traditional_clock_ring': {
      // Mechanical desk alarm clock wind-up buzzer
      for (let i = 0; i < 8; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + i * 0.08;
        osc.type = 'square';
        osc.frequency.setValueAtTime(i % 2 === 0 ? 740 : 980, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.4, start + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.065);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.065);
      }
      return 1300;
    }

    case 'loud_school_bell': {
      // Electric tremolo striker bell (1200Hz modulated with 18Hz tremolo)
      const duration = 0.9;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);

      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      mod.frequency.setValueAtTime(18, now);
      modGain.gain.setValueAtTime(0.35, now);
      mod.connect(modGain.gain);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.85, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + duration);
      mod.start(now);
      mod.stop(now + duration);
      return 1500;
    }

    // ----------------------------------------------------
    // Category 4 — Modern Smartphone Alarms
    // ----------------------------------------------------
    case 'digital_wakeup': {
      // Modern rising melodic arpeggio (C5, E5, G5, B5, C6)
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.12;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.7, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.4);
      });
      return 1500;
    }

    case 'repeating_pulse_alarm': {
      // Contemporary smartphone electronic pulse with body (587Hz & 1174Hz)
      [0, 0.2, 0.4].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + offset;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.75, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.15);
      });
      return 1100;
    }

    case 'sharp_electronic_ring': {
      // Crisp 3000Hz modern electronic ring
      [0, 0.1, 0.2].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + offset;
        osc.type = 'square';
        osc.frequency.setValueAtTime(3000, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.45, start + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.07);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.07);
      });
      return 1000;
    }

    case 'fast_repeating_tone': {
      // Triple acoustic synthesizer chime
      [1046.5, 1318.5, 1568].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.09;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.7, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.25);
      });
      return 1100;
    }

    case 'multilayer_digital_alarm':
    default: {
      // Polyphonic major 7th chord chime with sparkle (F5, A5, C6, E6)
      const freqs = [698.46, 880, 1046.5, 1318.5];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.08;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.65, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.7);
      });
      return 1500;
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
    } catch {}
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
        console.warn('Custom audio playback blocked, falling back to loud alarm:', err);
        startProceduralLoop('classic_repeating_alarm', volume);
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
 * Preview sound for sound selection page (plays for 4.5 seconds then stops automatically)
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
      gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });

    triggerHaptic([80, 50, 100]);
  } catch (err) {
    console.warn('Success sound error:', err);
  }
}

/**
 * Backward compatibility alias for single chime trigger
 */
export function playAlarmSound(type: string = 'classic_repeating_alarm', volume: number = 0.8): void {
  playTonePattern(type, volume);
}

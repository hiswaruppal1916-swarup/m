/**
 * Web Audio API procedural sound synthesizer.
 * Operates offline with zero external audio assets needed.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a gentle harmonic medical chime
 */
export function playGentleChime(volume: number = 0.8): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.01, volume * 0.6), now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    gainNode.connect(ctx.destination);

    // Chime frequencies: F#5 (739.99 Hz) and A#5 (932.33 Hz)
    const freqs = [739.99, 932.33, 1108.73];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.12);
      osc.connect(gainNode);
      osc.start(now + idx * 0.12);
      osc.stop(now + 1.2);
    });

    // Trigger haptic vibration if supported
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch {
        // Ignored if blocked
      }
    }
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}

/**
 * Play an urgent recurring medical alarm chime sequence
 */
export function playUrgentAlarm(volume: number = 0.9): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [880, 1046.5, 880, 1318.5]; // A5, C6, A5, E6
    
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.18;
      const endTime = startTime + 0.14;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume * 0.8), startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, endTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(endTime);
    });

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([300, 150, 300, 150, 400]);
      } catch {
        // Ignored
      }
    }
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}

/**
 * Play a cheerful completion chime (for "TAKEN" or "MEAL FINISHED")
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
      gain.gain.exponentialRampToValueAtTime(0.4, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(100);
      } catch {
        // Ignored
      }
    }
  } catch (err) {
    console.warn('Success sound error:', err);
  }
}

/**
 * Play selected alarm sound type
 */
export function playAlarmSound(type: 'gentle_chime' | 'medical_beep' | 'zen_bell', volume: number = 0.8): void {
  if (type === 'medical_beep') {
    playUrgentAlarm(volume);
  } else {
    playGentleChime(volume);
  }
}

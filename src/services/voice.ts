/**
 * Multilingual Voice Assistance Service
 * Supports English and Bengali voice announcements using Web Speech API
 * Includes graceful Bengali voice fallback, speech rates, and voice selection
 */

export interface VoiceAnnouncementOptions {
  medicineName?: string;
  dosage?: string;
  mealName?: string;
  language?: 'en' | 'bn';
  voiceURI?: string;
  rate?: number;
  type?: 'due' | 'meal_reminder' | 'next_soon' | 'completed';
}

class VoiceService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private isLoaded = false;
  private voiceLoopInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices(): void {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    this.isLoaded = this.voices.length > 0;
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    if (this.voices.length === 0) {
      this.voices = this.synth.getVoices();
    }
    return this.voices;
  }

  public hasLoaded(): boolean {
    return this.isLoaded;
  }

  public isSupported(): boolean {
    return !!this.synth;
  }

  public hasBengaliVoice(): boolean {
    const list = this.getAvailableVoices();
    return list.some(v => v.lang.toLowerCase().startsWith('bn'));
  }

  /**
   * Stop any ongoing speech and looping intervals
   */
  public stop(): void {
    if (this.voiceLoopInterval) {
      clearInterval(this.voiceLoopInterval);
      this.voiceLoopInterval = null;
    }
    if (this.synth && (this.synth.speaking || this.synth.pending)) {
      this.synth.cancel();
    }
  }

  /**
   * Speak a message with English or Bengali support
   */
  public speak(options: VoiceAnnouncementOptions): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        resolve();
        return;
      }

      this.stop(); // Stop previous utterance

      const lang = options.language || 'en';
      const rate = options.rate || 1.0;
      let text = '';

      if (lang === 'bn') {
        // Bengali phrase generation
        if (options.type === 'next_soon') {
          text = 'আপনার পরবর্তী ওষুধের সময় কাছাকাছি।';
        } else if (options.type === 'meal_reminder') {
          text = 'আপনি কি খাবার খেয়েছেন? খাবার পর আপনার ওষুধ খেতে ভুলবেন না।';
        } else if (options.type === 'completed') {
          text = 'ধন্যবাদ। ওষুধ গ্রহণের তথ্য সফলভাবে সংরক্ষিত হয়েছে।';
        } else {
          // Default due reminder
          if (options.medicineName && options.mealName) {
            text = `আপনার ${options.mealName} খাবার ওষুধ ${options.medicineName} খাওয়ার সময় হয়েছে।`;
          } else if (options.medicineName) {
            text = `আপনার ${options.medicineName} ওষুধটি খাওয়ার সময় হয়েছে।`;
          } else {
            text = 'আপনার ওষুধ খাওয়ার সময় হয়েছে। অনুগ্রহ করে প্রেসক্রিপশন অনুযায়ী ওষুধ গ্রহণ করুন।';
          }
        }
      } else {
        // English phrase generation
        if (options.type === 'next_soon') {
          text = 'Your next medication time is approaching.';
        } else if (options.type === 'meal_reminder') {
          text = 'Have you finished your meal? Remember to take your prescribed medicine after food.';
        } else if (options.type === 'completed') {
          text = 'Medicine recorded as taken. Great job maintaining your health schedule!';
        } else {
          if (options.medicineName && options.mealName) {
            text = `It is time to take your ${options.mealName} medicine: ${options.medicineName}${options.dosage ? ` (${options.dosage})` : ''}.`;
          } else if (options.medicineName) {
            text = `It is time to take your medicine: ${options.medicineName}${options.dosage ? ` (${options.dosage})` : ''}.`;
          } else {
            text = 'It is time to take your prescribed medicine.';
          }
        }
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.7, Math.min(1.3, rate));
      utterance.pitch = 1.0;

      const availableVoices = this.getAvailableVoices();

      // Custom selected voice by URI
      if (options.voiceURI) {
        const found = availableVoices.find(v => v.voiceURI === options.voiceURI);
        if (found) {
          utterance.voice = found;
          utterance.lang = found.lang;
        }
      }

      if (!utterance.voice) {
        if (lang === 'bn') {
          const bnVoice = availableVoices.find(v => v.lang.toLowerCase().startsWith('bn'));
          if (bnVoice) {
            utterance.voice = bnVoice;
            utterance.lang = bnVoice.lang;
          } else {
            // Graceful fallback when OS has no Bengali TTS voice:
            // Use en-US voice to read Bengali or default phonetic string
            utterance.lang = 'bn-BD';
          }
        } else {
          const enVoice = availableVoices.find(v => v.lang.toLowerCase().startsWith('en'));
          if (enVoice) {
            utterance.voice = enVoice;
            utterance.lang = enVoice.lang;
          } else {
            utterance.lang = 'en-US';
          }
        }
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      try {
        this.synth.speak(utterance);
      } catch {
        resolve();
      }
    });
  }

  /**
   * Start a recurring voice announcement for Voice-only or Alarm+Voice modes
   */
  public startVoiceLoop(options: VoiceAnnouncementOptions, repeatIntervalSeconds: number = 12): void {
    this.stop();
    // Speak immediately
    this.speak(options);
    // Repeat periodically
    this.voiceLoopInterval = setInterval(() => {
      this.speak(options);
    }, repeatIntervalSeconds * 1000);
  }
}

export const voiceService = new VoiceService();

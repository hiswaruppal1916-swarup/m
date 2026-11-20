/**
 * Multilingual Voice Assistance Service
 * Supports English and Bengali voice announcements using Web Speech API
 */

export interface VoiceAnnouncementOptions {
  medicineName?: string;
  dosage?: string;
  language?: 'en' | 'bn';
  rate?: number;
  type?: 'due' | 'meal_reminder' | 'next_soon' | 'completed';
}

class VoiceService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private isLoaded = false;

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
    return this.voices;
  }

  public hasLoaded(): boolean {
    return this.isLoaded;
  }

  public isSupported(): boolean {
    return !!this.synth;
  }

  /**
   * Stop any ongoing speech
   */
  public stop(): void {
    if (this.synth && this.synth.speaking) {
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
          text = 'আপনার পরবর্তী ওষুধের সময় কাছাকাছি।';
        } else if (options.type === 'meal_reminder') {
          text = 'আপনি কি খাবার খেয়েছেন? খাবার পর আপনার ওষুধ খেতে ভুলবেন না।';
        } else if (options.type === 'completed') {
          text = 'ধন্যবাদ। ওষুধ গ্রহণের তথ্য সংরক্ষিত হয়েছে।';
        } else {
          // Default due reminder
          if (options.medicineName) {
            text = `আপনার ${options.medicineName} ওষুধ খাওয়ার সময় হয়েছে।`;
          } else {
            text = 'আপনার ওষুধ খাওয়ার সময় হয়েছে। অনুগ্রহ করে ওষুধ গ্রহণ করুন।';
          }
        }
      } else {
        // English phrase generation
        if (options.type === 'next_soon') {
          text = 'Your next medication time is approaching.';
        } else if (options.type === 'meal_reminder') {
          text = 'Have you finished your meal? Remember to take your prescribed medicine after food.';
        } else if (options.type === 'completed') {
          text = 'Medicine recorded as taken. Great job!';
        } else {
          if (options.medicineName) {
            text = `MediTime reminder: It is time to take your ${options.medicineName}${options.dosage ? ` (${options.dosage})` : ''}.`;
          } else {
            text = 'It is time to take your medicine.';
          }
        }
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.7, Math.min(1.3, rate));
      utterance.pitch = 1.0;

      // Select suitable voice
      if (lang === 'bn') {
        utterance.lang = 'bn-BD';
        const bnVoice = this.voices.find(v => v.lang.startsWith('bn'));
        if (bnVoice) utterance.voice = bnVoice;
      } else {
        utterance.lang = 'en-US';
        const enVoice = this.voices.find(v => v.lang.startsWith('en'));
        if (enVoice) utterance.voice = enVoice;
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
}

export const voiceService = new VoiceService();

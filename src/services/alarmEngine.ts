/**
 * Smart Alarm Engine & Lifecycle Coordinator
 * - Manages continuous repeating alarm cycle (minimum 4 minutes, keeps ringing until stopped)
 * - Coordinates Alert Modes: 'alarm_sound', 'voice_reminder', 'alarm_and_voice'
 * - Resolves built-in procedural audio or custom audio Blob from IndexedDB
 * - Triggers independent Web / System Notifications
 * - Handles Taken, Snooze, Stop Alarm, and Skip actions
 */

import { db } from '../db';
import type { 
  AlarmInstance, 
  Medicine, 
  UserSettings 
} from '../types';
import { 
  startAlarmAudio, 
  stopAlarmAudio 
} from './sound';
import { voiceService } from './voice';
import { showWebNotification } from './notifications';
import { recordDoseAction } from './scheduler';

export interface ActiveAlarmSession {
  alarm: AlarmInstance;
  medicine: Medicine;
  startedAt: number; // timestamp ms
  ringingSeconds: number;
}

class AlarmEngine {
  private activeSession: ActiveAlarmSession | null = null;
  private timerInterval: any = null;
  private voiceInterval: any = null;
  private listeners: Set<(session: ActiveAlarmSession | null) => void> = new Set();

  public subscribe(cb: (session: ActiveAlarmSession | null) => void): () => void {
    this.listeners.add(cb);
    cb(this.activeSession);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    for (const cb of this.listeners) {
      cb(this.activeSession ? { ...this.activeSession } : null);
    }
  }

  public getActiveSession(): ActiveAlarmSession | null {
    return this.activeSession;
  }

  public isRinging(): boolean {
    return !!this.activeSession;
  }

  /**
   * Start an alarm for a due dose
   */
  public async startAlarm(
    alarm: AlarmInstance,
    medicine: Medicine,
    settings: UserSettings
  ): Promise<void> {
    // Stop any previously ringing alarm
    this.stopAudioAndVoice();

    this.activeSession = {
      alarm,
      medicine,
      startedAt: Date.now(),
      ringingSeconds: 0
    };
    this.notify();

    // 1. ALWAYS fire system notification independently of selected sound mode!
    const privacy = settings.notificationPrivacy || 'full';
    const notifBody = privacy === 'full'
      ? `Time to take ${medicine.name} (${medicine.dosage})${medicine.instructions ? ` - ${medicine.instructions}` : ''}`
      : 'It is time to take your prescribed medicine.';

    showWebNotification('MediTime — Medicine Reminder', {
      body: notifBody,
      tag: `alarm_${alarm.id}`,
      data: { alarmId: alarm.id, medicineId: medicine.id }
    });

    // 2. Resolve custom audio Blob if configured
    let customBlob: Blob | undefined;
    const toneKey = settings.alarmTone || settings.alarmSound || 'gentle_chime';

    if (toneKey.startsWith('custom:') || settings.customToneId) {
      const customId = toneKey.replace('custom:', '') || settings.customToneId;
      if (customId) {
        try {
          const track = await db.customAudio.get(customId);
          if (track && track.blob) {
            customBlob = track.blob;
          }
        } catch (err) {
          console.warn('Could not load custom audio track:', err);
        }
      }
    }

    const alertMode = settings.alertMode || 'alarm_and_voice';
    const volume = settings.soundVolume ?? 0.8;

    // 3. Coordinate Alert Mode
    if (alertMode === 'alarm_sound') {
      // Alarm sound ONLY
      startAlarmAudio(toneKey, volume, customBlob);
    } else if (alertMode === 'voice_reminder') {
      // Voice ONLY
      if (settings.voiceEnabled) {
        voiceService.startVoiceLoop({
          medicineName: medicine.name,
          dosage: medicine.dosage,
          language: settings.voiceLang || settings.language,
          voiceURI: settings.voiceVoiceURI,
          rate: settings.voiceSpeed || 1.0,
          type: 'due'
        }, 12);
      }
    } else {
      // Alarm + Voice
      startAlarmAudio(toneKey, volume, customBlob);
      if (settings.voiceEnabled) {
        // Initial voice announcement
        setTimeout(() => {
          if (this.activeSession) {
            voiceService.speak({
              medicineName: medicine.name,
              dosage: medicine.dosage,
              language: settings.voiceLang || settings.language,
              voiceURI: settings.voiceVoiceURI,
              rate: settings.voiceSpeed || 1.0,
              type: 'due'
            });
          }
        }, 800);

        // Repeat voice announcement every 18 seconds alongside continuous alarm audio
        this.voiceInterval = setInterval(() => {
          if (this.activeSession && settings.voiceEnabled) {
            voiceService.speak({
              medicineName: medicine.name,
              dosage: medicine.dosage,
              language: settings.voiceLang || settings.language,
              voiceURI: settings.voiceVoiceURI,
              rate: settings.voiceSpeed || 1.0,
              type: 'due'
            });
          }
        }, 18000);
      }
    }

    // 4. Start active timer counter (tracking seconds ringing)
    // Continuous alarm: keeps ringing beyond 4 minutes until user acts
    this.timerInterval = setInterval(() => {
      if (this.activeSession) {
        this.activeSession.ringingSeconds = Math.floor((Date.now() - this.activeSession.startedAt) / 1000);
        this.notify();
      }
    }, 1000);
  }

  /**
   * Stop audio, intervals and speech without affecting DB state
   */
  private stopAudioAndVoice(): void {
    stopAlarmAudio();
    voiceService.stop();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.voiceInterval) {
      clearInterval(this.voiceInterval);
      this.voiceInterval = null;
    }
  }

  /**
   * User action: TAKEN
   */
  public async handleTaken(notes?: string): Promise<void> {
    if (!this.activeSession) return;
    const alarmId = this.activeSession.alarm.id;
    this.stopAudioAndVoice();
    this.activeSession = null;
    this.notify();

    await recordDoseAction(alarmId, 'taken', 10, notes);
  }

  /**
   * User action: SNOOZE
   */
  public async handleSnooze(snoozeMinutes: number = 10): Promise<void> {
    if (!this.activeSession) return;
    const alarmId = this.activeSession.alarm.id;
    this.stopAudioAndVoice();
    this.activeSession = null;
    this.notify();

    await recordDoseAction(alarmId, 'snooze', snoozeMinutes);
  }

  /**
   * User action: STOP ALARM (Dismiss interface & stop ringing, dose remains pending!)
   */
  public async handleStopAlarm(): Promise<void> {
    if (!this.activeSession) return;
    const alarmId = this.activeSession.alarm.id;
    this.stopAudioAndVoice();
    this.activeSession = null;
    this.notify();

    await recordDoseAction(alarmId, 'stop');
  }

  /**
   * User action: SKIP
   */
  public async handleSkip(notes?: string): Promise<void> {
    if (!this.activeSession) return;
    const alarmId = this.activeSession.alarm.id;
    this.stopAudioAndVoice();
    this.activeSession = null;
    this.notify();

    await recordDoseAction(alarmId, 'skip', 0, notes || 'Skipped by user');
  }

  /**
   * Dismiss completely (e.g., closing modal)
   */
  public dismiss(): void {
    this.stopAudioAndVoice();
    this.activeSession = null;
    this.notify();
  }
}

export const alarmEngine = new AlarmEngine();

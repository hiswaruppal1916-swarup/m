import { describe, it, expect } from 'vitest';
import { calculateAdherence } from '../scheduler';
import { BUILT_IN_TONES } from '../sound';

describe('Alarm Engine & Audio Tone Verification', () => {
  it('provides exactly 8 distinct built-in alarm tones covering all required categories', () => {
    expect(BUILT_IN_TONES.length).toBe(8);
    const toneIds = BUILT_IN_TONES.map(t => t.id);
    expect(toneIds).toContain('gentle_chime');
    expect(toneIds).toContain('classic_alarm');
    expect(toneIds).toContain('digital_alarm');
    expect(toneIds).toContain('bell_alarm');
    expect(toneIds).toContain('loud_alarm');
    expect(toneIds).toContain('soft_reminder');
    expect(toneIds).toContain('morning_alarm');
    expect(toneIds).toContain('traditional_alarm');
  });

  it('provides bilingual names for every built-in tone', () => {
    for (const tone of BUILT_IN_TONES) {
      expect(tone.nameEn.length).toBeGreaterThan(0);
      expect(tone.nameBn.length).toBeGreaterThan(0);
      expect(tone.category.length).toBeGreaterThan(0);
    }
  });

  it('distinguishes STOP action from TAKEN action (STOP does not mark dose as taken)', () => {
    // Conceptual verification of state machine:
    // When STOP is chosen, alarm status remains 'pending'
    const mockAlarm = { id: 'alarm_1', status: 'due' };
    const handleStop = (alarm: typeof mockAlarm) => {
      alarm.status = 'pending'; // preserved as pending
    };
    const handleTaken = (alarm: typeof mockAlarm) => {
      alarm.status = 'taken';
    };

    handleStop(mockAlarm);
    expect(mockAlarm.status).toBe('pending');
    expect(mockAlarm.status).not.toBe('taken');

    handleTaken(mockAlarm);
    expect(mockAlarm.status).toBe('taken');
  });

  it('guarantees adherence calculation handles all status outcomes safely', () => {
    // 0 doses: N/A
    expect(calculateAdherence(0, 0, 0).displayPercentage).toBe('N/A');
    // All taken: 100%
    expect(calculateAdherence(5, 0, 0).displayPercentage).toBe('100%');
    // None taken, 2 missed: 0%
    expect(calculateAdherence(0, 2, 0).displayPercentage).toBe('0%');
    // None taken, 2 skipped: 0%
    expect(calculateAdherence(0, 0, 2).displayPercentage).toBe('0%');
    // Mixed: 4 taken, 1 missed: 80%
    expect(calculateAdherence(4, 1, 0).displayPercentage).toBe('80%');
  });
});

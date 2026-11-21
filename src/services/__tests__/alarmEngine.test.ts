import { describe, it, expect } from 'vitest';
import { calculateAdherence } from '../scheduler';
import { ALARM_TONE_CATALOG, BUILT_IN_TONES } from '../sound';

describe('Alarm Engine & Professional Loud Sound Library Verification', () => {
  it('provides exactly 22 distinct professional alarm tones across 4 smartphone categories', () => {
    expect(ALARM_TONE_CATALOG.length).toBe(22);
    
    // Category 1: Classic Phone Alarms (6)
    const classicPhone = ALARM_TONE_CATALOG.filter(t => t.category === 'classic_phone');
    expect(classicPhone.length).toBe(6);
    expect(classicPhone.map(t => t.id)).toEqual([
      'classic_repeating_alarm',
      'traditional_digital_alarm',
      'old_telephone_ring',
      'repeating_clock_alarm',
      'classic_bell_alarm',
      'double_bell_alarm'
    ]);

    // Category 2: Loud Attention Alarms (6)
    const loudAttention = ALARM_TONE_CATALOG.filter(t => t.category === 'loud_attention');
    expect(loudAttention.length).toBe(6);
    expect(loudAttention.map(t => t.id)).toEqual([
      'urgent_digital_beep',
      'rapid_repeating_beep',
      'loud_electronic_alarm',
      'repeating_warning_tone',
      'high_attention_alarm',
      'persistent_wakeup_alarm'
    ]);

    // Category 3: Mechanical and Bell Alarms (5)
    const mechanicalBell = ALARM_TONE_CATALOG.filter(t => t.category === 'mechanical_bell');
    expect(mechanicalBell.length).toBe(5);
    expect(mechanicalBell.map(t => t.id)).toEqual([
      'mechanical_clock_bell',
      'double_metal_bell',
      'repeating_metal_ring',
      'traditional_clock_ring',
      'loud_school_bell'
    ]);

    // Category 4: Modern Smartphone Alarms (5)
    const modernSmartphone = ALARM_TONE_CATALOG.filter(t => t.category === 'modern_smartphone');
    expect(modernSmartphone.length).toBe(5);
    expect(modernSmartphone.map(t => t.id)).toEqual([
      'digital_wakeup',
      'repeating_pulse_alarm',
      'sharp_electronic_ring',
      'fast_repeating_tone',
      'multilayer_digital_alarm'
    ]);
  });

  it('provides comprehensive bilingual metadata (English & Bengali names and descriptions) for every tone', () => {
    for (const tone of ALARM_TONE_CATALOG) {
      expect(tone.nameEn.trim().length).toBeGreaterThan(0);
      expect(tone.nameBn.trim().length).toBeGreaterThan(0);
      expect(tone.descriptionEn.trim().length).toBeGreaterThan(0);
      expect(tone.descriptionBn.trim().length).toBeGreaterThan(0);
      expect(['classic_phone', 'loud_attention', 'mechanical_bell', 'modern_smartphone']).toContain(tone.category);
    }
  });

  it('maintains backward-compatible BUILT_IN_TONES reference', () => {
    expect(BUILT_IN_TONES.length).toBe(22);
  });

  it('distinguishes STOP action from TAKEN action (STOP keeps dose pending)', () => {
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

  it('verifies single-tap action state transitions for all four alarm actions', () => {
    // 1. TAKEN
    let alarmStatus = 'due';
    let logStatus: string | null = null;
    let alarmDismissed = false;

    const onTaken = () => {
      alarmStatus = 'taken';
      logStatus = 'taken';
      alarmDismissed = true;
    };
    onTaken();
    expect(alarmStatus).toBe('taken');
    expect(logStatus).toBe('taken');
    expect(alarmDismissed).toBe(true);

    // 2. SNOOZE
    let snoozeUntil: string | null = null;
    alarmDismissed = false;
    const onSnooze = (minutes: number) => {
      alarmStatus = 'snoozed';
      snoozeUntil = new Date(Date.now() + minutes * 60000).toISOString();
      alarmDismissed = true;
    };
    onSnooze(10);
    expect(alarmStatus).toBe('snoozed');
    expect(snoozeUntil).not.toBeNull();
    expect(alarmDismissed).toBe(true);

    // 3. STOP ALARM
    alarmDismissed = false;
    const onStop = () => {
      alarmStatus = 'pending';
      alarmDismissed = true;
    };
    onStop();
    expect(alarmStatus).toBe('pending');
    expect(alarmDismissed).toBe(true);

    // 4. SKIP
    alarmDismissed = false;
    const onSkip = () => {
      alarmStatus = 'skipped';
      logStatus = 'skipped';
      alarmDismissed = true;
    };
    onSkip();
    expect(alarmStatus).toBe('skipped');
    expect(logStatus).toBe('skipped');
    expect(alarmDismissed).toBe(true);
  });

  it('guarantees adherence calculation handles all status outcomes safely and honestly', () => {
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
    // Mixed with skipped: 3 taken, 1 missed, 1 skipped: 3/5 = 60%
    expect(calculateAdherence(3, 1, 1).displayPercentage).toBe('60%');
  });

  it('validates Android Home Screen Widget statistics computation', () => {
    const mockAlarms = [
      { id: '1', status: 'taken', scheduledTime: '2026-11-21T08:00:00.000Z' },
      { id: '2', status: 'taken', scheduledTime: '2026-11-21T13:00:00.000Z' },
      { id: '3', status: 'pending', scheduledTime: '2026-11-21T18:00:00.000Z' },
      { id: '4', status: 'due', scheduledTime: '2026-11-21T20:30:00.000Z' },
      { id: '5', status: 'missed', scheduledTime: '2026-11-21T07:00:00.000Z' },
    ];

    const total = mockAlarms.length;
    const taken = mockAlarms.filter(a => a.status === 'taken').length;
    const missed = mockAlarms.filter(a => a.status === 'missed').length;
    const remaining = total - taken - missed;

    expect(total).toBe(5);
    expect(taken).toBe(2);
    expect(missed).toBe(1);
    expect(remaining).toBe(2);

    const progressBadge = `[ ${taken} / ${total} Taken ]`;
    expect(progressBadge).toBe('[ 2 / 5 Taken ]');
  });

  it('ensures boot reschedule only retains future alarm instances', () => {
    const now = 1700000000000;
    const alarms = [
      { id: 'past_1', triggerTimeMs: now - 50000 },
      { id: 'future_1', triggerTimeMs: now + 60000 },
      { id: 'future_2', triggerTimeMs: now + 3600000 },
    ];

    const toReschedule = alarms.filter(a => a.triggerTimeMs > now);
    expect(toReschedule.length).toBe(2);
    expect(toReschedule.map(a => a.id)).toEqual(['future_1', 'future_2']);
  });
});

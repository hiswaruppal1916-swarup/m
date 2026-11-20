# MediTime — Smart Medicine & Meal-Aware Reminder PWA

> **Tagline:** Never Miss Your Medicine.  
> **Platform:** Mobile-First Progressive Web Application (PWA)

---

## 1. Overview & Core Problem Solved

Standard medicine reminder applications rely entirely on fixed clock times (e.g. 09:00 AM, 02:00 PM). However, real medical prescriptions frequently require:
- **Before Breakfast** (e.g., Pantoprazole 30 mins before breakfast)
- **After Lunch / Dinner** (e.g., Metformin 15 mins after food to prevent gastrointestinal upset)
- **With Meal** (e.g., Multivitamins taken during meal)
- **Empty Stomach** (e.g., Levothyroxine 60 mins before breakfast)
- **Strict Fixed Time** (e.g., Atorvastatin at 21:30 PM bedtime)

When an individual's meal schedule changes (e.g., breakfast delayed from 8:00 AM to 9:30 AM), traditional apps either fire an alert while the person is fasting or forget the interval entirely.

**MediTime** introduces a **Hybrid Meal-Aware Medication Scheduling Engine** that safely recalculates dependent reminders when meals are logged, while guaranteeing that fixed-time medications remain untouched.

---

## 2. Multi-Layer Alarm Architecture (Honest PWA Design)

A standard web browser PWA cannot guarantee native Android unthrottled background alarm execution when the device is deeply asleep or the browser process is killed. MediTime implements an honest, multi-layer architecture:

| Layer | Component | Behavior |
|---|---|---|
| **Layer 1** | **Active Application** | In-app high-fidelity scheduler checks due times every few seconds. Plays custom procedural Web Audio API medical chimes, displays the full-screen alarm modal, announces doses via Web Speech API in **Bengali** or **English**, triggers haptic vibrations, and supports **TAKEN**, **SNOOZE**, and **SKIP**. |
| **Layer 2** | **Service Worker** | Caches all application assets and IndexedDB state for **100% offline access**. Handles notification click events to bring the relevant medicine into focus. |
| **Layer 3** | **Web Push Protocol** | Optional server-push integration (ready for Supabase) for remote reminder delivery when internet is connected. |
| **Layer 4** | **Hardware Diagnostics** | Real-time diagnostic hub inspecting Notification permissions, Service Worker registration, PWA standalone status, AudioContext, and WakeLock. |

---

## 3. Technology Stack

- **Frontend:** React 19, TypeScript, Vite 6
- **Styling:** Tailwind CSS v4, Lucide Icons
- **Local Database:** IndexedDB using Dexie.js (Offline-first, reactive live queries)
- **Audio & Synthesizers:** Procedural Web Audio API sound generator (Zero external MP3 dependency)
- **Voice Assistance:** Web Speech API (`SpeechSynthesis`) with native Bengali & English support
- **PWA:** Web App Manifest (`manifest.webmanifest`), Standalone display mode, Service Worker (`sw.js`)
- **Unit Testing:** Vitest (10 automated unit tests passing)

---

## 4. Key Screens & Features

1. **Dashboard:** Personalized greeting, adherence progress bar, streak counter, next medicine due card with countdown, and smart meal tracker bar with one-tap "I HAVE FINISHED MY MEAL" button.
2. **Add / Edit Prescription:** Configures Name, Dosage, Category (Tablet, Capsule, Syrup, etc.), Frequency, Schedule Type, Meal Relationship, Prescribed Interval (minutes), Weekday selector, instructions, and photo upload.
3. **Smart Meal Tracker:** Tracks Breakfast, Lunch, Dinner, and Snacks. Dynamically recalculates after-meal medicine times upon confirmation with instant visual feedback.
4. **Daily Schedule:** Chronological timeline with status badges (Taken, Due, Upcoming, Missed, Skipped).
5. **Full-Screen Alarm Modal:** Immersive alert interface with repeating chime, voice announcement, celebration confetti on TAKEN, configurable SNOOZE, and SKIP tracking.
6. **Medication History & Audit:** Complete history with date filters and accidental entry correction dialog with reason logging.
7. **Reports & Adherence Analytics:** Clinical adherence percentage, 7-day breakdown, and one-click CSV export for doctor visits.
8. **Caregiver Mode:** Invitation code generator, emergency contact recording, and patient privacy safeguards.
9. **Notification & Alarm Diagnostics:** Live checklist verifying permissions, service worker status, and standalone mode.
10. **Settings:** Language switcher (English / বাংলা), meal time adjustment, voice speed slider, volume slider, JSON backup/restore, and demo data loader.

---

## 5. Development & Testing Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run automated unit tests
npm run test

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 6. Vercel Deployment

MediTime includes `vercel.json` configured with SPA fallback and cache headers for `sw.js` and `manifest.webmanifest`.
To deploy:
1. Connect your repository to Vercel.
2. Build Command: `npm run build`
3. Output Directory: `dist`

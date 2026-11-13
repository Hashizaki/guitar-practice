# Guitar Practice App: Handoff Notes

## 1. Overview

A guitar practice web app for music beginners. Everything runs in the browser: there is no server and no
recorded audio. Built with **Vite + React + TypeScript**, tested and deployed to GitHub Pages by GitHub Actions.

- Target devices: iPhone / iPad (Safari) first, also Android and PC. iPad and landscape screens get a two-column layout
- UI language: Japanese
- Installable ("Add to Home Screen") and works offline via a small service worker

## 2. Feature list

| Tab | Feature | Notes |
|---|---|---|
| Learn (home) | Practice log | Today's minutes vs. a daily goal, streak, 5-week calendar, total time. Stored only on the device |
| | Today's menu | 5 small daily tasks (lesson, fretboard quiz ×10, ear training ×10, rhythm ×30 taps, chord changes 2 min) with automatic progress |
| Learn (lessons) | 14 step-by-step lessons | Note names → fretboard → rhythm/strumming → reading tab → major scale → intervals → chord construction → diatonic chords → chord progressions → minor/relative keys → pentatonic improvisation → power chords → barre chords → capo and transposition. Each has interactive sound demos and a quiz (3 correct answers completes it) |
| | Glossary | 32 beginner terms with search |
| | Settings | Theme (dark / light / follow device), text size, left-handed display (mirrors fretboards and chord diagrams), backup export / import, erase all data |
| Metronome | BPM 30–240, time signature, accent, tap tempo, subdivisions (8ths / triplets / 16ths) | |
| | Tempo-up practice | Adds +2/+5/+10 BPM every 2/4/8 bars |
| Tuner | Reference tones, mic tuner | Note name, Hz, cents |
| Chords | Chord-change practice | Random changes every 2/4/8 beats in time with the metronome |
| | One-minute changes | Count how many times you can switch between two chords in 60 s; best score per chord pair |
| | Play along | Key, progression and strumming pattern; looping backing with count-in; capo support with a "recommended capo" button; **your own songs** (type the chords, one per bar) |
| | Arpeggio practice | Fingerpicking patterns for any chord, shown as tab with right-hand fingers, looping demo |
| | Chord check (optional) | Compares mic input with the notes of the target chord |
| | Chord chart | 23 chords, tap to hear |
| Fretboard | Note-name quiz / find-the-note mode / play-the-note mode | Play mode listens through the mic and accepts the asked note at the right pitch |
| | Scale / virtual fretboard | Tap to play; scale playback lights up positions |
| Training (no guitar) | Interval ear training, chord-quality ear training, rhythm tapping (with latency compensation), chord-form quiz | |

## 3. Project layout

```
index.html              Vite entry (meta tags for iOS / PWA)
public/                 manifest.webmanifest, sw.js, icons/ (copied as-is)
src/
  main.tsx              Mounts <App>, registers the service worker (production only)
  App.tsx               Header, the six tabs (all stay mounted; only visibility changes), bottom nav
  styles.css            All styles (plain CSS, class names shared across components)
  lib/                  No UI. Singletons and pure functions
    theory.ts           Music theory data and maths (pure, unit-tested): note spelling, scales, chords,
                        diatonic chords, progressions, strum patterns, chord fingerings, capo
    audio.ts            AudioContext, iOS unlock / audio session, Karplus-Strong pluck, strum, click
    play.ts             Play a theoretical chord (guitar fingering if we have one, stacked tones otherwise)
    metronome.ts        The metronome engine (look-ahead scheduler) + useMetro() hook
    seq.ts              One-at-a-time sequencer for demos and backing loops + useSeqActive() hook
    mic.ts              Shared mic stream, chroma analysis
    pitch.ts            Pitch detection (autocorrelation), stable-note detector (pure, unit-tested)
    rhythm.ts           Tap-to-grid offset, latency suggestion, subdivision times (pure, unit-tested)
    songs.ts            User songs: chord-name parsing, transposition, shape lookup, capo choice (unit-tested)
    stats.ts            Per-item quiz results, weighted question choice, weak-spot list (unit-tested)
    backup.ts           Backup export / import / erase over a Storage-like object (pure, unit-tested)
    log.ts              Practice log + useLogVersion() hook
    store.ts            localStorage wrapper, useShared() (persisted state shared between components)
    nav.ts              gotoTab(), gotoTrain(), scrollToId()
    wake.ts             Screen wake lock
  components/           Fretboard, Keyboard, ChordDiagram, and small shared widgets (common.tsx)
  tabs/                 One file per tab
  lessons/              basics.tsx, theory.tsx, guitar.tsx (lesson bodies + quizzes), glossary.ts, index.ts (order)
tests/                  Playwright end-to-end tests (iPhone 13 and iPad Pro 11 viewports)
.github/workflows/      ci.yml (PRs and branches), deploy.yml (main → GitHub Pages)
```

## 4. Design notes

### State
- Engines that must keep running across tab switches (metronome, sequencer, mic, log) are module-level
  singletons in `src/lib`; React reads them through `useSyncExternalStore` hooks.
- `useShared(key, default)` is a persisted `useState` whose value is shared by every component using the same
  key. It is how one feature configures another (e.g. a lesson sets `svKey`/`svScale` and switches to the
  fretboard tab, or sets `selChords` for chord-change practice). Keys are stored as `gtr_<key>`.
- All six tabs stay mounted and are shown/hidden with CSS, so quiz scores and running practice survive tab
  switches. `React.StrictMode` is intentionally not used (double effects fight with mic / audio cleanup).

### Audio
- Web Audio only. Guitar tone: Karplus-Strong (`pluck`), cached per frequency. `strum(frets, t, up, vol)`.
- Scheduling: `Metro` schedules clicks 120 ms ahead every 25 ms and notifies `Metro.onBeat` listeners in sync.
  It skips ahead if it fell behind (returning from background) so clicks do not burst.
- `Seq.play(id, {n, len, fn, ui, loop, onStop})` schedules steps on the audio clock; calling it again with the
  same id stops it. `gotoTab()` stops it too.

### iPhone / iPad
- AudioContext is created lazily, resumed from any non-running state (iOS also uses `interrupted`) and unlocked
  with a silent buffer on the first touch.
- `navigator.audioSession.type` (iOS 16.4+): `playback` normally (sounds even with the silent switch on),
  `play-and-record` while the mic is on.
- Wake lock while the metronome, mic or a demo is running.
- CSS: safe-area insets, 16px selects (no focus zoom), `touch-action: manipulation`, `[hidden]{display:none!important}`.

### Theory
- `spell(root, semitones, letterStep)` spells notes correctly per key (B♭ in F major, never A♯).
  `scaleNotes`, `chordNotes`, `diatonic(key)`, `progChords(key, prog)` build on it.
- `shapeKey(realKey, capo)` and `bestCapo(realKey, prog)` implement the capo logic: diagrams show the shapes to
  finger while playback raises every string by the capo.

### Lessons
- A lesson is `{id, title, sub, Body, quiz}` (`src/lessons/types.tsx`). `Body` is a React component with the
  explanation and demos; `quiz()` returns questions built with `mkQ(question, correct, wrongs, why)`.
- To add a lesson: write it in one of the lesson files and add it to the array exported there. The list,
  progress bar, quiz flow and "today's menu" pick it up automatically. Completed ids live in `gtr_lessonsDone`.

### Practice log
- `Log.data()[YYYY-MM-DD] = {sec, lesson, fret, ear, rhythm, chord}`, saved as `gtr_log` (last 400 days).
- `Log.tick()` runs every 5 s and adds time while the page is visible and either the user interacted within the
  last minute or the metronome / mic / a demo is running. Features report activity with `Log.count(kind)`.

### Mic features
- Tuner: autocorrelation over 65–1000 Hz, first peak ≥ 85% of the strongest, parabolic interpolation.
- Play-the-note mode (fretboard quiz): every 90 ms the detected frequency is snapped to a note if within ±40 cents;
  `createStableNote(3)` requires the same note for 3 frames before it counts. Correct when that pitch equals the
  asked note on the asked string (the same pitch on another string is accepted, since they sound identical).
- Chord check: 12-bin chroma from FFT peaks (75–1500 Hz, ±35 cents), smoothed 0.55/0.45. A chord tone below
  0.22 is "missing"; a non-chord tone above 0.6 is "extra". **These thresholds have not been tuned on a real guitar.**

### Rhythm extras
- Metronome subdivisions: `Metro` state `sub` (1/2/3/4). The scheduler adds quiet `tickSound`s at
  `subdivisionTimes()`; they are suppressed in rhythm-tapping mode so they do not give the answer away.
- Latency compensation: the shared `rLatency` (ms, −100…400) is subtracted from every tap offset.
  `suggestLatency(offsets, current)` proposes `current + median(recent offsets)` once there are 8 taps.
- Arpeggio practice (`src/tabs/Arpeggio.tsx`): patterns are 8-character strings (`B` = the chord's lowest
  sounding string, `1`–`3` = string numbers, `.` = rest); `arpString()` maps them to strings of the chosen chord.

### Play along and user songs
- The selected source is the shared `paSrc`: `p<index>` for a preset in `PROGS`, `s<id>` for a user song in the
  shared `songs` list (`{id, name, chords: string[]}`, one chord per bar, max 32).
- `parseSongText()` accepts `C`, `Am`, `G7`, `Fmaj7`/`FM7`, `Dm7`, `Bdim`, with `#`/`b` for accidentals and
  spaces, `|`, commas, arrows or newlines as separators; unreadable tokens are reported and block saving.
- User songs are absolute chords, so the key selector is hidden; a capo transposes them down
  (`transposeChord(c, -capo)`). `findShape()` looks fingerings up by pitch class + quality, so `Gbm` finds `F♯m`.
- One-minute changes keeps its best scores in the shared `omBest` map keyed by `pairKey(a, b)` (order-independent).

### Weak spots
- `Stats.record(group, item, ok)` keeps `[right, wrong]` per item with a 0.9 decay per answer, so recent results
  count more (stored as `gtr_stats`). Groups: `fretS` (string), `fretN` (note), `iv`, `ce`, `fm`.
- `chooseItem(pool, weightOf)` picks a question with probability proportional to `Stats.weight` (1 for mastered,
  up to 5 for always wrong, 1.5 for never asked) when the shared `weakMode` setting is on, uniformly otherwise.
- `<WeakList>` under each quiz shows the weakest items (≥ 2 answers, accuracy < 80%) and the on/off switch.

### Settings and backup
- `src/tabs/Settings.tsx`: `useTheme`, `useZoom`, `useLefty` (all `useShared`). `useApplyDisplay()` (called once in
  `App`) sets `data-theme` on `<html>` and the `--zoom` CSS variable (`header, main { zoom: var(--zoom) }`).
- Themes are CSS variables in `styles.css` (`:root[data-theme="light"]`, and `auto` via `prefers-color-scheme`).
  Colours that differ per theme must be variables; fixed colours are fine for the wood-coloured fretboard.
- Left-handed display mirrors x coordinates inside `Fretboard` (`mx()`, also applied to hit testing) and `ChordDiagram`.
- Backup file: `{app: "guitar-practice", version: 1, exportedAt, data}` where `data` holds every `gtr_*` key
  without the prefix. Import replaces all current data and reloads the page so the singletons pick it up.

### Offline
- `public/sw.js`: network-first for the page, cache-first for everything else. Because Vite's asset names change
  per build, the page sends the service worker the list of files it loaded so the first visit is cached too.

## 5. Testing

- `npm run typecheck` — TypeScript, strict.
- `npm test` — Vitest unit tests for `theory.ts` (spelling in all 12 keys, chords, diatonic chords, progressions,
  capo) and `rhythm.ts`.
- `npm run e2e` — Playwright against the production build at iPhone 13 and iPad Pro 11 sizes: every tab, the
  quizzes, play-along, the practice log, and all 14 lessons completed end to end with no console errors.
  Elements used by tests carry `data-testid`; quiz elements expose the correct answer in `data-answer`.
  `playwright.config.ts` generates a WAV with a 110 Hz tone (A2, open 5th string) and feeds it to Chromium's fake
  microphone, so the tuner and play-the-note mode are exercised for real.
- CI runs all of the above on every pull request; `main` is deployed only if they pass.
- **Not tested**: real devices (iOS Safari / Android Chrome) and mic input from a real guitar (only synthetic tones). On a real iPhone
  check sound with the silent switch on, the mic tuner, and whether rhythm offsets look biased (Bluetooth
  earphones add a lot of latency).

## 6. Deployment

`.github/workflows/deploy.yml` builds, tests and publishes `dist/` to GitHub Pages on every push to `main`.
One-time setup: repository **Settings → Pages → Source: GitHub Actions**.
`vite.config.ts` uses `base: './'`, so the site works under `https://<user>.github.io/<repo>/` without changes.

## 7. Known limitations

- The mic needs https (or localhost) and permission; it does not work inside sandboxed previews.
- The chord check tells which notes sound, not which string or finger is wrong, and is sensitive to noise and tuning.
- The low E string is near the FFT resolution limit, so its notes are judged mostly from overtones.
- The guitar tone is synthesized and simple compared with a real instrument.
- Safari may clear site data for sites not added to the Home Screen after about a week without visits.

## 8. Ideas for future work

- Tune the chord-check thresholds on a real guitar
- More lessons (the CAGED system, 7th-chord functions, secondary dominants)

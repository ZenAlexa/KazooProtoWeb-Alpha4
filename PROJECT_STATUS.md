# Kazoo Proto Web - Project Status

**Updated**: 2025-11-06
**Branch**: refactor/step-3-modularization
**Code**: ~10,000 lines JavaScript

---

## Current State

Real-time voice-to-instrument system using Web Audio API.

### Core Features
- Pitch detection (YIN algorithm in AudioWorklet)
- 6 instruments (sax, violin, piano, flute, guitar, synth)
- Expression mapping (volume, timbre, breathiness)

### Critical Issues
- **Latency**: 180ms (target < 50ms) - 3.6x over goal
- **Tests**: 1 real test suite, rest were fake
- **Docs**: Still 192+ files after cleanup

---

## Recent Changes (2025-11-06)

### Cleanup Completed
- Deleted 6 fake test files (custom framework, never ran)
- Deleted 38 doc files (phase reports, stage summaries)
- Deleted latency-profiler/ (monitoring without fixing)
- Removed 150+ Phase X comments from code
- Removed emoji from code comments
- **Result**: -21,752 lines

### Added
- Real latency measurement: `window.app.getLatencyStats()`
- Returns min/max/avg/p50/p95 from last 100 samples

### Architecture
- Dependency injection via AppContainer
- Global variables: 8 → 2 (window.app, window.container)
- Services accessed via: `window.container.get('serviceName')`

---

## Tech Stack

- **Audio**: Web Audio API + AudioWorklet
- **Pitch Detection**: YIN algorithm
- **Synthesis**: Tone.js v15.1.22
- **DI Container**: Custom AppContainer
- **Tests**: Vitest (1 suite, 19 tests passing)

---

## Architecture

### Core Services (in AppContainer)
1. configManager - Centralized config
2. instrumentPresetManager - Instrument definitions
3. pitchDetector - YIN algorithm wrapper
4. performanceMonitor - FPS and timing
5. synthesizerEngine - Legacy synthesizer
6. continuousSynthEngine - Continuous mode synth
7. ExpressiveFeatures - Feature extraction
8. audioIO - Audio input/output abstraction
9. app - Main application (KazooApp)

### Audio Pipeline
```
Microphone → AudioWorklet → YIN Detection → Expression Extraction → Synthesizer → Output
```

---

## Known Problems

### P0: Latency (Critical)
- **Current**: 180ms
- **Target**: < 50ms
- **Gap**: 3.6x over goal
- **Measurement**: `window.app.getLatencyStats()` now available
- **Next**: Find bottleneck (Worklet fallback? FFT? Synthesizer?)

### P1: Testing
- Only 1 real test suite (AppContainer)
- Need tests for: PitchDetector, AudioIO, Synthesizers, Config
- Old tests were fake (custom framework with predefined "success")

### P2: Documentation
- 192 files remaining (still too many)
- Target: < 20 essential files
- Keep: README, TROUBLESHOOTING, CLAUDE.md, cleanup docs

### P3: Code Quality
- 286 console.log statements
- Some outdated comments
- No Logger utility in use

---

## Next Steps

### Immediate
1. Measure actual latency in browser
2. Check AudioIO mode: `window.container.get('audioIO').mode`
3. Find bottleneck (likely suspects):
   - ScriptProcessor fallback (2048 buffer = 46ms base)
   - ExpressiveFeatures FFT computation
   - Tone.js synthesizer latency

### Short Term
4. Fix latency bottleneck (target < 80ms first)
5. Write real tests (5 core modules using Vitest)
6. Delete more docs (192 → < 20 files)

### Medium Term
7. ES Module refactoring
8. UIManager integration
9. Increase test coverage to 40%

---

## Commands

```bash
# Development
npm start                    # Start dev server
npm test                     # Run tests (Vitest)

# In browser console (after starting audio)
window.app.getLatencyStats() # Get latency measurements
window.container.get('audioIO').mode  # Check if using Worklet
window.container.getServiceNames()    # List all services
```

---

## File Structure

```
├── js/
│   ├── main.js              # KazooApp entry point
│   ├── audio-io.js          # Audio abstraction
│   ├── pitch-detector.js    # YIN wrapper
│   ├── pitch-worklet.js     # AudioWorklet processor
│   ├── continuous-synth.js  # Continuous mode synthesizer
│   ├── synthesizer.js       # Legacy synthesizer
│   ├── performance.js       # Performance monitoring
│   ├── expressive-features.js  # Feature extraction
│   ├── core/
│   │   └── app-container.js # DI container
│   ├── managers/
│   │   └── ui-manager.js    # UI state management
│   ├── config/
│   │   ├── app-config.js    # Main config
│   │   └── instrument-presets.js
│   └── features/
│       ├── onset-detector.js
│       ├── smoothing-filters.js
│       └── spectral-features.js
├── tests/
│   ├── unit/
│   │   └── app-container.test.js  # 19 tests passing
│   └── config-system.test.js      # Config tests
├── docs/
│   ├── guides/
│   │   ├── troubleshooting.md
│   │   └── configuration.md
│   ├── CLEANUP_PLAN.md      # Optimization roadmap
│   └── CLEANUP_SUMMARY.md   # What was deleted
├── CLAUDE.md                # AI guardrails
├── PROJECT_STATUS.md        # This file
└── README.md                # User guide
```

---

## History

- **Jan 2025**: Phase 1 - AudioWorklet integration
- **Jan 2025**: Phase 2 - Expression features, config system
- **Nov 2025**: Refactoring - DI container, testing setup
- **Nov 6, 2025**: Major cleanup - deleted 21K lines of bloat

---

## References

- [README.md](README.md) - User guide and quickstart
- [CLAUDE.md](CLAUDE.md) - AI development guardrails
- [docs/CLEANUP_PLAN.md](docs/CLEANUP_PLAN.md) - Detailed optimization plan
- [docs/CLEANUP_SUMMARY.md](docs/CLEANUP_SUMMARY.md) - What was deleted and why
- [docs/guides/troubleshooting.md](docs/guides/troubleshooting.md) - Common issues

---

**Bottom Line**: Core features work. Latency is 3.6x over target. Testing is weak. Documentation is still bloated. Focus: measure and fix latency.

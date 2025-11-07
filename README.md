# Kazoo Proto - Real-time Voice to Instrument

**Version**: 0.3.0 (Performance First)
**Status**: Architecture complete, performance optimization in progress
**Last Updated**: November 7, 2025

Transform your voice into musical instruments in real-time with ultra-low latency audio processing.

---

## ✨ Features

### Core Capabilities
- **🎛️ Dual Pitch Tracking Modes** - Smooth continuous tracking or precise note-based detection
- **🎵 Real-time Pitch Detection** - YIN algorithm running in AudioWorklet (low-latency thread)
- **🎷 6 Instruments** - Saxophone, Violin, Piano, Flute, Guitar, Synth
- **⚡ Low Latency** - Currently ~180ms, targeting <50ms (v0.3.0 optimization in progress)
- **🚀 Zero Setup** - No calibration required, works instantly
- **🌐 Browser-Based** - 100% client-side, no server needed

### v0.3.0 Status (Performance First)
✅ **Architecture Complete** - Dependency injection, modular design, clean code structure
✅ **Real Latency Measurement** - `getLatencyStats()` for accurate profiling
⚠️ **Performance Optimization** - Latency 180ms → targeting 80ms in this release
⏳ **Test Coverage** - Expanding from 5% to 15%+ with real tests

### Audio Modes
- **🌊 Continuous Mode (Default)**: Smooth frequency tracking - perfect for expressive slides, vibrato, and theremin-like playing
- **🎹 Legacy Mode**: Snap-to-note system - ideal for precise, discrete musical notes

Switch between modes anytime using the toggle in the navigation bar!

---

## 🚀 Quick Start

### Installation
```bash
# Clone repository
git clone https://github.com/yourusername/KazooProtoWeb-Alpha4.git
cd KazooProtoWeb-Alpha4

# Install dependencies
npm install

# Start development server
npm start
```

### Usage
1. Open browser: `http://localhost:3000`
2. Select an instrument (e.g., Saxophone)
3. Click **"Start Playing"**
4. Allow microphone access when prompted
5. Hum or sing - hear yourself transformed instantly!

---

## 🎯 Requirements

- **Browser**: Chrome 66+, Firefox 76+, Safari 14.1+, Edge 79+
- **Features**: AudioWorklet support (automatically falls back if unavailable)
- **Microphone**: Any USB or built-in microphone
- **Connection**: HTTPS or localhost (required for microphone access)

---

## 💡 Pro Tips

- 🎧 **Use headphones** to prevent feedback loops
- 🎤 **Distance**: Keep microphone 10-20cm away for optimal detection
- 🌊 **Try Continuous Mode** for expressive, smooth playing with slides
- 🎹 **Try Legacy Mode** for precise, discrete notes
- 🤫 **Quiet environment** for best pitch detection accuracy
- 🎵 **Hum clearly** - avoid breathy sounds for better detection

---

## 🏗️ Technical Architecture

### Audio Pipeline (v0.3.0)
```
Microphone Input
  ↓
AudioWorkletNode (128 samples, 2.9ms buffer)
  ↓
pitch-worklet.js (Separate audio thread)
  ├─ Audio accumulation (128 → 2048 samples)
  ├─ YIN pitch detection algorithm
  ├─ Median filtering (5-sample smoothing)
  ├─ Note conversion (frequency → note + octave + cents)
  └─ Confidence calculation
  ↓
MessagePort → Main Thread
  ↓
Dual-Engine Synthesizer
  ├─ Continuous Mode: Direct frequency control
  └─ Legacy Mode: Quantized note triggering
  ↓
Tone.js Audio Synthesis
  ↓
Audio Output (< 8ms output latency)

Total Latency: ~180ms (optimization in progress for v0.3.0)
```

### Technology Stack
- **Pitch Detection**: YIN algorithm (inline implementation)
- **Audio Processing**: AudioWorklet API (Web Audio v1)
- **Audio Synthesis**: Tone.js v15.1.22
- **Audio I/O**: AudioIO abstraction layer (dual-mode support)
- **UI Framework**: Vanilla JavaScript + CSS
- **Performance**: Real-time monitoring with FPS tracking

### Key Components
| File | Purpose | Lines |
|------|---------|-------|
| `js/audio-io.js` | Audio I/O abstraction layer | 531 |
| `js/pitch-worklet.js` | AudioWorklet pitch detector | 440+ |
| `js/audio-config.js` | Configuration management | 248 |
| `js/main.js` | Application controller | 400+ |
| `js/continuous-synth.js` | Continuous mode engine | 300+ |
| `js/synthesizer.js` | Legacy mode engine | 250+ |

---

## ⚙️ Configuration

### Feature Flags
**File**: `js/main.js`
```javascript
// Enable AudioIO abstraction layer
this.useAudioIO = true;

// Enable AudioWorklet low-latency mode
this.audioIO.configure({
    useWorklet: true,           // AudioWorklet (8-15ms)
    workletBufferSize: 128,     // Ultra-low latency
    workletFallback: true,      // Auto-fallback to ScriptProcessor
    debug: false                // Performance logging
});
```

### Audio Parameters
**File**: `js/audio-config.js`
```javascript
export const AUDIO_CONFIG = {
    SAMPLE_RATE: 44100,              // 44.1 kHz
    BUFFER_SIZE_WORKLET: 128,        // 2.9ms latency
    BUFFER_SIZE_LEGACY: 2048,        // 46.4ms latency (fallback)

    PITCH_DETECTION: {
        ALGORITHM: 'YIN',            // YIN algorithm
        THRESHOLD: 0.1,              // Detection sensitivity
        MIN_FREQUENCY: 80,           // Hz - lowest detectable pitch
        MAX_FREQUENCY: 800,          // Hz - highest detectable pitch
        SMOOTHING_SIZE: 5,           // Median filter window
        MIN_VOLUME_THRESHOLD: 0.01   // Silence threshold
    }
};
```

### Continuous Mode Tuning
**File**: `js/continuous-synth.js`
```javascript
this.minConfidence = 0.1;              // 10% confidence threshold
this.silenceTimeout = 300;             // 300ms auto-stop
this.frequencyUpdateThreshold = 0.005; // 0.5% frequency change required
```

---

## 📊 Performance

### v0.3.0 Current Metrics
| Metric | Status | Target | Note |
|--------|--------|--------|------|
| **Processing** | AudioWorklet | ✅ | Modern API with ScriptProcessor fallback |
| **Architecture** | DI Container | ✅ | Clean dependency injection |
| **Total Latency** | ~180ms | **<90ms** | v0.3.0 optimization goal |
| **Test Coverage** | ~5% | >15% | Real tests with Vitest |
| **Code Quality** | Good | ✅ | Modular, documented, maintainable |

### Browser Compatibility
| Browser | AudioWorklet | Fallback Mode | Status |
|---------|--------------|---------------|--------|
| Chrome 66+ | ✅ Yes | ✅ Yes | Full support |
| Firefox 76+ | ✅ Yes | ✅ Yes | Full support |
| Safari 14.1+ | ⚠️ Limited | ✅ Yes | Works (256 buffer) |
| Edge 79+ | ✅ Yes | ✅ Yes | Full support |

---

## 🐛 Troubleshooting

### No Sound?
- Check microphone permissions (browser address bar 🔒 icon)
- Increase system/browser volume
- Try a different instrument
- Sing louder or hum more clearly
- Verify microphone is not muted

### High Latency?
- Close resource-heavy applications
- Use wired headphones instead of Bluetooth
- Check browser console for fallback warnings
- Verify AudioWorklet is enabled (should see "mode: 'worklet'" in console)

### Poor Pitch Detection?
- Sing louder (volume > 0.01 RMS)
- Move closer to microphone (10-20cm ideal)
- Reduce background noise
- Avoid breathy/whispery sounds
- Stay within 80-800Hz range (human voice range)

### AudioWorklet Not Loading?
- Ensure using HTTPS or localhost (required for AudioWorklet)
- Check browser version (Chrome 66+, Firefox 76+)
- System will auto-fallback to ScriptProcessor (46ms latency)
- Look for "回退到 ScriptProcessor" in console

---

## 📁 Project Structure

```
KazooProtoWeb-Alpha4/
├── index.html                          # Main application page
├── package.json                        # Dependencies and scripts
├── vercel.json                         # Vercel deployment config
│
├── css/
│   └── styles.css                      # Application styles
│
├── js/
│   ├── main.js                         # Main controller (dual-engine)
│   ├── audio-io.js                     # Audio I/O abstraction (Phase 1)
│   ├── audio-config.js                 # Configuration constants (Phase 1)
│   ├── pitch-worklet.js                # AudioWorklet processor (Phase 1)
│   ├── audio-input.js                  # Legacy audio input (fallback)
│   ├── pitch-detector.js               # YIN algorithm wrapper
│   ├── synthesizer.js                  # Legacy note-based engine
│   ├── continuous-synth.js             # Continuous frequency engine
│   ├── performance.js                  # Performance monitoring
│   └── lib/
│       ├── tone.js                     # Tone.js v15.1.22
│       └── pitchfinder-browser.js      # YIN implementation
│
├── docs/
│   ├── phase1/                         # Phase 1 documentation
│   │   ├── PHASE1_COMPLETE.md          # Completion report
│   │   ├── PHASE1_FINAL_VERIFICATION.md # Verification checklist
│   │   ├── PHASE1_BASELINE.md          # Baseline measurements
│   │   ├── PHASE1_PROGRESS.md          # Implementation progress
│   │   └── pitch-worklet-spec.md       # Message protocol spec
│   ├── roadmap/
│   │   └── ROADMAP_TO_COMMERCIAL_QUALITY.md # Full roadmap
│   └── archive/                        # Historical documentation
│       ├── CHANGES.md
│       ├── CONTINUOUS_MODE_UPDATE.md
│       ├── QUICKSTART.md
│       └── UI_UPDATES.md
│
└── archive/
    └── html/                           # Old test pages
        ├── index.old.html
        └── test-continuous.html
```

---

## 📚 Documentation

### Essential Reading
- **[Phase 1 Complete Report](docs/phase1/PHASE1_COMPLETE.md)** - Ultra-low latency implementation details
- **[Roadmap to Commercial Quality](docs/roadmap/ROADMAP_TO_COMMERCIAL_QUALITY.md)** - 4-phase development plan
- **[Verification Checklist](docs/phase1/PHASE1_FINAL_VERIFICATION.md)** - Testing and validation guide

### Historical Documentation
- **[Continuous Mode Update](docs/archive/CONTINUOUS_MODE_UPDATE.md)** - Dual-mode system guide (Alpha 5)
- **[Changes Log](docs/archive/CHANGES.md)** - Version history
- **[Quick Start Guide](docs/archive/QUICKSTART.md)** - Deployment guide

---

## 🚀 Deployment

### Local Development
```bash
npm start
# Server: http://localhost:3000
```

### Vercel (Recommended)
```bash
npm run deploy
# Automatic HTTPS + CDN
```

### Static Hosting
Upload all files to:
- Netlify
- GitHub Pages
- Cloudflare Pages
- Any static host

**⚠️ Important**: HTTPS required for microphone access (localhost exempt)

---

## 🛣️ Development Roadmap

### ✅ v0.1.x - v0.2.x: Architecture & Foundation (Complete)
- AudioWorklet integration with ScriptProcessor fallback
- YIN algorithm in audio thread
- Dependency injection container
- Dual-mode synthesizers (Continuous + Legacy)
- Expression features (volume, brightness, breathiness)
- Config management system

### 🎯 v0.3.0: Performance First (In Progress)
- **Latency optimization**: 180ms → <90ms
- **Real measurement tools**: `getLatencyStats()` profiling
- **Test coverage**: 5% → 15%+
- **Code quality**: Reduce console.log statements
- **Bottleneck identification**: FFT, Features, Synth analysis

### 📅 v0.4.0: User Experience
- UI/UX refinements
- Better error messages
- Performance indicators
- Improved visual feedback

### 📅 v1.0.0: Production Ready
- Latency <50ms consistently
- 40%+ test coverage
- Professional documentation
- Commercial quality audio

**Philosophy**: Working code > Perfect architecture. Performance > Features.

---

## 📄 License

MIT License

Copyright (c) 2025 Ziming Wang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 🤝 Contributing

Contributions welcome! Please read [PROJECT_STATUS.md](PROJECT_STATUS.md) and [CLAUDE.md](CLAUDE.md) before submitting PRs.

---

## 📧 Contact

**Author**: Ziming Wang
**Project**: Kazoo Proto Web
**Version**: 0.3.0 (Performance First)
**Date**: November 7, 2025

---

**Enjoy transforming your voice into music!** 🎤🎵✨

---

## 📚 Documentation

Comprehensive documentation is organized in the `/docs` directory:

### Quick Links
- **📖 [Documentation Index](docs/README.md)** - Complete documentation navigation
- **📊 [Project Status](PROJECT_STATUS.md)** - Current development status
- **🔍 [Code Quality Analysis](docs/analysis/code-quality-summary.txt)** - Quality assessment
- **🔧 [Refactoring Plan](docs/refactoring/plan.md)** - Three-step improvement plan
- **🧪 [Testing Guide](docs/testing/vitest-usage.md)** - How to test

### Documentation Structure
```
docs/
├── analysis/        # Code quality analysis
├── refactoring/     # Refactoring documentation
│   ├── step1/      # Cleanup & standardization
│   ├── step2/      # Architecture optimization
│   └── step3/      # Modularization refactoring
├── testing/         # Test guides and results
└── guides/          # User and developer guides
```

For detailed navigation, see **[docs/README.md](docs/README.md)**.


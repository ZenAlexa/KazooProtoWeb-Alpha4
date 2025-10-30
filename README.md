# Kazoo Proto - Real-time Voice to Instrument

Transform your voice into musical instruments in real-time with ultra-low latency.

## ✨ Features

- **🎛️ Dual Pitch Tracking Modes** - Choose between smooth continuous tracking or precise note-based
- **🎵 Real-time pitch detection** - YIN algorithm
- **🎷 6 instruments** - Saxophone, Violin, Piano, Flute, Guitar, Synth
- **⚡ Ultra-low latency** - 10-30ms end-to-end
- **🚀 Zero setup** - No calibration required
- **🌐 Browser-based** - Works entirely in your browser

### 🆕 NEW: Continuous Mode (Alpha 5)

**Two modes to choose from:**
- **🌊 Continuous Mode (Default):** Smooth frequency tracking, perfect for expressive slides and vibrato
- **🎹 Legacy Mode:** Snap-to-note system, ideal for precise musical notes

Switch between modes anytime using the toggle in the navigation bar!

## Quick Start

```bash
# Start local server
npm start

# Open browser
http://localhost:3000
```

**Usage:**
1. Select an instrument
2. Click "Start Playing"
3. Allow microphone access
4. Hum or sing

## Requirements

- Modern browser (Chrome recommended)
- Microphone access
- HTTPS or localhost

## Tips

- 🎧 Use headphones to prevent feedback
- 🎤 Keep microphone 10-20cm away
- 🌊 Try **Continuous Mode** for expressive playing with slides
- 🎹 Try **Legacy Mode** for precise, discrete notes
- 🤫 Quiet environment for best results

## Technical Stack

- **Pitch Detection**: YIN algorithm
- **Audio Synthesis**: Tone.js v15
- **Audio Input**: Web Audio API
- **UI**: Vanilla JavaScript + CSS

## Configuration

### Continuous Mode Settings
Adjust in `js/continuous-synth.js`:
```javascript
this.minConfidence = 0.1;      // 10% threshold (range: 0.01-0.3)
this.silenceTimeout = 300;     // 300ms auto-stop (range: 100-1000ms)
this.frequencyUpdateThreshold = 0.005;  // 0.5% change threshold
```

### Legacy Mode Settings
Adjust in `js/synthesizer.js`:
```javascript
this.minConfidence = 0.01;  // Lower = more sensitive
```

### Buffer Size
Adjust in `js/audio-input.js`:
```javascript
this.bufferSize = 2048;  // Lower = less latency, higher = more stable
```

## Performance

- **Latency**: 10-30ms typical
- **CPU Usage**: ~5-10%
- **Buffer**: 2048 samples (46ms @ 44.1kHz)

## Troubleshooting

**No sound?**
- Check microphone permissions
- Increase volume
- Try different instrument
- Sing louder

**High latency?**
- Close other apps
- Use wired headphones
- Reduce buffer size

**Poor detection?**
- Sing louder
- Move closer to mic
- Reduce background noise

## Deployment

### Vercel
```bash
npm run deploy
```

### Static Hosting
Upload all files to any static host (Netlify, GitHub Pages, etc.)

**Note**: HTTPS required for microphone access

## Project Structure

```
├── index.html
├── test-continuous.html          # Testing page for Continuous Mode
├── css/styles.css
├── js/
│   ├── main.js                   # Main controller (dual-engine)
│   ├── audio-input.js            # Microphone handling
│   ├── pitch-detector.js         # YIN algorithm wrapper
│   ├── synthesizer.js            # Legacy note-based engine
│   ├── continuous-synth.js       # NEW: Continuous frequency engine
│   ├── performance.js            # Latency monitoring
│   └── lib/
│       ├── tone.js               # Tone.js v15.1.22
│       └── pitchfinder-browser.js # YIN implementation
├── CONTINUOUS_MODE_UPDATE.md     # Detailed technical documentation
└── package.json
```

## 📚 Documentation

- **[CONTINUOUS_MODE_UPDATE.md](./CONTINUOUS_MODE_UPDATE.md)** - In-depth guide to the dual-mode system
- **[QUICKSTART.md](./QUICKSTART.md)** - Deployment guide
- **[CHANGES.md](./CHANGES.md)** - Version history

## License

MIT

---

**Enjoy transforming your voice!** 🎤🎵

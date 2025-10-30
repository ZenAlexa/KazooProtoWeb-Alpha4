# Kazoo Proto - Real-time Voice to Instrument

🎵 Transform your voice into musical instruments in real-time with ultra-low latency.

## Features

- **Real-time pitch detection** - YIN algorithm for accurate tracking
- **6 instruments** - Saxophone, Violin, Piano, Flute, Guitar, Synth
- **Smooth portamento** - Continuous pitch gliding without interruption
- **Ultra-low latency** - <50ms end-to-end
- **Zero setup** - No calibration required
- **Real-time tuning** - Advanced settings for sensitivity and glide control
- **Browser-based** - Works entirely in your browser

## Quick Start

```bash
# Install and start
npm install
npm start

# Open browser
http://localhost:3000
```

**Usage:**
1. Select an instrument
2. Click "Start Playing"
3. Allow microphone access
4. Hum or sing steady notes
5. (Optional) Adjust "Advanced Settings"

## Advanced Settings

- **Sensitivity** (0.01-0.20): Lower = more sensitive to soft singing
- **Glide Time** (10-200ms): Smoothness of pitch transitions
- **Release Delay** (50-500ms): Time before sound stops after silence
- **Note Change** (50-300 cents): Minimum pitch change to retrigger note

## Requirements

- Modern browser (Chrome recommended)
- Microphone access
- HTTPS or localhost
- Headphones (to prevent feedback)

## Tips

- **Use headphones** to prevent feedback loop
- Sing **steady notes** (not sliding between pitches)
- Keep microphone **10-20cm away**
- **Quiet environment** for best results
- Start with default settings, adjust if needed

## Technical Stack

- **Pitch Detection**: YIN algorithm via pitchfinder.js
- **Audio Synthesis**: Tone.js v15
- **Audio Input**: Web Audio API (ScriptProcessorNode)
- **Portamento**: `frequency.exponentialRampTo()` for smooth gliding
- **UI**: Vanilla JavaScript + CSS

## Performance

- **Latency**: 10-30ms typical
- **CPU Usage**: ~5-10%
- **Buffer**: 2048 samples (46ms @ 44.1kHz)
- **Sample Rate**: 44100 Hz

## Troubleshooting

**No sound?**
- Check microphone permissions in browser
- Increase microphone volume in system settings
- Lower Sensitivity to 0.01 in Advanced Settings
- Try different instrument (Saxophone recommended)
- Ensure browser audio is not muted

**Sound cutting in and out?**
- Increase Release Delay to 300ms
- Lower Sensitivity threshold
- Sing louder and more steadily

**Poor pitch detection?**
- Sing louder
- Move closer to microphone
- Reduce background noise
- Use headphones

**High latency?**
- Close other applications
- Use wired headphones
- Chrome browser recommended

## Deployment

### Vercel (Recommended)
```bash
npm run deploy
```

### Static Hosting
Upload all files to any static host (Netlify, GitHub Pages, etc.)

**Note**: HTTPS required for microphone access in production

## Project Structure

```
├── index.html              # Main HTML
├── css/styles.css         # Styling
├── js/
│   ├── main.js            # Main controller
│   ├── audio-input.js     # Microphone input
│   ├── pitch-detector.js  # YIN pitch detection
│   ├── synthesizer.js     # Tone.js synthesis + portamento
│   ├── performance.js     # Performance monitoring
│   └── lib/
│       ├── tone.js        # Tone.js library
│       └── pitchfinder-browser.js  # Pitchfinder
├── package.json
└── vercel.json            # Vercel config
```

## How It Works

1. **Audio Input**: Captures mic audio via Web Audio API
2. **Gate Detection**: Filters noise using volume/confidence thresholds
3. **Pitch Detection**: YIN algorithm detects fundamental frequency
4. **Synthesis**: Tone.js generates instrument sounds
5. **Portamento**: Smooth frequency transitions using `exponentialRampTo()`
6. **Output**: Real-time audio rendering

### Key Features

- **Gate detection** - 2 consecutive frames above threshold required
- **Octave suppression** - Prevents erroneous octave jumps
- **Delayed release** - 150ms grace period prevents interruptions
- **Adaptive portamento** - Different handling for note changes vs. micro-adjustments

## License

MIT

## Credits

- [Tone.js](https://tonejs.github.io/) - Web Audio framework
- [Pitchfinder](https://github.com/peterkhayes/pitchfinder) - YIN implementation
- Inspired by [Vochlea Dubler 2](https://vochlea.com/)

---

**Enjoy transforming your voice into music!** 🎤🎵

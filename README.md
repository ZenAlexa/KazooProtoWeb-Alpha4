# Kazoo Proto - Real-time Voice to Instrument

Transform your voice into musical instruments in real-time with ultra-low latency.

## Features

- **Real-time pitch detection** - YIN algorithm
- **6 instruments** - Saxophone, Violin, Piano, Flute, Guitar, Synth
- **Ultra-low latency** - <50ms end-to-end
- **Zero setup** - No calibration required
- **Browser-based** - Works entirely in your browser

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

- Use headphones to prevent feedback
- Sing steady notes (not sliding)
- Keep microphone 10-20cm away
- Quiet environment for best results

## Technical Stack

- **Pitch Detection**: YIN algorithm
- **Audio Synthesis**: Tone.js v15
- **Audio Input**: Web Audio API
- **UI**: Vanilla JavaScript + CSS

## Configuration

### Confidence Threshold
Adjust in `js/synthesizer.js`:
```javascript
this.minConfidence = 0.01;  // Lower = more sensitive
```

### Buffer Size
Adjust in `js/audio-input.js`:
```javascript
this.bufferSize = 2048;  // Lower = less latency
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
├── css/styles.css
├── js/
│   ├── main.js
│   ├── audio-input.js
│   ├── pitch-detector.js
│   ├── synthesizer.js
│   ├── performance.js
│   └── lib/
│       ├── tone.js
│       └── pitchfinder-browser.js
└── package.json
```

## License

MIT

---

**Enjoy transforming your voice!** 🎤🎵

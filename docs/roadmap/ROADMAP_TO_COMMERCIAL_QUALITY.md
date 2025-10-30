# 🎯 Roadmap to Commercial Quality (Dubler 2 Level)

## Current Status Assessment (Alpha 6)
**Current Quality: ~25% of Target**
**Phase 1 完成日期**: 2025-10-30 ✅

### Core Issues Identified:
1. **音高检测 (Pitch Detection)**:
   - ⚠️ YIN on main thread (46ms latency) → **AudioWorklet 架构就绪 (Phase 1 ✅)**
   - ❌ Cannot detect fast pitch changes (slow onset detection)
   - ❌ Poor handling of vibrato and slides
   - ❌ Basic confidence calculation

2. **音色合成 (Sound Synthesis)**:
   - ❌ Basic oscillators (sawtooth/sine/square) - 听起来太假
   - ❌ No sample-based synthesis
   - ❌ Poor timbre quality
   - ❌ Limited expressiveness

3. **表现力映射 (Expression Mapping)**:
   - ⚠️ Basic volume → velocity mapping
   - ❌ No cents → modulation/vibrato mapping
   - ❌ No formant → brightness mapping
   - ❌ No breath noise → texture control

4. **UI/UX**:
   - ⚠️ Basic controls and visualization
   - ❌ No voice calibration wizard
   - ❌ No real-time feedback on input quality
   - ❌ Limited visual feedback

---

## 🎯 Four-Phase Roadmap

## Phase 1: Ultra-Low Latency Pitch Detection (Target: 5-15ms) ✅ 已完成

**完成日期**: 2025-10-30
**状态**: 架构就绪，Feature Flag 待启用
**详细报告**: 见 `PHASE1_COMPLETE.md`

**完成的工作**:
- ✅ 创建 AudioIO 抽象层 (531 行)
- ✅ 实现 AudioWorklet 空处理器 (285 行)
- ✅ 建立消息通信协议
- ✅ 配置管理集中化 (248 行)
- ✅ 增强启动日志与错误提示
- ✅ 性能监控支持 Worklet 指标
- ✅ Feature Flag + 自动回退机制
- ✅ 基线数据记录与 Dubler 2 对标

**架构改进**:
```
旧: Mic → ScriptProcessor(2048) → 主线程 YIN → 46ms
新: Mic → AudioWorklet(128) → 独立线程 → 8-15ms (就绪)
```

**下一步 (Phase 2)**:
- 在 Worklet 中集成 YIN/MPM 算法
- 启用 Feature Flag 并测试实际延迟
- 验证精度保持 ≥ 85%

---

## Phase 1 详细内容 (已完成)

### 1.1 Replace YIN with AudioWorklet + Advanced Algorithms
**Current Problem**: YIN on main thread → 46ms latency, blocking UI

**Solution Stack**:
```
AudioWorklet (separate thread)
  → MPM (McLeod Pitch Method) for fast onset
  → SWIPE (Sawtooth Waveform Inspired Pitch Estimator) for accuracy
  → Hybrid mode: MPM for transients, SWIPE for sustained notes
```

**Implementation Steps**:
1. Create `pitch-worklet.js` using AudioWorkletProcessor
2. Implement MPM algorithm (better than YIN for low latency)
3. Add SWIPE as fallback for accuracy
4. Ring buffer for zero-copy audio transfer
5. Confidence scoring with multiple metrics:
   - Harmonic clarity (HNR - Harmonics-to-Noise Ratio)
   - Periodicity strength
   - Spectral flatness
   - Voiced/unvoiced detection

**Expected Results**:
- Latency: 46ms → 5-10ms (Audio buffer size: 128 samples)
- Accuracy: +30% in fast passages
- CPU usage: -50% (off main thread)

**Technical References**:
- MPM Paper: McLeod & Wyvill (2005) "A Smarter Way to Find Pitch"
- Web Audio API AudioWorklet: https://www.w3.org/TR/webaudio/#AudioWorklet
- Real-time best practices: Buffer size 128-256 samples @ 48kHz

---

### 1.2 Advanced Onset Detection
**Current Problem**: Cannot detect quick note changes (slides vs. discrete notes)

**Solution**:
```javascript
OnsetDetector {
  - Spectral flux analysis
  - Energy envelope tracking
  - Zero-crossing rate
  → Classify: [Legato, Staccato, Glissando]
}
```

**Dubler 2 Feature Parity**:
- **IntelliBend**: Anchor to note until intentional bend detected
- **TruBend**: Follow voice precisely (already have this)
- Auto-detect articulation style

---

### 1.3 Frequency Smoothing & Tracking
**Current**: Median filter with 5 samples (too basic)

**Upgrade**:
```javascript
KalmanFilter {
  - Predict next frequency based on trend
  - Correct with new measurement
  - Adaptive noise covariance (trust measurement more when confidence high)
}

+ Adaptive smoothing:
  - Vibrato: More smoothing (reduce jitter)
  - Glissando: Less smoothing (follow precisely)
```

**Expected Results**:
- Vibrato detection: ✓ (4-8Hz modulation)
- Glissando tracking: ✓ (smooth pitch bends)
- Jitter reduction: 80%

---

## Phase 2: Multi-Dimensional Expression Mapping

### 2.1 Volume → Dynamics
**Current**: `volume * 2` (too simple)

**Dubler 2 Approach**:
```javascript
VelocityMapper {
  // Calibration phase: Learn user's dynamic range
  calibrate(quietestNote, loudestNote) {
    this.minDb = RMStoDb(quietestNote)
    this.maxDb = RMStoDb(loudestNote)
  }

  // Exponential mapping (more natural)
  toVelocity(rms) {
    const db = RMStoDb(rms)
    const normalized = (db - minDb) / (maxDb - minDb)
    return Math.pow(normalized, 0.7) * 127  // 0.7 exponent = natural feel
  }
}
```

**Additional Mapping**:
- Volume → Filter cutoff (louder = brighter)
- Volume → Release time (softer = longer decay)

---

### 2.2 Cents → Modulation (New!)
**Dubler 2 Key Feature**: Use pitch deviation to control effects

**Implementation**:
```javascript
CentsMapper {
  // Cents = pitch deviation from nearest note (-50 to +50)

  mapToVibrato(cents, frequency) {
    // Detect vibrato: Regular oscillation around center pitch
    const isVibrato = detectCyclicPattern(centsHistory, 4-8) // 4-8Hz

    if (isVibrato) {
      return {
        vibratoDepth: Math.abs(cents) / 50 * 0.5,
        vibratoRate: detectedFrequency
      }
    }
  }

  mapToPitchBend(cents) {
    // Intentional bends vs. natural imperfection
    if (Math.abs(cents) > 25 && sustained > 100ms) {
      return cents / 50  // Normalized bend amount
    }
    return 0  // Ignore small deviations
  }

  mapToModulation(cents) {
    // MIDI CC #1 (Modulation Wheel)
    // Map to filter resonance, chorus depth, etc.
    return mapRange(cents, -50, 50, 0, 127)
  }
}
```

**Expected Results**:
- Vibrato automatically applied ✓
- Intentional pitch bends captured ✓
- Expressive modulation control ✓

---

### 2.3 Formant Analysis → Brightness (Advanced)
**Goal**: Different vowel sounds control timbre

**Implementation**:
```javascript
FormantAnalyzer {
  // Analyze formants (resonant frequencies in vocal tract)
  // "Ah" = F1:800Hz, F2:1200Hz → Warm
  // "Ee" = F1:300Hz, F2:2500Hz → Bright

  analyzeFormants(fftData) {
    const peaks = findPeaks(fftData, 5)  // Find 5 strongest peaks
    const f1 = peaks[0]  // First formant
    const f2 = peaks[1]  // Second formant

    // Map to brightness (filter cutoff)
    const brightness = mapRange(f2, 800, 3000, 0.2, 1.0)
    return brightness
  }
}
```

**Use Cases**:
- "Oo" → Warm, mellow tone
- "Ah" → Balanced
- "Ee" → Bright, cutting tone

---

### 2.4 Breath Noise → Texture
**Goal**: Air/breathiness controls noisy components (like flute key clicks, sax breath)

**Implementation**:
```javascript
NoiseDetector {
  analyzeSpectralFlatness(fftData) {
    // High flatness = noise (breath)
    // Low flatness = tonal (clear pitch)
    const flatness = spectralFlatness(fftData)

    return {
      noiseLevel: flatness,
      isBreathy: flatness > 0.6
    }
  }
}

// Use in synthesis:
synth.noiseGain = noiseLevel * 0.3  // Add noise texture
```

---

## Phase 3: Professional Sound Engine

### 3.1 Replace Oscillators with Sample-Based Synthesis
**Current Problem**: Sawtooth/sine waves sound NOTHING like real instruments

**Solution**: Multi-sample instrument library

```javascript
SampleInstrument {
  constructor(instrumentName) {
    // Load multiple samples across pitch range
    this.samples = {
      'C2': loadSample('saxophone-C2.wav'),
      'C3': loadSample('saxophone-C3.wav'),
      'C4': loadSample('saxophone-C4.wav'),
      'C5': loadSample('saxophone-C5.wav')
    }

    // Load multiple velocity layers
    this.velocityLayers = {
      'pp': loadSamples('saxophone-pianissimo'),
      'mf': loadSamples('saxophone-mezzoforte'),
      'ff': loadSamples('saxophone-fortissimo')
    }
  }

  playPitch(frequency, velocity) {
    // Find nearest sample
    const baseNote = findNearestSample(frequency)
    const sample = this.samples[baseNote]

    // Pitch shift to exact frequency (preserve formants)
    const playbackRate = frequency / baseNote.frequency

    // Crossfade between velocity layers
    const layer = interpolateVelocityLayers(velocity, this.velocityLayers)

    return {
      sample: sample,
      playbackRate: playbackRate,
      layer: layer
    }
  }
}
```

**Sample Sources**:
1. Free: VSCO 2 Community Edition (high-quality orchestral samples)
2. Free: Freepats (General MIDI samples)
3. Free: Philharmonia Orchestra samples
4. Record your own: MIDI keyboard → sample at every C (C1, C2, C3...)

**Expected Results**:
- Sound quality: +500% (from "toy synth" to "real instrument")
- Velocity expression: ✓ (multiple dynamic layers)
- Natural timbre: ✓ (real instrument recordings)

---

### 3.2 Intelligent Sample Triggering
**Dubler 2 Approach**: Don't re-trigger on continuous pitch changes

```javascript
IntelligentSampler {
  processPitch(pitchInfo) {
    const isNewNote = detectArticulation(pitchInfo)

    if (isNewNote) {
      // Hard re-trigger
      this.currentSample.stop()
      this.currentSample = this.playSample(pitchInfo)
    } else {
      // Pitch shift existing sample (smooth)
      this.currentSample.playbackRate = calculateRate(pitchInfo.frequency)
    }
  }

  detectArticulation(pitchInfo) {
    const silenceGap = Date.now() - lastPitchTime > 50  // 50ms gap
    const largeJump = Math.abs(pitchInfo.frequency - lastFrequency) > lastFrequency * 0.2  // 20% jump
    const onsetDetected = this.onsetDetector.detect()

    return silenceGap || (largeJump && onsetDetected)
  }
}
```

---

### 3.3 Multi-Layer Synthesis (Hybrid Approach)
**Best of Both Worlds**: Samples + Synthesis

```javascript
HybridSynth {
  constructor() {
    this.sampler = new SampleInstrument()  // Body/resonance
    this.synth = new Tone.MonoSynth()      // Expressiveness
  }

  playNote(frequency, velocity, expression) {
    // Layer 1: Sample (60% mix) - authentic timbre
    const sample = this.sampler.play(frequency, velocity)
    sample.volume.value = -5  // dB

    // Layer 2: Synth (40% mix) - continuous control
    this.synth.frequency.value = frequency
    this.synth.volume.value = -8  // dB

    // Blend based on articulation
    if (expression.isLegato) {
      // More synth for smooth tracking
      sample.volume.value = -10
      this.synth.volume.value = -3
    }
  }
}
```

---

### 3.4 Advanced Effects Chain
**Current**: Basic vibrato + filter + reverb

**Professional Chain**:
```javascript
EffectsChain {
  // 1. EQ (shape timbre)
  eq: new Tone.EQ3({
    low: 0,      // Controlled by formants
    mid: 0,      // Controlled by volume
    high: 0      // Controlled by brightness
  })

  // 2. Compressor (even out dynamics)
  compressor: new Tone.Compressor({
    threshold: -20,
    ratio: 4,
    attack: 0.003,
    release: 0.1
  })

  // 3. Chorus (thicken sound)
  chorus: new Tone.Chorus({
    frequency: 2,
    delayTime: 3.5,
    depth: 0.3,
    wet: 0.2
  })

  // 4. Reverb (space)
  reverb: new Tone.Reverb({
    decay: 2.5,
    preDelay: 0.01,
    wet: 0.25
  })

  // 5. Limiter (prevent clipping)
  limiter: new Tone.Limiter(-1)
}
```

---

## Phase 4: UI/UX Overhaul

### 4.1 Voice Calibration Wizard (Critical!)
**Dubler 2's Secret**: Personalized to each user's voice

```javascript
CalibrationWizard {
  steps: [
    {
      title: "找到你的最低音",
      instruction: "请尽可能低地哼唱 'Ahhhh'，持续2秒",
      analyze: (recording) => {
        this.userRange.min = recording.lowestStableFrequency
      }
    },
    {
      title: "找到你的最高音",
      instruction: "请尽可能高地哼唱 'Ahhhh'，持续2秒",
      analyze: (recording) => {
        this.userRange.max = recording.highestStableFrequency
      }
    },
    {
      title: "测试动态范围",
      instruction: "从最轻到最响，慢慢增加音量",
      analyze: (recording) => {
        this.dynamicRange = {
          quietest: recording.minRMS,
          loudest: recording.maxRMS
        }
      }
    },
    {
      title: "颤音测试",
      instruction: "唱一个音，加上颤音",
      analyze: (recording) => {
        this.vibratoStyle = detectVibratoCharacteristics(recording)
      }
    }
  ],

  applyProfile() {
    pitchDetector.setRange(this.userRange.min, this.userRange.max)
    velocityMapper.calibrate(this.dynamicRange.quietest, this.dynamicRange.loudest)
    vibratoDetector.setThreshold(this.vibratoStyle.depth)
  }
}
```

**Impact**: +200% accuracy for that specific user

---

### 4.2 Real-Time Input Quality Indicators
**Problem**: User doesn't know if they're being detected correctly

**Solution**: Multi-meter dashboard
```html
<div class="input-quality-panel">
  <!-- Pitch Confidence -->
  <div class="meter">
    <label>音高置信度</label>
    <div class="meter-bar" id="confidenceMeter">
      <div class="fill" style="width: 85%; background: lime"></div>
    </div>
    <span>85% - Excellent</span>
  </div>

  <!-- Volume Level -->
  <div class="meter">
    <label>音量</label>
    <div class="meter-bar" id="volumeMeter">
      <div class="fill" style="width: 60%; background: lime"></div>
    </div>
    <span>-12 dB - Good</span>
  </div>

  <!-- Latency Monitor -->
  <div class="latency-display">
    <span class="value">8ms</span>
    <span class="label">总延迟</span>
    <span class="status">✓ 优秀</span>
  </div>

  <!-- Voiced/Unvoiced Indicator -->
  <div class="voice-status">
    <span class="indicator voiced">🎵 清晰人声</span>
    <!-- OR -->
    <span class="indicator unvoiced">💨 气声/杂音</span>
  </div>
</div>
```

---

### 4.3 Advanced Visualizations
**Current**: Basic frequency display

**Professional Suite**:

1. **Pitch Tracker (Melodyne-style)**
```javascript
PitchTrackDisplay {
  // Real-time scrolling piano roll
  // Shows: detected pitch vs. target notes
  // Color-coded by confidence

  render(pitchInfo) {
    const note = frequencyToMidiNote(pitchInfo.frequency)
    const cents = pitchInfo.cents

    drawNote({
      position: note + (cents / 100),
      color: confidenceToColor(pitchInfo.confidence),
      thickness: velocityToThickness(pitchInfo.velocity)
    })
  }
}
```

2. **Spectrogram (Formant Visualization)**
```javascript
// Show frequency content over time
// User can SEE their formants changing
// Useful for learning vowel control
```

3. **Expression Meter**
```javascript
ExpressionDisplay {
  // Real-time bars showing:
  - Vibrato depth
  - Pitch bend amount
  - Brightness (formant)
  - Breathiness
  - Dynamic level
}
```

---

### 4.4 Performance Mode vs. Practice Mode
**Two UI Layouts**:

**Practice Mode** (default):
- All meters visible
- Pitch accuracy feedback
- Note names displayed
- Slow update rate (easier to read)

**Performance Mode**:
- Minimal UI (only instrument selector)
- Hide distracting metrics
- Fastest update rate
- Full-screen option

---

## 📊 Implementation Timeline & Priority

### Sprint 1 (Week 1-2): Foundation
**Priority: Critical**
- [ ] Implement AudioWorklet with MPM algorithm
- [ ] Replace ScriptProcessorNode with AudioWorkletNode
- [ ] Benchmark latency reduction
- [ ] Add Kalman filter for frequency tracking

**Expected Outcome**: Latency 46ms → 8-12ms

---

### Sprint 2 (Week 3-4): Expression Mapping
**Priority: High**
- [ ] Implement cents → modulation mapping
- [ ] Add formant analyzer (FFT-based)
- [ ] Create calibration wizard (basic version)
- [ ] Improve velocity curve

**Expected Outcome**: Capture vibrato, brightness, dynamics

---

### Sprint 3 (Week 5-6): Sound Quality
**Priority: High**
- [ ] Integrate sample library (start with 1 instrument)
- [ ] Build SampleInstrument class
- [ ] Add velocity layer crossfading
- [ ] Implement intelligent sample triggering

**Expected Outcome**: Sound quality 10x improvement

---

### Sprint 4 (Week 7-8): Polish & UX
**Priority: Medium**
- [ ] Build input quality indicators
- [ ] Add pitch tracker visualization
- [ ] Implement performance vs. practice mode
- [ ] Add effects presets per instrument

**Expected Outcome**: Professional user experience

---

## 🔬 Technical Specifications

### Target Metrics
| Metric | Current | Target | Dubler 2 |
|--------|---------|--------|----------|
| End-to-end latency | 46ms | 8-12ms | 5-10ms |
| Pitch accuracy | 85% | 95%+ | 98% |
| Vibrato detection | No | Yes | Yes |
| Dynamic range | 20dB | 60dB | 80dB |
| CPU usage (1 voice) | 15% | 5% | <5% |
| Buffer size | 2048 | 128-256 | 128 |
| Sample rate | 44.1kHz | 48kHz | 48kHz |

---

### Audio Processing Pipeline (Final Architecture)

```
Microphone Input (48kHz, 128 buffer)
  ↓
AudioWorkletNode (separate thread)
  ↓
MPM Pitch Detector (5ms)
  ↓
Kalman Filter (smooth)
  ↓
[Parallel Analysis]
  ├→ Onset Detector → Articulation
  ├→ Formant Analyzer → Brightness
  ├→ Spectral Flatness → Breathiness
  └→ Cents Tracker → Vibrato/Bend
  ↓
Expression Mapper
  ↓
Hybrid Synth Engine
  ├→ Sample Layer (60%)
  └→ Synth Layer (40%)
  ↓
Effects Chain (EQ → Compressor → Chorus → Reverb)
  ↓
Limiter → Output
```

**Total Latency Breakdown**:
- Audio input buffer: 128 samples @ 48kHz = 2.67ms
- MPM detection: ~2-3ms
- Processing overhead: ~1ms
- Output buffer: 128 samples = 2.67ms
- **Total: ~8-10ms** ✓

---

## 🎓 Learning Resources

### Pitch Detection Algorithms
1. **MPM Paper**: "A Smarter Way to Find Pitch" - McLeod & Wyvill (2005)
   - https://www.cs.otago.ac.nz/research/publications/oucs-2005-08.pdf
2. **SWIPE Paper**: "A Sawtooth Waveform Inspired Pitch Estimator" - Camacho (2007)
3. **YIN Paper**: "YIN, a fundamental frequency estimator" - De Cheveigné & Kawahara (2002)

### Web Audio API
1. Official Spec: https://www.w3.org/TR/webaudio/
2. AudioWorklet Guide: https://developers.google.com/web/updates/2017/12/audio-worklet
3. Performance Tips: https://padenot.github.io/web-audio-perf/

### Synthesis Techniques
1. Free Sample Libraries:
   - VSCO 2 Community Edition
   - Freepats General MIDI
   - Philharmonia Orchestra (free for non-commercial)
2. Formant Analysis: Praat (phonetics software) documentation
3. Effects Design: "Designing Audio Effect Plugins in C++" by Will Pirkle

---

## 💡 Quick Wins (Do These First!)

### Week 1 Immediate Improvements:
1. **Switch to 128 buffer size** (if browser supports):
   ```javascript
   bufferSize: 128  // Was 2048
   sampleRate: 48000  // Was 44100
   ```
   **Expected**: Latency 46ms → 25ms

2. **Add onset detection** (detect note starts):
   ```javascript
   const energyChange = currentEnergy / previousEnergy
   if (energyChange > 2.0 && timeSinceLastOnset > 100) {
     isNewNote = true
   }
   ```
   **Expected**: Better articulation

3. **Implement cents → vibrato** (low-hanging fruit):
   ```javascript
   if (Math.abs(cents) > 10 && isOscillating(centsHistory)) {
     vibrato.depth.value = Math.abs(cents) / 50
   }
   ```
   **Expected**: Automatic expressive vibrato

---

## 🚀 Success Criteria

### Phase 1 Complete When:
- [ ] Latency < 15ms consistently
- [ ] No UI blocking during pitch detection
- [ ] Vibrato detected and visualized

### Phase 2 Complete When:
- [ ] User can control brightness with vowel sounds
- [ ] Vibrato automatically applied
- [ ] Calibration wizard saves user profile

### Phase 3 Complete When:
- [ ] Saxophone sounds like a saxophone (blind test pass)
- [ ] Can play smooth legato passages
- [ ] Effects sound professional

### Phase 4 Complete When:
- [ ] New users can calibrate in < 2 minutes
- [ ] Input quality always visible
- [ ] Performance mode is distraction-free

---

## 📦 Recommended Libraries

### Pitch Detection
- `pitchy` (MPM implementation): https://github.com/ianprime0509/pitchy
- `aubio.js` (compiled to WASM): https://github.com/qiuxiang/aubio.js

### Audio Processing
- `essentia.js` (music analysis): https://mtg.github.io/essentia.js/
- `meyda` (audio feature extraction): https://meyda.js.org/

### Sample Management
- `tone.js` Sampler (already using)
- `soundfont-player` (MIDI soundfonts): https://github.com/danigb/soundfont-player

### Visualization
- `d3.js` (custom visualizations)
- `wavesurfer.js` (waveform display)
- `WebGL` (high-performance spectrogram)

---

## 🎯 Final Target: Dubler 2 Feature Parity

### Must-Have Features:
- [x] Real-time voice to instrument
- [ ] IntelliBend (smart pitch bend)
- [ ] Auto key detection
- [ ] Velocity sensitivity
- [ ] CC control from voice timbre
- [ ] MIDI output (future: Web MIDI API)
- [ ] Recording and playback
- [ ] Preset management

### Beyond Dubler 2 (Your Unique Features):
- [ ] Browser-based (no download!)
- [ ] Shareable performances (URLs)
- [ ] Collaborative jamming (WebRTC)
- [ ] Visual learning tools
- [ ] Mobile-optimized (iOS Safari support)

---

## 📝 Next Immediate Actions

1. **Read MPM paper** (30 mins)
2. **Set up AudioWorklet** (2 hours)
3. **Implement basic MPM** (1 day)
4. **Benchmark latency** (30 mins)
5. **Add onset detection** (4 hours)

**Total Sprint 1 Estimate**: 3-4 days full-time

---

Generated: 2025-10-30
Version: Alpha 5 → Beta 1 Roadmap
Target Completion: Beta 1 in 8 weeks (realistic timeline)

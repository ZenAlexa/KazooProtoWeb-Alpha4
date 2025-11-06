# 音色合成技术升级路线图

**项目**: Kazoo Proto Web - Alpha 4
**当前分支**: `refactor/step-3-modularization`
**文档版本**: 1.0.0
**创建时间**: 2025-11-06

---

## 目录

1. [当前状态分析](#1-当前状态分析)
2. [技术路径对比](#2-技术路径对比)
3. [短期优化方案 (1-2周)](#3-短期优化方案-1-2周)
4. [中期升级路径 (1-2月)](#4-中期升级路径-1-2月)
5. [长期AI方案 (3-6月)](#5-长期ai方案-3-6月)
6. [实施优先级矩阵](#6-实施优先级矩阵)

---

## 1. 当前状态分析

### 1.1 技术栈现状

**当前位置**: **路径 1A** - F0→合成器（基础版）

```
音频输入 → YIN音高检测 → 频率(Hz) + 表现力特征 → Tone.js MonoSynth → 音频输出
                ↓
    ExpressiveFeatures (brightness, breathiness, articulation)
```

**核心组件**:
- **音高检测**: YIN算法 (AudioWorklet, ~8-15ms 延迟)
- **合成器**: Tone.js MonoSynth + 基础波形 (sawtooth, sine, triangle, square)
- **表现力**: 简单映射 (brightness→filter, breathiness→noise, vibrato)
- **效果链**: Vibrato → Lowpass Filter → Reverb

### 1.2 当前问题诊断

#### 问题 1: 钢琴/吉他/长笛音色"根本用不了"

**根本原因**: 单一振荡器波形无法模拟这些乐器的复杂音色特征

| 乐器 | 真实特征 | 当前实现 | 差距 |
|------|---------|---------|------|
| **钢琴** | 泛音丰富，击弦瞬态，延音衰减 | Triangle波 + ADSR | ❌ 缺少击弦瞬态、泛音结构单一 |
| **吉他** | 拨弦瞬态，身体共鸣，泛音衰减 | Triangle波 + ADSR | ❌ 缺少拨弦瞬态、共鸣峰 |
| **长笛** | 气声噪声，弱泛音，强基频 | Sine波 + 噪声层 | ⚠️ 噪声层存在但不够自然 |

#### 问题 2: 表现力映射过于简单

```javascript
// 当前实现 (continuous-synth.js:400+)
brightness → filter.frequency (线性映射)
breathiness → noiseGain.gain (线性映射)
vibrato → vibrato.depth (固定参数)
```

**缺陷**:
- 无动态泛音结构变化
- 无能量包络调制
- 无共振峰模拟
- 滑音仅靠 portamento 参数（固定时间）

#### 问题 3: 延迟问题 (理论8-15ms vs 实际180ms)

**时延分解**:
```
麦克风采集 → AudioWorklet处理 → 主线程通信 → Tone.js调度 → 音频输出
   ~5ms         ~10ms            ~5ms          ~100-150ms       ~10ms
                                                    ↑
                                            问题所在！
```

**Tone.js延迟根源**:
- `context.lookAhead = 0.01` (10ms) 仍然不够激进
- `Transport.scheduleOnce()` 内部调度开销
- MonoSynth的包络触发机制（attack时间叠加）

### 1.3 优势与限制

**优势** ✅:
- AudioWorklet音高检测已优化（YIN算法稳定）
- 依赖注入架构完善，易于替换合成器模块
- 已有 ExpressiveFeatures 基础设施
- 浏览器兼容性好（Tone.js成熟）

**限制** ❌:
- Tone.js调度延迟（为MIDI/DAW设计，非实时人声）
- 单振荡器音色单薄
- 无真实乐器采样
- 无AI模型集成经验

---

## 2. 技术路径对比

### 路径矩阵

| 路径 | 延迟 | 音质 | 实现难度 | 时间成本 | 适合场景 |
|------|------|------|---------|---------|---------|
| **1A. 改进版DSP合成** | ⭐⭐⭐⭐⭐ <20ms | ⭐⭐⭐ 中等 | ⭐⭐ 简单 | 1-2周 | 立即可用 |
| **1B. LPC音色迁移** | ⭐⭐⭐⭐⭐ 10-30ms | ⭐⭐⭐⭐ 较好 | ⭐⭐⭐ 中等 | 2-4周 | 短期优化 |
| **2A. DDSP** | ⭐⭐⭐⭐ 30-50ms | ⭐⭐⭐⭐⭐ 优秀 | ⭐⭐⭐⭐ 较难 | 1-2月 | 中期升级 |
| **2B. LPCNet** | ⭐⭐⭐⭐ 20-40ms | ⭐⭐⭐⭐ 较好 | ⭐⭐⭐⭐⭐ 困难 | 2-3月 | 移动端友好 |
| **3A. RAVE** | ⭐⭐⭐ 50-100ms | ⭐⭐⭐⭐⭐ 优秀 | ⭐⭐⭐⭐⭐ 困难 | 3-6月 | 长期目标 |
| **3B. AutoVC** | ⭐⭐ 100-200ms | ⭐⭐⭐⭐⭐ 优秀 | ⭐⭐⭐⭐⭐ 困难 | 4-6月 | 研究项目 |

### 你的项目当前位置：**1A 基础版**

---

## 3. 短期优化方案 (1-2周)

### 方案 A: 增强型 DSP 合成器 (立即可行)

**目标**: 在不引入AI的情况下，提升现有5种乐器的音质至"可用"级别

#### A1. 多振荡器谐波合成 (解决钢琴/吉他问题)

**原理**: 用加法合成模拟真实乐器的泛音结构

```javascript
// 替换 MonoSynth → 自定义多振荡器合成器
class HarmonicSynth {
  constructor(harmonicProfile) {
    this.oscillators = [];
    this.gains = [];

    // 钢琴示例: 强基频 + 弱高次泛音
    // [1.0, 0.5, 0.3, 0.2, 0.15, 0.1, 0.05]
    harmonicProfile.forEach((amplitude, index) => {
      const osc = new Tone.Oscillator({
        frequency: baseFreq * (index + 1), // 整数倍泛音
        type: 'sine'
      });
      const gain = new Tone.Gain(amplitude);
      osc.connect(gain);
      this.oscillators.push(osc);
      this.gains.push(gain);
    });
  }

  updateFrequency(f0) {
    this.oscillators.forEach((osc, i) => {
      osc.frequency.value = f0 * (i + 1);
    });
  }

  modulateHarmonics(brightness) {
    // 根据 brightness 动态调整高次泛音幅度
    this.gains.forEach((gain, i) => {
      if (i > 2) { // 只调制高次泛音
        gain.gain.value = this.baseAmplitudes[i] * (0.5 + brightness * 0.5);
      }
    });
  }
}
```

**乐器泛音配置** ([js/config/harmonic-profiles.js](../../js/config/harmonic-profiles.js)):

```javascript
export const HARMONIC_PROFILES = {
  piano: {
    harmonics: [1.0, 0.6, 0.4, 0.3, 0.2, 0.15, 0.1, 0.05],
    inharmonicity: 0.0001,  // 钢琴特有的微弱失谐
    noiseComponent: 0.02     // 击弦噪声
  },
  guitar: {
    harmonics: [1.0, 0.7, 0.5, 0.4, 0.3, 0.2],
    bodyResonance: [196, 392, 659],  // 木吉他共鸣峰 (Hz)
    pluckTransient: true              // 拨弦瞬态
  },
  flute: {
    harmonics: [1.0, 0.2, 0.15, 0.1],  // 弱泛音
    breathNoise: 0.3,                   // 强气声
    noiseFilter: { type: 'bandpass', Q: 2 }
  }
};
```

#### A2. 包络跟随与动态调制

**问题**: 当前 brightness 只控制滤波器截止频率，不够自然

**改进**: 包络跟随器 (Envelope Follower)

```javascript
// 实时跟踪输入能量，调制多个参数
class EnvelopeFollower {
  constructor(attackTime = 0.01, releaseTime = 0.1) {
    this.envelope = 0;
    this.attackCoeff = Math.exp(-1 / (attackTime * sampleRate));
    this.releaseCoeff = Math.exp(-1 / (releaseTime * sampleRate));
  }

  process(inputLevel) {
    if (inputLevel > this.envelope) {
      this.envelope = this.attackCoeff * this.envelope +
                      (1 - this.attackCoeff) * inputLevel;
    } else {
      this.envelope = this.releaseCoeff * this.envelope +
                      (1 - this.releaseCoeff) * inputLevel;
    }
    return this.envelope;
  }
}

// 使用包络调制多个参数
const env = envelopeFollower.process(rmsEnergy);
filterCutoff = baseFreq + env * modulationDepth;
harmonicBrightness = 0.5 + env * 0.5;
reverbWet = 0.1 + (1 - env) * 0.2;  // 能量弱时混响增强
```

#### A3. 瞬态检测与合成 (解决钢琴/吉他起音问题)

**原理**: 检测 OnsetDetector 触发时刻，叠加短时噪声/脉冲

```javascript
// 在 handleArticulation('attack') 时触发
synthesizer.triggerTransient(frequency) {
  // 钢琴击弦瞬态
  if (instrument === 'piano') {
    const hammerNoise = new Tone.Noise('pink');
    const env = new Tone.Envelope(0.001, 0.02, 0, 0.02);
    hammerNoise.connect(env);
    env.connect(this.output);

    hammerNoise.start();
    env.triggerAttackRelease(0.02);
  }

  // 吉他拨弦瞬态
  if (instrument === 'guitar') {
    const pluck = new Tone.PluckSynth({
      attackNoise: 1,
      dampening: 4000,
      resonance: 0.97
    });
    pluck.triggerAttackRelease(frequency, 0.5);
  }
}
```

#### A4. 绕过 Tone.js 调度器 (降低延迟至 <30ms)

**问题根源**: `Tone.Transport` 和 `context.lookAhead` 引入延迟

**解决方案**: 直接操作 Web Audio API 节点

```javascript
// 替换 synth.triggerAttack(note) → 直接控制振荡器
class DirectAudioSynth {
  start(frequency) {
    const now = Tone.context.currentTime;  // 立即执行，无调度

    this.oscillator.frequency.setValueAtTime(frequency, now);
    this.envelope.gain.cancelScheduledValues(now);
    this.envelope.gain.setValueAtTime(this.envelope.gain.value, now);
    this.envelope.gain.linearRampToValueAtTime(1.0, now + this.attackTime);
  }

  updateFrequency(frequency) {
    const now = Tone.context.currentTime;
    // 使用 exponentialRampTo 实现平滑过渡（比 portamento 更自然）
    this.oscillator.frequency.exponentialRampToValueAtTime(
      frequency,
      now + this.portamentoTime
    );
  }
}
```

**预期效果**: 端到端延迟降至 **20-30ms** (麦克风5ms + 处理15ms + 输出10ms)

---

### 方案 B: LPC 音色迁移 (2-4周实现)

**原理**: Linear Predictive Coding 分离"源-滤波器"

```
哼唱信号 → LPC分析 → 提取共振峰/包络 → 替换为目标乐器包络 → 重合成
  ↓                                        ↓
 F0检测                               乐器特征数据库
```

#### B1. LPC 实现 (Web Audio)

**库选择**:
- `ml5.js` (浏览器友好)
- 或自实现 Levinson-Durbin 算法 (200行代码)

```javascript
class LPCVoiceFilter {
  constructor(order = 12) {
    this.order = order;  // LPC阶数 (12足够语音/人声)
  }

  analyze(audioBuffer) {
    // 1. 自相关计算
    const autocorr = this.autocorrelation(audioBuffer, this.order);

    // 2. Levinson-Durbin 求解 LPC 系数
    const lpcCoeffs = this.levinsonDurbin(autocorr);

    // 3. 提取共振峰 (根查找)
    const formants = this.findFormants(lpcCoeffs);

    return { lpcCoeffs, formants };
  }

  synthesize(f0, targetFormants, excitation) {
    // 用检测到的 F0 驱动振荡器，用目标共振峰滤波
    const source = this.generateHarmonicExcitation(f0);
    const filtered = this.applyLPCFilter(source, targetFormants);
    return filtered;
  }
}
```

#### B2. 目标乐器特征库

**采集方案**:
1. 录制真实乐器音色样本 (每个乐器 10-20 段)
2. 离线提取 LPC 系数和共振峰
3. 存储为 JSON 预设

```json
{
  "saxophone_tenor": {
    "formants": [
      { "freq": 600, "bandwidth": 80, "gain": 1.0 },
      { "freq": 1200, "bandwidth": 120, "gain": 0.6 },
      { "freq": 2400, "bandwidth": 200, "gain": 0.3 }
    ],
    "breathNoise": 0.15,
    "vibrato": { "rate": 5.5, "depth": 0.08 }
  }
}
```

#### B3. 集成到现有架构

```javascript
// 在 ContinuousSynthEngine 中替换合成方法
class LPCContinuousSynth extends ContinuousSynthEngine {
  constructor(options) {
    super(options);
    this.lpcEngine = new LPCVoiceFilter(12);
    this.targetProfiles = loadInstrumentProfiles();
  }

  processPitchFrame(pitchData) {
    const { frequency, confidence, expressiveness } = pitchData;

    // 实时音色迁移
    const targetFormants = this.targetProfiles[this.currentInstrument].formants;
    const outputSignal = this.lpcEngine.synthesize(
      frequency,
      targetFormants,
      this.generateExcitation(frequency, expressiveness)
    );

    this.playBuffer(outputSignal);
  }
}
```

**优势**:
- 音色自然度提升 40-60%
- 仍保持低延迟 (LPC计算 <5ms)
- 可用真实乐器数据

**劣势**:
- 仍有"合成味"（共振峰模型简化）
- 需要采集/标注数据

---

## 4. 中期升级路径 (1-2月)

### 方案 C: DDSP (Differentiable Digital Signal Processing)

**选择理由**:
- ✅ Google Magenta 官方支持 (TensorFlow.js 可用)
- ✅ 模型小 (~5MB)，可实时推理
- ✅ 可解释性强（谐波+噪声分支）
- ✅ 训练数据需求中等 (500-1000段音频)

#### C1. DDSP 架构

```
输入特征 (F0, Loudness, Timbre Embedding)
    ↓
  Encoder (小型MLP)
    ↓
 ├─ Harmonic Branch → 谐波振幅 (100 bins)
 └─ Noise Branch → 噪声包络 (65 bins)
    ↓
 可微DSP模块 (实时合成)
    ↓
  输出音频
```

**关键特性**:
- F0 可控 (直接用 YIN 检测结果)
- Loudness 可控 (用 RMS 能量)
- 音色可插值 (多种乐器混合)

#### C2. TensorFlow.js 实现

```javascript
import * as tf from '@tensorflow/tfjs';

class DDSPSynthesizer {
  async loadModel(instrumentName) {
    // 加载预训练模型 (每个乐器一个模型)
    this.model = await tf.loadGraphModel(`/models/ddsp_${instrumentName}/model.json`);
  }

  async synthesize(f0Array, loudnessArray, timbreEmbedding) {
    // 输入格式: [batchSize, sequenceLength, features]
    const inputs = tf.tensor3d([[
      f0Array,           // [64] 每帧的F0
      loudnessArray,     // [64] 每帧的响度
      timbreEmbedding    // [16] 音色嵌入向量
    ]]);

    // 推理
    const outputs = await this.model.executeAsync(inputs);
    const harmonicAmps = outputs[0];  // [64, 100] 谐波幅度
    const noiseEnvelope = outputs[1]; // [64, 65] 噪声包络

    // 实时 DSP 合成
    const audioBuffer = this.ddspCore.synthesize(
      harmonicAmps.arraySync(),
      noiseEnvelope.arraySync()
    );

    return audioBuffer;
  }
}
```

#### C3. 训练数据采集方案

**方案 1: 使用开源数据集**
- NSynth Dataset (Google, 30万音频)
- URMP (单音轨乐器, 免费)
- Philharmonia Orchestra (免费采样包)

**方案 2: 自己录制**
- 每种乐器录制 500 段 (各种音高、力度)
- 标注 F0、响度包络
- 用 Magenta DDSP 训练脚本

**训练成本**:
- GPU 训练: 8小时 (单乐器, RTX 3080)
- 数据标注: 20-40 小时 (可半自动化)

#### C4. 实时性优化

**挑战**: TensorFlow.js 推理延迟 ~30-50ms

**优化策略**:
1. 量化模型 (INT8) → 速度提升 2x
2. 使用 WebGL 后端 (GPU 加速)
3. 帧批处理 (每次推理 64 帧, ~700ms 音频)
4. 双缓冲机制 (边播放边计算下一批)

```javascript
class StreamingDDSP {
  constructor() {
    this.bufferSize = 64;  // 帧数
    this.hopSize = 256;    // 每帧采样数
    this.latency = (this.bufferSize * this.hopSize) / sampleRate;  // ~370ms

    this.inputQueue = [];
    this.outputQueue = [];
    this.isProcessing = false;
  }

  async processStream() {
    while (true) {
      // 收集 64 帧特征
      if (this.inputQueue.length >= 64) {
        const batch = this.inputQueue.splice(0, 64);
        const audio = await this.ddsp.synthesize(batch);
        this.outputQueue.push(audio);
      }
      await sleep(10);  // 10ms 检查周期
    }
  }
}
```

**预期延迟**: **40-60ms** (可接受)

---

## 5. 长期AI方案 (3-6月)

### 方案 D: RAVE (Real-time Audio Variational autoEncoder)

**适用场景**: 追求最高音质，可接受 50-100ms 延迟

#### D1. RAVE 架构

```
输入音频 → Encoder (卷积) → Latent Space (16维) → Decoder (转置卷积) → 输出音频
              ↓                                             ↑
         变分采样                                     音色条件
```

**训练方式**:
- 数据: 每种乐器 30-60 分钟高质量录音
- 损失: 重建损失 + KL散度 + 多尺度频谱损失
- 时间: 单乐器 20-40 小时 (A100 GPU)

#### D2. 条件控制

```python
# 训练时条件化
latent = encoder(audio, instrument_id=5)  # 5=saxophone

# 推理时音色迁移
vocal_latent = encoder(vocal_audio, instrument_id=0)
sax_audio = decoder(vocal_latent, instrument_id=5)
```

#### D3. Web 部署挑战

**问题**:
- 模型大 (~20-50MB)
- 需要 ONNX Runtime Web / TF.js
- 延迟 50-100ms (卷积层多)

**解决方案**:
- 使用 RAVE-lite (精简版, 10MB)
- WebAssembly + SIMD 优化
- 服务器端推理 (WebRTC 传输)

---

## 6. 实施优先级矩阵

### 推荐执行顺序

#### 🔥 **Phase 1: 立即行动 (本周)**
```
A1. 多振荡器谐波合成 (钢琴/吉他)
A4. 绕过 Tone.js 调度器 (降低延迟)
A3. 瞬态合成 (击弦/拨弦)
```
**目标**: 钢琴/吉他/长笛从"不可用"→"基本可用"，延迟降至 30ms 以下

**工作量**: 3-5 天

---

#### ⚡ **Phase 2: 短期优化 (2-3周)**
```
A2. 包络跟随与动态调制
B1-B3. LPC 音色迁移原型
```
**目标**: 音质提升 50%，接近"真实乐器"

**工作量**: 10-15 天

---

#### 🚀 **Phase 3: 中期升级 (1-2月)**
```
C1-C4. DDSP 实现与训练
数据采集: NSynth 数据集下载 + 预处理
模型训练: 6 种乐器各训练一个模型
```
**目标**: 达到商业级音质

**工作量**: 30-50 天 (包含学习成本)

---

#### 🌟 **Phase 4: 长期探索 (3-6月)**
```
D. RAVE 研究与实验
WebRTC 服务器端推理架构
```
**目标**: 最高音质 + 零样本音色迁移

**工作量**: 60-120 天

---

## 7. 决策建议

### 如果你希望"尽快修复钢琴/吉他/长笛"

→ **立即执行 Phase 1 (方案 A1+A3+A4)**

**理由**:
- 无需训练数据
- 无需AI模型
- 完全控制在你的代码库
- 1 周内见效

**风险**: 音质仍有"合成味"，但显著好于现状

---

### 如果你希望"接近真实乐器音色"

→ **Phase 1 + Phase 2 (方案 A + B)**

**理由**:
- LPC 音色迁移成熟可靠
- 可用真实乐器数据
- 仍保持低延迟

**风险**: 需要录制/采集真实乐器音色样本

---

### 如果你希望"探索AI前沿，追求极致音质"

→ **Phase 3 (DDSP)**

**理由**:
- Google 官方支持
- 可解释性强
- 社区活跃

**风险**:
- 需要学习 TensorFlow.js
- 需要 GPU 训练
- 需要 1-2 月时间投入

---

## 8. 下一步行动

请回答以下问题，我将提供具体实施方案：

1. **时间预算**: 你希望多久内看到改进？(1周 / 2周 / 1月)
2. **可接受的延迟**: <30ms / <50ms / <100ms
3. **是否愿意录制真实乐器样本**: 是 / 否
4. **是否愿意学习 TensorFlow.js/DDSP**: 是 / 否 / 需要培训资料
5. **优先级**: 先修复现有 5 种乐器 / 还是先增加新乐器种类

---

## 附录

### A. 相关论文与资源

**DDSP**:
- 论文: "DDSP: Differentiable Digital Signal Processing" (ICLR 2020)
- 代码: https://github.com/magenta/ddsp
- Colab: https://colab.research.google.com/github/magenta/ddsp/blob/main/ddsp/colab/demos/timbre_transfer.ipynb

**RAVE**:
- 论文: "RAVE: A variational autoencoder for fast and high-quality neural audio synthesis" (2021)
- 代码: https://github.com/acids-ircam/RAVE

**LPC/共振峰**:
- 经典教材: "Digital Processing of Speech Signals" (Rabiner & Schafer)
- Web 实现: https://github.com/cwilso/PitchDetect

**数据集**:
- NSynth: https://magenta.tensorflow.org/datasets/nsynth
- URMP: http://www2.ece.rochester.edu/projects/air/projects/URMP.html
- Philharmonia: https://philharmonia.co.uk/resources/sound-samples/

### B. 技术栈对比表

| 技术 | 库/框架 | 浏览器支持 | 学习曲线 | 社区 |
|------|---------|-----------|---------|------|
| **Tone.js** | ⭐⭐⭐⭐⭐ | ✅ 完美 | ⭐⭐ 简单 | 活跃 |
| **Web Audio API** | 原生 | ✅ 完美 | ⭐⭐⭐ 中等 | 成熟 |
| **TensorFlow.js** | ⭐⭐⭐⭐ | ✅ 良好 | ⭐⭐⭐⭐ 陡峭 | 活跃 |
| **ONNX Runtime Web** | ⭐⭐⭐ | ⚠️ 需Polyfill | ⭐⭐⭐⭐ 陡峭 | 成长中 |
| **WebAssembly+DSP** | 自实现 | ✅ 完美 | ⭐⭐⭐⭐⭐ 困难 | 小众 |

---

**文档维护者**: Claude + ZenAlexa
**最后更新**: 2025-11-06
**版本历史**: 见 [Git Blame](git blame docs/synthesis/TECH_ROADMAP.md)

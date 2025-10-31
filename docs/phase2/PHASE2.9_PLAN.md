# Phase 2.9 规划 - AudioWorklet 路径恢复

**日期**: 2025-11-01
**状态**: ⏳ 规划中
**前置条件**: Phase 2.8 完成 (代码实现), Phase 2.7 验证通过
**目标**: 恢复 AudioWorklet 模式，实现 8-15ms 低延迟音频处理

---

## 📊 当前状态分析

### 现有实现

**Phase 1 成果 (已完成)**:
- ✅ AudioWorklet 基础架构 ([js/audio-io.js](../../js/audio-io.js))
- ✅ YIN 音高检测 Worklet ([js/pitch-worklet.js](../../js/pitch-worklet.js))
- ✅ 模式切换逻辑 (Worklet ↔ ScriptProcessor)
- ✅ 配置系统 ([js/audio-config.js](../../js/audio-config.js))

**Phase 2 新增 (已完成)**:
- ✅ ExpressiveFeatures 管道 ([js/features/expressive-features.js](../../js/features/expressive-features.js))
- ✅ PitchFrame 数据结构 (11 个字段)
- ✅ 频谱分析 (AnalyserNode FFT)
- ✅ 平滑滤波器 (Kalman, EMA)
- ✅ OnsetDetector (起音检测)

### 当前配置

**文件**: [js/audio-config.js](../../js/audio-config.js)

```javascript
// Line 28
USE_AUDIO_WORKLET: true,  // ✅ 已启用

// Line 14-20
BUFFER_SIZE_WORKLET: 128,         // 2.9ms @ 44.1kHz
BUFFER_SIZE_WORKLET_FALLBACK: 256, // 5.8ms (Safari)
BUFFER_SIZE_LEGACY: 2048,         // 46ms (当前使用)
```

**文件**: [js/audio-io.js](../../js/audio-io.js)

```javascript
// Line 32
useWorklet: false,  // ❌ 禁用状态 (Phase 1.7 遗留)
```

### 延迟对比

| 模式 | Buffer Size | 理论延迟 | 实际延迟 | 状态 |
|-----|------------|---------|---------|------|
| **ScriptProcessor** | 2048 samples | 46.44 ms | 78.79 ms | ✅ 当前使用 |
| **AudioWorklet (Chrome)** | 128 samples | 2.90 ms | 8-15 ms | ⏳ 待恢复 |
| **AudioWorklet (Safari)** | 256 samples | 5.80 ms | 12-20 ms | ⏳ 待恢复 |

---

## ❌ 核心问题

### 问题 1: ExpressiveFeatures 与 Worklet 隔离

**症状**:
- ExpressiveFeatures 在主线程运行
- pitch-worklet.js 在 AudioWorklet 线程运行
- 两者无法共享内存或 DOM (Web Audio API 限制)

**数据流现状 (ScriptProcessor 模式)**:
```
Microphone
  ↓
ScriptProcessor.onaudioprocess (主线程)
  ↓
ExpressiveFeatures.process(buffer) (主线程)
  ├─ PitchDetector.detect() (YIN 算法)
  ├─ AnalyserNode.getFloatFrequencyData() (FFT)
  ├─ SmoothingFilters (Kalman, EMA)
  └─ OnsetDetector
  ↓
PitchFrame (11 fields)
  ↓
ContinuousSynth.processPitchFrame()
```

**数据流期望 (AudioWorklet 模式)**:
```
Microphone
  ↓
AudioWorkletNode.process() (Worklet 线程)
  ↓
??? ExpressiveFeatures 如何调用 ???
  ❌ 无法访问 AnalyserNode (主线程节点)
  ❌ 无法调用 ExpressiveFeatures (主线程对象)
  ❌ 只能用 postMessage 传递数据
```

### 问题 2: AnalyserNode 在主线程

**ExpressiveFeatures 依赖 AnalyserNode**:
- [js/features/expressive-features.js:156-158](../../js/features/expressive-features.js#L156-L158)

```javascript
// 需要 AnalyserNode 获取 FFT 数据
this.analyser.getFloatFrequencyData(this.frequencyData);
const spectralFeatures = SpectralFeatures.extract(this.frequencyData, ...);
```

**问题**:
- AnalyserNode 必须在主线程创建和连接
- AudioWorklet 线程无法访问主线程的 Web Audio 节点
- 只能通过 postMessage 传递频谱数据

### 问题 3: Buffer 大小不一致

**当前实现**:
- ScriptProcessor: 2048 samples (足够 YIN + FFT)
- AudioWorklet: 128 samples (渲染量子)
- ExpressiveFeatures 需要至少 2048 samples 才能运行 YIN + FFT

**冲突**:
- Worklet 每次只能处理 128 samples
- 需要累积 16 次才能达到 2048 samples
- 延迟增加: 16 × 2.9ms = 46ms (回到 ScriptProcessor 水平!)

---

## 🎯 解决方案设计

### 方案 A: Worklet 端完整实现 (推荐)

**架构**:
```
Microphone
  ↓
AudioWorkletNode.process() (Worklet 线程)
  ├─ 累积 128 → 2048 samples (每 16 帧处理一次)
  ├─ YIN 音高检测 (已实现)
  ├─ FFT 频谱分析 (需实现)
  ├─ 平滑滤波 (需移植)
  ├─ 起音检测 (需移植)
  └─ 生成 PitchFrame
  ↓
postMessage → 主线程
  ↓
ContinuousSynth.processPitchFrame()
```

**优点**:
- ✅ 完全在 Worklet 线程运行，最小延迟
- ✅ 不依赖主线程 AnalyserNode
- ✅ 架构清晰，职责分离

**缺点**:
- ❌ 需要在 Worklet 实现 FFT (或使用库)
- ❌ 需要移植 ExpressiveFeatures (~500 行)
- ❌ 代码重复 (主线程和 Worklet 各一份)

**工作量**: ~400 行新代码 (FFT + 移植)

---

### 方案 B: 混合架构 (快速但不优雅)

**架构**:
```
Microphone
  ↓
AudioWorkletNode.process() (Worklet 线程)
  ├─ 累积 buffer
  └─ postMessage(rawBuffer) → 主线程
  ↓
主线程
  ├─ ExpressiveFeatures.process(rawBuffer)
  ├─ 使用 AnalyserNode (已连接)
  └─ 生成 PitchFrame
  ↓
ContinuousSynth.processPitchFrame()
```

**优点**:
- ✅ 复用现有 ExpressiveFeatures 代码
- ✅ 工作量小 (~100 行修改)
- ✅ AnalyserNode 可以继续使用

**缺点**:
- ❌ postMessage 开销 (2048 Float32Array)
- ❌ 主线程阻塞风险
- ❌ 延迟增加 (postMessage + 处理时间)

**工作量**: ~100 行修改

---

### 方案 C: 渐进式迁移 (推荐用于实施)

**阶段 1**: 简化 FFT (只计算 Spectral Centroid)
- 不使用 AnalyserNode，手动实现简化 FFT
- 只计算 brightness, breathiness (2 个频域特征)
- 工作量: ~150 行 (FFT 基础实现)

**阶段 2**: 移植平滑滤波器
- Kalman Filter (cents 平滑)
- EMA Filter (volume, brightness 平滑)
- 工作量: ~50 行 (直接复制)

**阶段 3**: 移植 OnsetDetector
- 起音检测逻辑
- 工作量: ~100 行 (复制 + 测试)

**总工作量**: ~300 行 (分阶段实施)

---

## 📋 实施计划 (方案 C)

### Task 1: Worklet 端简化 FFT 实现

**文件**: [js/pitch-worklet.js](../../js/pitch-worklet.js)

**新增代码** (~150 行):
```javascript
/**
 * 简化 FFT 实现 (仅计算 Spectral Centroid)
 * 使用 Cooley-Tukey 算法 (2048 点 FFT)
 */
class SimpleFFT {
    constructor(size = 2048) {
        this.size = size;
        this.halfSize = size / 2;

        // 预计算旋转因子 (twiddle factors)
        this.cosTable = new Float32Array(this.halfSize);
        this.sinTable = new Float32Array(this.halfSize);

        for (let i = 0; i < this.halfSize; i++) {
            const angle = -2 * Math.PI * i / size;
            this.cosTable[i] = Math.cos(angle);
            this.sinTable[i] = Math.sin(angle);
        }

        // 工作缓冲区
        this.realOut = new Float32Array(size);
        this.imagOut = new Float32Array(size);
    }

    /**
     * 计算功率谱 (仅关心幅度)
     */
    computePowerSpectrum(input) {
        // 简化版: 只计算前 halfSize 个频率 bin
        const powerSpectrum = new Float32Array(this.halfSize);

        for (let k = 0; k < this.halfSize; k++) {
            let real = 0, imag = 0;

            for (let n = 0; n < this.size; n++) {
                const angle = (2 * Math.PI * k * n) / this.size;
                real += input[n] * Math.cos(angle);
                imag += input[n] * Math.sin(angle);
            }

            // 功率谱 = |FFT|^2
            powerSpectrum[k] = real * real + imag * imag;
        }

        return powerSpectrum;
    }

    /**
     * 计算 Spectral Centroid (质心频率)
     */
    computeSpectralCentroid(powerSpectrum, sampleRate) {
        let weightedSum = 0;
        let totalPower = 0;

        for (let k = 0; k < this.halfSize; k++) {
            const frequency = (k * sampleRate) / this.size;
            weightedSum += frequency * powerSpectrum[k];
            totalPower += powerSpectrum[k];
        }

        return totalPower > 0 ? weightedSum / totalPower : 0;
    }

    /**
     * 计算频谱平坦度 (breathiness 指标)
     */
    computeSpectralFlatness(powerSpectrum) {
        let geometricMean = 0;
        let arithmeticMean = 0;
        let count = 0;

        for (let k = 0; k < this.halfSize; k++) {
            if (powerSpectrum[k] > 0) {
                geometricMean += Math.log(powerSpectrum[k]);
                arithmeticMean += powerSpectrum[k];
                count++;
            }
        }

        if (count === 0) return 0;

        geometricMean = Math.exp(geometricMean / count);
        arithmeticMean /= count;

        return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
    }
}
```

**集成到 PitchDetectorWorklet**:
```javascript
constructor(options) {
    super();
    // ...

    // Phase 2.9: 添加 FFT 处理器
    this.fft = new SimpleFFT(2048);

    // Phase 2.9: 频域特征历史 (用于平滑)
    this.brightnessHistory = [];
    this.breathinessHistory = [];
}

process(inputs, outputs, parameters) {
    // ...累积 buffer 到 2048...

    if (this.accumulationFull) {
        // YIN 音高检测 (已有)
        const pitch = this.detector(this.accumulationBuffer);

        // Phase 2.9: FFT 频域分析
        const powerSpectrum = this.fft.computePowerSpectrum(this.accumulationBuffer);
        const spectralCentroid = this.fft.computeSpectralCentroid(powerSpectrum, this.config.sampleRate);
        const spectralFlatness = this.fft.computeSpectralFlatness(powerSpectrum);

        // 映射到 PitchFrame 字段
        const brightness = this._normalizeBrightness(spectralCentroid);
        const breathiness = Math.min(spectralFlatness, 1.0);

        // 平滑处理
        const smoothedBrightness = this._smoothBrightness(brightness);
        const smoothedBreathiness = this._smoothBreathiness(breathiness);

        // 发送完整 PitchFrame
        this.port.postMessage({
            type: 'pitch-frame',
            data: {
                // 基础音高 (已有)
                frequency: pitch,
                note: this._noteFromFrequency(pitch),
                // ...

                // Phase 2.9 新增
                brightness: smoothedBrightness,
                breathiness: smoothedBreathiness,
                spectralCentroid: spectralCentroid
            }
        });
    }
}
```

---

### Task 2: 移植平滑滤波器

**文件**: [js/pitch-worklet.js](../../js/pitch-worklet.js)

**复制来源**: [js/features/smoothing-filters.js](../../js/features/smoothing-filters.js)

**新增代码** (~50 行):
```javascript
/**
 * EMA 滤波器 (指数移动平均)
 * 用于 volume, brightness, breathiness
 */
class EMAFilter {
    constructor(alpha = 0.3) {
        this.alpha = alpha;
        this.value = null;
    }

    update(newValue) {
        if (this.value === null) {
            this.value = newValue;
        } else {
            this.value = this.alpha * newValue + (1 - this.alpha) * this.value;
        }
        return this.value;
    }
}

// 在 constructor 中初始化
this.brightnessFilter = new EMAFilter(0.3);
this.breathinessFilter = new EMAFilter(0.4);
this.volumeFilter = new EMAFilter(0.3);

// 使用
_smoothBrightness(brightness) {
    return this.brightnessFilter.update(brightness);
}
```

---

### Task 3: 移植 OnsetDetector (简化版)

**文件**: [js/pitch-worklet.js](../../js/pitch-worklet.js)

**新增代码** (~80 行):
```javascript
/**
 * 简化起音检测器 (基于能量突增)
 */
class SimpleOnsetDetector {
    constructor() {
        this.energyHistory = [];
        this.historySize = 5;
        this.threshold = 6; // dB
        this.currentState = 'silence';
        this.lastStateChange = 0;
        this.minStateDuration = 50; // ms
    }

    detect(buffer, volumeDb, currentTime) {
        // 计算当前能量
        const recentEnergy = volumeDb;

        // 历史平均能量
        this.energyHistory.push(recentEnergy);
        if (this.energyHistory.length > this.historySize) {
            this.energyHistory.shift();
        }

        const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
        const energyIncrease = recentEnergy - avgEnergy;

        // 状态转换逻辑
        let newState = this.currentState;

        if (volumeDb < -40) {
            newState = 'silence';
        } else if (energyIncrease > this.threshold && this.currentState === 'silence') {
            newState = 'attack';
        } else if (this.currentState === 'attack') {
            const timeSinceChange = currentTime - this.lastStateChange;
            if (timeSinceChange > this.minStateDuration) {
                newState = 'sustain';
            }
        } else if (volumeDb > -40 && this.currentState !== 'attack') {
            newState = 'sustain';
        } else if (volumeDb < -30 && this.currentState === 'sustain') {
            newState = 'release';
        }

        if (newState !== this.currentState) {
            this.currentState = newState;
            this.lastStateChange = currentTime;
        }

        return this.currentState;
    }
}

// 在 constructor 中初始化
this.onsetDetector = new SimpleOnsetDetector();

// 使用
const articulation = this.onsetDetector.detect(
    this.accumulationBuffer,
    volumeDb,
    currentTime
);
```

---

### Task 4: 修改 AudioIO 消息处理

**文件**: [js/audio-io.js](../../js/audio-io.js)

**修改点 1**: `_handleWorkletMessage()` (Line 418-460)

```javascript
_handleWorkletMessage(event) {
    const { type, data } = event.data;

    switch (type) {
        case 'ready':
            console.log('[AudioIO] ✅ Worklet 已就绪');
            break;

        // Phase 1 已有
        case 'pitch-detected':
            if (this.onPitchDetectedCallback) {
                this.onPitchDetectedCallback(data);
            }
            break;

        // Phase 2.9 新增: 完整 PitchFrame
        case 'pitch-frame':
            // 传递完整的 PitchFrame 到主线程
            if (this.onFrameCallback) {
                this.onFrameCallback(data, data.timestamp);
            }
            break;

        case 'no-pitch':
            // 未检测到音高
            break;

        default:
            console.warn('[AudioIO] 未知消息类型:', type);
    }
}
```

---

### Task 5: 启用 AudioWorklet 模式

**文件**: [js/audio-io.js](../../js/audio-io.js)

**修改点**: Line 32

```javascript
// 修改前
useWorklet: false,  // Phase 1.7 禁用

// 修改后
useWorklet: true,   // Phase 2.9 恢复
```

**验证方式**:
- 打开浏览器控制台
- 看到 `选择模式: worklet`
- 看到 `理论延迟: 2.90ms` (Chrome) 或 `5.80ms` (Safari)

---

### Task 6: 浏览器验证

**测试场景**:

1. **延迟测试**: 唱 "啊~~~"，观察声音响应速度
   - 预期: 明显快于 ScriptProcessor 模式
   - 控制台: 看到 `延迟: 8-15ms`

2. **特征准确性**: 重复 Phase 2.7 的 6 个测试场景
   - Cents 精细调整
   - Brightness 音色亮度
   - Breathiness 气声效果
   - Articulation 起音触发

3. **稳定性测试**: 持续哼唱 2 分钟
   - 预期: 无音频断裂，无丢帧
   - 控制台: `dropouts: 0`

---

## 📈 预期成果

### 代码交付

| 文件 | 新增行数 | 修改行数 | 说明 |
|-----|---------|---------|------|
| js/pitch-worklet.js | ~280 | ~50 | FFT + 滤波器 + OnsetDetector |
| js/audio-io.js | 0 | ~20 | 消息处理 + useWorklet 启用 |
| docs/phase2/PHASE2.9_VERIFICATION.md | ~150 | 0 | 验证指南 |
| docs/phase2/PHASE2_PROGRESS.md | 0 | ~30 | 进度更新 |

**总计**: ~430 行新代码

### 性能目标

| 指标 | 当前 (ScriptProcessor) | 目标 (Worklet) | 改善 |
|-----|----------------------|---------------|------|
| **理论延迟** | 46.44 ms | 2.90 ms | **-94%** |
| **实际延迟** | 78.79 ms | 8-15 ms | **-81%** |
| **Buffer Size** | 2048 samples | 128 samples | **-94%** |
| **CPU 占用** | 主线程阻塞 | Worklet 线程隔离 | 更流畅 |

### 文档交付

- ✅ PHASE2.9_PLAN.md (本文档)
- ⏳ PHASE2.9_VERIFICATION.md (验证指南)
- ⏳ PHASE2.9_IMPLEMENTATION_LOG.md (实施日志)
- ⏳ PHASE2_PROGRESS.md 更新

---

## ⚠️ 风险与对策

### 风险 1: FFT 性能不足

**风险**: 简化 FFT 实现可能太慢，导致 Worklet 线程阻塞

**对策**:
- 使用 WASM 优化 FFT (如 fft.js)
- 降低 FFT 大小: 2048 → 1024
- 降低处理频率: 每 2 次累积才处理一次

### 风险 2: Safari 兼容性问题

**风险**: Safari AudioWorklet 已知有 buffer size 限制

**对策**:
- 自动检测 Safari: 使用 256 buffer (已实现)
- 回退到 ScriptProcessor (已实现)
- 文档标注 Safari 性能差异

### 风险 3: OnsetDetector 精度下降

**风险**: 简化版 OnsetDetector 可能不如 Phase 2.4 完整版

**对策**:
- 保留 Phase 2.4 测试用例
- 验证简化版能通过相同测试
- 如果失败，考虑完整移植 (~200 行)

---

## 📅 时间估算

| 任务 | 预计时间 | 优先级 |
|-----|---------|-------|
| Task 1: 简化 FFT 实现 | 1.5 小时 | P0 |
| Task 2: 移植平滑滤波器 | 0.5 小时 | P0 |
| Task 3: 移植 OnsetDetector | 1 小时 | P0 |
| Task 4: AudioIO 消息处理 | 0.5 小时 | P0 |
| Task 5: 启用 Worklet 模式 | 0.1 小时 | P0 |
| Task 6: 浏览器验证 | 1 小时 | P0 |
| 文档编写 | 0.5 小时 | P1 |
| **总计** | **5 小时** | - |

**实施建议**: 分 2 个工作时段完成
- 时段 1 (2.5 小时): Task 1-3 (核心实现)
- 时段 2 (2.5 小时): Task 4-6 (集成和验证)

---

## 🎯 成功标准

### 必须满足 (P0)

1. ✅ Worklet 模式成功启动 (无回退到 ScriptProcessor)
2. ✅ 实际延迟 < 20ms (Chrome), < 30ms (Safari)
3. ✅ 所有 Phase 2.7 测试场景通过
4. ✅ 无音频断裂或丢帧 (2 分钟持续测试)
5. ✅ PitchFrame 11 个字段全部有效

### 应该满足 (P1)

1. ✅ FFT 处理时间 < 1ms (不阻塞 Worklet)
2. ✅ Brightness/Breathiness 误差 < 10% (vs Phase 2.7)
3. ✅ Articulation 检测准确率 > 80% (断音场景)
4. ✅ 文档完整且清晰

### 可选满足 (P2)

1. ✅ Safari 完全兼容 (256 buffer)
2. ✅ 支持运行时切换 Worklet ↔ ScriptProcessor
3. ✅ 性能监控面板 (CPU, 延迟, 丢帧)

---

## 📝 相关文档

- [PHASE2_PROGRESS.md](PHASE2_PROGRESS.md) - Phase 2 总体进度
- [PHASE2.7_VERIFICATION_RESULT.md](PHASE2.7_VERIFICATION_RESULT.md) - Continuous 模式验证
- [PHASE2.8_SUMMARY.md](PHASE2.8_SUMMARY.md) - Legacy 模式总结
- [../../js/audio-io.js](../../js/audio-io.js) - AudioIO 抽象层
- [../../js/pitch-worklet.js](../../js/pitch-worklet.js) - Worklet 处理器
- [../../js/features/expressive-features.js](../../js/features/expressive-features.js) - 特征提取

---

**规划日期**: 2025-11-01
**规划人员**: Claude Code + Ziming Wang
**下一步**: 开始 Task 1 - 简化 FFT 实现
**预计完成**: Phase 2.9 验证通过后，进入 Phase 2.10 (测试完善)

# Phase 2 性能评估和优化方案

**日期**: 2025-10-31
**状态**: Phase 2.5 前置规划

---

## 1. 当前性能现状

### 1.1 音频处理链路

**ScriptProcessor 模式** (当前默认):
```
Buffer Size: 2048 samples
Latency: ~46ms @ 44.1kHz
Processing per frame:
  - YIN Pitch Detection: ~5-8ms
  - Volume Calculation: <0.1ms
  - Synth Update: <1ms
  ───────────────────────────────
  Total: ~6-9ms (剩余 ~37-40ms 余量)
```

**AudioWorklet 模式** (Phase 1 已实现):
```
Buffer Size: 128 samples
Latency: ~2.9ms @ 44.1kHz
Processing per frame:
  - YIN Pitch Detection (in Worklet): ~0.5-1ms
  - Main Thread Overhead: <0.5ms
  ───────────────────────────────
  Total: ~1-1.5ms (剩余 ~1.4-1.9ms 余量)
```

### 1.2 性能瓶颈分析

**当前 CPU 占用** (Phase 1):
- YIN 算法: **占主要时间** (2048 buffer 下 5-8ms)
- Tone.js 合成: <1ms
- UI 更新: <0.5ms

**Phase 2 新增负载预估**:
| 模块 | 操作 | 预估耗时 (2048 buffer) |
|------|------|------------------------|
| AudioUtils.calculateRMS | RMS 计算 | ~0.1ms |
| SmoothingFilters | Kalman/EMA 更新 | ~0.05ms (3个滤波器) |
| OnsetDetector | 状态机 + 能量包络 | ~0.1ms |
| **SpectralFeatures** | **FFT 2048 + 频谱分析** | **~8-12ms** ⚠️ |
| ExpressiveFeatures | 数据整合 | ~0.1ms |
| **合计** | | **~8.5-12.5ms** |

**关键发现**:
- ⚠️ **FFT 是新的性能瓶颈**: 纯 JS FFT (2048-size) 可能耗时 8-12ms
- ⚠️ **ScriptProcessor 模式风险**: 6-9ms (Pitch) + 8-12ms (FFT) = **14-21ms**
  - 距离 46ms 限制还有余量，但已吃掉 30-45% 可用时间
- ✅ **AudioWorklet 模式安全**: 128 buffer 下 FFT 只需 ~0.5-1ms

---

## 2. 优化方案对比

### 方案 A: 全面迁移到 AudioWorklet (推荐 ★★★★★)

**策略**:
- Phase 1 已完成 AudioWorklet 基础设施
- 将 ExpressiveFeatures 全部逻辑移到 Worklet
- Main Thread 只负责 UI 和 Synth 控制

**实现步骤**:
1. 修改 `audio-io-processor.js` 传递 audioBuffer 到 Main Thread
2. 或者直接在 Worklet 中集成 ExpressiveFeatures
3. 通过 `port.postMessage()` 传递完整 PitchFrame

**优势**:
- ✅ 延迟降低到 2.9ms (从 46ms)
- ✅ CPU 时间充足 (128 buffer 下 FFT 只需 ~0.5-1ms)
- ✅ 音频处理与 UI 线程隔离，不受主线程卡顿影响

**劣势**:
- ⚠️ 需要在 Worklet 中实现 ES Module (当前 Phase 1 已支持)
- ⚠️ 调试难度稍高 (需要 Worklet 内 console.log)

**时间成本**: Phase 2.6 时顺便实现 (1-2 天)

---

### 方案 B: FFT 降频 + ScriptProcessor 兼容 (折中方案 ★★★☆☆)

**策略**:
- SpectralFeatures 不是每帧运行，每 N 帧运行一次 FFT
- 其他模块 (Kalman, Onset) 仍然每帧运行
- 频域特征插值或保持上一帧值

**实现示例**:
```javascript
class SpectralFeatures {
  constructor(config) {
    this.fftInterval = config.fftInterval || 4;  // 每 4 帧运行一次
    this.frameCount = 0;
    this.lastSpectralData = null;
  }

  analyze(audioBuffer) {
    this.frameCount++;

    if (this.frameCount % this.fftInterval === 0) {
      // 真正运行 FFT
      this.lastSpectralData = this._performFFT(audioBuffer);
    }

    // 返回上一次的结果 (或插值)
    return this.lastSpectralData;
  }
}
```

**优势**:
- ✅ 降低 CPU 占用到 1/N
- ✅ ScriptProcessor 模式兼容性好

**劣势**:
- ⚠️ 频域特征更新率降低 (每 4 帧 = ~186ms @ 44.1kHz/2048)
- ⚠️ brightness/breathiness 响应变慢

**时间成本**: Phase 2.5 实现时配置项 (半天)

---

### 方案 C: Web Audio API AnalyserNode (优化 FFT ★★★★☆)

**策略**:
- 浏览器环境使用 `AnalyserNode.getFloatFrequencyData()`
- Node.js 测试环境使用纯 JS FFT (AudioUtils.performSimpleFFT)
- AnalyserNode 是原生实现，比纯 JS FFT 快 **5-10 倍**

**实现示例**:
```javascript
class SpectralFeatures {
  constructor(config) {
    if (config.audioContext) {
      // 浏览器环境: 使用 AnalyserNode
      this.analyser = config.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.useNativeFFT = true;
    } else {
      // Node.js 测试环境: 使用纯 JS FFT
      this.useNativeFFT = false;
    }
  }

  analyze(audioBuffer) {
    if (this.useNativeFFT) {
      // 原生 FFT (快)
      const spectrum = new Float32Array(this.analyser.frequencyBinCount);
      this.analyser.getFloatFrequencyData(spectrum);
      return this._analyzeSpectrum(spectrum);
    } else {
      // 纯 JS FFT (慢，仅测试用)
      const spectrum = AudioUtils.performSimpleFFT(audioBuffer, 2048);
      return this._analyzeSpectrum(spectrum);
    }
  }
}
```

**优势**:
- ✅ 原生 FFT 性能优秀 (~1-2ms for 2048)
- ✅ 测试环境可用纯 JS FFT

**劣势**:
- ⚠️ 需要连接 AnalyserNode 到音频链路
- ⚠️ ScriptProcessor 回调中没有直接 AudioNode

**时间成本**: Phase 2.5 实现 (1 天)

---

## 3. 推荐方案组合 (★★★★★)

### 阶段化实施策略:

#### Phase 2.5-2.6 (短期):
1. **使用方案 C (AnalyserNode)** 优化 FFT
2. **使用方案 B (降频)** 作为兜底策略
   - 配置项: `fftInterval: 2` (每 2 帧运行一次)
   - 保守估计: 8-12ms / 2 = **4-6ms**

**预期性能** (ScriptProcessor 模式):
```
YIN Pitch Detection:   ~6ms
ExpressiveFeatures:     ~5ms (含 FFT/2)
Synth Update:           ~1ms
────────────────────────────
Total:                 ~12ms / 46ms = 26% CPU 占用 ✅
```

#### Phase 2.7+ (长期):
1. **迁移到 AudioWorklet (方案 A)**
   - Phase 2.7 重构时顺便实现
   - 完全解决性能问题

**预期性能** (AudioWorklet 模式):
```
Buffer Size: 128 samples
Latency: 2.9ms
YIN + ExpressiveFeatures (in Worklet): ~1.5ms
────────────────────────────────
Total: ~1.5ms / 2.9ms = 52% CPU 占用 ✅
```

---

## 4. 性能监控增强

### 4.1 在 `performance.js` 中添加细分统计

```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      // 现有指标
      sampleRate: 0,
      totalLatency: 0,

      // Phase 2 新增
      pitchDetectionTime: 0,
      expressiveFeaturesTime: 0,
      fftTime: 0,
      synthUpdateTime: 0,

      // 统计
      avgPitchDetectionTime: 0,
      avgExpressiveFeaturesTime: 0,
      avgFFTTime: 0
    };
  }

  startPitchDetection() {
    this.pitchDetectionStart = performance.now();
  }

  endPitchDetection() {
    this.metrics.pitchDetectionTime = performance.now() - this.pitchDetectionStart;
    // 更新平均值...
  }

  // 类似方法 for ExpressiveFeatures, FFT, Synth...
}
```

### 4.2 UI 显示细分性能

在 UI 中显示各模块耗时:
```
Performance:
  Latency: 46ms
  ┌─ Pitch Detection: 6.2ms (13%)
  ┌─ Expressive Features: 4.8ms (10%)
  │   ├─ FFT: 3.5ms
  │   ├─ Smoothing: 0.2ms
  │   └─ Onset: 0.1ms
  └─ Synth Update: 0.8ms (2%)
  ──────────────────────────
  Total Processing: 11.8ms / 46ms (26%)
```

---

## 5. 技术债务和优化建议

### 5.1 AudioUtils FFT 归一化

**问题**: `performSimpleFFT()` 返回原始幅度 (未除以 N)
**影响**: SpectralFeatures 需要自行归一化，可能导致数值不一致
**建议**:
- 在 `performSimpleFFT()` 内部统一归一化
- 或在文档中明确说明由调用方负责

### 5.2 AudioWorklet buffer 传递

**问题**: 当前 Worklet 模式没有传递 audioBuffer 到 Main Thread
**影响**: ExpressiveFeatures 无法获取完整数据
**建议**:
- 方案 1: 修改 `audio-io-processor.js` 传递 buffer
  ```javascript
  this.port.postMessage({
    type: 'pitch',
    pitchInfo: result,
    audioBuffer: Array.from(buffer)  // 传递 buffer 副本
  });
  ```
- 方案 2: 直接在 Worklet 中实现 ExpressiveFeatures (推荐)

### 5.3 SpectralFeatures 插值策略

**问题**: FFT 降频后，中间帧的频域特征如何处理？
**建议**:
- 简单策略: 保持上一次 FFT 结果 (Phase 2.5)
- 高级策略: 线性插值 (Phase 2.10 优化)
  ```javascript
  brightness = lerp(lastBrightness, newBrightness, alpha);
  ```

---

## 6. 决策矩阵

| 方案 | 延迟 | CPU 占用 | 实现难度 | 兼容性 | 推荐度 |
|------|------|---------|---------|--------|--------|
| **AudioWorklet (A)** | 2.9ms | 52% | 中 | 现代浏览器 | ★★★★★ |
| **FFT 降频 (B)** | 46ms | 26% | 低 | 全兼容 | ★★★☆☆ |
| **AnalyserNode (C)** | 46ms | 20% | 中 | 浏览器 | ★★★★☆ |
| **组合 (B+C)** | 46ms | 20% | 中 | 浏览器 | ★★★★☆ |
| **终极 (A+C)** | 2.9ms | 40% | 高 | 现代浏览器 | ★★★★★ |

---

## 7. 行动计划

### Phase 2.5 (立即实施):
- [ ] 实现 SpectralFeatures (使用 AnalyserNode + 纯 JS FFT 回退)
- [ ] 配置 `fftInterval: 2` (降频策略)
- [ ] 在 ExpressiveFeatures 中集成 SpectralFeatures

### Phase 2.6 (短期):
- [ ] 集成所有子模块到 ExpressiveFeatures
- [ ] 增强性能监控 (细分统计)
- [ ] UI 显示各模块耗时

### Phase 2.7+ (长期):
- [ ] 将 ExpressiveFeatures 迁移到 AudioWorklet
- [ ] 完整 AudioWorklet 数据通路测试
- [ ] 性能对比报告 (ScriptProcessor vs Worklet)

---

## 8. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| FFT 性能不足 | 中 | 高 | 使用 AnalyserNode + 降频 |
| AudioWorklet 兼容性 | 低 | 中 | 保留 ScriptProcessor 回退 |
| 内存占用增加 | 低 | 低 | 监控 PitchFrame 对象数量 |
| 调试困难 | 中 | 中 | 增强日志和性能监控 |

---

**总结**:

当前方案保守且可行:
1. Phase 2.5 先用 **AnalyserNode + FFT 降频** (安全 ✅)
2. Phase 2.7 再迁移到 **AudioWorklet** (终极优化 ⚡)
3. 全程保持向后兼容和性能监控 (可维护 ✅)

这样既能按时完成 Phase 2.5，又为后续优化留下空间。

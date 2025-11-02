# Latency Profiler - 集成指南

## 概述

本文档详细说明如何将延迟剖析工具集成到Kazoo Proto主应用中，实现全链路时间戳采集和延迟分析。

---

## 集成步骤

### Step 1: 启用Feature Flag

在主应用入口处 (index.html 或 main.js) 添加全局Feature Flag:

```javascript
// 启用延迟剖析 (开发/调试模式)
window.__ENABLE_LATENCY_PROFILER__ = true;
```

**建议**: 通过URL参数动态控制
```javascript
const urlParams = new URLSearchParams(window.location.search);
window.__ENABLE_LATENCY_PROFILER__ = urlParams.has('profile');
// 访问 http://localhost:3000?profile 启用
```

---

### Step 2: 加载Profiler模块

在 index.html 中加载必要的JS模块 (在主应用脚本之前):

```html
<!-- Latency Profiler 模块 -->
<script src="latency-profiler/js/clock-sync.js"></script>
<script src="latency-profiler/js/latency-profiler.js"></script>
```

---

### Step 3: 初始化Profiler

在 main.js 的 `initialize()` 方法中初始化:

```javascript
async initialize() {
    console.log('Initializing Kazoo App...');

    // ... 现有初始化代码 ...

    // Latency Profiler 初始化
    if (window.__ENABLE_LATENCY_PROFILER__ && window.LatencyProfiler && window.ClockSync) {
        // 需要先创建AudioContext才能初始化profiler
        // 在audioIO.start()之后初始化
    }

    // ...
}
```

完整初始化代码 (在 audioIO.start() 之后):

```javascript
async _startWithAudioIO() {
    // ... 现有代码 ...

    const result = await this.audioIO.start();
    console.log('🎵 AudioIO 已启动:', result);

    // Latency Profiler 初始化
    if (window.__ENABLE_LATENCY_PROFILER__ && window.LatencyProfiler) {
        window.latencyProfiler = new window.LatencyProfiler(this.audioIO.audioContext);
        console.log('[Main] 🔬 Latency Profiler initialized');

        // 每10秒自动打印报告
        setInterval(() => {
            if (window.latencyProfiler) {
                window.latencyProfiler.printReport();
            }
        }, 10000);
    }

    // ...
}
```

---

### Step 4: 修改 pitch-worklet.js (Worklet端注入)

#### 4.1 添加Feature Flag

在 `PitchDetectorWorklet` 构造函数中:

```javascript
constructor() {
    // ... 现有代码 ...

    // Feature Flag: 延迟剖析
    this.enableProfiling = false;  // 默认关闭，通过config消息启用

    console.log('[PitchWorklet] Initialized');
}
```

#### 4.2 修改 _handleConfig 方法

```javascript
_handleConfig(config) {
    console.log('[PitchWorklet] 📥 收到主线程配置:', config);

    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };

    // ... 现有配置处理代码 ...

    // 接收profiling配置
    if (config.enableProfiling !== undefined) {
        this.enableProfiling = config.enableProfiling;
        console.log(`[PitchWorklet] 🔬 Profiling: ${this.enableProfiling ? 'ENABLED' : 'disabled'}`);
    }

    // ...
}
```

#### 4.3 修改 process() 方法

找到 `process()` 方法，在关键位置注入时间戳:

```javascript
process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputBuffer = input[0];
    const blockSize = inputBuffer.length;

    // ===== [PROFILING T1] Worklet入口 =====
    const t1_workletEntry = this.enableProfiling ? currentTime : null;

    // 累积音频样本
    this.accumulator.set(inputBuffer, this.accumulatedSamples);
    this.accumulatedSamples += blockSize;

    // 检查是否累积满2048样本
    if (this.accumulatedSamples >= this.targetBufferSize) {

        // ===== [PROFILING T2] YIN开始 =====
        const t2_yinStart = this.enableProfiling ? currentTime : null;

        // YIN音高检测
        const frequency = this.detectPitch(this.accumulator);
        const confidence = this.lastConfidence;

        // ===== [PROFILING T3] YIN完成 =====
        const t3_yinComplete = this.enableProfiling ? currentTime : null;

        // ... 中间的RMS、中值滤波、音符计算等代码 ...

        // FFT和频谱特征提取
        if (this.fft && (this.frameCount % this.fftInterval === 0)) {
            // ... FFT代码 ...
        }

        // EMA滤波和起音检测
        // ... 特征提取代码 ...

        // ===== [PROFILING T4] 特征提取完成 =====
        const t4_featuresComplete = this.enableProfiling ? currentTime : null;

        // 构建PitchFrame
        const pitchFrame = {
            timestamp: currentTime * 1000,
            frequency: frequency,
            note: note,
            octave: octave,
            confidence: confidence,
            volumeDb: volumeDb,
            volumeLinear: volumeLinear,
            cents: cents,
            pitchStability: pitchStability,
            articulation: articulation,
            attackTime: attackTime,
            spectralCentroid: spectralCentroid,
            brightness: brightness,
            breathiness: breathiness,
            formant: formant
        };

        // ===== [PROFILING T5] 构建profiling对象 =====
        if (this.enableProfiling && t1_workletEntry) {
            const t0_capture = t1_workletEntry - (this.accumulatedSamples / sampleRate);
            const t5_messageSent = currentTime;

            pitchFrame._profiling = {
                sessionId: `${t0_capture.toFixed(6)}-${Math.random().toString(36).substring(7)}`,
                t0_capture: t0_capture,
                t1_workletEntry: t1_workletEntry,
                t2_yinStart: t2_yinStart,
                t3_yinComplete: t3_yinComplete,
                t4_featuresComplete: t4_featuresComplete,
                t5_messageSent: t5_messageSent
            };
        }

        // 发送PitchFrame到主线程
        this.port.postMessage({
            type: 'pitch-frame',
            data: pitchFrame,
            timestamp: currentTime * 1000
        });

        // 重置累积器
        this.accumulatedSamples = 0;
        this.accumulator.fill(0);
    }

    return true;
}
```

---

### Step 5: 修改 audio-io.js (消息传输注入)

#### 5.1 在 _setupAudioWorklet() 中传递profiling配置

找到 `_setupAudioWorklet()` 方法中发送配置的代码:

```javascript
async _setupAudioWorklet() {
    // ... 创建AudioWorkletNode代码 ...

    // 发送初始配置
    const workletConfig = this._serializeConfigForWorklet();

    // 添加profiling配置
    if (window.__ENABLE_LATENCY_PROFILER__) {
        workletConfig.enableProfiling = true;
    }

    this.processorNode.port.postMessage({
        type: 'config',
        data: workletConfig
    });

    console.log('[AudioIO] 📤 配置已下发到 Worklet:', workletConfig);

    // ...
}
```

#### 5.2 修改 _handleWorkletMessage() 注入T6时间戳

找到 `_handleWorkletMessage()` 方法:

```javascript
_handleWorkletMessage(event) {
    const { type, data, timestamp } = event.data;

    // ===== [PROFILING T6] 主线程收到消息 =====
    const t6_messageReceived = window.__ENABLE_LATENCY_PROFILER__ ? performance.now() : null;

    switch (type) {
        case 'ready':
            console.log('[AudioIO] ✅ Worklet 已就绪');
            break;

        case 'pitch-frame':
            // 注入主线程时间戳
            if (t6_messageReceived && data._profiling) {
                data._profiling.t6_messageReceived = t6_messageReceived;
            }

            // Worklet模式: 使用专用回调
            if (this.onWorkletPitchFrameCallback) {
                this.onWorkletPitchFrameCallback(data, timestamp);
            }
            break;

        // ... 其他case ...
    }
}
```

---

### Step 6: 修改 main.js (主线程+合成器注入)

#### 6.1 修改 handleWorkletPitchFrame() 方法

找到 `handleWorkletPitchFrame()` 方法:

```javascript
handleWorkletPitchFrame(pitchFrame, timestamp) {
    // ===== [PROFILING T7] 处理器入口 =====
    const t7_handlerStart = window.__ENABLE_LATENCY_PROFILER__ ? performance.now() : null;

    if (!this.isRunning || !this.currentEngine) return;

    performanceMonitor.startProcessing();

    // 更新UI显示
    this.ui.currentNote.textContent = `${pitchFrame.note}${pitchFrame.octave}`;
    this.ui.currentFreq.textContent = `${pitchFrame.frequency.toFixed(1)} Hz`;
    this.ui.confidence.textContent = `${Math.round(pitchFrame.confidence * 100)}%`;

    // ===== [PROFILING T8前] 调用合成器 =====
    if (this.currentEngine.processPitchFrame) {
        this.currentEngine.processPitchFrame(pitchFrame);
    }

    // ===== [PROFILING T8] 合成器更新完成 =====
    const t8_synthUpdate = window.__ENABLE_LATENCY_PROFILER__ ? performance.now() : null;

    // 更新可视化
    this.updateVisualizer(pitchFrame);

    performanceMonitor.endProcessing();
    performanceMonitor.updateFPS();

    // ===== [PROFILING T9] 计算输出时刻 =====
    if (window.__ENABLE_LATENCY_PROFILER__ && pitchFrame._profiling && window.latencyProfiler) {
        const audioContext = this.audioIO.audioContext;
        const t9_outputScheduled = audioContext.currentTime + (audioContext.outputLatency || 0);

        pitchFrame._profiling.t7_handlerStart = t7_handlerStart;
        pitchFrame._profiling.t8_synthUpdate = t8_synthUpdate;
        pitchFrame._profiling.t9_outputScheduled = t9_outputScheduled;

        // 发送到profiler
        window.latencyProfiler.recordWorkletData(pitchFrame._profiling);
        window.latencyProfiler.recordMainThreadData(pitchFrame._profiling.sessionId, {
            t6_messageReceived: pitchFrame._profiling.t6_messageReceived,
            t7_handlerStart: t7_handlerStart,
            t8_synthUpdate: t8_synthUpdate,
            t9_outputScheduled: t9_outputScheduled
        });
    }

    // 更新延迟显示
    const metrics = performanceMonitor.getMetrics();
    this.ui.latency.textContent = `${metrics.totalLatency}ms`;
}
```

---

## 验证集成

### 1. 启动应用

```bash
npm start
# 访问 http://localhost:3000?profile
```

### 2. 检查控制台日志

启动时应该看到:
```
[Main] 🔬 Latency Profiler initialized
[AudioIO] 📤 配置已下发到 Worklet: { enableProfiling: true, ... }
[PitchWorklet] 🔬 Profiling: ENABLED
```

### 3. 开始唱歌

10秒后控制台应该自动打印报告:
```
═══════════════════════════════════════════════════
        LATENCY PROFILER DIAGNOSTIC REPORT
═══════════════════════════════════════════════════

📊 Samples: 143 sessions

🕐 Total Latency (T0→T9):
   Average: 18.5ms
   P50:     17.2ms
   P95:     24.3ms
   ...
```

### 4. 打开监控页面

新标签页访问: `http://localhost:3000/latency-profiler/pages/monitor.html`

应该看到实时更新的延迟图表。

---

## 故障排查

### 问题1: Profiler未初始化

**症状**: 控制台无 "Latency Profiler initialized" 日志

**检查**:
```javascript
console.log('Feature Flag:', window.__ENABLE_LATENCY_PROFILER__);
console.log('LatencyProfiler class:', typeof window.LatencyProfiler);
console.log('ClockSync class:', typeof window.ClockSync);
```

**解决**: 确保clock-sync.js和latency-profiler.js已正确加载

---

### 问题2: Worklet未启用profiling

**症状**: 无 "Worklet Profiling: ENABLED" 日志

**检查**: audio-io.js中是否正确传递了enableProfiling配置

---

### 问题3: 数据未采集

**症状**: `window.latencyProfiler.generateReport()` 返回 sampleCount: 0

**检查**:
```javascript
console.log('Active sessions:', window.latencyProfiler.sessions.size);
console.log('Completed sessions:', window.latencyProfiler.completedSessions.length);
```

**可能原因**:
- Worklet未发送_profiling数据
- 主线程未调用recordMainThreadData
- session ID不匹配

---

## 性能影响

- **开销**: 每帧增加约0.1-0.2ms处理时间
- **内存**: 保留512条session记录，约100KB
- **建议**: 生产环境关闭Feature Flag

---

## 下一步

1. 运行快速诊断: `http://localhost:3000/latency-profiler/pages/quick-check.html`
2. 观察实时监控: `http://localhost:3000/latency-profiler/pages/monitor.html`
3. 分析报告并定位瓶颈
4. 根据诊断结果实施优化方案

---

**文档版本**: 1.0
**最后更新**: 2025-11-02

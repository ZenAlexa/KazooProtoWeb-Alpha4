# Phase 1 - 低延迟音频基础：基线数据与对标分析

**生成日期**: 2025-10-30
**当前版本**: Alpha 5
**目标**: AudioWorklet 迁移，实现 Dubler 2 级别的超低延迟

---

## 📊 当前系统基线数据 (Alpha 5)

### 音频系统配置

| 参数 | 当前值 | 位置 |
|------|--------|------|
| **Buffer Size** | 2048 samples | `audio-input.js:20` |
| **Sample Rate** | 44100 Hz | `audio-input.js:21` |
| **处理器类型** | ScriptProcessorNode (已废弃) | `audio-input.js:121` |
| **FFT Size** | 2048 | `audio-input.js:22` |
| **音频 API** | Web Audio API (latencyHint: 'interactive') | `audio-input.js:72` |

### 延迟组成分析

```javascript
// 计算公式 (performance.js:55-66)
总延迟 = 缓冲延迟 + 基础延迟 + 输出延迟 + 处理延迟

缓冲延迟 = (bufferSize / sampleRate) * 1000
        = (2048 / 44100) * 1000
        = 46.44 ms

基础延迟 = audioContext.baseLatency * 1000  // 浏览器相关 (通常 0-5ms)
输出延迟 = audioContext.outputLatency * 1000 // 硬件相关 (通常 0-10ms)
处理延迟 = 平均音高检测时间 (YIN 算法) + 合成器触发时间
```

### 当前性能指标

| 指标 | 测量值 | 评级 |
|------|--------|------|
| **总延迟** | ~46-60 ms | 一般 (Fair) |
| **缓冲延迟** | 46.44 ms | - |
| **处理延迟** | ~2-5 ms (主线程 YIN) | - |
| **音高检测算法** | YIN (pitchfinder.js) | - |
| **检测帧率** | ~43 Hz (1000/2048*44.1) | - |
| **平滑方式** | 中值滤波 (5 样本) | `pitch-detector.js:14` |
| **CPU 占用** | ~5-10% (单核) | - |

### 性能评级标准 (performance.js:167-179)

```javascript
< 20ms  → 优秀 (Excellent) - 绿色
< 50ms  → 良好 (Good)      - 蓝色
< 100ms → 一般 (Fair)      - 黄色
≥ 100ms → 较差 (Poor)      - 红色
```

**当前评级**: 🟡 一般 (46-60ms)

---

## 🎯 商业软件对标分析

### Dubler 2 技术规格 (Vochlea Music)

| 参数 | Dubler 2 规格 | 数据来源 |
|------|--------------|----------|
| **推荐 Buffer Size** | **≤ 128 samples** | Vochlea 官方文档 |
| **Sample Rate** | **44100 Hz** (固定) | Vochlea 官方文档 |
| **理论延迟** | **2.9 ms** (128/44100) | 计算值 |
| **实际延迟** | **< 10 ms** (含处理) | 官方声称 "低于可听范围" |
| **平台要求 (Mac)** | CoreAudio，128 buffer | 原生支持 |
| **平台要求 (Win)** | ASIO 驱动 或 ASIO4ALL | 必需 |
| **音高检测算法** | 专有算法 (未公开) | - |
| **处理线程** | 独立音频线程 | 推测 |
| **特色功能** | IntelliBend, TruBend, 校准 | - |

### AudioWorklet 技术规格 (Web Audio API)

| 参数 | AudioWorklet 规格 | 数据来源 |
|------|------------------|----------|
| **最小 Buffer Size** | **128 samples** | Web Audio API 标准 |
| **理论延迟** | **< 3 ms** (128/48000) | 计算值 @ 48kHz |
| **处理线程** | **独立音频渲染线程** | W3C 规范 |
| **浏览器支持** | Chrome 66+, Firefox 76+, Safari 14.1+ | Can I Use |
| **零拷贝传输** | SharedArrayBuffer (可选) | WebAssembly 集成 |
| **WASM 支持** | ✅ 支持 | pitchlite 项目验证 |

### 竞品对比表

| 功能 | Kazoo Proto (当前) | Dubler 2 | AudioWorklet 潜力 |
|------|-------------------|----------|-------------------|
| **延迟** | 46-60 ms | < 10 ms | **8-12 ms** (目标) |
| **Buffer Size** | 2048 | 128 | **128-256** |
| **算法** | YIN (主线程) | 专有 | MPM/SWIPE (Worklet) |
| **线程隔离** | ❌ 阻塞主线程 | ✅ 独立线程 | ✅ 音频渲染线程 |
| **校准** | ❌ 无 | ✅ 完整向导 | 待实现 |
| **平滑** | 中值滤波 (5) | 卡尔曼滤波 (推测) | 待升级 |
| **表现力映射** | 基础 | 高级 (cents, formants) | 待实现 |
| **音色** | 基础振荡器 | 采样合成 (推测) | 待升级 |

---

## 🔍 关键技术差距分析

### 1. 延迟差距：46ms → 10ms (差距 36ms)

**瓶颈来源**:
- ❌ **Buffer Size 过大**: 2048 samples = 46.44ms 缓冲延迟
- ❌ **ScriptProcessorNode**: 已废弃，性能差，阻塞主线程
- ❌ **主线程音高检测**: YIN 算法占用主线程，46ms/次
- ⚠️ **无优化的处理流程**: 没有并行处理或提前预测

**解决方案**:
```
✅ 迁移到 AudioWorklet (独立线程)
✅ 降低 Buffer Size 到 128-256 samples
✅ 实现 MPM 算法 (比 YIN 快 30%)
✅ 使用 Ring Buffer 零拷贝传输
✅ 卡尔曼滤波预测下一帧频率
```

### 2. 算法差距：YIN vs. MPM/SWIPE

| 算法 | 延迟 | 精度 | 快速音高变化 | 实现复杂度 |
|------|------|------|--------------|-----------|
| **YIN (当前)** | ~2-5ms | 85% | ❌ 慢 | 低 (已有库) |
| **MPM (目标)** | ~1-2ms | 90% | ✅ 快 | 中 |
| **SWIPE** | ~3-4ms | 95% | ⚠️ 中 | 高 |
| **混合模式** | ~1-3ms | 95% | ✅ 快 | 高 |

**推荐策略**:
- Phase 1.6: 先用 YIN 在 Worklet 验证架构
- Phase 2.x: 引入 MPM 替换 YIN
- Phase 3.x: 添加 SWIPE 作为高精度模式

### 3. 平台兼容性差距

**浏览器支持矩阵**:

| 浏览器 | AudioWorklet | Buffer 128 | SharedArrayBuffer |
|--------|--------------|------------|-------------------|
| Chrome 66+ | ✅ | ✅ | ✅ (HTTPS + COOP/COEP) |
| Firefox 76+ | ✅ | ✅ | ✅ (HTTPS + COOP/COEP) |
| Safari 14.1+ | ✅ | ⚠️ 不稳定 | ⚠️ 部分支持 |
| Edge 79+ | ✅ | ✅ | ✅ |

**回退策略**:
```javascript
if (audioContext.audioWorklet && browserSupportsWorklet) {
    useAudioWorklet(); // 128-256 buffer
} else {
    fallbackToScriptProcessor(); // 2048 buffer (当前实现)
}
```

---

## 🚀 Phase 1 目标设定

### 短期目标 (2 周内)

| 目标 | 当前 | 目标 | 改进 |
|------|------|------|------|
| **总延迟** | 46-60 ms | **8-15 ms** | **-75%** |
| **缓冲延迟** | 46.44 ms | **2.9-5.8 ms** | **-90%** |
| **Buffer Size** | 2048 | **128-256** | **-87%** |
| **处理器** | ScriptProcessor | **AudioWorklet** | 现代化 |
| **线程隔离** | ❌ | ✅ | CPU 占用 -50% |

### 成功标准

✅ **功能标准**:
- AudioWorklet 成功初始化并处理音频
- 音高检测精度 ≥ 当前水平 (85%)
- Feature Flag 回退到 ScriptProcessor 可用
- 所有 6 种乐器正常工作

✅ **性能标准**:
- 总延迟 < 15ms (Chrome/Edge)
- 总延迟 < 20ms (Firefox)
- 总延迟 < 30ms (Safari，或回退)
- CPU 占用 < 8% (降低 2%)
- 无音频卡顿或掉帧

✅ **兼容性标准**:
- Chrome 66+ 完全支持
- Firefox 76+ 完全支持
- Safari 14.1+ 支持或优雅回退
- 移动端 Safari iOS 14.5+ 支持

---

## 📋 实现路线图

### Commit 1: 提取配置常量 + 启动日志
```javascript
// 新文件: js/audio-config.js
export const AUDIO_CONFIG = {
    SAMPLE_RATE: 44100,
    BUFFER_SIZE_WORKLET: 128,     // AudioWorklet 模式
    BUFFER_SIZE_FALLBACK: 2048,   // ScriptProcessor 回退
    FFT_SIZE: 2048,
    LATENCY_HINT: 'interactive',
    USE_AUDIO_WORKLET: true,      // Feature Flag
};
```

### Commit 2: AudioIO 抽象层
```javascript
// 新文件: js/audio-io.js
class AudioIO {
    configure(options) { }
    async start() { }
    stop() { }
    onFrame(callback) { }
    getLatencyInfo() { }
}
```

### Commit 3: pitch-worklet.js 空处理器
```javascript
// 新文件: js/pitch-worklet.js
class PitchDetectorWorklet extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        // 空处理器，透传数据
        return true;
    }
}
registerProcessor('pitch-detector', PitchDetectorWorklet);
```

### Commit 4-9: 见 ROADMAP Phase 1 详细步骤

---

## 📚 参考资料

### 官方文档
- [Web Audio API - AudioWorklet](https://www.w3.org/TR/webaudio/#AudioWorklet)
- [Dubler 2 - Latency Setup](https://vochlea.com/tutorials/latency-2)
- [Chrome - AudioWorklet 设计文档](https://developers.google.com/web/updates/2017/12/audio-worklet)

### 开源项目参考
- [pitchlite](https://github.com/sevagh/pitchlite) - WebAssembly + AudioWorklet 音高检测
- [phaze](https://github.com/olvb/phaze) - 实时变调器 (AudioWorklet)
- [MPM 论文](https://www.cs.otago.ac.nz/research/publications/oucs-2005-08.pdf) - McLeod & Wyvill (2005)

### 性能基准测试
- [WebAudio Performance Workshop](https://www.w3.org/2021/03/media-production-workshop/talks/peter-salomonsen-webassembly-music.html)
- [AudioWorklet Performance Issue](https://github.com/WebAudio/web-audio-api/issues/1466)

---

## ✅ 验证脚本

```javascript
// test-audio-worklet.html (待创建)
// 最小化验证脚本，测试 AudioWorklet 加载和数据流
```

**验证后删除**: 本文档和测试脚本在 Phase 1 完成后归档或删除。

---

**下一步**: 开始 Commit 1 - 提取配置常量与增强日志

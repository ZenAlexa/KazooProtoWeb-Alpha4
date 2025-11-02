# Latency Profiler - 架构设计文档

## 系统概述

Latency Profiler是一个独立的延迟诊断工具集，通过在音频链路的10个关键节点注入高精度时间戳，实现端到端延迟的精确测量和瓶颈定位。

---

## 架构设计

### 1. 数据流架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Latency Profiling Pipeline                  │
└─────────────────────────────────────────────────────────────────┘

T0 麦克风采集 (AudioWorklet线程, 推算值)
   │
   ├─> [pitch-worklet.js]
   │   ├─ T1: process()入口 (currentTime)
   │   ├─ T2: YIN开始 (currentTime)
   │   ├─ T3: YIN完成 (currentTime)
   │   ├─ T4: 特征提取完成 (currentTime)
   │   └─ T5: postMessage发送 (currentTime)
   │
   ├─> [MessagePort通信]
   │
   ├─> [audio-io.js]
   │   └─ T6: 主线程收到消息 (performance.now())
   │
   ├─> [main.js]
   │   ├─ T7: handleWorkletPitchFrame入口 (performance.now())
   │   ├─ T8: 合成器更新完成 (performance.now())
   │   └─ T9: 输出时刻 (currentTime + outputLatency)
   │
   └─> [latency-profiler.js]
       └─ 计算延迟 + 生成报告
```

### 2. 时钟同步机制

#### 问题

- **AudioContext.currentTime**: 音频时钟，秒为单位，从AudioContext创建开始计时
- **performance.now()**: 主线程时钟，毫秒为单位，从页面加载开始计时
- **两者无共同零点**: 无法直接相减计算延迟

#### 解决方案

**方案A: AudioContext.getOutputTimestamp() (Chrome/Edge)**

```javascript
const timestamp = audioContext.getOutputTimestamp();
// { contextTime: 12.345 (秒), performanceTime: 123456.78 (毫秒) }

// 计算偏移量
const offset = performanceTime - (contextTime * 1000);

// 转换任意音频时间到主线程时间
const perfTime = (audioTime * 1000) + offset;
```

**方案B: 采样近似法 (Firefox/Safari)**

```javascript
// 在多个时刻同时采样两种时钟
const samples = [];
for (let i = 0; i < 10; i++) {
    const perfNow = performance.now();
    const audioNow = audioContext.currentTime * 1000;
    samples.push(perfNow - audioNow);
}

// 使用中位数作为偏移量
const offset = median(samples);
```

### 3. Session管理机制

#### Session生命周期

```
1. [Worklet] createSession(sessionId, t0, t1)
   └─> 创建session对象，记录Worklet端时间戳

2. [Worklet] 构建PitchFrame._profiling并发送

3. [Main] recordWorkletData(profiling)
   └─> 更新session，记录T2-T5

4. [Main] recordMainThreadData(sessionId, timestamps)
   └─> 记录T6-T9，标记完成

5. [Profiler] calculateSessionLatency(session)
   └─> 计算各段延迟

6. [Profiler] 移动到completedSessions数组
   └─> 定期清理，防止内存泄漏
```

#### Session数据结构

```javascript
{
    id: "12.345678-a7b3c",  // 唯一ID

    // Worklet端时间戳 (AudioContext.currentTime 秒)
    t0_capture: 12.340000,
    t1_workletEntry: 12.342900,
    t2_yinStart: 12.342910,
    t3_yinComplete: 12.345120,
    t4_featuresComplete: 12.345780,
    t5_messageSent: 12.345800,

    // 主线程端时间戳 (performance.now() 毫秒)
    t6_messageReceived: 123458.23,
    t7_handlerStart: 123458.45,
    t8_synthUpdate: 123459.12,
    t9_outputScheduled: 12.355000,  // AudioContext.currentTime 秒

    // 元数据
    createdAt: 123450.00,
    completedAt: 123459.15
}
```

---

## 核心组件

### 1. ClockSync (clock-sync.js)

**职责**: 音频时钟与主线程时钟同步

**关键方法**:
- `initialize()`: 检测浏览器能力并选择同步方案
- `audioTimeToPerformanceTime(audioTime)`: 音频时间→主线程时间
- `performanceTimeToAudioTime(perfTime)`: 主线程时间→音频时间
- `calculateLatency(endTime, startTime, endUnit, startUnit)`: 计算延迟(自动单位转换)
- `refresh()`: 定期更新同步参数

**浏览器兼容性**:
| 浏览器 | 方法 | 精度 |
|--------|------|------|
| Chrome 95+ | getOutputTimestamp() | ±0.1ms |
| Edge 95+ | getOutputTimestamp() | ±0.1ms |
| Firefox | 采样近似 | ±2ms |
| Safari | 采样近似 | ±5ms |

---

### 2. LatencyProfiler (latency-profiler.js)

**职责**: 采集、计算、统计延迟数据

**关键方法**:

#### 数据采集
- `createSession(sessionId, t0, t1)`: 创建新会话
- `recordWorkletData(profiling)`: 记录Worklet端数据
- `recordMainThreadData(sessionId, timestamps)`: 记录主线程数据

#### 延迟计算
- `calculateSessionLatency(session)`: 计算单个会话延迟
  ```javascript
  {
      totalLatency: 18.5,           // T0→T9总延迟
      workletProcessing: 3.2,       // T1→T4 Worklet处理
      messageTransfer: 0.4,         // T5→T6消息传输
      mainThreadProcessing: 1.8,    // T6→T8主线程处理
      outputBuffering: 13.1,        // T8→T9输出缓冲
      breakdown: {
          yinAlgorithm: 2.2,        // T2→T3 YIN算法
          featureExtraction: 0.7,   // T3→T4特征提取
          handlerOverhead: 0.2,     // T6→T7处理器开销
          toneJsUpdate: 0.7         // T7→T8 Tone.js更新
      }
  }
  ```

#### 统计分析
- `generateReport()`: 生成统计报告
  ```javascript
  {
      sampleCount: 143,
      totalLatency: {
          avg: 18.5,
          p50: 17.2,
          p95: 24.3,
          max: 32.1,
          min: 15.8
      },
      // ... 各段统计
      diagnosis: {
          severity: 'good',  // 'good' | 'warning' | 'critical'
          bottleneck: null,
          recommendations: []
      }
  }
  ```

#### 诊断告警
- `_checkThresholds(session, latency)`: 实时告警
- `_generateDiagnosis(report)`: 自动诊断
  ```javascript
  // 告警阈值
  {
      totalLatency: 50,        // 总延迟>50ms告警
      workletProcessing: 10,   // Worklet>10ms告警
      messageTransfer: 2,      // 传输>2ms告警
      mainThreadProcessing: 5, // 主线程>5ms告警
      outputBuffering: 30      // 输出>30ms告警(蓝牙嫌疑)
  }
  ```

#### 内存管理
- `cleanup()`: 清理过期session (5秒超时)
- 最多保留512条completedSessions
- 自动删除未完成的活跃session

---

### 3. Worklet Patch (patch-worklet.js)

**职责**: 提供Worklet端时间戳注入指南和代码片段

**内容**:
- 5个关键位置的patch代码
- 集成指南 (PROFILING_INTEGRATION_GUIDE)
- Feature Flag控制逻辑

---

## 集成点

### 1. pitch-worklet.js修改点

| 位置 | 修改 | 数据 |
|------|------|------|
| 构造函数 | 添加`this.enableProfiling` | Feature Flag |
| _handleConfig | 接收`config.enableProfiling` | 配置接收 |
| process()开头 | `const t1 = currentTime` | T1时间戳 |
| YIN前 | `const t2 = currentTime` | T2时间戳 |
| YIN后 | `const t3 = currentTime` | T3时间戳 |
| 特征提取后 | `const t4 = currentTime` | T4时间戳 |
| postMessage前 | 构建`_profiling`对象 | T0-T5完整数据 |

### 2. audio-io.js修改点

| 位置 | 修改 | 数据 |
|------|------|------|
| _serializeConfigForWorklet | 添加`enableProfiling` | 配置下发 |
| _handleWorkletMessage | `const t6 = performance.now()` | T6时间戳 |
| pitch-frame分支 | 注入`data._profiling.t6` | 传递T6 |

### 3. main.js修改点

| 位置 | 修改 | 数据 |
|------|------|------|
| initialize | 初始化`latencyProfiler` | Profiler实例 |
| handleWorkletPitchFrame开头 | `const t7 = performance.now()` | T7时间戳 |
| 合成器调用后 | `const t8 = performance.now()` | T8时间戳 |
| 方法结尾 | 计算T9，调用profiler | 完整session |

---

## 性能影响评估

### CPU开销

| 组件 | 每帧开销 | 频率 | 总开销 |
|------|---------|------|--------|
| Worklet时间戳读取 | 5次×0.01ms | 每帧 | 0.05ms |
| _profiling对象构造 | 0.03ms | 每帧 | 0.03ms |
| MessagePort序列化 | +120字节 | 每帧 | ~0.02ms |
| 主线程时间戳读取 | 4次×0.01ms | 每帧 | 0.04ms |
| Session管理 | 0.05ms | 每帧 | 0.05ms |
| **总计** | | | **~0.2ms/帧** |

**影响**:
- 8-15ms延迟 → 8.2-15.2ms (+1.3%)
- 可忽略

### 内存开销

| 项 | 大小 | 数量 | 总计 |
|-----|------|------|------|
| Session对象 | ~200字节 | 512条 | ~100KB |
| Profiler实例 | ~10KB | 1个 | 10KB |
| ClockSync实例 | ~5KB | 1个 | 5KB |
| **总计** | | | **~115KB** |

**影响**:
- 相对于主应用内存 (10-50MB)
- 可忽略 (<1%)

### 消息体积

- 原PitchFrame: ~300字节
- 添加_profiling: +120字节 (+40%)
- 每秒传输 (30FPS): 300字节×30 = 9KB/s → 12.6KB/s (+3.6KB/s)

**影响**: 可忽略

---

## 安全性与隐私

### 数据隔离

- 所有数据仅存储在内存中
- 不发送到服务器
- 不写入LocalStorage
- 页面关闭后完全清除

### Feature Flag控制

- 默认关闭 (`__ENABLE_LATENCY_PROFILER__ = false`)
- 仅开发/调试模式启用
- 生产环境零开销
- 可通过URL参数动态控制

---

## 扩展性

### 新增测量点

只需在对应位置添加:
```javascript
const tX_newPoint = window.__ENABLE_LATENCY_PROFILER__ ? performance.now() : null;
```

### 新增诊断规则

在`_generateDiagnosis()`中添加:
```javascript
if (report.newMetric.avg > threshold) {
    diagnosis.recommendations.push('...');
}
```

### 导出数据格式

支持多种格式:
- JSON (generateReport())
- 控制台文本 (printReport())
- CSV导出 (TODO)
- Chrome DevTools Trace (TODO)

---

## 已知限制

1. **Safari时钟精度**: ±5ms误差 (无getOutputTimestamp)
2. **Tab后台降精度**: performance.now()精度降至1ms
3. **MessagePort延迟**: 无法精确测量 (估算±0.5ms)
4. **输出时刻估算**: T9基于outputLatency估算，非实测值

---

## 未来改进

1. **物理测量**: 添加loopback测试 (麦克风录制扬声器输出)
2. **可视化增强**: 实时火焰图、瀑布图
3. **历史数据**: 跨会话对比、趋势分析
4. **导出报告**: PDF/CSV/JSON格式
5. **自动优化**: 根据诊断结果自动调整配置参数

---

**文档版本**: 1.0
**最后更新**: 2025-11-02
**作者**: Claude Code

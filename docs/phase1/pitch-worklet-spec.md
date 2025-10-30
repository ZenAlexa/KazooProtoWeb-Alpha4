# AudioWorklet Pitch Detector 消息结构规范

**Phase 1.5**: pitch-worklet.js 消息协议设计

---

## 概述

本文档定义主线程与 AudioWorkletProcessor 之间的消息结构，用于实时音高检测。

### 设计目标

1. **低延迟**: 最小化序列化/反序列化开销
2. **类型安全**: 明确的消息格式和字段类型
3. **可扩展**: 支持未来添加新特性
4. **向后兼容**: 保持与现有 pitch-detector.js 的接口一致

---

## 消息类型

### 1. 主线程 → Worklet (配置消息)

#### 1.1 初始化配置 (`config`)

```javascript
{
    type: 'config',
    data: {
        sampleRate: 44100,           // 采样率
        algorithm: 'YIN',            // 'YIN' | 'MPM' | 'SWIPE'
        threshold: 0.1,              // YIN 阈值 (0.05-0.2)
        minFrequency: 80,            // Hz
        maxFrequency: 800,           // Hz
        smoothingSize: 5,            // 平滑窗口大小
        minVolumeThreshold: 0.01     // RMS 最小阈值
    }
}
```

#### 1.2 更新参数 (`update-params`)

```javascript
{
    type: 'update-params',
    data: {
        threshold?: 0.15,            // 可选: 更新阈值
        minVolumeThreshold?: 0.02,   // 可选: 更新音量阈值
        smoothingSize?: 7            // 可选: 更新平滑窗口
    }
}
```

#### 1.3 控制命令 (`control`)

```javascript
{
    type: 'control',
    command: 'reset' | 'pause' | 'resume'
}
```

---

### 2. Worklet → 主线程 (结果消息)

#### 2.1 音高检测结果 (`pitch-detected`)

**标准格式** (与现有 pitch-detector.js 兼容):

```javascript
{
    type: 'pitch-detected',
    data: {
        // 频率信息
        frequency: 440.0,            // Hz (平滑后)
        rawFrequency: 439.5,         // Hz (原始检测值)

        // 音符信息
        note: 'A',                   // C, C#, D, ..., B
        octave: 4,                   // 八度 (0-8)
        cents: -12,                  // 音分偏差 (-50 到 +50)

        // 置信度与音量
        confidence: 0.85,            // 0-1 (检测置信度)
        volume: 0.12,                // RMS 音量

        // 时间戳
        timestamp: 1234.567,         // AudioContext.currentTime (秒)
        frameNumber: 12345           // 帧编号 (调试用)
    }
}
```

#### 2.2 无音高 (`no-pitch`)

```javascript
{
    type: 'no-pitch',
    reason: 'low-volume' | 'low-confidence' | 'out-of-range',
    volume: 0.005,                   // 当前 RMS 音量
    timestamp: 1234.567
}
```

#### 2.3 性能统计 (`stats`)

```javascript
{
    type: 'stats',
    data: {
        framesProcessed: 1000,
        avgProcessingTime: 0.45,     // ms
        maxProcessingTime: 1.2,      // ms
        dropouts: 0,
        bufferUnderruns: 0
    }
}
```

#### 2.4 错误消息 (`error`)

```javascript
{
    type: 'error',
    error: 'initialization-failed' | 'processing-error',
    message: 'YIN detector initialization failed',
    details: { ... }                 // 可选: 详细信息
}
```

---

## 数据流设计

### 方案 A: 每帧传输结果 (当前实现)

```
┌─────────────┐                ┌──────────────────┐
│ Main Thread │                │ AudioWorklet     │
│             │───config──────>│                  │
│             │                │ [YIN Detector]   │
│             │<──pitch-data───│ process() 每帧   │
│             │<──pitch-data───│ 128 samples      │
│             │<──pitch-data───│                  │
└─────────────┘                └──────────────────┘

优点: 实时性好，简单直接
缺点: 消息频率高 (344 Hz @ 44.1kHz/128)
```

### 方案 B: 差分传输 (优化，Phase 2)

只在音高变化时发送消息：

```javascript
// 主线程维护状态，只接收变化
{
    type: 'pitch-changed',
    data: {
        frequency: 450.0,      // 新频率
        deltaFreq: +10.0,      // 频率变化量
        note: 'A',
        confidence: 0.9
    }
}
```

优点: 减少 70-90% 消息量 (音高稳定时)
缺点: 需要主线程维护状态

### 方案 C: SharedArrayBuffer (高级，Phase 3)

使用共享内存零拷贝传输：

```javascript
// Worklet 写入共享内存
const sharedBuffer = new Float32Array(sharedArrayBuffer);
sharedBuffer[0] = frequency;
sharedBuffer[1] = confidence;
// ... 通过 Atomics 同步
```

优点: 零拷贝，极低延迟
缺点: 需要 HTTPS + COOP/COEP headers，浏览器兼容性

**Phase 1 选择**: 方案 A (每帧传输)

---

## 实现细节

### Worklet 端伪代码

```javascript
// js/pitch-worklet.js
class PitchDetectorWorklet extends AudioWorkletProcessor {
    constructor() {
        super();
        this.detector = null;
        this.config = null;
        this.frameCount = 0;

        // 监听配置消息
        this.port.onmessage = (event) => {
            const { type, data } = event.data;

            if (type === 'config') {
                this.config = data;
                this.detector = this._initDetector(data);
            }
        };
    }

    process(inputs, outputs, parameters) {
        if (!this.detector) return true;

        const input = inputs[0][0]; // 单声道
        if (!input) return true;

        try {
            // 1. 计算音量
            const volume = this._calculateRMS(input);

            // 2. 检测音高
            if (volume > this.config.minVolumeThreshold) {
                const frequency = this.detector.detect(input);

                if (frequency > 0) {
                    const pitchInfo = this._createPitchInfo(frequency, volume);

                    // 3. 发送结果到主线程
                    this.port.postMessage({
                        type: 'pitch-detected',
                        data: pitchInfo
                    });
                } else {
                    this.port.postMessage({
                        type: 'no-pitch',
                        reason: 'low-confidence',
                        volume
                    });
                }
            } else {
                this.port.postMessage({
                    type: 'no-pitch',
                    reason: 'low-volume',
                    volume
                });
            }

            this.frameCount++;

        } catch (error) {
            this.port.postMessage({
                type: 'error',
                error: 'processing-error',
                message: error.message
            });
        }

        return true; // 保持处理器运行
    }

    _calculateRMS(buffer) {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        return Math.sqrt(sum / buffer.length);
    }

    _createPitchInfo(frequency, volume) {
        // 转换为与 pitch-detector.js 兼容的格式
        const noteInfo = this._frequencyToNote(frequency);

        return {
            frequency,
            rawFrequency: frequency,
            note: noteInfo.note,
            octave: noteInfo.octave,
            cents: noteInfo.cents,
            confidence: 0.8, // TODO: 实际计算
            volume,
            timestamp: currentTime,
            frameNumber: this.frameCount
        };
    }
}

registerProcessor('pitch-detector', PitchDetectorWorklet);
```

### 主线程端伪代码

```javascript
// 使用 AudioIO 抽象层
const audioIO = new AudioIO();

// 配置
audioIO.configure({
    useWorklet: true,
    workletBufferSize: 128
});

// 启动
await audioIO.start();

// 注册回调
audioIO.onFrame((audioBuffer, timestamp) => {
    // Worklet 模式: 不在此处处理，由 Worklet 发送消息
    // ScriptProcessor 模式: 在此处处理
});

// 监听 Worklet 消息 (如果使用 AudioWorklet)
if (audioIO.mode === 'worklet') {
    const workletNode = audioIO.processorNode;

    workletNode.port.onmessage = (event) => {
        const { type, data } = event.data;

        switch (type) {
            case 'pitch-detected':
                // 调用合成器
                continuousSynthEngine.processPitch(data);
                // 更新 UI
                updatePitchDisplay(data);
                break;

            case 'no-pitch':
                // 可选: 停止合成器
                break;

            case 'stats':
                console.log('[Worklet Stats]', data);
                break;

            case 'error':
                console.error('[Worklet Error]', data);
                break;
        }
    };

    // 发送配置
    workletNode.port.postMessage({
        type: 'config',
        data: {
            sampleRate: audioContext.sampleRate,
            algorithm: 'YIN',
            threshold: 0.1,
            minFrequency: 80,
            maxFrequency: 800
        }
    });
}
```

---

## 性能考量

### 消息频率计算

```
采样率: 44100 Hz
Buffer Size: 128 samples

消息频率 = 44100 / 128 ≈ 344 消息/秒

每秒数据量:
- pitch-detected: ~200 bytes/消息
- 总量: 344 * 200 = ~68 KB/秒
```

**结论**: 消息量完全可接受，现代浏览器轻松处理。

### 优化建议

1. **Phase 1**: 简单实现，每帧发送完整消息
2. **Phase 2**: 差分传输，减少稳定音高时的消息
3. **Phase 3**: SharedArrayBuffer，零拷贝传输

---

## 兼容性策略

### 向后兼容 pitch-detector.js

主线程应提供统一接口，无论使用哪种模式：

```javascript
// 统一的音高检测结果格式
interface PitchInfo {
    frequency: number;
    rawFrequency: number;
    note: string;
    octave: number;
    cents: number;
    confidence: number;
    volume: number;
}

// 无论 Worklet 还是 ScriptProcessor，都返回相同格式
const pitchInfo = await detectPitch(audioBuffer);
```

---

## 测试计划

### 单元测试

1. 消息序列化/反序列化
2. 频率转音符计算准确性
3. RMS 音量计算

### 集成测试

1. Worklet 加载成功
2. 配置消息正确传递
3. 音高检测结果准确性
4. 延迟测量 (< 15ms)

### 性能测试

1. 消息吞吐量 (> 300 msg/s)
2. 处理时间 (< 1ms/frame)
3. 内存占用稳定性

---

## 下一步 (Phase 1.6)

1. 创建空的 `pitch-worklet.js`
2. 实现基本的消息接收/发送
3. 集成到 `audio-io.js`
4. 测试 Worklet 加载和通信

---

**备注**: 此规范在 Phase 1 验证后删除或归档到文档目录。

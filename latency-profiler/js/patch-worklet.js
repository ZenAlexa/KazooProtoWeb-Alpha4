/**
 * Worklet Profiling Patch
 *
 * 为pitch-worklet.js注入时间戳采集逻辑
 * 通过在关键节点插入profiling代码，获取T0-T5时间戳
 *
 * 注入位置:
 * - T0: 麦克风采集时刻 (推算)
 * - T1: process()入口
 * - T2: YIN算法开始
 * - T3: YIN算法完成
 * - T4: 特征提取完成
 * - T5: postMessage发送
 */

// 这个文件提供注入指南和代码片段，实际修改需要在pitch-worklet.js中进行

const WORKLET_PROFILING_PATCHES = {
    // 补丁1: 在process()方法开头注入
    process_entry: `
        // [PROFILING] T1: Worklet入口
        const t1_workletEntry = currentTime;
    `,

    // 补丁2: 在累积满2048样本后，YIN开始前注入
    yin_start: `
        // [PROFILING] T2: YIN算法开始
        const t2_yinStart = currentTime;
    `,

    // 补丁3: 在YIN完成后注入
    yin_complete: `
        // [PROFILING] T3: YIN算法完成
        const t3_yinComplete = currentTime;
    `,

    // 补丁4: 在特征提取完成后注入
    features_complete: `
        // [PROFILING] T4: 特征提取完成
        const t4_featuresComplete = currentTime;
    `,

    // 补丁5: 计算T0并构建_profiling对象
    build_profiling: `
        // [PROFILING] T0: 麦克风采集时刻 (推算)
        // 当前帧的第一个样本是在 accumulatedSamples 个样本之前采集的
        const t0_capture = t1_workletEntry - (this.accumulatedSamples / sampleRate);

        // [PROFILING] T5: 即将发送消息
        const t5_messageSent = currentTime;

        // 构建profiling对象
        const sessionId = \`\${t0_capture.toFixed(6)}-\${Math.random().toString(36).substring(7)}\`;

        pitchFrame._profiling = {
            sessionId: sessionId,
            t0_capture: t0_capture,
            t1_workletEntry: t1_workletEntry,
            t2_yinStart: t2_yinStart,
            t3_yinComplete: t3_yinComplete,
            t4_featuresComplete: t4_featuresComplete,
            t5_messageSent: t5_messageSent
        };
    `
};

// 导出补丁说明
const PROFILING_INTEGRATION_GUIDE = `
# Worklet Profiling 集成指南

## 修改位置: js/pitch-worklet.js

### 1. 在PitchDetectorWorklet类构造函数中添加Feature Flag

\`\`\`javascript
constructor() {
    // ... 现有代码

    // Feature Flag: 启用延迟剖析
    this.enableProfiling = false;  // 通过config消息动态启用

    console.log('[PitchWorklet] Latency profiling:', this.enableProfiling ? 'enabled' : 'disabled');
}
\`\`\`

### 2. 在_handleConfig方法中接收profiling配置

\`\`\`javascript
_handleConfig(config) {
    // ... 现有代码

    // 接收profiling配置
    if (config.enableProfiling !== undefined) {
        this.enableProfiling = config.enableProfiling;
        console.log('[PitchWorklet] Profiling', this.enableProfiling ? 'enabled' : 'disabled');
    }
}
\`\`\`

### 3. 在process()方法中注入时间戳

找到process()方法的关键位置，插入以下代码:

\`\`\`javascript
process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputBuffer = input[0];
    const blockSize = inputBuffer.length;

    // ===== [PATCH 1] T1: Worklet入口 =====
    const t1_workletEntry = this.enableProfiling ? currentTime : null;

    // 累积音频样本...
    this.accumulator.set(inputBuffer, this.accumulatedSamples);
    this.accumulatedSamples += blockSize;

    // 检查是否累积满2048样本
    if (this.accumulatedSamples >= this.targetBufferSize) {

        // ===== [PATCH 2] T2: YIN开始 =====
        const t2_yinStart = this.enableProfiling ? currentTime : null;

        // YIN音高检测
        const frequency = this.detectPitch(this.accumulator);

        // ===== [PATCH 3] T3: YIN完成 =====
        const t3_yinComplete = this.enableProfiling ? currentTime : null;

        // 特征提取 (FFT, EMA, Onset...)
        // ... 现有特征提取代码 ...

        // ===== [PATCH 4] T4: 特征提取完成 =====
        const t4_featuresComplete = this.enableProfiling ? currentTime : null;

        // 构建PitchFrame
        const pitchFrame = {
            timestamp: currentTime * 1000,
            frequency: frequency,
            // ... 其他字段 ...
        };

        // ===== [PATCH 5] 注入profiling数据 =====
        if (this.enableProfiling && t1_workletEntry) {
            const t0_capture = t1_workletEntry - (this.accumulatedSamples / sampleRate);
            const t5_messageSent = currentTime;

            pitchFrame._profiling = {
                sessionId: \`\${t0_capture.toFixed(6)}-\${Math.random().toString(36).substring(7)}\`,
                t0_capture: t0_capture,
                t1_workletEntry: t1_workletEntry,
                t2_yinStart: t2_yinStart,
                t3_yinComplete: t3_yinComplete,
                t4_featuresComplete: t4_featuresComplete,
                t5_messageSent: t5_messageSent
            };
        }

        // 发送消息
        this.port.postMessage({
            type: 'pitch-frame',
            data: pitchFrame,
            timestamp: currentTime * 1000
        });

        // 重置累积器
        this.accumulatedSamples = 0;
    }

    return true;
}
\`\`\`

### 4. 性能影响评估

- 额外开销: ~0.05ms per frame (5次currentTime读取 + 1次对象构造)
- 消息体积增加: +120 bytes per frame
- 建议: 仅在调试时启用，生产环境通过Feature Flag关闭

### 5. 启用方式

在audio-io.js中配置时传入enableProfiling参数:

\`\`\`javascript
this.processorNode.port.postMessage({
    type: 'config',
    data: {
        ...workletConfig,
        enableProfiling: window.__ENABLE_LATENCY_PROFILER__ || false
    }
});
\`\`\`
`;

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WORKLET_PROFILING_PATCHES,
        PROFILING_INTEGRATION_GUIDE
    };
}

console.log('[patch-worklet.js] Profiling patches loaded');
console.log('Use PROFILING_INTEGRATION_GUIDE for integration instructions');

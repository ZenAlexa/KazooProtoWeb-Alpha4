/**
 * AudioWorklet Pitch Detector Processor
 *
 * Phase 1.6: 空处理器实现
 * - 验证 AudioWorklet 加载机制
 * - 测试主线程通信
 * - 透传音频数据 (无实际处理)
 *
 * Phase 2: 集成 YIN/MPM 算法
 */

class PitchDetectorWorklet extends AudioWorkletProcessor {
    constructor(options) {
        super();

        console.log('[PitchWorklet] 🎵 Worklet 处理器已创建');

        // 配置参数 (从主线程接收)
        this.config = {
            sampleRate: sampleRate, // AudioWorkletGlobalScope 提供
            algorithm: 'YIN',
            threshold: 0.1,
            minFrequency: 80,
            maxFrequency: 800,
            smoothingSize: 5,
            minVolumeThreshold: 0.01
        };

        // 音高检测器 (Phase 2 实现)
        this.detector = null;

        // 性能统计
        this.stats = {
            framesProcessed: 0,
            startTime: currentTime,
            lastReportTime: currentTime,
            processingTimes: [],
            maxProcessingTime: 0
        };

        // 监听主线程消息
        this.port.onmessage = this._handleMessage.bind(this);

        // 通知主线程已就绪
        this.port.postMessage({
            type: 'ready',
            sampleRate: this.config.sampleRate
        });
    }

    /**
     * 音频处理回调
     * 每 128 samples 调用一次 (@ 44.1kHz ≈ 2.9ms)
     */
    process(inputs, outputs, parameters) {
        const startTime = currentTime;

        // 获取输入音频 (单声道)
        const input = inputs[0];
        if (!input || !input[0]) {
            return true; // 继续处理
        }

        const audioBuffer = input[0]; // Float32Array[128]

        try {
            // Phase 1.6: 空处理，仅透传数据并计算音量
            const volume = this._calculateRMS(audioBuffer);

            // Phase 2: 将在此处调用音高检测
            // const frequency = this.detector.detect(audioBuffer);

            // 发送测试消息 (每秒一次，避免消息泛滥)
            if (this.stats.framesProcessed % 344 === 0) {
                this.port.postMessage({
                    type: 'test-ping',
                    data: {
                        framesProcessed: this.stats.framesProcessed,
                        volume: volume.toFixed(4),
                        avgProcessingTime: this._getAvgProcessingTime()
                    }
                });
            }

            // Phase 1.6: 透传音频数据 (输出 = 输入)
            const output = outputs[0];
            if (output && output[0]) {
                output[0].set(audioBuffer);
            }

        } catch (error) {
            // 错误报告
            this.port.postMessage({
                type: 'error',
                error: 'processing-error',
                message: error.message,
                stack: error.stack
            });
        }

        // 更新性能统计
        const processingTime = (currentTime - startTime) * 1000; // ms
        this._updateStats(processingTime);

        return true; // 继续处理
    }

    /**
     * 处理主线程消息
     */
    _handleMessage(event) {
        const { type, data } = event.data;

        switch (type) {
            case 'config':
                this._handleConfig(data);
                break;

            case 'update-params':
                this._handleUpdateParams(data);
                break;

            case 'control':
                this._handleControl(event.data);
                break;

            default:
                console.warn('[PitchWorklet] 未知消息类型:', type);
        }
    }

    /**
     * 处理配置消息
     */
    _handleConfig(config) {
        console.log('[PitchWorklet] 收到配置:', config);

        this.config = {
            ...this.config,
            ...config
        };

        // Phase 2: 初始化音高检测器
        // this.detector = this._initDetector(this.config);

        this.port.postMessage({
            type: 'config-applied',
            config: this.config
        });
    }

    /**
     * 处理参数更新
     */
    _handleUpdateParams(params) {
        console.log('[PitchWorklet] 更新参数:', params);

        this.config = {
            ...this.config,
            ...params
        };

        this.port.postMessage({
            type: 'params-updated',
            config: this.config
        });
    }

    /**
     * 处理控制命令
     */
    _handleControl(message) {
        const { command } = message;

        switch (command) {
            case 'reset':
                this._reset();
                break;

            case 'get-stats':
                this._reportStats();
                break;

            default:
                console.warn('[PitchWorklet] 未知控制命令:', command);
        }
    }

    /**
     * 计算 RMS 音量
     */
    _calculateRMS(buffer) {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        return Math.sqrt(sum / buffer.length);
    }

    /**
     * 更新性能统计
     */
    _updateStats(processingTime) {
        this.stats.framesProcessed++;
        this.stats.processingTimes.push(processingTime);

        // 只保留最近 100 帧
        if (this.stats.processingTimes.length > 100) {
            this.stats.processingTimes.shift();
        }

        // 更新最大处理时间
        if (processingTime > this.stats.maxProcessingTime) {
            this.stats.maxProcessingTime = processingTime;
        }

        // 每秒报告一次统计
        if (currentTime - this.stats.lastReportTime >= 1.0) {
            this._reportStats();
            this.stats.lastReportTime = currentTime;
        }
    }

    /**
     * 获取平均处理时间
     */
    _getAvgProcessingTime() {
        const times = this.stats.processingTimes;
        if (times.length === 0) return 0;

        const sum = times.reduce((a, b) => a + b, 0);
        return (sum / times.length).toFixed(3);
    }

    /**
     * 报告性能统计
     */
    _reportStats() {
        this.port.postMessage({
            type: 'stats',
            data: {
                framesProcessed: this.stats.framesProcessed,
                avgProcessingTime: parseFloat(this._getAvgProcessingTime()),
                maxProcessingTime: this.stats.maxProcessingTime.toFixed(3),
                uptime: (currentTime - this.stats.startTime).toFixed(2)
            }
        });
    }

    /**
     * 重置统计
     */
    _reset() {
        this.stats = {
            framesProcessed: 0,
            startTime: currentTime,
            lastReportTime: currentTime,
            processingTimes: [],
            maxProcessingTime: 0
        };

        this.port.postMessage({
            type: 'reset-complete'
        });
    }
}

// 注册处理器
registerProcessor('pitch-detector', PitchDetectorWorklet);

console.log('[PitchWorklet] ✅ PitchDetectorWorklet 已注册');

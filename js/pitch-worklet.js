/**
 * AudioWorklet Pitch Detector Processor
 *
 * Phase 1 完成版: 集成 YIN 音高检测算法
 * - 在 AudioWorklet 线程中运行 YIN 算法
 * - 实时音高检测和平滑处理
 * - 完整的音符信息计算
 * - 与 pitch-detector.js API 兼容
 *
 * 性能目标:
 * - Buffer: 128 samples (2.9ms @ 44.1kHz)
 * - 处理时间: < 1ms per frame
 * - 总延迟: 8-15ms (vs. 46ms ScriptProcessor)
 */

class PitchDetectorWorklet extends AudioWorkletProcessor {
    constructor(options) {
        super();

        console.log('[PitchWorklet] 🎵 Worklet 处理器已创建 - Phase 1 完整版');

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

        // 初始化 YIN 检测器
        this.detector = this._createYINDetector(this.config);

        // 音高历史记录 (用于平滑)
        this.pitchHistory = [];

        // 音符映射表
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // 音频累积缓冲 (YIN需要更大的窗口)
        this.accumulationBuffer = new Float32Array(2048); // YIN 推荐至少 2048
        this.accumulationIndex = 0;
        this.accumulationFull = false;

        // 性能统计
        this.stats = {
            framesProcessed: 0,
            pitchDetections: 0,
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
            sampleRate: this.config.sampleRate,
            bufferSize: 128,
            algorithm: 'YIN'
        });

        console.log('[PitchWorklet] ✅ YIN 检测器初始化完成');
    }

    /**
     * 创建 YIN 音高检测器
     * 基于 Pitchfinder 库的 YIN 实现
     */
    _createYINDetector(config) {
        const threshold = config.threshold || 0.1;
        const probabilityThreshold = 0.1;
        const sampleRate = config.sampleRate;

        return function detectPitch(buffer) {
            if (!buffer || buffer.length < 2) {
                return null;
            }

            const yinBufferSize = Math.floor(buffer.length / 2);
            const yinBuffer = new Float32Array(yinBufferSize);

            // Step 1: 计算差分函数
            let delta;
            for (let t = 0; t < yinBufferSize; t++) {
                yinBuffer[t] = 0;
            }

            for (let t = 1; t < yinBufferSize; t++) {
                for (let i = 0; i < yinBufferSize; i++) {
                    delta = buffer[i] - buffer[i + t];
                    yinBuffer[t] += delta * delta;
                }
            }

            // Step 2: 计算累积平均归一化差分
            yinBuffer[0] = 1;
            let runningSum = 0;
            for (let t = 1; t < yinBufferSize; t++) {
                runningSum += yinBuffer[t];
                yinBuffer[t] *= t / runningSum;
            }

            // Step 3: 绝对阈值
            let tau = -1;
            for (let t = 2; t < yinBufferSize; t++) {
                if (yinBuffer[t] < threshold) {
                    while (t + 1 < yinBufferSize && yinBuffer[t + 1] < yinBuffer[t]) {
                        t++;
                    }
                    tau = t;
                    break;
                }
            }

            // Step 4: 未检测到音高
            if (tau === -1) {
                return null;
            }

            // Step 5: 抛物线插值
            let betterTau;
            const x0 = (tau < 1) ? tau : tau - 1;
            const x2 = (tau + 1 < yinBufferSize) ? tau + 1 : tau;

            if (x0 === tau) {
                betterTau = (yinBuffer[tau] <= yinBuffer[x2]) ? tau : x2;
            } else if (x2 === tau) {
                betterTau = (yinBuffer[tau] <= yinBuffer[x0]) ? tau : x0;
            } else {
                const s0 = yinBuffer[x0];
                const s1 = yinBuffer[tau];
                const s2 = yinBuffer[x2];
                betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
            }

            // 计算频率
            const frequency = sampleRate / betterTau;

            // 检查概率
            const probability = 1 - yinBuffer[tau];
            if (probability < probabilityThreshold) {
                return null;
            }

            return frequency;
        };
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
            // 计算音量
            const volume = this._calculateRMS(audioBuffer);

            // 累积音频数据到更大的缓冲区 (YIN 需要至少 2048 samples)
            this._accumulateAudio(audioBuffer);

            let pitchInfo = null;

            // 当缓冲区满时,执行音高检测
            if (this.accumulationFull) {
                // 检查音量阈值
                if (volume >= this.config.minVolumeThreshold) {
                    const frequency = this.detector(this.accumulationBuffer);

                    if (frequency && frequency > 0 && frequency < 2000) {
                        // 频率范围检查
                        if (frequency >= this.config.minFrequency &&
                            frequency <= this.config.maxFrequency) {

                            // 添加到历史记录
                            this.pitchHistory.push(frequency);
                            if (this.pitchHistory.length > this.config.smoothingSize) {
                                this.pitchHistory.shift();
                            }

                            // 计算平滑后的频率
                            const smoothedFrequency = this._getSmoothedPitch();

                            // 转换为音符信息
                            const noteInfo = this._frequencyToNote(smoothedFrequency);

                            // 计算置信度
                            const confidence = this._calculateConfidence(
                                this.accumulationBuffer,
                                frequency,
                                volume
                            );

                            pitchInfo = {
                                frequency: smoothedFrequency,
                                rawFrequency: frequency,
                                note: noteInfo.note,
                                octave: noteInfo.octave,
                                cents: noteInfo.cents,
                                confidence: confidence,
                                volume: volume
                            };

                            this.stats.pitchDetections++;

                            // 发送音高检测结果到主线程
                            this.port.postMessage({
                                type: 'pitch-detected',
                                data: pitchInfo
                            });
                        }
                    } else if (frequency === null) {
                        // 未检测到音高
                        this.port.postMessage({
                            type: 'no-pitch',
                            data: { volume: volume }
                        });
                    }
                }

                // 重置缓冲区 (滑动窗口: 保留后半部分)
                const halfSize = Math.floor(this.accumulationBuffer.length / 2);
                this.accumulationBuffer.copyWithin(0, halfSize);
                this.accumulationIndex = halfSize;
                this.accumulationFull = false;
            }

            // 透传音频数据 (输出 = 输入)
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
     * 累积音频到更大的缓冲区
     */
    _accumulateAudio(newSamples) {
        const remaining = this.accumulationBuffer.length - this.accumulationIndex;
        const copySize = Math.min(newSamples.length, remaining);

        this.accumulationBuffer.set(
            newSamples.subarray(0, copySize),
            this.accumulationIndex
        );

        this.accumulationIndex += copySize;

        if (this.accumulationIndex >= this.accumulationBuffer.length) {
            this.accumulationFull = true;
        }
    }

    /**
     * 获取平滑后的音高 (中值滤波)
     */
    _getSmoothedPitch() {
        if (this.pitchHistory.length === 0) return 0;

        const sorted = [...this.pitchHistory].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);

        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
            return sorted[mid];
        }
    }

    /**
     * 将频率转换为音符信息
     */
    _frequencyToNote(frequency) {
        // A4 = 440 Hz 为参考
        const A4 = 440;
        const C0 = A4 * Math.pow(2, -4.75); // C0 frequency

        // 计算与C0的半音差
        const halfSteps = 12 * Math.log2(frequency / C0);
        const roundedHalfSteps = Math.round(halfSteps);

        // 计算音符和八度
        const noteIndex = roundedHalfSteps % 12;
        const octave = Math.floor(roundedHalfSteps / 12);

        // 计算音分偏差 (cents)
        const cents = Math.round((halfSteps - roundedHalfSteps) * 100);

        return {
            note: this.noteNames[noteIndex],
            octave: octave,
            fullNote: `${this.noteNames[noteIndex]}${octave}`,
            cents: cents
        };
    }

    /**
     * 计算检测置信度
     */
    _calculateConfidence(audioBuffer, frequency, volume) {
        if (!frequency || frequency <= 0) return 0;

        // 基于音量的置信度
        const minRMS = 0.01;
        const maxRMS = 0.3;

        let confidence = (volume - minRMS) / (maxRMS - minRMS);
        confidence = Math.max(0, Math.min(1, confidence));

        // 频率在人声范围内 (80-800Hz)，提升置信度
        if (frequency >= 80 && frequency <= 800) {
            confidence = Math.min(confidence * 1.2, 1);
        }

        return confidence;
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

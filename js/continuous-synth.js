/**
 * Continuous Frequency Synthesizer Engine
 *
 * 连续频率合成器引擎 - 实时跟踪人声音高变化
 *
 * 核心改进：
 * - 不再量化到离散音符，直接使用检测到的频率（Hz）
 * - 平滑的频率过渡（Portamento/滑音效果）
 * - 保留每个乐器的独特音色和包络特征
 * - 捕捉微妙的音乐表现力（颤音、滑音、音量变化）
 *
 * 架构对比：
 * 旧: PitchDetector → Note("C4") → triggerAttack("C4") → 固定频率
 * 新: PitchDetector → Frequency(Hz) → 平滑 → oscillator.frequency → 实时跟随
 *
 * @class ContinuousSynthEngine
 * @author Kazoo Proto Team
 * @version 2.0.0-alpha
 */

class ContinuousSynthEngine {
    constructor() {
        // 乐器预设配置
        this.instrumentPresets = {
            saxophone: {
                oscillator: { type: 'sawtooth' },
                envelope: {
                    attack: 0.01,
                    decay: 0.2,
                    sustain: 0.8,
                    release: 0.3
                },
                filterEnvelope: {
                    baseFrequency: 2000,
                    octaves: 2,
                    attack: 0.02,
                    decay: 0.1,
                    sustain: 0.5,
                    release: 0.3
                },
                portamento: 0.03  // 30ms 滑音时间（中等表现力）
            },
            violin: {
                oscillator: { type: 'sawtooth' },
                envelope: {
                    attack: 0.1,
                    decay: 0.1,
                    sustain: 0.9,
                    release: 0.4
                },
                filterEnvelope: {
                    baseFrequency: 1500,
                    octaves: 3,
                    attack: 0.08,
                    decay: 0.2,
                    sustain: 0.7,
                    release: 0.4
                },
                portamento: 0.05  // 50ms 更明显的滑音（弦乐特征）
            },
            piano: {
                oscillator: { type: 'triangle' },
                envelope: {
                    attack: 0.005,
                    decay: 0.3,
                    sustain: 0.1,
                    release: 1.0
                },
                filterEnvelope: {
                    baseFrequency: 3000,
                    octaves: 1,
                    attack: 0.005,
                    decay: 0.2,
                    sustain: 0.2,
                    release: 0.8
                },
                portamento: 0.01  // 10ms 快速（钢琴音色更清晰）
            },
            flute: {
                oscillator: { type: 'sine' },
                envelope: {
                    attack: 0.02,
                    decay: 0.1,
                    sustain: 0.8,
                    release: 0.2
                },
                filterEnvelope: {
                    baseFrequency: 2500,
                    octaves: 2.5,
                    attack: 0.03,
                    decay: 0.15,
                    sustain: 0.6,
                    release: 0.2
                },
                portamento: 0.025  // 25ms 轻快的滑音
            },
            guitar: {
                oscillator: { type: 'triangle' },
                envelope: {
                    attack: 0.005,
                    decay: 0.4,
                    sustain: 0.1,
                    release: 0.6
                },
                filterEnvelope: {
                    baseFrequency: 2200,
                    octaves: 1.5,
                    attack: 0.005,
                    decay: 0.3,
                    sustain: 0.2,
                    release: 0.5
                },
                portamento: 0.015  // 15ms 适度滑音
            },
            synth: {
                oscillator: { type: 'square' },
                envelope: {
                    attack: 0.005,
                    decay: 0.1,
                    sustain: 0.7,
                    release: 0.2
                },
                filterEnvelope: {
                    baseFrequency: 3500,
                    octaves: 2,
                    attack: 0.01,
                    decay: 0.05,
                    sustain: 0.8,
                    release: 0.15
                },
                portamento: 0.02  // 20ms 电子感觉
            }
        };

        // 当前状态
        this.currentInstrument = 'saxophone';
        this.currentSynth = null;
        this.isPlaying = false;
        this.currentFrequency = 0;

        // 频率平滑参数
        this.frequencyUpdateThreshold = 0.005;  // 0.5% 差异才更新（避免抖动）
        this.lastUpdateTime = 0;
        this.minUpdateInterval = 10;  // 最小更新间隔 10ms（避免过度触发）

        // 置信度阈值
        this.minConfidence = 0.1;  // 提高到10%，减少噪音误触发

        // 无声检测机制（防止停止哼唱后声音不停）
        this.silenceTimeout = 300;  // 300ms无有效音高则停止
        this.lastValidPitchTime = 0;
        this.silenceCheckInterval = null;

        // 效果器链
        this.vibrato = new Tone.Vibrato({
            frequency: 5,
            depth: 0.1
        });

        this.filter = new Tone.Filter({
            type: 'lowpass',
            frequency: 2000,
            Q: 1
        });

        this.reverb = new Tone.Reverb({
            decay: 1.5,
            wet: 0.2
        }).toDestination();

        // 连接效果器链
        this.vibrato.connect(this.filter);
        this.filter.connect(this.reverb);

        // 性能监控
        this.performanceMetrics = {
            frequencyUpdates: 0,
            lastFrequency: 0,
            updateLatency: []
        };

        console.log('[ContinuousSynth] ✓ Initialized with continuous frequency tracking');
    }

    /**
     * 初始化合成器
     */
    async initialize() {
        await Tone.start();
        this.createSynthesizer(this.currentInstrument);
        console.log('[ContinuousSynth] ✓ Ready');
    }

    /**
     * 创建特定乐器的合成器
     */
    createSynthesizer(instrument) {
        // 停止旧合成器
        if (this.currentSynth) {
            this.stop();
            this.currentSynth.dispose();
        }

        const preset = this.instrumentPresets[instrument] || this.instrumentPresets.saxophone;

        // 使用 MonoSynth 支持连续频率控制
        this.currentSynth = new Tone.MonoSynth({
            oscillator: preset.oscillator,
            envelope: preset.envelope,
            filterEnvelope: preset.filterEnvelope,
            portamento: preset.portamento  // 关键：内置滑音
        });

        // 连接到效果器链
        this.currentSynth.connect(this.vibrato);

        this.currentInstrument = instrument;
        console.log(`[ContinuousSynth] Created: ${instrument} (portamento: ${preset.portamento}s)`);
    }

    /**
     * 处理音高信息 - 核心方法（替代旧的processPitch）
     * @param {Object} pitchInfo - { frequency, note, octave, confidence, volume }
     */
    /**
     * Phase 2: 处理完整的 PitchFrame (包含表现力特征)
     *
     * @param {PitchFrame} pitchFrame - 完整的音高和表现力数据
     */
    processPitchFrame(pitchFrame) {
        // Phase 2.7 TODO: 使用 PitchFrame 的表现力特征
        // - pitchFrame.cents → 精确的 Pitch Bend
        // - pitchFrame.brightness → Filter Cutoff
        // - pitchFrame.breathiness → Noise Amount
        // - pitchFrame.articulation → ADSR Trigger

        // 当前: 回退到基础 processPitch (向后兼容)
        this.processPitch(pitchFrame);
    }

    processPitch(pitchInfo) {
        if (!pitchInfo || !this.currentSynth) return;

        const { frequency, confidence, volume } = pitchInfo;
        const now = Date.now();

        // 置信度和频率有效性检查
        const isValidPitch = confidence >= this.minConfidence &&
                            frequency && frequency >= 20 && frequency <= 2000;

        if (isValidPitch) {
            // 记录有效音高时间
            this.lastValidPitchTime = now;

            // 如果未播放，启动合成器
            if (!this.isPlaying) {
                this.start(frequency, volume);
                this.startSilenceDetection();
                return;
            }

            // 频率平滑更新逻辑
            this.updateFrequency(frequency, now);

            // 更新表现力参数
            this.updateExpressiveness(pitchInfo);
        } else {
            // 无效音高：不立即停止，等待silenceDetection超时
            // 这样可以容忍短暂的检测失败
        }
    }

    /**
     * 启动合成器（开始发声）
     */
    start(initialFrequency, volume = 0.5) {
        try {
            const now = Tone.now();
            const velocity = Math.min(Math.max(volume * 2, 0.1), 1);

            // 触发包络启动（但不指定音符名称）
            // 使用频率直接设置
            this.currentSynth.triggerAttack(initialFrequency, now, velocity);

            this.isPlaying = true;
            this.currentFrequency = initialFrequency;
            this.lastUpdateTime = Date.now();

            console.log(`[ContinuousSynth] ▶ Started at ${initialFrequency.toFixed(1)} Hz`);
        } catch (error) {
            console.error('[ContinuousSynth] ❌ Start error:', error);
        }
    }

    /**
     * 更新频率（实时跟踪）
     */
    updateFrequency(newFrequency, timestamp) {
        // 避免过度频繁更新
        if (timestamp - this.lastUpdateTime < this.minUpdateInterval) {
            return;
        }

        // 计算频率偏差
        const deviation = Math.abs(newFrequency - this.currentFrequency) / this.currentFrequency;

        // 只有明显变化才更新（避免抖动）
        if (deviation > this.frequencyUpdateThreshold) {
            const startTime = performance.now();

            // 关键：直接设置频率值（Tone.js会通过portamento平滑过渡）
            this.currentSynth.frequency.value = newFrequency;

            // 性能监控
            const latency = performance.now() - startTime;
            this.performanceMetrics.frequencyUpdates++;
            this.performanceMetrics.updateLatency.push(latency);
            if (this.performanceMetrics.updateLatency.length > 100) {
                this.performanceMetrics.updateLatency.shift();
            }

            this.currentFrequency = newFrequency;
            this.lastUpdateTime = timestamp;
        }
    }

    /**
     * 更新表现力参数（音量、颤音、亮度）
     */
    updateExpressiveness(pitchInfo) {
        const { cents, volume } = pitchInfo;

        // 从音分偏差计算颤音深度
        if (cents && Math.abs(cents) > 10) {
            const vibratoDepth = Math.min(Math.abs(cents) / 50, 1) * 0.3;
            this.vibrato.depth.rampTo(vibratoDepth, 0.05);
        }

        // 从音量计算滤波器亮度
        if (volume) {
            const brightness = Math.min(volume * 2, 1);
            const filterFreq = 500 + brightness * 3500;
            this.filter.frequency.rampTo(filterFreq, 0.05);
        }
    }

    /**
     * 启动无声检测（防止停止哼唱后声音不停）
     */
    startSilenceDetection() {
        // 清除旧的定时器
        if (this.silenceCheckInterval) {
            clearInterval(this.silenceCheckInterval);
        }

        // 每50ms检查一次是否超时
        this.silenceCheckInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastPitch = now - this.lastValidPitchTime;

            if (timeSinceLastPitch > this.silenceTimeout && this.isPlaying) {
                console.log(`[ContinuousSynth] 🔇 Silence detected (${timeSinceLastPitch}ms), stopping...`);
                this.stop();
            }
        }, 50);
    }

    /**
     * 停止合成器
     */
    stop() {
        if (this.isPlaying && this.currentSynth) {
            try {
                this.currentSynth.triggerRelease(Tone.now());
                this.isPlaying = false;
                this.currentFrequency = 0;

                // 清除无声检测定时器
                if (this.silenceCheckInterval) {
                    clearInterval(this.silenceCheckInterval);
                    this.silenceCheckInterval = null;
                }

                console.log('[ContinuousSynth] ■ Stopped');
            } catch (error) {
                console.error('[ContinuousSynth] ❌ Stop error:', error);
            }
        }
    }

    /**
     * 切换乐器
     */
    changeInstrument(instrument) {
        console.log(`[ContinuousSynth] Changing to: ${instrument}`);
        this.createSynthesizer(instrument);
    }

    /**
     * 获取性能指标
     */
    getPerformanceMetrics() {
        const avgLatency = this.performanceMetrics.updateLatency.length > 0
            ? this.performanceMetrics.updateLatency.reduce((a, b) => a + b, 0) / this.performanceMetrics.updateLatency.length
            : 0;

        return {
            totalUpdates: this.performanceMetrics.frequencyUpdates,
            averageUpdateLatency: avgLatency.toFixed(3),
            currentFrequency: this.currentFrequency.toFixed(2),
            isPlaying: this.isPlaying,
            instrument: this.currentInstrument
        };
    }

    /**
     * 设置置信度阈值
     */
    setConfidenceThreshold(threshold) {
        this.minConfidence = threshold;
    }

    /**
     * 设置频率更新阈值（调整响应性）
     */
    setFrequencyUpdateThreshold(threshold) {
        this.frequencyUpdateThreshold = threshold;
        console.log(`[ContinuousSynth] Frequency threshold: ${threshold * 100}%`);
    }

    /**
     * 设置混响湿度
     */
    setReverbWet(wetness) {
        if (this.reverb) {
            this.reverb.wet.value = wetness;
        }
    }

    /**
     * 清理资源
     */
    dispose() {
        this.stop();

        // 清除定时器
        if (this.silenceCheckInterval) {
            clearInterval(this.silenceCheckInterval);
            this.silenceCheckInterval = null;
        }

        // 清理音频资源
        if (this.currentSynth) this.currentSynth.dispose();
        this.vibrato.dispose();
        this.filter.dispose();
        this.reverb.dispose();

        console.log('[ContinuousSynth] Disposed');
    }
}

// 创建全局单例实例（与旧系统保持一致的接口）
const continuousSynthEngine = new ContinuousSynthEngine();

/**
 * 音色合成模块
 * 使用Tone.js实现多种乐器音色
 */

class SynthesizerEngine {
    constructor() {
        this.currentSynth = null;
        this.currentInstrument = 'saxophone';
        this.isPlaying = false;
        this.currentNote = null;
        this.currentFrequency = 0;

        // 效果器
        this.reverb = null;
        this.vibrato = null;
        this.filter = null;

        // 表现力参数
        this.expressiveness = {
            vibrato: 0,
            brightness: 0.5,
            volume: 0
        };

        // 置信度阈值（降低到0.03以确保能触发）
        this.minConfidence = 0.03;

        // 滑音配置
        this.glideTime = 0.05; // 50ms滑音时间（快速但平滑）
        this.lastFrequency = 0;

        // 音符持续模式（避免频繁重触发）
        this.sustainMode = true; // 启用持续模式
        this.noteChangeThreshold = 100; // 频率变化超过100 cents才算换音符

        // 声音释放定时器
        this.releaseTimer = null;
        this.releaseDelay = 150; // 150ms无输入后才释放声音
    }

    /**
     * 初始化Tone.js和合成器
     */
    async initialize() {
        try {
            // 重要: 检查AudioContext状态并在用户手势后恢复
            // Chrome的自动播放策略要求AudioContext必须在用户手势后启动
            if (Tone.context.state !== 'running') {
                await Tone.start();
                console.log('Tone.js AudioContext resumed after user gesture');
            }

            // 配置Tone.js为低延迟模式
            Tone.context.lookAhead = 0.01; // 10ms预见时间

            console.log('Tone.js initialized:', {
                context: Tone.context.state,
                lookAhead: Tone.context.lookAhead,
                latencyHint: Tone.context.latencyHint
            });

            // 创建效果器链
            this.createEffects();

            // 创建默认合成器
            this.createSynthesizer(this.currentInstrument);

            return true;
        } catch (error) {
            console.error('Failed to initialize synthesizer:', error);
            throw new Error('无法初始化合成器');
        }
    }

    /**
     * 创建效果器链
     */
    createEffects() {
        // 混响
        this.reverb = new Tone.Reverb({
            decay: 2,
            wet: 0.2
        }).toDestination();

        // 颤音
        this.vibrato = new Tone.Vibrato({
            frequency: 5,
            depth: 0.1
        });

        // 滤波器（控制音色亮度）
        this.filter = new Tone.Filter({
            frequency: 2000,
            type: 'lowpass',
            rolloff: -24
        });

        console.log('Effects chain created');
    }

    /**
     * 创建指定乐器的合成器
     */
    createSynthesizer(instrument) {
        // 断开旧合成器
        if (this.currentSynth) {
            this.stopNote();
            this.currentSynth.disconnect();
            this.currentSynth.dispose();
        }

        // 创建新合成器 - 优化包络参数以支持连续滑音
        switch (instrument) {
            case 'saxophone':
                this.currentSynth = new Tone.FMSynth({
                    harmonicity: 3,
                    modulationIndex: 12,
                    oscillator: { type: 'sine' },
                    envelope: {
                        attack: 0.05,      // 稍长的attack避免爆音
                        decay: 0.1,        // 短衰减
                        sustain: 0.95,     // 高sustain保持连续
                        release: 0.4       // 柔和释放
                    },
                    modulation: { type: 'square' },
                    modulationEnvelope: {
                        attack: 0.3,
                        decay: 0.1,
                        sustain: 1,
                        release: 0.3
                    }
                });
                // 设置portamento用于额外平滑
                this.currentSynth.portamento = 0.05;
                break;

            case 'violin':
                this.currentSynth = new Tone.Synth({
                    oscillator: { type: 'sawtooth' },
                    envelope: {
                        attack: 0.08,      // 拉弓启动时间
                        decay: 0.1,
                        sustain: 0.95,     // 高sustain支持连续演奏
                        release: 0.5       // 柔和释放
                    }
                });
                this.currentSynth.portamento = 0.05;
                this.vibrato.frequency.value = 6;
                this.vibrato.depth.value = 0.3;
                break;

            case 'piano':
                this.currentSynth = new Tone.Synth({
                    oscillator: { type: 'triangle' },
                    envelope: {
                        attack: 0.005,
                        decay: 0.3,
                        sustain: 0.1,
                        release: 1
                    }
                });
                // 钢琴不需要portamento（弹拨类）
                break;

            case 'flute':
                this.currentSynth = new Tone.AMSynth({
                    harmonicity: 2,
                    oscillator: { type: 'sine' },
                    envelope: {
                        attack: 0.03,      // 吹气启动
                        decay: 0.05,
                        sustain: 0.95,     // 高sustain保持气流
                        release: 0.3
                    },
                    modulation: { type: 'square' },
                    modulationEnvelope: {
                        attack: 0.3,
                        decay: 0.1,
                        sustain: 1,
                        release: 0.3
                    }
                });
                this.currentSynth.portamento = 0.05;
                break;

            case 'guitar':
                this.currentSynth = new Tone.PluckSynth({
                    attackNoise: 1,
                    dampening: 4000,
                    resonance: 0.9
                });
                // 吉他不需要portamento（弹拨类）
                break;

            case 'synth':
                this.currentSynth = new Tone.Synth({
                    oscillator: { type: 'square' },
                    envelope: {
                        attack: 0.01,
                        decay: 0.05,
                        sustain: 0.9,      // 高sustain
                        release: 0.3
                    }
                });
                this.currentSynth.portamento = 0.05;
                break;

            default:
                this.currentSynth = new Tone.Synth();
        }

        // 连接效果器链
        this.currentSynth.connect(this.vibrato);
        this.vibrato.connect(this.filter);
        this.filter.connect(this.reverb);

        this.currentInstrument = instrument;
        console.log(`Synthesizer created: ${instrument}`);
    }

    /**
     * 处理音高信息 - 简化版连续模式
     */
    processPitch(pitchInfo) {
        if (!pitchInfo || !this.currentSynth) return;

        const { frequency, note, octave, confidence, volume } = pitchInfo;

        // 检查置信度阈值
        if (confidence < this.minConfidence) {
            // 延迟释放
            this.scheduleRelease();
            return;
        }

        // 取消释放计划
        this.cancelRelease();

        const fullNote = `${note}${octave}`;

        // 更新表现力参数
        this.updateExpressiveness(pitchInfo);

        // 如果未播放，启动声音
        if (!this.isPlaying) {
            this.playNote(fullNote, frequency, volume);
            this.lastFrequency = frequency;
            this.currentNote = fullNote;
            return;
        }

        // 已经在播放，判断是否需要改变音高
        if (fullNote !== this.currentNote) {
            // 音符改变了
            // 对于弹拨类乐器：必须重触发
            if (this.currentInstrument === 'guitar' || this.currentInstrument === 'piano') {
                try {
                    this.currentSynth.triggerRelease(Tone.now());
                } catch (e) {}
                this.playNote(fullNote, frequency, volume);
            } else {
                // 持续类乐器：使用滑音
                this.glideToFrequency(frequency);
            }
            this.currentNote = fullNote;
        } else {
            // 同一音符，微调频率（滑音效果）
            if (Math.abs(frequency - this.lastFrequency) > 1) {
                this.glideToFrequency(frequency);
            }
        }

        this.lastFrequency = frequency;
    }

    /**
     * 播放音符 - 优化版本，减少延迟
     */
    playNote(note, frequency, volume = 0.5) {
        try {
            const now = Tone.now();
            const velocity = Math.min(Math.max(volume * 2, 0.1), 1);

            console.log(`[Synth] 🎵 Playing: ${note} @ ${frequency.toFixed(1)}Hz, vel=${velocity.toFixed(2)}`);

            // 对于弹拨类乐器使用triggerAttackRelease
            if (this.currentInstrument === 'guitar' || this.currentInstrument === 'piano') {
                this.currentSynth.triggerAttackRelease(note, '0.5', now, velocity);
            } else {
                // 对于持续类乐器使用triggerAttack
                this.currentSynth.triggerAttack(note, now, velocity);
            }

            this.isPlaying = true;
            this.currentNote = note;
            this.currentFrequency = frequency;

        } catch (error) {
            console.error('[Synthesizer] ❌ Error playing note:', error);
            console.error('Error details:', error.stack);
        }
    }

    /**
     * 停止当前音符
     */
    stopNote() {
        if (this.isPlaying && this.currentSynth) {
            try {
                this.currentSynth.triggerRelease(Tone.now());
                this.isPlaying = false;
                this.currentNote = null;
                this.lastFrequency = 0;
            } catch (error) {
                console.error('Error stopping note:', error);
            }
        }
    }

    /**
     * 滑音到目标频率 - 使用exponentialRampTo实现平滑过渡
     */
    glideToFrequency(targetFrequency) {
        if (!this.currentSynth || !this.isPlaying) return;

        try {
            const now = Tone.now();

            // 对于支持frequency参数的合成器
            if (this.currentSynth.frequency) {
                // 使用exponentialRampTo创建平滑的音高过渡
                this.currentSynth.frequency.exponentialRampTo(
                    targetFrequency,
                    this.glideTime,
                    now
                );
            }

            this.currentFrequency = targetFrequency;
        } catch (error) {
            console.error('[Synthesizer] Glide error:', error);
        }
    }

    /**
     * 计划延迟释放声音
     */
    scheduleRelease() {
        if (this.releaseTimer) return; // 已有计划，不重复

        this.releaseTimer = setTimeout(() => {
            this.stopNote();
            this.releaseTimer = null;
        }, this.releaseDelay);
    }

    /**
     * 取消释放计划
     */
    cancelRelease() {
        if (this.releaseTimer) {
            clearTimeout(this.releaseTimer);
            this.releaseTimer = null;
        }
    }

    /**
     * 更新表现力参数
     */
    updateExpressiveness(pitchInfo) {
        const { cents, volume } = pitchInfo;

        // 从音分偏差计算颤音
        if (Math.abs(cents) > 10) {
            this.expressiveness.vibrato = Math.min(Math.abs(cents) / 50, 1);
            this.vibrato.depth.value = this.expressiveness.vibrato * 0.3;
        }

        // 从音量计算亮度
        this.expressiveness.brightness = Math.min(volume * 2, 1);
        const filterFreq = 500 + this.expressiveness.brightness * 3500;
        this.filter.frequency.rampTo(filterFreq, 0.05);

        this.expressiveness.volume = volume;
    }

    /**
     * 切换乐器
     */
    changeInstrument(instrument) {
        console.log(`Changing instrument to: ${instrument}`);
        this.createSynthesizer(instrument);
    }

    /**
     * 设置置信度阈值
     */
    setConfidenceThreshold(threshold) {
        this.minConfidence = threshold;
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
     * 全局静音
     */
    mute() {
        this.stopNote();
        Tone.Destination.mute = true;
    }

    /**
     * 取消静音
     */
    unmute() {
        Tone.Destination.mute = false;
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            isPlaying: this.isPlaying,
            currentNote: this.currentNote,
            currentInstrument: this.currentInstrument,
            expressiveness: this.expressiveness
        };
    }

    /**
     * 清理资源
     */
    dispose() {
        this.stopNote();

        if (this.currentSynth) {
            this.currentSynth.dispose();
        }

        if (this.reverb) {
            this.reverb.dispose();
        }

        if (this.vibrato) {
            this.vibrato.dispose();
        }

        if (this.filter) {
            this.filter.dispose();
        }
    }
}

// 导出单例实例
const synthesizerEngine = new SynthesizerEngine();

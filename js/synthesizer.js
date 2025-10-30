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

        // 音符触发阈值（降低以便更容易触发声音）
        this.minConfidence = 0.3;
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

        // 创建新合成器
        switch (instrument) {
            case 'saxophone':
                this.currentSynth = new Tone.FMSynth({
                    harmonicity: 3,
                    modulationIndex: 12,
                    oscillator: { type: 'sine' },
                    envelope: {
                        attack: 0.01,
                        decay: 0.2,
                        sustain: 0.8,
                        release: 0.3
                    },
                    modulation: { type: 'square' },
                    modulationEnvelope: {
                        attack: 0.5,
                        decay: 0.2,
                        sustain: 1,
                        release: 0.5
                    }
                });
                break;

            case 'violin':
                this.currentSynth = new Tone.Synth({
                    oscillator: { type: 'sawtooth' },
                    envelope: {
                        attack: 0.1,
                        decay: 0.2,
                        sustain: 0.9,
                        release: 0.4
                    }
                });
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
                break;

            case 'flute':
                this.currentSynth = new Tone.AMSynth({
                    harmonicity: 2,
                    oscillator: { type: 'sine' },
                    envelope: {
                        attack: 0.02,
                        decay: 0.1,
                        sustain: 0.8,
                        release: 0.2
                    },
                    modulation: { type: 'square' },
                    modulationEnvelope: {
                        attack: 0.5,
                        decay: 0.2,
                        sustain: 1,
                        release: 0.5
                    }
                });
                break;

            case 'guitar':
                this.currentSynth = new Tone.PluckSynth({
                    attackNoise: 1,
                    dampening: 4000,
                    resonance: 0.9
                });
                break;

            case 'synth':
                this.currentSynth = new Tone.Synth({
                    oscillator: { type: 'square' },
                    envelope: {
                        attack: 0.005,
                        decay: 0.1,
                        sustain: 0.7,
                        release: 0.2
                    }
                });
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
     * 处理音高信息并触发音符
     */
    processPitch(pitchInfo) {
        if (!pitchInfo) {
            console.warn('[Synthesizer] No pitch info provided');
            return;
        }

        if (!this.currentSynth) {
            console.error('[Synthesizer] Synth not initialized!');
            return;
        }

        const { frequency, note, octave, confidence, volume } = pitchInfo;

        // 检查置信度阈值
        if (confidence < this.minConfidence) {
            console.log(`[Synthesizer] Low confidence: ${confidence.toFixed(2)} < ${this.minConfidence}`);
            if (this.isPlaying) {
                this.stopNote();
            }
            return;
        }

        const fullNote = `${note}${octave}`;
        console.log(`[Synthesizer] Processing: ${fullNote} (${frequency.toFixed(1)}Hz, conf: ${confidence.toFixed(2)}, vol: ${volume.toFixed(2)})`);

        // 更新表现力参数
        this.updateExpressiveness(pitchInfo);

        // 如果是新音符，触发新的音符
        if (fullNote !== this.currentNote) {
            if (this.isPlaying) {
                this.stopNote();
            }
            this.playNote(fullNote, frequency, volume);
        } else {
            // 相同音符，更新音高弯曲（滑音效果）
            this.updatePitch(frequency);
        }
    }

    /**
     * 播放音符
     */
    playNote(note, frequency, volume = 0.5) {
        try {
            const now = Tone.now();
            const velocity = Math.min(Math.max(volume * 2, 0.1), 1);

            console.log(`[Synthesizer] 🎵 Playing note: ${note}, velocity: ${velocity.toFixed(2)}, instrument: ${this.currentInstrument}`);
            console.log(`[Synthesizer] Tone.context.state: ${Tone.context.state}`);

            // 对于弹拨类乐器使用triggerAttackRelease
            if (this.currentInstrument === 'guitar' || this.currentInstrument === 'piano') {
                this.currentSynth.triggerAttackRelease(note, '0.5', now, velocity);
                console.log(`[Synthesizer] Triggered pluck/strike sound`);
            } else {
                // 对于持续类乐器使用triggerAttack
                this.currentSynth.triggerAttack(note, now, velocity);
                console.log(`[Synthesizer] Triggered sustained sound`);
            }

            this.isPlaying = true;
            this.currentNote = note;
            this.currentFrequency = frequency;

        } catch (error) {
            console.error('[Synthesizer] ❌ Error playing note:', error);
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
            } catch (error) {
                console.error('Error stopping note:', error);
            }
        }
    }

    /**
     * 更新音高（用于滑音效果）
     */
    updatePitch(frequency) {
        // Tone.js的音高弯曲需要更复杂的实现
        // 这里简化处理，仅在频率偏差较大时重新触发
        if (this.currentFrequency > 0) {
            const deviation = Math.abs(frequency - this.currentFrequency) / this.currentFrequency;
            if (deviation > 0.02) { // 2%偏差
                this.currentFrequency = frequency;
                // 可以在这里实现portamento效果
            }
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

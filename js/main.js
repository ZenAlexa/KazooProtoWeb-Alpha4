/**
 * 主控制器 - 无校准版本
 * 极简设计：选择乐器 → 开始播放
 *
 * Phase 1: 集成 AudioIO 低延迟音频抽象层
 * Phase 2: 集成 ExpressiveFeatures 表现力特征提取管线
 * Phase 2.10: 集成集中式配置管理系统
 */

import configManager from './config/app-config.js';

class KazooApp {
    constructor() {
        this.isRunning = false;

        // Phase 2.10: 加载应用配置 (默认配置)
        this.config = null;  // 由 initialize() 加载

        // Phase 1: 音频系统选择
        // Feature Flag: 使用 AudioIO (支持 Worklet) 或 audioInputManager (Legacy)
        this.useAudioIO = true;  // Phase 1: 启用 AudioIO 抽象层
        this.audioIO = null;     // AudioIO 实例

        // Phase 2: 双引擎模式
        this.useContinuousMode = true;  // Phase 2: 默认使用 Continuous 模式 (Phase 2.7 已验证)
        this.currentEngine = null;      // 当前激活的引擎

        // Phase 2: 表现力特征提取
        this.expressiveFeatures = null;  // ExpressiveFeatures 实例

        // UI元素
        this.ui = {
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            helpBtn: document.getElementById('helpBtn'),
            helpToggle: document.getElementById('helpToggle'),
            helpContent: document.getElementById('helpContent'),
            warningBox: document.getElementById('warningBox'),
            warningText: document.getElementById('warningText'),

            // Phase 2: 模式切换
            modeToggle: document.getElementById('modeToggle'),
            modeText: document.getElementById('modeText'),

            // 状态徽章
            instrumentStatus: document.getElementById('instrumentStatus'),
            recordingStatus: document.getElementById('recordingStatus'),
            recordingHelper: document.getElementById('recordingHelper'),

            // 状态和可视化
            statusBar: document.getElementById('statusBar'),
            visualizer: document.getElementById('visualizer'),
            systemStatus: document.getElementById('systemStatus'),
            latency: document.getElementById('latency'),
            confidence: document.getElementById('confidence'),
            currentNote: document.getElementById('currentNote'),
            currentFreq: document.getElementById('currentFreq'),
            pitchCanvas: document.getElementById('pitchCanvas'),

            // 乐器按钮
            instrumentBtns: document.querySelectorAll('.instrument-btn')
        };

        // 可视化设置
        this.visualizer = null;
    }

    /**
     * 初始化应用
     */
    async initialize() {
        console.log('Initializing Kazoo App (No-Calibration Version)...');

        // Phase 2.10: 加载集中式配置
        try {
            this.config = configManager.load();  // 默认配置
            console.log('[Config] Loaded default configuration:', {
                sampleRate: this.config.audio.sampleRate,
                bufferSize: this.config.audio.bufferSize,
                useWorklet: this.config.audio.useWorklet
            });
        } catch (error) {
            console.error('[Config] Failed to load configuration:', error);
            console.error('[Config] Using emergency fallback values');
            // 真正的回退: 使用硬编码的最小可用配置 (必须与 app-config.js 结构一致)
            this.config = {
                audio: { sampleRate: 44100, bufferSize: 2048, workletBufferSize: 128, useWorklet: true },
                pitchDetector: { clarityThreshold: 0.9, minFrequency: 80, maxFrequency: 800 },
                smoothing: {
                    kalman: { processNoise: 0.001, measurementNoise: 0.1, initialEstimate: 0, initialError: 1 },
                    volume: { alpha: 0.3 },
                    brightness: { alpha: 0.2 }
                },
                onset: { energyThreshold: 6, silenceThreshold: -40, attackDuration: 50, minSilenceDuration: 100, timeWindow: 3, debug: false },
                spectral: { fftSize: 2048, fftInterval: 2, minFrequency: 80, maxFrequency: 8000 },
                synthesizer: { pitchBendRange: 100, filterCutoffRange: { min: 200, max: 8000 }, noiseGainMax: 0.3 },
                performance: { enableStats: true, logLevel: 'info' }
            };
        }

        // 检查兼容性
        this.checkCompatibility();

        // 绑定事件
        this.bindEvents();

        // 初始化可视化
        this.initVisualizer();

        console.log('App initialized - Ready to play!');
    }

    /**
     * 检查浏览器兼容性
     */
    checkCompatibility() {
        const support = audioInputManager.checkBrowserSupport();

        if (!support.isSupported) {
            this.ui.warningBox.classList.remove('hidden');
            this.ui.warningText.innerHTML = support.issues.map(i => `<li>${i}</li>`).join('');
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 开始/停止
        this.ui.startBtn.addEventListener('click', () => this.start());
        this.ui.stopBtn.addEventListener('click', () => this.stop());

        // Phase 2: 模式切换
        this.ui.modeToggle.addEventListener('change', (e) => {
            if (this.isRunning) {
                alert('Please stop playback before switching modes.');
                e.target.checked = this.useContinuousMode;
                return;
            }
            this.switchMode(e.target.checked);
        });

        // 乐器选择
        this.ui.instrumentBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.ui.instrumentBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const instrument = e.currentTarget.dataset.instrument;

                // 更新状态徽章
                const instrumentName = e.currentTarget.querySelector('.instrument-name').textContent;
                this.ui.instrumentStatus.textContent = instrumentName;

                // 如果合成器已初始化，切换乐器（使用当前引擎）
                if (this.currentEngine && this.currentEngine.currentSynth) {
                    this.currentEngine.changeInstrument(instrument);
                }
            });
        });

        // 帮助
        this.ui.helpBtn.addEventListener('click', () => {
            this.ui.helpContent.classList.toggle('show');
        });

        this.ui.helpToggle.addEventListener('click', () => {
            this.ui.helpContent.classList.toggle('show');
        });
    }

    /**
     * Phase 2: 切换引擎模式
     */
    switchMode(useContinuous) {
        this.useContinuousMode = useContinuous;
        this.ui.modeText.textContent = useContinuous ? 'Continuous' : 'Legacy';

        console.log(`[Mode Switch] ${useContinuous ? 'Continuous' : 'Legacy'} mode activated`);
    }

    /**
     * 开始播放
     * Phase 1: 使用 AudioIO 或 audioInputManager
     */
    async start() {
        try {
            console.log(`Starting Kazoo Proto in ${this.useContinuousMode ? 'Continuous' : 'Legacy'} mode...`);

            // Phase 1: 选择音频系统
            if (this.useAudioIO) {
                await this._startWithAudioIO();
            } else {
                await this._startWithLegacyAudio();
            }

            // 更新UI
            this.isRunning = true;
            this.ui.startBtn.classList.add('hidden');
            this.ui.stopBtn.classList.remove('hidden');
            this.ui.statusBar.classList.remove('hidden');
            this.ui.visualizer.classList.remove('hidden');
            this.ui.systemStatus.textContent = `Running (${this.useContinuousMode ? 'Continuous' : 'Legacy'})`;
            this.ui.systemStatus.classList.add('active');
            this.ui.recordingStatus.textContent = 'Playing';
            this.ui.recordingStatus.classList.add('status-ready');
            this.ui.recordingHelper.textContent = 'Hum or sing to hear your voice transformed!';

            console.log('✓ Kazoo Proto is running!');

        } catch (error) {
            console.error('Failed to start:', error);
            alert('Failed to start: ' + error.message + '\n\nPlease check:\n- Microphone permission\n- HTTPS connection\n- Browser compatibility');
        }
    }

    /**
     * Phase 1: 使用 AudioIO 启动
     */
    async _startWithAudioIO() {
        console.log('🚀 [Phase 1] 使用 AudioIO 抽象层');

        // 1. 创建 AudioIO 实例
        if (!this.audioIO) {
            this.audioIO = new AudioIO();

            // Phase 2.10: 使用集中式配置 + 下发到 Worklet
            this.audioIO.configure({
                useWorklet: this.config.audio.useWorklet,
                workletBufferSize: this.config.audio.workletBufferSize || 128,  // 从配置读取
                bufferSize: this.config.audio.bufferSize,
                workletFallback: true,      // 自动回退到 ScriptProcessor
                sampleRate: this.config.audio.sampleRate,
                latencyHint: 'interactive',
                debug: this.config.performance.enableStats,
                // ⚠️ P0 修复: 传递完整配置对象,供 AudioIO 序列化并下发到 Worklet
                appConfig: this.config
            });

            // Phase 2.9: 注册专用 Worklet 回调 (避免与 ScriptProcessor 路径冲突)
            this.audioIO.onWorkletPitchFrame((pitchFrame, timestamp) => {
                this.handleWorkletPitchFrame(pitchFrame, timestamp);
            });

            // ScriptProcessor 模式回调 (Fallback)
            this.audioIO.onFrame((data, timestamp) => {
                // 只处理 Float32Array (ScriptProcessor 模式)
                if (data instanceof Float32Array) {
                    this.onAudioProcess(data);
                }
                // 如果是 PitchFrame 对象但未注册 Worklet 回调，也可在此处理
                else if (data && typeof data === 'object' && 'frequency' in data) {
                    console.warn('[Main] ⚠️ 收到 PitchFrame 但应使用 onWorkletPitchFrame 回调');
                }
            });

            // 错误处理
            this.audioIO.onError((type, error) => {
                console.error('[AudioIO Error]', type, error);
            });
        }

        // 2. 启动音频系统 (先启动，获取实际 mode 和 bufferSize)
        const result = await this.audioIO.start();
        console.log('🎵 AudioIO 已启动:', result);

        // 3. 初始化引擎 (使用实际的 audioContext 和 bufferSize)
        const ctx = this.audioIO.audioContext;
        // Phase 2.10: Worklet 使用 workletBufferSize，ScriptProcessor 使用 bufferSize
        const bufferSize = result.mode === 'worklet'
            ? (this.config.audio.workletBufferSize || 128)  // 从配置读取，默认 128
            : this.config.audio.bufferSize;
        await this._initializeEngines(ctx, bufferSize, result.mode);

        // 4. 更新性能监控
        if (!performanceMonitor.metrics.sampleRate) {
            await performanceMonitor.initialize(ctx, bufferSize, result.mode);
        }
    }

    /**
     * Phase 1: 使用 Legacy audioInputManager 启动
     */
    async _startWithLegacyAudio() {
        console.log('🔄 [Legacy] 使用 audioInputManager');

        // 初始化音频系统
        if (!audioInputManager.audioContext) {
            await audioInputManager.initialize();
        }

        // 启动麦克风
        await audioInputManager.startMicrophone();

        // 初始化引擎 (使用 Legacy 的 bufferSize)
        await this._initializeEngines(
            audioInputManager.audioContext,
            audioInputManager.config.bufferSize,
            'script-processor'
        );

        // 设置音频处理回调
        audioInputManager.onAudioProcess = this.onAudioProcess.bind(this);

        // 初始化性能监控
        if (!performanceMonitor.metrics.sampleRate) {
            await performanceMonitor.initialize(
                audioInputManager.audioContext,
                audioInputManager.config.bufferSize,
                'script-processor'
            );
        }
    }

    /**
     * 初始化合成器引擎和音高检测器
     * Phase 2: 添加 ExpressiveFeatures 初始化
     *
     * @param {AudioContext} audioContext - Web Audio API 上下文
     * @param {number} bufferSize - 实际使用的缓冲区大小
     * @param {string} mode - 音频模式 ('worklet' | 'script-processor')
     */
    async _initializeEngines(audioContext, bufferSize = 2048, mode = 'script-processor') {
        // 选择引擎
        if (this.useContinuousMode) {
            this.currentEngine = continuousSynthEngine;
            console.log('Using Continuous Frequency Engine');
        } else {
            this.currentEngine = synthesizerEngine;
            console.log('Using Legacy Note-Based Engine');
        }

        // 初始化选中的引擎
        if (!this.currentEngine.currentSynth) {
            console.log('Initializing synthesizer engine...');
            await this.currentEngine.initialize();
        }

        // 初始化音高检测 (ScriptProcessor 模式需要)
        if (mode !== 'worklet' && audioContext && !pitchDetector.detector) {
            console.log('Initializing pitch detector...');
            pitchDetector.initialize(audioContext.sampleRate);
        }

        // Phase 2.9: ExpressiveFeatures 仅在 ScriptProcessor 模式下初始化
        // Worklet 模式下所有特征提取已在 Worklet 线程完成
        if (mode !== 'worklet' && !this.expressiveFeatures && audioContext && window.ExpressiveFeatures) {
            console.log('🎨 [Phase 2.10] Initializing ExpressiveFeatures (ScriptProcessor 模式) with centralized config...');
            console.log(`  Mode: ${mode}, Buffer: ${bufferSize}, SampleRate: ${audioContext.sampleRate}`);

            // Phase 2.10: 使用集中式配置
            this.expressiveFeatures = new window.ExpressiveFeatures({
                audioContext: audioContext,
                sampleRate: audioContext.sampleRate,
                bufferSize: bufferSize,
                mode: mode,
                // 注入配置参数
                config: this.config
            });

            // Phase 2.5: 注入 sourceNode 启用 AnalyserNode FFT (仅 ScriptProcessor 模式)
            if (this.useAudioIO && this.audioIO && this.audioIO.sourceNode) {
                const success = this.expressiveFeatures.setSourceNode(this.audioIO.sourceNode);
                if (success) {
                    console.log('✅ [Phase 2.5] AnalyserNode FFT 已启用 (原生加速)');
                } else {
                    console.warn('⚠️ [Phase 2.5] AnalyserNode FFT 启用失败，继续使用纯 JS FFT');
                }
            }
        } else if (mode === 'worklet') {
            console.log('✅ [Phase 2.9] Worklet 模式 - 主线程跳过 ExpressiveFeatures (特征已在 Worklet 计算)');
        } else if (!window.ExpressiveFeatures) {
            console.warn('⚠️ [Phase 2] ExpressiveFeatures 模块未加载，跳过初始化');
        }
    }

    /**
     * 停止播放
     * Phase 1: 支持 AudioIO 和 audioInputManager
     */
    stop() {
        this.isRunning = false;

        // Phase 1: 停止音频系统
        if (this.useAudioIO && this.audioIO) {
            this.audioIO.stop();
        } else {
            audioInputManager.stop();
        }

        // Phase 2: 停止当前引擎
        if (this.currentEngine) {
            if (this.useContinuousMode) {
                this.currentEngine.stop();
            } else {
                this.currentEngine.stopNote();
            }
        }

        // 更新UI
        this.ui.startBtn.classList.remove('hidden');
        this.ui.stopBtn.classList.add('hidden');
        this.ui.systemStatus.textContent = 'Stopped';
        this.ui.systemStatus.classList.remove('active');
        this.ui.recordingStatus.textContent = 'Ready';
        this.ui.recordingHelper.textContent = 'No setup required • Works in your browser';

        console.log('Kazoo Proto stopped');
    }

    /**
     * Phase 1: 处理来自 AudioWorklet 的音高检测结果
     * Phase 2: 集成 ExpressiveFeatures，生成完整 PitchFrame
     *
     * 注意: AudioWorklet 模式下，目前 pitchInfo 来自 Worklet，
     *       但 audioBuffer 不可用。Phase 2.6 需要在 Worklet 中传递 buffer。
     */
    onPitchDetected(pitchInfo) {
        if (!this.isRunning || !this.currentEngine) return;

        // 性能监控开始
        performanceMonitor.startProcessing();

        // Phase 2: 生成 PitchFrame
        // ⚠️ 警告: AudioWorklet 模式下没有 audioBuffer，表现力特征不完整
        let pitchFrame = pitchInfo;  // 默认使用原始 pitchInfo
        if (this.expressiveFeatures) {
            try {
                // TODO Phase 2.7: 在 Worklet 中传递 audioBuffer 或直接计算特征
                const dummyBuffer = new Float32Array(128);  // 占位 (volumeDb 会是 -60)
                console.warn('[Phase 2] AudioWorklet 模式下表现力特征不完整，请使用 ScriptProcessor');

                pitchFrame = this.expressiveFeatures.process({
                    pitchInfo,
                    audioBuffer: dummyBuffer,
                    timestamp: performance.now()
                });
            } catch (error) {
                console.error('[ExpressiveFeatures Error]', error);
                pitchFrame = pitchInfo;  // 回退到基础 pitchInfo
            }
        }

        // 更新显示
        this.ui.currentNote.textContent = `${pitchFrame.note}${pitchFrame.octave}`;
        this.ui.currentFreq.textContent = `${pitchFrame.frequency.toFixed(1)} Hz`;
        this.ui.confidence.textContent = `${Math.round(pitchFrame.confidence * 100)}%`;

        // Phase 2: 驱动当前引擎 (优先使用 processPitchFrame，回退到 processPitch)
        if (this.currentEngine.processPitchFrame) {
            this.currentEngine.processPitchFrame(pitchFrame);
        } else {
            this.currentEngine.processPitch(pitchInfo);
        }

        // 可视化
        this.updateVisualizer(pitchFrame);

        // 性能监控结束
        performanceMonitor.endProcessing();

        // 更新性能指标
        performanceMonitor.updateFPS();
        const metrics = performanceMonitor.getMetrics();
        this.ui.latency.textContent = `${metrics.totalLatency}ms`;
    }

    /**
     * 音频处理 - ScriptProcessor 模式 (Fallback)
     * 数据流: ScriptProcessorNode → PitchDetector → ExpressiveFeatures → Synth
     *
     * ⚠️ Worklet 模式下此方法不应被调用 (数据已在 Worklet 处理完毕)
     */
    onAudioProcess(audioBuffer) {
        if (!this.isRunning || !this.currentEngine) return;

        // Phase 2.9: Worklet 模式下跳过此流程
        if (this.audioIO && this.audioIO.mode === 'worklet') {
            console.warn('[Main] ⚠️ Worklet 模式下不应调用 onAudioProcess - 数据应通过 handleWorkletPitchFrame');
            return;
        }

        // 性能监控开始
        performanceMonitor.startProcessing();

        const volume = audioInputManager.getVolume(audioBuffer);
        const pitchInfo = pitchDetector.detect(audioBuffer, volume);

        if (pitchInfo) {
            // Phase 2: 生成完整 PitchFrame (包含表现力特征)
            let pitchFrame = pitchInfo;  // 默认使用基础 pitchInfo
            if (this.expressiveFeatures) {
                try {
                    pitchFrame = this.expressiveFeatures.process({
                        pitchInfo,
                        audioBuffer,  // ScriptProcessor 模式有完整 buffer
                        timestamp: performance.now()
                    });
                } catch (error) {
                    console.error('[ExpressiveFeatures Error]', error);
                    pitchFrame = pitchInfo;  // 回退到基础 pitchInfo
                }
            }

            // 更新显示
            this.ui.currentNote.textContent = `${pitchFrame.note}${pitchFrame.octave}`;
            this.ui.currentFreq.textContent = `${pitchFrame.frequency.toFixed(1)} Hz`;
            this.ui.confidence.textContent = `${Math.round(pitchFrame.confidence * 100)}%`;

            // Phase 2: 驱动当前引擎 (优先使用 processPitchFrame，回退到 processPitch)
            if (this.currentEngine.processPitchFrame) {
                this.currentEngine.processPitchFrame(pitchFrame);
            } else {
                this.currentEngine.processPitch(pitchInfo);
            }

            // 可视化
            this.updateVisualizer(pitchFrame);
        }

        // 性能监控结束
        performanceMonitor.endProcessing();

        // 更新性能指标
        performanceMonitor.updateFPS();
        const metrics = performanceMonitor.getMetrics();
        this.ui.latency.textContent = `${metrics.totalLatency}ms`;
    }

    /**
     * Phase 2.9: 处理 Worklet 模式的完整 PitchFrame
     *
     * 数据流: AudioWorkletNode.process() → YIN + FFT + EMA + OnsetDetector →
     *         pitch-frame message → onWorkletPitchFrame 回调 → 此方法
     *
     * @param {PitchFrame} pitchFrame - 包含 11 个字段的完整音高帧
     * @param {number} timestamp - 时间戳 (ms)
     */
    handleWorkletPitchFrame(pitchFrame, timestamp) {
        if (!this.isRunning || !this.currentEngine) return;

        // Phase 2.9 调试: 首次调用时打印完整 PitchFrame
        if (!this._workletPitchFrameLogged) {
            console.log('[Main] 🎯 handleWorkletPitchFrame 首次调用:', {
                pitchFrame,
                timestamp,
                fields: Object.keys(pitchFrame)
            });
            console.log('[Main] ✅ Worklet 数据流已建立 - 跳过主线程 ExpressiveFeatures');
            this._workletPitchFrameLogged = true;
        }

        // 性能监控开始
        performanceMonitor.startProcessing();

        // 更新 UI 显示
        this.ui.currentNote.textContent = `${pitchFrame.note}${pitchFrame.octave}`;
        this.ui.currentFreq.textContent = `${pitchFrame.frequency.toFixed(1)} Hz`;
        this.ui.confidence.textContent = `${Math.round(pitchFrame.confidence * 100)}%`;

        // 直接传递给合成器 (PitchFrame 已包含所有表现力特征)
        if (this.currentEngine.processPitchFrame) {
            this.currentEngine.processPitchFrame(pitchFrame);
        } else if (this.currentEngine.processPitch) {
            // Fallback: 合成器不支持完整 PitchFrame API
            this.currentEngine.processPitch(pitchFrame);
        }

        // 更新可视化
        this.updateVisualizer(pitchFrame);

        // 性能监控结束
        performanceMonitor.endProcessing();
        performanceMonitor.updateFPS();

        // 更新延迟显示
        const metrics = performanceMonitor.getMetrics();
        this.ui.latency.textContent = `${metrics.totalLatency}ms`;
    }

    /**
     * 初始化可视化
     */
    initVisualizer() {
        const canvas = this.ui.pitchCanvas;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        this.visualizer = {
            ctx: canvas.getContext('2d'),
            history: [],
            noteHistory: [],  // 存储音符信息
            maxHistory: 200,
            // 音高范围设置 (C2 到 C6)
            minFreq: 65.41,   // C2
            maxFreq: 1046.50, // C6
            // 参考音符线 (C3, C4, C5)
            referenceNotes: [
                { freq: 130.81, note: 'C3' },
                { freq: 261.63, note: 'C4' },
                { freq: 523.25, note: 'C5' }
            ]
        };
    }

    /**
     * 更新可视化 - 简易音高曲线
     */
    updateVisualizer(pitchInfo) {
        const { ctx, minFreq, maxFreq } = this.visualizer;
        const canvas = this.ui.pitchCanvas;

        // 存储历史数据
        this.visualizer.history.push(pitchInfo.frequency);
        if (this.visualizer.history.length > this.visualizer.maxHistory) {
            this.visualizer.history.shift();
        }

        // 清空画布
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 绘制简单的音高曲线
        if (this.visualizer.history.length > 1) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();

            const xStep = canvas.width / this.visualizer.maxHistory;
            this.visualizer.history.forEach((freq, i) => {
                const x = i * xStep;
                const normalized = (freq - minFreq) / (maxFreq - minFreq);
                const y = canvas.height - (normalized * canvas.height * 0.8) - canvas.height * 0.1;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
        }
    }
}

// Phase 2.10 P0: 重新初始化合成器引擎 (注入配置 + 乐器预设)
// ⚠️ 注意: continuousSynthEngine 在 continuous-synth.js 中定义为全局变量
// 我们需要在这里重新初始化它以注入配置
if (window.continuousSynthEngine && window.instrumentPresetManager) {
    console.log('[Main] 🔧 重新初始化 ContinuousSynthEngine (注入配置)...');

    // 清理旧引擎
    window.continuousSynthEngine.dispose();

    // 创建新引擎 (注入配置和预设)
    window.continuousSynthEngine = new ContinuousSynthEngine({
        appConfig: configManager.get(),
        instrumentPresets: window.instrumentPresetManager.presets
    });

    console.log('[Main] ✅ ContinuousSynthEngine 已使用集中式配置初始化');
}

// 创建应用实例并初始化
const app = new KazooApp();

// Phase 2.10: 暴露到全局作用域 (便于调试和运行时配置调整)
window.configManager = configManager;
window.app = app;

document.addEventListener('DOMContentLoaded', () => {
    app.initialize();
});

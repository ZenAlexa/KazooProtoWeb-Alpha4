/**
 * 主控制器 - 无校准版本
 * 极简设计：选择乐器 → 开始播放
 *
 * Phase 1: 集成 AudioIO 低延迟音频抽象层
 */
class KazooApp {
    constructor() {
        this.isRunning = false;

        // Phase 1: 音频系统选择
        // Feature Flag: 使用 AudioIO (支持 Worklet) 或 audioInputManager (Legacy)
        this.useAudioIO = true;  // Phase 1: 启用 AudioIO 抽象层
        this.audioIO = null;     // AudioIO 实例

        // Phase 2: 双引擎模式
        this.useContinuousMode = true;  // 默认使用新引擎
        this.currentEngine = null;      // 当前激活的引擎

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

            // 配置 AudioIO
            this.audioIO.configure({
                useWorklet: false,          // Phase 1 默认 false (安全)
                workletBufferSize: 128,     // 低延迟目标
                bufferSize: 2048,           // ScriptProcessor 回退
                workletFallback: true,      // 自动回退
                sampleRate: 44100,
                latencyHint: 'interactive',
                debug: false
            });

            // 注册音高检测回调 (Worklet 模式)
            this.audioIO.onPitchDetected((pitchInfo) => {
                this.onPitchDetected(pitchInfo);
            });

            // 注册音频帧回调 (ScriptProcessor 模式)
            this.audioIO.onFrame((audioBuffer) => {
                this.onAudioProcess(audioBuffer);
            });

            // 错误处理
            this.audioIO.onError((type, error) => {
                console.error('[AudioIO Error]', type, error);
            });
        }

        // 2. 初始化引擎
        await this._initializeEngines(this.audioIO.audioContext || null);

        // 3. 启动音频系统
        const result = await this.audioIO.start();
        console.log('🎵 AudioIO 已启动:', result);

        // 4. 更新性能监控
        const ctx = this.audioIO.audioContext;
        const bufferSize = result.mode === 'worklet' ? 128 : 2048;

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

        // 初始化引擎
        await this._initializeEngines(audioInputManager.audioContext);

        // 启动麦克风
        await audioInputManager.startMicrophone();

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
     */
    async _initializeEngines(audioContext) {
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
        if (audioContext && !pitchDetector.detector) {
            console.log('Initializing pitch detector...');
            pitchDetector.initialize(audioContext.sampleRate);
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
     * 直接使用检测结果,无需再次调用 pitchDetector
     */
    onPitchDetected(pitchInfo) {
        if (!this.isRunning || !this.currentEngine) return;

        // 性能监控开始
        performanceMonitor.startProcessing();

        // 更新显示
        this.ui.currentNote.textContent = `${pitchInfo.note}${pitchInfo.octave}`;
        this.ui.currentFreq.textContent = `${pitchInfo.frequency.toFixed(1)} Hz`;
        this.ui.confidence.textContent = `${Math.round(pitchInfo.confidence * 100)}%`;

        // 驱动当前引擎发声
        this.currentEngine.processPitch(pitchInfo);

        // 可视化
        this.updateVisualizer(pitchInfo);

        // 性能监控结束
        performanceMonitor.endProcessing();

        // 更新性能指标
        performanceMonitor.updateFPS();
        const metrics = performanceMonitor.getMetrics();
        this.ui.latency.textContent = `${metrics.totalLatency}ms`;
    }

    /**
     * 音频处理 - Phase 2: 根据模式使用不同引擎
     */
    onAudioProcess(audioBuffer) {
        if (!this.isRunning || !this.currentEngine) return;

        // 性能监控开始
        performanceMonitor.startProcessing();

        const volume = audioInputManager.getVolume(audioBuffer);
        const pitchInfo = pitchDetector.detect(audioBuffer, volume);

        if (pitchInfo) {
            // 更新显示
            this.ui.currentNote.textContent = `${pitchInfo.note}${pitchInfo.octave}`;
            this.ui.currentFreq.textContent = `${pitchInfo.frequency.toFixed(1)} Hz`;
            this.ui.confidence.textContent = `${Math.round(pitchInfo.confidence * 100)}%`;

            // Phase 2: 驱动当前引擎发声
            this.currentEngine.processPitch(pitchInfo);

            // 可视化
            this.updateVisualizer(pitchInfo);
        }

        // 性能监控结束
        performanceMonitor.endProcessing();

        // 更新性能指标
        performanceMonitor.updateFPS();
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

// 创建应用实例并初始化
const app = new KazooApp();
document.addEventListener('DOMContentLoaded', () => {
    app.initialize();
});

/**
 * 主控制器
 * 整合所有模块，协调系统运行
 */

class KazooProtoApp {
    constructor() {
        this.isInitialized = false;
        this.isRunning = false;

        // UI元素
        this.ui = {
            // 状态
            systemStatus: document.getElementById('systemStatus'),
            latency: document.getElementById('latency'),
            confidence: document.getElementById('confidence'),

            // 音高显示
            pitchCanvas: document.getElementById('pitchCanvas'),
            currentNote: document.getElementById('currentNote'),
            currentFreq: document.getElementById('currentFreq'),

            // 校准
            calibrateBtn: document.getElementById('calibrateBtn'),
            calibrationInstruction: document.getElementById('calibrationInstruction'),
            calibrationProgress: document.getElementById('calibrationProgress'),
            calibrationStep: document.getElementById('calibrationStep'),
            calibrationResult: document.getElementById('calibrationResult'),
            rangeDisplay: document.getElementById('rangeDisplay'),

            // 控制
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),

            // 乐器
            instrumentBtns: document.querySelectorAll('.instrument-btn'),

            // 设置
            sensitivity: document.getElementById('sensitivity'),
            sensitivityValue: document.getElementById('sensitivityValue'),
            smoothing: document.getElementById('smoothing'),
            smoothingValue: document.getElementById('smoothingValue'),
            mixLevel: document.getElementById('mixLevel'),
            mixValue: document.getElementById('mixValue'),
            minConfidence: document.getElementById('minConfidence'),
            minConfidenceValue: document.getElementById('minConfidenceValue'),

            // 性能
            bufferSize: document.getElementById('bufferSize'),
            sampleRate: document.getElementById('sampleRate'),
            totalLatency: document.getElementById('totalLatency'),
            detectionFPS: document.getElementById('detectionFPS')
        };

        // 可视化
        this.visualizer = null;

        // 配置
        this.config = {
            minConfidence: 0.6,
            smoothingSize: 5,
            sensitivity: 0.5
        };
    }

    /**
     * 初始化应用
     */
    async initialize() {
        try {
            console.log('Initializing Kazoo Proto App...');

            // 初始化可视化
            this.initializeVisualizer();

            // 绑定事件
            this.bindEvents();

            // 设置校准回调
            calibrationSystem.onCalibrationUpdate = this.onCalibrationUpdate.bind(this);
            calibrationSystem.onCalibrationComplete = this.onCalibrationComplete.bind(this);

            this.updateStatus('未启动', 'status-idle');
            this.isInitialized = true;

            console.log('App initialized successfully');

        } catch (error) {
            console.error('Initialization failed:', error);
            alert('初始化失败: ' + error.message);
        }
    }

    /**
     * 初始化可视化
     */
    initializeVisualizer() {
        const canvas = this.ui.pitchCanvas;
        this.visualizer = {
            canvas: canvas,
            ctx: canvas.getContext('2d'),
            pitchHistory: [],
            maxHistory: 200
        };

        // 设置canvas实际分辨率
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 校准按钮
        this.ui.calibrateBtn.addEventListener('click', () => this.startCalibration());

        // 开始/停止按钮
        this.ui.startBtn.addEventListener('click', () => this.start());
        this.ui.stopBtn.addEventListener('click', () => this.stop());

        // 乐器选择
        this.ui.instrumentBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const instrument = e.currentTarget.dataset.instrument;
                this.changeInstrument(instrument);
            });
        });

        // 设置滑块
        this.ui.sensitivity.addEventListener('input', (e) => {
            const value = e.target.value;
            this.ui.sensitivityValue.textContent = value + '%';
            this.config.sensitivity = value / 100;
            pitchDetector.setVolumeThreshold(0.01 * (1 - this.config.sensitivity));
        });

        this.ui.smoothing.addEventListener('input', (e) => {
            const value = e.target.value;
            this.ui.smoothingValue.textContent = value + '%';
            this.config.smoothingSize = Math.max(1, Math.floor(value / 10));
            pitchDetector.setSmoothingSize(this.config.smoothingSize);
        });

        this.ui.mixLevel.addEventListener('input', (e) => {
            const value = e.target.value;
            this.ui.mixValue.textContent = value + '% 合成';
        });

        this.ui.minConfidence.addEventListener('input', (e) => {
            const value = e.target.value;
            this.ui.minConfidenceValue.textContent = value + '%';
            this.config.minConfidence = value / 100;
            synthesizerEngine.setConfidenceThreshold(this.config.minConfidence);
        });
    }

    /**
     * 开始校准
     */
    async startCalibration() {
        try {
            // 如果系统未初始化音频，先初始化
            if (!audioInputManager.audioContext) {
                await audioInputManager.initialize();
                await synthesizerEngine.initialize();

                // 初始化音高检测器
                pitchDetector.initialize(audioInputManager.audioContext.sampleRate);

                // 初始化性能监控
                performanceMonitor.initialize(
                    audioInputManager.audioContext,
                    audioInputManager.config.bufferSize
                );
            }

            // 启动麦克风
            if (!audioInputManager.isRunning) {
                await audioInputManager.startMicrophone();
            }

            // 设置音频处理回调为校准模式
            audioInputManager.onAudioProcess = this.onAudioProcessCalibration.bind(this);

            // 开始校准
            calibrationSystem.start();

            this.ui.calibrateBtn.disabled = true;
            this.updateStatus('校准中', 'status-calibrating');

        } catch (error) {
            console.error('Failed to start calibration:', error);
            alert('校准失败: ' + error.message);
        }
    }

    /**
     * 开始运行
     */
    async start() {
        try {
            this.updateStatus('启动中...', 'status-calibrating');

            // 初始化音频系统
            if (!audioInputManager.audioContext) {
                await audioInputManager.initialize();
            }

            // 初始化合成器
            if (!synthesizerEngine.currentSynth) {
                await synthesizerEngine.initialize();
            }

            // 初始化音高检测器
            if (!pitchDetector.detector) {
                pitchDetector.initialize(audioInputManager.audioContext.sampleRate);
            }

            // 初始化性能监控
            performanceMonitor.initialize(
                audioInputManager.audioContext,
                audioInputManager.config.bufferSize
            );

            // 启动麦克风
            await audioInputManager.startMicrophone();

            // 设置音频处理回调
            audioInputManager.onAudioProcess = this.onAudioProcess.bind(this);

            // 启动性能监控
            performanceMonitor.startAutoUpdate(500);
            performanceMonitor.onMetricsUpdate = this.updatePerformanceDisplay.bind(this);

            this.isRunning = true;
            this.updateStatus('运行中', 'status-running');

            // 更新UI
            this.ui.startBtn.classList.add('hidden');
            this.ui.stopBtn.classList.remove('hidden');

            // 更新系统信息
            const contextInfo = audioInputManager.getContextInfo();
            this.ui.bufferSize.textContent = audioInputManager.config.bufferSize + ' samples';
            this.ui.sampleRate.textContent = contextInfo.sampleRate + ' Hz';

            console.log('System started');

        } catch (error) {
            console.error('Failed to start:', error);
            alert('启动失败: ' + error.message);
            this.updateStatus('错误', 'status-idle');
        }
    }

    /**
     * 停止运行
     */
    stop() {
        this.isRunning = false;

        // 停止音频
        audioInputManager.stop();

        // 停止合成器
        synthesizerEngine.stopNote();

        // 停止性能监控
        performanceMonitor.stopAutoUpdate();

        this.updateStatus('已停止', 'status-idle');

        // 更新UI
        this.ui.startBtn.classList.remove('hidden');
        this.ui.stopBtn.classList.add('hidden');

        // 清空显示
        this.ui.currentNote.textContent = '--';
        this.ui.currentFreq.textContent = '(-- Hz)';

        console.log('System stopped');
    }

    /**
     * 音频处理回调（校准模式）
     */
    onAudioProcessCalibration(audioBuffer, currentTime) {
        const volume = audioInputManager.getVolume(audioBuffer);
        const pitchInfo = pitchDetector.detect(audioBuffer, volume);

        if (pitchInfo) {
            calibrationSystem.processPitch(pitchInfo);
        }
    }

    /**
     * 音频处理回调（正常模式）
     */
    onAudioProcess(audioBuffer, currentTime) {
        // 性能监控
        performanceMonitor.startProcessing();

        // 获取音量
        const volume = audioInputManager.getVolume(audioBuffer);

        // 检测音高
        const pitchInfo = pitchDetector.detect(audioBuffer, volume);

        if (pitchInfo) {
            // 更新UI
            this.updatePitchDisplay(pitchInfo);

            // 驱动合成器
            synthesizerEngine.processPitch(pitchInfo);

            // 可视化
            this.updateVisualizer(pitchInfo);
        } else {
            // 没有检测到音高，停止发声
            synthesizerEngine.stopNote();
        }

        // 性能监控
        performanceMonitor.endProcessing();
        performanceMonitor.updateFPS();
    }

    /**
     * 更新音高显示
     */
    updatePitchDisplay(pitchInfo) {
        const { note, octave, frequency, confidence } = pitchInfo;

        this.ui.currentNote.textContent = `${note}${octave}`;
        this.ui.currentFreq.textContent = `(${frequency.toFixed(2)} Hz)`;
        this.ui.confidence.textContent = `${Math.round(confidence * 100)}%`;
    }

    /**
     * 更新可视化
     */
    updateVisualizer(pitchInfo) {
        const { ctx, canvas, pitchHistory, maxHistory } = this.visualizer;
        const { frequency, confidence } = pitchInfo;

        // 添加到历史
        pitchHistory.push({ frequency, confidence });
        if (pitchHistory.length > maxHistory) {
            pitchHistory.shift();
        }

        // 清空画布
        ctx.fillStyle = '#0a0f1e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 绘制网格
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = (canvas.height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // 绘制音高曲线
        if (pitchHistory.length > 1) {
            const xStep = canvas.width / maxHistory;

            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            ctx.beginPath();

            pitchHistory.forEach((point, index) => {
                const x = index * xStep;
                const normalizedFreq = (point.frequency - 100) / 500; // 100-600Hz范围
                const y = canvas.height - (normalizedFreq * canvas.height);

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();

            // 绘制置信度渐变
            ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();

            pitchHistory.forEach((point, index) => {
                const x = index * xStep;
                const y = canvas.height - (point.confidence * canvas.height);

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
        }
    }

    /**
     * 校准更新回调
     */
    onCalibrationUpdate(data) {
        const { step, instruction, progress, currentNote } = data;

        this.ui.calibrationInstruction.textContent = instruction;
        this.ui.calibrationProgress.style.width = progress + '%';
        this.ui.calibrationStep.textContent = `${step}/2`;

        if (currentNote) {
            this.ui.currentNote.textContent = currentNote;
        }
    }

    /**
     * 校准完成回调
     */
    onCalibrationComplete(calibrationData) {
        const { lowestNote, highestNote, range } = calibrationData;

        this.ui.calibrationResult.classList.remove('hidden');
        this.ui.rangeDisplay.textContent =
            `${lowestNote} - ${highestNote} (${range.semitones}半音)`;

        this.ui.calibrateBtn.disabled = false;
        this.ui.calibrateBtn.textContent = '重新校准';

        this.updateStatus('校准完成', 'status-ready');

        // 停止麦克风（校准完成后）
        audioInputManager.stop();

        console.log('Calibration completed:', calibrationData);
    }

    /**
     * 更新性能显示
     */
    updatePerformanceDisplay(metrics) {
        this.ui.latency.textContent = `${metrics.totalLatency} ms`;
        this.ui.totalLatency.textContent = `${metrics.totalLatency} ms`;
        this.ui.detectionFPS.textContent = `${metrics.fps} FPS`;
    }

    /**
     * 切换乐器
     */
    changeInstrument(instrument) {
        // 更新UI
        this.ui.instrumentBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.instrument === instrument) {
                btn.classList.add('active');
            }
        });

        // 切换合成器
        if (synthesizerEngine.currentSynth) {
            synthesizerEngine.changeInstrument(instrument);
        }

        console.log('Instrument changed to:', instrument);
    }

    /**
     * 更新系统状态
     */
    updateStatus(text, className) {
        this.ui.systemStatus.textContent = text;
        this.ui.systemStatus.className = 'value ' + className;
    }
}

// 创建应用实例
const app = new KazooProtoApp();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    app.initialize();
    console.log('Kazoo Proto Web App ready!');
});

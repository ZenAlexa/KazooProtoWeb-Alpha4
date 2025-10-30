/**
 * 主控制器 - 无校准版本
 * 极简设计：选择乐器 → 开始播放
 */
class KazooApp {
    constructor() {
        this.isRunning = false;

        // UI元素
        this.ui = {
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            helpBtn: document.getElementById('helpBtn'),
            helpToggle: document.getElementById('helpToggle'),
            helpContent: document.getElementById('helpContent'),
            warningBox: document.getElementById('warningBox'),
            warningText: document.getElementById('warningText'),

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

        // 乐器选择
        this.ui.instrumentBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.ui.instrumentBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const instrument = e.currentTarget.dataset.instrument;

                // 更新状态徽章
                const instrumentName = e.currentTarget.querySelector('.instrument-name').textContent;
                this.ui.instrumentStatus.textContent = instrumentName;

                // 如果合成器已初始化，切换乐器
                if (synthesizerEngine.currentSynth) {
                    synthesizerEngine.changeInstrument(instrument);
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
     * 开始播放
     */
    async start() {
        try {
            console.log('Starting Kazoo Proto...');

            // 初始化音频系统
            if (!audioInputManager.audioContext) {
                console.log('Initializing audio input...');
                await audioInputManager.initialize();
            }

            // 初始化合成器
            if (!synthesizerEngine.currentSynth) {
                console.log('Initializing synthesizer...');
                await synthesizerEngine.initialize();
            }

            // 初始化音高检测
            if (!pitchDetector.detector) {
                console.log('Initializing pitch detector...');
                pitchDetector.initialize(audioInputManager.audioContext.sampleRate);
            }

            // 启动麦克风
            console.log('Starting microphone...');
            await audioInputManager.startMicrophone();

            // 设置音频处理回调
            audioInputManager.onAudioProcess = this.onAudioProcess.bind(this);

            // 更新UI
            this.isRunning = true;
            this.ui.startBtn.classList.add('hidden');
            this.ui.stopBtn.classList.remove('hidden');
            this.ui.statusBar.classList.remove('hidden');
            this.ui.visualizer.classList.remove('hidden');
            this.ui.systemStatus.textContent = 'Running';
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
     * 停止播放
     */
    stop() {
        this.isRunning = false;

        // 停止音频
        audioInputManager.stop();
        synthesizerEngine.stopNote();

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
     * 音频处理 - 直接处理，无校准
     */
    onAudioProcess(audioBuffer) {
        const volume = audioInputManager.getVolume(audioBuffer);
        const pitchInfo = pitchDetector.detect(audioBuffer, volume);

        if (pitchInfo) {
            // 更新显示
            this.ui.currentNote.textContent = `${pitchInfo.note}${pitchInfo.octave}`;
            this.ui.currentFreq.textContent = `${pitchInfo.frequency.toFixed(1)} Hz`;
            this.ui.confidence.textContent = `${Math.round(pitchInfo.confidence * 100)}%`;

            // 驱动合成器发声
            synthesizerEngine.processPitch(pitchInfo);

            // 可视化
            this.updateVisualizer(pitchInfo);

            // 更新性能监控
            performanceMonitor.updateFPS();
            const metrics = performanceMonitor.getMetrics();
            this.ui.latency.textContent = `${metrics.totalLatency}ms`;
        } else {
            // 没有音高，停止发声
            synthesizerEngine.stopNote();
        }
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
     * 更新可视化 - 增强版本，带音符标签和网格线
     */
    updateVisualizer(pitchInfo) {
        const { ctx, minFreq, maxFreq, referenceNotes } = this.visualizer;
        const canvas = this.ui.pitchCanvas;

        // 存储历史数据
        this.visualizer.history.push(pitchInfo.frequency);
        this.visualizer.noteHistory.push(`${pitchInfo.note}${pitchInfo.octave}`);

        if (this.visualizer.history.length > this.visualizer.maxHistory) {
            this.visualizer.history.shift();
            this.visualizer.noteHistory.shift();
        }

        // 清空画布
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 绘制参考音符网格线
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
        ctx.fillStyle = '#9ca3af';

        referenceNotes.forEach(ref => {
            const normalized = (ref.freq - minFreq) / (maxFreq - minFreq);
            const y = canvas.height - (normalized * canvas.height);

            // 绘制水平参考线
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();

            // 绘制音符标签
            ctx.fillText(ref.note, 5, y - 5);
        });

        // 绘制音高曲线
        if (this.visualizer.history.length > 1) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();

            const xStep = canvas.width / this.visualizer.maxHistory;
            this.visualizer.history.forEach((freq, i) => {
                const x = i * xStep;
                const normalized = (freq - minFreq) / (maxFreq - minFreq);
                const y = canvas.height - (normalized * canvas.height);

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();

            // 绘制当前音符标签（在曲线末端）
            if (this.visualizer.noteHistory.length > 0) {
                const lastFreq = this.visualizer.history[this.visualizer.history.length - 1];
                const lastNote = this.visualizer.noteHistory[this.visualizer.noteHistory.length - 1];
                const lastX = (this.visualizer.history.length - 1) * xStep;
                const lastNormalized = (lastFreq - minFreq) / (maxFreq - minFreq);
                const lastY = canvas.height - (lastNormalized * canvas.height);

                // 绘制当前音符的圆点
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath();
                ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
                ctx.fill();

                // 绘制音符标签背景
                ctx.fillStyle = '#1e3a8a';
                ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
                const textMetrics = ctx.measureText(lastNote);
                const padding = 6;
                const labelX = Math.min(lastX + 10, canvas.width - textMetrics.width - padding * 2);
                const labelY = Math.max(lastY - 10, 20);

                ctx.fillRect(labelX - padding, labelY - 16, textMetrics.width + padding * 2, 22);

                // 绘制音符文本
                ctx.fillStyle = '#ffffff';
                ctx.fillText(lastNote, labelX, labelY);
            }
        }

        // 绘制频率范围标签
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
        ctx.fillText(`${maxFreq.toFixed(0)}Hz`, canvas.width - 60, 15);
        ctx.fillText(`${minFreq.toFixed(0)}Hz`, canvas.width - 60, canvas.height - 5);
    }
}

// 创建应用实例并初始化
const app = new KazooApp();
document.addEventListener('DOMContentLoaded', () => {
    app.initialize();
});

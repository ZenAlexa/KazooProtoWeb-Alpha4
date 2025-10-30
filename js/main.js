/**
 * 主控制器 - Apple风格重构版
 */
class KazooApp {
    constructor() {
        this.isCalibrated = false;
        this.isRunning = false;

        // UI元素
        this.ui = {
            calibrateBtn: document.getElementById('calibrateBtn'),
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            helpBtn: document.getElementById('helpBtn'),
            helpToggle: document.getElementById('helpToggle'),
            helpContent: document.getElementById('helpContent'),
            warningBox: document.getElementById('warningBox'),
            warningText: document.getElementById('warningText'),

            // 状态徽章
            calibrationStatus: document.getElementById('calibrationStatus'),
            instrumentStatus: document.getElementById('instrumentStatus'),
            recordingStatus: document.getElementById('recordingStatus'),
            recordingHelper: document.getElementById('recordingHelper'),

            // 模态弹窗
            calibrationModal: document.getElementById('calibrationModal'),
            modalStepIcon: document.getElementById('modalStepIcon'),
            modalTitle: document.getElementById('modalTitle'),
            modalDescription: document.getElementById('modalDescription'),
            modalTip: document.getElementById('modalTip'),
            stepDot1: document.getElementById('stepDot1'),
            stepDot2: document.getElementById('stepDot2'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            modalCurrentNote: document.getElementById('modalCurrentNote'),
            modalCurrentFreq: document.getElementById('modalCurrentFreq'),
            cancelCalibrationBtn: document.getElementById('cancelCalibrationBtn'),

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
        console.log('Initializing Kazoo App...');

        // 检查兼容性
        this.checkCompatibility();

        // 绑定事件
        this.bindEvents();

        // 设置校准回调
        calibrationSystem.onCalibrationUpdate = this.onCalibrationUpdate.bind(this);
        calibrationSystem.onCalibrationComplete = this.onCalibrationComplete.bind(this);

        // 初始化可视化
        this.initVisualizer();

        console.log('App initialized');
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
        // 校准按钮
        this.ui.calibrateBtn.addEventListener('click', () => this.startCalibration());
        this.ui.cancelCalibrationBtn.addEventListener('click', () => this.cancelCalibration());

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
     * 开始校准
     */
    async startCalibration() {
        try {
            // 初始化音频系统
            if (!audioInputManager.audioContext) {
                await audioInputManager.initialize();
            }

            // 初始化合成器（用于稍后播放）
            if (!synthesizerEngine.currentSynth) {
                await synthesizerEngine.initialize();
            }

            // 初始化音高检测
            if (!pitchDetector.detector) {
                pitchDetector.initialize(audioInputManager.audioContext.sampleRate);
            }

            // 启动麦克风
            await audioInputManager.startMicrophone();

            // 设置音频处理为校准模式
            audioInputManager.onAudioProcess = this.onCalibrationAudioProcess.bind(this);

            // 显示模态弹窗
            this.ui.calibrationModal.classList.add('show');

            // 开始校准
            calibrationSystem.start();

        } catch (error) {
            console.error('Failed to start calibration:', error);
            alert('Calibration failed: ' + error.message);
        }
    }

    /**
     * 取消校准
     */
    cancelCalibration() {
        calibrationSystem.cancel();
        audioInputManager.stop();
        this.ui.calibrationModal.classList.remove('show');
    }

    /**
     * 校准音频处理
     */
    onCalibrationAudioProcess(audioBuffer) {
        const volume = audioInputManager.getVolume(audioBuffer);
        const pitchInfo = pitchDetector.detect(audioBuffer, volume);

        if (pitchInfo) {
            calibrationSystem.processPitch(pitchInfo);

            // 更新模态弹窗中的音符显示
            this.ui.modalCurrentNote.textContent = `${pitchInfo.note}${pitchInfo.octave}`;
            this.ui.modalCurrentFreq.textContent = `${pitchInfo.frequency.toFixed(1)} Hz`;
        }
    }

    /**
     * 校准更新回调
     */
    onCalibrationUpdate(data) {
        const { step, instruction, progress, elapsed } = data;

        if (instruction) {
            this.ui.modalDescription.textContent = instruction;
        }

        this.ui.progressFill.style.width = progress + '%';

        if (elapsed !== undefined) {
            const elapsedSec = (elapsed / 1000).toFixed(1);
            this.ui.progressText.textContent = `${elapsedSec} / 5.0 seconds`;
        }

        // 更新步骤指示器和图标
        if (step === 1) {
            this.ui.modalTitle.textContent = 'Calibration - Step 1 of 2';
            this.ui.modalStepIcon.textContent = '🎤';
            this.ui.modalTip.textContent = '💡 Tip: Use a steady, comfortable volume. Don\'t strain!';
            this.ui.stepDot1.classList.add('active');
            this.ui.stepDot2.classList.remove('active');
        } else if (step === 2) {
            this.ui.modalTitle.textContent = 'Calibration - Step 2 of 2';
            this.ui.modalStepIcon.textContent = '🎵';
            this.ui.modalTip.textContent = '💡 Tip: Go as high as comfortable. This defines your upper range!';
            this.ui.stepDot1.classList.remove('active');
            this.ui.stepDot2.classList.add('active');
        }
    }

    /**
     * 校准完成回调
     */
    onCalibrationComplete(data) {
        const { lowestNote, highestNote, range } = data;

        // 关闭模态弹窗
        this.ui.calibrationModal.classList.remove('show');

        // 停止麦克风
        audioInputManager.stop();

        // 更新UI状态
        this.isCalibrated = true;
        this.ui.calibrateBtn.textContent = '✓ Recalibrate';
        this.ui.calibrateBtn.classList.remove('pulse');
        this.ui.calibrationStatus.textContent = `${lowestNote} - ${highestNote}`;
        this.ui.calibrationStatus.classList.add('status-ready');
        this.ui.startBtn.classList.remove('hidden');
        this.ui.recordingHelper.textContent = 'Ready to record!';

        console.log('Calibration complete:', data);

        // 显示完成信息和下一步指引
        alert(`✓ Calibration Complete!

Your vocal range: ${lowestNote} - ${highestNote}
Range: ${range.semitones} semitones (${range.octaves.toFixed(1)} octaves)

The system now knows your voice range and will accurately convert your humming to instrument notes within this range.

Next steps:
1. Choose an instrument below (Saxophone is selected by default)
2. Click "Start Recording"
3. Hum or sing - you'll hear it as the chosen instrument in real-time!`);
    }

    /**
     * 开始录音
     */
    async start() {
        try {
            // 确保音频系统已初始化
            if (!audioInputManager.audioContext) {
                await audioInputManager.initialize();
            }

            if (!synthesizerEngine.currentSynth) {
                await synthesizerEngine.initialize();
            }

            if (!pitchDetector.detector) {
                pitchDetector.initialize(audioInputManager.audioContext.sampleRate);
            }

            // 启动麦克风
            await audioInputManager.startMicrophone();

            // 设置音频处理为播放模式
            audioInputManager.onAudioProcess = this.onPlaybackAudioProcess.bind(this);

            // 更新UI
            this.isRunning = true;
            this.ui.startBtn.classList.add('hidden');
            this.ui.stopBtn.classList.remove('hidden');
            this.ui.statusBar.classList.remove('hidden');
            this.ui.visualizer.classList.remove('hidden');
            this.ui.systemStatus.textContent = 'Running';
            this.ui.systemStatus.classList.add('active');

            console.log('Recording started');

        } catch (error) {
            console.error('Failed to start:', error);
            alert('Failed to start: ' + error.message);
        }
    }

    /**
     * 停止录音
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

        console.log('Recording stopped');
    }

    /**
     * 播放模式音频处理 - 关键修复：输出音频
     */
    onPlaybackAudioProcess(audioBuffer) {
        const volume = audioInputManager.getVolume(audioBuffer);
        const pitchInfo = pitchDetector.detect(audioBuffer, volume);

        if (pitchInfo) {
            // 更新显示
            this.ui.currentNote.textContent = `${pitchInfo.note}${pitchInfo.octave}`;
            this.ui.currentFreq.textContent = `${pitchInfo.frequency.toFixed(1)} Hz`;
            this.ui.confidence.textContent = `${Math.round(pitchInfo.confidence * 100)}%`;

            // 驱动合成器发声 - 这是关键！
            synthesizerEngine.processPitch(pitchInfo);

            // 可视化
            this.updateVisualizer(pitchInfo);
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
            maxHistory: 200
        };
    }

    /**
     * 更新可视化
     */
    updateVisualizer(pitchInfo) {
        const { ctx } = this.visualizer;
        const canvas = this.ui.pitchCanvas;

        this.visualizer.history.push(pitchInfo.frequency);
        if (this.visualizer.history.length > this.visualizer.maxHistory) {
            this.visualizer.history.shift();
        }

        // 清空画布
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 绘制音高曲线
        if (this.visualizer.history.length > 1) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath();

            const xStep = canvas.width / this.visualizer.maxHistory;
            this.visualizer.history.forEach((freq, i) => {
                const x = i * xStep;
                const normalized = (freq - 100) / 500; // 100-600Hz
                const y = canvas.height - (normalized * canvas.height);

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

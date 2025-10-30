/**
 * 校准模块
 * 检测用户音域范围并建立基准映射
 */

class CalibrationSystem {
    constructor() {
        this.isCalibrating = false;
        this.calibrationStep = 0; // 0: 未开始, 1: 检测低音, 2: 检测高音, 3: 完成

        // 校准数据
        this.calibrationData = {
            lowestFreq: null,
            highestFreq: null,
            lowestNote: null,
            highestNote: null,
            centerFreq: null,
            range: null
        };

        // 采样数据
        this.samples = [];
        this.sampleDuration = 5000; // 每步采样5秒
        this.sampleStartTime = 0;

        // 计时器
        this.timerInterval = null;

        // 是否被取消
        this.cancelled = false;

        // 回调函数
        this.onCalibrationUpdate = null;
        this.onCalibrationComplete = null;
    }

    /**
     * 开始校准流程
     */
    start() {
        this.isCalibrating = true;
        this.calibrationStep = 1;
        this.samples = [];
        this.cancelled = false;
        this.sampleStartTime = Date.now();

        console.log('Calibration started: Step 1 - Detecting lowest pitch');

        // 启动计时器
        this.startTimer();

        if (this.onCalibrationUpdate) {
            this.onCalibrationUpdate({
                step: 1,
                instruction: 'Sing your lowest comfortable note and hold for 5 seconds.',
                progress: 0,
                elapsed: 0
            });
        }
    }

    /**
     * 取消校准
     */
    cancel() {
        this.cancelled = true;
        this.isCalibrating = false;
        this.stopTimer();
        this.reset();
        console.log('Calibration cancelled');
    }

    /**
     * 启动计时器
     */
    startTimer() {
        this.stopTimer(); // 先停止之前的计时器

        this.timerInterval = setInterval(() => {
            if (!this.isCalibrating) {
                this.stopTimer();
                return;
            }

            const elapsed = Date.now() - this.sampleStartTime;
            const progress = Math.min((elapsed / this.sampleDuration) * 100, 100);

            if (this.onCalibrationUpdate) {
                this.onCalibrationUpdate({
                    step: this.calibrationStep,
                    progress: progress,
                    elapsed: elapsed,
                    remaining: Math.max(0, this.sampleDuration - elapsed)
                });
            }
        }, 50); // 每50ms更新一次
    }

    /**
     * 停止计时器
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * 处理音高数据（在校准过程中调用）
     */
    processPitch(pitchInfo) {
        if (!this.isCalibrating || !pitchInfo) return;

        const { frequency, note, octave, confidence } = pitchInfo;

        // 只记录高置信度的样本
        if (confidence > 0.7) {
            this.samples.push({
                frequency: frequency,
                note: `${note}${octave}`,
                timestamp: Date.now()
            });
        }

        // 计算进度
        const elapsed = Date.now() - this.sampleStartTime;
        const progress = Math.min((elapsed / this.sampleDuration) * 100, 100);

        // 更新UI
        if (this.onCalibrationUpdate) {
            const instruction = this.calibrationStep === 1 ?
                '请唱出你能唱的最低音，并保持...' :
                '请唱出你能唱的最高音，并保持...';

            this.onCalibrationUpdate({
                step: this.calibrationStep,
                instruction: instruction,
                progress: progress,
                currentFreq: frequency,
                currentNote: `${note}${octave}`
            });
        }

        // 检查是否完成当前步骤
        if (elapsed >= this.sampleDuration) {
            this.completeCurrentStep();
        }
    }

    /**
     * 完成当前步骤
     */
    completeCurrentStep() {
        // 停止计时器，避免重复触发
        this.stopTimer();

        if (this.samples.length === 0) {
            console.warn('No valid samples collected, retrying...');
            this.sampleStartTime = Date.now();
            this.startTimer();
            return;
        }

        if (this.calibrationStep === 1) {
            // 完成低音检测
            this.calibrationData.lowestFreq = this.getMedianFrequency(this.samples);
            this.calibrationData.lowestNote = pitchDetector.frequencyToNote(
                this.calibrationData.lowestFreq
            ).fullNote;

            console.log('Step 1 complete - Lowest pitch:', this.calibrationData.lowestNote,
                '(', this.calibrationData.lowestFreq.toFixed(2), 'Hz)');

            // 进入下一步
            this.calibrationStep = 2;
            this.samples = [];
            this.sampleStartTime = Date.now();

            // 重启计时器
            this.startTimer();

            if (this.onCalibrationUpdate) {
                this.onCalibrationUpdate({
                    step: 2,
                    instruction: 'Great! Now sing your highest comfortable note and hold for 5 seconds.',
                    progress: 0,
                    elapsed: 0
                });
            }

        } else if (this.calibrationStep === 2) {
            // 完成高音检测
            this.calibrationData.highestFreq = this.getMedianFrequency(this.samples);
            this.calibrationData.highestNote = pitchDetector.frequencyToNote(
                this.calibrationData.highestFreq
            ).fullNote;

            console.log('Step 2 complete - Highest pitch:', this.calibrationData.highestNote,
                '(', this.calibrationData.highestFreq.toFixed(2), 'Hz)');

            // 完成校准
            this.finishCalibration();
        }
    }

    /**
     * 完成校准流程
     */
    finishCalibration() {
        // 计算音域信息
        this.calibrationData.centerFreq =
            (this.calibrationData.lowestFreq + this.calibrationData.highestFreq) / 2;

        this.calibrationData.range = {
            semitones: this.calculateSemitones(
                this.calibrationData.lowestFreq,
                this.calibrationData.highestFreq
            ),
            octaves: this.calculateOctaves(
                this.calibrationData.lowestFreq,
                this.calibrationData.highestFreq
            )
        };

        this.isCalibrating = false;
        this.calibrationStep = 3;

        // 停止计时器
        this.stopTimer();

        console.log('Calibration completed:', this.calibrationData);

        // 触发完成回调
        if (this.onCalibrationComplete) {
            this.onCalibrationComplete(this.calibrationData);
        }
    }

    /**
     * 从样本中获取中值频率（去除异常值）
     */
    getMedianFrequency(samples) {
        if (samples.length === 0) return 0;

        const frequencies = samples.map(s => s.frequency).sort((a, b) => a - b);

        // 去除最高和最低的10%
        const trimCount = Math.floor(frequencies.length * 0.1);
        const trimmed = frequencies.slice(trimCount, frequencies.length - trimCount);

        // 返回中值
        const mid = Math.floor(trimmed.length / 2);
        return trimmed.length % 2 === 0 ?
            (trimmed[mid - 1] + trimmed[mid]) / 2 :
            trimmed[mid];
    }

    /**
     * 计算两个频率之间的半音数
     */
    calculateSemitones(freq1, freq2) {
        return Math.round(12 * Math.log2(freq2 / freq1));
    }

    /**
     * 计算两个频率之间的八度数
     */
    calculateOctaves(freq1, freq2) {
        return Math.log2(freq2 / freq1);
    }

    /**
     * 获取校准数据
     */
    getCalibrationData() {
        return this.calibrationData;
    }

    /**
     * 检查是否已校准
     */
    isCalibrated() {
        return this.calibrationData.lowestFreq !== null &&
               this.calibrationData.highestFreq !== null;
    }

    /**
     * 重置校准
     */
    reset() {
        this.isCalibrating = false;
        this.calibrationStep = 0;
        this.samples = [];
        this.calibrationData = {
            lowestFreq: null,
            highestFreq: null,
            lowestNote: null,
            highestNote: null,
            centerFreq: null,
            range: null
        };
    }

    /**
     * 跳过校准（使用默认值）
     */
    skipCalibration() {
        // 使用典型人声音域（E2-E5）
        this.calibrationData = {
            lowestFreq: 82.41,  // E2
            highestFreq: 659.25, // E5
            lowestNote: 'E2',
            highestNote: 'E5',
            centerFreq: 261.63,  // C4
            range: {
                semitones: 36,
                octaves: 3
            }
        };

        this.calibrationStep = 3;
        console.log('Calibration skipped, using default range');

        if (this.onCalibrationComplete) {
            this.onCalibrationComplete(this.calibrationData);
        }
    }

    /**
     * 手动设置校准数据
     */
    setCalibrationData(lowestNote, highestNote) {
        const lowestFreq = pitchDetector.noteToFrequency(lowestNote);
        const highestFreq = pitchDetector.noteToFrequency(highestNote);

        this.calibrationData = {
            lowestFreq: lowestFreq,
            highestFreq: highestFreq,
            lowestNote: lowestNote,
            highestNote: highestNote,
            centerFreq: (lowestFreq + highestFreq) / 2,
            range: {
                semitones: this.calculateSemitones(lowestFreq, highestFreq),
                octaves: this.calculateOctaves(lowestFreq, highestFreq)
            }
        };

        this.calibrationStep = 3;
        console.log('Calibration data set manually:', this.calibrationData);
    }

    /**
     * 获取校准状态描述
     */
    getStatusText() {
        switch (this.calibrationStep) {
            case 0: return '未校准';
            case 1: return '检测最低音中...';
            case 2: return '检测最高音中...';
            case 3: return '已校准';
            default: return '未知状态';
        }
    }
}

// 导出单例实例
const calibrationSystem = new CalibrationSystem();

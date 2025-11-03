/**
 * Clock Synchronization Utility
 *
 * 解决AudioContext.currentTime(音频时钟)与performance.now()(主线程时钟)的对齐问题
 *
 * 问题:
 * - AudioContext.currentTime: 秒为单位，从AudioContext创建时开始计时
 * - performance.now(): 毫秒为单位，从页面加载开始计时
 * - 两者没有共同零点，无法直接相减计算延迟
 *
 * 解决方案:
 * - Chrome/Edge: 使用AudioContext.getOutputTimestamp()获取精确对应关系
 * - Firefox/Safari: 在多个时刻采样两种时钟，计算偏移量并平滑
 */

class ClockSync {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.offset = null;  // performance.now() - (audioContext.currentTime * 1000)
        this.samples = [];    // 采样历史记录
        this.maxSamples = 10;

        this.supportsGetOutputTimestamp = typeof audioContext.getOutputTimestamp === 'function';

        this.initialize();
    }

    /**
     * 初始化时钟同步
     */
    initialize() {
        if (this.supportsGetOutputTimestamp) {
            console.log('[ClockSync] Using AudioContext.getOutputTimestamp() (precise)');
            this._syncWithTimestamp();
        } else {
            console.warn('[ClockSync] getOutputTimestamp() not available, using approximation');
            this._syncWithApproximation();
        }
    }

    /**
     * 方法1: 使用getOutputTimestamp()精确同步 (Chrome/Edge)
     */
    _syncWithTimestamp() {
        const timestamp = this.audioContext.getOutputTimestamp();
        // timestamp = { contextTime: audioContext时间(秒), performanceTime: performance.now()时间(毫秒) }

        if (timestamp && timestamp.contextTime !== undefined && timestamp.performanceTime !== undefined) {
            this.offset = timestamp.performanceTime - (timestamp.contextTime * 1000);

            console.log('[ClockSync] Synchronized:', {
                audioTime: timestamp.contextTime.toFixed(6) + 's',
                perfTime: timestamp.performanceTime.toFixed(2) + 'ms',
                offset: this.offset.toFixed(2) + 'ms'
            });
        } else {
            console.error('[ClockSync] getOutputTimestamp() returned invalid data, fallback to approximation');
            this._syncWithApproximation();
        }
    }

    /**
     * 方法2: 近似同步 (Firefox/Safari)
     * 在同一时刻采样两种时钟，计算偏移量
     */
    _syncWithApproximation() {
        const perfNow = performance.now();
        const audioNow = this.audioContext.currentTime * 1000;
        const sampleOffset = perfNow - audioNow;

        this.samples.push(sampleOffset);
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }

        // 使用中位数减少异常值影响
        const sorted = [...this.samples].sort((a, b) => a - b);
        this.offset = sorted[Math.floor(sorted.length / 2)];

        console.log('[ClockSync] Approximated offset:', {
            samples: this.samples.length,
            offset: this.offset.toFixed(2) + 'ms',
            jitter: (Math.max(...this.samples) - Math.min(...this.samples)).toFixed(2) + 'ms'
        });
    }

    /**
     * 定期更新同步 (建议每5秒调用一次)
     */
    refresh() {
        if (this.supportsGetOutputTimestamp) {
            this._syncWithTimestamp();
        } else {
            this._syncWithApproximation();
        }
    }

    /**
     * 将AudioContext时间(秒)转换为performance.now()时间(毫秒)
     * @param {number} audioTime - AudioContext.currentTime (秒)
     * @returns {number} 对应的performance.now()时间 (毫秒)
     */
    audioTimeToPerformanceTime(audioTime) {
        if (this.offset === null) {
            console.warn('[ClockSync] Not synchronized yet, returning approximation');
            return audioTime * 1000 + performance.now();
        }
        return (audioTime * 1000) + this.offset;
    }

    /**
     * 将performance.now()时间(毫秒)转换为AudioContext时间(秒)
     * @param {number} perfTime - performance.now() (毫秒)
     * @returns {number} 对应的AudioContext.currentTime (秒)
     */
    performanceTimeToAudioTime(perfTime) {
        if (this.offset === null) {
            console.warn('[ClockSync] Not synchronized yet, returning approximation');
            return (perfTime - performance.now()) / 1000;
        }
        return (perfTime - this.offset) / 1000;
    }

    /**
     * 计算两个时间戳之间的延迟 (自动处理单位转换)
     * @param {number} endTime - 结束时间 (可以是秒或毫秒)
     * @param {number} startTime - 开始时间 (可以是秒或毫秒)
     * @param {string} endUnit - 'audio' | 'performance'
     * @param {string} startUnit - 'audio' | 'performance'
     * @returns {number} 延迟时间 (毫秒)
     */
    calculateLatency(endTime, startTime, endUnit = 'performance', startUnit = 'audio') {
        let endMs, startMs;

        if (endUnit === 'audio') {
            endMs = this.audioTimeToPerformanceTime(endTime);
        } else {
            endMs = endTime;
        }

        if (startUnit === 'audio') {
            startMs = this.audioTimeToPerformanceTime(startTime);
        } else {
            startMs = startTime;
        }

        return endMs - startMs;
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClockSync;
}

// 浏览器环境下暴露到全局 (确保 ES Module 可以通过 window 访问)
if (typeof window !== 'undefined') {
    window.ClockSync = ClockSync;
}

/**
 * 音频输入模块
 * 负责管理麦克风输入、AudioContext创建和音频流处理
 */

class AudioInputManager {
    constructor() {
        this.audioContext = null;
        this.microphone = null;
        this.analyser = null;
        this.scriptProcessor = null;
        this.stream = null;
        this.isRunning = false;

        // 音频处理回调
        this.onAudioProcess = null;

        // 配置参数
        this.config = {
            bufferSize: 2048,  // 使用2048以兼容更多浏览器
            sampleRate: 44100,
            fftSize: 2048,
            smoothingTimeConstant: 0
        };
    }

    /**
     * 检查浏览器兼容性
     */
    checkBrowserSupport() {
        const issues = [];

        // 检查AudioContext
        if (!window.AudioContext && !window.webkitAudioContext) {
            issues.push('你的浏览器不支持Web Audio API');
        }

        // 检查getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            issues.push('你的浏览器不支持麦克风访问');
        }

        // 检查是否在HTTPS或localhost
        const isSecureContext = window.isSecureContext ||
                               location.protocol === 'https:' ||
                               location.hostname === 'localhost' ||
                               location.hostname === '127.0.0.1';

        if (!isSecureContext) {
            issues.push('麦克风需要HTTPS连接或localhost环境');
        }

        return {
            isSupported: issues.length === 0,
            issues: issues
        };
    }

    /**
     * 初始化音频上下文
     */
    async initialize() {
        try {
            // 检查浏览器支持
            const support = this.checkBrowserSupport();
            if (!support.isSupported) {
                throw new Error('浏览器不支持:\n' + support.issues.join('\n'));
            }

            // 创建AudioContext，优化低延迟
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass({
                latencyHint: 'interactive',
                sampleRate: this.config.sampleRate
            });

            console.log('AudioContext initialized:', {
                sampleRate: this.audioContext.sampleRate,
                baseLatency: this.audioContext.baseLatency,
                outputLatency: this.audioContext.outputLatency
            });

            return true;
        } catch (error) {
            console.error('Failed to initialize AudioContext:', error);
            throw error;
        }
    }

    /**
     * 请求麦克风权限并开始音频流
     */
    async startMicrophone() {
        try {
            // 检查浏览器支持
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('你的浏览器不支持麦克风访问。请使用Chrome、Firefox或Edge浏览器。');
            }

            // 请求麦克风访问
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    // 请求低延迟
                    latency: 0
                },
                video: false
            });

            // 创建音频源
            this.microphone = this.audioContext.createMediaStreamSource(this.stream);

            // 创建分析器节点
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.config.fftSize;
            this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;

            // 创建脚本处理器（实时音频处理）
            this.scriptProcessor = this.audioContext.createScriptProcessor(
                this.config.bufferSize,
                1, // 单声道输入
                1  // 单声道输出
            );

            // 连接音频节点链
            this.microphone.connect(this.analyser);
            this.analyser.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);

            // 设置音频处理回调
            this.scriptProcessor.onaudioprocess = (event) => {
                if (this.onAudioProcess && this.isRunning) {
                    const inputData = event.inputBuffer.getChannelData(0);
                    const audioBuffer = new Float32Array(inputData);
                    this.onAudioProcess(audioBuffer, this.audioContext.currentTime);
                }
            };

            this.isRunning = true;
            console.log('Microphone started successfully');
            return true;

        } catch (error) {
            console.error('Failed to start microphone:', error);
            if (error.name === 'NotAllowedError') {
                throw new Error('请允许访问麦克风权限');
            } else if (error.name === 'NotFoundError') {
                throw new Error('未找到麦克风设备');
            } else {
                throw new Error('无法启动麦克风: ' + error.message);
            }
        }
    }

    /**
     * 停止麦克风和音频处理
     */
    stop() {
        this.isRunning = false;

        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor.onaudioprocess = null;
        }

        if (this.analyser) {
            this.analyser.disconnect();
        }

        if (this.microphone) {
            this.microphone.disconnect();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        console.log('Microphone stopped');
    }

    /**
     * 获取当前音量 (RMS)
     */
    getVolume(audioBuffer) {
        let sum = 0;
        for (let i = 0; i < audioBuffer.length; i++) {
            sum += audioBuffer[i] * audioBuffer[i];
        }
        const rms = Math.sqrt(sum / audioBuffer.length);
        return rms;
    }

    /**
     * 获取频域数据（用于可视化）
     */
    getFrequencyData() {
        if (!this.analyser) return null;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }

    /**
     * 获取时域数据（用于可视化）
     */
    getTimeDomainData() {
        if (!this.analyser) return null;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(dataArray);
        return dataArray;
    }

    /**
     * 获取音频上下文信息
     */
    getContextInfo() {
        if (!this.audioContext) return null;

        return {
            sampleRate: this.audioContext.sampleRate,
            baseLatency: (this.audioContext.baseLatency * 1000).toFixed(2),
            outputLatency: this.audioContext.outputLatency ?
                (this.audioContext.outputLatency * 1000).toFixed(2) : 'N/A',
            state: this.audioContext.state
        };
    }

    /**
     * 恢复音频上下文（某些浏览器需要用户交互）
     */
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
            console.log('AudioContext resumed');
        }
    }

    /**
     * 销毁音频上下文
     */
    async destroy() {
        this.stop();

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
    }
}

// 导出单例实例
const audioInputManager = new AudioInputManager();

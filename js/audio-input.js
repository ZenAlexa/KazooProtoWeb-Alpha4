/**
 * 音频输入模块
 * 负责管理麦克风输入、AudioContext创建和音频流处理
 *
 * Phase 1 改进:
 * - 使用集中配置 (audio-config.js)
 * - 增强启动日志与错误提示
 * - 为 AudioWorklet 迁移做准备
 */

// 导入配置 (通过 type="module" 或构建工具)
// 临时方案: 通过全局变量访问 (待模块化)

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

        // 配置参数 (Phase 1: 从 audio-config.js 读取)
        // 当前保持兼容，使用内联配置
        this.config = {
            bufferSize: 2048,  // Phase 1 后期将降至 128-256
            sampleRate: 44100, // 与 Dubler 2 一致
            fftSize: 2048,
            smoothingTimeConstant: 0,
            useWorklet: false  // Phase 1 Feature Flag (暂时禁用)
        };

        // 性能追踪
        this.startTime = 0;
        this.initTime = 0;
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
        this.startTime = performance.now();

        try {
            console.group('🎵 [AudioInput] 初始化音频系统');

            // 检查浏览器支持
            const support = this.checkBrowserSupport();
            if (!support.isSupported) {
                console.error('❌ 浏览器兼容性检查失败:', support.issues);
                throw new Error('浏览器不支持:\n' + support.issues.join('\n'));
            }
            console.log('✅ 浏览器兼容性: 通过');

            // 创建AudioContext，优化低延迟
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass({
                latencyHint: 'interactive',
                sampleRate: this.config.sampleRate
            });

            // 详细的延迟信息
            const baseLatency = this.audioContext.baseLatency ?
                (this.audioContext.baseLatency * 1000).toFixed(2) : 'N/A';
            const outputLatency = this.audioContext.outputLatency ?
                (this.audioContext.outputLatency * 1000).toFixed(2) : 'N/A';
            const bufferLatency = ((this.config.bufferSize / this.audioContext.sampleRate) * 1000).toFixed(2);

            console.log('📊 AudioContext 配置:');
            console.log('  • 采样率:', this.audioContext.sampleRate, 'Hz');
            console.log('  • 缓冲大小:', this.config.bufferSize, 'samples');
            console.log('  • 缓冲延迟:', bufferLatency, 'ms');
            console.log('  • 基础延迟:', baseLatency, 'ms');
            console.log('  • 输出延迟:', outputLatency, 'ms');
            console.log('  • 延迟模式:', 'interactive');
            console.log('  • AudioWorklet:', this.config.useWorklet ? '启用' : '禁用 (使用 ScriptProcessor)');

            // 检查 AudioWorklet 支持 (Phase 1 准备)
            const hasWorklet = 'audioWorklet' in this.audioContext;
            if (hasWorklet) {
                console.log('✅ AudioWorklet: 浏览器支持 (Phase 1 将启用)');
            } else {
                console.warn('⚠️  AudioWorklet: 浏览器不支持 (将回退到 ScriptProcessor)');
            }

            this.initTime = performance.now() - this.startTime;
            console.log(`⏱️  初始化耗时: ${this.initTime.toFixed(2)} ms`);
            console.groupEnd();

            return true;
        } catch (error) {
            console.error('❌ [AudioInput] 初始化失败:', error);
            console.groupEnd();
            throw error;
        }
    }

    /**
     * 请求麦克风权限并开始音频流
     */
    async startMicrophone() {
        const micStartTime = performance.now();

        try {
            console.group('🎤 [AudioInput] 启动麦克风');

            // 检查浏览器支持
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('你的浏览器不支持麦克风访问。请使用Chrome、Firefox或Edge浏览器。');
            }

            // 请求麦克风访问
            console.log('📡 请求麦克风权限...');
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
            console.log('✅ 麦克风权限已授予');

            // 获取音频轨道信息
            const audioTrack = this.stream.getAudioTracks()[0];
            const settings = audioTrack.getSettings();
            console.log('🔊 音频轨道信息:');
            console.log('  • 设备:', audioTrack.label || '默认麦克风');
            console.log('  • 采样率:', settings.sampleRate || 'N/A', 'Hz');
            console.log('  • 声道数:', settings.channelCount || 1);
            console.log('  • 回声消除:', settings.echoCancellation ? '开' : '关');
            console.log('  • 降噪:', settings.noiseSuppression ? '开' : '关');
            console.log('  • 自动增益:', settings.autoGainControl ? '开' : '关');

            // 创建音频源
            this.microphone = this.audioContext.createMediaStreamSource(this.stream);
            console.log('🔗 创建音频源节点');

            // 创建分析器节点
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.config.fftSize;
            this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;
            console.log('📊 创建分析器节点 (FFT:', this.config.fftSize + ')');

            // 创建脚本处理器（实时音频处理）
            // Phase 1: 当前使用 ScriptProcessor，后续将迁移到 AudioWorklet
            this.scriptProcessor = this.audioContext.createScriptProcessor(
                this.config.bufferSize,
                1, // 单声道输入
                1  // 单声道输出
            );
            console.log('⚙️  创建 ScriptProcessor (buffer:', this.config.bufferSize + ')');
            console.warn('⚠️  ScriptProcessor 已废弃，Phase 1 将迁移到 AudioWorklet');

            // 连接音频节点链
            this.microphone.connect(this.analyser);
            this.analyser.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);
            console.log('🔗 音频链路: Mic → Analyser → ScriptProcessor → Destination');

            // 设置音频处理回调
            this.scriptProcessor.onaudioprocess = (event) => {
                if (this.onAudioProcess && this.isRunning) {
                    const inputData = event.inputBuffer.getChannelData(0);
                    const audioBuffer = new Float32Array(inputData);
                    this.onAudioProcess(audioBuffer, this.audioContext.currentTime);
                }
            };

            this.isRunning = true;

            const micInitTime = performance.now() - micStartTime;
            console.log(`✅ 麦克风启动成功 (耗时: ${micInitTime.toFixed(2)} ms)`);
            console.groupEnd();

            return true;

        } catch (error) {
            console.error('❌ [AudioInput] 麦克风启动失败:', error);
            console.groupEnd();

            // 友好的错误提示
            if (error.name === 'NotAllowedError') {
                throw new Error('🚫 请允许访问麦克风权限\n\n点击浏览器地址栏的🔒图标，允许麦克风访问');
            } else if (error.name === 'NotFoundError') {
                throw new Error('🎤 未找到麦克风设备\n\n请确保：\n• 麦克风已连接\n• 麦克风未被其他应用占用\n• 系统设置中麦克风已启用');
            } else if (error.name === 'NotReadableError') {
                throw new Error('🔧 无法读取麦克风数据\n\n可能原因：\n• 麦克风被其他应用占用\n• 硬件故障\n• 驱动程序问题');
            } else {
                throw new Error('❌ 无法启动麦克风: ' + error.message);
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

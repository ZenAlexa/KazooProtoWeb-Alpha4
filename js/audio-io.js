/**
 * AudioIO 抽象层
 *
 * 统一的音频输入/输出接口，支持：
 * - AudioWorklet (现代, 低延迟)
 * - ScriptProcessor (回退, 兼容性)
 *
 * Phase 1: 低延迟音频基础
 * 为 AudioWorklet 迁移提供清晰的抽象
 *
 * @class AudioIO
 */

class AudioIO {
    constructor() {
        // 音频系统状态
        this.audioContext = null;
        this.stream = null;
        this.sourceNode = null;
        this.processorNode = null;
        this.isRunning = false;
        this.isInitialized = false;

        // 当前使用的模式
        this.mode = null; // 'worklet' | 'script-processor'

        // 配置 (从 audio-config.js 或默认值)
        this.config = {
            sampleRate: 44100,
            bufferSize: 2048,        // ScriptProcessor 模式
            workletBufferSize: 128,  // AudioWorklet 模式
            useWorklet: true,        // Phase 2.9: 启用 AudioWorklet 低延迟模式
            workletFallback: true,   // 自动回退到 ScriptProcessor
            latencyHint: 'interactive',
            debug: false             // 调试模式
        };

        // Phase 2.10: 存储主线程的集中式配置 (用于序列化到 Worklet)
        this.appConfig = null;  // 来自 configManager.get()

        // 回调函数
        this.onFrameCallback = null;           // 原始音频帧回调 (所有模式)
        this.onPitchDetectedCallback = null;   // 音高检测回调 (仅 Worklet 模式)
        this.onWorkletPitchFrameCallback = null; // Phase 2.9: Worklet PitchFrame 专用回调
        this.onErrorCallback = null;
        this.onStateChangeCallback = null;

        // 性能监控
        this.stats = {
            framesProcessed: 0,
            lastFrameTime: 0,
            avgProcessingTime: 0,
            dropouts: 0
        };
    }

    /**
     * 配置音频系统
     * @param {Object} options - 配置选项
     * @param {number} options.sampleRate - 采样率
     * @param {number} options.bufferSize - 缓冲大小 (ScriptProcessor)
     * @param {number} options.workletBufferSize - 缓冲大小 (AudioWorklet)
     * @param {boolean} options.useWorklet - 是否使用 AudioWorklet
     * @param {string} options.latencyHint - 延迟提示
     * @param {Object} options.appConfig - Phase 2.10: 集中式配置对象 (来自 configManager)
     */
    configure(options = {}) {
        console.log('[AudioIO] 配置音频系统:', options);

        // Phase 2.10: 保存集中式配置
        if (options.appConfig) {
            this.appConfig = options.appConfig;
            console.log('[AudioIO] ✅ 已接收集中式配置');
        }

        this.config = {
            ...this.config,
            ...options
        };

        // 验证配置
        this._validateConfig();

        return this;
    }

    /**
     * 启动音频系统
     * @returns {Promise<Object>} 启动结果 { mode, latency, sampleRate }
     */
    async start() {
        if (this.isRunning) {
            console.warn('[AudioIO] 音频系统已在运行');
            return;
        }

        const startTime = performance.now();

        try {
            console.group('🚀 [AudioIO] 启动音频系统');

            // 1. 初始化 AudioContext
            await this._initializeAudioContext();

            // 2. 请求麦克风权限
            await this._requestMicrophone();

            // 3. 决定使用哪种处理模式
            const useWorklet = this.config.useWorklet && this._supportsAudioWorklet();
            this.mode = useWorklet ? 'worklet' : 'script-processor';

            console.log('📌 选择模式:', this.mode);

            // 4. 创建音频处理链路
            if (this.mode === 'worklet') {
                await this._setupAudioWorklet();
            } else {
                await this._setupScriptProcessor();
            }

            this.isRunning = true;
            this.isInitialized = true;

            const initTime = performance.now() - startTime;
            const result = this.getLatencyInfo();

            console.log('✅ 启动成功:', {
                mode: this.mode,
                latency: result.totalLatency.toFixed(2) + 'ms',
                sampleRate: this.audioContext.sampleRate + 'Hz',
                initTime: initTime.toFixed(2) + 'ms'
            });
            console.groupEnd();

            // 触发状态变化回调
            this._notifyStateChange('started', result);

            return result;

        } catch (error) {
            console.error('❌ [AudioIO] 启动失败:', error);
            console.groupEnd();
            this._notifyError('start', error);
            throw error;
        }
    }

    /**
     * 停止音频系统
     */
    stop() {
        if (!this.isRunning) {
            console.warn('[AudioIO] 音频系统未运行');
            return;
        }

        console.log('🛑 [AudioIO] 停止音频系统');

        try {
            // 断开所有节点
            if (this.processorNode) {
                this.processorNode.disconnect();

                // 清理 ScriptProcessor 回调
                if (this.mode === 'script-processor') {
                    this.processorNode.onaudioprocess = null;
                }

                this.processorNode = null;
            }

            if (this.sourceNode) {
                this.sourceNode.disconnect();
                this.sourceNode = null;
            }

            // 停止麦克风流
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }

            this.isRunning = false;
            this._notifyStateChange('stopped', null);

            console.log('✅ [AudioIO] 已停止');

        } catch (error) {
            console.error('❌ [AudioIO] 停止时出错:', error);
            this._notifyError('stop', error);
        }
    }

    /**
     * 注册音频帧回调 (原始音频数据)
     * @param {Function} callback - (audioBuffer: Float32Array, timestamp: number) => void
     */
    onFrame(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onFrame callback must be a function');
        }
        this.onFrameCallback = callback;
        console.log('[AudioIO] 已注册音频帧回调');
        return this;
    }

    /**
     * 注册音高检测回调 (仅 Worklet 模式)
     * @param {Function} callback - (pitchInfo: Object) => void
     */
    onPitchDetected(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onPitchDetected callback must be a function');
        }
        this.onPitchDetectedCallback = callback;
        console.log('[AudioIO] 已注册音高检测回调');
        return this;
    }

    /**
     * Phase 2.9: 注册 Worklet PitchFrame 专用回调
     * @param {Function} callback - (pitchFrame: PitchFrame, timestamp: number) => void
     */
    onWorkletPitchFrame(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onWorkletPitchFrame callback must be a function');
        }
        this.onWorkletPitchFrameCallback = callback;
        console.log('[AudioIO] ✅ 已注册 Worklet PitchFrame 回调');
        return this;
    }

    /**
     * 注册错误回调
     * @param {Function} callback - (type: string, error: Error) => void
     */
    onError(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onError callback must be a function');
        }
        this.onErrorCallback = callback;
        return this;
    }

    /**
     * 注册状态变化回调
     * @param {Function} callback - (state: string, info: Object) => void
     */
    onStateChange(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('[AudioIO] onStateChange callback must be a function');
        }
        this.onStateChangeCallback = callback;
        return this;
    }

    /**
     * 获取延迟信息
     * @returns {Object} { bufferLatency, baseLatency, outputLatency, totalLatency }
     */
    getLatencyInfo() {
        if (!this.audioContext) {
            return {
                bufferLatency: 0,
                baseLatency: 0,
                outputLatency: 0,
                totalLatency: 0
            };
        }

        const bufferSize = this.mode === 'worklet'
            ? this.config.workletBufferSize
            : this.config.bufferSize;

        const bufferLatency = (bufferSize / this.audioContext.sampleRate) * 1000;
        const baseLatency = this.audioContext.baseLatency ?
            this.audioContext.baseLatency * 1000 : 0;
        const outputLatency = this.audioContext.outputLatency ?
            this.audioContext.outputLatency * 1000 : 0;

        return {
            mode: this.mode,
            bufferSize,
            sampleRate: this.audioContext.sampleRate,
            bufferLatency: parseFloat(bufferLatency.toFixed(2)),
            baseLatency: parseFloat(baseLatency.toFixed(2)),
            outputLatency: parseFloat(outputLatency.toFixed(2)),
            totalLatency: parseFloat((bufferLatency + baseLatency + outputLatency).toFixed(2))
        };
    }

    /**
     * 获取性能统计
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * 销毁音频系统 (清理所有资源)
     */
    async destroy() {
        console.log('[AudioIO] 销毁音频系统');

        this.stop();

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }

        this.isInitialized = false;
        console.log('✅ [AudioIO] 已销毁');
    }

    // ==================== 私有方法 ====================

    /**
     * Phase 2.10: 序列化配置并下发到 Worklet
     *
     * ⚠️ 关键修复: 将主线程集中式配置转换为 Worklet 可理解的参数
     * 避免 Worklet 使用硬编码值,确保配置一致性
     *
     * @private
     * @returns {Object} Worklet 配置对象
     */
    _serializeConfigForWorklet() {
        // 如果没有集中式配置,使用回退默认值
        if (!this.appConfig) {
            console.warn('[AudioIO] ⚠️ 未提供 appConfig,使用回退默认值');
            return {
                sampleRate: this.audioContext.sampleRate,
                algorithm: 'YIN',
                threshold: 0.1,  // YIN 算法内部阈值 (固定)
                clarityThreshold: 0.85,  // 音高置信度阈值
                minFrequency: 80,
                maxFrequency: 800,
                smoothingSize: 5,
                minVolumeThreshold: 0.01
            };
        }

        // Phase 2.10: 从集中式配置映射到 Worklet 参数
        const config = this.appConfig;
        const workletConfig = {
            // 基础参数
            sampleRate: this.audioContext.sampleRate,
            algorithm: 'YIN',

            // 音高检测参数 (从 config.pitchDetector 映射)
            threshold: 0.1,  // YIN 算法内部阈值 (固定,不暴露给用户)
            clarityThreshold: config.pitchDetector?.clarityThreshold ?? 0.85,
            minFrequency: config.pitchDetector?.minFrequency ?? 80,
            maxFrequency: config.pitchDetector?.maxFrequency ?? 800,

            // 平滑参数 (从 config.smoothing 映射)
            smoothingSize: 5,  // 中值滤波窗口 (固定)

            // 音量阈值 (从集中式配置读取)
            minVolumeThreshold: config.pitchDetector?.minVolumeThreshold ?? 0.002,  // 🔥 从配置读取

            // Phase 2.9: EMA 滤波器参数 (用于 Worklet 内部平滑)
            volumeAlpha: config.smoothing?.volume?.alpha ?? 0.3,
            brightnessAlpha: config.smoothing?.brightness?.alpha ?? 0.3,
            breathinessAlpha: 0.4,  // 固定值

            // Phase 2.9: 起音检测参数
            energyThreshold: config.onset?.energyThreshold ?? 3,
            silenceThreshold: config.onset?.silenceThreshold ?? -40,
            minStateDuration: config.onset?.attackDuration ?? 50
        };

        console.log('[AudioIO] 📋 配置映射完成:', {
            from: 'ConfigManager',
            to: 'Worklet',
            clarityThreshold: workletConfig.clarityThreshold,
            minFrequency: workletConfig.minFrequency,
            maxFrequency: workletConfig.maxFrequency
        });

        return workletConfig;
    }

    /**
     * 初始化 AudioContext
     * @private
     */
    async _initializeAudioContext() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            throw new Error('浏览器不支持 Web Audio API');
        }

        this.audioContext = new AudioContextClass({
            latencyHint: this.config.latencyHint,
            sampleRate: this.config.sampleRate
        });

        // 确保 AudioContext 处于运行状态
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        console.log('✅ AudioContext 已创建:', {
            sampleRate: this.audioContext.sampleRate,
            state: this.audioContext.state
        });
    }

    /**
     * 请求麦克风权限
     * @private
     */
    async _requestMicrophone() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('浏览器不支持麦克风访问');
        }

        console.log('🎤 请求麦克风权限...');

        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                latency: 0
            },
            video: false
        });

        // 创建音频源节点
        this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

        const track = this.stream.getAudioTracks()[0];
        console.log('✅ 麦克风已连接:', track.label || '默认设备');
    }

    /**
     * 设置 AudioWorklet 处理链路
     * @private
     */
    async _setupAudioWorklet() {
        console.log('⚙️  设置 AudioWorklet 处理链路...');

        try {
            // 1. 加载 Worklet 模块
            const workletPath = 'js/pitch-worklet.js';
            console.log('📦 加载 Worklet 模块:', workletPath);

            await this.audioContext.audioWorklet.addModule(workletPath);
            console.log('✅ Worklet 模块加载成功');

            // 2. 创建 AudioWorkletNode
            this.processorNode = new AudioWorkletNode(
                this.audioContext,
                'pitch-detector',
                {
                    numberOfInputs: 1,
                    numberOfOutputs: 1,
                    outputChannelCount: [1]
                }
            );
            console.log('✅ AudioWorkletNode 已创建');

            // 3. 监听 Worklet 消息
            this.processorNode.port.onmessage = this._handleWorkletMessage.bind(this);

            // 4. 发送初始配置 (Phase 2.10: 从 main.js 传入的集中式配置)
            // ⚠️ 关键修复: 将主线程配置序列化并下发到 Worklet
            const workletConfig = this._serializeConfigForWorklet();
            this.processorNode.port.postMessage({
                type: 'config',
                data: workletConfig
            });
            console.log('[AudioIO] 📤 配置已下发到 Worklet:', workletConfig);

            // 5. 连接节点链路
            // Phase 2.10: 仅用于音频分析，不连接到 destination (避免直接回放麦克风输入)
            // 合成器会单独连接到 destination 输出音色
            this.sourceNode.connect(this.processorNode);
            // REMOVED: this.processorNode.connect(this.audioContext.destination);
            console.log('🔗 AudioWorklet 链路: Mic → WorkletNode (分析用，不直接播放)');

            console.log('✅ AudioWorklet 处理链路已建立');

        } catch (error) {
            console.error('❌ AudioWorklet 设置失败:', error);

            // Phase 1.7: 触发回退到 ScriptProcessor
            if (this.config.workletFallback !== false) {
                console.warn('⚠️  回退到 ScriptProcessor 模式');
                this.mode = 'script-processor';
                await this._setupScriptProcessor();
            } else {
                throw error;
            }
        }
    }

    /**
     * 处理 Worklet 消息
     * @private
     */
    _handleWorkletMessage(event) {
        const { type, data, timestamp } = event.data;

        switch (type) {
            case 'ready':
                console.log('[AudioIO] ✅ Worklet 已就绪, 采样率:', data.sampleRate);
                break;

            case 'pitch-detected':
                // Phase 1: 传递音高检测结果到专用回调
                if (this.onPitchDetectedCallback) {
                    this.onPitchDetectedCallback(data);
                }
                this.stats.pitchDetections = (this.stats.pitchDetections || 0) + 1;
                break;

            case 'pitch-frame':
                // Phase 2.9: 完整 PitchFrame 数据 (11 字段)
                // 使用 Worklet 提供的精确 timestamp (AudioContext.currentTime * 1000)
                const frameTimestamp = timestamp || performance.now();

                // Worklet 模式: 单一数据出口，避免重复处理
                if (this.onWorkletPitchFrameCallback) {
                    // 专用回调优先 (推荐)
                    this.onWorkletPitchFrameCallback(data, frameTimestamp);
                } else if (this.onFrameCallback) {
                    // Fallback: 如果未注册专用回调，使用通用 onFrame
                    console.warn('[AudioIO] ⚠️ pitch-frame 未注册专用回调，使用 onFrame fallback');
                    this.onFrameCallback(data, frameTimestamp);
                }
                // 注意: 不再触发 onPitchDetectedCallback，避免双重处理

                this.stats.pitchDetections = (this.stats.pitchDetections || 0) + 1;
                break;

            case 'no-pitch':
                // 未检测到音高 (可选处理)
                if (this.config.debug && data) {
                    console.log('[AudioIO] 未检测到音高, 音量:', data.volume);
                }
                break;

            case 'test-ping':
                // Phase 1.6: 测试消息
                console.log('[AudioIO] Worklet Ping:', data);
                break;

            case 'stats':
                // 性能统计
                if (this.config.debug) {
                    console.log('[AudioIO] Worklet Stats:', data);
                }
                this.stats = {
                    ...this.stats,
                    workletStats: data
                };
                break;

            case 'error':
                console.error('[AudioIO] Worklet 错误:', data);
                this._notifyError('worklet', new Error(data.message));
                break;

            case 'config-applied':
                console.log('[AudioIO] Worklet 配置已应用');
                break;

            default:
                if (this.config.debug) {
                    console.log('[AudioIO] Worklet 消息:', type, data);
                }
        }
    }

    /**
     * 设置 ScriptProcessor 处理链路 (回退模式)
     * @private
     */
    async _setupScriptProcessor() {
        console.log('⚙️  设置 ScriptProcessor 处理链路 (回退模式)...');

        this.processorNode = this.audioContext.createScriptProcessor(
            this.config.bufferSize,
            1, // 单声道输入
            1  // 单声道输出
        );

        // 设置音频处理回调
        this.processorNode.onaudioprocess = (event) => {
            if (!this.isRunning || !this.onFrameCallback) return;

            const startTime = performance.now();

            // 提取音频数据
            const inputBuffer = event.inputBuffer.getChannelData(0);
            const audioBuffer = new Float32Array(inputBuffer);
            const timestamp = this.audioContext.currentTime;

            // 调用用户回调
            try {
                this.onFrameCallback(audioBuffer, timestamp);
            } catch (error) {
                console.error('[AudioIO] 音频帧处理错误:', error);
                this._notifyError('frame-processing', error);
            }

            // 性能统计
            const processingTime = performance.now() - startTime;
            this._updateStats(processingTime);
        };

        // 连接节点链路
        // Phase 2.10: 仅用于音频分析，不连接到 destination (避免直接回放麦克风输入)
        // 合成器会单独连接到 destination 输出音色
        this.sourceNode.connect(this.processorNode);
        // REMOVED: this.processorNode.connect(this.audioContext.destination);

        console.log('✅ ScriptProcessor 链路已建立 (分析用，不直接播放)');
    }

    /**
     * 检查浏览器是否支持 AudioWorklet
     * @private
     */
    _supportsAudioWorklet() {
        return typeof AudioWorkletNode !== 'undefined' &&
               'audioWorklet' in this.audioContext;
    }

    /**
     * 验证配置参数
     * @private
     */
    _validateConfig() {
        const { sampleRate, bufferSize, workletBufferSize } = this.config;

        if (sampleRate < 8000 || sampleRate > 96000) {
            console.warn('[AudioIO] 采样率超出推荐范围 (8000-96000Hz)');
        }

        if (![256, 512, 1024, 2048, 4096, 8192, 16384].includes(bufferSize)) {
            console.warn('[AudioIO] ScriptProcessor buffer size 应为 2^n (256-16384)');
        }

        if (![128, 256, 512, 1024].includes(workletBufferSize)) {
            console.warn('[AudioIO] AudioWorklet buffer size 应为 128/256/512/1024');
        }
    }

    /**
     * 更新性能统计
     * @private
     */
    _updateStats(processingTime) {
        this.stats.framesProcessed++;
        this.stats.lastFrameTime = performance.now();

        // 计算移动平均处理时间
        const alpha = 0.1; // 平滑因子
        this.stats.avgProcessingTime =
            this.stats.avgProcessingTime * (1 - alpha) + processingTime * alpha;
    }

    /**
     * 通知状态变化
     * @private
     */
    _notifyStateChange(state, info) {
        if (this.onStateChangeCallback) {
            try {
                this.onStateChangeCallback(state, info);
            } catch (error) {
                console.error('[AudioIO] 状态变化回调错误:', error);
            }
        }
    }

    /**
     * 通知错误
     * @private
     */
    _notifyError(type, error) {
        if (this.onErrorCallback) {
            try {
                this.onErrorCallback(type, error);
            } catch (err) {
                console.error('[AudioIO] 错误回调本身出错:', err);
            }
        }
    }
}

// 导出单例 (可选)
const audioIO = new AudioIO();

// 兼容旧代码: 导出类和实例
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioIO, audioIO };
}

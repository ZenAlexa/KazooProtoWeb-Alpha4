/**
 * 音频系统配置常量
 * 集中管理所有音频相关的配置参数
 *
 * Phase 1: 低延迟音频基础
 * 提取配置常量，便于 AudioWorklet 迁移和 A/B 测试
 */

export const AUDIO_CONFIG = {
    // === 采样配置 ===
    SAMPLE_RATE: 44100,  // Hz - 与 Dubler 2 保持一致

    // === Buffer Size 配置 ===
    // AudioWorklet 模式 (目标: 8-15ms 延迟)
    BUFFER_SIZE_WORKLET: 128,        // 推荐值: 128 (2.9ms @ 44.1kHz)
    BUFFER_SIZE_WORKLET_FALLBACK: 256, // Safari 回退: 256 (5.8ms)

    // ScriptProcessor 模式 (当前: 46ms 延迟)
    BUFFER_SIZE_LEGACY: 2048,        // 兼容性好，延迟高

    // === FFT 配置 ===
    FFT_SIZE: 2048,                  // 频谱分析窗口

    // === AudioContext 配置 ===
    LATENCY_HINT: 'interactive',     // 'interactive' | 'balanced' | 'playback'

    // === Feature Flags ===
    USE_AUDIO_WORKLET: true,         // 启用 AudioWorklet (Phase 1 核心)
    WORKLET_FALLBACK: true,          // 自动回退到 ScriptProcessor

    // === 音高检测配置 ===
    PITCH_DETECTION: {
        ALGORITHM: 'YIN',            // 当前: YIN, 未来: MPM/SWIPE
        THRESHOLD: 0.1,              // YIN 阈值 (0.05-0.2)
        MIN_FREQUENCY: 80,           // Hz - 人声最低频率
        MAX_FREQUENCY: 800,          // Hz - 人声最高频率
        SMOOTHING_SIZE: 5,           // 中值滤波窗口
        MIN_VOLUME_THRESHOLD: 0.01,  // RMS 音量阈值
    },

    // === 性能监控 ===
    PERFORMANCE: {
        FPS_HISTORY_SIZE: 30,
        PROCESSING_HISTORY_SIZE: 50,
        TARGET_LATENCY_MS: 15,       // Phase 1 目标
        MAX_ACCEPTABLE_LATENCY_MS: 30,
    },

    // === 浏览器兼容性 ===
    BROWSER_SUPPORT: {
        MIN_CHROME_VERSION: 66,      // AudioWorklet 支持
        MIN_FIREFOX_VERSION: 76,
        MIN_SAFARI_VERSION: 14.1,
        MIN_EDGE_VERSION: 79,
    },

    // === 调试选项 ===
    DEBUG: {
        LOG_AUDIO_EVENTS: true,      // 记录音频事件
        LOG_PERFORMANCE: true,        // 记录性能指标
        LOG_WORKLET_MESSAGES: true,   // 记录 Worklet 消息
        VERBOSE: false,               // 详细日志模式
    }
};

/**
 * 获取推荐的 Buffer Size
 * 根据浏览器能力返回最佳配置
 */
export function getRecommendedBufferSize(useWorklet = true) {
    if (!useWorklet) {
        return AUDIO_CONFIG.BUFFER_SIZE_LEGACY;
    }

    // 检测 Safari (已知 128 buffer 不稳定)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isSafari) {
        console.warn('[AudioConfig] Safari detected, using 256 buffer size for stability');
        return AUDIO_CONFIG.BUFFER_SIZE_WORKLET_FALLBACK;
    }

    return AUDIO_CONFIG.BUFFER_SIZE_WORKLET;
}

/**
 * 计算理论延迟
 */
export function calculateTheoreticalLatency(bufferSize, sampleRate) {
    return (bufferSize / sampleRate) * 1000; // ms
}

/**
 * 检查浏览器是否支持 AudioWorklet
 */
export function supportsAudioWorklet() {
    try {
        if (typeof AudioWorkletNode === 'undefined') {
            return false;
        }

        // 创建临时 AudioContext 检测
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            return false;
        }

        const tempContext = new AudioContextClass();
        const hasWorklet = 'audioWorklet' in tempContext;
        tempContext.close();

        return hasWorklet;
    } catch (e) {
        console.warn('[AudioConfig] AudioWorklet support detection failed:', e);
        return false;
    }
}

/**
 * 获取浏览器信息
 */
export function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let version = 0;

    if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) {
        browser = 'Chrome';
        version = parseInt(ua.match(/Chrome\/(\d+)/)?.[1] || '0');
    } else if (ua.indexOf('Firefox') > -1) {
        browser = 'Firefox';
        version = parseInt(ua.match(/Firefox\/(\d+)/)?.[1] || '0');
    } else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
        browser = 'Safari';
        version = parseInt(ua.match(/Version\/(\d+)/)?.[1] || '0');
    } else if (ua.indexOf('Edg') > -1) {
        browser = 'Edge';
        version = parseInt(ua.match(/Edg\/(\d+)/)?.[1] || '0');
    }

    return { browser, version };
}

/**
 * 验证浏览器兼容性
 */
export function validateBrowserCompatibility() {
    const { browser, version } = getBrowserInfo();
    const support = AUDIO_CONFIG.BROWSER_SUPPORT;
    const issues = [];

    // 检查最低版本要求
    if (browser === 'Chrome' && version < support.MIN_CHROME_VERSION) {
        issues.push(`Chrome 版本过低 (当前: ${version}, 需要: ${support.MIN_CHROME_VERSION}+)`);
    } else if (browser === 'Firefox' && version < support.MIN_FIREFOX_VERSION) {
        issues.push(`Firefox 版本过低 (当前: ${version}, 需要: ${support.MIN_FIREFOX_VERSION}+)`);
    } else if (browser === 'Safari' && version < support.MIN_SAFARI_VERSION) {
        issues.push(`Safari 版本过低 (当前: ${version}, 需要: ${support.MIN_SAFARI_VERSION}+)`);
    } else if (browser === 'Edge' && version < support.MIN_EDGE_VERSION) {
        issues.push(`Edge 版本过低 (当前: ${version}, 需要: ${support.MIN_EDGE_VERSION}+)`);
    }

    // 检查 AudioWorklet 支持
    const workletSupported = supportsAudioWorklet();

    return {
        browser,
        version,
        workletSupported,
        isCompatible: issues.length === 0,
        issues,
        canUseWorklet: workletSupported && issues.length === 0
    };
}

/**
 * 打印配置信息 (用于调试)
 */
export function logAudioConfig() {
    if (!AUDIO_CONFIG.DEBUG.LOG_AUDIO_EVENTS) return;

    const compat = validateBrowserCompatibility();
    const recommendedBuffer = getRecommendedBufferSize(AUDIO_CONFIG.USE_AUDIO_WORKLET);
    const theoreticalLatency = calculateTheoreticalLatency(recommendedBuffer, AUDIO_CONFIG.SAMPLE_RATE);

    console.group('[AudioConfig] 音频系统配置');
    console.log('🎵 采样率:', AUDIO_CONFIG.SAMPLE_RATE, 'Hz');
    console.log('📦 推荐 Buffer:', recommendedBuffer, 'samples');
    console.log('⏱️  理论延迟:', theoreticalLatency.toFixed(2), 'ms');
    console.log('🔧 AudioWorklet:', AUDIO_CONFIG.USE_AUDIO_WORKLET ? '启用' : '禁用');
    console.log('🌐 浏览器:', `${compat.browser} ${compat.version}`);
    console.log('✅ AudioWorklet 支持:', compat.workletSupported ? '是' : '否');

    if (compat.issues.length > 0) {
        console.warn('⚠️  兼容性问题:', compat.issues);
    }

    console.groupEnd();
}

// 自动检测并记录配置 (仅在导入时执行一次)
if (AUDIO_CONFIG.DEBUG.LOG_AUDIO_EVENTS) {
    logAudioConfig();
}

/**
 * Kazoo Proto Web - 集中式配置管理
 *
 * 基于现代软件工程最佳实践:
 * - Single Source of Truth (单一数据源)
 * - Type Safety (类型安全)
 * - Immutability (不可变性)
 * - Validation (运行时验证)
 * - Documentation (完整文档化)
 *
 * @module AppConfig
 * @version Alpha 4
 * @see {@link docs/CONFIGURATION.md} 完整配置文档
 */

/**
 * @typedef {Object} AudioEngineConfig
 * @property {number} sampleRate - 采样率 (Hz), 影响: 质量↑/CPU↑/延迟↓
 * @property {number} bufferSize - 缓冲区大小 (samples), 影响: 延迟↓/稳定性↓/CPU↑
 * @property {boolean} useWorklet - 使用 AudioWorklet (true) 或 ScriptProcessor (false)
 */

/**
 * @typedef {Object} PitchDetectorConfig
 * @property {number} clarityThreshold - YIN 清晰度阈值 (0-1), 影响: 灵敏度↑/误检↑
 * @property {number} minFrequency - 最低检测频率 (Hz), 影响: 检测范围/CPU
 * @property {number} maxFrequency - 最高检测频率 (Hz), 影响: 检测范围/CPU
 */

/**
 * @typedef {Object} KalmanFilterConfig
 * @property {number} processNoise - 过程噪声 (Q), 影响: 响应速度↑/平滑度↓
 * @property {number} measurementNoise - 测量噪声 (R), 影响: 平滑强度↑
 * @property {number} initialEstimate - 初始估计值
 * @property {number} initialError - 初始误差协方差
 */

/**
 * @typedef {Object} EMAFilterConfig
 * @property {number} alpha - 平滑系数 (0-1), 影响: 响应速度↑/平滑度↓
 */

/**
 * @typedef {Object} SmoothingConfig
 * @property {KalmanFilterConfig} kalman - Kalman 滤波器 (cents 平滑)
 * @property {EMAFilterConfig} volume - EMA 滤波器 (音量平滑)
 * @property {EMAFilterConfig} brightness - EMA 滤波器 (亮度平滑)
 */

/**
 * @typedef {Object} OnsetDetectorConfig
 * @property {number} energyThreshold - 能量阈值 (dB), 影响: 起音灵敏度↑/误检↑
 * @property {number} silenceThreshold - 静音阈值 (dB), 影响: 静音判定
 * @property {number} attackDuration - Attack 最短持续时间 (ms), 影响: 防抖
 * @property {number} minSilenceDuration - Release→Silence 最短时长 (ms), 影响: 尾音处理
 * @property {number} timeWindow - 时间窗口大小 (帧), 影响: 平滑度
 * @property {boolean} debug - 调试模式
 */

/**
 * @typedef {Object} SpectralFeaturesConfig
 * @property {number} fftSize - FFT 大小 (bins), 影响: 频率分辨率↑/CPU↑
 * @property {number} fftInterval - FFT 间隔 (帧), 影响: CPU↓/更新频率↓
 * @property {number} minFreq - 分析频率下限 (Hz), 影响: 分析范围/CPU
 * @property {number} maxFreq - 分析频率上限 (Hz), 影响: 分析范围/CPU
 */

/**
 * @typedef {Object} SynthesizerConfig
 * @property {number} pitchBendRange - Pitch Bend 范围 (cents), 影响: 音高微调范围
 * @property {Object} filterCutoffRange - Filter Cutoff 范围 (Hz)
 * @property {number} filterCutoffRange.min - 最小截止频率
 * @property {number} filterCutoffRange.max - 最大截止频率
 * @property {number} noiseGainMax - 噪声增益最大值 (0-1), 影响: 气声效果强度
 */

/**
 * @typedef {Object} PerformanceConfig
 * @property {boolean} enableStats - 启用性能统计
 * @property {'none'|'error'|'warn'|'info'|'debug'} logLevel - 日志级别
 */

/**
 * @typedef {Object} AppConfigSchema
 * @property {AudioEngineConfig} audio - 音频引擎配置
 * @property {PitchDetectorConfig} pitchDetector - 音高检测配置
 * @property {SmoothingConfig} smoothing - 平滑滤波配置
 * @property {OnsetDetectorConfig} onset - 起音检测配置
 * @property {SpectralFeaturesConfig} spectral - 频域特征配置
 * @property {SynthesizerConfig} synthesizer - 合成器配置
 * @property {PerformanceConfig} performance - 性能与调试配置
 */

// ============================================================================
// 默认配置 (Default Configuration)
// ============================================================================

/**
 * 默认配置 - 平衡质量和性能
 * 适用于: 标准浏览器、普通麦克风、正常环境
 *
 * @type {AppConfigSchema}
 */
const DEFAULT_CONFIG = {
  // ─────────────────────────────────────────────────────────────────────────
  // 音频引擎配置 (Audio Engine Configuration)
  // ─────────────────────────────────────────────────────────────────────────
  audio: {
    sampleRate: 44100,           // 44.1kHz (CD 质量)
    bufferSize: 2048,            // ~46ms 延迟 @ 44.1kHz
    useWorklet: true             // AudioWorklet (低延迟)
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 音高检测配置 (Pitch Detector Configuration)
  // ─────────────────────────────────────────────────────────────────────────
  pitchDetector: {
    clarityThreshold: 0.85,      // YIN 清晰度阈值 (平衡误检/漏检)
    minFrequency: 80,            // E2 (男低音)
    maxFrequency: 1000           // C6 (覆盖大部分人声)
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 平滑滤波配置 (Smoothing Filters Configuration)
  // ─────────────────────────────────────────────────────────────────────────
  smoothing: {
    // Kalman Filter (Cents 平滑)
    kalman: {
      processNoise: 0.001,       // Q: 过程噪声 (响应速度 vs 平滑度)
      measurementNoise: 0.1,     // R: 测量噪声 (测量信任度)
      initialEstimate: 0,        // 初始估计值
      initialError: 1            // 初始误差协方差
    },

    // EMA Filter (音量平滑)
    volume: {
      alpha: 0.3                 // 平滑系数 (响应速度 vs 平滑度)
    },

    // EMA Filter (亮度平滑)
    brightness: {
      alpha: 0.2                 // 平滑系数 (更平滑的视觉反馈)
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 起音检测配置 (Onset Detector Configuration)
  // ─────────────────────────────────────────────────────────────────────────
  onset: {
    energyThreshold: 6,          // 能量阈值 (dB) - 起音灵敏度
    silenceThreshold: -40,       // 静音阈值 (dB) - 静音判定
    attackDuration: 50,          // Attack 最短持续时间 (ms) - 防抖
    minSilenceDuration: 100,     // Release→Silence 最短时长 (ms) - 尾音处理
    timeWindow: 3,               // 时间窗口大小 (帧) - 平滑度
    debug: false                 // 调试模式
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 频域特征配置 (Spectral Features Configuration)
  // ─────────────────────────────────────────────────────────────────────────
  spectral: {
    fftSize: 2048,               // FFT 大小 (频率分辨率: 44100/2048 = 21.5 Hz/bin)
    fftInterval: 2,              // FFT 间隔 (每 2 帧运行一次, 节省 50% CPU)
    minFreq: 80,                 // 分析频率下限 (Hz)
    maxFreq: 8000                // 分析频率上限 (Hz) - 语音相关频段
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 合成器配置 (Synthesizer Configuration)
  // ─────────────────────────────────────────────────────────────────────────
  synthesizer: {
    pitchBendRange: 100,         // Pitch Bend 范围 (cents) - ±100 cents = ±1 全音
    filterCutoffRange: {
      min: 200,                  // Filter Cutoff 最小值 (Hz)
      max: 8000                  // Filter Cutoff 最大值 (Hz)
    },
    noiseGainMax: 0.3            // 噪声增益最大值 (气声效果强度)
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 性能与调试配置 (Performance & Debugging Configuration)
  // ─────────────────────────────────────────────────────────────────────────
  performance: {
    enableStats: true,           // 启用性能统计
    logLevel: 'info'             // 日志级别: none/error/warn/info/debug
  }
};

// ============================================================================
// 预设配置 (Preset Configurations)
// ============================================================================

/**
 * 低延迟预设 (Low Latency Preset)
 * 适用于: 实时演奏、互动应用
 */
const LOW_LATENCY_PRESET = {
  audio: {
    sampleRate: 48000,
    bufferSize: 512,             // ~10ms 延迟
    useWorklet: true
  },
  smoothing: {
    kalman: {
      processNoise: 0.005,       // 更快响应
      measurementNoise: 0.1,
      initialEstimate: 0,
      initialError: 1
    },
    volume: { alpha: 0.5 },      // 更快响应
    brightness: { alpha: 0.3 }
  },
  spectral: {
    fftSize: 1024,               // 更小 FFT
    fftInterval: 2,
    minFreq: 80,
    maxFreq: 8000
  }
};

/**
 * 高质量预设 (High Quality Preset)
 * 适用于: 音高分析、录音、后期处理
 */
const HIGH_QUALITY_PRESET = {
  audio: {
    sampleRate: 48000,
    bufferSize: 4096,            // ~85ms 延迟，高稳定性
    useWorklet: true
  },
  pitchDetector: {
    clarityThreshold: 0.90,      // 高置信度
    minFrequency: 80,
    maxFrequency: 2000
  },
  smoothing: {
    kalman: {
      processNoise: 0.0001,      // 高平滑
      measurementNoise: 0.05,
      initialEstimate: 0,
      initialError: 1
    },
    volume: { alpha: 0.1 },      // 高平滑
    brightness: { alpha: 0.1 }
  },
  spectral: {
    fftSize: 4096,               // 高频率分辨率
    fftInterval: 1,              // 每帧分析
    minFreq: 80,
    maxFreq: 8000
  }
};

/**
 * 节能预设 (Power Saving Preset)
 * 适用于: 低端设备、移动设备、省电模式
 */
const POWER_SAVING_PRESET = {
  audio: {
    sampleRate: 22050,           // 降低采样率
    bufferSize: 2048,
    useWorklet: false            // 兼容旧浏览器
  },
  pitchDetector: {
    clarityThreshold: 0.85,
    minFrequency: 100,
    maxFrequency: 800
  },
  smoothing: {
    kalman: {
      processNoise: 0.001,
      measurementNoise: 0.2,
      initialEstimate: 0,
      initialError: 1
    },
    volume: { alpha: 0.3 },
    brightness: { alpha: 0.3 }
  },
  spectral: {
    fftSize: 1024,               // 降低 FFT 大小
    fftInterval: 4,              // 仅 25% 帧运行 FFT
    minFreq: 100,
    maxFreq: 4000
  },
  performance: {
    enableStats: false,          // 禁用统计
    logLevel: 'error'
  }
};

// ============================================================================
// 配置验证 (Configuration Validation)
// ============================================================================

/**
 * 验证配置对象
 *
 * @param {Partial<AppConfigSchema>} config - 待验证的配置
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateConfig(config) {
  const errors = [];
  const warnings = [];

  // 验证音频引擎配置
  if (config.audio) {
    const { sampleRate, bufferSize, useWorklet } = config.audio;

    if (sampleRate && (sampleRate < 8000 || sampleRate > 96000)) {
      errors.push(`无效的采样率: ${sampleRate} (有效范围: 8000-96000 Hz)`);
    }

    if (bufferSize && ![256, 512, 1024, 2048, 4096, 8192, 16384].includes(bufferSize)) {
      errors.push(`无效的缓冲区大小: ${bufferSize} (必须是 2 的幂次: 256-16384)`);
    }

    if (useWorklet === true && typeof AudioWorkletNode === 'undefined') {
      warnings.push('AudioWorklet 不可用，将自动回退到 ScriptProcessor');
    }
  }

  // 验证音高检测配置
  if (config.pitchDetector) {
    const { clarityThreshold, minFrequency, maxFrequency } = config.pitchDetector;

    if (clarityThreshold && (clarityThreshold < 0 || clarityThreshold > 1)) {
      errors.push(`无效的清晰度阈值: ${clarityThreshold} (有效范围: 0-1)`);
    }

    if (minFrequency && maxFrequency && minFrequency >= maxFrequency) {
      errors.push(`minFrequency (${minFrequency}) 必须小于 maxFrequency (${maxFrequency})`);
    }

    if (maxFrequency && config.audio?.sampleRate && maxFrequency >= config.audio.sampleRate / 2) {
      errors.push(`maxFrequency (${maxFrequency}) 必须小于 Nyquist 频率 (${config.audio.sampleRate / 2})`);
    }
  }

  // 验证平滑滤波配置
  if (config.smoothing) {
    const { kalman, volume, brightness } = config.smoothing;

    if (kalman) {
      if (kalman.processNoise && kalman.processNoise <= 0) {
        errors.push(`processNoise 必须 > 0 (当前: ${kalman.processNoise})`);
      }
      if (kalman.measurementNoise && kalman.measurementNoise <= 0) {
        errors.push(`measurementNoise 必须 > 0 (当前: ${kalman.measurementNoise})`);
      }
    }

    if (volume?.alpha && (volume.alpha < 0 || volume.alpha > 1)) {
      errors.push(`volume.alpha 必须在 0-1 范围内 (当前: ${volume.alpha})`);
    }

    if (brightness?.alpha && (brightness.alpha < 0 || brightness.alpha > 1)) {
      errors.push(`brightness.alpha 必须在 0-1 范围内 (当前: ${brightness.alpha})`);
    }
  }

  // 验证起音检测配置
  if (config.onset) {
    const { energyThreshold, silenceThreshold } = config.onset;

    if (energyThreshold && energyThreshold < 0) {
      errors.push(`energyThreshold 必须 >= 0 (当前: ${energyThreshold})`);
    }

    if (silenceThreshold && silenceThreshold > 0) {
      warnings.push(`silenceThreshold 通常为负值 (当前: ${silenceThreshold})`);
    }
  }

  // 验证频域配置
  if (config.spectral) {
    const { fftSize, fftInterval } = config.spectral;

    if (fftSize && ![128, 256, 512, 1024, 2048, 4096, 8192, 16384].includes(fftSize)) {
      errors.push(`无效的 fftSize: ${fftSize} (必须是 2 的幂次: 128-16384)`);
    }

    if (fftInterval && fftInterval < 1) {
      errors.push(`fftInterval 必须 >= 1 (当前: ${fftInterval})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================================================
// 配置管理器 (Configuration Manager)
// ============================================================================

/**
 * 配置管理器类
 *
 * 职责:
 * - 配置加载和合并
 * - 配置验证
 * - 配置不可变性保证
 * - 配置热重载 (可选)
 */
class ConfigManager {
  constructor() {
    this._config = null;
    this._frozen = false;
  }

  /**
   * 加载配置
   *
   * @param {Partial<AppConfigSchema>} [userConfig] - 用户自定义配置
   * @param {string} [preset] - 预设名称: 'low-latency' | 'high-quality' | 'power-saving'
   * @returns {AppConfigSchema}
   */
  load(userConfig = {}, preset = null) {
    // 1. 选择基础配置
    let baseConfig = DEFAULT_CONFIG;

    if (preset) {
      switch (preset) {
        case 'low-latency':
          baseConfig = this._mergeDeep(DEFAULT_CONFIG, LOW_LATENCY_PRESET);
          break;
        case 'high-quality':
          baseConfig = this._mergeDeep(DEFAULT_CONFIG, HIGH_QUALITY_PRESET);
          break;
        case 'power-saving':
          baseConfig = this._mergeDeep(DEFAULT_CONFIG, POWER_SAVING_PRESET);
          break;
        default:
          console.warn(`[ConfigManager] 未知预设: ${preset}, 使用默认配置`);
      }
    }

    // 2. 合并用户配置
    const mergedConfig = this._mergeDeep(baseConfig, userConfig);

    // 3. 验证配置
    const validation = validateConfig(mergedConfig);

    if (!validation.valid) {
      console.error('[ConfigManager] 配置验证失败:', validation.errors);
      throw new Error(`配置无效: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warn => console.warn(`[ConfigManager] ${warn}`));
    }

    // 4. 冻结配置 (不可变性)
    this._config = Object.freeze(this._deepFreeze(mergedConfig));
    this._frozen = true;

    console.log('[ConfigManager] 配置加载成功');
    console.log('[ConfigManager] 预设:', preset || 'default');
    console.log('[ConfigManager] 采样率:', this._config.audio.sampleRate);
    console.log('[ConfigManager] 缓冲区:', this._config.audio.bufferSize);
    console.log('[ConfigManager] Worklet:', this._config.audio.useWorklet);

    return this._config;
  }

  /**
   * 获取当前配置
   *
   * @returns {AppConfigSchema}
   */
  get() {
    if (!this._config) {
      throw new Error('[ConfigManager] 配置未加载，请先调用 load()');
    }
    return this._config;
  }

  /**
   * 获取特定路径的配置值
   *
   * @param {string} path - 配置路径 (例: 'audio.sampleRate')
   * @returns {*}
   */
  getValue(path) {
    const keys = path.split('.');
    let value = this.get();

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * 深度合并对象
   *
   * @private
   * @param {Object} target - 目标对象
   * @param {Object} source - 源对象
   * @returns {Object}
   */
  _mergeDeep(target, source) {
    const output = { ...target };

    if (this._isObject(target) && this._isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this._isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this._mergeDeep(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }

    return output;
  }

  /**
   * 深度冻结对象
   *
   * @private
   * @param {Object} obj - 待冻结对象
   * @returns {Object}
   */
  _deepFreeze(obj) {
    Object.keys(obj).forEach(key => {
      if (this._isObject(obj[key])) {
        this._deepFreeze(obj[key]);
      }
    });
    return Object.freeze(obj);
  }

  /**
   * 判断是否为对象
   *
   * @private
   * @param {*} item - 待判断项
   * @returns {boolean}
   */
  _isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
}

// ============================================================================
// 导出 (Exports)
// ============================================================================

// 单例模式 (Singleton Pattern)
const configManager = new ConfigManager();

export {
  // 配置管理器
  configManager,

  // 默认配置
  DEFAULT_CONFIG,

  // 预设配置
  LOW_LATENCY_PRESET,
  HIGH_QUALITY_PRESET,
  POWER_SAVING_PRESET,

  // 验证函数
  validateConfig
};

// 默认导出
export default configManager;

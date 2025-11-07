/**
 * 常量定义文件
 *
 * 将所有魔法数字集中管理，便于维护和理解
 * 每个常量都有清晰的注释说明其用途
 *
 * @module Constants
 * @version 0.3.0
 */

// ============================================================================
// 音频相关常量 (Audio Constants)
// ============================================================================

export const AUDIO_CONSTANTS = {
  /**
   * 默认采样率 (Hz)
   * 44100 = CD 音质标准
   */
  DEFAULT_SAMPLE_RATE: 44100,

  /**
   * 音高检测最低频率 (Hz)
   * 对应音符: E2 (男低音范围)
   */
  MIN_FREQUENCY: 80,

  /**
   * 音高检测最高频率 (Hz)
   * 对应音符: 约 G6 (女高音高音区)
   */
  MAX_FREQUENCY: 1000,

  /**
   * AudioWorklet 缓冲区大小（固定值）
   * Web Audio API 标准: 128 samples
   */
  WORKLET_BUFFER_SIZE: 128,

  /**
   * ScriptProcessor 默认缓冲区大小
   * 影响延迟: 2048 samples @ 44.1kHz ≈ 46ms
   */
  SCRIPT_PROCESSOR_BUFFER_SIZE: 2048,

  /**
   * 最小音量阈值
   * 低于此值被视为静音
   */
  MIN_VOLUME_THRESHOLD: 0.0005,

  /**
   * 最小置信度阈值
   * 低于此值的检测结果被忽略
   */
  MIN_CONFIDENCE: 0.01,

  /**
   * 音高检测清晰度阈值
   * YIN 算法参数，范围 0-1
   */
  CLARITY_THRESHOLD: 0.10
};

// ============================================================================
// 校准相关常量 (Calibration Constants)
// ============================================================================

export const CALIBRATION_CONSTANTS = {
  /**
   * 每个校准步骤的录音时长（秒）
   */
  RECORDING_DURATION: 2.0,

  /**
   * 最小有效样本数
   * 少于此数量的样本被认为数据不足
   */
  MIN_VALID_SAMPLES: 50,

  /**
   * 置信度阈值
   * 高于此值的样本才被用于校准
   */
  CONFIDENCE_THRESHOLD: 0.85,

  /**
   * 校准步骤总数
   * 对应 5 个音： C4, E4, G4, C5, G3
   */
  CALIBRATION_STEPS: 5,

  /**
   * 校准目标音高（Hz）
   * 索引对应 [C4, E4, G4, C5, G3]
   */
  CALIBRATION_TARGET_FREQUENCIES: [261.63, 329.63, 392.00, 523.25, 196.00],

  /**
   * 校准目标音符名称
   */
  CALIBRATION_TARGET_NOTES: ['C4', 'E4', 'G4', 'C5', 'G3']
};

// ============================================================================
// 视觉效果常量 (Visual Constants)
// ============================================================================

export const VISUAL_CONSTANTS = {
  /**
   * 亮度 gamma 校正系数
   * 用于非线性亮度映射: Math.pow(brightness, GAMMA)
   */
  BRIGHTNESS_GAMMA: 1.5,

  /**
   * Canvas 高度比例
   * 实际绘制高度 = canvas.height * CANVAS_HEIGHT_RATIO
   */
  CANVAS_HEIGHT_RATIO: 0.8,

  /**
   * 粒子透明度
   * 范围 0-1
   */
  PARTICLE_ALPHA: 0.7,

  /**
   * 音高曲线默认宽度（像素）
   */
  PITCH_CANVAS_WIDTH: 600,

  /**
   * 音高曲线默认高度（像素）
   */
  PITCH_CANVAS_HEIGHT: 80,

  /**
   * 可视化刷新率（毫秒）
   */
  VISUALIZATION_REFRESH_RATE: 50,

  /**
   * 音高曲线历史点数
   * 决定曲线的长度
   */
  PITCH_HISTORY_LENGTH: 100
};

// ============================================================================
// UI 相关常量 (UI Constants)
// ============================================================================

export const UI_CONSTANTS = {
  /**
   * 状态栏更新间隔（毫秒）
   */
  STATUS_BAR_UPDATE_INTERVAL: 100,

  /**
   * 帮助文本淡入/淡出动画时长（毫秒）
   */
  HELP_ANIMATION_DURATION: 300,

  /**
   * 错误提示自动消失时长（毫秒）
   */
  ERROR_MESSAGE_DURATION: 5000,

  /**
   * 成功提示自动消失时长（毫秒）
   */
  SUCCESS_MESSAGE_DURATION: 3000,

  /**
   * 按钮防抖延迟（毫秒）
   */
  BUTTON_DEBOUNCE_DELAY: 200
};

// ============================================================================
// 时间相关常量 (Timing Constants)
// ============================================================================

export const TIMING_CONSTANTS = {
  /**
   * 音频处理最大延迟（毫秒）
   * 超过此值显示警告
   */
  MAX_ACCEPTABLE_LATENCY: 100,

  /**
   * 音频处理理想延迟（毫秒）
   */
  TARGET_LATENCY: 50,

  /**
   * AudioWorklet 理论延迟（毫秒）
   * 128 samples @ 44.1kHz ≈ 2.9ms
   */
  WORKLET_LATENCY: 3,

  /**
   * 性能监控采样间隔（毫秒）
   */
  PERFORMANCE_SAMPLE_INTERVAL: 1000,

  /**
   * 录音进度条更新频率（毫秒）
   * 用于平滑的进度显示
   */
  RECORDING_PROGRESS_UPDATE_RATE: 50
};

// ============================================================================
// 合成器相关常量 (Synthesizer Constants)
// ============================================================================

export const SYNTH_CONSTANTS = {
  /**
   * Pitch Bend 范围（cents）
   * ±100 cents = ±1 全音
   */
  PITCH_BEND_RANGE: 100,

  /**
   * 滤波器截止频率最小值（Hz）
   */
  FILTER_CUTOFF_MIN: 200,

  /**
   * 滤波器截止频率最大值（Hz）
   */
  FILTER_CUTOFF_MAX: 8000,

  /**
   * 噪声增益最大值（0-1）
   * 用于气声效果
   */
  NOISE_GAIN_MAX: 0.3,

  /**
   * 默认音量（0-1）
   */
  DEFAULT_VOLUME: 0.7,

  /**
   * 音符 Attack 时间（秒）
   */
  NOTE_ATTACK_TIME: 0.01,

  /**
   * 音符 Release 时间（秒）
   */
  NOTE_RELEASE_TIME: 0.1
};

// ============================================================================
// 浏览器兼容性相关常量 (Browser Compatibility Constants)
// ============================================================================

export const BROWSER_CONSTANTS = {
  /**
   * 浏览器最小版本要求
   */
  MIN_CHROME_VERSION: 66,
  MIN_FIREFOX_VERSION: 76,
  MIN_SAFARI_VERSION: 14.1,

  /**
   * Web Audio API 特性检测
   */
  REQUIRED_FEATURES: [
    'AudioContext',
    'AudioWorkletNode', // 可选，会自动降级
    'MediaDevices',
    'getUserMedia'
  ],

  /**
   * 推荐使用的浏览器
   */
  RECOMMENDED_BROWSERS: ['Chrome', 'Edge', 'Firefox']
};

// ============================================================================
// 错误代码常量 (Error Code Constants)
// ============================================================================

export const ERROR_CODES = {
  // 麦克风相关
  MIC_PERMISSION_DENIED: 'E001',
  MIC_NOT_FOUND: 'E002',
  MIC_IN_USE: 'E003',

  // 音频系统相关
  AUDIO_CONTEXT_FAILED: 'E101',
  WORKLET_LOAD_FAILED: 'E102',
  AUDIO_STREAM_FAILED: 'E103',

  // 校准相关
  CALIBRATION_TIMEOUT: 'E201',
  CALIBRATION_INSUFFICIENT_DATA: 'E202',
  CALIBRATION_INVALID_PITCH: 'E203',

  // 浏览器兼容性
  BROWSER_NOT_SUPPORTED: 'E301',
  FEATURE_NOT_AVAILABLE: 'E302'
};

// ============================================================================
// 调试相关常量 (Debug Constants)
// ============================================================================

export const DEBUG_CONSTANTS = {
  /**
   * 是否启用延迟分析器
   */
  ENABLE_LATENCY_PROFILER: false,

  /**
   * 是否显示详细日志
   */
  ENABLE_VERBOSE_LOGGING: false,

  /**
   * 是否显示性能统计
   */
  ENABLE_PERFORMANCE_STATS: true,

  /**
   * 是否在控制台显示音频波形
   */
  ENABLE_WAVEFORM_LOGGING: false
};

// ============================================================================
// 辅助函数 (Helper Functions)
// ============================================================================

/**
 * 将频率转换为音符名称
 *
 * @param {number} frequency - 频率 (Hz)
 * @returns {string} 音符名称 (例: "A4")
 */
export function frequencyToNote(frequency) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const a4 = 440;
  const c0 = a4 * Math.pow(2, -4.75);
  const halfSteps = Math.round(12 * Math.log2(frequency / c0));
  const octave = Math.floor(halfSteps / 12);
  const note = noteNames[halfSteps % 12];
  return `${note}${octave}`;
}

/**
 * 计算两个频率之间的音分差（cents）
 *
 * @param {number} frequency - 当前频率 (Hz)
 * @param {number} targetFrequency - 目标频率 (Hz)
 * @returns {number} 音分差（正数=偏高，负数=偏低）
 */
export function calculateCents(frequency, targetFrequency) {
  return 1200 * Math.log2(frequency / targetFrequency);
}

/**
 * 判断是否为开发环境
 *
 * @returns {boolean}
 */
export function isDevelopment() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/**
 * 判断是否为生产环境
 *
 * @returns {boolean}
 */
export function isProduction() {
  return !isDevelopment();
}

// ============================================================================
// 默认导出所有常量
// ============================================================================

export default {
  AUDIO_CONSTANTS,
  CALIBRATION_CONSTANTS,
  VISUAL_CONSTANTS,
  UI_CONSTANTS,
  TIMING_CONSTANTS,
  SYNTH_CONSTANTS,
  BROWSER_CONSTANTS,
  ERROR_CODES,
  DEBUG_CONSTANTS
};

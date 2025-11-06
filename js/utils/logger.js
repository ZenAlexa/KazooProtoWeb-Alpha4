/**
 * Logger - 分级日志系统
 *
 * 功能:
 * - 支持 DEBUG/INFO/WARN/ERROR 四个级别
 * - 自动添加模块名前缀
 * - 开发/生产环境自动切换
 * - 支持对象格式化输出
 *
 * 使用示例:
 * ```javascript
 * import { Logger } from './utils/logger.js';
 * const logger = new Logger('AudioIO');
 *
 * logger.debug('初始化音频上下文');
 * logger.info('音频系统已启动', { sampleRate: 44100 });
 * logger.warn('AudioWorklet 不可用，降级到 ScriptProcessor');
 * logger.error('麦克风权限被拒绝', error);
 * ```
 *
 * @module Logger
 * @version 0.4.0
 */

/**
 * 日志级别枚举
 * @readonly
 * @enum {number}
 */
const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

/**
 * 日志级别到控制台方法的映射
 * @private
 */
const CONSOLE_METHOD = {
  [LOG_LEVEL.DEBUG]: 'log',
  [LOG_LEVEL.INFO]: 'info',
  [LOG_LEVEL.WARN]: 'warn',
  [LOG_LEVEL.ERROR]: 'error'
};

/**
 * 日志级别到 emoji 的映射
 * @private
 */
const LEVEL_EMOJI = {
  [LOG_LEVEL.DEBUG]: '',
  [LOG_LEVEL.INFO]: 'ℹ',
  [LOG_LEVEL.WARN]: '',
  [LOG_LEVEL.ERROR]: ''
};

/**
 * Logger 类
 */
export class Logger {
  /**
   * 创建 Logger 实例
   *
   * @param {string} moduleName - 模块名称（用于日志前缀）
   * @param {Object} [options] - 可选配置
   * @param {boolean} [options.isDev] - 是否开发环境（默认自动检测）
   * @param {number} [options.minLevel] - 最小日志级别（默认 DEBUG）
   */
  constructor(moduleName, options = {}) {
    this.moduleName = moduleName;

    // 自动检测开发环境
    this.isDev = options.isDev !== undefined
      ? options.isDev
      : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // 设置最小日志级别
    this.minLevel = options.minLevel !== undefined
      ? options.minLevel
      : (this.isDev ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
  }

  /**
   * DEBUG 级别日志（仅开发环境）
   * 用于详细的调试信息
   *
   * @param {...any} args - 日志参数
   */
  debug(...args) {
    if (this.minLevel <= LOG_LEVEL.DEBUG) {
      this._log(LOG_LEVEL.DEBUG, ...args);
    }
  }

  /**
   * INFO 级别日志
   * 用于重要的状态信息
   *
   * @param {...any} args - 日志参数
   */
  info(...args) {
    if (this.minLevel <= LOG_LEVEL.INFO) {
      this._log(LOG_LEVEL.INFO, ...args);
    }
  }

  /**
   * WARN 级别日志
   * 用于警告信息（不影响功能但需要注意）
   *
   * @param {...any} args - 日志参数
   */
  warn(...args) {
    if (this.minLevel <= LOG_LEVEL.WARN) {
      this._log(LOG_LEVEL.WARN, ...args);
    }
  }

  /**
   * ERROR 级别日志
   * 用于错误信息（影响功能）
   *
   * @param {...any} args - 日志参数
   */
  error(...args) {
    if (this.minLevel <= LOG_LEVEL.ERROR) {
      this._log(LOG_LEVEL.ERROR, ...args);
    }
  }

  /**
   * 内部日志方法
   *
   * @private
   * @param {number} level - 日志级别
   * @param {...any} args - 日志参数
   */
  _log(level, ...args) {
    const method = CONSOLE_METHOD[level];
    const emoji = LEVEL_EMOJI[level];
    const prefix = `${emoji} [${this.moduleName}]`;

    // 格式化时间戳（仅开发环境）
    if (this.isDev && level <= LOG_LEVEL.INFO) {
      const timestamp = new Date().toISOString().substr(11, 12);
      console[method](`${prefix} [${timestamp}]`, ...args);
    } else {
      console[method](prefix, ...args);
    }
  }

  /**
   * 设置最小日志级别
   *
   * @param {number} level - 日志级别
   */
  setMinLevel(level) {
    this.minLevel = level;
  }
}

/**
 * 全局日志级别配置
 * 可以在运行时动态调整
 *
 * @example
 * // 生产环境只显示 ERROR
 * LoggerConfig.setGlobalLevel(LOG_LEVEL.ERROR);
 *
 * // 调试特定问题时临时启用 DEBUG
 * LoggerConfig.setGlobalLevel(LOG_LEVEL.DEBUG);
 */
export const LoggerConfig = {
  _globalLevel: LOG_LEVEL.DEBUG,

  /**
   * 设置全局日志级别
   *
   * @param {number} level - 日志级别
   */
  setGlobalLevel(level) {
    this._globalLevel = level;
  },

  /**
   * 获取全局日志级别
   *
   * @returns {number}
   */
  getGlobalLevel() {
    return this._globalLevel;
  }
};

// 导出日志级别常量
export { LOG_LEVEL };

// 默认导出
export default Logger;

/**
 * 平滑算法模块 - Smoothing Filters
 * Phase 2: 表现力特征平滑处理
 *
 * 提供三种平滑算法:
 * 1. Kalman Filter - 卡尔曼滤波器 (最优递归估计)
 * 2. EMA Filter - 指数移动平均 (简单快速)
 * 3. Median Filter - 中值滤波器 (去除突变噪声)
 *
 * @module SmoothingFilters
 * @author Ziming Wang & Claude
 * @date 2025-10-30
 */

// ==================== Kalman Filter ====================

/**
 * Kalman Filter 类 - 一维卡尔曼滤波器
 *
 * 原理: 使用递归预测-更新机制，在预测模型和测量值之间找到最优平衡
 * 适用场景: 音分 (cents) 平滑 - 需要高精度和快速响应
 *
 * 公式:
 * - 预测: x_pred = x, P_pred = P + Q
 * - 更新: K = P_pred / (P_pred + R)
 *         x = x_pred + K * (measurement - x_pred)
 *         P = (1 - K) * P_pred
 *
 * @class KalmanFilter
 * @example
 * const filter = new KalmanFilter({ Q: 0.001, R: 0.1 });
 * const smoothedCents = filter.update(rawCents);
 */
export class KalmanFilter {
  /**
   * 构造函数
   * @param {Object} config - 配置参数
   * @param {number} [config.Q=0.001] - 过程噪声协方差 (越小越信任模型，响应越慢)
   * @param {number} [config.R=0.1] - 测量噪声协方差 (越小越信任测量，响应越快)
   * @param {number} [config.initialEstimate=0] - 初始估计值
   * @param {number} [config.initialError=1] - 初始误差协方差
   */
  constructor(config = {}) {
    this.Q = config.Q ?? 0.001;  // 过程噪声 (Process noise)
    this.R = config.R ?? 0.1;    // 测量噪声 (Measurement noise)

    // 状态变量
    this.x = config.initialEstimate ?? 0;  // 状态估计 (State estimate)
    this.P = config.initialError ?? 1;     // 误差协方差 (Error covariance)

    // 统计信息 (用于调试)
    this.updateCount = 0;
  }

  /**
   * 更新滤波器并返回平滑后的值
   * @param {number} measurement - 新的测量值
   * @returns {number} 平滑后的估计值
   * @throws {TypeError} 如果 measurement 不是有限数值
   * @example
   * const smoothedCents = kalmanFilter.update(rawCents);
   */
  update(measurement) {
    // 输入验证
    if (!isFinite(measurement)) {
      console.warn('[KalmanFilter] 收到无效测量值，返回上一次估计值');
      return this.x;
    }

    // 预测步骤 (Prediction Step)
    const x_pred = this.x;           // 状态预测 (简化：假设状态不变)
    const P_pred = this.P + this.Q;  // 误差预测

    // 更新步骤 (Update Step)
    const K = P_pred / (P_pred + this.R);  // Kalman 增益 (Kalman Gain)
    this.x = x_pred + K * (measurement - x_pred);  // 状态更新
    this.P = (1 - K) * P_pred;                     // 误差更新

    this.updateCount++;

    return this.x;
  }

  /**
   * 重置滤波器状态
   * @param {number} [initialValue=0] - 重置的初始值
   */
  reset(initialValue = 0) {
    this.x = initialValue;
    this.P = 1;
    this.updateCount = 0;
  }

  /**
   * 获取当前估计值 (不更新)
   * @returns {number} 当前状态估计
   */
  getValue() {
    return this.x;
  }

  /**
   * 获取当前误差协方差 (调试用)
   * @returns {number} 当前误差协方差
   */
  getErrorCovariance() {
    return this.P;
  }

  /**
   * 获取 Kalman 增益 (调试用)
   * @returns {number} 当前 Kalman 增益
   */
  getKalmanGain() {
    const P_pred = this.P + this.Q;
    return P_pred / (P_pred + this.R);
  }

  /**
   * 获取滤波器统计信息 (测试专用)
   * @returns {Object} 统计信息
   * @private
   */
  __test_getState() {
    return {
      x: this.x,
      P: this.P,
      Q: this.Q,
      R: this.R,
      updateCount: this.updateCount,
      kalmanGain: this.getKalmanGain()
    };
  }
}

// ==================== EMA Filter ====================

/**
 * EMA (Exponential Moving Average) 滤波器类
 *
 * 原理: 指数加权移动平均，新值权重高于历史值
 * 适用场景: 音量、亮度、气声度 - 需要快速响应和简单计算
 *
 * 公式: S_t = α * Y_t + (1 - α) * S_{t-1}
 * 其中 α 为平滑系数 (0-1)，越大响应越快
 *
 * @class EMAFilter
 * @example
 * const filter = new EMAFilter({ alpha: 0.3 });
 * const smoothedVolume = filter.update(rawVolume);
 */
export class EMAFilter {
  /**
   * 构造函数
   * @param {Object} config - 配置参数
   * @param {number} [config.alpha=0.3] - 平滑系数 (0-1, 越大响应越快)
   * @param {number} [config.initialValue=0] - 初始值
   */
  constructor(config = {}) {
    this.alpha = config.alpha ?? 0.3;
    this.value = config.initialValue ?? 0;
    this.initialized = false;
    this.updateCount = 0;

    // 验证 alpha 范围
    if (this.alpha < 0 || this.alpha > 1) {
      throw new RangeError('EMAFilter alpha 必须在 0-1 范围内');
    }
  }

  /**
   * 更新滤波器并返回平滑后的值
   * @param {number} newValue - 新的输入值
   * @returns {number} 平滑后的值
   * @throws {TypeError} 如果 newValue 不是有限数值
   * @example
   * const smoothedVolume = emaFilter.update(rawVolume);
   */
  update(newValue) {
    // 输入验证
    if (!isFinite(newValue)) {
      console.warn('[EMAFilter] 收到无效输入值，返回上一次值');
      return this.value;
    }

    // 第一次更新：直接使用新值
    if (!this.initialized) {
      this.value = newValue;
      this.initialized = true;
      this.updateCount++;
      return this.value;
    }

    // EMA 公式: S_t = α * Y_t + (1 - α) * S_{t-1}
    this.value = this.alpha * newValue + (1 - this.alpha) * this.value;
    this.updateCount++;

    return this.value;
  }

  /**
   * 重置滤波器
   * @param {number} [initialValue=0] - 重置的初始值
   */
  reset(initialValue = 0) {
    this.value = initialValue;
    this.initialized = false;
    this.updateCount = 0;
  }

  /**
   * 获取当前值 (不更新)
   * @returns {number} 当前平滑值
   */
  getValue() {
    return this.value;
  }

  /**
   * 设置新的 alpha 值 (动态调整响应速度)
   * @param {number} alpha - 新的 alpha 值 (0-1)
   */
  setAlpha(alpha) {
    if (alpha < 0 || alpha > 1) {
      throw new RangeError('alpha 必须在 0-1 范围内');
    }
    this.alpha = alpha;
  }

  /**
   * 获取滤波器统计信息 (测试专用)
   * @returns {Object} 统计信息
   * @private
   */
  __test_getState() {
    return {
      value: this.value,
      alpha: this.alpha,
      initialized: this.initialized,
      updateCount: this.updateCount
    };
  }
}

// ==================== Median Filter ====================

/**
 * 中值滤波器类
 *
 * 原理: 使用滑动窗口内的中值作为输出，有效去除突变噪声
 * 适用场景: 去除音高检测中的偶发错误值
 *
 * 特点:
 * - 非线性滤波器
 * - 对脉冲噪声有极好的抑制效果
 * - 保持边缘特性 (不会平滑突变的真实信号)
 *
 * @class MedianFilter
 * @example
 * const filter = new MedianFilter({ windowSize: 5 });
 * const smoothed = filter.update(rawValue);
 */
export class MedianFilter {
  /**
   * 构造函数
   * @param {Object} config - 配置参数
   * @param {number} [config.windowSize=5] - 滑动窗口大小 (必须为奇数)
   * @throws {Error} 如果 windowSize 不是奇数
   */
  constructor(config = {}) {
    this.windowSize = config.windowSize ?? 5;

    // 验证窗口大小必须为奇数
    if (this.windowSize % 2 === 0) {
      throw new Error('MedianFilter windowSize 必须为奇数');
    }
    if (this.windowSize < 3) {
      throw new RangeError('MedianFilter windowSize 必须 >= 3');
    }

    this.buffer = [];
    this.updateCount = 0;
  }

  /**
   * 更新滤波器并返回中值
   * @param {number} newValue - 新的输入值
   * @returns {number} 窗口内的中值
   * @throws {TypeError} 如果 newValue 不是有限数值
   * @example
   * const median = medianFilter.update(rawPitch);
   */
  update(newValue) {
    // 输入验证
    if (!isFinite(newValue)) {
      console.warn('[MedianFilter] 收到无效输入值，返回当前中值或 0');
      return this.buffer.length > 0 ? this._calculateMedian() : 0;
    }

    // 添加新值到缓冲区
    this.buffer.push(newValue);

    // 保持窗口大小
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    this.updateCount++;

    // 返回中值
    return this._calculateMedian();
  }

  /**
   * 计算缓冲区的中值
   * @private
   * @returns {number} 中值
   */
  _calculateMedian() {
    if (this.buffer.length === 0) {
      return 0;
    }

    // 复制并排序 (不修改原 buffer)
    const sorted = [...this.buffer].sort((a, b) => a - b);
    const middleIndex = Math.floor(sorted.length / 2);

    // 如果长度为偶数，返回中间两个值的平均
    // 如果长度为奇数，返回中间值
    if (sorted.length % 2 === 0) {
      return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
    } else {
      return sorted[middleIndex];
    }
  }

  /**
   * 重置滤波器
   */
  reset() {
    this.buffer = [];
    this.updateCount = 0;
  }

  /**
   * 获取当前中值 (不更新)
   * @returns {number} 当前中值
   */
  getValue() {
    return this._calculateMedian();
  }

  /**
   * 获取当前缓冲区大小
   * @returns {number} 缓冲区长度
   */
  getBufferSize() {
    return this.buffer.length;
  }

  /**
   * 检查缓冲区是否已满
   * @returns {boolean} 缓冲区是否已填充满
   */
  isBufferFull() {
    return this.buffer.length >= this.windowSize;
  }

  /**
   * 获取滤波器统计信息 (测试专用)
   * @returns {Object} 统计信息
   * @private
   */
  __test_getState() {
    return {
      buffer: [...this.buffer],
      windowSize: this.windowSize,
      currentSize: this.buffer.length,
      updateCount: this.updateCount,
      median: this._calculateMedian()
    };
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建平滑滤波器工厂函数
 * @param {string} method - 滤波器类型: 'kalman' | 'ema' | 'median' | 'none'
 * @param {Object} config - 滤波器配置
 * @returns {KalmanFilter|EMAFilter|MedianFilter|null} 滤波器实例
 * @throws {Error} 如果 method 类型未知
 * @example
 * const filter = createFilter('ema', { alpha: 0.3 });
 */
export function createFilter(method, config = {}) {
  switch (method) {
    case 'kalman':
      return new KalmanFilter(config);
    case 'ema':
      return new EMAFilter(config);
    case 'median':
      return new MedianFilter(config);
    case 'none':
      return null;
    default:
      throw new Error(`未知的平滑方法: ${method}。支持的方法: kalman, ema, median, none`);
  }
}

// ==================== 导出 ====================

export default {
  KalmanFilter,
  EMAFilter,
  MedianFilter,
  createFilter
};

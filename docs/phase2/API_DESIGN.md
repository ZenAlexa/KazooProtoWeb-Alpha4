# Phase 2 - API Design Specification

**版本**: Phase 2 Draft 1
**日期**: 2025-10-30
**作者**: Ziming Wang & Claude
**状态**: API 设计阶段

---

## 1. 概述 (Overview)

本文档定义 Phase 2 所有模块的详细 API 接口，包括函数签名、参数类型、返回值、错误处理等。

### 设计哲学

1. **类型安全**: 使用 JSDoc 严格定义类型，便于 IDE 智能提示和静态检查
2. **纯函数优先**: 无副作用的纯函数，便于测试和组合
3. **错误优雅处理**: 明确的错误边界，不崩溃不静默失败
4. **可配置性**: 所有阈值和参数都可外部配置

---

## 2. 核心数据类型 (Core Types)

### 2.1 PitchFrame (统一数据帧)

```javascript
/**
 * PitchFrame - 单帧完整的音高和表现力数据
 * @typedef {Object} PitchFrame
 *
 * @property {number} timestamp - 时间戳 (ms)
 *
 * // 基础音高数据 (Phase 1)
 * @property {number} frequency - 频率 (Hz, 80-800)
 * @property {string} note - 音符名称 (如 "C4")
 * @property {number} octave - 八度 (0-8)
 * @property {number} confidence - 置信度 (0-1)
 *
 * // Phase 2: 动态特征
 * @property {number} volumeDb - 音量 (dB, -60 ~ 0)
 * @property {number} volumeLinear - 音量线性 (0-1)
 *
 * // Phase 2: 音高精度
 * @property {number} cents - 音分偏移 (-50 ~ +50)
 * @property {number} pitchStability - 音高稳定性 (0-1)
 *
 * // Phase 2: 时域特征
 * @property {ArticulationType} articulation - 起音状态
 * @property {number} attackTime - 起音时间 (ms)
 *
 * // Phase 2: 频域特征
 * @property {number} spectralCentroid - 频谱质心 (Hz)
 * @property {number} brightness - 亮度 (0-1)
 * @property {number} formant - 共振峰估计 (Hz)
 * @property {number} breathiness - 气声度 (0-1)
 *
 * // 原始数据 (可选)
 * @property {Float32Array|null} rawAudioBuffer - 原始音频数据
 */

/**
 * ArticulationType - 起音状态枚举
 * @typedef {'attack'|'sustain'|'release'|'silence'} ArticulationType
 */

/**
 * SmoothingMethod - 平滑算法类型
 * @typedef {'kalman'|'ema'|'median'|'none'} SmoothingMethod
 */
```

### 2.2 配置类型

```javascript
/**
 * ExpressiveFeaturesConfig - 表现力特征提取配置
 * @typedef {Object} ExpressiveFeaturesConfig
 *
 * @property {number} sampleRate - 采样率 (默认 44100)
 * @property {SmoothingConfig} smoothing - 平滑配置
 * @property {OnsetConfig} onset - 起音检测配置
 * @property {SpectralConfig} spectral - 频域分析配置
 */

/**
 * SmoothingConfig - 平滑算法配置
 * @typedef {Object} SmoothingConfig
 *
 * @property {Object} cents - 音分平滑
 * @property {SmoothingMethod} cents.method - 平滑方法
 * @property {number} [cents.Q] - Kalman 过程噪声
 * @property {number} [cents.R] - Kalman 测量噪声
 *
 * @property {Object} volume - 音量平滑
 * @property {SmoothingMethod} volume.method
 * @property {number} [volume.alpha] - EMA 平滑系数
 *
 * @property {Object} brightness - 亮度平滑
 * @property {SmoothingMethod} brightness.method
 * @property {number} [brightness.alpha]
 *
 * @property {Object} breathiness - 气声度平滑
 * @property {SmoothingMethod} breathiness.method
 * @property {number} [breathiness.alpha]
 */

/**
 * OnsetConfig - 起音检测配置
 * @typedef {Object} OnsetConfig
 *
 * @property {number} energyThreshold - 能量阈值 (dB)
 * @property {number} timeWindow - 检测窗口 (帧数)
 * @property {number} minSilenceDuration - 最小静音时长 (ms)
 */

/**
 * SpectralConfig - 频域分析配置
 * @typedef {Object} SpectralConfig
 *
 * @property {number} fftSize - FFT 窗口大小
 * @property {number} minFrequency - 最低分析频率 (Hz)
 * @property {number} maxFrequency - 最高分析频率 (Hz)
 */
```

---

## 3. 模块 API 详细设计

### 3.1 AudioUtils (音频工具库)

**文件**: `js/utils/audio-utils.js`
**职责**: 提供纯函数的音频计算工具

```javascript
/**
 * 音频工具库 - 纯函数工具集合
 * @module AudioUtils
 */

/**
 * 计算音频缓冲区的 RMS (均方根) 音量
 * @param {Float32Array} buffer - 音频数据缓冲区
 * @returns {number} RMS 值 (0-1 范围)
 * @throws {TypeError} 如果 buffer 不是 Float32Array
 * @throws {RangeError} 如果 buffer 长度为 0
 * @example
 * const rms = calculateRMS(audioBuffer);
 * console.log(`音量: ${rms.toFixed(3)}`);
 */
function calculateRMS(buffer) {
  // 实现
}

/**
 * 将 RMS 线性值转换为 dB
 * @param {number} linearValue - 线性音量值 (0-1)
 * @returns {number} dB 值 (-60 ~ 0), 静音返回 -60
 * @example
 * const db = linearToDb(0.5); // -6.02 dB
 */
function linearToDb(linearValue) {
  // 实现
}

/**
 * 将 dB 值转换为线性音量
 * @param {number} db - dB 值 (-60 ~ 0)
 * @returns {number} 线性音量 (0-1)
 * @example
 * const linear = dBToLinear(-12); // 0.251
 */
function dBToLinear(db) {
  // 实现
}

/**
 * 计算两个频率之间的音分差
 * @param {number} frequency - 当前频率 (Hz)
 * @param {number} targetFrequency - 目标频率 (Hz)
 * @returns {number} 音分差 (-50 ~ +50), 超出范围会截断
 * @throws {RangeError} 如果频率 <= 0
 * @example
 * const cents = calculateCents(440, 430); // -39.8 cents
 */
function calculateCents(frequency, targetFrequency) {
  // 实现: 1200 * log2(frequency / targetFrequency)
}

/**
 * 将频率转换为最接近的音符名称和八度
 * @param {number} frequency - 频率 (Hz)
 * @returns {{note: string, octave: number, targetFrequency: number}} 音符信息
 * @example
 * const info = frequencyToNote(440);
 * // { note: "A", octave: 4, targetFrequency: 440.0 }
 */
function frequencyToNote(frequency) {
  // 实现
}

/**
 * 对音频缓冲区执行 FFT 分析
 * @param {Float32Array} buffer - 音频数据
 * @param {number} fftSize - FFT 窗口大小 (2的幂次)
 * @returns {Float32Array} 频谱幅度数组 (长度为 fftSize/2)
 * @throws {TypeError} 如果 fftSize 不是 2 的幂次
 * @example
 * const spectrum = performFFT(audioBuffer, 2048);
 */
function performFFT(buffer, fftSize) {
  // 使用 Web Audio API 的 AnalyserNode 或第三方 FFT 库
}

/**
 * 归一化频谱数组到 0-1 范围
 * @param {Float32Array} spectrum - 频谱数据
 * @returns {Float32Array} 归一化后的频谱
 */
function normalizeSpectrum(spectrum) {
  // 实现
}

/**
 * 计算数组的方差
 * @param {number[]} values - 数值数组
 * @returns {number} 方差值
 */
function calculateVariance(values) {
  // 实现
}

/**
 * 计算数组的几何平均值
 * @param {number[]} values - 数值数组 (必须 > 0)
 * @returns {number} 几何平均值
 */
function geometricMean(values) {
  // 实现
}

/**
 * 将数值限制在指定范围内
 * @param {number} value - 输入值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制后的值
 */
function clamp(value, min, max) {
  // 实现
}
```

---

### 3.2 SmoothingFilters (平滑算法模块)

**文件**: `js/features/smoothing-filters.js`
**职责**: 提供各种信号平滑算法

```javascript
/**
 * 平滑算法模块
 * @module SmoothingFilters
 */

// ==================== Kalman Filter ====================

/**
 * Kalman Filter 类 - 一维卡尔曼滤波器
 * @class KalmanFilter
 * @example
 * const filter = new KalmanFilter({ Q: 0.001, R: 0.1 });
 * const smoothed = filter.update(rawValue);
 */
class KalmanFilter {
  /**
   * 构造函数
   * @param {Object} config - 配置参数
   * @param {number} [config.Q=0.001] - 过程噪声协方差 (越小越信任模型)
   * @param {number} [config.R=0.1] - 测量噪声协方差 (越小越信任测量)
   * @param {number} [config.initialEstimate=0] - 初始估计值
   * @param {number} [config.initialError=1] - 初始误差协方差
   */
  constructor(config = {}) {
    this.Q = config.Q || 0.001;  // 过程噪声
    this.R = config.R || 0.1;    // 测量噪声
    this.x = config.initialEstimate || 0;  // 状态估计
    this.P = config.initialError || 1;     // 误差协方差
  }

  /**
   * 更新滤波器并返回平滑后的值
   * @param {number} measurement - 新的测量值
   * @returns {number} 平滑后的估计值
   * @example
   * const smoothedCents = kalmanFilter.update(rawCents);
   */
  update(measurement) {
    // 预测步骤 (Prediction)
    // x_pred = x
    // P_pred = P + Q

    // 更新步骤 (Update)
    // K = P_pred / (P_pred + R)  // Kalman Gain
    // x = x_pred + K * (measurement - x_pred)
    // P = (1 - K) * P_pred
  }

  /**
   * 重置滤波器状态
   * @param {number} [initialValue=0] - 重置的初始值
   */
  reset(initialValue = 0) {
    this.x = initialValue;
    this.P = 1;
  }

  /**
   * 获取当前估计值 (不更新)
   * @returns {number} 当前状态估计
   */
  getValue() {
    return this.x;
  }
}

// ==================== EMA Filter ====================

/**
 * EMA (Exponential Moving Average) 滤波器类
 * @class EMAFilter
 * @example
 * const filter = new EMAFilter({ alpha: 0.3 });
 * const smoothed = filter.update(rawValue);
 */
class EMAFilter {
  /**
   * 构造函数
   * @param {Object} config - 配置参数
   * @param {number} [config.alpha=0.3] - 平滑系数 (0-1, 越大响应越快)
   * @param {number} [config.initialValue=0] - 初始值
   */
  constructor(config = {}) {
    this.alpha = config.alpha || 0.3;
    this.value = config.initialValue || 0;
    this.initialized = false;
  }

  /**
   * 更新滤波器并返回平滑后的值
   * @param {number} newValue - 新的输入值
   * @returns {number} 平滑后的值
   * @example
   * const smoothedVolume = emaFilter.update(rawVolume);
   */
  update(newValue) {
    if (!this.initialized) {
      this.value = newValue;
      this.initialized = true;
      return this.value;
    }

    // EMA 公式: S_t = α * Y_t + (1 - α) * S_{t-1}
    this.value = this.alpha * newValue + (1 - this.alpha) * this.value;
    return this.value;
  }

  /**
   * 重置滤波器
   * @param {number} [initialValue=0] - 重置的初始值
   */
  reset(initialValue = 0) {
    this.value = initialValue;
    this.initialized = false;
  }

  /**
   * 获取当前值 (不更新)
   * @returns {number} 当前平滑值
   */
  getValue() {
    return this.value;
  }
}

// ==================== Median Filter ====================

/**
 * 中值滤波器类
 * @class MedianFilter
 * @example
 * const filter = new MedianFilter({ windowSize: 5 });
 * const smoothed = filter.update(rawValue);
 */
class MedianFilter {
  /**
   * 构造函数
   * @param {Object} config - 配置参数
   * @param {number} [config.windowSize=5] - 滑动窗口大小 (必须为奇数)
   */
  constructor(config = {}) {
    this.windowSize = config.windowSize || 5;
    if (this.windowSize % 2 === 0) {
      throw new Error('MedianFilter windowSize 必须为奇数');
    }
    this.buffer = [];
  }

  /**
   * 更新滤波器并返回中值
   * @param {number} newValue - 新的输入值
   * @returns {number} 窗口内的中值
   */
  update(newValue) {
    this.buffer.push(newValue);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    // 返回中值
    const sorted = [...this.buffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  /**
   * 重置滤波器
   */
  reset() {
    this.buffer = [];
  }

  /**
   * 获取当前缓冲区大小
   * @returns {number} 缓冲区长度
   */
  getBufferSize() {
    return this.buffer.length;
  }
}
```

---

### 3.3 OnsetDetector (起音检测模块)

**文件**: `js/features/onset-detector.js`
**职责**: 检测 attack/sustain/release/silence 状态

```javascript
/**
 * 起音检测模块
 * @module OnsetDetector
 */

/**
 * OnsetDetector 类 - 起音状态检测器
 * @class OnsetDetector
 */
class OnsetDetector {
  /**
   * 构造函数
   * @param {OnsetConfig} config - 配置参数
   */
  constructor(config = {}) {
    this.energyThreshold = config.energyThreshold || 6;  // dB
    this.timeWindow = config.timeWindow || 3;            // 帧数
    this.minSilenceDuration = config.minSilenceDuration || 100;  // ms

    // 内部状态
    this.volumeHistory = [];  // 最近 N 帧的音量历史
    this.currentState = 'silence';
    this.lastAttackTime = 0;
    this.lastSoundTime = 0;
  }

  /**
   * 更新检测器状态并返回当前起音类型
   * @param {number} volumeDb - 当前帧音量 (dB)
   * @param {number} timestamp - 当前时间戳 (ms)
   * @returns {ArticulationType} 起音状态
   * @example
   * const articulation = onsetDetector.update(-12.5, Date.now());
   * if (articulation === 'attack') {
   *   console.log('检测到新音符起音!');
   * }
   */
  update(volumeDb, timestamp) {
    // 更新音量历史
    this.volumeHistory.push(volumeDb);
    if (this.volumeHistory.length > this.timeWindow) {
      this.volumeHistory.shift();
    }

    // 检测静音
    const isSilent = volumeDb < -40;  // -40dB 作为静音阈值

    if (isSilent) {
      const silenceDuration = timestamp - this.lastSoundTime;
      if (silenceDuration > this.minSilenceDuration) {
        this.currentState = 'silence';
        return 'silence';
      }
    } else {
      this.lastSoundTime = timestamp;
    }

    // 检测 Attack (能量突增)
    if (this._detectAttack()) {
      this.currentState = 'attack';
      this.lastAttackTime = timestamp;
      return 'attack';
    }

    // 检测 Sustain (持续)
    if (this.currentState === 'attack') {
      const timeSinceAttack = timestamp - this.lastAttackTime;
      if (timeSinceAttack > 50) {  // Attack 持续 > 50ms 后转为 Sustain
        this.currentState = 'sustain';
      }
    }

    // 检测 Release (能量衰减)
    if (this._detectRelease() && this.currentState === 'sustain') {
      this.currentState = 'release';
      return 'release';
    }

    return this.currentState;
  }

  /**
   * 检测能量突增 (Attack)
   * @private
   * @returns {boolean} 是否检测到 Attack
   */
  _detectAttack() {
    if (this.volumeHistory.length < this.timeWindow) {
      return false;
    }

    // 计算最近帧的平均能量增量
    const recentAvg = this.volumeHistory[this.volumeHistory.length - 1];
    const previousAvg = this.volumeHistory[0];
    const energyIncrease = recentAvg - previousAvg;

    return energyIncrease > this.energyThreshold;
  }

  /**
   * 检测能量衰减 (Release)
   * @private
   * @returns {boolean} 是否检测到 Release
   */
  _detectRelease() {
    if (this.volumeHistory.length < this.timeWindow) {
      return false;
    }

    const recentAvg = this.volumeHistory[this.volumeHistory.length - 1];
    const previousAvg = this.volumeHistory[0];
    const energyDecrease = previousAvg - recentAvg;

    return energyDecrease > (this.energyThreshold / 2);  // Release 阈值更低
  }

  /**
   * 重置检测器状态
   */
  reset() {
    this.volumeHistory = [];
    this.currentState = 'silence';
    this.lastAttackTime = 0;
    this.lastSoundTime = 0;
  }

  /**
   * 获取当前状态
   * @returns {ArticulationType} 当前起音状态
   */
  getState() {
    return this.currentState;
  }
}
```

---

### 3.4 SpectralFeatures (频域特征模块)

**文件**: `js/features/spectral-features.js`
**职责**: 提取频谱质心、亮度、平坦度等特征

```javascript
/**
 * 频域特征提取模块
 * @module SpectralFeatures
 */

/**
 * SpectralFeatures 类 - 频域特征提取器
 * @class SpectralFeatures
 */
class SpectralFeatures {
  /**
   * 构造函数
   * @param {SpectralConfig} config - 配置参数
   */
  constructor(config = {}) {
    this.fftSize = config.fftSize || 2048;
    this.sampleRate = config.sampleRate || 44100;
    this.minFrequency = config.minFrequency || 80;
    this.maxFrequency = config.maxFrequency || 8000;

    // 创建 AnalyserNode (Web Audio API)
    this.analyser = null;  // 外部传入或内部创建
  }

  /**
   * 设置 Web Audio API 的 AnalyserNode
   * @param {AnalyserNode} analyserNode - Web Audio AnalyserNode
   */
  setAnalyser(analyserNode) {
    this.analyser = analyserNode;
    this.analyser.fftSize = this.fftSize;
  }

  /**
   * 从音频缓冲区提取所有频域特征
   * @param {Float32Array} audioBuffer - 音频数据
   * @returns {Object} 频域特征对象
   * @returns {number} return.spectralCentroid - 频谱质心 (Hz)
   * @returns {number} return.brightness - 亮度 (0-1)
   * @returns {number} return.breathiness - 气声度 (0-1)
   * @returns {number} return.formant - 共振峰估计 (Hz)
   * @example
   * const features = spectralFeatures.extract(audioBuffer);
   * console.log(`亮度: ${features.brightness.toFixed(2)}`);
   */
  extract(audioBuffer) {
    // 获取频谱数据
    const spectrum = this._getSpectrum(audioBuffer);

    // 计算各个特征
    const spectralCentroid = this._calculateCentroid(spectrum);
    const brightness = this._calculateBrightness(spectralCentroid);
    const breathiness = this._calculateFlatness(spectrum);
    const formant = this._estimateFormant(spectrum);

    return {
      spectralCentroid,
      brightness,
      breathiness,
      formant
    };
  }

  /**
   * 获取频谱数据
   * @private
   * @param {Float32Array} audioBuffer - 音频数据
   * @returns {Float32Array} 频谱幅度数组
   */
  _getSpectrum(audioBuffer) {
    // 如果有 AnalyserNode，直接使用
    if (this.analyser) {
      const spectrum = new Float32Array(this.analyser.frequencyBinCount);
      this.analyser.getFloatFrequencyData(spectrum);
      return spectrum;
    }

    // 否则使用 AudioUtils.performFFT
    return AudioUtils.performFFT(audioBuffer, this.fftSize);
  }

  /**
   * 计算频谱质心 (Spectral Centroid)
   * @private
   * @param {Float32Array} spectrum - 频谱数据
   * @returns {number} 频谱质心 (Hz)
   */
  _calculateCentroid(spectrum) {
    let weightedSum = 0;
    let magnitudeSum = 0;

    const binWidth = this.sampleRate / this.fftSize;

    for (let i = 0; i < spectrum.length; i++) {
      const frequency = i * binWidth;
      const magnitude = Math.abs(spectrum[i]);

      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  /**
   * 计算亮度 (Brightness) - 归一化的频谱质心
   * @private
   * @param {number} centroid - 频谱质心 (Hz)
   * @returns {number} 亮度 (0-1)
   */
  _calculateBrightness(centroid) {
    const nyquist = this.sampleRate / 2;
    return Math.min(1, Math.max(0, centroid / nyquist));
  }

  /**
   * 计算频谱平坦度 (Spectral Flatness) - 噪声度量
   * @private
   * @param {Float32Array} spectrum - 频谱数据
   * @returns {number} 平坦度 (0-1)
   */
  _calculateFlatness(spectrum) {
    const magnitudes = Array.from(spectrum).map(v => Math.abs(v) + 1e-10);

    const geometricMean = AudioUtils.geometricMean(magnitudes);
    const arithmeticMean = magnitudes.reduce((a, b) => a + b) / magnitudes.length;

    return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
  }

  /**
   * 估计第一共振峰 (Formant F1) - 简化版
   * @private
   * @param {Float32Array} spectrum - 频谱数据
   * @returns {number} 共振峰估计 (Hz)
   */
  _estimateFormant(spectrum) {
    // Phase 2 简化版: 使用 500-1500Hz 范围内的峰值
    const binWidth = this.sampleRate / this.fftSize;
    const startBin = Math.floor(500 / binWidth);
    const endBin = Math.floor(1500 / binWidth);

    let maxMagnitude = -Infinity;
    let maxBin = startBin;

    for (let i = startBin; i < endBin; i++) {
      if (spectrum[i] > maxMagnitude) {
        maxMagnitude = spectrum[i];
        maxBin = i;
      }
    }

    return maxBin * binWidth;
  }
}
```

---

### 3.5 ExpressiveFeatures (主模块)

**文件**: `js/expressive-features.js`
**职责**: 统一入口，协调所有特征提取模块

```javascript
/**
 * 表现力特征提取主模块
 * @module ExpressiveFeatures
 */

/**
 * ExpressiveFeatures 类 - 表现力特征提取器 (统一入口)
 * @class ExpressiveFeatures
 */
class ExpressiveFeatures {
  /**
   * 构造函数
   * @param {ExpressiveFeaturesConfig} config - 配置参数
   */
  constructor(config = {}) {
    this.config = config;
    this.sampleRate = config.sampleRate || 44100;

    // 初始化子模块
    this._initializeModules();
  }

  /**
   * 初始化所有子模块
   * @private
   */
  _initializeModules() {
    // 平滑滤波器
    this.filters = {
      cents: this._createFilter(this.config.smoothing.cents),
      volume: this._createFilter(this.config.smoothing.volume),
      brightness: this._createFilter(this.config.smoothing.brightness),
      breathiness: this._createFilter(this.config.smoothing.breathiness)
    };

    // 起音检测器
    this.onsetDetector = new OnsetDetector(this.config.onset);

    // 频域特征提取器
    this.spectralFeatures = new SpectralFeatures(this.config.spectral);
  }

  /**
   * 创建平滑滤波器
   * @private
   * @param {Object} config - 滤波器配置
   * @returns {KalmanFilter|EMAFilter|null} 滤波器实例
   */
  _createFilter(config) {
    switch (config.method) {
      case 'kalman':
        return new KalmanFilter({ Q: config.Q, R: config.R });
      case 'ema':
        return new EMAFilter({ alpha: config.alpha });
      case 'median':
        return new MedianFilter({ windowSize: config.windowSize || 5 });
      case 'none':
        return null;
      default:
        throw new Error(`未知的平滑方法: ${config.method}`);
    }
  }

  /**
   * 从原始数据提取完整的 PitchFrame
   * @param {Object} basePitchInfo - 基础音高信息 (来自 Phase 1)
   * @param {Float32Array} audioBuffer - 原始音频缓冲区
   * @param {number} timestamp - 时间戳 (ms)
   * @returns {PitchFrame} 完整的音高和表现力数据帧
   * @example
   * const pitchFrame = expressiveFeatures.extractFeatures({
   *   frequency: 440,
   *   note: "A",
   *   octave: 4,
   *   confidence: 0.95
   * }, audioBuffer, Date.now());
   */
  extractFeatures(basePitchInfo, audioBuffer, timestamp) {
    // 1. 计算动态特征 (音量)
    const volumeLinear = AudioUtils.calculateRMS(audioBuffer);
    const volumeDb = AudioUtils.linearToDb(volumeLinear);
    const smoothedVolumeDb = this.filters.volume
      ? this.filters.volume.update(volumeDb)
      : volumeDb;

    // 2. 计算音高精度 (音分)
    const { targetFrequency } = AudioUtils.frequencyToNote(basePitchInfo.frequency);
    const rawCents = AudioUtils.calculateCents(basePitchInfo.frequency, targetFrequency);
    const smoothedCents = this.filters.cents
      ? this.filters.cents.update(rawCents)
      : rawCents;

    // 3. 检测起音状态
    const articulation = this.onsetDetector.update(smoothedVolumeDb, timestamp);

    // 4. 提取频域特征
    const spectral = this.spectralFeatures.extract(audioBuffer);
    const smoothedBrightness = this.filters.brightness
      ? this.filters.brightness.update(spectral.brightness)
      : spectral.brightness;
    const smoothedBreathiness = this.filters.breathiness
      ? this.filters.breathiness.update(spectral.breathiness)
      : spectral.breathiness;

    // 5. 组装完整的 PitchFrame
    return {
      timestamp,

      // Phase 1 基础数据
      frequency: basePitchInfo.frequency,
      note: basePitchInfo.note,
      octave: basePitchInfo.octave,
      confidence: basePitchInfo.confidence,

      // Phase 2 动态特征
      volumeDb: smoothedVolumeDb,
      volumeLinear,

      // Phase 2 音高精度
      cents: smoothedCents,
      pitchStability: 0,  // TODO: 未来实现

      // Phase 2 时域特征
      articulation,
      attackTime: 0,  // TODO: 未来实现

      // Phase 2 频域特征
      spectralCentroid: spectral.spectralCentroid,
      brightness: smoothedBrightness,
      formant: spectral.formant,
      breathiness: smoothedBreathiness,

      // 原始数据 (可选)
      rawAudioBuffer: audioBuffer
    };
  }

  /**
   * 重置所有滤波器和检测器状态
   */
  reset() {
    Object.values(this.filters).forEach(filter => {
      if (filter) filter.reset();
    });
    this.onsetDetector.reset();
  }

  /**
   * 设置 AnalyserNode (用于频域分析)
   * @param {AnalyserNode} analyserNode - Web Audio AnalyserNode
   */
  setAnalyser(analyserNode) {
    this.spectralFeatures.setAnalyser(analyserNode);
  }
}
```

---

## 4. 错误处理策略

### 4.1 输入验证

所有公共 API 必须验证输入参数:

```javascript
function calculateRMS(buffer) {
  if (!(buffer instanceof Float32Array)) {
    throw new TypeError('buffer 必须是 Float32Array 类型');
  }
  if (buffer.length === 0) {
    throw new RangeError('buffer 长度不能为 0');
  }
  // ... 实现
}
```

### 4.2 优雅降级

遇到非关键错误时，应优雅降级而非崩溃:

```javascript
_calculateBrightness(centroid) {
  if (centroid < 0 || !isFinite(centroid)) {
    console.warn('[SpectralFeatures] 无效的 centroid 值，返回默认值 0.5');
    return 0.5;  // 默认中等亮度
  }
  // ... 正常计算
}
```

### 4.3 日志分级

```javascript
// ERROR: 影响核心功能的错误
console.error('[ExpressiveFeatures] 无法初始化特征提取器:', error);

// WARN: 非关键错误，已降级处理
console.warn('[SpectralFeatures] FFT 失败，使用上一帧数据');

// INFO: 重要状态变化
console.info('[OnsetDetector] 检测到 Attack，切换到新音符');

// DEBUG: 调试信息 (生产环境关闭)
if (DEBUG_MODE) {
  console.debug('[KalmanFilter] 更新: measurement=12.5, estimate=11.8');
}
```

---

## 5. 性能优化建议

### 5.1 对象池 (Object Pooling)

避免频繁创建 PitchFrame 对象:

```javascript
class PitchFramePool {
  constructor(size = 10) {
    this.pool = [];
    for (let i = 0; i < size; i++) {
      this.pool.push(this._createEmptyFrame());
    }
    this.index = 0;
  }

  acquire() {
    const frame = this.pool[this.index];
    this.index = (this.index + 1) % this.pool.length;
    return frame;
  }

  _createEmptyFrame() {
    return { /* PitchFrame 结构 */ };
  }
}
```

### 5.2 避免重复计算

缓存不变的计算结果:

```javascript
class SpectralFeatures {
  constructor(config) {
    // 预计算频率 bin 宽度
    this.binWidth = config.sampleRate / config.fftSize;
    this.nyquist = config.sampleRate / 2;
  }
}
```

### 5.3 使用 TypedArray

优先使用 Float32Array 而非普通数组:

```javascript
// 好
const buffer = new Float32Array(2048);

// 差 (性能较低)
const buffer = new Array(2048).fill(0);
```

---

## 6. 单元测试接口

所有模块都需要提供测试钩子:

```javascript
class KalmanFilter {
  // ... 公共 API

  // 测试专用方法 (仅在测试环境暴露)
  __test_getState() {
    return {
      x: this.x,
      P: this.P,
      Q: this.Q,
      R: this.R
    };
  }
}
```

---

## 7. 使用示例 (Integration Example)

```javascript
// 在 main.js 中集成

import ExpressiveFeatures from './expressive-features.js';
import { DEFAULT_CONFIG } from './audio-config.js';

class KazooApp {
  constructor() {
    // 初始化表现力特征提取器
    this.expressiveFeatures = new ExpressiveFeatures(DEFAULT_CONFIG.expressiveFeatures);
  }

  async start() {
    // ... AudioIO 初始化

    // 设置 AnalyserNode
    const analyser = this.audioIO.audioContext.createAnalyser();
    this.expressiveFeatures.setAnalyser(analyser);

    // 注册回调
    this.audioIO.onPitchDetected((pitchInfo) => {
      // 提取完整特征
      const pitchFrame = this.expressiveFeatures.extractFeatures(
        pitchInfo,
        pitchInfo.rawAudioBuffer,
        Date.now()
      );

      // 传递给合成引擎
      this.currentEngine.processPitchFrame(pitchFrame);

      // 更新 UI
      this.updateUI(pitchFrame);
    });
  }

  updateUI(pitchFrame) {
    this.ui.currentNote.textContent = `${pitchFrame.note}${pitchFrame.octave}`;
    this.ui.cents.textContent = `${pitchFrame.cents > 0 ? '+' : ''}${pitchFrame.cents.toFixed(0)} cents`;
    this.ui.brightness.textContent = `${(pitchFrame.brightness * 100).toFixed(0)}%`;
    this.ui.volumeDb.textContent = `${pitchFrame.volumeDb.toFixed(1)} dB`;
    this.ui.articulation.textContent = pitchFrame.articulation;
  }
}
```

---

## 8. 配置文件更新

需要在 `audio-config.js` 中添加 Phase 2 配置:

```javascript
export const AUDIO_CONFIG = {
  // Phase 1 配置 (保持不变)
  SAMPLE_RATE: 44100,
  // ...

  // Phase 2 新增配置
  EXPRESSIVE_FEATURES: {
    sampleRate: 44100,

    smoothing: {
      cents: { method: 'kalman', Q: 0.001, R: 0.1 },
      volume: { method: 'ema', alpha: 0.3 },
      brightness: { method: 'ema', alpha: 0.2 },
      breathiness: { method: 'ema', alpha: 0.25 }
    },

    onset: {
      energyThreshold: 6,
      timeWindow: 3,
      minSilenceDuration: 100
    },

    spectral: {
      fftSize: 2048,
      minFrequency: 80,
      maxFrequency: 8000
    }
  }
};
```

---

**文档状态**: ✅ Phase 2.2 完成
**下一阶段**: Phase 2.3 - 实现平滑算法模块 + 单元测试

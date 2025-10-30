/**
 * 音频工具库 - Audio Utilities
 * Phase 2: 通用音频计算函数
 *
 * 提供纯函数的音频处理工具，支持 Node.js 和浏览器环境
 *
 * @module AudioUtils
 * @author Ziming Wang & Claude
 * @date 2025-10-30
 */

// ==================== 音量计算 ====================

/**
 * 计算音频缓冲区的 RMS (均方根) 音量
 * @param {Float32Array} buffer - 音频数据缓冲区
 * @returns {number} RMS 值 (0-1 范围)
 * @throws {TypeError} 如果 buffer 不是 Float32Array
 * @throws {RangeError} 如果 buffer 长度为 0
 * @example
 * const rms = AudioUtils.calculateRMS(audioBuffer);
 * console.log(`音量: ${rms.toFixed(3)}`);
 */
export function calculateRMS(buffer) {
  if (!(buffer instanceof Float32Array)) {
    throw new TypeError('buffer 必须是 Float32Array 类型');
  }
  if (buffer.length === 0) {
    throw new RangeError('buffer 长度不能为 0');
  }

  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }

  return Math.sqrt(sum / buffer.length);
}

/**
 * 将 RMS 线性值转换为 dB
 * @param {number} linearValue - 线性音量值 (0-1)
 * @returns {number} dB 值 (-60 ~ 0), 静音返回 -60
 * @example
 * const db = AudioUtils.linearToDb(0.5); // -6.02 dB
 */
export function linearToDb(linearValue) {
  if (linearValue <= 0) {
    return -60;  // 静音阈值
  }
  return 20 * Math.log10(linearValue);
}

/**
 * 将 dB 值转换为线性音量
 * @param {number} db - dB 值 (-60 ~ 0)
 * @returns {number} 线性音量 (0-1)
 * @example
 * const linear = AudioUtils.dBToLinear(-12); // 0.251
 */
export function dBToLinear(db) {
  return Math.pow(10, db / 20);
}

// ==================== 音高计算 ====================

/**
 * 计算两个频率之间的音分差
 * @param {number} frequency - 当前频率 (Hz)
 * @param {number} targetFrequency - 目标频率 (Hz)
 * @returns {number} 音分差 (-50 ~ +50), 超出范围会截断
 * @throws {RangeError} 如果频率 <= 0
 * @example
 * const cents = AudioUtils.calculateCents(440, 430); // -39.8 cents
 */
export function calculateCents(frequency, targetFrequency) {
  if (frequency <= 0 || targetFrequency <= 0) {
    throw new RangeError('频率必须大于 0');
  }

  const cents = 1200 * Math.log2(frequency / targetFrequency);

  // 截断到 ±50 cents
  return Math.max(-50, Math.min(50, cents));
}

/**
 * 将频率转换为最接近的音符名称和八度
 * @param {number} frequency - 频率 (Hz)
 * @returns {{note: string, octave: number, targetFrequency: number}} 音符信息
 * @example
 * const info = AudioUtils.frequencyToNote(440);
 * // { note: "A", octave: 4, targetFrequency: 440.0 }
 */
export function frequencyToNote(frequency) {
  if (frequency <= 0) {
    return { note: 'N/A', octave: 0, targetFrequency: 0 };
  }

  // A4 = 440 Hz 作为参考
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75); // C0 频率

  // 计算相对于 C0 的半音数
  const halfSteps = Math.round(12 * Math.log2(frequency / C0));
  const octave = Math.floor(halfSteps / 12);
  const noteIndex = halfSteps % 12;

  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const note = noteNames[noteIndex];

  // 计算目标频率
  const targetFrequency = C0 * Math.pow(2, halfSteps / 12);

  return { note, octave, targetFrequency };
}

// ==================== FFT 和频谱分析 ====================

/**
 * FFT 适配器接口 - 用于在不同环境中提供 FFT 实现
 * @typedef {Object} FFTAdapter
 * @property {function(Float32Array, number): Float32Array} performFFT - 执行 FFT
 */

/**
 * 简单的 Radix-2 FFT 实现 (仅用于 Node.js 测试环境)
 * 注意: 这是一个简化实现，生产环境应使用 Web Audio API 的 AnalyserNode
 *
 * @param {Float32Array} buffer - 时域信号
 * @param {number} fftSize - FFT 大小 (必须是 2 的幂次)
 * @returns {Float32Array} 频谱幅度数组 (长度为 fftSize/2)
 * @throws {TypeError} 如果 fftSize 不是 2 的幂次
 */
export function performSimpleFFT(buffer, fftSize) {
  // 验证 fftSize 是 2 的幂次
  if ((fftSize & (fftSize - 1)) !== 0) {
    throw new TypeError('fftSize 必须是 2 的幂次');
  }

  // 如果 buffer 长度不足，用零填充
  const paddedBuffer = new Float32Array(fftSize);
  const copyLength = Math.min(buffer.length, fftSize);
  paddedBuffer.set(buffer.subarray(0, copyLength));

  // 执行 FFT (使用 Cooley-Tukey 算法)
  const complex = _fftRadix2(paddedBuffer);

  // 计算幅度谱
  const magnitude = new Float32Array(fftSize / 2);
  for (let i = 0; i < fftSize / 2; i++) {
    const real = complex[i * 2];
    const imag = complex[i * 2 + 1];
    magnitude[i] = Math.sqrt(real * real + imag * imag);
  }

  return magnitude;
}

/**
 * Cooley-Tukey FFT 算法 (Radix-2)
 * @private
 * @param {Float32Array} x - 输入信号
 * @returns {Float32Array} 复数数组 [real0, imag0, real1, imag1, ...]
 */
function _fftRadix2(x) {
  const N = x.length;
  const complex = new Float32Array(N * 2);

  // 将实数转为复数
  for (let i = 0; i < N; i++) {
    complex[i * 2] = x[i];      // 实部
    complex[i * 2 + 1] = 0;     // 虚部
  }

  // Bit-reversal permutation
  for (let i = 0; i < N; i++) {
    const j = _reverseBits(i, Math.log2(N));
    if (j > i) {
      // 交换实部
      [complex[i * 2], complex[j * 2]] = [complex[j * 2], complex[i * 2]];
      // 交换虚部
      [complex[i * 2 + 1], complex[j * 2 + 1]] = [complex[j * 2 + 1], complex[i * 2 + 1]];
    }
  }

  // Cooley-Tukey decimation-in-time radix-2 FFT
  for (let size = 2; size <= N; size *= 2) {
    const halfSize = size / 2;
    const step = N / size;

    for (let i = 0; i < N; i += size) {
      for (let j = i, k = 0; j < i + halfSize; j++, k += step) {
        const angle = -2 * Math.PI * k / N;
        const tpre = Math.cos(angle) * complex[(j + halfSize) * 2] - Math.sin(angle) * complex[(j + halfSize) * 2 + 1];
        const tpim = Math.sin(angle) * complex[(j + halfSize) * 2] + Math.cos(angle) * complex[(j + halfSize) * 2 + 1];

        complex[(j + halfSize) * 2] = complex[j * 2] - tpre;
        complex[(j + halfSize) * 2 + 1] = complex[j * 2 + 1] - tpim;
        complex[j * 2] += tpre;
        complex[j * 2 + 1] += tpim;
      }
    }
  }

  return complex;
}

/**
 * Bit reversal
 * @private
 */
function _reverseBits(x, n) {
  let result = 0;
  for (let i = 0; i < n; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}

/**
 * 归一化频谱数组到 0-1 范围
 * @param {Float32Array} spectrum - 频谱数据
 * @returns {Float32Array} 归一化后的频谱
 */
export function normalizeSpectrum(spectrum) {
  const max = Math.max(...spectrum);
  if (max === 0) {
    return new Float32Array(spectrum.length);
  }

  const normalized = new Float32Array(spectrum.length);
  for (let i = 0; i < spectrum.length; i++) {
    normalized[i] = spectrum[i] / max;
  }

  return normalized;
}

// ==================== 统计函数 ====================

/**
 * 计算数组的方差
 * @param {number[]} values - 数值数组
 * @returns {number} 方差值
 */
export function calculateVariance(values) {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(x => Math.pow(x - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * 计算数组的几何平均值
 * @param {number[]} values - 数值数组 (必须 > 0)
 * @returns {number} 几何平均值
 */
export function geometricMean(values) {
  if (values.length === 0) {
    return 0;
  }

  // 防止数值下溢，使用对数
  const logSum = values.reduce((sum, val) => sum + Math.log(Math.max(val, 1e-10)), 0);
  return Math.exp(logSum / values.length);
}

/**
 * 将数值限制在指定范围内
 * @param {number} value - 输入值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制后的值
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// ==================== 导出 ====================

export default {
  // 音量
  calculateRMS,
  linearToDb,
  dBToLinear,

  // 音高
  calculateCents,
  frequencyToNote,

  // FFT
  performSimpleFFT,
  normalizeSpectrum,

  // 统计
  calculateVariance,
  geometricMean,
  clamp
};

/**
 * SpectralFeatures - 频域特征提取模块
 *
 * 提取频谱质心、亮度、气声度、共振峰等特征。
 *
 * 技术方案:
 * - 浏览器环境: 使用 AnalyserNode.getFloatFrequencyData() (原生 FFT)
 * - Node.js 测试: 降级到 AudioUtils.performSimpleFFT() (纯 JS FFT)
 * - 性能优化: 支持 fftInterval 配置 (每 N 帧运行一次 FFT)
 *
 * @module features/spectral-features
 */

import * as AudioUtils from '../utils/audio-utils.js';

/**
 * SpectralFeatures 类 - 频域特征提取器
 *
 * @class
 */
export class SpectralFeatures {
  /**
   * 构造函数
   *
   * @param {Object} [config={}] - 配置参数
   * @param {AudioContext} [config.audioContext] - Web Audio API 上下文 (可选)
   * @param {AudioNode} [config.sourceNode] - 音频源节点 (用于连接 AnalyserNode)
   * @param {number} [config.fftSize=2048] - FFT 窗口大小 (2的幂次)
   * @param {number} [config.sampleRate=44100] - 采样率
   * @param {number} [config.minFrequency=80] - 最低分析频率 (Hz)
   * @param {number} [config.maxFrequency=8000] - 最高分析频率 (Hz)
   * @param {number} [config.fftInterval=2] - FFT 执行间隔 (每 N 帧运行一次)
   */
  constructor(config = {}) {
    this.audioContext = config.audioContext || null;
    this.fftSize = config.fftSize || 2048;
    this.sampleRate = config.sampleRate || 44100;
    this.minFrequency = config.minFrequency || 80;
    this.maxFrequency = config.maxFrequency || 8000;
    this.fftInterval = config.fftInterval || 2;

    // 预计算常量
    this.binWidth = this.sampleRate / this.fftSize;
    this.nyquist = this.sampleRate / 2;
    this.minBin = Math.floor(this.minFrequency / this.binWidth);
    this.maxBin = Math.ceil(this.maxFrequency / this.binWidth);

    // AnalyserNode (浏览器环境)
    this.analyser = null;
    this.useNativeFFT = false;

    // 尝试创建 AnalyserNode
    if (this.audioContext && config.sourceNode) {
      try {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = 0;  // 禁用内置平滑
        config.sourceNode.connect(this.analyser);
        this.useNativeFFT = true;
        console.log('[SpectralFeatures] ✅ 使用原生 AnalyserNode FFT');
      } catch (error) {
        console.warn('[SpectralFeatures] ⚠️ AnalyserNode 创建失败，降级到纯 JS FFT:', error);
        this.useNativeFFT = false;
      }
    } else {
      console.log('[SpectralFeatures] ℹ️ 未提供 audioContext/sourceNode，使用纯 JS FFT');
    }

    // FFT 降频控制
    this.frameCount = 0;
    this.lastSpectralData = null;

    // 性能统计
    this.stats = {
      fftCount: 0,
      totalFFTTime: 0,
      avgFFTTime: 0,
      skippedFrames: 0
    };

    console.log('[SpectralFeatures] 初始化完成');
    console.log(`  FFT Size: ${this.fftSize}`);
    console.log(`  Sample Rate: ${this.sampleRate} Hz`);
    console.log(`  分析频率范围: ${this.minFrequency}-${this.maxFrequency} Hz (bin ${this.minBin}-${this.maxBin})`);
    console.log(`  FFT Interval: 每 ${this.fftInterval} 帧运行一次`);
    console.log(`  FFT 模式: ${this.useNativeFFT ? 'AnalyserNode (原生)' : 'Pure JS'}`);
  }

  /**
   * 分析音频缓冲区，提取频域特征
   *
   * @param {Float32Array} audioBuffer - 音频数据
   * @returns {Object} 频域特征数据
   * @returns {number} return.spectralCentroid - 频谱质心 (Hz)
   * @returns {number} return.brightness - 音色亮度 (0-1)
   * @returns {number} return.breathiness - 气声度/频谱平坦度 (0-1)
   * @returns {number} return.formant - 共振峰估计 (Hz)
   */
  analyze(audioBuffer) {
    this.frameCount++;

    // FFT 降频: 每 N 帧才运行一次真正的 FFT
    if (this.frameCount % this.fftInterval !== 0) {
      this.stats.skippedFrames++;
      // 返回上一次的结果
      return this.lastSpectralData || this._getDefaultFeatures();
    }

    // 执行 FFT
    const startTime = performance.now();
    let spectrum;

    try {
      if (this.useNativeFFT && this.analyser) {
        spectrum = this._performNativeFFT();
      } else {
        spectrum = this._performPureJSFFT(audioBuffer);
      }

      // 性能统计
      const fftTime = performance.now() - startTime;
      this.stats.fftCount++;
      this.stats.totalFFTTime += fftTime;
      this.stats.avgFFTTime = this.stats.totalFFTTime / this.stats.fftCount;

      // 计算频域特征
      const features = this._calculateFeatures(spectrum);

      // 缓存结果
      this.lastSpectralData = features;

      return features;
    } catch (error) {
      console.error('[SpectralFeatures] FFT 或特征计算失败:', error);
      // 优雅降级: 返回默认值或上一次结果
      return this.lastSpectralData || this._getDefaultFeatures();
    }
  }

  /**
   * 使用原生 AnalyserNode 执行 FFT
   * @private
   * @returns {Float32Array} 频谱幅度数组
   */
  _performNativeFFT() {
    const spectrum = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(spectrum);

    // AnalyserNode 返回 dB 值，需要转换为线性幅度
    const linearSpectrum = new Float32Array(spectrum.length);
    for (let i = 0; i < spectrum.length; i++) {
      linearSpectrum[i] = AudioUtils.dBToLinear(spectrum[i]);
    }

    return linearSpectrum;
  }

  /**
   * 使用纯 JS FFT (AudioUtils)
   * @private
   * @param {Float32Array} audioBuffer - 音频数据
   * @returns {Float32Array} 频谱幅度数组
   */
  _performPureJSFFT(audioBuffer) {
    return AudioUtils.performSimpleFFT(audioBuffer, this.fftSize);
  }

  /**
   * 从频谱数据计算所有特征
   * @private
   * @param {Float32Array} spectrum - 频谱幅度数组
   * @returns {Object} 特征数据
   */
  _calculateFeatures(spectrum) {
    // 限制分析频率范围
    const relevantSpectrum = spectrum.slice(this.minBin, this.maxBin);

    // 1. 频谱质心 (Spectral Centroid)
    const spectralCentroid = this._calculateCentroid(relevantSpectrum, this.minBin);

    // 2. 音色亮度 (Brightness)
    const brightness = AudioUtils.clamp(spectralCentroid / this.nyquist, 0, 1);

    // 3. 气声度 (Breathiness / Spectral Flatness)
    const breathiness = this._calculateFlatness(relevantSpectrum);

    // 4. 共振峰估计 (Formant - Phase 2 简化版)
    // 使用 Spectral Centroid 作为近似
    const formant = AudioUtils.clamp(spectralCentroid, 500, 3000);

    return {
      spectralCentroid,
      brightness,
      breathiness,
      formant
    };
  }

  /**
   * 计算频谱质心 (加权平均频率)
   *
   * 公式: centroid = Σ(f[i] * magnitude[i]) / Σ(magnitude[i])
   *
   * @private
   * @param {Float32Array} spectrum - 频谱幅度数组
   * @param {number} startBin - 起始 bin 索引
   * @returns {number} 频谱质心 (Hz)
   */
  _calculateCentroid(spectrum, startBin) {
    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let i = 0; i < spectrum.length; i++) {
      const magnitude = spectrum[i];
      const frequency = (startBin + i) * this.binWidth;

      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }

    if (magnitudeSum === 0) {
      console.warn('[SpectralFeatures] 频谱幅度总和为 0，返回默认质心');
      return 1000;  // 默认值
    }

    const centroid = weightedSum / magnitudeSum;

    // 验证范围
    if (!isFinite(centroid) || centroid < 0) {
      console.warn('[SpectralFeatures] 无效的 centroid 值，返回默认值');
      return 1000;
    }

    return centroid;
  }

  /**
   * 计算频谱平坦度 (Spectral Flatness)
   *
   * 公式: flatness = geometricMean(spectrum) / arithmeticMean(spectrum)
   *
   * @private
   * @param {Float32Array} spectrum - 频谱幅度数组
   * @returns {number} 频谱平坦度 (0-1)
   */
  _calculateFlatness(spectrum) {
    // 过滤掉零值 (避免 log(0) 问题)
    const nonZeroSpectrum = [];
    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i] > 1e-10) {  // 避免极小值
        nonZeroSpectrum.push(spectrum[i]);
      }
    }

    if (nonZeroSpectrum.length === 0) {
      console.warn('[SpectralFeatures] 频谱全零，返回默认 flatness');
      return 0.2;  // 默认中低气声度
    }

    const geometricMean = AudioUtils.geometricMean(nonZeroSpectrum);
    const arithmeticMean = nonZeroSpectrum.reduce((sum, val) => sum + val, 0) / nonZeroSpectrum.length;

    if (arithmeticMean === 0) {
      return 0.2;
    }

    const flatness = geometricMean / arithmeticMean;

    // Clamp 到 0-1 范围
    return AudioUtils.clamp(flatness, 0, 1);
  }

  /**
   * 获取默认特征 (降级时使用)
   * @private
   * @returns {Object} 默认特征值
   */
  _getDefaultFeatures() {
    return {
      spectralCentroid: 1500,
      brightness: 0.5,
      breathiness: 0.2,
      formant: 1000
    };
  }

  /**
   * 重置状态
   */
  reset() {
    this.frameCount = 0;
    this.lastSpectralData = null;
    this.stats = {
      fftCount: 0,
      totalFFTTime: 0,
      avgFFTTime: 0,
      skippedFrames: 0
    };
    console.log('[SpectralFeatures] 重置状态');
  }

  /**
   * 获取性能统计
   * @returns {Object} 性能数据
   */
  getStats() {
    return {
      ...this.stats,
      fftMode: this.useNativeFFT ? 'AnalyserNode' : 'Pure JS',
      fftInterval: this.fftInterval,
      effectiveFFTRate: this.stats.fftCount / Math.max(this.frameCount, 1)
    };
  }
}

// 默认导出
export default SpectralFeatures;

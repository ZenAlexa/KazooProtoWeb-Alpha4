/**
 * ExpressiveFeatures - 表现力特征提取主模块
 *
 * 统一入口，协调所有子模块（平滑、起音、频谱）来生成完整的 PitchFrame。
 *
 * Phase 2.6: 完整集成 SmoothingFilters、OnsetDetector、SpectralFeatures
 *
 * @module expressive-features
 */

import { createPitchFrameFromBasic } from './types/pitch-frame.js';
import * as AudioUtils from './utils/audio-utils.js';
import { SpectralFeatures } from './features/spectral-features.js';
import { KalmanFilter, EMAFilter } from './features/smoothing-filters.js';
import { OnsetDetector } from './features/onset-detector.js';

/**
 * ExpressiveFeatures 主类
 *
 * @class
 */
export class ExpressiveFeatures {
  /**
   * 构造函数
   *
   * @param {Object} [options={}] - 配置对象
   * @param {AudioContext} [options.audioContext] - Web Audio API 上下文 (Phase 2.5 需要)
   * @param {number} [options.sampleRate=44100] - 采样率
   * @param {number} [options.bufferSize=2048] - 缓冲区大小
   * @param {string} [options.mode='script-processor'] - 音频模式
   * @param {Object} [options.config] - Phase 2.10: 集中式配置对象
   */
  constructor(options = {}) {
    this.audioContext = options.audioContext || null;
    this.sampleRate = options.sampleRate || 44100;
    this.bufferSize = options.bufferSize || 2048;
    this.mode = options.mode || 'script-processor';

    // Phase 2.10: 使用集中式配置或回退到默认值
    const appConfig = options.config;

    // Phase 2.6: 初始化平滑滤波器
    this.smoothingFilters = {
      // Kalman Filter 用于 cents 平滑 (高精度音高)
      cents: new KalmanFilter({
        processNoise: appConfig?.smoothing.kalman.processNoise ?? 0.001,
        measurementNoise: appConfig?.smoothing.kalman.measurementNoise ?? 0.1,
        initialEstimate: appConfig?.smoothing.kalman.initialEstimate ?? 0,
        initialError: appConfig?.smoothing.kalman.initialError ?? 1
      }),
      // EMA Filter 用于音量平滑
      volumeDb: new EMAFilter({
        alpha: appConfig?.smoothing.volume.alpha ?? 0.3
      }),
      // EMA Filter 用于亮度平滑
      brightness: new EMAFilter({
        alpha: appConfig?.smoothing.brightness.alpha ?? 0.2
      })
    };

    // Phase 2.6: 初始化起音检测器 (Phase 2.10: 完整参数映射)
    this.onsetDetector = new OnsetDetector({
      sampleRate: this.sampleRate,
      energyThreshold: appConfig?.onset.energyThreshold ?? 6,
      silenceThreshold: appConfig?.onset.silenceThreshold ?? -40,
      attackDuration: appConfig?.onset.attackDuration ?? 50,
      minSilenceDuration: appConfig?.onset.minSilenceDuration ?? 100,
      timeWindow: appConfig?.onset.timeWindow ?? 3,
      debug: appConfig?.onset.debug ?? false
    });

    // Phase 2.5: 初始化 SpectralFeatures (Phase 2.10: 完整参数映射)
    this.spectralFeatures = null;
    if (this.audioContext) {
      this.spectralFeatures = new SpectralFeatures({
        audioContext: this.audioContext,
        fftSize: appConfig?.spectral.fftSize ?? 2048,
        sampleRate: this.sampleRate,
        fftInterval: appConfig?.spectral.fftInterval ?? 2,
        minFrequency: appConfig?.spectral.minFrequency ?? 80,
        maxFrequency: appConfig?.spectral.maxFrequency ?? 8000
      });
    } else {
      // 降级到纯 JS FFT (Node.js 测试或无 audioContext)
      this.spectralFeatures = new SpectralFeatures({
        fftSize: appConfig?.spectral.fftSize ?? 2048,
        sampleRate: this.sampleRate,
        fftInterval: appConfig?.spectral.fftInterval ?? 2,
        minFrequency: appConfig?.spectral.minFrequency ?? 80,
        maxFrequency: appConfig?.spectral.maxFrequency ?? 8000
      });
    }

    // Phase 2.6: 音高稳定性计算 (滑动窗口)
    this.centsHistory = [];
    this.centsHistoryMaxLength = 10;  // 保存最近 10 帧的 cents 值

    // Phase 2.6: attackTime 计算 (从 silence 到 peak 的时间)
    this.lastArticulationState = 'silence';
    this.attackStartTime = 0;
    this.currentAttackTime = 0;

    // 性能监控 (累积统计)
    this.stats = {
      processCount: 0,
      totalProcessTime: 0,
      avgProcessTime: 0,
      // Phase 2.6: 子模块性能统计 (累积值和平均值)
      smoothingTime: 0,        // 最后一帧耗时
      totalSmoothingTime: 0,   // 累积耗时
      avgSmoothingTime: 0,     // 平均耗时
      onsetTime: 0,
      totalOnsetTime: 0,
      avgOnsetTime: 0,
      spectralTime: 0,
      totalSpectralTime: 0,
      avgSpectralTime: 0
    };

    console.log('[ExpressiveFeatures] 初始化 (Phase 2.10 - 集中式配置)');
    console.log(`  模式: ${this.mode}`);
    console.log(`  采样率: ${this.sampleRate} Hz`);
    console.log(`  缓冲区: ${this.bufferSize} 样本`);
    console.log(`  AudioContext: ${this.audioContext ? '✅ 可用 (支持 AnalyserNode FFT)' : '❌ 未提供'}`);
    console.log('  子模块: ✅ SmoothingFilters, ✅ OnsetDetector, ✅ SpectralFeatures');
    console.log(`  配置来源: ${appConfig ? '✅ 集中式配置' : '⚠️ 回退默认值'}`);
  }

  /**
   * 处理单帧音频，提取完整的 PitchFrame
   *
   * @param {Object} input - 输入数据
   * @param {Object} input.pitchInfo - 基础音高信息 (来自 YIN 检测器)
   * @param {number} input.pitchInfo.frequency - 频率 (Hz)
   * @param {number} input.pitchInfo.confidence - 置信度 (0-1)
   * @param {string} [input.pitchInfo.note] - 音符名称
   * @param {number} [input.pitchInfo.octave] - 八度
   * @param {Float32Array} input.audioBuffer - 原始音频缓冲区
   * @param {number} input.timestamp - 时间戳 (ms)
   *
   * @returns {PitchFrame} 完整的 PitchFrame 数据
   */
  process({ pitchInfo, audioBuffer, timestamp }) {
    const startTime = performance.now();

    // 1. 创建基础 PitchFrame
    const frame = createPitchFrameFromBasic(pitchInfo, timestamp);

    // 2. 计算音量 (使用 AudioUtils)
    let rawVolumeDb = -60;  // 保存原始音量 (供 OnsetDetector 使用)
    try {
      const rms = AudioUtils.calculateRMS(audioBuffer);
      frame.volumeLinear = rms;
      rawVolumeDb = AudioUtils.linearToDb(rms);
      frame.volumeDb = rawVolumeDb;  // 先存原始值
    } catch (error) {
      // 静音或空缓冲区
      frame.volumeLinear = 0;
      frame.volumeDb = -60;
      rawVolumeDb = -60;
    }

    // 3. 计算音分偏移 (使用 AudioUtils)
    let rawCents = 0;
    if (pitchInfo.frequency > 0 && pitchInfo.confidence > 0.5) {
      // 获取最接近的音符频率作为目标
      const noteInfo = AudioUtils.frequencyToNote(pitchInfo.frequency);
      rawCents = AudioUtils.calculateCents(
        pitchInfo.frequency,
        noteInfo.targetFrequency
      );
    }

    // 4. Phase 2.6: 起音检测 ✅ (使用原始音量，避免平滑导致峰值钝化)
    const onsetStart = performance.now();
    const currentState = this.onsetDetector.update(rawVolumeDb, timestamp);
    frame.articulation = currentState;

    // 计算 attackTime (从 silence/release 到当前帧的时间)
    if (currentState === 'attack' && this.lastArticulationState !== 'attack') {
      // 刚进入 attack 状态
      this.attackStartTime = timestamp;
      this.currentAttackTime = 0;
    } else if (currentState === 'attack' || currentState === 'sustain') {
      // 在 attack 或 sustain 状态中，持续计算时间
      this.currentAttackTime = timestamp - this.attackStartTime;
    }
    frame.attackTime = this.currentAttackTime;
    this.lastArticulationState = currentState;

    // 累积 onset 统计
    this.stats.onsetTime = performance.now() - onsetStart;
    this.stats.totalOnsetTime += this.stats.onsetTime;

    // 5. Phase 2.6: 平滑处理 ✅ (OnsetDetector 之后再平滑，保证检测灵敏度)
    const smoothStart = performance.now();
    frame.cents = this.smoothingFilters.cents.update(rawCents);
    frame.volumeDb = this.smoothingFilters.volumeDb.update(rawVolumeDb);  // 平滑原始值

    // 累积 smoothing 统计
    this.stats.smoothingTime = performance.now() - smoothStart;
    this.stats.totalSmoothingTime += this.stats.smoothingTime;

    // 5. Phase 2.6: 频域特征提取 ✅
    const spectralStart = performance.now();
    if (this.spectralFeatures) {
      try {
        const spectralData = this.spectralFeatures.analyze(audioBuffer);
        frame.spectralCentroid = spectralData.spectralCentroid;
        frame.brightness = spectralData.brightness;
        frame.formant = spectralData.formant;
        frame.breathiness = spectralData.breathiness;

        // 平滑 brightness
        frame.brightness = this.smoothingFilters.brightness.update(frame.brightness);
      } catch (error) {
        console.error('[ExpressiveFeatures] SpectralFeatures 失败:', error);
        // 降级: 使用默认值
        frame.spectralCentroid = 1500;
        frame.brightness = 0.5;
        frame.formant = 1000;
        frame.breathiness = 0.2;
      }
    } else {
      // 无 SpectralFeatures: 使用默认值
      frame.spectralCentroid = 1500;
      frame.brightness = 0.5;
      frame.formant = 1000;
      frame.breathiness = 0.2;
    }

    // 累积 spectral 统计
    this.stats.spectralTime = performance.now() - spectralStart;
    this.stats.totalSpectralTime += this.stats.spectralTime;

    // 6. Phase 2.6: 音高稳定性计算 ✅
    // 仅在置信度足够时记录 cents 值，避免静音时零值污染
    if (pitchInfo.frequency > 0 && pitchInfo.confidence > 0.5) {
      this.centsHistory.push(rawCents);
      if (this.centsHistory.length > this.centsHistoryMaxLength) {
        this.centsHistory.shift();
      }
    }

    if (this.centsHistory.length >= 3) {
      const centsVariance = AudioUtils.calculateVariance(this.centsHistory);
      // stability = 1 / (1 + variance)
      // variance 越小，stability 越接近 1
      frame.pitchStability = 1 / (1 + centsVariance);
    } else {
      // 样本不足，使用默认值 (或低置信度时)
      frame.pitchStability = 0.5;
    }

    // 性能统计 - 计算所有平均值
    const processTime = performance.now() - startTime;
    this.stats.processCount++;
    this.stats.totalProcessTime += processTime;
    this.stats.avgProcessTime = this.stats.totalProcessTime / this.stats.processCount;
    this.stats.avgSmoothingTime = this.stats.totalSmoothingTime / this.stats.processCount;
    this.stats.avgOnsetTime = this.stats.totalOnsetTime / this.stats.processCount;
    this.stats.avgSpectralTime = this.stats.totalSpectralTime / this.stats.processCount;

    return frame;
  }

  /**
   * 设置音频源节点 (延迟注入，用于启用 AnalyserNode FFT)
   *
   * 在 AudioIO 初始化完成后调用此方法，可将 SpectralFeatures 从纯 JS FFT 升级到原生 FFT
   *
   * @param {AudioNode} sourceNode - 音频源节点 (来自 AudioIO)
   * @returns {boolean} 是否成功启用 AnalyserNode
   */
  setSourceNode(sourceNode) {
    if (this.spectralFeatures) {
      return this.spectralFeatures.setSourceNode(sourceNode);
    }
    return false;
  }

  /**
   * 重置状态
   */
  reset() {
    console.log('[ExpressiveFeatures] 重置状态');

    // Phase 2.6: 重置平滑滤波器
    this.smoothingFilters.cents.reset();
    this.smoothingFilters.volumeDb.reset();
    this.smoothingFilters.brightness.reset();

    // Phase 2.6: 重置起音检测器
    this.onsetDetector.reset();

    // Phase 2.5: 重置 SpectralFeatures
    if (this.spectralFeatures) {
      this.spectralFeatures.reset();
    }

    // Phase 2.6: 重置音高稳定性历史
    this.centsHistory = [];

    // Phase 2.6: 重置 attackTime 相关状态
    this.lastArticulationState = 'silence';
    this.attackStartTime = 0;
    this.currentAttackTime = 0;

    // 重置性能统计
    this.stats = {
      processCount: 0,
      totalProcessTime: 0,
      avgProcessTime: 0,
      smoothingTime: 0,
      onsetTime: 0,
      spectralTime: 0
    };
  }

  /**
   * 获取性能统计
   *
   * @returns {Object} 性能统计数据
   */
  getStats() {
    const stats = { ...this.stats };

    // Phase 2.6: 添加起音检测器统计
    stats.onsetDetector = this.onsetDetector.getStats();

    // Phase 2.5: 添加 SpectralFeatures 统计
    if (this.spectralFeatures) {
      stats.spectralFeatures = this.spectralFeatures.getStats();
    }

    // Phase 2.6: 添加音高稳定性统计
    stats.centsHistoryLength = this.centsHistory.length;

    return stats;
  }
}

// 默认导出
export default ExpressiveFeatures;

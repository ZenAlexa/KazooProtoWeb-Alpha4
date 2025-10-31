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
   * @param {Object} [config={}] - 配置对象
   * @param {AudioContext} [config.audioContext] - Web Audio API 上下文 (Phase 2.5 需要)
   * @param {number} [config.sampleRate=44100] - 采样率
   * @param {number} [config.bufferSize=2048] - 缓冲区大小
   * @param {string} [config.mode='script-processor'] - 音频模式
   */
  constructor(config = {}) {
    this.audioContext = config.audioContext || null;
    this.sampleRate = config.sampleRate || 44100;
    this.bufferSize = config.bufferSize || 2048;
    this.mode = config.mode || 'script-processor';

    // Phase 2.6: 初始化平滑滤波器
    this.smoothingFilters = {
      // Kalman Filter 用于 cents 平滑 (高精度音高)
      cents: new KalmanFilter({
        processNoise: 0.001,      // Q: 过程噪声 (越小越平滑)
        measurementNoise: 0.1,    // R: 测量噪声 (越大越平滑)
        initialEstimate: 0,       // 初始估计值
        initialError: 1           // 初始误差
      }),
      // EMA Filter 用于音量平滑
      volumeDb: new EMAFilter({
        alpha: 0.3                // 平滑系数 (越小越平滑)
      }),
      // EMA Filter 用于亮度平滑
      brightness: new EMAFilter({
        alpha: 0.2                // 平滑系数
      })
    };

    // Phase 2.6: 初始化起音检测器
    this.onsetDetector = new OnsetDetector({
      sampleRate: this.sampleRate,
      energyThreshold: 6,         // dB 阈值 (音量增加超过 6dB 认为是 attack)
      silenceThreshold: -40,      // dB 阈值 (低于 -40dB 认为是静音)
      attackHoldTime: 50,         // ms (attack 状态最少持续时间)
      releaseHoldTime: 100,       // ms (release 到 silence 的延迟)
      debug: false
    });

    // Phase 2.5: 初始化 SpectralFeatures
    this.spectralFeatures = null;
    if (this.audioContext) {
      this.spectralFeatures = new SpectralFeatures({
        audioContext: this.audioContext,
        fftSize: 2048,
        sampleRate: this.sampleRate,
        fftInterval: 2  // 每 2 帧运行一次 FFT (性能优化)
      });
    } else {
      // 降级到纯 JS FFT (Node.js 测试或无 audioContext)
      this.spectralFeatures = new SpectralFeatures({
        fftSize: 2048,
        sampleRate: this.sampleRate,
        fftInterval: 2
      });
    }

    // Phase 2.6: 音高稳定性计算 (滑动窗口)
    this.centsHistory = [];
    this.centsHistoryMaxLength = 10;  // 保存最近 10 帧的 cents 值

    // Phase 2.6: attackTime 计算 (从 silence 到 peak 的时间)
    this.lastArticulationState = 'silence';
    this.attackStartTime = 0;
    this.currentAttackTime = 0;

    // 性能监控
    this.stats = {
      processCount: 0,
      totalProcessTime: 0,
      avgProcessTime: 0,
      // Phase 2.6: 子模块性能统计
      smoothingTime: 0,
      onsetTime: 0,
      spectralTime: 0
    };

    console.log('[ExpressiveFeatures] 初始化 (Phase 2.6 完整版本)');
    console.log(`  模式: ${this.mode}`);
    console.log(`  采样率: ${this.sampleRate} Hz`);
    console.log(`  缓冲区: ${this.bufferSize} 样本`);
    console.log(`  AudioContext: ${this.audioContext ? '✅ 可用 (支持 AnalyserNode FFT)' : '❌ 未提供'}`);
    console.log('  子模块: ✅ SmoothingFilters, ✅ OnsetDetector, ✅ SpectralFeatures');
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
    try {
      const rms = AudioUtils.calculateRMS(audioBuffer);
      frame.volumeLinear = rms;
      frame.volumeDb = AudioUtils.linearToDb(rms);
    } catch (error) {
      // 静音或空缓冲区
      frame.volumeLinear = 0;
      frame.volumeDb = -60;
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

    // 4. Phase 2.6: 平滑处理 ✅
    const smoothStart = performance.now();
    frame.cents = this.smoothingFilters.cents.update(rawCents);
    frame.volumeDb = this.smoothingFilters.volumeDb.update(frame.volumeDb);
    this.stats.smoothingTime = performance.now() - smoothStart;

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
    this.stats.spectralTime = performance.now() - spectralStart;

    // 6. Phase 2.6: 起音检测 ✅
    const onsetStart = performance.now();
    const currentState = this.onsetDetector.update(frame.volumeDb, timestamp);
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
    this.stats.onsetTime = performance.now() - onsetStart;

    // 7. Phase 2.6: 音高稳定性计算 ✅
    this.centsHistory.push(rawCents);
    if (this.centsHistory.length > this.centsHistoryMaxLength) {
      this.centsHistory.shift();
    }

    if (this.centsHistory.length >= 3) {
      const centsVariance = AudioUtils.calculateVariance(this.centsHistory);
      // stability = 1 / (1 + variance)
      // variance 越小，stability 越接近 1
      frame.pitchStability = 1 / (1 + centsVariance);
    } else {
      // 样本不足，使用默认值
      frame.pitchStability = 0.5;
    }

    // 性能统计
    const processTime = performance.now() - startTime;
    this.stats.processCount++;
    this.stats.totalProcessTime += processTime;
    this.stats.avgProcessTime = this.stats.totalProcessTime / this.stats.processCount;

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

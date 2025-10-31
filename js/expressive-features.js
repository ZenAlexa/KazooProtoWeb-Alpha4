/**
 * ExpressiveFeatures - 表现力特征提取主模块
 *
 * 统一入口，协调所有子模块（平滑、起音、频谱）来生成完整的 PitchFrame。
 *
 * Phase 2.6 占位实现：当前使用假数据，为主循环数据通路搭建骨架。
 * 后续阶段将集成真实的 SmoothingFilters / OnsetDetector / SpectralFeatures。
 *
 * @module expressive-features
 */

import { createPitchFrameFromBasic } from './types/pitch-frame.js';
import * as AudioUtils from './utils/audio-utils.js';
import { SpectralFeatures } from './features/spectral-features.js';

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

    // Phase 2.6 TODO: 初始化子模块
    // this.smoothingFilters = new SmoothingFilters(...);
    // this.onsetDetector = new OnsetDetector(...);

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

    // 性能监控
    this.stats = {
      processCount: 0,
      totalProcessTime: 0,
      avgProcessTime: 0
    };

    console.log('[ExpressiveFeatures] 初始化 (Phase 2.6 占位版本)');
    console.log(`  模式: ${this.mode}`);
    console.log(`  采样率: ${this.sampleRate} Hz`);
    console.log(`  缓冲区: ${this.bufferSize} 样本`);
    console.log(`  AudioContext: ${this.audioContext ? '✅ 可用 (支持 SpectralFeatures)' : '❌ 未提供'}`);
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
    if (pitchInfo.frequency > 0 && pitchInfo.confidence > 0.5) {
      // 获取最接近的音符频率作为目标
      const noteInfo = AudioUtils.frequencyToNote(pitchInfo.frequency);
      frame.cents = AudioUtils.calculateCents(
        pitchInfo.frequency,
        noteInfo.targetFrequency
      );
    } else {
      frame.cents = 0;
    }

    // 4. Phase 2.6 TODO: 平滑处理
    // frame.cents = this.smoothingFilters.kalman.update(frame.cents);
    // frame.volumeDb = this.smoothingFilters.ema.update(frame.volumeDb);

    // 5. Phase 2.6 TODO: 起音检测
    // frame.articulation = this.onsetDetector.update(frame.volumeDb, timestamp);

    // 6. Phase 2.5: 频域特征提取 ✅
    if (this.spectralFeatures) {
      try {
        const spectralData = this.spectralFeatures.analyze(audioBuffer);
        frame.spectralCentroid = spectralData.spectralCentroid;
        frame.brightness = spectralData.brightness;
        frame.formant = spectralData.formant;
        frame.breathiness = spectralData.breathiness;
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

    // Phase 2.6 TODO: OnsetDetector
    // frame.articulation = this.onsetDetector.update(frame.volumeDb, timestamp);

    // 占位: 其他未实现特征
    frame.pitchStability = 0.8; // TODO: 基于 cents 方差计算
    frame.articulation = frame.volumeDb > -40 ? 'sustain' : 'silence';
    frame.attackTime = 0;

    // 7. 可选: 保存原始数据 (调试用)
    // frame.rawAudioBuffer = audioBuffer;

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

    // Phase 2.5: 重置 SpectralFeatures
    if (this.spectralFeatures) {
      this.spectralFeatures.reset();
    }

    // Phase 2.6 TODO: 重置其他子模块
    // this.smoothingFilters.reset();
    // this.onsetDetector.reset();

    // 重置性能统计
    this.stats = {
      processCount: 0,
      totalProcessTime: 0,
      avgProcessTime: 0
    };
  }

  /**
   * 获取性能统计
   *
   * @returns {Object} 性能统计数据
   */
  getStats() {
    const stats = { ...this.stats };

    // Phase 2.5: 添加 SpectralFeatures 统计
    if (this.spectralFeatures) {
      stats.spectralFeatures = this.spectralFeatures.getStats();
    }

    // Phase 2.6 TODO: 添加其他子模块统计
    // stats.onsetDetector = this.onsetDetector.getStats();

    return stats;
  }
}

// 默认导出
export default ExpressiveFeatures;

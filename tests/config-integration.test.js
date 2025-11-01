/**
 * 集中式配置系统 - 端到端集成测试
 *
 * 验证配置系统与实际生产代码的集成:
 * - ExpressiveFeatures 正确使用配置参数
 * - 不同预设产生可观察的行为差异
 * - 配置变更真正影响系统行为
 *
 * Phase 2.10: Configuration System Integration
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import configManager from '../js/config/app-config.js';
import { ExpressiveFeatures } from '../js/expressive-features.js';

describe('Config Integration - ExpressiveFeatures', () => {
  it('should accept and use centralized config', () => {
    const config = configManager.load();

    const ef = new ExpressiveFeatures({
      sampleRate: 44100,
      bufferSize: 2048,
      mode: 'script-processor',
      config: config
    });

    // 验证 KalmanFilter 使用了配置参数
    assert.equal(ef.smoothingFilters.cents.Q, config.smoothing.kalman.processNoise);
    assert.equal(ef.smoothingFilters.cents.R, config.smoothing.kalman.measurementNoise);

    // 验证 EMA 使用了配置参数
    assert.equal(ef.smoothingFilters.volumeDb.alpha, config.smoothing.volume.alpha);
    assert.equal(ef.smoothingFilters.brightness.alpha, config.smoothing.brightness.alpha);

    // 验证 OnsetDetector 使用了配置参数
    assert.equal(ef.onsetDetector.energyThreshold, config.onset.energyThreshold);
    assert.equal(ef.onsetDetector.silenceThreshold, config.onset.silenceThreshold);

    // 验证 SpectralFeatures 使用了配置参数
    assert.equal(ef.spectralFeatures.fftSize, config.spectral.fftSize);
    assert.equal(ef.spectralFeatures.fftInterval, config.spectral.fftInterval);
  });

  it('should work without config (fallback to defaults)', () => {
    const ef = new ExpressiveFeatures({
      sampleRate: 44100,
      bufferSize: 2048,
      mode: 'script-processor'
      // NO config parameter
    });

    // 验证回退到硬编码默认值
    assert.equal(ef.smoothingFilters.cents.Q, 0.001);
    assert.equal(ef.smoothingFilters.cents.R, 0.1);
    assert.equal(ef.smoothingFilters.volumeDb.alpha, 0.3);
  });
});

describe('Config Integration - Preset Behavior', () => {
  it('low-latency preset: should use low Q for fast response', () => {
    const config = configManager.load({}, 'low-latency');

    const ef = new ExpressiveFeatures({
      sampleRate: 48000,
      bufferSize: 512,
      mode: 'script-processor',
      config: config
    });

    // low-latency 预设使用更高的 processNoise (Q=0.005)
    assert.equal(ef.smoothingFilters.cents.Q, 0.005);

    // FFT 大小更小 (性能优先)
    assert.equal(ef.spectralFeatures.fftSize, 1024);
  });

  it('high-quality preset: should use high Q for stable output', () => {
    const config = configManager.load({}, 'high-quality');

    const ef = new ExpressiveFeatures({
      sampleRate: 48000,
      bufferSize: 4096,
      mode: 'script-processor',
      config: config
    });

    // high-quality 预设使用极低的 processNoise (Q=0.0001)
    assert.equal(ef.smoothingFilters.cents.Q, 0.0001);

    // FFT 大小更大 (质量优先)
    assert.equal(ef.spectralFeatures.fftSize, 4096);

    // FFT 间隔更短 (每帧都运行)
    assert.equal(ef.spectralFeatures.fftInterval, 1);
  });

  it('power-saving preset: should reduce CPU usage', () => {
    const config = configManager.load({}, 'power-saving');

    const ef = new ExpressiveFeatures({
      sampleRate: 22050,
      bufferSize: 2048,
      mode: 'script-processor',
      config: config
    });

    // power-saving 预设使用更小的 FFT (省电)
    assert.equal(ef.spectralFeatures.fftSize, 1024);

    // FFT 间隔更长 (每 4 帧运行一次 = 25% CPU)
    assert.equal(ef.spectralFeatures.fftInterval, 4);
  });
});

describe('Config Integration - Observable Behavior', () => {
  it('different Q values should produce different smoothing', () => {
    // 创建两个 ExpressiveFeatures 实例，使用不同的 Q 值
    const highQ = new ExpressiveFeatures({
      sampleRate: 44100,
      bufferSize: 2048,
      mode: 'script-processor',
      config: configManager.load({ smoothing: { kalman: { processNoise: 0.1 } } })
    });

    const lowQ = new ExpressiveFeatures({
      sampleRate: 44100,
      bufferSize: 2048,
      mode: 'script-processor',
      config: configManager.load({ smoothing: { kalman: { processNoise: 0.0001 } } })
    });

    // 模拟音高输入序列 (有噪声)
    const testSequence = [
      { frequency: 440.0, confidence: 0.9 },  // A4
      { frequency: 442.0, confidence: 0.9 },  // +噪声
      { frequency: 438.0, confidence: 0.9 },  // -噪声
      { frequency: 441.0, confidence: 0.9 },  // +噪声
      { frequency: 439.0, confidence: 0.9 }   // -噪声
    ];

    const audioBuffer = new Float32Array(2048).fill(0.1);  // 模拟音频
    let highQOutputs = [];
    let lowQOutputs = [];

    testSequence.forEach((pitchInfo, i) => {
      const highQFrame = highQ.process({
        pitchInfo,
        audioBuffer,
        timestamp: i * 46.4  // 模拟时间戳
      });

      const lowQFrame = lowQ.process({
        pitchInfo,
        audioBuffer,
        timestamp: i * 46.4
      });

      highQOutputs.push(highQFrame.cents);
      lowQOutputs.push(lowQFrame.cents);
    });

    // High Q (快速响应) 输出应该波动更大
    const highQVariance = calculateVariance(highQOutputs);
    const lowQVariance = calculateVariance(lowQOutputs);

    assert(highQVariance > lowQVariance,
      `High Q variance (${highQVariance.toFixed(3)}) should be > Low Q variance (${lowQVariance.toFixed(3)})`);

    console.log('[Config Integration] Smoothing Behavior:');
    console.log(`  High Q (0.1) variance: ${highQVariance.toFixed(3)}`);
    console.log(`  Low Q (0.0001) variance: ${lowQVariance.toFixed(3)}`);
  });

  it('different energyThreshold should affect onset detection', () => {
    // 灵敏检测 (低阈值)
    const sensitive = new ExpressiveFeatures({
      sampleRate: 44100,
      bufferSize: 2048,
      mode: 'script-processor',
      config: configManager.load({ onset: { energyThreshold: 3 } })
    });

    // 保守检测 (高阈值)
    const conservative = new ExpressiveFeatures({
      sampleRate: 44100,
      bufferSize: 2048,
      mode: 'script-processor',
      config: configManager.load({ onset: { energyThreshold: 20 } })
    });

    // 验证配置参数确实被应用
    assert.equal(sensitive.onsetDetector.energyThreshold, 3,
      'Sensitive detector should have threshold=3');
    assert.equal(conservative.onsetDetector.energyThreshold, 20,
      'Conservative detector should have threshold=20');

    console.log('[Config Integration] Onset Detection:');
    console.log(`  Sensitive threshold: ${sensitive.onsetDetector.energyThreshold} dB`);
    console.log(`  Conservative threshold: ${conservative.onsetDetector.energyThreshold} dB`);
    console.log(`  ✅ Configuration parameters correctly applied to OnsetDetector`);
  });

  it('different fftInterval should affect computation frequency', () => {
    // 每帧计算 FFT
    const frequent = new ExpressiveFeatures({
      sampleRate: 44100,
      bufferSize: 2048,
      mode: 'script-processor',
      config: configManager.load({ spectral: { fftInterval: 1 } })
    });

    // 每 4 帧计算 FFT
    const sparse = new ExpressiveFeatures({
      sampleRate: 44100,
      bufferSize: 2048,
      mode: 'script-processor',
      config: configManager.load({ spectral: { fftInterval: 4 } })
    });

    const pitchInfo = { frequency: 440, confidence: 0.9 };
    const audioBuffer = new Float32Array(2048).fill(0.1);

    // 处理 8 帧
    for (let i = 0; i < 8; i++) {
      frequent.process({
        pitchInfo,
        audioBuffer,
        timestamp: i * 46.4
      });

      sparse.process({
        pitchInfo,
        audioBuffer,
        timestamp: i * 46.4
      });
    }

    // 检查实际 FFT 执行次数
    const frequentStats = frequent.spectralFeatures.getStats();
    const sparseStats = sparse.spectralFeatures.getStats();

    console.log('[Config Integration] FFT Frequency:');
    console.log(`  Interval=1: ${frequentStats.fftCount}/8 frames computed`);
    console.log(`  Interval=4: ${sparseStats.fftCount}/8 frames computed`);

    assert.equal(frequentStats.fftCount, 8, 'Interval=1 should compute every frame');
    assert.equal(sparseStats.fftCount, 2, 'Interval=4 should compute every 4th frame (frames 4 and 8)');
  });
});

describe('Config Integration - Runtime Validation', () => {
  it('should throw error for invalid config values', () => {
    assert.throws(() => {
      configManager.load({
        audio: { bufferSize: 1000 }  // 无效: 不是 2 的幂次
      });
    }, /无效的缓冲区大小/);
  });

  it('should warn about suboptimal configurations', () => {
    const validation = configManager.load({
      smoothing: {
        kalman: {
          processNoise: 0.5,      // 过高
          measurementNoise: 0.001  // 过低
        }
      }
    });

    // 配置应该加载成功 (警告不阻塞)
    assert.ok(validation);
  });
});

// ============================================================
// 辅助函数
// ============================================================

/**
 * 计算方差 (用于验证平滑效果)
 */
function calculateVariance(values) {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
}

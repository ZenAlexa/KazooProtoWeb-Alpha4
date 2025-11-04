/**
 * 配置系统测试
 *
 * 测试集中式配置管理的核心功能:
 * - 配置结构验证
 * - 配置验证器
 * - 预设配置结构
 */

import {
  DEFAULT_CONFIG,
  LOW_LATENCY_PRESET,
  HIGH_QUALITY_PRESET,
  POWER_SAVING_PRESET,
  validateConfig
} from '../js/config/app-config.js';

// 测试计数
let totalAssertions = 0;
let passedAssertions = 0;
let failedTests = [];

// 自定义 assert 函数
function assert(condition, message) {
  totalAssertions++;
  if (!condition) {
    const error = new Error(`断言失败: ${message}`);
    failedTests.push({ message, stack: error.stack });
    throw error;
  }
  passedAssertions++;
}

// 测试函数
function test(name, fn) {
  console.log(`\n测试: ${name}`);
  try {
    fn();
    console.log(`✅ ${name} 通过`);
  } catch (error) {
    console.error(`❌ ${name} 失败:`, error.message);
  }
}

// ============================================================================
// 测试 1: 默认配置结构
// ============================================================================

test('默认配置结构完整性', () => {
  // 验证顶层结构
  assert(typeof DEFAULT_CONFIG === 'object', '默认配置应为对象');
  assert(DEFAULT_CONFIG.audio !== undefined, '应包含 audio 配置');
  assert(DEFAULT_CONFIG.pitchDetector !== undefined, '应包含 pitchDetector 配置');
  assert(DEFAULT_CONFIG.smoothing !== undefined, '应包含 smoothing 配置');
  assert(DEFAULT_CONFIG.onset !== undefined, '应包含 onset 配置');
  assert(DEFAULT_CONFIG.spectral !== undefined, '应包含 spectral 配置');
  assert(DEFAULT_CONFIG.synthesizer !== undefined, '应包含 synthesizer 配置');
  assert(DEFAULT_CONFIG.performance !== undefined, '应包含 performance 配置');
});

test('默认配置 - 音频引擎', () => {
  assert(DEFAULT_CONFIG.audio.sampleRate === 44100, '默认采样率应为 44100');
  assert(DEFAULT_CONFIG.audio.bufferSize === 2048, '默认缓冲区大小应为 2048');
  assert(DEFAULT_CONFIG.audio.useWorklet === true, '默认应使用 Worklet');
});

test('默认配置 - 音高检测', () => {
  assert(DEFAULT_CONFIG.pitchDetector.clarityThreshold === 0.10, '默认清晰度阈值应为 0.10 (已优化)');
  assert(DEFAULT_CONFIG.pitchDetector.minFrequency === 50, '默认最低频率应为 50 (覆盖男低音)');
  assert(DEFAULT_CONFIG.pitchDetector.maxFrequency === 1500, '默认最高频率应为 1500 (覆盖女高音)');
});

test('默认配置 - 平滑滤波', () => {
  assert(DEFAULT_CONFIG.smoothing.kalman.processNoise === 0.001, 'Kalman Q 应为 0.001');
  assert(DEFAULT_CONFIG.smoothing.kalman.measurementNoise === 0.1, 'Kalman R 应为 0.1');
  assert(DEFAULT_CONFIG.smoothing.volume.alpha === 0.3, '音量平滑系数应为 0.3');
  assert(DEFAULT_CONFIG.smoothing.brightness.alpha === 0.2, '亮度平滑系数应为 0.2');
});

// ============================================================================
// 测试 2: 低延迟预设
// ============================================================================

test('低延迟预设配置', () => {
  assert(LOW_LATENCY_PRESET.audio.sampleRate === 48000, '低延迟预设采样率应为 48000');
  assert(LOW_LATENCY_PRESET.audio.bufferSize === 512, '低延迟预设缓冲区应为 512');
  assert(LOW_LATENCY_PRESET.smoothing.kalman.processNoise === 0.005, '低延迟预设 Kalman Q 应更高');
  assert(LOW_LATENCY_PRESET.spectral.fftSize === 1024, '低延迟预设 FFT 应更小');
});

// ============================================================================
// 测试 3: 高质量预设
// ============================================================================

test('高质量预设配置', () => {
  assert(HIGH_QUALITY_PRESET.audio.bufferSize === 4096, '高质量预设缓冲区应为 4096');
  assert(HIGH_QUALITY_PRESET.pitchDetector.clarityThreshold === 0.90, '高质量预设清晰度阈值应更高');
  assert(HIGH_QUALITY_PRESET.smoothing.kalman.processNoise === 0.0001, '高质量预设 Kalman Q 应更低');
  assert(HIGH_QUALITY_PRESET.spectral.fftSize === 4096, '高质量预设 FFT 应更大');
  assert(HIGH_QUALITY_PRESET.spectral.fftInterval === 1, '高质量预设 FFT 应每帧运行');
});

// ============================================================================
// 测试 4: 节能预设
// ============================================================================

test('节能预设配置', () => {
  assert(POWER_SAVING_PRESET.audio.sampleRate === 22050, '节能预设采样率应为 22050');
  assert(POWER_SAVING_PRESET.audio.useWorklet === false, '节能预设应禁用 Worklet');
  assert(POWER_SAVING_PRESET.spectral.fftSize === 1024, '节能预设 FFT 应更小');
  assert(POWER_SAVING_PRESET.spectral.fftInterval === 4, '节能预设 FFT 间隔应更大');
  assert(POWER_SAVING_PRESET.performance.enableStats === false, '节能预设应禁用统计');
});

// ============================================================================
// 测试 5: 配置验证 - 有效配置
// ============================================================================

test('配置验证 - 有效配置', () => {
  const validation = validateConfig({
    audio: {
      sampleRate: 48000,
      bufferSize: 1024
    },
    pitchDetector: {
      clarityThreshold: 0.90,
      minFrequency: 80,
      maxFrequency: 1000
    }
  });

  assert(validation.valid === true, '有效配置应通过验证');
  assert(validation.errors.length === 0, '有效配置应无错误');
});

// ============================================================================
// 测试 6: 配置验证 - 无效采样率
// ============================================================================

test('配置验证 - 无效采样率', () => {
  const validation = validateConfig({
    audio: {
      sampleRate: 100000  // 超出范围
    }
  });

  assert(validation.valid === false, '无效采样率应验证失败');
  assert(validation.errors.length > 0, '应包含错误信息');
  assert(validation.errors[0].includes('采样率'), '错误信息应提及采样率');
});

// ============================================================================
// 测试 7: 配置验证 - 无效缓冲区大小
// ============================================================================

test('配置验证 - 无效缓冲区大小', () => {
  const validation = validateConfig({
    audio: {
      bufferSize: 1000  // 不是 2 的幂次
    }
  });

  assert(validation.valid === false, '无效缓冲区大小应验证失败');
  assert(validation.errors[0].includes('缓冲区'), '错误信息应提及缓冲区');
});

// ============================================================================
// 测试 8: 配置验证 - 无效频率范围
// ============================================================================

test('配置验证 - 无效频率范围', () => {
  const validation = validateConfig({
    pitchDetector: {
      minFrequency: 1000,
      maxFrequency: 500  // min > max
    }
  });

  assert(validation.valid === false, 'minFreq > maxFreq 应验证失败');
  assert(validation.errors[0].includes('minFrequency'), '错误信息应提及频率范围');
});

// ============================================================================
// 测试 9: 配置验证 - 无效清晰度阈值
// ============================================================================

test('配置验证 - 无效清晰度阈值', () => {
  const validation = validateConfig({
    pitchDetector: {
      clarityThreshold: 1.5  // 超出 0-1 范围
    }
  });

  assert(validation.valid === false, '超出范围的阈值应验证失败');
  assert(validation.errors[0].includes('清晰度'), '错误信息应提及清晰度阈值');
});

// ============================================================================
// 测试 10: 配置验证 - 无效 FFT 大小
// ============================================================================

test('配置验证 - 无效 FFT 大小', () => {
  const validation = validateConfig({
    spectral: {
      fftSize: 3000  // 不是 2 的幂次
    }
  });

  assert(validation.valid === false, '无效 FFT 大小应验证失败');
  assert(validation.errors[0].includes('fftSize'), '错误信息应提及 fftSize');
});

// ============================================================================
// 测试 11: 配置验证 - 无效 EMA alpha
// ============================================================================

test('配置验证 - 无效 EMA alpha', () => {
  const validation = validateConfig({
    smoothing: {
      volume: {
        alpha: 1.5  // 超出 0-1 范围
      }
    }
  });

  assert(validation.valid === false, '超出范围的 alpha 应验证失败');
  assert(validation.errors[0].includes('alpha'), '错误信息应提及 alpha');
});

// ============================================================================
// 测试 12: 配置验证 - 多个错误
// ============================================================================

test('配置验证 - 多个错误', () => {
  const validation = validateConfig({
    audio: {
      sampleRate: 100000,  // 错误 1
      bufferSize: 999      // 错误 2
    },
    pitchDetector: {
      clarityThreshold: 2  // 错误 3
    }
  });

  assert(validation.valid === false, '多个错误应验证失败');
  assert(validation.errors.length >= 3, '应包含至少 3 个错误');
});

// ============================================================================
// 测试总结
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log('📊 配置系统测试总结');
console.log('='.repeat(50));

if (failedTests.length === 0) {
  console.log(`\n🎉 所有 ${totalAssertions} 个断言全部通过!`);
  console.log(`\n测试覆盖:`);
  console.log(`  ✅ 默认配置结构: 4 项`);
  console.log(`  ✅ 预设配置: 3 项`);
  console.log(`  ✅ 配置验证: 8 项`);
  console.log(`\n✅ 通过: ${passedAssertions}`);
  console.log(`❌ 失败: 0`);
  console.log(`📊 成功率: 100.00%`);
} else {
  console.log(`\n⚠️ ${failedTests.length} 个测试失败`);
  console.log(`✅ 通过: ${passedAssertions}`);
  console.log(`❌ 失败: ${totalAssertions - passedAssertions}`);
  console.log(`📊 成功率: ${((passedAssertions / totalAssertions) * 100).toFixed(2)}%`);
  console.log('\n失败详情:');
  failedTests.forEach(({ message, stack }, index) => {
    console.log(`\n${index + 1}. ${message}`);
    console.log(stack);
  });
}

console.log('\n配置系统测试完成! ✅');
console.log('='.repeat(50));

// 退出码
process.exit(failedTests.length === 0 ? 0 : 1);

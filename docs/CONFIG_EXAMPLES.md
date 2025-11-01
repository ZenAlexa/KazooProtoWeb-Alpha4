# 配置使用示例

本文档展示如何在实际应用中使用集中式配置系统。

---

## 基础使用

### 1. 使用默认配置

```javascript
import configManager from './js/config/app-config.js';

// 加载默认配置
const config = configManager.load();

// 使用配置初始化组件
const audioIO = new AudioIO({
  sampleRate: config.audio.sampleRate,
  bufferSize: config.audio.bufferSize,
  useWorklet: config.audio.useWorklet
});
```

### 2. 使用预设配置

```javascript
import configManager from './js/config/app-config.js';

// 加载低延迟预设
const config = configManager.load({}, 'low-latency');

// 加载高质量预设
const config = configManager.load({}, 'high-quality');

// 加载节能预设
const config = configManager.load({}, 'power-saving');
```

### 3. 自定义配置

```javascript
import configManager from './js/config/app-config.js';

// 自定义配置 (部分覆盖)
const config = configManager.load({
  audio: {
    sampleRate: 48000,
    bufferSize: 1024
  },
  pitchDetector: {
    clarityThreshold: 0.90
  }
});
```

### 4. 预设 + 自定义

```javascript
import configManager from './js/config/app-config.js';

// 基于预设进行微调
const config = configManager.load(
  {
    // 微调: 提高音高检测质量
    pitchDetector: {
      clarityThreshold: 0.92
    }
  },
  'low-latency'  // 基于低延迟预设
);
```

---

## 实际场景示例

### 场景 1: 实时演奏 (Karaoke 应用)

**需求**: 低延迟、快速响应、自然音色

```javascript
const config = configManager.load(
  {
    audio: {
      bufferSize: 512          // ~11ms 延迟
    },
    smoothing: {
      kalman: {
        processNoise: 0.005    // 快速响应
      },
      volume: {
        alpha: 0.5             // 快速音量变化
      }
    },
    onset: {
      energyThreshold: 5       // 灵敏起音检测
    }
  },
  'low-latency'
);
```

**关键指标**:
- 延迟: ~20-30ms (总延迟)
- 响应: 快速跟随音高变化
- 起音: 灵敏检测

---

### 场景 2: 音高分析 (教学/训练应用)

**需求**: 高精度、稳定、详细数据

```javascript
const config = configManager.load(
  {
    pitchDetector: {
      clarityThreshold: 0.92   // 高置信度
    },
    smoothing: {
      kalman: {
        processNoise: 0.0001,  // 极高平滑
        measurementNoise: 0.05
      }
    },
    spectral: {
      fftSize: 4096,           // 高频率分辨率
      fftInterval: 1           // 每帧分析
    },
    performance: {
      enableStats: true,       // 记录详细统计
      logLevel: 'debug'        // 详细日志
    }
  },
  'high-quality'
);
```

**关键指标**:
- 精度: ±1 cent (卡尔曼滤波)
- 稳定性: 极低抖动
- 频率分辨率: ~11 Hz/bin (48kHz/4096)

---

### 场景 3: 移动端应用 (省电模式)

**需求**: 低功耗、兼容性、基本功能

```javascript
const config = configManager.load(
  {
    audio: {
      sampleRate: 22050,       // 降低采样率
      useWorklet: false        // 兼容旧设备
    },
    spectral: {
      fftSize: 1024,
      fftInterval: 6           // 仅 16% 帧运行 FFT
    },
    performance: {
      enableStats: false,      // 禁用统计
      logLevel: 'error'        // 仅错误日志
    }
  },
  'power-saving'
);
```

**关键指标**:
- CPU: ~50% 降低
- 电池: 延长续航
- 兼容性: 支持旧浏览器

---

### 场景 4: 嘈杂环境 (户外/咖啡厅)

**需求**: 抗噪、高置信度、减少误检

```javascript
const config = configManager.load({
  pitchDetector: {
    clarityThreshold: 0.92     // 提高阈值
  },
  smoothing: {
    kalman: {
      measurementNoise: 0.5    // 降低测量信任度
    }
  },
  onset: {
    energyThreshold: 8,        // 提高起音阈值
    silenceThreshold: -30      // 提高静音阈值
  },
  spectral: {
    minFreq: 150,              // 过滤低频噪声
    maxFreq: 4000              // 限制高频噪声
  }
});
```

**关键指标**:
- 误检率: 显著降低
- 稳定性: 更强抗干扰
- 置信度: 仅输出高质量结果

---

### 场景 5: 女声高音 (专门优化)

**需求**: 高频范围、快速颤音、细腻表现

```javascript
const config = configManager.load({
  pitchDetector: {
    minFrequency: 150,         // D3 (女低音)
    maxFrequency: 1400         // F6 (女高音)
  },
  smoothing: {
    kalman: {
      processNoise: 0.01       // 保留颤音细节
    }
  },
  spectral: {
    minFreq: 150,
    maxFreq: 10000             // 扩展高频分析
  }
});
```

---

### 场景 6: 男声低音 (专门优化)

**需求**: 低频范围、稳定厚实、共鸣分析

```javascript
const config = configManager.load({
  pitchDetector: {
    minFrequency: 65,          // C2 (男低音)
    maxFrequency: 600          // D5 (男高音)
  },
  smoothing: {
    kalman: {
      processNoise: 0.0005     // 更高平滑度
    }
  },
  spectral: {
    minFreq: 65,
    maxFreq: 4000              // 聚焦中低频
  }
});
```

---

## 动态配置调整

### 运行时检测设备性能

```javascript
import configManager from './js/config/app-config.js';

// 检测设备性能
function detectDeviceCapability() {
  const cpuCores = navigator.hardwareConcurrency || 2;
  const memory = navigator.deviceMemory || 4;  // GB

  if (cpuCores >= 8 && memory >= 8) {
    return 'high-end';
  } else if (cpuCores >= 4 && memory >= 4) {
    return 'mid-range';
  } else {
    return 'low-end';
  }
}

// 根据设备能力选择预设
const deviceCapability = detectDeviceCapability();
let preset = 'balanced';

switch (deviceCapability) {
  case 'high-end':
    preset = 'high-quality';
    break;
  case 'low-end':
    preset = 'power-saving';
    break;
  default:
    preset = null;  // 使用默认配置
}

const config = configManager.load({}, preset);
console.log(`设备能力: ${deviceCapability}, 使用预设: ${preset || 'default'}`);
```

### 根据用户选择动态调整

```javascript
// HTML UI
<select id="quality-preset">
  <option value="low-latency">低延迟 (演奏)</option>
  <option value="balanced" selected>平衡 (默认)</option>
  <option value="high-quality">高质量 (分析)</option>
  <option value="power-saving">省电 (移动)</option>
</select>

// JavaScript
document.getElementById('quality-preset').addEventListener('change', (e) => {
  const preset = e.target.value === 'balanced' ? null : e.target.value;

  // 重新加载配置
  const config = configManager.load({}, preset);

  // 重新初始化系统 (需要停止当前音频流)
  reinitializeAudioSystem(config);
});
```

---

## 配置验证示例

### 捕获验证错误

```javascript
import configManager, { validateConfig } from './js/config/app-config.js';

try {
  const config = configManager.load({
    audio: {
      bufferSize: 1000  // 无效: 不是 2 的幂次
    }
  });
} catch (error) {
  console.error('配置加载失败:', error.message);
  // 输出: "配置无效: 无效的缓冲区大小: 1000 (必须是 2 的幂次: 256-16384)"

  // 回退到默认配置
  const config = configManager.load();
}
```

### 手动验证配置

```javascript
import { validateConfig } from './js/config/app-config.js';

const userConfig = {
  pitchDetector: {
    clarityThreshold: 1.5  // 超出范围
  }
};

const validation = validateConfig(userConfig);

if (!validation.valid) {
  console.error('配置错误:', validation.errors);
  // ["无效的清晰度阈值: 1.5 (有效范围: 0-1)"]
}

if (validation.warnings.length > 0) {
  console.warn('配置警告:', validation.warnings);
}
```

---

## 配置访问模式

### 获取整个配置

```javascript
const config = configManager.get();
console.log(config.audio.sampleRate);  // 44100
```

### 获取特定路径的值

```javascript
const sampleRate = configManager.getValue('audio.sampleRate');
const kalmanQ = configManager.getValue('smoothing.kalman.processNoise');

console.log(sampleRate);  // 44100
console.log(kalmanQ);     // 0.001
```

### 配置不可变性保证

```javascript
const config = configManager.get();

// 尝试修改配置 (会抛出错误)
try {
  config.audio.sampleRate = 48000;  // TypeError: Cannot assign to read only property
} catch (error) {
  console.error('配置是不可变的:', error);
}

// 正确方式: 重新加载配置
const newConfig = configManager.load({
  audio: { sampleRate: 48000 }
});
```

---

## 调试技巧

### 打印完整配置

```javascript
const config = configManager.get();
console.log('当前配置:', JSON.stringify(config, null, 2));
```

### 性能分析配置

```javascript
const config = configManager.get();

// 计算理论延迟
const theoreticalLatency = (config.audio.bufferSize / config.audio.sampleRate) * 1000;
console.log(`理论延迟: ${theoreticalLatency.toFixed(2)} ms`);

// 计算 FFT 频率分辨率
const fftResolution = config.audio.sampleRate / config.spectral.fftSize;
console.log(`FFT 频率分辨率: ${fftResolution.toFixed(2)} Hz/bin`);

// 计算 FFT CPU 使用率
const fftUsagePercent = (1 / config.spectral.fftInterval) * 100;
console.log(`FFT CPU 使用率: ${fftUsagePercent.toFixed(1)}%`);
```

### 导出配置到 JSON

```javascript
const config = configManager.get();
const configJSON = JSON.stringify(config, null, 2);

// 下载配置文件
const blob = new Blob([configJSON], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'kazoo-config.json';
a.click();
```

---

## 最佳实践总结

### 1. 配置加载时机
- 在应用启动时加载一次配置
- 避免频繁重新加载 (影响性能)
- 仅在用户主动切换预设时重新加载

### 2. 配置组织
- 使用预设作为基础
- 仅覆盖需要调整的参数
- 保持配置文件简洁

### 3. 错误处理
- 始终使用 try-catch 捕获配置错误
- 提供回退到默认配置的机制
- 向用户展示友好的错误信息

### 4. 性能优化
- 根据设备能力自动选择预设
- 监控性能指标，动态调整配置
- 在移动设备上使用省电预设

### 5. 用户体验
- 提供预设选择器 (UI)
- 显示当前配置的关键参数
- 提供"恢复默认"按钮

---

## 参考资料

- [完整配置文档](./CONFIGURATION.md)
- [配置源代码](../js/config/app-config.js)
- [API 设计文档](./phase2/API_DESIGN.md)

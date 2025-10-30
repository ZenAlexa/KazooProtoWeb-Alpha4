# Phase 2 - Expression Features Specification

**版本**: Phase 2 Draft 1
**日期**: 2025-10-30
**作者**: Ziming Wang & Claude
**状态**: 设计阶段

---

## 1. 概述 (Overview)

Phase 2 的核心目标是从原始音高检测数据中提取**表现力特征** (Expressive Features)，为合成引擎提供更丰富的控制维度，显著提升声音表现力和音乐性。

### 设计原则

1. **可维护性 (Maintainability)**: 模块化设计，职责分离清晰
2. **可验证性 (Testability)**: 每个模块都有单元测试和独立验证方法
3. **可扩展性 (Extensibility)**: 易于添加新特征，不影响现有代码

---

## 2. 表现力指标定义 (Feature Definitions)

### 2.1 核心指标 (Core Features)

| 指标名称 | 英文名称 | 数值范围 | 单位 | 用途 |
|---------|---------|---------|------|------|
| **音高** | `frequency` | 80-800 | Hz | 基础音高控制 (已实现) |
| **音符** | `note` | 字符串 | 如 "C4" | 音符显示 (已实现) |
| **置信度** | `confidence` | 0-1 | 无量纲 | 检测可靠性 (已实现) |

### 2.2 动态特征 (Dynamic Features)

#### 2.2.1 音量 (Volume)
- **属性名**: `volumeDb`
- **数值范围**: -60 ~ 0 dB
- **计算方法**: `20 * log10(RMS)`
- **用途**:
  - 动态控制 (Velocity)
  - 自动音量门限 (Gate)
  - 起音检测辅助
- **平滑**: EMA, α=0.3

#### 2.2.2 音量线性 (Volume Linear)
- **属性名**: `volumeLinear`
- **数值范围**: 0-1 (归一化)
- **计算方法**: RMS 直接映射
- **用途**:
  - 合成器 Velocity 参数
  - UI 可视化
- **平滑**: EMA, α=0.3

---

### 2.3 音高精度特征 (Pitch Precision Features)

#### 2.3.1 音分偏移 (Cents Deviation)
- **属性名**: `cents`
- **数值范围**: -50 ~ +50 cents
- **计算方法**:
  ```
  cents = 1200 * log2(frequency / targetFrequency)
  ```
  其中 `targetFrequency` 为最接近的十二平均律音高
- **用途**:
  - **Vibrato 控制**: |cents| > 10 → 自动 Vibrato depth
  - **Pitch Bend**: 直接映射到 Pitch Bend Amount
  - **音准可视化**: UI 显示唱得准不准
- **平滑**: Kalman Filter (Q=0.001, R=0.1)

#### 2.3.2 音高稳定性 (Pitch Stability)
- **属性名**: `pitchStability`
- **数值范围**: 0-1 (0=不稳定, 1=非常稳定)
- **计算方法**:
  ```
  stability = 1 / (1 + cents_variance)
  ```
  使用最近 10 帧的 cents 方差
- **用途**:
  - 自适应平滑强度
  - 音质评估指标
  - UI 反馈

---

### 2.4 时域特征 (Temporal Features)

#### 2.4.1 起音检测 (Onset Detection)
- **属性名**: `articulation`
- **数值类型**: 枚举字符串
- **可能值**:
  - `"attack"` - 新音符开始 (音量突增)
  - `"sustain"` - 音符持续中
  - `"release"` - 音符释放/消失
  - `"silence"` - 静音状态
- **检测算法**:
  ```
  能量包络突增检测 (Energy Envelope)
  阈值: volumeDb 增加 > 6dB 在 3 帧内 (~15ms)
  ```
- **用途**:
  - 触发新音符 (Legacy Mode)
  - ADSR Envelope 重置
  - 音头清晰度控制

#### 2.4.2 起音时间 (Attack Time)
- **属性名**: `attackTime`
- **数值范围**: 0-200 ms
- **计算方法**: 从静音到峰值音量的时间
- **用途**:
  - 音头锐度控制
  - UI 演奏风格分析

---

### 2.5 频域特征 (Spectral Features)

#### 2.5.1 频谱质心 (Spectral Centroid)
- **属性名**: `spectralCentroid`
- **数值范围**: 0-8000 Hz
- **计算方法**:
  ```
  centroid = Σ(f[i] * magnitude[i]) / Σ(magnitude[i])
  ```
- **用途**:
  - 音色亮度 (Brightness) 指标
  - Filter Cutoff 控制

#### 2.5.2 音色亮度 (Brightness)
- **属性名**: `brightness`
- **数值范围**: 0-1 (归一化)
- **计算方法**:
  ```
  brightness = centroid / (sampleRate / 2)
  ```
  映射到 0-1 区间
- **用途**:
  - **Filter Cutoff 控制**
  - **Formant Shift** (共振峰偏移)
  - UI 音色可视化
- **平滑**: EMA, α=0.2

#### 2.5.3 共振峰估计 (Formant Estimation)
- **属性名**: `formant` (简化版)
- **数值范围**: 500-3000 Hz (第一共振峰 F1)
- **计算方法**:
  - Phase 2: 使用 Spectral Centroid 近似
  - Phase 3+: LPC (Linear Predictive Coding) 精确提取
- **用途**:
  - 元音识别 (a/e/i/o/u)
  - 音色变化 (Timbre Morphing)

#### 2.5.4 频谱平坦度 (Spectral Flatness)
- **属性名**: `breathiness`
- **数值范围**: 0-1 (0=纯音, 1=白噪声)
- **计算方法**:
  ```
  flatness = geometricMean(spectrum) / arithmeticMean(spectrum)
  ```
- **用途**:
  - **噪声量控制** (Breathiness/Air)
  - **Filter Resonance** 反向调制
  - 音质评估
- **平滑**: EMA, α=0.25

---

## 3. 数据结构设计 (Data Structures)

### 3.1 PitchFrame (统一数据帧)

```javascript
/**
 * PitchFrame - 单帧完整的音高和表现力数据
 * @typedef {Object} PitchFrame
 */
const PitchFrame = {
  // ===== 时间戳 =====
  timestamp: 0,                    // 时间戳 (ms)

  // ===== 基础音高数据 (Phase 1 已有) =====
  frequency: 0,                    // 频率 (Hz)
  note: "C4",                      // 音符名称
  octave: 4,                       // 八度
  confidence: 0,                   // 置信度 (0-1)

  // ===== Phase 2 新增: 动态特征 =====
  volumeDb: -60,                   // 音量 (dB)
  volumeLinear: 0,                 // 音量线性 (0-1)

  // ===== Phase 2 新增: 音高精度 =====
  cents: 0,                        // 音分偏移 (-50 ~ +50)
  pitchStability: 1,               // 音高稳定性 (0-1)

  // ===== Phase 2 新增: 时域特征 =====
  articulation: "sustain",         // 起音状态: attack/sustain/release/silence
  attackTime: 0,                   // 起音时间 (ms)

  // ===== Phase 2 新增: 频域特征 =====
  spectralCentroid: 0,             // 频谱质心 (Hz)
  brightness: 0.5,                 // 亮度 (0-1)
  formant: 1000,                   // 共振峰估计 (Hz)
  breathiness: 0,                  // 气声度 (0-1)

  // ===== 原始数据 (调试用) =====
  rawAudioBuffer: null             // Float32Array, 可选
};
```

### 3.2 特征提取器配置

```javascript
/**
 * ExpressiveFeaturesConfig - 特征提取器配置
 */
const ExpressiveFeaturesConfig = {
  sampleRate: 44100,

  // 平滑配置
  smoothing: {
    cents: {
      method: 'kalman',          // 'kalman' | 'ema' | 'none'
      Q: 0.001,                  // 过程噪声
      R: 0.1                     // 测量噪声
    },
    volume: {
      method: 'ema',
      alpha: 0.3
    },
    brightness: {
      method: 'ema',
      alpha: 0.2
    },
    breathiness: {
      method: 'ema',
      alpha: 0.25
    }
  },

  // 起音检测配置
  onset: {
    energyThreshold: 6,          // dB 增量阈值
    timeWindow: 3,               // 检测窗口 (帧数)
    minSilenceDuration: 100      // 最小静音时长 (ms)
  },

  // 频域分析配置
  spectral: {
    fftSize: 2048,               // FFT 窗口大小
    minFrequency: 80,            // 最低分析频率
    maxFrequency: 8000           // 最高分析频率
  }
};
```

---

## 4. 模块架构 (Module Architecture)

### 4.1 模块依赖图

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Application                        │
│                      (main.js)                               │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
              ┌──────────────────────────────┐
              │   ExpressiveFeatures         │
              │   (expressive-features.js)   │
              │   [统一特征提取入口]          │
              └──────────────┬───────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ↓                    ↓                    ↓
┌───────────────┐   ┌────────────────┐   ┌──────────────────┐
│ OnsetDetector │   │SpectralFeatures│   │SmoothingFilters  │
│ (起音检测)     │   │(频域特征)       │   │(平滑算法)         │
│               │   │                │   │                  │
│ - attack      │   │ - centroid     │   │ - Kalman Filter  │
│ - sustain     │   │ - brightness   │   │ - EMA Filter     │
│ - release     │   │ - flatness     │   │ - Median Filter  │
│ - silence     │   │ - formant      │   │                  │
└───────────────┘   └────────────────┘   └──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 Audio Utilities Library                      │
│                 (audio-utils.js)                             │
│                                                              │
│  - calculateRMS()         - dBToLinear()                     │
│  - calculateCents()       - linearToDb()                     │
│  - frequencyToNote()      - normalizeSpectrum()              │
│  - performFFT()           - calculateVariance()              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 模块职责

| 模块名称 | 文件路径 | 主要职责 | 输入 | 输出 |
|---------|---------|---------|------|------|
| **ExpressiveFeatures** | `js/expressive-features.js` | 统一特征提取入口 | 音频 Buffer + Pitch Info | `PitchFrame` |
| **OnsetDetector** | `js/features/onset-detector.js` | 起音状态检测 | 音量序列 | `articulation` |
| **SpectralFeatures** | `js/features/spectral-features.js` | 频域特征提取 | FFT 结果 | `brightness`, `breathiness`, `formant` |
| **SmoothingFilters** | `js/features/smoothing-filters.js` | 信号平滑算法 | 原始数值序列 | 平滑后数值 |
| **AudioUtils** | `js/utils/audio-utils.js` | 通用音频工具函数 | 各种音频数据 | 计算结果 |

---

## 5. UI 显示需求 (UI Display Requirements)

### 5.1 最低显示需求 (Minimum Viable Display)

#### 5.1.1 实时数值显示 (必须)
```
┌─────────────────────────────────────┐
│  音高: C4 (261.6 Hz)                │
│  音分: +12 cents ▲                  │
│  音量: -12 dB ████████░░░░          │
│  亮度: 0.65 (明亮) ████████░░        │
│  气声: 0.15 (清晰) ██░░░░░░░░        │
│  状态: 🎵 持续中 (Sustain)          │
└─────────────────────────────────────┘
```

#### 5.1.2 可视化组件 (推荐)
- **音分指示器**: 实时显示 ±50 cents 偏移，中心为标准音高
- **音量包络**: 实时波形，显示 attack/sustain/release
- **频谱分析器**: 简化的频谱显示，高亮 formant 区域

### 5.2 调试面板 (开发者模式)

```
┌─────────────────────────────────────────────────────┐
│  🔧 Expression Features Debug Panel                 │
├─────────────────────────────────────────────────────┤
│  Raw Volume (Linear): 0.456                         │
│  Smoothed Volume (dB): -12.3                        │
│  Cents (Raw): +14.2                                 │
│  Cents (Kalman): +12.1                              │
│  Spectral Centroid: 2845 Hz                         │
│  Pitch Stability: 0.89                              │
│  Attack Time: 23ms                                  │
│  Articulation State: sustain (frame 142)            │
└─────────────────────────────────────────────────────┘
```

---

## 6. 性能目标 (Performance Targets)

| 指标 | 目标值 | 测量方法 |
|------|--------|---------|
| **特征提取延迟** | < 2ms | 单帧处理时间 |
| **总延迟** | < 20ms | 麦克风到输出 |
| **CPU 占用** | < 10% | Chrome 性能监控 |
| **内存占用** | < 50MB | 运行 5 分钟后 |
| **帧率** | 60 FPS | UI 刷新率 |

---

## 7. 测试策略 (Testing Strategy)

### 7.1 单元测试 (Unit Tests)

每个模块都需要独立的单元测试文件:

```
tests/
├── smoothing-filters.test.js    # Kalman/EMA 算法测试
├── onset-detector.test.js       # 起音检测逻辑测试
├── spectral-features.test.js    # 频域特征计算测试
├── audio-utils.test.js          # 工具函数测试
└── expressive-features.test.js  # 端到端集成测试
```

### 7.2 测试用例要求

- **Kalman Filter**: 使用正弦波 + 噪声验证收敛性
- **Onset Detector**: 合成 attack/sustain/silence 序列验证状态转换
- **Spectral Features**: 使用标准波形 (正弦/方波/锯齿波) 验证特征值
- **Integration**: 真实录音片段的端到端测试

### 7.3 回归测试

- 保留 Phase 1 的 8-15ms 延迟性能
- 确保新特征不影响基础音高检测精度

---

## 8. 实现优先级 (Implementation Priority)

### P0 (核心功能，必须实现)
1. ✅ `volumeDb`, `volumeLinear` - 动态控制
2. ✅ `cents` - Vibrato/Pitch Bend 控制
3. ✅ `brightness` - 音色变化
4. ✅ EMA/Kalman 平滑算法

### P1 (重要功能，强烈推荐)
5. ✅ `articulation` (Onset Detection) - 音头控制
6. ✅ `breathiness` - 噪声质感

### P2 (增强功能，可选)
7. ⚪ `pitchStability` - 自适应平滑
8. ⚪ `formant` - 高级音色控制
9. ⚪ `attackTime` - 演奏风格分析

---

## 9. 合成引擎映射 (Synth Engine Mapping)

### 9.1 Continuous Mode 映射表

| 表现力特征 | 合成参数 | 映射函数 | 效果 |
|-----------|---------|---------|------|
| `cents` | `pitchBend` | 直接映射 | 微分音高弯曲 |
| `volumeLinear` | `velocity` | 线性映射 0-1 | 音量控制 |
| `brightness` | `filterCutoff` | 200 + brightness * 4000 Hz | 明亮度变化 |
| `breathiness` | `noiseLevel` | breathiness * 0.3 | 气声质感 |
| `articulation` | `envelope.trigger()` | attack → 重置 ADSR | 清晰音头 |

### 9.2 Legacy Mode 映射表

| 表现力特征 | 合成参数 | 映射函数 | 效果 |
|-----------|---------|---------|------|
| `cents` | `detune` | cents (直接) | 音分偏移 |
| `volumeDb` | `velocity` | dB → 0-127 | MIDI Velocity |
| `brightness` | `filterFrequency` | 同上 | 音色亮度 |
| `articulation` | `noteOn/noteOff` | attack → noteOn | 音符触发 |

---

## 10. 成功标准 (Success Criteria)

Phase 2 完成的判断标准:

### 功能完整性
- ✅ 所有 P0/P1 特征成功提取并输出
- ✅ 两个合成引擎都支持新数据结构
- ✅ UI 实时显示所有核心指标

### 性能达标
- ✅ 特征提取延迟 < 2ms
- ✅ 总延迟仍保持 < 20ms
- ✅ 无明显卡顿或帧率下降

### 代码质量
- ✅ 所有模块通过单元测试 (覆盖率 > 80%)
- ✅ 代码符合 ESLint 规范
- ✅ 文档完整 (JSDoc + 中文注释)

### 用户体验
- ✅ 声音表现力明显提升 (主观评估)
- ✅ Vibrato 和音色变化自然流畅
- ✅ UI 反馈清晰易懂

---

## 11. 下一步行动 (Next Steps)

1. ✅ **Spec 澄清完成** ← 当前文档
2. 🔄 **API 设计**: 定义详细的函数签名和接口契约
3. ⏳ **基础设施**: 实现平滑算法 + 单元测试
4. ⏳ **特征提取**: 逐步实现各个特征模块
5. ⏳ **引擎集成**: 更新合成引擎适配新数据
6. ⏳ **UI 增强**: 添加可视化和实时显示
7. ⏳ **重构优化**: 提取公共库，清理代码

---

**文档状态**: ✅ Phase 2.1 完成
**下一阶段**: Phase 2.2 - API 设计

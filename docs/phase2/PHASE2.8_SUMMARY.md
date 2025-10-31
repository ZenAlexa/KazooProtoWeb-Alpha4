# Phase 2.8 总结 - Legacy Synthesizer 表现力特征适配

**完成日期**: 2025-11-01
**状态**: ⚠️ **代码完成，兼容性问题未解决**
**进度**: 70% (代码实现完整，用户体验不佳)

---

## 📊 实现总结

### ✅ 已完成

#### 1. 代码实现 (~200 行)

**文件**: [js/synthesizer.js](../../js/synthesizer.js)

**新增方法** (4 个):
- `handleArticulation()` - 智能起音状态机 (Line 388-449)
- `updateDetune()` - 音分精细控制 (Line 451-462)
- `updateBrightness()` - 音色亮度映射 (Line 469-492)
- `updateBreathiness()` - 气声效果控制 (Line 499-522)

**修改方法** (3 个):
- `constructor()` - 添加噪声层和状态变量 (Line 7-40)
- `createEffects()` - 初始化噪声链路 (Line 75-113)
- `dispose()` - 清理噪声层资源 (Line 557-578)

**核心实现**: `processPitchFrame()` (Line 237-291)
```javascript
processPitchFrame(pitchFrame) {
    // 解构 11 个 PitchFrame 字段
    const { frequency, note, octave, confidence, cents,
            brightness, breathiness, articulation, volumeLinear } = pitchFrame;

    // 智能起音处理
    this.handleArticulation(articulation, fullNote, volumeLinear);

    // 音分精细控制 (播放时)
    if (this.isPlaying) this.updateDetune(cents);

    // 音色亮度控制
    this.updateBrightness(brightness);

    // 气声度控制
    this.updateBreathiness(breathiness, frequency);
}
```

#### 2. 四大特征映射

| 特征 | 实现方式 | 映射范围 | 状态 |
|-----|---------|---------|------|
| **cents** | Tone.js `detune` 参数 | -100 ~ +100 cents | ✅ 原生支持 |
| **brightness** | Filter `frequency` | 200 ~ 8000 Hz (非线性) | ✅ 完整实现 |
| **breathiness** | Noise Layer 增益 | 0 ~ 30% 噪声混合 | ✅ 完整实现 |
| **articulation** | 状态机触发 | attack/sustain/release | ⚠️ 兼容性问题 |

#### 3. 技术细节

**噪声层架构**:
```
noiseSource (Tone.Noise 'white')
    ↓
noiseFilter (BandPass, frequency * 2)
    ↓
noiseGain (0 ~ 0.3)
    ↓
filter (主滤波器)
    ↓
reverb (混响)
    ↓
Destination
```

**调试日志**:
- 🎺 Attack: note (velocity)
- 🔇 Release
- 🎵 Detune: ±XX cents
- 🌟 Brightness: X.XX → Filter: XXXX Hz
- 💨 Breathiness: X.XX (noise: XX%)
- ⚠️ 强制触发 attack (调试信息)

#### 4. 文档交付

- ✅ [PHASE2.8_VERIFICATION_CHECKLIST.md](PHASE2.8_VERIFICATION_CHECKLIST.md) - 验证清单
- ✅ 本文档 (PHASE2.8_SUMMARY.md) - 实现总结
- ✅ Git 提交记录: 7 个 commits

---

## ❌ 未解决问题

### 核心问题：OnsetDetector 兼容性

#### 问题描述

**症状**:
- 用户持续哼唱时听到断断续续的音符
- 每个音符都是 Attack → 立即 Release 循环
- 无法连续播放，体验极差

**控制台日志**:
```
[Synthesizer] 🎺 Attack: G3 (velocity: 0.38)
[Synthesizer] 🔇 Release
[Synthesizer] 🎺 Attack: C#3 (velocity: 0.37)
[Synthesizer] 🔇 Release
...
```

#### 根本原因

**OnsetDetector 算法限制**:
```javascript
// js/features/onset-detector.js Line 206-209
const energyIncrease = recentVolume - previousAverage;
return energyIncrease > this.energyThreshold;  // 默认 6dB
```

**问题链**:
1. OnsetDetector 需要 **6dB 能量突增**才触发 'attack'
2. 持续哼唱时音量平稳，`energyIncrease < 6dB`
3. OnsetDetector 一直返回 `articulation: 'silence'`
4. 强制触发逻辑触发 attack 后，下一帧又被覆盖为 'silence'
5. 状态机陷入 `silence → attack → release → silence` 循环

#### 尝试的修复方案

**修复 1**: 强制触发 attack (Commit ee65b54)
```javascript
// 连续 3 帧 silence 且音量 > 0.15，强制触发 attack
if (articulation === 'silence' && volumeLinear > 0.15) {
    if (this._silenceFrameCount >= 3 && !this.isPlaying) {
        articulation = 'attack';
    }
}
```
**结果**: ❌ 仍然断断续续，因为下一帧 OnsetDetector 又返回 'silence'

**修复 2**: 保持 sustain 状态 (Commit 47d540a)
```javascript
// 已播放时，强制保持 sustain
if (this._silenceFrameCount >= 3) {
    if (!this.isPlaying) {
        articulation = 'attack';
    } else {
        articulation = 'sustain';  // 尝试保持
    }
}
```
**结果**: ❌ OnsetDetector 的 'silence' 覆盖了强制设置的 'sustain'

---

## 🔧 需要的深度修复方案

### 方案 A: 重构 OnsetDetector (推荐，但耗时)

**修改点**:
1. 降低 `energyThreshold`: 6dB → 3dB
2. 添加"持续有声"检测逻辑
3. 修改状态转换规则

**预计工作量**: 2-3 小时
**风险**: 可能影响 Phase 2.4 测试用例

### 方案 B: 绕过 OnsetDetector (快速但不优雅)

**实现**:
```javascript
// 在 handleArticulation() 之前完全覆盖 articulation
if (volumeLinear > 0.15) {
    if (!this.isPlaying) {
        articulation = 'attack';
    } else {
        articulation = 'sustain';
    }
} else {
    if (this.isPlaying) {
        articulation = 'release';
    } else {
        articulation = 'silence';
    }
}
```

**预计工作量**: 30 分钟
**风险**: 失去 OnsetDetector 的精细控制

### 方案 C: 切换到 Continuous 模式 (已采用)

**优势**:
- ✅ Phase 2.7 Continuous 模式已验证可用
- ✅ 可以立即继续 Phase 2.9 (Worklet)
- ✅ 不阻塞整体进度

**劣势**:
- ❌ Legacy 模式暂时不可用
- ❌ 离散音符场景无法测试

---

## 📈 代码统计

### 新增代码

```
js/synthesizer.js:
  - 构造函数新增: ~15 行 (噪声层变量)
  - createEffects(): ~20 行 (噪声链路)
  - processPitchFrame(): ~55 行 (主逻辑)
  - handleArticulation(): ~60 行 (状态机)
  - updateDetune(): ~12 行
  - updateBrightness(): ~24 行
  - updateBreathiness(): ~24 行
  - dispose(): ~15 行 (清理)

  总计: ~225 行 (含注释和日志)
```

### Git 提交记录

| Commit | 内容 | 行数 |
|--------|------|------|
| 2e012eb | Phase 2.8 实现完成 | +482, -11 |
| bf2b6d8 | 修复: 减少日志刷屏 | +14, -4 |
| ed051bc | 调试: 添加诊断日志 | +20 |
| 1760c02 | 修复: 切换到 Legacy 模式 | +1, -1 |
| ee65b54 | 关键修复: 强制触发 attack | +16 |
| 47d540a | 修复: 防止重复触发 | +16, -7 |
| 039f922 | 结论: 切回 Continuous | +1, -1 |

**总计**: 7 个 commits

---

## 🎯 决策与后续计划

### 决策：暂时搁置 Legacy 深度修复

**理由**:
1. **代码实现正确** - 技术架构合理，逻辑清晰
2. **问题在依赖模块** - OnsetDetector 需要重构，非 Phase 2.8 范畴
3. **有可用替代方案** - Continuous 模式 (Phase 2.7) 已验证
4. **优先级调整** - 完成 Phase 2 整体目标更重要

### 后续计划

**短期 (Phase 2 剩余工作)**:
- ✅ 使用 Continuous 模式继续开发
- ⏳ Phase 2.9: AudioWorklet 路径恢复
- ⏳ Phase 2.10: 测试和文档完善

**中期 (Phase 3 或优化阶段)**:
- 🔄 重构 OnsetDetector，支持持续哼唱
- 🔄 完善 Legacy 模式用户体验
- 🔄 添加模式切换 UI

**长期**:
- 💡 考虑混合模式 (Continuous + Discrete)
- 💡 添加用户可配置的检测阈值
- 💡 机器学习优化起音检测

---

## 🏆 关键成果

### 技术成果

1. ✅ **完整的表现力特征映射** - 4 大特征全部实现
2. ✅ **噪声层架构** - 可复用的气声效果模块
3. ✅ **调试工具** - 丰富的日志系统
4. ✅ **文档完整** - 验证清单 + 总结文档

### 经验教训

1. **依赖模块的重要性** - OnsetDetector 的设计假设影响上层体验
2. **渐进式验证** - 早期测试可以更早发现兼容性问题
3. **优先级管理** - 知道何时搁置深度优化，聚焦主线目标
4. **备选方案** - Continuous 模式的存在让 Legacy 问题不致命

---

## 📝 相关文档

- [PHASE2_PROGRESS.md](PHASE2_PROGRESS.md) - Phase 2 总体进度
- [PHASE2.7_VERIFICATION_RESULT.md](PHASE2.7_VERIFICATION_RESULT.md) - Continuous 模式验证
- [PHASE2.8_VERIFICATION_CHECKLIST.md](PHASE2.8_VERIFICATION_CHECKLIST.md) - Legacy 模式验证清单
- [../../js/synthesizer.js](../../js/synthesizer.js) - 实现代码
- [../../js/features/onset-detector.js](../../js/features/onset-detector.js) - OnsetDetector 源码

---

**Phase 2.8 状态**: ⚠️ **代码完成，待深度优化**
**下一步**: Phase 2.9 - AudioWorklet 路径恢复

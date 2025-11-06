# 真实优化清单 - 大刀阔斧版

**生成时间**: 2025-11-06
**当前状态**: 能跑，但有严重问题
**评估原则**: 实事求是，不自欺欺人

---

## 当前问题诊断

### 致命问题（必须解决）

1. **性能目标未达成**
   - 目标延迟: < 50ms
   - 实际延迟: 180ms
   - 差距: 3.6倍
   - 结论: 核心功能不合格

2. **测试基础设施混乱**
   - 8个测试文件，7个配置错误
   - 自己写的测试框架（reinventing the wheel）
   - 预设的"成功"输出（🎉所有X个断言全部通过！）
   - 结论: 测试不可信

3. **文档过度膨胀**
   - 230个 .md 文件
   - docs/ 目录 620KB
   - 文档/代码比 ≈ 0.06 (过高)
   - 充斥 emoji 和套话
   - 结论: 写文档比写代码还多

### 严重问题（需清理）

4. **历史注释堆积**
   - 167处 "Phase 2" 注释
   - 每次改动都加注释而不是删旧的
   - 代码像考古现场
   - 结论: 维护负担大

5. **调试代码未清理**
   - 286处 console.log/warn/error
   - latency-profiler/ 整个目录（调试工具）
   - 延迟分析器占用开发资源但核心延迟仍超标
   - 结论: 本末倒置

6. **假测试问题**
   ```javascript
   // tests/expressive-features.test.js
   console.log(`🎉 所有 ${totalAssertions} 个断言全部通过!`);
   console.log(`  📊 成功率: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(2)}%`);
   console.log('  🧪 可验证性: ★★★★★ (100% 测试通过，完整特征覆盖)');
   ```
   - 自己给自己打五星
   - 成功率计算是摆设（tests/expressive-features.test.js 根本没跑）
   - 结论: 自我感动

---

## 立即删除清单（无需商量）

### 1. 虚假测试框架
```bash
# 删除自制测试跑者，全部改用 Vitest
rm tests/expressive-features.test.js  # 437行自制框架
rm tests/onset-detector.test.js       # 374行
rm tests/smoothing-filters.test.js    # 398行
rm tests/spectral-features.test.js    # 370行
rm tests/audio-utils.test.js          # 383行
rm tests/config-integration.test.js   # 245行
```
**原因**: 用 node:test API 但没配置，等于没测试。删掉比留着强。

**重写策略**: 用真正的 Vitest，写能失败的测试。

---

### 2. 文档膨胀
```bash
# 删除过度文档
rm -rf docs/archive/              # 历史存档，没用
rm -rf docs/analysis/             # 代码分析报告，过时
rm -rf docs/synthesis/            # 空洞的技术路线图
rm docs/refactoring/stage2-final-sprint.md  # 370行执行计划，执行完就没用了
rm docs/refactoring/stage2-complete.md      # 200行自夸报告

# 保留核心文档
keep: PROJECT_STATUS.md
keep: README.md
keep: docs/refactoring/progress.md (精简到50行内)
keep: docs/guides/troubleshooting.md
keep: CLAUDE.md (守护规则)
```
**预期**: 230个 .md → 10个以内

---

### 3. 调试工具
```bash
rm -rf latency-profiler/          # 延迟分析器
```
**原因**:
- 花了大量时间做监控工具
- 但核心延迟仍是 180ms（目标 50ms）
- 说明监控没带来实质改进
- 先把延迟降下来，再谈监控

---

### 4. 注释债务
```bash
# 全局搜索并清理
git grep "Phase 1:" js/ | wc -l   # 清理历史阶段标记
git grep "Phase 2:" js/ | wc -l   # 167处
git grep "TODO" js/ --or --grep "FIXME"  # 1处，还好
```
**策略**:
- 删除所有 Phase X 注释
- 代码即文档，不需要考古标记
- 保留 TODO/FIXME（只有1处）

---

### 5. Emoji 污染
```bash
# 删除代码中的 emoji
git grep "🎉\|✨\|🚀\|✅\|⚠️\|❌" js/ | wc -l  # 43处
```
**原因**:
- 代码不是营销文案
- emoji 增加阅读负担
- 专业工程项目不需要这些

**保留**: 日志输出可以有 emoji（用户可见）
**删除**: 注释、变量名、commit 信息的 emoji

---

## 核心重构清单（优先级排序）

### P0: 性能修复（唯一目标）

**问题**: 180ms 延迟 vs 50ms 目标

**可能原因**:
1. AudioWorklet → ScriptProcessor fallback（2048 samples buffer）
2. ExpressiveFeatures 计算耗时（FFT + 平滑 + 检测）
3. Tone.js 合成器延迟
4. 音频管线多余拷贝

**行动**:
```bash
# 1. 确认 Worklet 是否真的在用
console.log(window.container.get('audioIO').mode)  # 应该是 'worklet'

# 2. 测量各阶段耗时
# 在 handleWorkletPitchFrame() 加时间戳
# 找出瓶颈

# 3. 考虑激进方案
- 关闭 ExpressiveFeatures 的 SpectralFeatures（FFT 耗时）
- 减少平滑算法复杂度
- 简化合成器（减少滤波器）
```

**目标**: 延迟 < 80ms（先达到可用，再优化到 50ms）

---

### P1: 测试真实化

**删除**: 所有自制测试框架
**重写**: 用 Vitest 写真正的测试

```javascript
// tests/unit/pitch-detector.test.js (新建)
import { describe, it, expect } from 'vitest';
import PitchDetector from '../../js/pitch-detector.js';

describe('PitchDetector', () => {
  it('should detect 440Hz sine wave', () => {
    const detector = new PitchDetector();
    const sineWave = generateSineWave(440, 0.1, 44100);

    const result = detector.detect(sineWave, 44100);

    expect(result.frequency).toBeCloseTo(440, 1);
    expect(result.clarity).toBeGreaterThan(0.8);
  });

  it('should reject noise', () => {
    const detector = new PitchDetector();
    const noise = generateNoise(0.1, 44100);

    const result = detector.detect(noise, 44100);

    expect(result.clarity).toBeLessThan(0.5);
  });
});
```

**关键**: 测试要能失败。如果永远通过，就是假测试。

---

### P2: 代码清理

**策略**:
1. 删除所有 Phase X 注释
2. 删除 emoji
3. 删除冗余日志（保留 error/warn，删除 debug/info 的 80%）

```bash
# 目标
console 数量: 286 → 50 以内
注释行数: 减少 30%
emoji: 0 (代码中)
```

---

### P3: 文档精简

**保留**:
- PROJECT_STATUS.md (1页)
- README.md (1页)
- TROUBLESHOOTING.md (1页)
- CLAUDE.md (守护规则)

**删除**:
- 所有 stage X 执行计划/总结报告
- 所有 "完成报告"
- 所有分析文档

**原则**:
- 文档跟不上代码就别写
- 代码即文档
- 只保留必要的

---

## 不要做的事（反模式警告）

### ❌ 不要再写"完成报告"
- 每完成一个阶段就写200行总结
- 充满自我表扬和 emoji
- 完成就完成，代码和 commit 说明一切

### ❌ 不要预设测试结果
```javascript
// 错误示范
console.log(`🎉 所有 ${totalAssertions} 个断言全部通过!`);
console.log('  🧪 可验证性: ★★★★★');
```
- 测试框架不应该输出这种东西
- 结果应该是跑出来的，不是写出来的

### ❌ 不要过度抽象
- AppContainer 本身没问题
- 但不要为了"架构优雅"而牺牲性能
- 180ms 延迟比"依赖注入完美"更重要

### ❌ 不要用监控代替优化
- latency-profiler/ 很详细
- 但延迟还是超标
- 先优化，再监控

---

## 执行计划

### 第一周: 止血

1. **Day 1-2**: 删除
   - 删除假测试（6个文件）
   - 删除文档膨胀（200+ 文件 → 10 个）
   - 删除 latency-profiler/

2. **Day 3-4**: 性能调查
   - 测量各阶段延迟
   - 确认瓶颈
   - 写优化方案（1页）

3. **Day 5**: 执行优化
   - 实施 top 3 优化
   - 目标: 延迟 < 100ms

### 第二周: 重建

4. **Day 6-7**: 真实测试
   - 用 Vitest 重写 5 个核心测试
   - 覆盖: PitchDetector, AudioIO, Container, Synthesizer, Config
   - 标准: 能失败

5. **Day 8-9**: 代码清理
   - 删除 Phase 注释
   - 删除 emoji
   - 减少 console 到 50 个

6. **Day 10**: 验证
   - 延迟测试
   - 功能回归
   - 合并到 main

---

## 成功标准（客观指标）

| 指标 | 当前 | 目标 | 验证方法 |
|------|------|------|----------|
| 延迟 | 180ms | < 80ms | 实测（麦克风→扬声器） |
| 测试文件 | 8 (7假) | 5 (真) | `npm test` 全部能跑且能失败 |
| 文档数量 | 230 | < 10 | `find . -name "*.md" \| wc -l` |
| console | 286 | < 50 | `git grep "console\." js/ \| wc -l` |
| 注释行 | 高 | 减30% | 代码/注释比 |
| Emoji | 43 | 0 | 代码中无 emoji |

---

## 反思

**问题根源**:
- 重视"看起来专业"（文档、测试框架、监控）
- 轻视"实际效果"（延迟超标 3.6 倍）

**正确顺序**:
1. 功能实现并达标（延迟 < 50ms）
2. 核心测试覆盖（5-10个真测试）
3. 简洁文档（3-5个 .md 文件）
4. 代码清理（无历史债务）

**教训**:
- 先让产品可用，再谈工程美学
- 测试是为了发现问题，不是证明正确
- 文档跟不上就别写，代码本身就是文档

---

**结论**: 这个项目有潜力，但需要去掉虚的，补上实的。

**下一步**: 执行第一周"止血"计划，删除 80% 的文档和假测试。

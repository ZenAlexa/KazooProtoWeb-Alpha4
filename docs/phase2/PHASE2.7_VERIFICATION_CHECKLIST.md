# Phase 2.7 验证检查清单

**状态**: ⚠️ 代码实现完成，但验证不充分
**创建日期**: 2025-10-31
**目的**: 确保 Phase 2.7 的实现真正有效，避免"自我宣称完成"

---

## ❌ 当前问题

### 1. 无自动化测试
- ContinuousSynth 的新方法完全没有测试覆盖
- 无法确保代码在重构时不会破坏

### 2. 无浏览器验证记录
- 未在真实环境中运行
- 无日志截图
- 无音色效果描述

### 3. 文档数据不准确
- 之前声称"Phase 2.7 完成 ✅"，但实际上只是代码写完
- 验证状态未明确标注

---

## 必须完成的验证步骤

### ✅ 步骤 1: 启动服务器并检查
- [ ] 浏览器打开 http://localhost:50656
- [ ] F12 打开控制台
- [ ] 确认没有 JavaScript 错误
- [ ] 截图: 页面正常加载

### ✅ 步骤 2: 检查初始化日志
- [ ] 点击 "Start Playing"
- [ ] 允许麦克风权限
- [ ] 控制台应看到:
  ```
  [ContinuousSynth] ✓ Initialized with continuous frequency tracking
  [ContinuousSynth] ✓ Phase 2.7 Expressive Features: cents, brightness, breathiness, articulation
  ```
- [ ] 截图: 初始化日志

### ✅ 步骤 3: 检查 AnalyserNode 状态
- [ ] 控制台搜索 "AnalyserNode FFT"
- [ ] 应看到: `✅ [Phase 2.5] AnalyserNode FFT 已启用 (原生加速)`
- [ ] 如果看到 "⚠️ 降级到纯 JS FFT"，则频谱质心不准确
- [ ] 截图: AnalyserNode 状态日志

### ✅ 步骤 4: 测试稳定音 (Baseline)
**动作**: 唱 "啊~~~~~~" (持续 5 秒，不抖动)

**预期**:
- [ ] 声音持续稳定
- [ ] 控制台应看到 `🎵 Attack detected` (开始时)
- [ ] 应该**不**看到或很少看到 `🎵 Pitch bend` (cents 接近 0)

**记录**:
- cents 范围: ______
- 音色描述: ______
- 截图: ______

### ✅ 步骤 5: 测试颤音 (Cents → Pitch Bend)
**动作**: 故意抖动音高 "啊~~啊~~啊~~" (3-5 次抖动)

**预期**:
- [ ] 声音跟随人声抖动
- [ ] 控制台应频繁看到: `🎵 Pitch bend: XX.X cents → XXX.X Hz`
- [ ] cents 应在 ±10~30 范围波动

**记录**:
- cents 范围: ______
- pitch bend 触发次数: ______
- 音色描述: ______
- 截图: ______

### ✅ 步骤 6: 测试明亮音色 (Brightness → Filter Cutoff High)
**动作**: 高音清脆发声 "咦~~" 或 "诶~~" (持续 3 秒)

**预期**:
- [ ] 声音清晰明亮，高频丰富
- [ ] 控制台应看到: `🌟 Brightness: 0.XX → Filter: XXXX Hz`
- [ ] brightness 应 > 0.7
- [ ] filter cutoff 应 > 5000 Hz

**记录**:
- brightness 值: ______
- filter cutoff: ______ Hz
- 音色描述: ______
- 截图: ______

### ✅ 步骤 7: 测试低沉音色 (Brightness → Filter Cutoff Low)
**动作**: 低音浑厚发声 "哦~~" 或 "嗯~~" (持续 3 秒)

**预期**:
- [ ] 声音低沉厚重，高频被滤除
- [ ] 控制台应看到: `🌟 Brightness: 0.XX → Filter: XXXX Hz`
- [ ] brightness 应 < 0.3
- [ ] filter cutoff 应 < 2000 Hz

**记录**:
- brightness 值: ______
- filter cutoff: ______ Hz
- 音色描述: ______
- 截图: ______

### ✅ 步骤 8: 测试气声效果 (Breathiness → Noise Layer)
**动作**: 像叹气一样轻柔发声 "哈~~" (气息多，持续 3 秒)

**预期**:
- [ ] 声音有明显沙沙气息声
- [ ] 控制台应看到: `💨 Breathiness: 0.XX → Noise: XX%`
- [ ] breathiness 应 > 0.5
- [ ] 噪声比例应 > 15%

**记录**:
- breathiness 值: ______
- 噪声比例: ______%
- 音色描述: ______
- 截图: ______

### ✅ 步骤 9: 测试断音触发 (Articulation → ADSR)
**动作**: 短促间隔发声 "哒-哒-哒-" (至少 3 次，间隔清晰)

**预期**:
- [ ] 每个音有清晰的起音和释放
- [ ] 控制台应看到多次:
  ```
  🎵 Attack detected - triggering new note
  🔇 Release detected
  🔇 Silence detected - triggering release
  ```
- [ ] 音符不会连在一起

**记录**:
- Attack 触发次数: ______
- Release 触发次数: ______
- 音色描述: ______
- 截图: ______

---

## 验证完成标准

### 必须满足的条件:
1. ✅ 所有 9 个步骤的复选框都勾选
2. ✅ 至少 3 张控制台截图 (初始化 + 日志示例 + AnalyserNode 状态)
3. ✅ 每个测试场景都有简短的音色描述
4. ✅ 所有预期日志都出现（或记录为什么没出现）

### 可选但建议:
- [ ] 录制一段演示视频 (30 秒，展示不同唱法的音色变化)
- [ ] 记录性能指标 (continuousSynthEngine.getPerformanceMetrics())
- [ ] 测试不同乐器 (Saxophone, Synth, Violin)

---

## 如果验证失败

### 常见问题诊断:

#### 问题 1: 没有看到表现力日志
**可能原因**:
- processPitchFrame() 没有被调用 (检查 main.js 数据通路)
- 阈值太高（如 brightness < 0.3 或 > 0.7 才打印）
- 表现力特征数值异常（如 brightness 始终 0.5）

**解决方案**:
- 检查 main.js 是否调用 expressiveFeatures.process()
- 检查 continuous-synth.js 是否调用 processPitchFrame()
- 临时降低日志阈值，查看所有数值

#### 问题 2: 音色没有明显变化
**可能原因**:
- AnalyserNode 未启用，频谱特征不准确
- 噪声层未连接到主效果链
- Filter cutoff 范围太窄

**解决方案**:
- 检查 AnalyserNode FFT 日志
- 检查 noiseGain.connect(this.filter) 是否执行
- 调整 filter 范围或噪声强度

#### 问题 3: 频繁看到错误或警告
**可能原因**:
- Tone.js 版本不兼容
- 浏览器不支持某些 API
- 代码有未捕获的异常

**解决方案**:
- 检查浏览器控制台错误详情
- 尝试不同浏览器 (Chrome/Firefox/Safari)
- 添加 try-catch 并记录具体错误

---

## 验证后的行动

### 如果验证通过:
1. 更新 PHASE2_PROGRESS.md:
   - Phase 2.7 状态: ⚠️ → ✅
   - 总体进度: 74% → 78%
   - 添加验证结果摘要

2. 创建验证报告 (PHASE2.7_VERIFICATION_RESULT.md):
   - 截图附件
   - 音色描述
   - 遇到的问题和解决方案

3. 提交 Git:
   ```
   git add docs/phase2/PHASE2_PROGRESS.md PHASE2.7_VERIFICATION_RESULT.md
   git commit -m "Phase 2.7 浏览器验证完成

   验证结果:
   - ✅ 4 个核心映射全部工作正常
   - ✅ 音色随表现力特征明显变化
   - ✅ 调试日志按预期输出

   详细验证报告: PHASE2.7_VERIFICATION_RESULT.md
   "
   ```

4. 继续 Phase 2.8

### 如果验证失败:
1. 记录问题详情:
   - 预期行为
   - 实际行为
   - 错误日志
   - 复现步骤

2. 修复代码并重新测试

3. 更新 PHASE2_PROGRESS.md:
   - 记录遇到的问题
   - 说明修复方案

4. 提交修复:
   ```
   git commit -m "修复 Phase 2.7 验证中发现的问题

   问题:
   - [描述问题]

   修复:
   - [描述修复方案]

   验证:
   - [验证结果]
   "
   ```

---

## 时间估算

- 步骤 1-3 (环境检查): 5 分钟
- 步骤 4-9 (功能测试): 15-20 分钟
- 截图和记录: 5 分钟
- 问题诊断 (如有): 10-30 分钟

**总计**: 25-60 分钟

---

## 重要提醒

**不要自我宣称"验证完成"，除非**:
- ✅ 所有复选框都勾选
- ✅ 有截图证据
- ✅ 有音色描述
- ✅ 所有预期日志都出现

**如果验证不充分**:
- ⚠️ 在文档中明确标注"验证不足"
- ⚠️ 不要说"Phase 2.7 完成 ✅"
- ⚠️ 不要继续 Phase 2.8，先完成验证

---

**创建日期**: 2025-10-31
**状态**: ⏳ 待用户执行验证
**目的**: 确保代码真正有效，避免"纸面完成"

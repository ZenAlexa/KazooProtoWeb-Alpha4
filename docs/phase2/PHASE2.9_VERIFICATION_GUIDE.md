# Phase 2.9 验证指南 - AudioWorklet 低延迟模式

**日期**: 2025-11-01
**版本**: Phase 2.9 Task 1-4 完成
**服务器**: http://localhost:50656
**预计时间**: 15-20 分钟

---

## 🎯 验证目标

1. **延迟改善**: 确认延迟从 78.79ms → 8-15ms (**-81%**)
2. **Worklet 模式**: 确认 AudioWorklet 成功启动 (非 ScriptProcessor fallback)
3. **特征准确性**: 验证 brightness, breathiness, articulation 正确工作
4. **性能稳定性**: 确认无音频断裂、丢帧或异常

---

## 📋 前置准备

### 1. 检查代码变更

```bash
git log --oneline -5
```

预期输出:
```
121659d Phase 2.9 Task 4 完成: 启用 AudioWorklet 模式 ⚡
a9f3cd9 Phase 2.9 Task 3 完成: audio-io.js 支持 pitch-frame 消息
78f2ad9 Phase 2.9 Task 2 完成: 简化 OnsetDetector 移植到 Worklet
fbddce5 Phase 2.9 Task 1 完成: Worklet 端 FFT + 特征提取
7189d77 Phase 2.9 规划完成: AudioWorklet 路径恢复方案
```

### 2. 确认服务器运行

```bash
# 检查进程
ps aux | grep "serve"

# 或使用 npm
npm start
```

访问: http://localhost:50656

### 3. 浏览器要求

- ✅ **推荐**: Chrome 109+ (最佳 AudioWorklet 支持)
- ⚠️ **可选**: Safari 14.1+ (自动回退 256 buffer)
- ❌ **不支持**: Edge < 79, Firefox < 76

---

## ✅ 验证步骤

### 步骤 1: 初始化检查 (2 分钟)

**操作**:
1. 打开 http://localhost:50656
2. 打开 **开发者工具** (F12 或 Cmd+Opt+I)
3. 切换到 **Console** 标签
4. **不要点击** "开始录音" 按钮

**预期日志** (启动时):

```
[AudioConfig] 音频系统配置
🎵 采样率: 44100 Hz
📦 推荐 Buffer: 128 samples
⏱️  理论延迟: 2.90 ms
🔧 AudioWorklet: 启用
🌐 浏览器: Chrome XXX
✅ AudioWorklet 支持: 是
```

**验证点**:
- ✅ `AudioWorklet: 启用` (不是 "禁用")
- ✅ `推荐 Buffer: 128 samples` (不是 2048)
- ✅ `理论延迟: 2.90 ms` (不是 46.44ms)
- ✅ `AudioWorklet 支持: 是`

**如果失败**:
- ❌ Safari 显示 `推荐 Buffer: 256 samples` → **正常** (Safari 回退)
- ❌ 显示 `AudioWorklet: 禁用` → 检查 [js/audio-io.js:32](../../js/audio-io.js#L32) 应为 `useWorklet: true`

---

### 步骤 2: Worklet 启动验证 (3 分钟)

**操作**:
1. 点击 **"开始录音"** 按钮
2. 允许麦克风权限
3. 观察 Console 日志

**预期日志** (按顺序):

```
[AudioIO] 🚀 启动音频系统
[AudioIO] 📌 选择模式: worklet                    ← 关键1
[AudioIO] ⚙️  设置 AudioWorklet 处理链路...
[AudioIO] 📦 加载 Worklet 模块: js/pitch-worklet.js
[AudioIO] ✅ Worklet 模块加载成功
[AudioIO] ✅ AudioWorkletNode 已创建

[PitchWorklet] 🎵 Worklet 处理器已创建 - Phase 1 完整版
[PitchWorklet] ✅ SimpleFFT 初始化完成 (2048 点)         ← 关键2
[PitchWorklet] ✅ EMA 滤波器初始化完成                  ← 关键3
[PitchWorklet] ✅ SimpleOnsetDetector 初始化完成         ← 关键4
[PitchWorklet] ✅ Phase 2.9 Worklet 初始化完成 (YIN + FFT + EMA)

[AudioIO] ✅ Worklet 已就绪                         ← 关键5
[AudioIO] 🔗 AudioWorklet 链路: Mic → WorkletNode → Destination
[AudioIO] ✅ AudioWorklet 处理链路已建立
[AudioIO] ✅ 启动成功: {
  mode: 'worklet',                                 ← 关键6
  latency: '8-15ms',                               ← 关键7
  sampleRate: '44100Hz'
}
```

**验证点**:
- ✅ `选择模式: worklet` (不是 `script-processor`)
- ✅ `SimpleFFT 初始化完成` (Phase 2.9 新增)
- ✅ `EMA 滤波器初始化完成` (Phase 2.9 新增)
- ✅ `SimpleOnsetDetector 初始化完成` (Phase 2.9 新增)
- ✅ `Phase 2.9 Worklet 初始化完成`
- ✅ `latency: '8-15ms'` (Chrome) 或 `'12-20ms'` (Safari)

**如果失败**:
- ❌ 显示 `选择模式: script-processor` → Worklet 加载失败，自动回退
  - 检查 Console 错误信息
  - 检查 [js/pitch-worklet.js](../../js/pitch-worklet.js) 是否有语法错误
- ❌ 显示 `⚠️  回退到 ScriptProcessor 模式` → 浏览器不支持或加载失败
  - Safari < 14.1: 升级浏览器
  - Chrome: 检查 CORS 策略

---

### 步骤 3: 音高检测测试 (3 分钟)

**操作**:
1. 对着麦克风哼唱 "啊~~~" (持续 3 秒)
2. 观察 Console 日志

**预期日志**:

```
[ContinuousSynth] 🎵 频率更新: 261.63 Hz (C4, 持续 0.0 秒)
[ContinuousSynth] 🎵 频率更新: 261.63 Hz (C4, 持续 0.1 秒)
[ContinuousSynth] 🎵 频率更新: 261.63 Hz (C4, 持续 0.2 秒)
...
```

**验证点**:
- ✅ 频率持续更新 (间隔 ~50ms)
- ✅ 音符识别正确 (例如 C4)
- ✅ 听到连续的合成器声音 (不是断断续续)

**性能指标** (每隔 5-10 秒打印一次):
```
[Performance] 平均延迟: 12.3ms  (目标 < 20ms)   ← 关键
[Performance] FPS: 60 (目标 > 50)
```

**如果失败**:
- ❌ 无日志输出 → 麦克风未授权或音量太小
- ❌ 声音断断续续 → FFT 性能问题 (见故障排查)

---

### 步骤 4: 表现力特征测试 (5 分钟)

#### 测试 A: Brightness (音色亮度)

**操作**:
1. 唱 "啊~~~" (明亮音色，嘴巴张大)
2. 切换到 "呜~~~" (暗淡音色，嘴巴收小)
3. 观察合成器音色变化

**预期行为**:
- ✅ "啊~~~": 音色明亮，高频丰富
- ✅ "呜~~~": 音色暗淡，低频为主

**控制台验证**:
```
[ContinuousSynth] 🌟 Brightness 变化: 0.72 → Filter: 4500 Hz
[ContinuousSynth] 🌟 Brightness 变化: 0.32 → Filter: 1200 Hz
```

#### 测试 B: Breathiness (气声度)

**操作**:
1. 唱 "啊~~~" (清晰发声，无气声)
2. 唱 "哈~~~" (带气声，声带不完全闭合)
3. 观察合成器噪声层

**预期行为**:
- ✅ 清晰发声: 纯音，无明显噪声
- ✅ 带气声: 听到背景噪声，类似耳语

**控制台验证**:
```
[ContinuousSynth] 💨 Breathiness: 0.15 (noise: 5%)
[ContinuousSynth] 💨 Breathiness: 0.68 (noise: 20%)
```

#### 测试 C: Articulation (起音检测)

**操作**:
1. 断续哼唱: "啊 - 啊 - 啊" (每个音符间停顿 0.5 秒)
2. 观察合成器起音/释放

**预期行为**:
- ✅ 听到明显的 attack (起音) 效果
- ✅ 每个音符独立触发
- ✅ 音符间有 release (释放)

**控制台验证**:
```
[ContinuousSynth] 🎺 起音触发: C4 (articulation: attack)
[ContinuousSynth] 🔇 释放: C4 (articulation: release)
[ContinuousSynth] 🎺 起音触发: C4 (articulation: attack)
```

**如果失败**:
- ❌ articulation 始终为 'sustain' → OnsetDetector 未工作
  - 检查 [js/pitch-worklet.js](../../js/pitch-worklet.js) SimpleOnsetDetector 是否初始化
- ❌ 无 brightness/breathiness 日志 → FFT 计算失败
  - 检查 Console 错误信息

---

### 步骤 5: 延迟对比测试 (3 分钟)

#### 方法 A: 主观感受

**操作**:
1. 对着麦克风唱 "啊~~~"
2. 注意**声音响应速度** (耳机必须戴好)

**预期体验**:
- ✅ **Phase 2.9 (Worklet)**: 几乎即时响应，延迟不明显
- ❌ **Phase 2.8 (ScriptProcessor)**: 明显延迟，像回声

#### 方法 B: 客观测量

**操作**:
1. 查看 Performance 面板日志:

```
[Performance] 音频系统性能:
  模式: worklet                          ← 确认
  理论延迟: 2.90 ms                      ← Chrome 目标
  实际延迟: 12.3 ms                      ← 实测值
  Buffer Size: 128 samples
  采样率: 44100 Hz
```

2. 对比 Phase 2.8 数据 (如果有):

| 指标 | Phase 2.8 (ScriptProcessor) | Phase 2.9 (Worklet) | 改善 |
|-----|----------------------------|-------------------|------|
| 理论延迟 | 46.44 ms | 2.90 ms | **-94%** |
| 实际延迟 | 78.79 ms | 8-15 ms | **-81%** |
| Buffer Size | 2048 samples | 128 samples | **-94%** |

**验证点**:
- ✅ 实际延迟 < 20ms (Chrome)
- ✅ 实际延迟 < 30ms (Safari)
- ✅ 比 Phase 2.8 快至少 **5 倍**

---

### 步骤 6: 稳定性测试 (4 分钟)

**操作**:
1. 持续哼唱 **2 分钟** (不间断)
2. 期间观察:
   - Console 是否有错误
   - 音频是否断裂
   - 性能是否下降

**预期行为**:
- ✅ 无 Console 错误
- ✅ 音频流畅，无断裂
- ✅ 延迟稳定 (无明显波动)
- ✅ 无内存泄漏 (打开 Performance 面板 Memory 标签)

**监控指标**:
```
[Performance] 平均延迟: 11.2ms → 12.5ms (小幅波动正常)
[Performance] FPS: 60 → 59 (稳定)
[Performance] 丢帧: 0 (目标 < 5)
```

**如果失败**:
- ❌ 音频断裂 → FFT 计算超时 (见故障排查)
- ❌ 延迟持续上升 → 内存泄漏或 GC 压力
- ❌ 大量 `[PitchWorklet] error` → Worklet 线程崩溃

---

## 🔍 故障排查

### 问题 1: Worklet 未启动 (回退到 ScriptProcessor)

**症状**:
```
[AudioIO] 选择模式: script-processor
[AudioIO] ⚠️  回退到 ScriptProcessor 模式
```

**原因**:
1. `useWorklet: false` (未启用)
2. 浏览器不支持 AudioWorklet
3. pitch-worklet.js 加载失败

**解决**:
```bash
# 检查配置
grep "useWorklet" js/audio-io.js
# 应该看到: useWorklet: true

# 检查文件存在
ls -la js/pitch-worklet.js

# 检查浏览器版本
# Chrome: chrome://version
# Safari: 关于本机 → Safari
```

---

### 问题 2: FFT 性能问题 (音频断裂)

**症状**:
- 声音断断续续
- Console 大量 `[PitchWorklet] processing timeout` 错误
- 延迟 > 50ms

**原因**: SimpleFFT DFT 算法 (O(N²)) 在某些设备上太慢

**临时解决**:
1. 降低 FFT 大小 (不推荐，影响精度):
   ```javascript
   // pitch-worklet.js Line 184
   this.fft = new SimpleFFT(1024);  // 从 2048 → 1024
   ```

2. 禁用 FFT (测试用):
   ```javascript
   // pitch-worklet.js Line 364-366
   // 注释掉 FFT 计算
   // const powerSpectrum = this.fft.computePowerSpectrum(...);
   ```

**长期方案**: 使用 WASM 优化 FFT (Phase 3)

---

### 问题 3: OnsetDetector 不工作

**症状**:
- articulation 始终为 'sustain'
- 无 attack/release 日志

**原因**:
1. SimpleOnsetDetector 未初始化
2. volumeDb 计算错误

**解决**:
```javascript
// 检查 pitch-worklet.js Line 302-307
// 应该看到:
this.onsetDetector = new SimpleOnsetDetector({
    energyThreshold: 3,
    silenceThreshold: -40,
    minStateDuration: 50
});
```

**调试日志** (临时添加):
```javascript
// pitch-worklet.js Line 499 之后
console.log('[DEBUG] volumeDb:', volumeDb, 'articulation:', articulation);
```

---

### 问题 4: 无声音输出

**症状**:
- 看到日志但听不到声音
- Tone.js 未启动

**原因**:
1. Tone.js 未初始化
2. 音量设置为 0
3. 系统静音

**解决**:
```bash
# 检查 Tone.js 初始化
# Console 中输入:
Tone.context.state
# 应该看到: "running"

# 检查音量
Tone.Master.volume.value
# 应该看到: 0 (正常) 或 -Infinity (静音)

# 手动启动 Tone.js (如果是 suspended)
await Tone.start()
```

---

## 📊 成功标准

### 必须满足 (P0)

- ✅ Worklet 模式成功启动 (无回退)
- ✅ 实际延迟 < 20ms (Chrome) 或 < 30ms (Safari)
- ✅ 所有 Phase 2.7 测试场景通过 (brightness, breathiness, cents)
- ✅ 无音频断裂或丢帧 (2 分钟持续测试)
- ✅ PitchFrame 11 个字段全部有效

### 应该满足 (P1)

- ✅ FFT 处理时间 < 1ms (不阻塞 Worklet)
- ✅ Brightness/Breathiness 误差 < 10% (vs Phase 2.7 ScriptProcessor 模式)
- ✅ Articulation 检测准确率 > 80% (断音场景)
- ✅ 性能稳定 (延迟波动 < 5ms)

### 可选满足 (P2)

- ✅ Safari 完全兼容 (256 buffer)
- ✅ 运行时切换 Worklet ↔ ScriptProcessor
- ✅ 性能监控面板 (CPU, 延迟, 丢帧)

---

## 📝 验证报告模板

完成验证后，请填写以下报告:

```markdown
## Phase 2.9 验证报告

**日期**: YYYY-MM-DD
**验证人**: [您的名字]
**浏览器**: Chrome/Safari XXX
**系统**: macOS/Windows/Linux

### 1. Worklet 启动

- [ ] Worklet 模式成功启动
- [ ] 理论延迟: _____ ms
- [ ] 实际延迟: _____ ms
- [ ] 启动日志完整 (无错误)

### 2. 音高检测

- [ ] 频率识别正确
- [ ] 音符识别正确
- [ ] 声音连续流畅

### 3. 表现力特征

- [ ] Brightness 测试通过
- [ ] Breathiness 测试通过
- [ ] Articulation 测试通过

### 4. 性能稳定性

- [ ] 2 分钟无断裂
- [ ] 延迟稳定 (< 20ms)
- [ ] 无内存泄漏

### 5. 问题记录

- 问题 1: [描述]
- 问题 2: [描述]

### 6. 总体评价

- [ ] ✅ 通过 - 可以进入 Phase 2.10
- [ ] ⚠️ 有问题但可接受
- [ ] ❌ 失败 - 需要修复

**备注**: [其他说明]
```

---

## 🎯 下一步

验证通过后:
1. 创建 `PHASE2.9_VERIFICATION_RESULT.md` (复制上面的报告模板)
2. 更新 `PHASE2_PROGRESS.md` (Phase 2.9: 70% → 100%)
3. Git 提交: `Phase 2.9 浏览器验证通过`
4. 开始 Phase 2.10: 测试基础设施完善

验证失败:
1. 记录问题到报告
2. 参考故障排查章节
3. 修复后重新验证
4. 如需帮助，提供完整 Console 日志

---

**文档版本**: 1.0
**最后更新**: 2025-11-01
**相关文档**:
- [PHASE2.9_PLAN.md](PHASE2.9_PLAN.md) - 实施方案
- [PHASE2_PROGRESS.md](PHASE2_PROGRESS.md) - 总体进度
- [PHASE2.7_VERIFICATION_RESULT.md](PHASE2.7_VERIFICATION_RESULT.md) - Continuous 模式验证

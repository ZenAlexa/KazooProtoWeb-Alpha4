# Phase 2.8 验证清单 - Legacy Synthesizer 表现力特征适配

**验证目标**: 确保 `js/synthesizer.js` 正确消费 ExpressiveFeatures 提供的 PitchFrame 数据

**前置条件**:
- ✅ Phase 2.7 浏览器验证通过
- ✅ ExpressiveFeatures 正常运行
- ✅ AudioIO 链路建立成功

---

## 验证步骤

### 步骤 1: 环境检查

- [ ] 打开 http://localhost:50656
- [ ] 打开浏览器开发者工具 (F12)
- [ ] 控制台无语法错误
- [ ] 看到 `[Synthesizer] Effects chain created (Phase 2.8: with noise layer)`

### 步骤 2: 切换到 Legacy 模式

默认情况下，应用使用 Continuous 模式。需要切换到 Legacy Synthesizer:

**方法 1**: 修改 `main.js` 第 282 行
```javascript
// 将
const useContinuousEngine = true;
// 改为
const useContinuousEngine = false;
```

**方法 2**: 在控制台执行
```javascript
app.synthesizerEngine = synthesizerEngine;
```

- [ ] 成功切换到 Legacy Synthesizer 模式
- [ ] 控制台显示 `Using note-based Synthesizer Engine`

### 步骤 3: 启动音频系统

- [ ] 点击 "🎵 开始 Kazoo" 按钮
- [ ] 允许麦克风权限
- [ ] 控制台显示:
  ```
  [Synthesizer] Effects chain created (Phase 2.8: with noise layer)
  Synthesizer created: saxophone
  ```

---

## 功能验证

### 场景 1: 稳定音符 + 起音检测

**操作**: 唱/哼一个稳定的音 (如 "啊~" 持续 2 秒)

**预期**:
- [ ] 听到 Legacy Synth 播放对应音符
- [ ] 控制台出现:
  ```
  [Synthesizer] 🎺 Attack: C4 (velocity: 0.xx)
  ```
- [ ] 停止发声时出现:
  ```
  [Synthesizer] 🔇 Release
  ```

**截图**: (粘贴控制台日志截图)

---

### 场景 2: 音符切换 (连音)

**操作**: 连续唱两个不同音高 (如 "Do-Mi-Do")

**预期**:
- [ ] 听到音符平滑切换
- [ ] 控制台出现:
  ```
  [Synthesizer] 🎺 Attack: C4 (velocity: 0.xx)
  [Synthesizer] 🎵 Note change (legato): E4
  [Synthesizer] 🎵 Note change (legato): C4
  ```

**截图**: (粘贴控制台日志截图)

---

### 场景 3: 音分微调 (Detune)

**操作**: 故意唱得"走音"一点，或用滑音

**预期**:
- [ ] 听到音高细微变化 (比纯音符更自然)
- [ ] 控制台出现 (当偏移 > 15 cents):
  ```
  [Synthesizer] 🎵 Detune: +23.5 cents
  [Synthesizer] 🎵 Detune: -18.2 cents
  ```

**音色感受**: 音高应该比固定音符更有"人声感"

**截图**: (粘贴控制台日志截图)

---

### 场景 4: 音色亮度 (Brightness)

**测试 A - 明亮音色**:
- **操作**: 用高音唱 "咿~" (嘴型扁平，类似微笑)
- **预期**:
  - [ ] 听到明亮、尖锐的音色
  - [ ] 控制台出现:
    ```
    [Synthesizer] 🌟 Brightness: 0.82 → Filter: 5200 Hz
    ```

**测试 B - 暗淡音色**:
- **操作**: 用低沉声音唱 "呜~" (嘴型圆润)
- **预期**:
  - [ ] 听到暗淡、低沉的音色
  - [ ] 控制台出现:
    ```
    [Synthesizer] 🌟 Brightness: 0.21 → Filter: 420 Hz
    ```

**音色对比**: 明亮音色应该明显比暗淡音色"亮"

**截图**: (粘贴两种音色的控制台日志)

---

### 场景 5: 气声效果 (Breathiness)

**操作**: 故意用气声唱 "哈~" (类似叹气声)

**预期**:
- [ ] 听到明显的气声/噪声混合
- [ ] 控制台出现:
  ```
  [Synthesizer] 💨 Breathiness: 0.65 (noise: 19%)
  [Synthesizer] 💨 Breathiness: 0.78 (noise: 23%)
  ```

**音色感受**: 应该听到类似管乐器的"气音"质感

**截图**: (粘贴控制台日志截图)

---

### 场景 6: 断音 (Articulation)

**操作**: 用断音唱 "哒-哒-哒" (每个音之间停顿)

**预期**:
- [ ] 每次起音都有明确的 Attack
- [ ] 每次停顿都有明确的 Release
- [ ] 控制台出现:
  ```
  [Synthesizer] 🎺 Attack: C4 (velocity: 0.xx)
  [Synthesizer] 🔇 Release
  [Synthesizer] 🎺 Attack: C4 (velocity: 0.xx)
  [Synthesizer] 🔇 Release
  ```

**音色感受**: 应该听到清晰的起音和释放

**截图**: (粘贴控制台日志截图)

---

## 技术验证

### 验证点 1: 噪声层初始化

在控制台执行:
```javascript
synthesizerEngine.noiseSource
synthesizerEngine.noiseGain
synthesizerEngine.noiseFilter
```

**预期**: 都返回 Tone.js 对象，而非 `null`

- [ ] `noiseSource` 是 Tone.Noise 实例
- [ ] `noiseGain` 是 Tone.Gain 实例
- [ ] `noiseFilter` 是 Tone.Filter 实例

---

### 验证点 2: Detune 支持

在控制台执行:
```javascript
synthesizerEngine.currentSynth.detune
```

**预期**: 返回 Tone.Signal 对象

**注意**: 如果返回 `undefined`，说明当前合成器类型不支持 detune (如 PluckSynth)

- [ ] Detune 参数存在并可用

---

### 验证点 3: 状态追踪

在控制台执行:
```javascript
synthesizerEngine.lastArticulationState
```

**预期**: 返回当前起音状态 ('silence' | 'attack' | 'sustain' | 'release')

- [ ] 发声时: 'attack' 或 'sustain'
- [ ] 静音时: 'silence' 或 'release'

---

## 常见问题诊断

### 问题 1: 听不到声音

**检查**:
1. 是否点击了 "开始 Kazoo" 按钮？
2. 麦克风权限是否允许？
3. 是否切换到了 Legacy 模式？(默认是 Continuous 模式)
4. 控制台是否有报错？

### 问题 2: 没有 Phase 2.8 日志

**检查**:
1. 是否使用 Legacy Synthesizer？(而非 ContinuousSynth)
2. 是否调用了 `processPitchFrame()` 而非 `processPitch()`？
3. main.js 是否正确传递 PitchFrame？

**验证**: 在 `main.js` 搜索调用 synthesizer 的代码

### 问题 3: Detune 不工作

**原因**: 某些 Tone.js 合成器类型不支持 `detune` 参数

**不支持 detune 的类型**:
- PluckSynth (guitar)
- 某些自定义合成器

**解决**: 切换到 saxophone/violin/piano/flute 等标准音色

### 问题 4: 噪声层太明显/听不到

**调试**: 在控制台手动设置
```javascript
// 测试噪声层
synthesizerEngine.noiseGain.gain.value = 0.1;  // 10% 噪声

// 关闭噪声层
synthesizerEngine.noiseGain.gain.value = 0;
```

---

## 完成标准

**Phase 2.8 验证通过标准**:

✅ **必须满足**:
- [ ] 所有 6 个功能场景都完成测试
- [ ] 至少有 3 张控制台截图记录
- [ ] 所有 Phase 2.8 特征映射都有日志输出
- [ ] 噪声层、Detune、Brightness 三大功能可听/可见
- [ ] 起音/释放状态转换正确

⚠️ **注意事项**:
- **不要自我宣称"验证完成"**，除非所有复选框都勾选
- 必须在浏览器中实际运行并记录结果
- 音色变化应该是可听的，而非仅有日志

---

## 下一步

验证通过后:
1. 创建 `PHASE2.8_VERIFICATION_RESULT.md` 记录详细结果
2. 更新 `PHASE2_PROGRESS.md` 标记 Phase 2.8 完成
3. 提交 git commit
4. 准备 Phase 2.9 - AudioWorklet 路径恢复

---

**验证日期**: _____________
**验证人员**: _____________
**浏览器版本**: _____________
**验证状态**: ⏳ 待验证

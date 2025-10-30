# 测试指南 - 声音合成和可视化功能

**测试地址**: http://localhost:55603 (或者你的本地服务器端口)

---

## 🎯 测试目标

1. ✅ 验证音高检测是否工作
2. ✅ 验证声音合成是否有输出 ⚠️ **这是关键问题**
3. ✅ 验证新的可视化功能（音符标签、网格线）

---

## 📋 测试步骤

### 步骤 1: 打开页面
1. 在浏览器中打开 `http://localhost:55603`
2. 打开浏览器开发者工具 (F12 或 Cmd+Option+I)
3. 切换到 "Console" 标签页

### 步骤 2: 检查初始化
页面加载后，你应该在控制台看到：
```
Initializing Kazoo App (No-Calibration Version)...
App initialized - Ready to play!
```

### 步骤 3: 点击 "Start Playing"
1. 选择一个乐器（默认是 Saxophone）
2. 点击 "Start Playing" 按钮
3. 允许麦克风权限

**预期控制台输出**:
```
Starting Kazoo Proto...
Initializing audio input...
Initializing synthesizer...
Tone.js AudioContext resumed after user gesture
Tone.js initialized: {...}
Effects chain created
Synthesizer created: saxophone
Initializing pitch detector...
Starting microphone...
✓ Kazoo Proto is running!
```

⚠️ **关键检查**: 确保看到 `Tone.js AudioContext resumed` 和 `Synthesizer created: saxophone`

### 步骤 4: 唱歌或哼唱
开始发出声音（唱歌、哼唱、或者吹口哨）

**预期看到的界面变化**:
- ✅ 音高曲线开始绘制（蓝色线条）
- ✅ 网格线显示 C3, C4, C5 参考线
- ✅ 曲线末端有蓝色圆点
- ✅ 音符标签（如 "C4", "G4"）跟随圆点
- ✅ 状态栏显示: 当前音符、频率、置信度、延迟
- ✅ 频率范围标签 (65Hz - 1047Hz)

**预期控制台输出** (如果检测到音高):
```
[Synthesizer] Processing: C4 (261.6Hz, conf: 0.85, vol: 0.45)
[Synthesizer] 🎵 Playing note: C4, velocity: 0.90, instrument: saxophone
[Synthesizer] Tone.context.state: running
[Synthesizer] Triggered sustained sound
```

### 步骤 5: 声音测试

**🔊 你应该听到声音吗？**
- **是的！** 你应该听到萨克斯风（或你选择的乐器）的声音
- 声音应该跟随你的哼唱音高变化
- 延迟应该很低 (<50ms)

**❌ 如果没有听到声音:**

检查控制台是否有以下日志：

1. **置信度过低**:
   ```
   [Synthesizer] Low confidence: 0.45 < 0.60
   ```
   → 解决方案: 大声一点唱，或者靠近麦克风

2. **没有检测到音高**:
   ```
   (没有任何 [Synthesizer] 日志)
   ```
   → 解决方案: 检查麦克风是否工作，尝试唱 "啊啊啊" 的持续音

3. **Tone.context 状态错误**:
   ```
   [Synthesizer] Tone.context.state: suspended
   ```
   → 解决方案: 点击页面任意位置，然后重新点击 Start Playing

4. **合成器未初始化**:
   ```
   [Synthesizer] Synth not initialized!
   ```
   → 解决方案: 刷新页面重试

---

## 🔍 调试检查清单

### 音频系统检查
在控制台输入以下命令来检查状态：

```javascript
// 检查 Tone.js 状态
console.log('Tone.context.state:', Tone.context.state);
console.log('Tone.Destination.mute:', Tone.Destination.mute);

// 检查合成器状态
console.log('Synthesizer status:', synthesizerEngine.getStatus());

// 检查音频输入
console.log('AudioContext state:', audioInputManager.audioContext.state);
console.log('Is running:', app.isRunning);
```

**预期正常输出**:
```javascript
Tone.context.state: "running"         // ✅ 必须是 running
Tone.Destination.mute: false          // ✅ 必须是 false
Synthesizer status: {
  isPlaying: true,                    // ✅ 唱歌时应该是 true
  currentNote: "C4",                  // ✅ 应该显示当前音符
  currentInstrument: "saxophone",     // ✅ 应该显示当前乐器
  expressiveness: {...}
}
AudioContext state: "running"         // ✅ 必须是 running
Is running: true                      // ✅ 必须是 true
```

### 手动触发测试音
如果检测到音高但没有声音，在控制台手动触发一个测试音：

```javascript
// 手动播放 C4 音符
synthesizerEngine.playNote('C4', 261.63, 0.8);

// 5秒后停止
setTimeout(() => synthesizerEngine.stopNote(), 5000);
```

**如果能听到测试音**:
→ 说明合成器工作正常，问题在音高检测或置信度阈值

**如果听不到测试音**:
→ 说明合成器或 Tone.js 有问题

---

## 🎨 可视化测试

### 预期的可视化效果

1. **网格线** (灰色水平线):
   - C3 线 (~130Hz)
   - C4 线 (~262Hz) - 中间
   - C5 线 (~523Hz)

2. **音高曲线** (蓝色):
   - 3px 宽
   - 圆角连接
   - 从右向左滚动
   - 最多显示 200 个数据点

3. **当前音符** (曲线末端):
   - 蓝色圆点 (5px 半径)
   - 深蓝色背景标签
   - 白色音符文本 (如 "C4")

4. **频率标签** (右上/右下):
   - 右上: "1047Hz"
   - 右下: "65Hz"

### 截图对比
如果可视化不正确，截图发给我查看。

---

## 🐛 常见问题

### 问题 1: 麦克风权限被拒绝
**症状**: 提示 "Failed to start: Permission denied"
**解决方案**:
1. 检查浏览器地址栏的麦克风图标
2. 允许麦克风权限
3. 刷新页面重试

### 问题 2: HTTPS 要求
**症状**: "getUserMedia is not supported"
**解决方案**:
- 确保使用 `localhost` (已经满足)
- 或使用 HTTPS

### 问题 3: 音高检测不稳定
**症状**: 曲线跳动，音符频繁变化
**解决方案**:
- 唱单一稳定的音（如 "啊~~~"）
- 避免滑音
- 使用耳机避免反馈
- 在安静环境中测试

### 问题 4: 延迟太高
**症状**: Latency 显示 >100ms
**解决方案**:
- 关闭其他音频应用
- 使用有线耳机
- 检查 CPU 使用率

---

## 📊 成功标准

测试成功的标志：

- ✅ 音高检测工作（曲线显示）
- ✅ **声音合成工作（能听到乐器声音）** ⚠️ 最重要
- ✅ 可视化显示网格线和音符标签
- ✅ 延迟 <50ms
- ✅ 可以切换乐器并听到不同音色
- ✅ 停止按钮能正常停止

---

## 📝 测试报告模板

测试完成后，请告诉我：

```
浏览器: Chrome 120 / Safari 17 / Firefox 121

1. 音高检测: ✅ 工作 / ❌ 不工作
   - 曲线显示: ✅ / ❌
   - 音符标签显示: ✅ / ❌
   - 网格线显示: ✅ / ❌

2. 声音合成: ✅ 有声音 / ❌ 无声音
   - 控制台日志: [粘贴关键日志]
   - Tone.context.state: running / suspended / closed
   - 测试音（手动触发）: ✅ 有声音 / ❌ 无声音

3. 性能:
   - 延迟: 23ms / 150ms / ...
   - CPU 使用率: 正常 / 偏高

4. 其他问题:
   - [描述任何其他问题]
```

---

**准备好了吗？**

1. 确保本地服务器运行在 http://localhost:55603
2. 打开浏览器开发者工具
3. 开始测试！

有任何问题或看到意外行为，立即告诉我控制台的输出 🔍

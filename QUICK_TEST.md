# 🎵 快速测试 - 修复后版本

## ✅ 已修复的问题

1. **❌ TypeError: performanceMonitor.recordFrame is not a function**
   - 修复完成 ✅
   - 改用正确的 API: `updateFPS()` + `getMetrics()`

2. **⚠️ 置信度阈值过高 (0.6)**
   - 修复完成 ✅
   - 降低到 0.3（你的置信度是 0.00-0.04，仍然偏低）

---

## 🔄 重新测试步骤

### 1. 刷新浏览器页面
**按 `Cmd + Shift + R` (Mac) 或 `Ctrl + Shift + R` (Windows)** 强制刷新

### 2. 打开开发者工具
**按 `F12` 或 `Cmd + Option + I`**

### 3. 点击 "Start Playing"

### 4. 大声唱歌或哼唱
**重要**: 之前你的置信度只有 0.00-0.04，可能是因为：
- 声音太小
- 离麦克风太远
- 唱得不够稳定

**建议**:
- **靠近麦克风**（10-15cm）
- **大声唱 "啊啊啊啊啊"** 持续音
- **音量要足够大**
- 尝试唱 **C4 (261Hz) 或 G4 (392Hz)** 的音高

---

## 🎯 预期结果

### ✅ 应该看到:
```
[Synthesizer] Processing: C4 (261.6Hz, conf: 0.35, vol: 0.45)
[Synthesizer] 🎵 Playing note: C4, velocity: 0.90, instrument: saxophone
[Synthesizer] Tone.context.state: running
[Synthesizer] Triggered sustained sound
```

### ❌ 不应该再看到:
```
TypeError: performanceMonitor.recordFrame is not a function  ← 应该消失了
```

### ⚠️ 如果还是看到 "Low confidence":
```
[Synthesizer] Low confidence: 0.04 < 0.3
```

**说明**: 麦克风音量太小或音高检测不到清晰的音调

**解决方案**:
1. **检查麦克风权限**: 确保浏览器允许使用麦克风
2. **检查系统音量**: 系统设置 → 声音 → 输入 → 确保麦克风音量是满的
3. **靠近麦克风**: 距离 10cm 左右
4. **大声唱**: 尽可能大声，唱稳定的 "啊~~~" 音
5. **选择正确的麦克风**: 如果有多个麦克风设备，确保选择了正在使用的那个

---

## 🔊 声音测试

### 手动测试合成器
如果还是听不到声音，在控制台输入：

```javascript
// 测试 C4 音符（萨克斯风，5秒）
synthesizerEngine.playNote('C4', 261.63, 0.8);
setTimeout(() => synthesizerEngine.stopNote(), 5000);
```

**如果能听到声音**:
→ ✅ 合成器工作正常，问题在音高检测置信度太低

**如果听不到声音**:
→ ❌ 检查:
```javascript
console.log('Tone.context.state:', Tone.context.state);
console.log('Tone.Destination.mute:', Tone.Destination.mute);
console.log('Volume:', Tone.Destination.volume.value);
```

预期输出:
```
Tone.context.state: "running"  ← 必须是 running
Tone.Destination.mute: false   ← 必须是 false
Volume: 0                      ← 0 dB 是正常音量
```

如果 `state: "suspended"`, 点击页面任意位置并重新点击 Start Playing

---

## 📊 诊断置信度太低的问题

如果置信度一直 <0.3，可能需要进一步降低阈值或检查音高检测器。

**在控制台输入以下命令查看原始数据**:

```javascript
// 临时降低阈值到 0.1 测试
synthesizerEngine.setConfidenceThreshold(0.1);
console.log('置信度阈值已降低到 0.1，再次尝试唱歌');
```

如果这样能听到声音，说明需要调整置信度计算算法。

---

## 💡 提示

### 为什么置信度这么低 (0.00-0.04)?

可能的原因:
1. **环境噪音**: 背景噪音影响音高检测
2. **麦克风质量**: 内置麦克风可能不够敏感
3. **音量太小**: 音高检测器需要足够的信号强度
4. **音色复杂**: 人声泛音丰富，YIN算法可能识别困难

### 改进建议:
1. 使用外置麦克风
2. 在安静环境测试
3. 大声且稳定地唱单音
4. 尝试吹口哨（纯音更容易检测）

---

## 📝 测试后告诉我

测试后请告诉我：

1. **TypeError 是否消失了？** ✅ 应该没有了
2. **能听到声音了吗？**
   - 如果能: ✅ 完美！
   - 如果不能: 告诉我控制台的日志
3. **置信度是多少？**
   - 如果 >0.3: ✅ 应该触发声音
   - 如果 <0.3: ⚠️ 需要进一步调试
4. **手动测试音是否能播放？**

---

**准备好了吗？刷新页面，重新测试！** 🚀

http://localhost:55603

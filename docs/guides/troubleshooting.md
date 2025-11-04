# 🔧 Kazoo Proto - 实战故障排查指南

## 📋 快速诊断步骤

### Step 1: 系统检查 (30秒)

访问: http://localhost:3000/debug-check.html

**期望结果**:
```
✓ AudioWorklet: Supported
✓ Microphone API: Available
✓ Config: Loaded
  clarityThreshold: 0.10
  minVolumeThreshold: 0.0005
  minConfidence: 0.01
  frequency range: 50-1500 Hz
✓ Tone.js: Loaded
```

**如果看到 ✗**: 浏览器不兼容，使用 Chrome/Firefox/Edge

---

### Step 2: 合成器测试 (10秒)

在 debug-check.html 点击 **"Test Synthesizer (440Hz)"**

**期望**: 听到清晰的 A4 音符 (440Hz) 持续0.5秒

**如果没有声音**:
- 检查系统音量
- 检查浏览器音频未被静音
- 打开控制台看错误信息

---

### Step 3: 麦克风测试 (30秒)

在 debug-check.html 点击 **"Test Microphone"**

**大声唱歌或说话**, 观察控制台输出:

```
期望:
Volume: 0.015324 RMS (-36.3 dB)  ← 应该 > 0.0005
Threshold check: PASS
```

**如果显示 FAIL**:
- 靠近麦克风 (5-15cm)
- 提高音量，大声唱
- 检查麦克风权限
- 尝试外置麦克风

**音量参考值**:
- 正常唱歌: 0.01 - 0.1 RMS (-40 ~ -20 dB)
- 大声唱: 0.1 - 0.3 RMS (-20 ~ -10 dB)
- 太小声: < 0.001 RMS (< -60 dB) ❌

---

### Step 4: 主应用测试 (60秒)

访问: http://localhost:3000/index.html

1. 点击 **"Start Playing"**
2. 允许麦克风权限
3. **大声唱歌** (持续3秒以上)
4. 打开控制台 (F12)

**期望看到**:
```javascript
[AudioIO] 📤 配置已下发到 Worklet: { clarityThreshold: 0.10, ... }
[PitchWorklet] 📥 收到主线程配置
[PitchWorklet] 🔧 clarityThreshold: 0.85 → 0.10
[Main] 🎯 handleWorkletPitchFrame 首次调用
✅ 检测到音高: 113.7 Hz (A#2), 置信度: 0.58
[ContinuousSynth] ▶ Started at 113.7 Hz
[ContinuousSynth] 🌟 Brightness: 0.07 → Filter: 3500 Hz
```

**关键指标**:
- frequency: 50-1500 Hz范围内
- confidence: > 0.01
- Filter: >= 3500 Hz (确保声音不被闷掉)

---

## 🐛 常见问题诊断

### 问题1: "没有检测到音高"

**症状**: 控制台只显示 `⚠️ 频率超出配置范围` 或 `❌ 音量过低`

**可能原因**:
1. 音量太小 (RMS < 0.0005)
2. 唱得太高或太低 (超出50-1500Hz)
3. 环境噪声过大

**解决方案**:

A) **临时禁用所有过滤** (在控制台运行):
```javascript
// 极限放宽阈值
app.config.pitchDetector.minVolumeThreshold = 0.00001;
app.config.pitchDetector.clarityThreshold = 0.01;
app.config.pitchDetector.minConfidence = 0.001;

// 重启
app.stop();
await app.start();

// 现在再次唱歌测试
```

B) **手动触发音高** (跳过检测):
```javascript
// 直接设置440Hz (A4)
continuousSynthEngine.setFrequency(440);
// 应该听到声音
```

C) **检查配置是否生效**:
```javascript
configManager.get().pitchDetector
// 应该返回:
// { clarityThreshold: 0.10, minVolumeThreshold: 0.0005, minFrequency: 50, maxFrequency: 1500 }
```

---

### 问题2: "合成器启动了但听不到声音"

**症状**: 控制台显示 `▶ Started at 113.7 Hz` 但没有声音

**可能原因**: 滤波器频率过低 (< 2000Hz) 导致声音被闷掉

**验证**:
```javascript
// 检查滤波器频率
continuousSynthEngine.filter.frequency.value
// 应该 >= 3500 Hz

// 检查合成器状态
continuousSynthEngine.isPlaying
// 应该 = true

// 检查音量
continuousSynthEngine.currentSynth.volume.value
// 应该 > -20 dB
```

**临时修复**:
```javascript
// 强制提高滤波器
continuousSynthEngine.filter.frequency.value = 5000;

// 强制提高音量
continuousSynthEngine.currentSynth.volume.value = 0;  // 0 dB (最大)
```

---

### 问题3: "停止后无法重启"

**症状**: 第一次唱歌正常，停顿后再唱就没声音了

**已修复**: Commit 26313eb

**验证修复**:
```javascript
// 检查状态重置逻辑
continuousSynthEngine.stop.toString().includes('lastArticulationState')
// 应该返回 true (说明已修复)
```

**如果仍有问题**:
```javascript
// 手动重置状态
continuousSynthEngine.lastArticulationState = 'silence';
continuousSynthEngine.isPlaying = false;

// 重新唱歌应该恢复
```

---

### 问题4: "配置未下发到 Worklet"

**症状**: 控制台显示 `⚠️ 未提供 appConfig,使用回退默认值`

**原因**: main.js 未正确传递配置到 AudioIO

**验证**:
```javascript
// 检查 audioIO 是否收到配置
app.audioIO.appConfig
// 应该返回完整配置对象

// 检查 Worklet 是否收到配置
// (需要查看启动时的控制台日志)
// 应该看到: [PitchWorklet] 🔧 clarityThreshold: 0.85 → 0.10
```

**修复**:
```javascript
// 重新配置 AudioIO
app.audioIO.configure({
    useWorklet: true,
    appConfig: configManager.get()
});

// 重启
app.stop();
await app.start();
```

---

## 🔍 高级调试

### 实时监控音频数据

在控制台运行:
```javascript
// 监听所有 PitchFrame 数据
let frameCount = 0;
const originalHandler = app.handleWorkletPitchFrame.bind(app);
app.handleWorkletPitchFrame = function(pitchFrame, timestamp) {
    frameCount++;
    if (frameCount % 10 === 0) {
        console.table({
            frequency: pitchFrame.frequency.toFixed(1) + ' Hz',
            note: pitchFrame.note + pitchFrame.octave,
            confidence: (pitchFrame.confidence * 100).toFixed(1) + '%',
            volumeDb: pitchFrame.volumeDb.toFixed(1) + ' dB',
            brightness: (pitchFrame.brightness * 100).toFixed(1) + '%',
            articulation: pitchFrame.articulation
        });
    }
    originalHandler(pitchFrame, timestamp);
};

console.log('✅ Frame monitor installed. Sing to see data.');
```

### 强制启用 ScriptProcessor 模式

如果 Worklet 有问题，回退到 ScriptProcessor:

```javascript
app.stop();
app.audioIO.configure({
    useWorklet: false,  // 强制使用 ScriptProcessor
    bufferSize: 2048
});
await app.start();

// 延迟会变高 (46ms)，但可能更稳定
```

---

## 📊 性能基准

**正常运行指标**:
- 延迟: 8-15ms (Worklet) 或 46ms (ScriptProcessor)
- CPU: 5-8% (单核)
- 检测频率: 10-20 Hz (每秒10-20次音高更新)
- 音量范围: -40 ~ -10 dB (正常唱歌)
- 置信度: 0.3 ~ 0.9 (清晰哼唱)

**异常指标**:
- ❌ 延迟 > 100ms: 音频系统问题
- ❌ CPU > 20%: 可能有性能bug
- ❌ 置信度 < 0.1: 噪声过大或唱得不清晰
- ❌ 音量 < -50 dB: 麦克风太远或增益太低

---

## 🚀 终极测试方案

如果以上都失败，运行完整验证:

1. 运行单元测试:
```bash
npm test
```
期望: 6/6 套件通过

2. 浏览器冒烟测试:
```bash
open tests/BROWSER_SMOKE_TEST.md
```
按文档执行 7 项验证

3. 如果仍失败，收集诊断信息:
```javascript
// 复制以下所有输出发送给开发者
console.log('=== DIAGNOSTIC INFO ===');
console.log('Browser:', navigator.userAgent);
console.log('AudioWorklet:', typeof AudioWorkletNode !== 'undefined');
console.log('Config:', JSON.stringify(configManager.get().pitchDetector, null, 2));
console.log('AudioIO mode:', app.audioIO?.mode);
console.log('Synth status:', continuousSynthEngine.isPlaying);
console.log('Filter freq:', continuousSynthEngine.filter.frequency.value);
console.log('Tone.js state:', Tone.context.state);
```

---

**创建时间**: 2025-11-02
**目标**: 快速定位和解决"无法使用"问题
**前提**: 本地服务器已启动 (npm start)

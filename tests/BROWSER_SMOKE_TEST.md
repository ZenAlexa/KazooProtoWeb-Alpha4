# 浏览器端冒烟测试清单

**版本**: Alpha 4 - Phase 2.10 P0 修复后
**目的**: 验证配置下发、音频链路、合成器参数是否正常工作
**时间**: 5-10 分钟
**重要性**: 🔥 **生死关头** - 部署前必须 100% 通过

---

## 📋 **测试前准备**

### 环境要求
- [ ] Chrome 66+ / Firefox 76+ / Safari 14.1+ / Edge 79+
- [ ] 麦克风设备可用 (USB 或内置)
- [ ] 耳机 (避免反馈回路)
- [ ] HTTPS 或 localhost (必需,否则无麦克风权限)

### 启动服务
```bash
npm start
# 访问: http://localhost:3000
```

---

## 🚨 **关键验证点 (P0 级别)**

### ✅ **测试 1: 配置加载验证** (MUST PASS)

**步骤**:
1. 打开浏览器开发者工具 (F12)
2. 刷新页面
3. 检查控制台输出

**期望日志** (按顺序出现):
```
[ConfigManager] 配置加载成功
[ConfigManager] 预设: default
[ConfigManager] 采样率: 44100
[ConfigManager] 缓冲区: 2048
[ConfigManager] Worklet: true
```

**❌ 失败标志**:
```
[Config] Using emergency fallback values  ← 🚨 致命错误!
```
**如果出现**: 配置系统完全崩溃,必须立即修复

---

### ✅ **测试 2: Worklet 配置下发验证** (P0 修复核心)

**步骤**:
1. 点击 "Start Playing"
2. 允许麦克风权限
3. 观察控制台

**期望日志** (关键信息):
```
[AudioIO] 📤 配置已下发到 Worklet: { clarityThreshold: 0.85, minFrequency: 80, maxFrequency: 1000, ... }
[PitchWorklet] 📥 收到主线程配置: { ... }
[PitchWorklet] 🔧 clarityThreshold: 0.85 → 0.85  (或其他值)
[PitchWorklet] 🔧 频率范围: 80-800 → 80-1000 Hz
[PitchWorklet] ✅ 配置已应用,Worklet 已使用主线程参数
```

**❌ 失败标志**:
- 没有 "配置已下发" 日志 → 配置未传递
- `clarityThreshold: 0.85 → 0.85` 没有变化 → 可能是默认值未被覆盖
- `频率范围: 80-800` 没有变成 `80-1000` → 硬编码未被替换

**验证方式**:
```javascript
// 在控制台执行:
window.configManager.get().pitchDetector
// 应返回: { clarityThreshold: 0.85, minFrequency: 80, maxFrequency: 1000 }
```

---

### ✅ **测试 3: 音频模式验证**

**步骤**:
1. 检查启动日志

**期望 (Worklet 模式 - 最佳情况)**:
```
🎵 AudioIO 已启动: { mode: 'worklet', latency: '8-15ms', sampleRate: '44100Hz' }
[PitchWorklet] 🎵 Worklet 处理器已创建 - Phase 2.10 配置下发修复版
```

**期望 (ScriptProcessor 回退 - 兼容模式)**:
```
🔄 [Legacy] 使用 audioInputManager
⚠️ 回退到 ScriptProcessor 模式
```

**❌ 失败标志**:
- 没有任何 "已启动" 日志 → 音频系统未初始化
- 浏览器控制台报错 → 代码语法错误或权限问题

---

### ✅ **测试 4: 合成器配置验证** (P0 修复)

**步骤**:
1. 页面加载完成后,在控制台执行:

```javascript
// 检查合成器是否使用了配置
window.continuousSynthEngine.appConfig
// 应返回完整的配置对象,包含 synthesizer.noiseGainMax 等

window.continuousSynthEngine.appConfig.synthesizer.noiseGainMax
// 应返回: 0.3 (默认值)
```

**期望**:
- `appConfig` 不为 `null`
- `noiseGainMax` 存在且为数字

**❌ 失败标志**:
- `appConfig` 为 `null` → 配置未注入
- `noiseGainMax` 为 `undefined` → 配置结构不完整

---

### ✅ **测试 5: 音频链路验证** (无麦克风直通)

**步骤**:
1. 点击 "Start Playing"
2. **不要哼唱** (保持安静)
3. 听是否有麦克风回声/卡祖笛效应

**期望**:
- 🔇 **完全静音** (没有任何麦克风回声)
- 只有哼唱时才有合成器声音

**❌ 失败标志**:
- 听到自己的声音 (麦克风直通) → 音频链路错误连接
- 持续噪音/嗡嗡声 → 可能是反馈回路

**紧急修复**:
检查 [audio-io.js](../js/audio-io.js:411) 是否有:
```javascript
// REMOVED: this.processorNode.connect(this.audioContext.destination);
```

---

### ✅ **测试 6: 基础音高检测**

**步骤**:
1. 哼唱一个稳定的音 (如 "啊~~~~")
2. 观察界面显示的音符和频率
3. 检查控制台是否有音高检测日志

**期望**:
- 界面显示音符 (如 "C4", "D4")
- 频率在 80-1000 Hz 范围内
- 置信度 > 50%
- 听到合成器声音 (萨克斯风等)

**❌ 失败标志**:
- 频率显示 0 Hz → 检测失败
- 置信度 < 10% → 阈值过高或麦克风问题
- 没有声音 → 合成器未启动

---

### ✅ **测试 7: 乐器切换**

**步骤**:
1. 点击不同的乐器按钮 (萨克斯、小提琴、钢琴...)
2. 哼唱同一个音

**期望**:
- 音色明显变化 (萨克斯 vs 钢琴区别明显)
- 没有崩溃或报错
- 切换响应快速 (< 100ms)

**❌ 失败标志**:
- 音色没有变化 → 乐器预设未生效
- 控制台报错 → 预设配置格式错误

---

## 🔍 **调试技巧**

### 查看完整配置
```javascript
window.configManager.get()
```

### 查看 Worklet 当前配置
```javascript
// Worklet 运行后,可在主线程检查:
window.app.audioIO.processorNode.port.postMessage({ type: 'get-stats', command: 'get-stats' })
// 然后观察控制台的 'stats' 消息
```

### 强制重新加载配置
```javascript
window.configManager.load({}, 'default')
location.reload()
```

### 检查乐器预设
```javascript
window.instrumentPresetManager.list()
// 应返回: ['saxophone', 'violin', 'piano', 'flute', 'guitar', 'synth']

window.instrumentPresetManager.get('saxophone')
// 应返回完整的预设对象
```

---

## ✅ **通过标准**

所有 7 个测试必须通过,尤其是:

1. ✅ 配置加载成功 (无 fallback 警告)
2. ✅ Worklet 配置下发成功 (看到参数变更日志)
3. ✅ 无麦克风直通 (静音时完全静默)
4. ✅ 音高检测正常 (频率、音符、置信度合理)

**如果任何一项失败** → 🚨 **不得部署到生产环境!**

---

## 📊 **测试结果记录**

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 1. 配置加载 | ⬜ 通过 / ⬜ 失败 | |
| 2. Worklet 配置下发 | ⬜ 通过 / ⬜ 失败 | |
| 3. 音频模式 | ⬜ Worklet / ⬜ Fallback | |
| 4. 合成器配置 | ⬜ 通过 / ⬜ 失败 | |
| 5. 无麦克风直通 | ⬜ 通过 / ⬜ 失败 | |
| 6. 音高检测 | ⬜ 通过 / ⬜ 失败 | |
| 7. 乐器切换 | ⬜ 通过 / ⬜ 失败 | |

**测试人**: _____________
**日期**: _____________
**浏览器**: _____________
**版本**: _____________

---

## 🚀 **下一步**

通过所有测试后:
- [ ] 运行 `npm test` (Node 端单元测试)
- [ ] 提交代码: `git add . && git commit -m "P0 修复完成"`
- [ ] 部署到 Vercel/Netlify
- [ ] 再次运行本清单 (生产环境验证)

**只有 100% 通过,才能开始 Phase 3 开发!**

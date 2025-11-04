# ScriptProcessor 修复测试指南

## 测试目的
验证 ScriptProcessor 模式下是否能正常输出音频（修复后应该有声音）

## 测试步骤

### 1. 禁用 AudioWorklet (强制使用 ScriptProcessor)

在浏览器 Console 中输入以下代码:

```javascript
// 临时禁用 AudioWorklet
window.AudioWorkletNode = undefined;
console.log('✅ AudioWorklet 已禁用，刷新页面将使用 ScriptProcessor');
```

### 2. 刷新页面

按 `Cmd+R` (Mac) 或 `Ctrl+R` (Windows) 刷新页面

### 3. 启动应用

1. 点击 "Start" 按钮
2. 允许麦克风权限
3. 哼唱或说话

### 4. 检查关键日志

**应该看到:**
```
📌 选择模式: script-processor
⚙️  设置 ScriptProcessor 处理链路 (回退模式)...
✅ ScriptProcessor 链路已建立 (静音连接，仅用于触发回调)  ← 新日志
✅ 启动成功: {mode: 'script-processor', latency: '~78ms'}
```

**关键变化:** 日志从 "分析用，不直接播放" 变为 **"静音连接，仅用于触发回调"**

### 5. 验证音频输出

**期望结果:**
- ✅ **听到合成的乐器声音** (这是关键!)
- ✅ Console 显示音高检测日志
- ✅ 可视化显示音高曲线
- ✅ 合成器正常工作

**如果失败:**
- ❌ 哼唱时没有声音
- ❌ 只有麦克风回声（不应该有）

## 预期对比

### 修复前 (TEST_RESULTS.md 中的问题)
```
✅ 降级成功: mode switched to script-processor
❌ 没有音频输出: 哼唱时没有声音  ← 问题
```

### 修复后 (预期)
```
✅ 降级成功: mode switched to script-processor
✅ 有音频输出: 听到合成的乐器声音  ← 修复成功!
```

## 技术原理

**问题根源:**
- ScriptProcessor 需要连接到 `destination` 才能触发 `onaudioprocess` 回调
- 之前没有连接,导致回调不触发,无法检测音高

**修复方案:**
```javascript
// 创建静音 GainNode
const silentGain = this.audioContext.createGain();
silentGain.gain.value = 0;  // 音量设为 0

// 连接链路: Mic → Processor → SilentGain → Destination
this.sourceNode.connect(this.processorNode);
this.processorNode.connect(silentGain);
silentGain.connect(this.audioContext.destination);
```

**为什么有效:**
- ✅ Destination 连接存在 → ScriptProcessor 回调触发
- ✅ GainNode 音量为 0 → 不播放麦克风输入（无回声）
- ✅ 合成器单独连接 destination → 正常输出音色

## 测试完成后

**恢复 Worklet 模式:**
1. 刷新页面即可恢复（不需要特殊操作）
2. AudioWorkletNode 会自动恢复
3. 下次启动会自动使用 Worklet

**报告结果:**
请复制 Console 的关键日志（最后 15-20 行）并告诉我:
1. 是否看到新的日志: "静音连接，仅用于触发回调"
2. 是否听到合成的乐器声音
3. 音高检测是否正常工作

---

**测试时间**: 预计 2-3 分钟

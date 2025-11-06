# Stage2 最终冲刺执行计划

**创建时间**: 2025-11-06
**目标**: 彻底完成依赖注入迁移，消除所有全局依赖
**当前状态**: 容器可用 ✅，测试通过 ✅，但全局兼容层仍存在 ⚠️

---

## 执行摘要

**当前问题**: 虽然 AppContainer 已投入使用且测试通过，但系统仍保留大量 `window.*` 全局兼容层，未完全脱离"双轨制"。

**目标**: 按优先级逐项清理全局依赖，使容器成为**唯一的服务来源**，完成 Stage2 承诺的"依赖注入落地"。

**预计时间**: 4-6 小时

**验证标准**:
- ✅ 所有服务通过容器注册和获取
- ✅ `window.*` 仅保留必要的应用入口（如 `window.app`）
- ✅ 浏览器功能回归测试通过
- ✅ 单元测试全部通过

---

## 一、当前全局依赖清单

### 1.1 模块级全局桥接（高优先级）

**位置**: [index.html](../../index.html) lines 242-249

```html
<!-- ExpressiveFeatures 与预设管理器 -->
<script src="js/features/expressive-features.js"></script>
<script src="js/config/instrument-presets.js"></script>
<script>
  window.ExpressiveFeatures = ExpressiveFeatures;
  window.instrumentPresetManager = instrumentPresetManager;
</script>
```

**问题**:
- 模块定义后立即挂到 `window`
- [js/main.js](../../js/main.js) lines 751-758 又从 `window` 读取并注册到容器
- 形成"模块 → window → 容器"的三级桥接

**解决方案**:
1. 在 `main.js` 顶部直接 `import` 这两个模块
2. 删除 `index.html` 中的桥接脚本块
3. 容器直接使用 import 的模块注册服务

---

### 1.2 核心服务全局暴露（高优先级）

**位置**: [js/main.js](../../js/main.js) lines 837-862

```javascript
// 暴露到全局以便调试和兼容性
window.configManager = configManager;
window.pitchDetector = pitchDetector;
window.performanceMonitor = performanceMonitor;
window.synthesizerEngine = synthesizerEngine;
window.continuousSynthEngine = continuousSynthEngine;
window.container = container;
window.app = app;
```

**问题**:
- Stage2 "双轨制"残留
- 鼓励全局访问而非依赖注入
- 增加维护负担（需同步容器和全局）

**解决方案**:
1. 仅保留 `window.app` 和 `window.container`（调试入口）
2. 其他服务通过 `window.container.get('serviceName')` 访问
3. 在代码中搜索所有 `window.configManager` 等引用并改为容器注入

---

### 1.3 AudioIO 未纳入容器（中优先级）

**位置**: [js/main.js](../../js/main.js) lines 251-292 (`KazooApp._startWithAudioIO`)

```javascript
const audioIO = new AudioIO({ ... });
this.audioIO = audioIO;
```

**问题**:
- `AudioIO` 在 `KazooApp` 内部直接实例化
- 未通过容器管理
- `window.audioIO` 缺失导致调试困难

**解决方案**:
1. 在容器注册阶段创建 `AudioIO` 实例
2. 通过构造函数注入到 `KazooApp`
3. 更新 `_startWithAudioIO` 使用 `this.audioIO`（注入的实例）

---

### 1.4 非模块化核心类（中优先级）

**当前状态**:
- `PitchDetector` ([js/pitch-detector.js](../../js/pitch-detector.js))
- `PerformanceMonitor` ([js/performance.js](../../js/performance.js))
- `SynthesizerEngine` ([js/synthesizer.js](../../js/synthesizer.js))
- `ContinuousSynthEngine` ([js/continuous-synth.js](../../js/continuous-synth.js))

**问题**:
- 文件末尾注释显示"非模块脚本定义 → 全局构造器"
- 依赖 HTML 中的 `<script>` 标签顺序加载
- 无法在 `main.js` 中使用 `import` 显式声明依赖

**解决方案**:
1. 每个文件添加 `export default ClassName;`
2. `main.js` 顶部添加相应的 `import` 语句
3. 更新 `index.html` 脚本加载方式（或准备 Stage3 模块化入口）

**注意**: 这一步可能触及 Stage3 领域，建议先完成 1.1-1.3，确保容器内部依赖链稳定后再处理。

---

### 1.5 延迟分析器全局访问（低优先级）

**位置**:
- [index.html](../../index.html) lines 223-231 (`window.__ENABLE_LATENCY_PROFILER__`)
- [js/main.js](../../js/main.js) lines 299-321 (`window.LatencyProfiler` 条件加载)

**问题**:
- 通过全局变量和条件判断注入
- 未纳入容器服务体系

**解决方案**（可选）:
1. 将 `LatencyProfiler` 注册为容器服务
2. 通过配置文件控制是否启用（而非全局变量）
3. 或保持现状（调试工具，影响较小）

---

## 二、执行清单（按优先级排序）

### 任务1: 移除 ExpressiveFeatures/PresetManager 全局桥接 ⚡

**文件**:
- [index.html](../../index.html)
- [js/main.js](../../js/main.js)
- [js/features/expressive-features.js](../../js/features/expressive-features.js)
- [js/config/instrument-presets.js](../../js/config/instrument-presets.js)

**步骤**:
1. 检查两个模块是否已是模块格式（有 `export`）
2. 在 `main.js` 顶部添加：
   ```javascript
   import ExpressiveFeatures from './features/expressive-features.js';
   import instrumentPresetManager from './config/instrument-presets.js';
   ```
3. 删除 `index.html` 中的 `<script>` 桥接块
4. 验证容器注册代码正常工作

**验证**: 浏览器控制台无 `undefined` 错误，功能正常

---

### 任务2: AudioIO 纳入容器 ⚡

**文件**:
- [js/main.js](../../js/main.js)
- [js/audio-io.js](../../js/audio-io.js)

**步骤**:
1. 在容器注册阶段添加：
   ```javascript
   container.register('audioIO', () => {
     return new AudioIO({
       onPitchDetected: (frame) => app.handleWorkletPitchFrame(frame),
       // ... 其他配置
     });
   });
   ```
2. `KazooApp` 构造函数新增参数 `audioIO`
3. 删除 `_startWithAudioIO` 中的 `new AudioIO()` 代码
4. 使用 `this.audioIO = audioIO;`

**验证**:
- 单元测试通过
- 浏览器能正常启动音频

---

### 任务3: 清理核心服务全局暴露 🔧

**文件**: [js/main.js](../../js/main.js) lines 837-862

**步骤**:
1. 删除以下行：
   ```javascript
   window.configManager = configManager;
   window.pitchDetector = pitchDetector;
   window.performanceMonitor = performanceMonitor;
   window.synthesizerEngine = synthesizerEngine;
   window.continuousSynthEngine = continuousSynthEngine;
   ```
2. 保留：
   ```javascript
   window.container = container; // 调试入口
   window.app = app; // 应用入口
   ```
3. 全局搜索 `window.configManager`、`window.pitchDetector` 等引用
4. 将所有引用改为 `window.container.get('serviceName')`

**验证**:
- 浏览器控制台可通过 `window.container.get('configManager')` 访问
- 应用功能不受影响

---

### 任务4: 核心类模块化导出（可选 Stage3） 📦

**文件**:
- [js/pitch-detector.js](../../js/pitch-detector.js)
- [js/performance.js](../../js/performance.js)
- [js/synthesizer.js](../../js/synthesizer.js)
- [js/continuous-synth.js](../../js/continuous-synth.js)

**步骤**:
1. 每个文件末尾添加：
   ```javascript
   export default ClassName;
   ```
2. `main.js` 顶部添加：
   ```javascript
   import PitchDetector from './pitch-detector.js';
   import PerformanceMonitor from './performance.js';
   // ... 等
   ```
3. 更新 `index.html` 移除这些文件的 `<script>` 标签

**风险**: 可能触发模块加载顺序问题，建议作为 Stage3 首个任务

**验证**: 浏览器能正常加载并运行

---

### 任务5: 延迟分析器容器化（低优先级） 🐌

**决策**: 暂不处理，保持现状

**理由**:
- 调试工具，非核心功能
- 改动收益小，风险中等
- 可在 Stage3 统一处理

---

## 三、验证策略

### 3.1 单元测试验证

```bash
npm test
```

**预期**: 所有测试通过（19/19 assertions）

---

### 3.2 浏览器功能验证

**测试清单**:
1. ✅ 打开 [index.html](../../index.html)，无控制台错误
2. ✅ 点击"启动"按钮，麦克风权限请求正常
3. ✅ 唱歌/哼唱，有声音输出
4. ✅ 切换乐器，音色变化正常
5. ✅ 检查 `window.container.get('configManager')` 返回正确对象
6. ✅ 检查 `window.app` 可访问
7. ✅ 检查 `window.audioIO` 已移除（改用容器获取）

---

### 3.3 回滚准备

**安全锚点**: 当前提交 `f7ebaa4`

**回滚命令**:
```bash
git reset --hard f7ebaa4
```

**提交策略**: 每完成一个任务提交一次，便于精确回滚

---

## 四、风险评估

| 任务 | 风险等级 | 影响面 | 缓解措施 |
|------|---------|--------|---------|
| 任务1 | 中 | ExpressiveFeatures 相关功能 | 先检查模块格式，逐步迁移 |
| 任务2 | 高 | 整个音频系统 | 保留旧代码作为备份，分步验证 |
| 任务3 | 低 | 调试和兼容性 | 先搜索所有引用，确保无遗漏 |
| 任务4 | 高 | 核心类加载 | 推迟到 Stage3，避免与当前任务耦合 |
| 任务5 | 低 | 延迟分析工具 | 暂不处理 |

---

## 五、执行顺序建议

### 第一阶段（2小时）
1. ✅ 任务3 - 清理全局暴露（风险低，收益高）
2. ✅ 任务1 - 移除桥接脚本（前置条件简单）

### 第二阶段（2-3小时）
3. ✅ 任务2 - AudioIO 容器化（核心重构，需仔细验证）

### 第三阶段（1小时）
4. ✅ 浏览器回归测试
5. ✅ 更新文档和进度报告

### 推迟到 Stage3
- 任务4 - 核心类模块化导出
- 任务5 - 延迟分析器容器化

---

## 六、完成标准

### 代码标准
- [ ] 所有服务通过 `container.register()` 注册
- [ ] `window.*` 仅保留 `app` 和 `container`
- [ ] 无模块级全局桥接脚本
- [ ] `AudioIO` 通过容器注入

### 测试标准
- [ ] `npm test` 全部通过
- [ ] 浏览器 7 项功能验证通过
- [ ] 无控制台错误或警告

### 文档标准
- [ ] 更新 [docs/refactoring/progress.md](./progress.md)
- [ ] 在 [PROJECT_STATUS.md](../../PROJECT_STATUS.md) 标记 Stage2 完成
- [ ] 创建阶段总结文档 `stage2-complete.md`

---

## 七、下一步（Stage3 预告）

完成本计划后，将进入 **Stage3: ES Module 入口改造**

**主要任务**:
1. `index.html` 改为单一 `<script type="module">`
2. 所有核心类改为 ES Module 格式
3. 梳理 import 依赖链
4. 评估 Vite/Rollup 打包需求

**前置条件**: Stage2 全局依赖清理完成 ✅

---

## 八、参考文档

- [PROJECT_STATUS.md](../../PROJECT_STATUS.md) - 项目整体状态
- [docs/refactoring/progress.md](./progress.md) - 重构进度跟踪
- [docs/refactoring/plan.md](./plan.md) - 完整重构计划
- [js/core/app-container.js](../../js/core/app-container.js) - 容器实现
- [tests/unit/app-container.test.js](../../tests/unit/app-container.test.js) - 容器测试

---

**创建者**: Claude Code
**最后更新**: 2025-11-06
**状态**: 待执行

# 三步走重构计划 (Refactoring Plan)

基于全面代码审查结果，采用渐进式、无损重构策略。

---

## 📋 重构原则

✅ **每一步都可独立测试**
✅ **保证现有功能不受影响**
✅ **可随时回滚**
✅ **增量提交，便于追溯**

---

## 🎯 第一步：清理和规范化 (2-3天)

### 目标
移除冗余代码，统一代码风格，建立日志系统

### 具体任务

#### 1.1 删除未使用的文件和代码 (4小时)
**风险等级：🟢 低** - 删除未引用的代码不影响运行

- [ ] 删除 `latency-profiler/` 目录（已确认未被使用）
- [ ] 删除 `js/audio-input.js`（已被 audio-io.js 替代）
- [ ] 删除 `js/tone-controls.js`（功能已整合）
- [ ] 删除 `css/` 目录下重复的样式文件
- [ ] 移除 HTML 中注释掉的大段代码（500+行）

**验证方法**：
```bash
# 删除前备份
git add -A && git commit -m "Backup before cleanup"

# 删除后测试
npm start
# 手动测试：录音、校准、播放、音高检测
```

#### 1.2 统一版本号管理 (30分钟)
**风险等级：🟢 低** - 仅改配置文件

- [ ] 将 `package.json` 版本号改为 `0.4.0`（与 app-config.js 一致）
- [ ] 添加版本号自动同步脚本
- [ ] 更新 README.md 中的版本信息

**文件变更**：
- `package.json` - 修改 version 字段
- 新增 `scripts/sync-version.js`

#### 1.3 建立日志系统，替换 console (6小时)
**风险等级：🟡 中** - 需要逐步替换

**策略**：保留现有 console，增加新日志系统，逐步迁移

- [ ] 创建 `js/utils/logger.js`
- [ ] 实现分级日志（DEBUG/INFO/WARN/ERROR）
- [ ] 支持开发/生产环境切换
- [ ] 在 3-5 个关键模块试点替换

**示例代码**：
```javascript
// js/utils/logger.js
export class Logger {
  constructor(moduleName) {
    this.moduleName = moduleName;
    this.isDev = window.location.hostname === 'localhost';
  }

  debug(...args) {
    if (this.isDev) console.log(`[${this.moduleName}]`, ...args);
  }

  info(...args) {
    if (this.isDev) console.info(`[${this.moduleName}]`, ...args);
  }

  warn(...args) {
    console.warn(`[${this.moduleName}]`, ...args);
  }

  error(...args) {
    console.error(`[${this.moduleName}]`, ...args);
  }
}
```

**试点模块**：
- `app.js` (替换 50 处 console)
- `audio-io.js` (替换 40 处)
- `pitch-detector.js` (替换 35 处)

#### 1.4 提取魔法数字为常量 (4小时)
**风险等级：🟢 低** - 不改变逻辑，只是抽取

- [ ] 创建 `js/config/constants.js`
- [ ] 抽取所有魔法数字（30+个）
- [ ] 添加清晰的注释说明

**示例**：
```javascript
// js/config/constants.js
export const AUDIO_CONSTANTS = {
  SAMPLE_RATE: 48000,
  BUFFER_SIZE: 4096,
  MIN_FREQUENCY: 80,      // Hz - 最低可检测音高
  MAX_FREQUENCY: 1000,    // Hz - 最高可检测音高
};

export const VISUAL_CONSTANTS = {
  BRIGHTNESS_GAMMA: 1.5,  // Math.pow(brightness, 1.5)
  CANVAS_HEIGHT_RATIO: 0.8, // canvas.height * 0.8
  PARTICLE_ALPHA: 0.7,
};

export const CALIBRATION_CONSTANTS = {
  RECORDING_DURATION: 2.0,  // 秒
  MIN_VALID_SAMPLES: 50,
  CONFIDENCE_THRESHOLD: 0.85,
};
```

#### 1.5 修复明显的 Bug (2小时)
**风险等级：🟢 低** - 修复现有问题

- [ ] 修复版本号不一致
- [ ] 修复 `latencyProfiler` 未定义错误
- [ ] 修复 `audioInputManager` 未清理的残留引用

**测试清单**：
```
✅ 应用启动无报错
✅ 麦克风权限申请正常
✅ 录音功能正常
✅ 校准流程完整
✅ 实时音高检测工作
✅ 音频播放正常
✅ 视觉效果显示
```

---

## 🏗️ 第二步：架构优化 (3-4天)

### 目标
优化模块结构，改善错误处理，提升可维护性

### 具体任务

#### 2.1 统一音频系统 (1天)
**风险等级：🟡 中** - 核心功能变更，需充分测试

**策略**：完全移除 `audio-input.js`，保留 `audio-io.js`

- [ ] 确认所有功能已迁移到 audio-io.js
- [ ] 删除 audio-input.js 文件
- [ ] 移除 audioInputManager 全局变量
- [ ] 更新 index.html 中的引用

**回滚方案**：
```bash
git revert HEAD  # 如果出问题立即回滚
```

**详细测试**：
- [ ] 麦克风权限申请
- [ ] 音频流获取
- [ ] AudioWorklet 初始化
- [ ] 实时音频处理
- [ ] 音频停止和清理
- [ ] 内存泄漏检查（Chrome DevTools）

#### 2.2 添加完整错误处理 (1天)
**风险等级：🟢 低** - 增强鲁棒性，不改变正常流程

- [ ] 包裹所有异步操作（async/await + try-catch）
- [ ] 添加用户友好的错误提示
- [ ] 实现优雅降级（例如：Worklet 失败回退到 ScriptProcessor）

**关键位置**：
```javascript
// app.js - _initializeEngines()
async _initializeEngines() {
  try {
    await this.audioIOManager.initialize();
  } catch (error) {
    logger.error('音频引擎初始化失败:', error);
    this._showError('无法初始化音频系统，请检查麦克风权限');
    throw error;
  }
}

// audio-io.js - _loadWorklet()
async _loadWorklet() {
  try {
    await this.audioContext.audioWorklet.addModule('./js/worklet/pitch-processor.js');
  } catch (error) {
    logger.error('AudioWorklet 加载失败:', error);
    // 降级到 ScriptProcessorNode
    return this._fallbackToScriptProcessor();
  }
}
```

#### 2.3 重构超长函数 (1天)
**风险等级：🟢 低** - 拆分不改变逻辑

**目标函数**：
- `app.js::_startWithAudioIO()` (85行) → 拆分为 3-4 个子函数
- `app.js::_initializeEngines()` (60行) → 拆分为 2-3 个子函数
- `pitch-detector.js::detectPitch()` (70行) → 拆分为 4-5 个子函数

**拆分原则**：
```javascript
// 之前：
_startWithAudioIO() {
  // 85 行代码...
}

// 之后：
_startWithAudioIO() {
  this._prepareAudioSession();
  this._setupEventHandlers();
  this._startAudioStream();
}

_prepareAudioSession() { /* ... */ }
_setupEventHandlers() { /* ... */ }
_startAudioStream() { /* ... */ }
```

#### 2.4 消除代码重复 (1天)
**风险等级：🟡 中** - 需要仔细测试共享逻辑

**重复代码位置**：
1. `audio-input.js::onAudioProcess()` vs `audio-io.js::handleWorkletPitchFrame()`
   - 抽取共享逻辑到 `pitch-processor-common.js`

2. 校准流程在多处重复
   - 抽取到 `calibration-manager.js`

3. UI 更新逻辑分散
   - 统一到 `ui-manager.js`

**示例**：
```javascript
// js/core/pitch-processor-common.js
export function processPitchData(frequency, confidence, contextData) {
  // 共享的音高处理逻辑
  if (confidence < contextData.thresholds.minConfidence) {
    return null;
  }

  const note = frequencyToNote(frequency);
  const cents = calculateCents(frequency, note);

  return { frequency, note, cents, confidence };
}
```

---

## 🧩 第三步：模块化重构 (4-5天)

### 目标
以依赖注入为核心消除全局对象，升级为 ES Module 架构，并建立可持续的测试体系。

### 阶段拆分

#### 3.1 基础设施（✅ 已完成）
- AppContainer、UIManager、Vitest 基础配置
- 文档与示例代码已经落地

#### 3.2 依赖注入落地（进行中）
**风险等级：🟡 中** — 涉及核心运行路径  
**任务清单**  
- [ ] `KazooApp` 改为使用注入的 `pitchDetector`、`performanceMonitor`、`continuousSynthEngine`  
- [ ] `continuous-synth.js`、`synthesizer.js`、`pitch-detector.js`、`performance.js` 仅导出类或工厂函数，不在模块内创建实例  
- [ ] 容器注册保持双轨制（实例创建权归容器，仍临时暴露 `window.*`）  
- [ ] 手动测试确认 Worklet / ScriptProcessor 两条路径都能启动  

#### 3.3 ES Module 入口与打包（计划）
**风险等级：🟡 中** — 需要调整加载顺序  
- [ ] `index.html` 改为单一 `<script type="module" src="js/main.js">`  
- [ ] 拆分旧的 `<script>` 标签，确保依赖通过 `import` 引入  
- [ ] 评估是否引入 Vite/Rollup 作为临时打包工具（可选）  
- [ ] 更新开发/部署脚本及文档（`npm start`、测试指令等）  

#### 3.4 UI 管理器接入与兼容层收敛（计划）
**风险等级：🟢 低**  
- [ ] 将状态徽章、音符显示、错误提示等逻辑迁移到 UIManager  
- [ ] 发布-订阅事件替换直接 DOM 操作  
- [ ] 分阶段移除 `window.*` 兼容层（记录每次移除的范围与回滚点）  

#### 3.5 测试覆盖率提升（计划）
**风险等级：🟢 低**  
- [ ] 为音频管线、依赖注入容器、UIManager 添加单元测试  
- [ ] 编写基础集成测试（音频启动、模式切换、错误路径）  
- [ ] 设置覆盖率门槛：`lines/functions/statements ≥ 40%`、`branches ≥ 30%`  
- [ ] 在阶段结束前生成一次覆盖率报告并归档至 `docs/testing/`  

### 验证建议
1. 每个子任务完成后运行 `npm test` 与手动冒烟测试  
2. 对关键浏览器兼容性（Chrome + Safari）进行现场验证  
3. 记录双轨制退场的时间点，保持可回滚策略  
4. 文档、脚本、测试结果保持同步更新

---

## 📊 风险评估矩阵

| 步骤 | 风险等级 | 回滚难度 | 建议策略 |
|------|---------|---------|---------|
| 1.1 删除冗余文件 | 🟢 低 | 易 | Git 保留删除前快照 |
| 1.2 版本号统一 | 🟢 低 | 易 | 直接修改 |
| 1.3 日志系统 | 🟡 中 | 中 | 保留旧 console，渐进迁移 |
| 1.4 魔法数字 | 🟢 低 | 易 | 逐个替换 |
| 1.5 修复 Bug | 🟢 低 | 易 | 每个 Bug 单独提交 |
| 2.1 统一音频系统 | 🟡 中 | 难 | 充分测试，准备回滚 |
| 2.2 错误处理 | 🟢 低 | 易 | 逐步添加 |
| 2.3 重构长函数 | 🟢 低 | 易 | 拆分不改逻辑 |
| 2.4 消除重复 | 🟡 中 | 中 | 抽取共享代码，双轨测试 |
| 3.1 基础设施 | 🟢 低 | 易 | 已完成，保持文档同步 |
| 3.2 依赖注入落地 | 🟡 中 | 中 | 双轨制迁移，随时回滚 |
| 3.3 ES 模块入口 | 🟡 中 | 难 | 调整加载顺序，充分测试 |
| 3.4 UI 管理器接入 | 🟢 低 | 易 | 事件驱动替换 DOM 操作 |
| 3.5 覆盖率提升 | 🟢 低 | 易 | 新增测试，不改现有逻辑 |

---

## ✅ 验证清单（每步完成后执行）

### 功能测试
```
□ 应用启动无报错
□ 麦克风权限申请正常
□ 录音功能正常
□ 校准流程完整（5个音）
□ 实时音高检测准确
□ 音频播放正常
□ 音高可视化显示
□ 音色控制生效
□ 响应式布局正常
□ 浏览器兼容性（Chrome/Firefox/Safari）
```

### 代码质量检查
```
□ 无 console.error 报错
□ 无内存泄漏（Chrome DevTools Memory Profiler）
□ 性能无明显下降（Lighthouse 评分）
□ 代码通过 ESLint 检查
□ 所有测试用例通过
```

### Git 提交规范
```
格式：<type>(<scope>): <subject>

类型：
- feat: 新功能
- refactor: 重构
- fix: Bug 修复
- docs: 文档
- test: 测试
- chore: 构建/工具

示例：
refactor(audio): 移除旧的 audio-input.js，统一使用 audio-io.js
refactor(logging): 添加 Logger 类，替换 50 处 console
fix(version): 统一 package.json 和 app-config.js 版本号为 0.4.0
```

---

## 📅 时间表

| 步骤 | 预计时间 | 累计时间 |
|------|---------|---------|
| 第一步：清理和规范化 | 2-3天 | 2-3天 |
| 第二步：架构优化 | 3-4天 | 5-7天 |
| 第三步：模块化重构 | 4-5天 | 9-12天 |
| **总计** | **9-12天** | **约2-2.5周** |

---

## 🎯 成功指标

完成重构后，代码质量应达到：

| 指标 | 重构前 | 重构后 | 改进 |
|------|--------|--------|------|
| **整体评分** | 3/10 | 7/10 | +133% |
| **全局变量数** | 13个 | 0个 | -100% |
| **console 数量** | 260处 | <20处 | -92% |
| **代码重复率** | 15-20% | <5% | -75% |
| **单元测试覆盖** | 0% | 40-50% | +40-50% |
| **函数平均长度** | 45行 | <20行 | -56% |
| **魔法数字** | 30+个 | 0个 | -100% |

---

## 🚀 开始执行

准备好了吗？让我们从第一步开始！

```bash
# 创建重构分支
git checkout -b refactor/step-1-cleanup

# 开始第一步
echo "🚀 开始重构第一步：清理和规范化"
```

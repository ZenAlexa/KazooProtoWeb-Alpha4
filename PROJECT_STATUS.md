# Kazoo Proto Web - 项目现状全面整理

**生成时间**: 2025-01-04 (更新: 2025-11-04)
**当前分支**: refactor/step-3-modularization
**总代码量**: ~9,568 行 JavaScript (主应用) + ~1,500 行 (延迟分析器) + ~1,200 行 (测试与基础设施)

---

## 执行摘要（3 分钟速读版）

**项目性质**: 实时人声转乐器系统（Web Audio API）

**当前状态**: 80% 完成，核心功能已实现，正在进行第三步重构（模块化）

**最新进展 (2025-11-04)**:
- ✅ **第二步重构完成**: 统一音频系统、完善错误处理、Legacy 路径收尾
- ✅ **第三步阶段1完成**: AppContainer、UIManager、Vitest 基础设施投入使用
- ✅ **文档体系重组**: docs/ 目录按阶段拆分，测试/指南归档
- ⏳ **进行中**: 第三步阶段2 —— 将核心服务迁移到依赖注入容器，并保持双轨兼容

**第三步阶段1快照**:
- AppContainer（306 行）提供服务注册/单例/循环依赖检测
- UIManager（533 行）实现事件驱动 UI 状态管理
- Vitest 配置完成（happy-dom、覆盖率阈值、19/19 断言通过）
- 进阶文档与测试脚本同步更新

**下一步行动**:
1. **阶段2：依赖注入落地** — `KazooApp` 与音频/合成模块改为使用容器实例，继续保留 `window.*` 兼容层直至验证完成
2. **阶段3：ES Module 入口** — 重构 `index.html` 加载路径，建立单一模块入口并评估打包策略
3. **阶段4：覆盖率与 UIManager 接入** — 将 UI 更新逻辑迁移到事件系统，并将测试覆盖率提升至 40%+

**技术债务状态**: 正在系统性偿还 - 从"屎山"到良好工程项目的转型中

---

## 一、项目概述

### 1.1 项目定位
**Kazoo Proto Web** 是一个基于 Web Audio API 的**实时人声转乐器系统**。用户通过麦克风唱歌/哼唱，系统实时检测音高和表现力特征，驱动虚拟乐器发声，实现"用声音演奏乐器"的效果。

**核心目标**:
- 延迟 < 50ms（当前理论 8-15ms，实际 180ms - **严重问题**）
- 支持 6 种乐器（萨克斯、小提琴、钢琴、长笛、吉他、合成器）
- 表现力映射（音量 → velocity，音色 → filter cutoff，呼吸感 → noise）

### 1.2 技术栈
- **音频引擎**: Web Audio API + AudioWorklet（低延迟）
- **音高检测**: YIN 算法（Worklet 内运行）
- **音频合成**: Tone.js v15.1.22
- **架构模式**: 双引擎架构（Continuous 频率跟踪 + Legacy 音符量化）

---

## 二、项目历史演进（Git 提交分析）

### Phase 1: 基础架构搭建
- 实现 AudioWorklet 低延迟音频处理
- 集成 YIN 音高检测算法
- 建立 Tone.js 合成器引擎

### Phase 2: 表现力特征提取（核心功能）
**提交**: `7189d77 - fbddce5`

**实现内容**:
1. **Worklet 端 FFT 分析** - 2048 点 FFT，提取频谱特征
2. **起音检测器移植** - SimpleOnsetDetector 在 Worklet 运行
3. **PitchFrame 数据结构** - 15 字段完整特征数据
4. **AudioWorklet 模式启用** - 延迟从 46ms 降至 2.9ms

**成果**: ✅ Worklet 数据流完整，表现力特征实时计算

### Phase 2.9: Worklet 数据流重构
**提交**: `3799bab - 4b46597`

**修复**:
- ✅ 配置序列化并通过 postMessage 下发
- ✅ onWorkletPitchFrame 回调正确注册
- ✅ Tone.js 初始化时序修复

### Phase 2.10: 集中式配置管理
**提交**: `bf4598d`

**成果**: ✅ 单一配置源（app-config.js），所有模块统一读取

### 第二步重构: 架构优化 (2025-11)
**分支**: `refactor/step-2-architecture`

**主要成果**:
- ✅ 统一音频系统 - 移除 Legacy/Continuous 双引擎
- ✅ 完整错误处理 - 用户友好提示和降级策略
- ✅ 修复 ScriptProcessor 降级路径
- ✅ 音高检测库加载优化 (CDN切换)
- ✅ 文档完善 - 添加测试指南和总结报告

**详见**: [docs/refactoring/step2/complete.md](docs/refactoring/step2/complete.md)

### 第三步重构阶段1: 基础设施建设 (2025-11-04)
**分支**: `refactor/step-3-modularization`
**提交**: `4个commits` (AppContainer, UIManager, Vitest, docs)

**实现内容**:
1. **依赖注入系统** (js/core/app-container.js - 306行)
   - Service Locator 模式
   - 循环依赖检测
   - Singleton 缓存
   - Debug 模式

2. **UI管理器** (js/managers/ui-manager.js - 533行)
   - Observer 模式 (pub-sub)
   - DOM 元素缓存
   - 事件系统 (on/off/emit)
   - 统一 UI 更新接口

3. **Vitest 测试框架**
   - happy-dom 环境 (比jsdom快2-3倍)
   - 覆盖率目标: 40% lines/functions
   - 19/19 单元测试通过
   - 命令: test, test:watch, test:ui, test:coverage

4. **文档体系重组**
   - docs/guides/ - 用户指南
   - docs/archive/ - 历史文档
   - docs/testing/ - 测试文档
   - docs/README.md - 完整导航中心

**详见**: [docs/refactoring/step3/stage1-summary.md](docs/refactoring/step3/stage1-summary.md)

### 延迟分析系统开发（历史）
**提交**: `7dad5f1 - cd7523f`

**实现**:
- ✅ 完整延迟分析工具套件（latency-profiler/）
- ✅ 10 点时间戳测量（T0-T9）
- ✅ 跨时钟同步（AudioContext ↔ performance.now）
- ✅ BroadcastChannel 跨标签页通信
- ✅ 实时监控仪表盘

**当前状态**: ⚠️ 工具已集成，暂未使用（重构优先）

---

## 三、当前代码架构

### 3.1 目录结构
```
KazooProtoWeb-Alpha4/
├── index.html                    # 主页面
├── js/                           # 主应用（~9,000 行）
│   ├── main.js                   # 主控制器（677 行）
│   ├── audio-io.js               # 音频抽象层（707 行）
│   ├── pitch-worklet.js          # Worklet 音高检测（930 行）
│   ├── continuous-synth.js       # 合成引擎（613 行）
│   ├── config/app-config.js      # 集中式配置（478 行）
│   ├── features/                 # 特征提取模块
│   └── utils/                    # 工具函数
│
├── latency-profiler/             # 延迟分析工具（历史工具）
│   ├── js/
│   │   ├── latency-profiler.js   # 核心分析器（472 行）
│   │   ├── clock-sync.js         # 时钟同步（158 行）
│   │   └── patch-worklet.js      # 集成指南（206 行）
│   ├── pages/
│   │   ├── monitor.html          # 实时监控仪表盘（669 行）
│   │   ├── quick-check.html      # 快速诊断（380 行）
│   │   └── test-broadcast.html   # 通信测试
│   └── docs/
│       ├── INTEGRATION.md        # 集成步骤
│       ├── ARCHITECTURE.md       # 技术设计
│       └── QUICKSTART.txt        # 快速参考
│
├── docs/                         # 项目文档（重组后）
│   ├── README.md                 # 文档导航中心（400+行）
│   ├── analysis/                 # 代码质量分析
│   ├── refactoring/              # 重构文档 (step1-3)
│   ├── testing/                  # 测试指南和结果
│   ├── guides/                   # 用户配置指南
│   ├── archive/                  # 历史文档归档
│   │   ├── fixes/                # 历史修复记录
│   │   └── planning/             # 历史规划文档
│   ├── phase1/, phase2/          # Phase文档（保留）
│   └── roadmap/                  # 长期路线图
│
├── tests/                        # 测试文件
│   ├── unit/                     # Vitest 单元测试
│   │   └── app-container.test.js # AppContainer 测试（19 assertions）
│   └── [legacy tests...]         # 旧测试框架
│
├── vitest.config.js              # Vitest 配置（86 行）
└── package.json                  # 新增 Vitest 依赖和脚本
```

### 3.2 核心数据流

```
用户唱歌 → 麦克风 → [AudioWorklet Thread]
                   ├─ 128 样本累积 → 2048 样本块
                   ├─ YIN 算法 → 音高 + 置信度
                   ├─ FFT 分析 → brightness, breathiness
                   ├─ 起音检测 → attack/sustain/release
                   └─ PitchFrame (15 字段) → postMessage
                                           ↓
                   [Main Thread]
                   ├─ handleWorkletPitchFrame()
                   ├─ ContinuousSynthEngine.processPitchFrame()
                   │   ├─ Pitch bend (±50 cents)
                   │   ├─ Filter cutoff (200-8000 Hz)
                   │   └─ Noise gain (0-0.3)
                   └─ Tone.js Synth → 扬声器
```

---

## 四、关键技术挑战与解决方案

### 4.1 阈值调参噩梦
**问题**: 6 次紧急提交都在调整阈值，声音时断时续

**解决方案**（本次会话）:
- 延迟分析系统提供量化指标
- 按环节拆解：Worklet 处理、消息传递、合成器更新
- 数据驱动决策而非猜测

### 4.2 时钟同步难题
**问题**: AudioContext.currentTime 和 performance.now() 无共同零点

**解决方案**:
- Chrome/Edge: `getOutputTimestamp()` API（±0.1ms 精度）
- Firefox/Safari: 采样估算法（±2ms 精度）

### 4.3 跨标签页通信
**问题**: monitor.html 无法访问主窗口的 window.latencyProfiler

**解决方案**: BroadcastChannel API 实现同源实时通信

### 4.4 Worklet 配置下发
**问题**: Worklet 独立线程无法访问主线程变量

**解决方案**: _serializeConfigForWorklet() + postMessage 传递配置

---

## 五、当前问题清单与重构目标

### 第三步重构目标 (进行中)

#### ✅ 阶段1: 基础设施建设 (已完成)
- ✅ AppContainer (依赖注入)
- ✅ UIManager (UI管理)
- ✅ Vitest (测试框架)
- ✅ 文档重组

#### ⏳ 阶段2: 全局变量迁移 (下一步)
**目标**: 迁移13个全局变量到容器
- window.configManager
- window.audioIO
- window.continuousSynthEngine
- window.instrumentPresetManager
- [等10个变量]

**策略**: 双轨制 (保持兼容 + 新容器)
**预计**: 2-3小时

#### ⏳ 阶段3: ES6模块化
- 移除全局变量
- import/export 改造
- 模块边界清晰化

#### ⏳ 阶段4: 测试覆盖
- 目标: 40% 行覆盖率
- 核心模块优先
- 集成测试

### 技术债务 (已识别)

#### P1：代码质量 (正在解决)
**评分**: 3/10 → 5.5/10 → 目标 7/10

**改进措施**:
- ✅ 统一配置系统
- ✅ 移除双引擎架构
- ✅ 错误处理完善
- ⏳ 依赖注入
- ⏳ 模块化
- ⏳ 测试覆盖

#### P2：文档混乱 (已解决)
- ✅ 建立清晰目录结构
- ✅ 分类管理不同阶段文档
- ✅ 创建导航中心 (docs/README.md)

#### P3：测试不足 (改进中)
**现状**:
- ✅ Vitest 框架就绪
- ✅ 19个单元测试通过
- ⏳ 覆盖率待提升 (当前<5%, 目标40%)

### 历史问题 (已归档)

#### 180ms 延迟问题 (已分析)
- 延迟分析工具已创建
- 暂时搁置，重构优先
- 详见: latency-profiler/ 目录

#### 阈值不稳定 (已优化)
- clarityThreshold: 0.85 → 0.10
- minVolumeThreshold: 0.01 → 0.0005
- 详见: [docs/archive/fixes/](docs/archive/fixes/)

---

## 六、未完成工作

### 第三步重构 (进行中)

#### 阶段2: 依赖注入落地 (进行中)
**工作量**: 2-3 小时  
**任务清单**:
1. 将 `KazooApp` 内的音高检测、性能监控、合成器引用改为 `this.*` 注入实例  
2. 调整 `continuous-synth.js`、`synthesizer.js`、`pitch-detector.js`、`performance.js` 为“仅导出类/工厂”，实例交由容器创建  
3. 保留 `window.*` 兼容层（容器创建后再挂载），记录每次兼容层调整  
4. 验证 Worklet / ScriptProcessor 模式均可启动，更新测试及文档  

#### 阶段3: ES Module 入口 (1-2天)
1. 将 `index.html` 替换为单一 `<script type="module" src="js/main.js">`  
2. 梳理 import 依赖链，移除旧的 `<script>` 加载顺序  
3. 评估 Vite/Rollup 打包需求，更新 `npm start`/部署脚本  
4. 清理已过时的全局变量声明与注释  

#### 阶段4: 测试覆盖提升 (2-3天)
1. 为音频管线、依赖注入容器、UIManager 编写单元测试  
2. 建立基础集成测试，覆盖启动/停止/错误路径  
3. 生成覆盖率报告（目标 ≥40% lines/functions，≥30% branches）  
4. 整理测试文档与运行指引

**详见**: [docs/refactoring/plan.md](docs/refactoring/plan.md)

### 延迟分析器集成（已暂停）
**状态**: 工具已完成，暂时搁置

**原因**: 重构优先，代码质量提升后再做性能优化

**恢复时机**: 第三步重构完成后

---

## 七、重构进度与里程碑

### 重构三步走战略

#### ✅ 第一步: 清理和规范化 (已完成)
- 删除冗余代码
- 统一版本号 (0.4.0)
- 建立基础设施

#### ✅ 第二步: 架构优化 (已完成)
**成果**:
- 统一音频系统 (移除双引擎)
- 完整错误处理
- ScriptProcessor 降级修复
- 用户友好提示

**详见**: [docs/refactoring/step2/complete.md](docs/refactoring/step2/complete.md)

#### ⏳ 第三步: 模块化重构 (进行中)

**阶段1: 基础设施** ✅ 完成
- AppContainer (依赖注入)
- UIManager (UI管理)
- Vitest (测试框架)
- 文档重组

**阶段2: 全局变量迁移** ⏳ 下一步
- 迁移13个全局变量
- 双轨制兼容
- 估计2-3小时

**阶段3: ES6模块化** ⏳ 计划中
- 移除全局变量
- import/export 改造
- 估计1-2天

**阶段4: 测试覆盖** ⏳ 计划中
- 单元测试编写
- 覆盖率40%目标
- 估计2-3天

**总体进度**: 阶段1/4 完成 (25%)

---

## 八、关键决策

### 决策1: 继续 AudioWorklet 还是回退？
**建议**: **继续 AudioWorklet**

**理由**: 理论延迟 2.9ms vs 46ms，现代浏览器支持率 >95%

---

### 决策2: 是否重构缓冲策略？
**建议**: **等待延迟分析结果**

**理由**: 数据驱动决策更可靠

---

### 决策3: 如何解决阈值不稳定？
**建议**: **实现自适应阈值系统**

**方案**: 短期（滑动窗口）→ 中期（噪声校准）→ 长期（机器学习）

---

## 九、下一步行动计划

### 立即执行: 阶段2 - 依赖注入落地 (2-3小时)

**任务清单**:
1. **容器实例接入**  
   - `KazooApp` 改用 `this.performanceMonitor`、`this.pitchDetector`、`this.continuousSynthEngine`  
   - `_initializeEngines`、`onAudioProcess`、`handleWorkletPitchFrame` 等路径去除直接全局引用  
2. **模块导出整理**  
   - `continuous-synth.js`、`synthesizer.js`、`pitch-detector.js`、`performance.js` 改为仅导出类  
   - 容器负责 `new` 实例并在需要时暴露 `window.*` 兼容层  
3. **双轨验证**  
   - Worklet/ScriptProcessor 启动流程  
   - 浏览器手动测试 + `npm test` 通过  
4. **文档同步**  
   - 更新阶段记录、测试结果与回滚说明  

---

### 近期计划: 阶段3 - ES Module 入口 (1-2天)

- 单一模块入口 (`type="module"`)  
- 梳理 import 依赖链，清理旧 `<script>`  
- 评估 Vite/Rollup 等打包策略  
- 更新 CLI、部署流程和文档

---

### 中期计划: 阶段4 - 测试覆盖 (2-3天)

- 补充单元测试与集成测试  
- 覆盖率目标 ≥40%（lines/functions）  
- 生成覆盖率报告并归档  
- 将测试指南纳入 docs/testing/

---

## 十、风险评估

### 重构风险

#### 低风险
1. **依赖注入落地**（10%）- 双轨制保证兼容性
2. **测试覆盖不足**（20%）- 可以逐步提升

#### 中风险
3. **模块化改造复杂**（30%）- 依赖关系梳理耗时
4. **重构周期过长**（25%）- 可能影响功能开发

#### 缓解措施
- 分阶段进行，每阶段验证
- 保持双轨制兼容
- 及时测试和回归
- 文档同步更新

### 技术风险 (已识别)

#### 已缓解
1. ✅ **Worklet 兼容性** - ScriptProcessor 降级已实现
2. ✅ **配置下发失败** - 完整错误处理已添加
3. ✅ **音频库加载** - CDN 切换和检测已完成

#### 持续监控
4. **性能问题**（15%）- 低端设备 CPU 不足
5. **浏览器兼容**（10%）- Safari 特殊处理

---

## 十一、成功标准

### 第三步重构成功标准

#### 阶段1 (已达成) ✅
- [x] AppContainer 实现并测试通过
- [x] UIManager 实现并测试通过
- [x] Vitest 框架配置完成
- [x] 文档体系重组完成

#### 阶段2 (目标)
- [ ] 13个全局变量迁移到容器
- [ ] 所有现有测试通过
- [ ] 浏览器功能验证通过
- [ ] 文档同步更新

#### 阶段3 (目标)
- [ ] 移除所有 window.xxx 全局变量
- [ ] ES6 import/export 完全实现
- [ ] 模块边界清晰
- [ ] 零 ESLint 错误

#### 阶段4 (目标)
- [ ] 测试覆盖率 ≥ 40% (lines/functions)
- [ ] 核心模块覆盖率 ≥ 60%
- [ ] CI/CD 集成
- [ ] 代码质量评分 ≥ 7/10

### MVP 上线标准 (未来)
- [ ] ⚠️ 端到端延迟 < 50ms（待重构后测试）
- [x] ✅ 音高检测准确率 > 90%
- [x] ✅ 系统稳定运行 5 分钟
- [x] ✅ 支持主流浏览器
- [x] ✅ 6 种乐器
- [x] ✅ 表现力映射
- [ ] ⏳ 代码质量达到生产标准

---

## 十二、总结陈述

### 项目进度: 80% (更新)
- ✅ 核心功能完整
- ✅ 第二步重构完成 (架构优化)
- ⏳ 第三步重构进行中 (模块化)
- **当前焦点**: 从"屎山"到良好工程项目的系统性重构

### 技术债务偿还进度
**代码质量评分**: 3/10 → 5.5/10 → 目标 7/10

**已完成**:
- ✅ 统一音频系统
- ✅ 完整错误处理
- ✅ 集中式配置
- ✅ 文档体系重组
- ✅ 依赖注入基础设施
- ✅ 测试框架建立

**进行中**:
- ⏳ 依赖注入落地 (阶段2)
- ⏳ ES Module 入口 (阶段3)
- ⏳ 测试覆盖提升 (阶段4)

### 关键里程碑
1. ✅ Phase 2.9: Worklet 数据流
2. ✅ Phase 2.10: 配置管理
3. ✅ **第二步重构: 架构优化 (完成)**
4. ✅ **第三步阶段1: 基础设施 (完成)**
5. ⏳ **第三步阶段2: 依赖注入落地 (进行中)**
6. ⏳ 第三步阶段3-4: 模块化入口与测试覆盖
7. ⏳ Beta 测试

### 重构战略
**目标**: 将项目从技术演示提升到生产级代码质量

**方法**: 分阶段、可验证、保持兼容

**进度**: 阶段1/4完成 (25%)

**预计完成**: 阶段2-4约需5-8天

### 当前建议
**这是一个技术可行且正在系统性改进的项目**。核心功能完整，正通过三步重构策略偿还技术债务，提升代码质量和可维护性。

**行动指令**: 继续执行第三步重构，优先完成阶段2依赖注入落地。代码质量提升后再进行性能优化。

---

**报告生成时间**: 2025-01-04 (初版)
**最后更新**: 2025-11-04 (第三步阶段1完成)
**下次更新**: 阶段2完成后

---

## 十三、文档索引

**完整文档导航**: [docs/README.md](docs/README.md)

### 快速链接
- **项目状态**: 本文件 (PROJECT_STATUS.md)
- **代码质量分析**: [docs/analysis/code-quality-summary.txt](docs/analysis/code-quality-summary.txt)
- **重构计划**: [docs/refactoring/plan.md](docs/refactoring/plan.md)
- **重构进度**: [docs/refactoring/progress.md](docs/refactoring/progress.md)
- **第二步总结**: [docs/refactoring/step2/complete.md](docs/refactoring/step2/complete.md)
- **阶段1总结**: [docs/refactoring/step3/stage1-summary.md](docs/refactoring/step3/stage1-summary.md)
- **测试指南**: [docs/testing/vitest-usage.md](docs/testing/vitest-usage.md)
- **配置指南**: [docs/guides/configuration.md](docs/guides/configuration.md)
- **故障排查**: [docs/guides/troubleshooting.md](docs/guides/troubleshooting.md)

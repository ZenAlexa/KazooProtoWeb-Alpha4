# 📚 项目文档索引

欢迎来到 **KazooProtoWeb-Alpha4** 项目文档中心。

本目录包含项目的完整文档,按类型和阶段组织,便于快速查找和理解项目。

---

## 🚀 快速开始

| 我想... | 查看文档 |
|---------|---------|
| **了解项目当前状态** | [PROJECT_STATUS.md](../PROJECT_STATUS.md) (根目录) |
| **运行和测试项目** | [guides/troubleshooting.md](guides/troubleshooting.md) |
| **配置音频系统** | [guides/configuration.md](guides/configuration.md) |
| **查看代码质量** | [analysis/code-quality-summary.txt](analysis/code-quality-summary.txt) |
| **了解重构进度** | [refactoring/progress.md](refactoring/progress.md) |
| **编写测试** | [testing/vitest-usage.md](testing/vitest-usage.md) |

---

## 📁 目录结构

```
docs/
├── README.md                           # 本文件 - 文档导航中心
│
├── 📊 analysis/                        # 代码质量分析
│   ├── code-quality-analysis.md       # 详细分析报告 (1011行)
│   ├── code-quality-summary.txt       # 执行摘要 (252行)
│   └── code-quality-quickref.txt      # 快速参考 (178行)
│
├── 🔧 refactoring/                     # 重构文档
│   ├── plan.md                        # 三步重构计划 (时间表+风险评估)
│   ├── progress.md                    # 实时进度追踪 ⭐ 常看
│   │
│   ├── step1/                         # 第一步：清理和规范化
│   │   └── (已完成,无独立文档)
│   │
│   ├── step2/                         # 第二步：架构优化
│   │   ├── summary.md                # 第二步总结
│   │   └── complete.md               # 完成报告 (详细)
│   │
│   └── step3/                         # 第三步：模块化重构 (进行中)
│       └── stage1-summary.md         # 阶段1总结 (依赖注入+测试)
│
├── 🧪 testing/                         # 测试相关
│   ├── vitest-usage.md                # Vitest 使用指南 ⭐ 必读
│   ├── test-guide.md                  # 第二步测试指南
│   ├── test-results.md                # 测试结果报告
│   └── test-scriptprocessor.md        # ScriptProcessor 专项测试
│
├── 📚 guides/                          # 用户和开发指南
│   ├── configuration.md               # 音频系统配置说明
│   ├── configuration-examples.md      # 配置示例 (预设/自定义)
│   └── troubleshooting.md             # 常见问题排查
│
├── 📦 archive/                         # 历史文档归档
│   ├── fixes/                         # 历史修复记录
│   ├── planning/                      # 历史规划文档
│   └── (phase1/, phase2/ 在根级别)
│
├── phase1/                            # Phase 1 文档 (完成)
├── phase2/                            # Phase 2 文档 (完成)
└── roadmap/                           # 长期路线图
```

---

## 📖 文档分类详解

### 1. 📊 代码质量分析 (`analysis/`)

**目的**: 评估项目初始状态,识别问题,制定改进计划

| 文档 | 内容 | 适合 |
|------|------|------|
| [code-quality-summary.txt](analysis/code-quality-summary.txt) | 执行摘要,关键问题 | ⭐ 快速了解 |
| [code-quality-analysis.md](analysis/code-quality-analysis.md) | 详细分析 (1011行) | 深入研究 |
| [code-quality-quickref.txt](analysis/code-quality-quickref.txt) | 快速参考卡 | 查阅指标 |

**评分**: 初始 3/10 → 当前 5.5/10 → 目标 7/10

---

### 2. 🔧 重构文档 (`refactoring/`)

**目的**: 记录重构计划、进度和总结

#### 总体文档

| 文档 | 内容 | 状态 |
|------|------|------|
| [plan.md](refactoring/plan.md) | 三步重构计划 | 📋 规划 |
| [progress.md](refactoring/progress.md) | 实时进度追踪 | ⭐ 常更新 |

#### 各步骤文档

**第一步: 清理和规范化** (✅ 已完成)
- 删除冗余代码
- 统一版本号 (0.4.0)
- 建立基础设施

**第二步: 架构优化** ([step2/](refactoring/step2/))
- ✅ 统一音频系统
- ✅ 错误处理改进
- ✅ 修复 ScriptProcessor

**第三步: 模块化重构** ([step3/](refactoring/step3/)) ⏳ 进行中
- ✅ 阶段1: 基础设施 (AppContainer, UIManager, Vitest)
- ⏳ 阶段2: 迁移全局变量
- ⏳ 阶段3: ES6模块化
- ⏳ 阶段4: 单元测试 (目标40%)

---

### 3. 🧪 测试文档 (`testing/`)

**目的**: 测试指南、结果和工具使用

| 文档 | 内容 | 适合 |
|------|------|------|
| [vitest-usage.md](testing/vitest-usage.md) | Vitest 使用指南 | ⭐ 必读 |
| [test-guide.md](testing/test-guide.md) | 第二步测试指南 | 功能测试 |
| [test-results.md](testing/test-results.md) | 测试结果报告 | 查看结果 |
| [test-scriptprocessor.md](testing/test-scriptprocessor.md) | ScriptProcessor 测试 | 降级测试 |

**测试命令**:
```bash
npm test              # 运行所有测试
npm run test:watch    # 监视模式
npm run test:ui       # 可视化界面
npm run test:coverage # 覆盖率报告
```

---

### 4. 📚 用户和开发指南 (`guides/`)

**目的**: 配置、使用和故障排查指南

| 文档 | 内容 | 适合 |
|------|------|------|
| [configuration.md](guides/configuration.md) | 音频系统配置说明 | 配置调优 |
| [configuration-examples.md](guides/configuration-examples.md) | 配置示例集 | 快速配置 |
| [troubleshooting.md](guides/troubleshooting.md) | 常见问题排查 | 遇到问题 |

---

### 5. 📦 历史文档归档 (`archive/`)

**目的**: 保留历史文档,保持主文档整洁

- `fixes/` - 历史修复记录
- `planning/` - 历史规划文档
- Phase1, Phase2 文档保留在原位置

---

## 🔍 常见问题快速查找

### 开发相关

**Q: 如何开始开发?**
→ 根目录 [README.md](../README.md) "Quick Start"

**Q: 项目当前状态如何?**
→ [PROJECT_STATUS.md](../PROJECT_STATUS.md) (根目录)

**Q: 代码质量怎么样?**
→ [analysis/code-quality-summary.txt](analysis/code-quality-summary.txt)

**Q: 重构到哪一步了?**
→ [refactoring/progress.md](refactoring/progress.md)

### 配置相关

**Q: 如何配置音频系统?**
→ [guides/configuration.md](guides/configuration.md)

**Q: 有哪些配置示例?**
→ [guides/configuration-examples.md](guides/configuration-examples.md)

**Q: 配置不生效怎么办?**
→ [guides/troubleshooting.md](guides/troubleshooting.md)

### 测试相关

**Q: 如何运行测试?**
→ [testing/vitest-usage.md](testing/vitest-usage.md)

**Q: 测试结果在哪?**
→ [testing/test-results.md](testing/test-results.md)

**Q: 如何编写新测试?**
→ [testing/vitest-usage.md](testing/vitest-usage.md) "编写测试"

---

## 🔄 文档维护规范

### 命名规则

**文件名**:
- ✅ 使用 **kebab-case**: `code-quality-analysis.md`
- ❌ 避免 PascalCase: `CodeQualityAnalysis.md`

**目录名**:
- ✅ 使用小写: `refactoring/step2/`
- ✅ 复数形式: `guides/`, `tests/`

### 更新规则

1. **新增文档**: 放到合适目录 + 更新本 README
2. **修改文档**: 更新 "最后更新" 时间
3. **归档文档**: 移至 `archive/`

---

**最后更新**: 2025-11-04 15:30 CST
**文档版本**: v2.0 (重构第三步)
**维护者**: Ziming Wang & Claude

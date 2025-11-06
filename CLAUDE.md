# Kazoo Proto Web – AI Guardrails

## 核心约束（必须遵守）
- **依赖注入**: 服务通过 `AppContainer`（[js/main.js](js/main.js)）注册 → 仅暴露 `window.app` 和 `window.container`
- **配置来源**: 唯一使用 `configManager.load()`，扩展预设修改 [js/config/instrument-presets.js](js/config/instrument-presets.js)
- **新服务**: 定义类 → 容器注册 → 通过 `container.get()` 访问
- **UI 更新**: 通过 `UIManager` 事件驱动，禁止直接 DOM 操作
- **测试**: 使用 Vitest，测试必须能失败

## 快速验证
```bash
npm test          # 改动核心服务后
npm start         # UI/音频手动冒烟测试
```

## 文档规则（2025-11-06 清理后制定）

### 根目录文档（仅3个）
1. **README.md** - 用户指南
   - 用途：快速开始、功能说明
   - 更新时机：新功能、API 变化
   - 长度：< 300 行
   - 禁止：技术细节、历史记录

2. **PROJECT_STATUS.md** - 项目状态
   - 用途：当前状态、关键问题、下一步
   - 更新时机：每次重大改动后
   - 长度：< 250 行
   - 内容：当前状态、已知问题（P0/P1/P2）、命令、文件结构
   - 禁止：详细历史、阶段报告、自我表扬

3. **CLAUDE.md** - 本文件
   - 用途：AI 开发守护规则
   - 更新时机：核心约束变化、文档规则变化
   - 长度：< 150 行
   - 禁止：工作流细节、示例代码

### docs/ 目录结构
```
docs/
├── guides/
│   ├── troubleshooting.md    # 问题排查（常见错误）
│   └── configuration.md       # 配置说明（核心配置项）
├── CLEANUP_PLAN.md            # 优化清单（仅保留当前版本）
└── CLEANUP_SUMMARY.md         # 清理总结（执行记录）
```

### 新文档放置规则
- **操作指南** → `docs/guides/` （troubleshooting、configuration 等）
- **清理/优化计划** → `docs/` 根目录（CLEANUP_*.md）
- **临时分析报告** → 完成后删除，不提交
- **阶段总结/完成报告** → 禁止创建

### 严格禁止
- ❌ 创建 `docs/phase*/`、`docs/step*/` 目录
- ❌ 写"完成报告"、"阶段总结"（代码和 commit 已说明）
- ❌ 写"执行计划"超过 200 行（简洁 or 不写）
- ❌ 在文档中使用 emoji（代码日志可以用）
- ❌ 预设测试结果（"🎉 所有测试通过"）

### 文档更新原则
1. **能不写就不写** - 代码即文档
2. **写了就保持最新** - 过时文档比没有更糟
3. **README 优先** - 用户关心的放 README
4. **PROJECT_STATUS 其次** - 开发者关心的放这里
5. **长期计划 → issue** - 不要写在文档里

## 触发条件：何时读文档
- **快速开始** → [README.md](README.md)
- **当前状态/已知问题** → [PROJECT_STATUS.md](PROJECT_STATUS.md)
- **问题排查** → [docs/guides/troubleshooting.md](docs/guides/troubleshooting.md)
- **配置修改** → [docs/guides/configuration.md](docs/guides/configuration.md)
- **优化清单** → [docs/CLEANUP_PLAN.md](docs/CLEANUP_PLAN.md)

## 工作流最佳实践
- 使用 `/catchup` 而非 `/compact`（新会话时读取分支改动）
- 提交聚焦：一个 commit 做一件事
- 困惑时简化代码，而非写文档
- 删除代码胜过注释代码
- 写能失败的测试，不写假测试

## 测试规则
- **工具**: Vitest only，禁止自制框架
- **位置**: `tests/unit/` 或 `tests/integration/`
- **命名**: `*.test.js`
- **原则**: 测试必须能失败，禁止预设成功输出
- **覆盖**: 核心模块优先，不追求数字

## 性能目标
- **延迟**: < 50ms（当前 180ms，严重超标）
- **测量**: `window.app.getLatencyStats()`
- **优先级**: 性能 > 架构美学
- **原则**: 先达标，再优化

## 代码规则
- **全局变量**: 仅 `window.app` 和 `window.container`
- **服务访问**: `window.container.get('serviceName')`
- **console**: 仅 error/warn，删除 80% debug/info
- **注释**: 说明为什么，不说明是什么
- **emoji**: 仅用户可见日志，代码中禁止

---

**记住**: 这个项目目标是"能用"，不是"看起来专业"。少写文档，多修 bug。

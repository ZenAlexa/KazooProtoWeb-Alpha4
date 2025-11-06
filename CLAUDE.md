# Kazoo Proto Web – AI Guardrails

## 核心约束（必须遵守）
- **依赖注入**: 服务通过 `AppContainer`（[js/main.js](js/main.js)）注册 → 暴露到 `window.*` → 禁止模块级单例
- **配置来源**: 唯一使用 `configManager.load()`，扩展预设修改 [js/config/instrument-presets.js](js/config/instrument-presets.js)
- **禁止改 [index.html](index.html) script 标签**（Stage 3 ES 模块迁移前）
- **新服务**: 定义类 → 容器注册 → `window.*` 暴露 → 可选更新 `KazooApp`
- **UI 更新**: 通过 `UIManager` 事件驱动，禁止直接 DOM 操作
- **日志**: 使用 `Logger` 工具

## 快速验证
```bash
npm test          # 改动核心服务后
npm start         # UI/音频手动冒烟测试
```

## 触发条件：何时读详细文档
- **DI 注入失败/undefined 报错** → 回滚到 `438e7e3` 重新应用
- **架构困惑/重构疑问** → [PROJECT_STATUS.md](PROJECT_STATUS.md) + [docs/refactoring/progress.md](docs/refactoring/progress.md)
- **测试失败/不知道命令** → [docs/testing/vitest-usage.md](docs/testing/vitest-usage.md)
- **音频管道异常/延迟问题** → [docs/guides/troubleshooting.md](docs/guides/troubleshooting.md) + `latency-profiler/pages/monitor.html`
- **需要模块/构建细节** → [docs/refactoring/plan.md](docs/refactoring/plan.md) "ES Module 入口" 章节

## 工作流最佳实践
- 使用 `/catchup` 而非 `/compact`（新会话时读取分支改动）
- 提交聚焦：容器变更 ≠ 文档/测试更新
- 困惑时简化代码，而非扩充此文件
- 更多方法论见 [AI_WORKFLOW.md](AI_WORKFLOW.md)

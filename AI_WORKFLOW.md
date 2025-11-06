# AI 工作流最佳实践

> 本文档记录使用 Claude Code 的方法论，提炼自实际项目经验和社区最佳实践。

## 核心原则

### 1. CLAUDE.md 是护栏，不是手册
- ❌ 别写完整的 API 文档或使用说明
- ✅ 只记录 AI 容易出错的地方
- ✅ 用"触发条件"引导 AI 何时读详细文档
- ✅ 保持简短（<2KB 理想，<5KB 可接受）

**反模式示例：**
```markdown
## FooService API
- `foo.bar()` - 执行 bar 操作
- `foo.baz(param)` - 执行 baz 操作
  - param: string - 参数说明
  - 返回值: Promise<Result>
... 30 行 API 文档 ...
```

**正确示例：**
```markdown
## 核心约束
- 禁止直接调用 `foo.internalMethod()`，使用 `foo.publicAPI()` 代替
- 遇到 FooError → 参考 docs/foo-troubleshooting.md
```

### 2. 上下文管理三策略

#### 策略 A：/clear + /catchup（默认推荐）
- **场景**: 日常开发，上下文接近 200k token
- **步骤**:
  1. `/clear` 清空会话
  2. `/catchup` 读取当前分支的所有改动
  3. 继续工作

#### 策略 B：文档化后清空（复杂任务）
- **场景**: 多步骤重构、大功能开发
- **步骤**:
  1. 让 AI 将计划写入 `docs/tasks/task-name.md`
  2. 进度和决策持续更新到文档
  3. `/clear` 清空会话
  4. 新会话读取 `docs/tasks/task-name.md` 继续

#### 策略 C：避免使用 /compact
- ❌ 自动压缩不透明、容易丢失关键上下文
- ❌ 优化效果不如手动管理
- ✅ 优先使用策略 A 或 B

### 3. 斜杠命令最小化原则
- **只设 2-3 个高频命令**（如 `/catchup`, `/pr`）
- **别替代好的工具设计**：如果需要复杂命令才能用某工具，先简化工具
- **不强制学习**：AI 的价值在于理解自然语言，不是记忆魔法命令

### 4. 倒逼函数：用 CLAUDE.md 简化代码库
当你发现需要写长文档解释某个工具时：
1. ❌ 别急着写文档
2. ✅ 先简化工具（写包装脚本、统一 API）
3. ✅ 只为简化后的接口写简短说明

**案例**：复杂 CLI 工具
```bash
# 倒逼前：需要 20 行文档解释参数和标志
ugly-tool --flag-a --flag-b=value --complex-option ...

# 倒逼后：写包装脚本 scripts/simple-wrapper.sh
./scripts/simple-wrapper.sh <operation>

# CLAUDE.md 只需 3 行
## 构建工具
使用 `./scripts/simple-wrapper.sh test|build|deploy`
复杂用法或报错 → docs/build-advanced.md
```

## 项目特定配置

### 斜杠命令
- **/catchup**: 读取当前分支的所有提交，总结改动和进度
- **/pr**: 准备 Pull Request（清理代码、暂存、生成描述）

### Token 预算监控
- 新会话基础开销：~20k tokens（10%）
- 可用工作空间：~180k tokens
- 运行 `/context` 检查使用量
- 超过 150k 考虑 `/clear + /catchup`

### 提交规范
- 容器/核心变更独立提交
- 文档更新独立提交
- 测试更新可与功能同提交（如果测试是功能的一部分）

## 常见反模式

### ❌ 反模式 1：@ 引用大文件
```markdown
参考 @docs/architecture.md 的详细说明（3000 行）
```
→ AI 会将整个文件加载到上下文，浪费 token

### ❌ 反模式 2：纯否定约束
```markdown
- 永远不要使用 --force 标志
```
→ AI 真需要这个标志时无替代方案

### ❌ 反模式 3：手册式文档
```markdown
## 完整 API 参考
### 函数列表
- foo()
- bar()
... 100 行 ...
```
→ 应该只记录易错点和护栏

## 更新此文档的时机
- 发现 AI 频繁犯同类错误 → 更新 [CLAUDE.md](CLAUDE.md) 护栏
- 某个工具/流程让多人困惑 → 简化工具 → 更新此文档
- 新的最佳实践验证有效 → 添加到本文

## 参考资源
- [CLAUDE.md](CLAUDE.md) - 项目护栏（每个会话自动加载）
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - 架构和进度概览
- [docs/refactoring/](docs/refactoring/) - 重构计划和进度
- [docs/testing/](docs/testing/) - 测试指南

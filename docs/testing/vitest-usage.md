# Vitest 使用指南

## 测试命令

### 1. 运行测试 (一次性)
```bash
npm test
# 或
npm run test
```
- 运行所有测试
- 完成后退出
- 适合: CI/CD, 提交前检查

### 2. 监视模式 (开发时)
```bash
npm run test:watch
```
- 持续运行,文件改变时自动重测
- 快速反馈
- 适合: 开发时实时测试

### 3. UI 界面 (可视化)
```bash
npm run test:ui
```
- 启动可视化界面服务器
- 自动打开浏览器: http://localhost:51204/__vitest__/
- 实时查看测试结果、覆盖率、断言详情
- 适合: 调试测试、分析覆盖率

**重要**: UI 模式会持续运行,按 `Ctrl+C` 停止

### 4. 覆盖率报告
```bash
npm run test:coverage
```
- 生成覆盖率报告
- 输出到 `coverage/` 目录
- 打开 `coverage/index.html` 查看详细报告

## 测试文件位置

```
tests/
├── unit/              # 单元测试
│   └── app-container.test.js
├── integration/       # 集成测试 (待添加)
└── helpers/           # 测试辅助工具 (待添加)
```

## 编写测试

### 基本结构
```javascript
import { describe, it, expect, beforeEach } from 'vitest';

describe('模块名称', () => {
  beforeEach(() => {
    // 每个测试前的准备工作
  });

  it('should do something', () => {
    // 测试代码
    expect(result).toBe(expected);
  });
});
```

### 常用断言
```javascript
expect(value).toBe(expected);           // 严格相等 (===)
expect(value).toEqual(expected);        // 深度相等
expect(value).toBeCloseTo(expected, 1); // 近似相等 (浮点数)
expect(value).toBeTruthy();             // 真值
expect(value).toBeFalsy();              // 假值
expect(array).toContain(item);          // 数组包含
expect(fn).toThrow();                   // 抛出异常
```

## 当前测试状态

### 新增测试 (第三步)
✅ **tests/unit/app-container.test.js**: 19/19 通过

### 遗留测试 (第一/二步)
⚠️ **tests/config-system.test.js**: 1个失败
- 原因: 默认配置 `clarityThreshold` 不匹配
- 影响: 不影响新架构

## 故障排查

### "Disconnected" 提示
**原因**: `npm test` 命令运行完就退出了
**解决**: 使用 `npm run test:ui` 启动持续服务

### 端口占用
```bash
# 查找占用端口的进程
lsof -i :51204

# 杀死进程
kill -9 <PID>
```

### 清理缓存
```bash
# 删除 Vitest 缓存
rm -rf node_modules/.vitest

# 重新运行测试
npm test
```

## 下一步

1. **修复遗留测试**: 调整 `clarityThreshold` 配置
2. **添加更多测试**:
   - UIManager 单元测试
   - 音频工具函数测试
   - 依赖注入集成测试
3. **提高覆盖率**: 目标 40-50%

# ⚡ 快速开始指南

## 一天完成部署！

### 第一步：验证本地运行（5分钟）

本地服务器已在运行：http://localhost:54097

打开浏览器访问该地址，测试功能：

1. 点击"开始校准"
2. 允许麦克风访问
3. 按提示唱最低音和最高音
4. 选择一个乐器
5. 点击"开始录音"
6. 开始哼唱！

### 第二步：部署到互联网（10分钟）

#### 选项 A：Vercel（推荐 - 最简单）

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 登录（会打开浏览器）
vercel login

# 3. 部署
vercel --prod
```

按照提示操作：
- Project name: 按回车（使用默认）
- Setup and deploy: Y
- Link to existing project: N
- Project name: kazoo-proto-web
- Directory: `./` (按回车)

完成后会显示：
```
✅  Production: https://kazoo-proto-web-xxx.vercel.app
```

#### 选项 B：GitHub + Vercel 自动部署（更简单）

1. 访问 [vercel.com](https://vercel.com)
2. 用 GitHub 登录
3. 点击 "Import Project"
4. 选择 `KazooProtoWeb-Alpha4`
5. 点击 "Deploy"
6. 等待 2 分钟 → 完成！

### 第三步：分享和收集数据（可选）

#### 添加简单的访问统计

在 [index.html](index.html) 的 `<head>` 中添加：

```html
<!-- Simple Analytics (隐私友好) -->
<script async defer src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
<noscript><img src="https://queue.simpleanalyticscdn.com/noscript.gif" alt="" /></noscript>
```

或使用 Google Analytics（需要注册）。

---

## 项目文件总览

```
KazooProtoWeb-Alpha4/
├── index.html              ← 主页面
├── css/
│   └── styles.css          ← 样式
├── js/
│   ├── main.js            ← 主控制器 (整合所有模块)
│   ├── audio-input.js     ← 麦克风输入
│   ├── pitch-detector.js  ← YIN音高检测
│   ├── synthesizer.js     ← Tone.js合成器
│   ├── calibration.js     ← 校准系统
│   └── performance.js     ← 性能监控
├── package.json            ← npm配置
├── vercel.json            ← Vercel部署配置
└── README.md              ← 项目说明
```

---

## 核心功能流程

### 音频处理链路

```
用户哼唱
    ↓
麦克风捕获 (audio-input.js)
    ↓
YIN算法检测音高 (pitch-detector.js)
    ↓
Tone.js合成乐器声音 (synthesizer.js)
    ↓
音频输出
```

### 校准流程

```
1. 用户点击"开始校准"
2. 唱最低音 (2秒) → 记录频率
3. 唱最高音 (2秒) → 记录频率
4. 计算音域范围
5. 完成校准
```

---

## 常见问题速查

### Q1: 本地测试时麦克风无法访问？

**A**: 确保使用 `localhost` 或 `127.0.0.1`，浏览器允许这些地址访问麦克风。

### Q2: 部署后麦克风还是无法访问？

**A**: 检查网站是否使用 HTTPS（Vercel 默认启用）。如果不是 HTTPS，麦克风会被浏览器阻止。

### Q3: 声音有延迟怎么办？

**A**:
- 使用 Chrome 浏览器（音频性能最好）
- 使用有线耳机（减少蓝牙延迟）
- 在"高级设置"中降低"音高平滑"

### Q4: 检测不到音高？

**A**:
- 调高"灵敏度"滑块
- 降低"最小置信度阈值"
- 确保麦克风音量足够大
- 尝试唱得更清晰、更稳定

### Q5: 想修改代码后重新部署？

**A**:
```bash
# 修改代码后
git add .
git commit -m "更新功能"
git push

# Vercel会自动重新部署（如果设置了自动部署）
# 或手动运行：
vercel --prod
```

---

## 技术参数

### 音频配置

```javascript
采样率: 44100 Hz
缓冲大小: 2048 samples
延迟目标: < 20ms
置信度阈值: 60%
```

### 支持的音域

- 默认: E2 (82 Hz) - E5 (659 Hz)
- 校准后: 根据用户实际音域

### 性能指标

- 音高检测: ~60 FPS
- 总延迟: 10-30ms（取决于设备）
- CPU占用: < 10%（正常设备）

---

## 下一步开发建议

### 功能扩展

1. **录音导出** - 添加录制和下载功能
2. **更多乐器** - 添加鼓、贝斯等
3. **效果器** - 添加混响、延迟、失真等
4. **MIDI输出** - 支持连接到DAW
5. **多声部** - 支持和弦检测

### 代码优化

1. 使用 AudioWorklet 代替 ScriptProcessor（更低延迟）
2. 添加 Web Worker 处理音高检测（释放主线程）
3. 实现音频缓冲池（减少GC）
4. 添加 Service Worker（离线支持）

### UI改进

1. 添加音域可视化图表
2. 实现预设保存功能
3. 添加暗色/亮色主题切换
4. 移动端适配

---

## 调试技巧

### 打开浏览器控制台

- Chrome: F12 或 Cmd+Opt+I (Mac)
- 查看 Console 标签页

### 查看性能

```javascript
// 在控制台输入：
performanceMonitor.getDiagnostics()
```

### 查看校准数据

```javascript
// 在控制台输入：
calibrationSystem.getCalibrationData()
```

### 查看当前音高

```javascript
// 在控制台输入：
pitchDetector.pitchHistory
```

---

## 资源链接

- **Tone.js 文档**: https://tonejs.github.io/docs/
- **Web Audio API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **YIN算法论文**: http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf
- **Vercel 文档**: https://vercel.com/docs

---

## 紧急联系

如果遇到无法解决的问题：

1. 查看 [完整文档](README.md)
2. 查看 [部署指南](DEPLOYMENT.md)
3. 提交 [GitHub Issue](https://github.com/ZenAlexa/KazooProtoWeb-Alpha4/issues)

---

**祝你一天内完成部署！🚀**

记住：先让它能跑起来，再慢慢优化！

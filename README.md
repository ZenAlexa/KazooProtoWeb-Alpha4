# 🎵 Kazoo Proto Web - Transform Your Voice

将你的哼唱实时转换为多种乐器音色！

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://vercel.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-success)]()

## ✨ 功能特性

- 🎤 **实时音高检测** - 使用YIN算法进行精确的音高检测
- 🎸 **6种乐器音色** - Saxophone, Violin, Piano, Flute, Guitar, Synth
- 🎯 **智能校准系统** - 自动检测你的音域范围 (10秒两步校准)
- ⚡ **超低延迟** - 优化至 < 20ms 的端到端延迟
- 📊 **实时可视化** - 音高曲线和实时音符显示
- 🎛️ **表现力映射** - 从人声提取音量、颤音等表现力参数
- 🎨 **现代UI设计** - Apple风格、动画效果、响应式布局

## 🚀 快速开始

### 在线体验

**部署状态**: ✅ 已修复404错误

直接访问你的Vercel部署链接 (通过Vercel Dashboard获取)

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/zimingwang/KazooProtoWeb-Alpha4.git
cd KazooProtoWeb-Alpha4

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 在浏览器访问 http://localhost:3000
```

## 📖 使用指南

### 三步开始音乐创作

1. **🎤 校准声音 (10秒)**
   - 点击 "Start Calibration" 按钮
   - 允许浏览器使用麦克风
   - **Step 1**: 唱出你能唱的最低音并保持5秒
   - **Step 2**: 唱出你能唱的最高音并保持5秒
   - 系统会自动进入下一步，无需手动操作

2. **🎸 选择乐器**
   - 从6种乐器中选择：Saxophone (默认), Violin, Piano, Flute, Guitar, Synth
   - 每种乐器都有独特的音色特征

3. **🎵 开始演奏**
   - 点击 "Start Recording"
   - 对着麦克风哼唱或唱歌
   - 实时听到你的声音转换为选定的乐器音色！

### 💡 使用技巧

- 使用有线耳机减少延迟和回声
- 保持麦克风距离 10-20cm
- 在安静环境中使用效果最佳
- 音高稳定比音量大更重要

## 🛠️ 技术栈

- **Web Audio API** - 音频处理基础
- **Tone.js** - 音频合成框架
- **Pitchfinder (YIN)** - 音高检测库
- **原生 JavaScript** - 无框架依赖
- **Vercel** - 部署平台

## 📊 系统架构

```
麦克风输入 → 音频处理 → YIN音高检测 → Tone.js合成 → 音频输出
                ↓
            校准系统
                ↓
            性能监控
```

## 🎯 性能优化

- AudioContext 配置为 `latencyHint: 'interactive'`
- 缓冲区大小优化至 2048 samples
- 使用 ScriptProcessor 实时音频处理
- 音高平滑和中值滤波减少抖动

## 🔧 高级配置

在高级设置面板中可调整：

- **灵敏度** - 控制音高检测的音量阈值
- **音高平滑** - 控制音高曲线的平滑程度
- **混音比例** - 原声与合成声的混合比例
- **最小置信度** - 触发音符的置信度阈值

## 📝 开发说明

### 项目结构

```
KazooProtoWeb-Alpha4/
├── index.html              # 主页面
├── css/
│   └── styles.css          # 样式文件
├── js/
│   ├── audio-input.js      # 麦克风输入管理
│   ├── pitch-detector.js   # YIN音高检测
│   ├── synthesizer.js      # Tone.js合成器
│   ├── calibration.js      # 校准模块
│   ├── performance.js      # 性能监控
│   └── main.js             # 主控制器
├── package.json            # 项目配置
└── vercel.json             # 部署配置
```

### 核心模块

1. **AudioInputManager** - 管理麦克风输入和音频流
2. **PitchDetector** - YIN算法音高检测
3. **SynthesizerEngine** - 多乐器音色合成
4. **CalibrationSystem** - 用户音域校准
5. **PerformanceMonitor** - 实时性能监控

## 🚀 部署到 Vercel

### ✅ 404错误已修复

**问题**: 之前使用了过时的 `@vercel/static` 构建器配置
**解决**: 移除 `builds` 配置，Vercel自动检测静态网站

### 部署方法

**方法1: Vercel Dashboard (推荐)**
1. 访问 https://vercel.com/new
2. 导入GitHub仓库 `KazooProtoWeb-Alpha4`
3. 设置:
   - Framework: `Other`
   - Root Directory: `./`
   - Build Command: 留空
   - Output Directory: `./`
4. 点击 "Deploy"

**方法2: Vercel CLI**
```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

### 验证部署

运行验证脚本：
```bash
./verify-deployment.sh
```

详细部署指南和故障排除: [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md)

## 🌐 浏览器兼容性

- Chrome 88+ (推荐)
- Edge 88+
- Firefox 85+
- Safari 14.1+

**注意**: 需要 HTTPS 环境或 localhost 才能访问麦克风。

## 📂 项目文件

### 核心文件清单
- ✅ `index.html` - 主页面 (现代化UI)
- ✅ `vercel.json` - Vercel配置 (已修复404)
- ✅ `css/styles.css` - Apple风格设计
- ✅ `js/main.js` - 主控制器
- ✅ `js/calibration.js` - 校准系统 (修复自动进入Step 2)
- ✅ `js/synthesizer.js` - 音色合成 (修复Chrome autoplay)
- ✅ `js/lib/tone.js` - Tone.js库 (345KB)
- ✅ `js/lib/pitchfinder-browser.js` - YIN算法

### 文档
- 📖 `README.md` - 项目说明 (本文件)
- 📖 `VERCEL_DEPLOYMENT_GUIDE.md` - 详细部署指南
- 📖 `QUICKSTART.md` - 快速入门教程
- 📖 `DEPLOYMENT.md` - 部署步骤

## 🔧 最近更新

### v1.1 (2025-10-30)
- ✅ **修复Vercel 404错误** - 移除过时的builds配置
- ✅ **修复校准系统** - 自动5秒后进入Step 2
- ✅ **修复Chrome autoplay** - 正确处理AudioContext状态
- ✅ **UI全面升级** - Apple风格、动画、引导文本
- ✅ **添加部署工具** - 验证脚本和详细文档

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 开源协议

MIT License

## 👨‍💻 作者

Ziming Wang

## 🙏 致谢

- [Tone.js](https://tonejs.github.io/) - 优秀的Web音频框架
- [Pitchfinder](https://github.com/peterkhayes/pitchfinder) - YIN算法实现
- [Vercel](https://vercel.com/) - 免费托管平台

---

**实时低延迟音频处理技术演示**

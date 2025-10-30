# 🎵 Kazoo Proto Web - 实时人声乐器转换

将你的哼唱实时转换为多种乐器音色！

## ✨ 功能特性

- 🎤 **实时音高检测** - 使用YIN算法进行精确的音高检测
- 🎸 **多种乐器音色** - 萨克斯风、小提琴、钢琴、长笛、吉他、合成器
- 🎯 **智能校准系统** - 自动检测你的音域范围
- ⚡ **超低延迟** - 优化至 < 20ms 的端到端延迟
- 📊 **实时可视化** - 音高曲线和置信度显示
- 🎛️ **表现力映射** - 从人声提取音量、颤音等表现力参数

## 🚀 快速开始

### 在线访问

直接访问：[https://kazoo-proto-web.vercel.app](部署后的链接)

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

1. **校准系统** - 首次使用建议进行校准
   - 点击"开始校准"按钮
   - 唱出你能唱的最低音并保持2秒
   - 唱出你能唱的最高音并保持2秒

2. **选择乐器** - 点击想要的乐器音色

3. **开始演奏** - 点击"开始录音"，对着麦克风哼唱即可

4. **高级设置** - 调整灵敏度、平滑度等参数

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

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录 Vercel
vercel login

# 部署
vercel --prod
```

或者直接在 Vercel 网站导入 GitHub 仓库。

## 🌐 浏览器兼容性

- Chrome 88+ (推荐)
- Edge 88+
- Firefox 85+
- Safari 14.1+

**注意**: 需要 HTTPS 环境或 localhost 才能访问麦克风。

## 📱 最佳实践

- 使用有线耳机减少延迟
- 关闭浏览器其他标签页
- 在安静环境中使用
- 调整麦克风距离 10-20cm

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

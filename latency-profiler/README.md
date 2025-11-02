# Latency Profiler - 延迟剖析工具

## 目录结构

```
latency-profiler/
├── js/
│   ├── latency-profiler.js       # 核心Profiler类
│   ├── clock-sync.js              # 音频时钟与主线程时钟同步工具
│   └── patch-worklet.js           # Worklet时间戳注入补丁
├── pages/
│   ├── monitor.html               # 实时延迟监控仪表板
│   └── quick-check.html           # 快速诊断页面
└── docs/
    └── MEASUREMENT_GUIDE.md       # 测量方法论文档
```

## 功能

1. **时间戳采集**: 在音频链路10个关键节点注入高精度时间戳
2. **时钟同步**: 解决AudioContext.currentTime与performance.now()对齐问题
3. **实时监控**: 可视化延迟瓶颈与统计分布
4. **自动诊断**: 识别蓝牙设备、ScriptProcessor回退、缓冲累积等问题

## 使用方法

### 快速诊断
```
打开: http://localhost:3000/latency-profiler/pages/quick-check.html
点击"Run Full Diagnostic"按钮
```

### 实时监控
```
1. 打开主应用并启动播放
2. 新标签页打开: http://localhost:3000/latency-profiler/pages/monitor.html
3. 观察实时延迟数据流
```

### 编程接口
```javascript
// 主应用中启用profiler
window.__ENABLE_LATENCY_PROFILER__ = true;

// 访问采集的数据
window.latencyProfiler.generateReport()
```

## 数据输出

### 控制台日志
```
[LatencyProfiler] Session complete:
  T0→T9: 18.5ms (total)
  ├─ Worklet: 3.2ms
  ├─ Transfer: 0.4ms
  ├─ MainThread: 1.8ms
  └─ Output: 13.1ms
```

### 可视化报告
- 延迟分布直方图
- 各段平均/P50/P95/Max统计
- 瓶颈定位建议

## 设计原则

- 最小侵入性: 通过Feature Flag控制，生产环境零开销
- 时钟精确同步: 使用getOutputTimestamp对齐音频时间与墙钟时间
- 自动降级: 不支持的浏览器使用近似算法

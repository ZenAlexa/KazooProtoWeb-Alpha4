# Phase 3 技术实现路线图

**版本**: Alpha 4 - Phase 3 Technical Guide
**基于**: PHASE3_MVP_DEFINITION.md
**目的**: 工程师快速上手实现指南

---

## 📦 **Day 1-2: 音频录制 & 导出**

### **架构设计**

```
录音流程:
User Click "Record"
  → Start MediaRecorder(destination)
  → Capture Audio Chunks
  → Stop Recording
  → Combine Chunks → Blob
  → Convert to WAV (optional)
  → Trigger Download
```

### **实现步骤**

#### **Step 1: 创建 AudioRecorder 类** (4 小时)

**文件**: `js/recorder/audio-recorder.js`

```javascript
export class AudioRecorder {
    constructor(audioContext, destinationNode) {
        this.audioContext = audioContext;
        this.destination = destinationNode;
        this.mediaRecorder = null;
        this.chunks = [];
        this.isRecording = false;
        this.startTime = 0;
        this.maxDuration = 300000; // 5 分钟
    }

    async start() {
        // 1. 创建 MediaStreamDestination
        const dest = this.audioContext.createMediaStreamDestination();
        this.destination.connect(dest);

        // 2. 创建 MediaRecorder
        const options = {
            mimeType: 'audio/webm',  // 最兼容
            audioBitsPerSecond: 128000
        };
        this.mediaRecorder = new MediaRecorder(dest.stream, options);

        // 3. 监听数据
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this.chunks.push(e.data);
            }
        };

        // 4. 开始录音
        this.mediaRecorder.start(1000); // 每秒一个 chunk
        this.isRecording = true;
        this.startTime = Date.now();

        // 5. 自动停止 (防止内存溢出)
        setTimeout(() => {
            if (this.isRecording) {
                this.stop();
                console.warn('[Recorder] 达到最大时长,自动停止');
            }
        }, this.maxDuration);
    }

    async stop() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || !this.isRecording) {
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: 'audio/webm' });
                this.chunks = [];
                this.isRecording = false;
                resolve(blob);
            };

            this.mediaRecorder.stop();
        });
    }

    getDuration() {
        return this.isRecording ? Date.now() - this.startTime : 0;
    }
}
```

**测试**:
```javascript
const recorder = new AudioRecorder(audioContext, reverbNode);
await recorder.start();
// 等待 5 秒
const blob = await recorder.stop();
console.log('录音大小:', (blob.size / 1024).toFixed(2), 'KB');
```

---

#### **Step 2: WAV 格式转换** (3 小时)

**依赖**: 使用 `audiobuffer-to-wav` 或手写

**文件**: `js/recorder/format-converter.js`

```javascript
export class FormatConverter {
    /**
     * WebM → WAV 转换
     * @param {Blob} webmBlob
     * @returns {Promise<Blob>}
     */
    static async webmToWav(webmBlob) {
        // 1. Blob → ArrayBuffer
        const arrayBuffer = await webmBlob.arrayBuffer();

        // 2. ArrayBuffer → AudioBuffer
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // 3. AudioBuffer → WAV
        const wav = audioBufferToWav(audioBuffer);
        return new Blob([wav], { type: 'audio/wav' });
    }
}

/**
 * 手写 WAV 编码 (无依赖)
 */
function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const data = interleave(buffer);
    const dataLength = data.length * bytesPerSample;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;

    const arrayBuffer = new ArrayBuffer(totalLength);
    const view = new DataView(arrayBuffer);

    // WAV Header (44 bytes)
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // PCM Data
    floatTo16BitPCM(view, 44, data);

    return arrayBuffer;
}

function interleave(audioBuffer) {
    if (audioBuffer.numberOfChannels === 1) {
        return audioBuffer.getChannelData(0);
    }
    const length = audioBuffer.length * audioBuffer.numberOfChannels;
    const result = new Float32Array(length);
    let offset = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            result[offset++] = audioBuffer.getChannelData(channel)[i];
        }
    }
    return result;
}

function floatTo16BitPCM(view, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
```

---

#### **Step 3: 导出管理器** (2 小时)

**文件**: `js/recorder/export-manager.js`

```javascript
export class ExportManager {
    static download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    static generateFilename(format = 'wav') {
        const now = new Date();
        const timestamp = now.toISOString().replace(/:/g, '-').split('.')[0];
        return `kazoo-recording-${timestamp}.${format}`;
    }
}

// 使用示例
const webmBlob = await recorder.stop();
const wavBlob = await FormatConverter.webmToWav(webmBlob);
ExportManager.download(wavBlob, ExportManager.generateFilename('wav'));
```

---

#### **Step 4: UI 集成** (3 小时)

**文件**: `index.html` (添加录音按钮)

```html
<div class="recorder-controls">
    <button id="recordBtn" class="btn-record">🔴 开始录音</button>
    <button id="stopRecordBtn" class="btn-stop hidden">⏹️ 停止录音</button>
    <span id="recordDuration" class="hidden">00:00</span>
</div>
```

**文件**: `js/main.js` (集成录音逻辑)

```javascript
import { AudioRecorder } from './recorder/audio-recorder.js';
import { FormatConverter } from './recorder/format-converter.js';
import { ExportManager } from './recorder/export-manager.js';

class KazooApp {
    constructor() {
        // ...
        this.recorder = null;
        this.recordDurationInterval = null;
    }

    async startRecording() {
        // 1. 创建录音器
        this.recorder = new AudioRecorder(
            this.audioIO.audioContext,
            continuousSynthEngine.reverb  // 录制最终输出
        );

        // 2. 开始录音
        await this.recorder.start();

        // 3. 更新 UI
        this.ui.recordBtn.classList.add('hidden');
        this.ui.stopRecordBtn.classList.remove('hidden');
        this.ui.recordDuration.classList.remove('hidden');

        // 4. 显示时长
        this.recordDurationInterval = setInterval(() => {
            const duration = this.recorder.getDuration();
            const minutes = Math.floor(duration / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);
            this.ui.recordDuration.textContent =
                `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 100);
    }

    async stopRecording() {
        // 1. 停止录音
        const webmBlob = await this.recorder.stop();
        clearInterval(this.recordDurationInterval);

        // 2. 转换格式
        console.log('转换格式中...');
        const wavBlob = await FormatConverter.webmToWav(webmBlob);

        // 3. 下载
        ExportManager.download(wavBlob, ExportManager.generateFilename('wav'));

        // 4. 更新 UI
        this.ui.recordBtn.classList.remove('hidden');
        this.ui.stopRecordBtn.classList.add('hidden');
        this.ui.recordDuration.classList.add('hidden');
    }
}
```

---

### **验收测试**

```javascript
// 测试录音 30 秒
1. 点击 "Start Playing"
2. 点击 "开始录音"
3. 哼唱 30 秒
4. 点击 "停止录音"
5. 下载文件 "kazoo-recording-2025-01-11T10-30-00.wav"
6. 在 iTunes/VLC 播放
   ✅ 听到自己的哼唱 + 合成器声音
   ✅ 无杂音/卡顿
   ✅ 文件大小 ~2-5MB (30秒)
```

---

## 📦 **Day 3-4: 音色库扩展**

### **策略**: 基于 ADSR + Filter 调音

**目标**: 从 6 种 → 12 种音色

**新增音色列表**:
1. Trumpet (小号) - Bright, Punchy
2. Clarinet (单簧管) - Warm, Woody
3. Cello (大提琴) - Rich, Deep
4. Electric Guitar - Edgy, Distorted
5. Electric Piano - Rhodes-like
6. Organ - Classic B3

### **调音参数参考**

```javascript
// js/config/instrument-presets.js

trumpet: {
    oscillator: { type: 'sawtooth' },
    envelope: {
        attack: 0.005,  // 快速起音
        decay: 0.1,
        sustain: 0.9,
        release: 0.1
    },
    filterEnvelope: {
        baseFrequency: 3000,  // 高亮度
        octaves: 2,
        attack: 0.01,
        decay: 0.05,
        sustain: 0.8,
        release: 0.1
    },
    portamento: 0.02
},

clarinet: {
    oscillator: { type: 'square' },  // 方波模拟簧片
    envelope: {
        attack: 0.03,
        decay: 0.15,
        sustain: 0.85,
        release: 0.25
    },
    filterEnvelope: {
        baseFrequency: 1200,  // 温暖音色
        octaves: 1.5,
        attack: 0.04,
        decay: 0.1,
        sustain: 0.7,
        release: 0.2
    },
    portamento: 0.04
}

// ... 其他 4 种
```

### **调音流程** (每种音色 2-3 小时)

1. 参考真实乐器音频 (YouTube/采样库)
2. 调整 Oscillator Type (影响基础音色)
3. 调整 ADSR (影响起音/尾音)
4. 调整 Filter (影响亮度/共鸣)
5. 调整 Portamento (影响滑音)
6. A/B 对比测试 (与其他音色区分度)

---

## 📦 **Day 6-7: 音高校准系统**

### **架构设计**

```
校准流程:
User Enter Calibration
  → Display Note (C4)
  → User Sings
  → Detect Frequency (e.g. 265 Hz)
  → Calculate Offset (265 vs 261.63 = +3.4 Hz = +21 cents)
  → Repeat for E4, G4
  → Compute Mapping Function
  → Save to LocalStorage
  → Apply Correction in Real-time
```

### **实现步骤**

#### **Step 1: 校准数据模型**

**文件**: `js/calibration/calibration-data.js`

```javascript
export class CalibrationData {
    constructor() {
        this.referenceNotes = [
            { note: 'C4', frequency: 261.63 },
            { note: 'E4', frequency: 329.63 },
            { note: 'G4', frequency: 392.00 }
        ];
        this.userMeasurements = [];
        this.offsetMapping = null;
    }

    addMeasurement(note, detectedFrequency) {
        const ref = this.referenceNotes.find(r => r.note === note);
        const offset = detectedFrequency - ref.frequency;
        const cents = 1200 * Math.log2(detectedFrequency / ref.frequency);

        this.userMeasurements.push({
            note,
            referenceFrequency: ref.frequency,
            detectedFrequency,
            offset,
            cents
        });
    }

    computeMapping() {
        // 简单线性映射: y = ax + b
        const avgCentsOffset = this.userMeasurements.reduce((sum, m) => sum + m.cents, 0)
            / this.userMeasurements.length;

        this.offsetMapping = {
            type: 'linear',
            centsOffset: avgCentsOffset
        };

        return this.offsetMapping;
    }

    save() {
        localStorage.setItem('kazoo_calibration', JSON.stringify(this.offsetMapping));
    }

    static load() {
        const data = localStorage.getItem('kazoo_calibration');
        return data ? JSON.parse(data) : null;
    }
}
```

#### **Step 2: 校准向导 UI**

**文件**: `calibration.html` (独立页面 或 Modal)

```html
<div id="calibrationWizard" class="modal">
    <h2>音高校准</h2>
    <p>请跟随引导唱出以下音符:</p>

    <div id="calibrationStep">
        <h1 id="targetNote">C4</h1>
        <p>目标频率: <span id="targetFreq">261.63</span> Hz</p>
        <p>检测频率: <span id="detectedFreq">--</span> Hz</p>
        <p>偏差: <span id="offset">--</span> cents</p>

        <button id="calibrateBtn">开始检测</button>
        <button id="nextNoteBtn" class="hidden">下一个音</button>
    </div>

    <div id="calibrationResult" class="hidden">
        <h3>校准完成!</h3>
        <p>平均偏差: <span id="avgOffset">--</span> cents</p>
        <button id="saveCalibrationBtn">保存校准</button>
    </div>
</div>
```

#### **Step 3: 实时校正应用**

**文件**: `js/main.js` (修改音高处理)

```javascript
// 加载校准数据
const calibration = CalibrationData.load();

// 在音高检测回调中应用校正
function onPitchDetected(pitchInfo) {
    if (calibration && calibration.centsOffset) {
        // 校正 cents
        pitchInfo.cents -= calibration.centsOffset;

        // 校正 frequency (可选)
        const correctionRatio = Math.pow(2, -calibration.centsOffset / 1200);
        pitchInfo.frequency *= correctionRatio;
    }

    // 继续处理...
}
```

---

## 📦 **Day 8: 视觉反馈增强**

### **新增可视化元素**

1. **音符准确度指示器**
   - 偏低 (-30 ~ -10 cents): 🔴 红色
   - 准确 (-10 ~ +10 cents): 🟢 绿色
   - 偏高 (+10 ~ +30 cents): 🟡 黄色

2. **表现力条形图**
   - Brightness (亮度): 0-1 → 0-100% 条形图
   - Breathiness (气声): 0-1 → 0-100% 条形图

**文件**: `js/visualizer/pitch-accuracy.js`

```javascript
export class PitchAccuracyIndicator {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
    }

    draw(cents) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制中心线
        this.ctx.strokeStyle = '#ccc';
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(centerX, this.canvas.height);
        this.ctx.stroke();

        // 绘制偏差指示器
        const offset = (cents / 50) * (this.canvas.width / 2);  // ±50 cents = 半屏
        const x = centerX + offset;

        // 颜色
        let color;
        if (Math.abs(cents) < 10) color = '#22c55e';  // 绿色
        else if (Math.abs(cents) < 30) color = '#eab308';  // 黄色
        else color = '#ef4444';  // 红色

        // 绘制圆点
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, centerY, 15, 0, Math.PI * 2);
        this.ctx.fill();

        // 显示数值
        this.ctx.fillStyle = '#000';
        this.ctx.font = '14px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${cents > 0 ? '+' : ''}${cents.toFixed(0)} cents`, x, centerY + 30);
    }
}
```

---

## 🧪 **Day 9: 集成测试 & Bug 修复**

### **测试清单**

- [ ] **录音功能**
  - 录音 10 秒 → 下载 → 播放 (Chrome/Firefox/Safari)
  - 录音中途刷新页面 → 数据丢失提示
  - 录音 > 5 分钟 → 自动停止

- [ ] **音色切换**
  - 切换 12 种音色 → 无崩溃
  - 录音中切换音色 → 正常工作

- [ ] **校准系统**
  - 完成校准 → 保存 → 刷新 → 加载成功
  - 校准后音准误差 < ±10 cents

- [ ] **性能**
  - 录音 5 分钟 → CPU < 30%
  - 可视化 → 60 FPS

---

## 🚀 **Day 10: 部署 & 用户测试**

### **部署检查清单**

- [ ] 所有功能通过浏览器冒烟测试
- [ ] 生产环境配置 (HTTPS 必需)
- [ ] 录音文件大小合理 (< 10MB / 5min)
- [ ] 控制台无报错
- [ ] README 更新 (录音功能说明)

### **早期用户测试**

招募 5-10 个测试用户:
- 音乐爱好者
- 创作者
- 技术同行

收集反馈:
- 录音流程是否顺畅?
- 音色质量是否满意?
- 有哪些 Bug?
- 最想要的功能?

---

## 📚 **技术依赖**

```json
{
  "dependencies": {
    "tone": "^15.1.22"  // 已有
  },
  "devDependencies": {
    // 无需额外依赖 (WAV 编码手写)
  }
}
```

**关键 API**:
- `MediaRecorder` (录音)
- `AudioContext.createMediaStreamDestination()` (录音源)
- `Blob` / `ArrayBuffer` (数据处理)
- `LocalStorage` (校准数据持久化)

---

## ⚠️ **常见坑**

1. **Safari MediaRecorder 限制**
   - 只支持 `audio/mp4` (不支持 `audio/webm`)
   - 解决: 检测浏览器,选择合适格式

2. **录音内存溢出**
   - 长时间录音 chunks 累积
   - 解决: 定时合并 chunks 或限制时长

3. **WAV 文件过大**
   - 44.1kHz 立体声 WAV ≈ 10MB/分钟
   - 解决: 单声道 + 降采样 (可选)

4. **校准数据丢失**
   - LocalStorage 被清除
   - 解决: 提供导出/导入功能

---

**Phase 3 技术路线清晰,开始执行!**

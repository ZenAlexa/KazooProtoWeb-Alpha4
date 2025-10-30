/**
 * PitchFrame 类型定义
 *
 * 这是 Phase 2 的核心数据结构，整合了音高、音量、表现力等所有特征。
 * 由 ExpressiveFeatures 生成，供 Continuous/Legacy 合成引擎消费。
 *
 * @module types/pitch-frame
 */

/**
 * PitchFrame - 单帧完整的音高和表现力数据
 *
 * @typedef {Object} PitchFrame
 *
 * @property {number} timestamp - 时间戳 (ms)
 *
 * // ===== 基础音高数据 (Phase 1 已有) =====
 * @property {number} frequency - 频率 (Hz, 范围: 80-800)
 * @property {string} note - 音符名称 (如 "C4", "A#5")
 * @property {number} octave - 八度 (范围: 0-8)
 * @property {number} confidence - YIN 置信度 (0-1, 越高越可靠)
 *
 * // ===== Phase 2 新增: 动态特征 =====
 * @property {number} volumeDb - 音量 (dB, 范围: -60 ~ 0)
 * @property {number} volumeLinear - 音量线性 (归一化, 范围: 0-1)
 *
 * // ===== Phase 2 新增: 音高精度 =====
 * @property {number} cents - 音分偏移 (范围: -50 ~ +50)
 *                            相对于最接近的十二平均律音高
 * @property {number} pitchStability - 音高稳定性 (0-1, 0=不稳定, 1=稳定)
 *
 * // ===== Phase 2 新增: 时域特征 =====
 * @property {('attack'|'sustain'|'release'|'silence')} articulation
 *           起音状态 (attack=新音符, sustain=持续, release=释放, silence=静音)
 * @property {number} attackTime - 起音时间 (ms, 范围: 0-200)
 *
 * // ===== Phase 2 新增: 频域特征 =====
 * @property {number} spectralCentroid - 频谱质心 (Hz, 范围: 0-8000)
 * @property {number} brightness - 音色亮度 (归一化, 范围: 0-1)
 * @property {number} formant - 共振峰估计 (Hz, 范围: 500-3000)
 *                              Phase 2 使用 Spectral Centroid 近似
 * @property {number} breathiness - 气声度/频谱平坦度 (0-1, 0=纯音, 1=白噪声)
 *
 * // ===== 原始数据 (调试用) =====
 * @property {Float32Array|null} rawAudioBuffer - 原始音频缓冲区 (可选)
 */

/**
 * 创建空白 PitchFrame (默认值)
 *
 * @returns {PitchFrame} 默认的 PitchFrame 对象
 */
export function createEmptyPitchFrame() {
  return {
    // 时间戳
    timestamp: 0,

    // 基础音高数据
    frequency: 0,
    note: "C4",
    octave: 4,
    confidence: 0,

    // 动态特征
    volumeDb: -60,
    volumeLinear: 0,

    // 音高精度
    cents: 0,
    pitchStability: 1,

    // 时域特征
    articulation: "silence",
    attackTime: 0,

    // 频域特征
    spectralCentroid: 0,
    brightness: 0.5,
    formant: 1000,
    breathiness: 0,

    // 原始数据
    rawAudioBuffer: null
  };
}

/**
 * 从基础音高信息创建 PitchFrame (向后兼容 Phase 1)
 *
 * @param {Object} pitchInfo - 基础音高信息 (来自 YIN 检测器)
 * @param {number} pitchInfo.frequency - 频率 (Hz)
 * @param {number} pitchInfo.confidence - 置信度 (0-1)
 * @param {string} [pitchInfo.note] - 音符名称
 * @param {number} [pitchInfo.octave] - 八度
 * @param {number} [timestamp=0] - 时间戳 (ms)
 * @returns {PitchFrame} 部分填充的 PitchFrame (其他字段为默认值)
 */
export function createPitchFrameFromBasic(pitchInfo, timestamp = 0) {
  const frame = createEmptyPitchFrame();

  frame.timestamp = timestamp;
  frame.frequency = pitchInfo.frequency || 0;
  frame.confidence = pitchInfo.confidence || 0;

  if (pitchInfo.note) {
    frame.note = pitchInfo.note;
  }
  if (pitchInfo.octave !== undefined) {
    frame.octave = pitchInfo.octave;
  }

  return frame;
}

/**
 * 验证 PitchFrame 数据完整性
 *
 * @param {PitchFrame} frame - 待验证的 PitchFrame
 * @returns {boolean} 如果所有必需字段都存在且在合理范围内，返回 true
 */
export function validatePitchFrame(frame) {
  if (!frame || typeof frame !== 'object') {
    return false;
  }

  // 检查必需字段
  const requiredFields = [
    'timestamp', 'frequency', 'confidence',
    'volumeDb', 'volumeLinear', 'cents',
    'articulation', 'brightness', 'breathiness'
  ];

  for (const field of requiredFields) {
    if (!(field in frame)) {
      return false;
    }
  }

  // 检查数值范围
  if (frame.frequency < 0 || frame.frequency > 10000) return false;
  if (frame.confidence < 0 || frame.confidence > 1) return false;
  if (frame.volumeDb < -100 || frame.volumeDb > 10) return false;
  if (frame.volumeLinear < 0 || frame.volumeLinear > 2) return false;
  if (frame.cents < -100 || frame.cents > 100) return false;
  if (frame.brightness < 0 || frame.brightness > 1) return false;
  if (frame.breathiness < 0 || frame.breathiness > 1) return false;

  // 检查枚举值
  const validArticulations = ['attack', 'sustain', 'release', 'silence'];
  if (!validArticulations.includes(frame.articulation)) {
    return false;
  }

  return true;
}

/**
 * 克隆 PitchFrame (深拷贝)
 *
 * @param {PitchFrame} frame - 源 PitchFrame
 * @returns {PitchFrame} 新的 PitchFrame 对象
 */
export function clonePitchFrame(frame) {
  const cloned = { ...frame };

  // 深拷贝 rawAudioBuffer
  if (frame.rawAudioBuffer) {
    cloned.rawAudioBuffer = new Float32Array(frame.rawAudioBuffer);
  }

  return cloned;
}

/**
 * 起音检测模块 - Onset Detector
 * Phase 2.4: 起音状态检测器
 *
 * 功能：检测音频的起音状态 (attack/sustain/release/silence)
 * 原理：基于能量包络的时域分析
 *
 * @module OnsetDetector
 * @author Ziming Wang & Claude
 * @date 2025-10-30
 */

/**
 * ArticulationType - 起音状态枚举
 * @typedef {'attack'|'sustain'|'release'|'silence'} ArticulationType
 */

/**
 * OnsetConfig - 起音检测配置
 * @typedef {Object} OnsetConfig
 * @property {number} [energyThreshold=6] - 能量阈值 (dB 增量)
 * @property {number} [timeWindow=3] - 检测窗口 (帧数)
 * @property {number} [minSilenceDuration=100] - 最小静音时长 (ms)
 * @property {number} [silenceThreshold=-40] - 静音判定阈值 (dB)
 * @property {number} [attackDuration=50] - Attack 状态持续时间 (ms)
 */

/**
 * OnsetDetector 类 - 起音状态检测器
 *
 * 状态转换图:
 * ```
 *   silence ──[能量突增]──> attack
 *      ↑                      ↓
 *      │                  [50ms后]
 *      │                      ↓
 *   [静音]               sustain
 *      ↑                      ↓
 *      │                 [能量衰减]
 *      │                      ↓
 *      └──────────────────  release
 * ```
 *
 * @class OnsetDetector
 * @example
 * const detector = new OnsetDetector({
 *   energyThreshold: 6,
 *   timeWindow: 3,
 *   minSilenceDuration: 100
 * });
 *
 * const state = detector.update(-12.5, Date.now());
 * if (state === 'attack') {
 *   console.log('检测到新音符起音!');
 * }
 */
export class OnsetDetector {
  /**
   * 构造函数
   * @param {OnsetConfig} config - 配置参数
   */
  constructor(config = {}) {
    // 配置参数 (支持别名)
    this.energyThreshold = config.energyThreshold ?? 6;
    this.timeWindow = config.timeWindow ?? 3;
    // 支持两种参数名: minSilenceDuration (标准) 和 releaseHoldTime (别名)
    this.minSilenceDuration = config.minSilenceDuration ?? config.releaseHoldTime ?? 100;
    this.silenceThreshold = config.silenceThreshold ?? -40;
    // 支持两种参数名: attackDuration (标准) 和 attackHoldTime (别名)
    this.attackDuration = config.attackDuration ?? config.attackHoldTime ?? 50;

    // 内部状态
    this.volumeHistory = [];  // 音量历史缓冲区 (最近 N 帧)
    this.currentState = 'silence';  // 当前状态
    this.lastAttackTime = 0;  // 上次 Attack 时间戳
    this.lastSoundTime = 0;   // 上次有声音时间戳
    this.lastReleaseTime = 0; // 上次 Release 时间戳

    // 统计信息
    this.stateChangeCount = 0;
    this.attackCount = 0;
  }

  /**
   * 更新检测器状态并返回当前起音类型
   * @param {number} volumeDb - 当前帧音量 (dB)
   * @param {number} timestamp - 当前时间戳 (ms)
   * @returns {ArticulationType} 起音状态
   * @throws {TypeError} 如果参数类型错误
   * @example
   * const articulation = onsetDetector.update(-12.5, Date.now());
   */
  update(volumeDb, timestamp) {
    // 输入验证
    if (!isFinite(volumeDb) || !isFinite(timestamp)) {
      console.warn('[OnsetDetector] 收到无效输入，保持当前状态');
      return this.currentState;
    }

    // 更新音量历史
    this._updateHistory(volumeDb);

    // 状态机逻辑
    const previousState = this.currentState;
    const newState = this._detectState(volumeDb, timestamp);

    // 记录状态变化
    if (newState !== previousState) {
      this._onStateChange(previousState, newState, timestamp);
    }

    this.currentState = newState;
    return this.currentState;
  }

  /**
   * 更新音量历史缓冲区
   * @private
   * @param {number} volumeDb - 音量 (dB)
   */
  _updateHistory(volumeDb) {
    this.volumeHistory.push(volumeDb);

    // 保持窗口大小
    if (this.volumeHistory.length > this.timeWindow) {
      this.volumeHistory.shift();
    }
  }

  /**
   * 检测当前状态
   * @private
   * @param {number} volumeDb - 当前音量 (dB)
   * @param {number} timestamp - 当前时间戳 (ms)
   * @returns {ArticulationType} 检测到的状态
   */
  _detectState(volumeDb, timestamp) {
    // 1. 检测静音
    if (this._isSilent(volumeDb)) {
      const silenceDuration = timestamp - this.lastSoundTime;
      if (silenceDuration > this.minSilenceDuration) {
        return 'silence';
      }
    } else {
      this.lastSoundTime = timestamp;
    }

    // 2. 检测 Attack (能量突增)
    if (this._detectAttack()) {
      return 'attack';
    }

    // 3. Attack 持续一段时间后转为 Sustain
    if (this.currentState === 'attack') {
      const timeSinceAttack = timestamp - this.lastAttackTime;
      if (timeSinceAttack > this.attackDuration) {
        return 'sustain';
      }
      // Attack 期间保持 Attack 状态
      return 'attack';
    }

    // 4. 检测 Release (能量衰减)
    if (this._detectRelease() && this.currentState === 'sustain') {
      return 'release';
    }

    // 5. Release 后如果能量继续下降，转为 Silence
    if (this.currentState === 'release') {
      const timeSinceRelease = timestamp - this.lastReleaseTime;
      if (timeSinceRelease > this.attackDuration && this._isSilent(volumeDb)) {
        return 'silence';
      }
      // 否则保持 Release 状态
      return 'release';
    }

    // 6. 保持当前状态
    return this.currentState;
  }

  /**
   * 判断是否静音
   * @private
   * @param {number} volumeDb - 音量 (dB)
   * @returns {boolean} 是否静音
   */
  _isSilent(volumeDb) {
    return volumeDb < this.silenceThreshold;
  }

  /**
   * 检测能量突增 (Attack)
   * @private
   * @returns {boolean} 是否检测到 Attack
   */
  _detectAttack() {
    // 需要足够的历史数据
    if (this.volumeHistory.length < this.timeWindow) {
      return false;
    }

    // 计算能量增量：最近一帧 vs 窗口内平均
    const recentVolume = this.volumeHistory[this.volumeHistory.length - 1];
    const previousVolumes = this.volumeHistory.slice(0, -1);
    const previousAverage = previousVolumes.reduce((a, b) => a + b, 0) / previousVolumes.length;

    const energyIncrease = recentVolume - previousAverage;

    // 能量突增且不在 Attack 状态中
    return energyIncrease > this.energyThreshold && this.currentState !== 'attack';
  }

  /**
   * 检测能量衰减 (Release)
   * @private
   * @returns {boolean} 是否检测到 Release
   */
  _detectRelease() {
    // 需要足够的历史数据
    if (this.volumeHistory.length < this.timeWindow) {
      return false;
    }

    // 计算能量衰减：窗口内平均 vs 最近一帧
    const recentVolume = this.volumeHistory[this.volumeHistory.length - 1];
    const previousVolumes = this.volumeHistory.slice(0, -1);
    const previousAverage = previousVolumes.reduce((a, b) => a + b, 0) / previousVolumes.length;

    const energyDecrease = previousAverage - recentVolume;

    // 能量衰减超过阈值的一半
    return energyDecrease > (this.energyThreshold / 2);
  }

  /**
   * 状态变化回调
   * @private
   * @param {ArticulationType} from - 原状态
   * @param {ArticulationType} to - 新状态
   * @param {number} timestamp - 时间戳
   */
  _onStateChange(from, to, timestamp) {
    this.stateChangeCount++;

    // 记录特殊时间点
    if (to === 'attack') {
      this.lastAttackTime = timestamp;
      this.attackCount++;
    } else if (to === 'release') {
      this.lastReleaseTime = timestamp;
    }

    // 调试日志 (可配置开关)
    if (this.debug) {
      console.log(`[OnsetDetector] 状态变化: ${from} → ${to} @ ${timestamp}ms`);
    }
  }

  /**
   * 重置检测器状态
   */
  reset() {
    this.volumeHistory = [];
    this.currentState = 'silence';
    this.lastAttackTime = 0;
    this.lastSoundTime = 0;
    this.lastReleaseTime = 0;
    this.stateChangeCount = 0;
    this.attackCount = 0;
  }

  /**
   * 获取当前状态 (不更新)
   * @returns {ArticulationType} 当前起音状态
   */
  getState() {
    return this.currentState;
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   * @returns {number} return.stateChangeCount - 状态变化次数
   * @returns {number} return.attackCount - Attack 次数
   * @returns {ArticulationType} return.currentState - 当前状态
   */
  getStats() {
    return {
      stateChangeCount: this.stateChangeCount,
      attackCount: this.attackCount,
      currentState: this.currentState
    };
  }

  /**
   * 启用调试模式
   * @param {boolean} enabled - 是否启用
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * 获取检测器内部状态 (测试专用)
   * @returns {Object} 内部状态
   * @private
   */
  __test_getState() {
    return {
      volumeHistory: [...this.volumeHistory],
      currentState: this.currentState,
      lastAttackTime: this.lastAttackTime,
      lastSoundTime: this.lastSoundTime,
      lastReleaseTime: this.lastReleaseTime,
      stateChangeCount: this.stateChangeCount,
      attackCount: this.attackCount,
      config: {
        energyThreshold: this.energyThreshold,
        timeWindow: this.timeWindow,
        minSilenceDuration: this.minSilenceDuration,
        silenceThreshold: this.silenceThreshold,
        attackDuration: this.attackDuration
      }
    };
  }
}

/**
 * 创建默认配置的 OnsetDetector
 * @returns {OnsetDetector} 检测器实例
 */
export function createDefaultOnsetDetector() {
  return new OnsetDetector({
    energyThreshold: 6,
    timeWindow: 3,
    minSilenceDuration: 100,
    silenceThreshold: -40,
    attackDuration: 50
  });
}

// 导出默认实例
export default {
  OnsetDetector,
  createDefaultOnsetDetector
};

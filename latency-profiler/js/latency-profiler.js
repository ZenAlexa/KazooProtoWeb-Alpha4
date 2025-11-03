/**
 * Latency Profiler - 延迟剖析器
 *
 * 职责:
 * 1. 收集全链路时间戳 (T0-T9)
 * 2. 计算各段延迟
 * 3. 生成统计报告 (平均/P50/P95/Max)
 * 4. 实时监控与告警
 * 5. 自动诊断瓶颈
 */

class LatencyProfiler {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.sessions = new Map();  // sessionId -> session对象
        this.completedSessions = [];  // 完整的session数组(用于统计)
        this.maxCompletedSessions = 512;  // 最多保留512条记录

        // 时钟同步工具 (需要单独加载clock-sync.js)
        this.clockSync = window.ClockSync ? new window.ClockSync(audioContext) : null;

        // 统计数据
        this.stats = {
            totalSessions: 0,
            completedSessions: 0,
            droppedSessions: 0
        };

        // 告警阈值 (毫秒)
        this.thresholds = {
            totalLatency: 50,        // 总延迟超过50ms告警
            workletProcessing: 10,   // Worklet处理超过10ms告警
            messageTransfer: 2,      // 消息传输超过2ms告警
            mainThreadProcessing: 5, // 主线程处理超过5ms告警
            outputBuffering: 30      // 输出缓冲超过30ms告警
        };

        // 定期刷新时钟同步 (每5秒)
        if (this.clockSync) {
            setInterval(() => this.clockSync.refresh(), 5000);
        }

        console.log('[LatencyProfiler] Initialized');
        console.log('  Clock sync:', this.clockSync ? 'Available' : 'Not available (will use approximation)');
    }

    /**
     * 创建新的测量会话 (从Worklet端调用)
     * @param {string} sessionId - 唯一会话ID
     * @param {number} t0_capture - 麦克风采集时刻 (AudioContext.currentTime 秒)
     * @param {number} t1_workletEntry - Worklet入口 (AudioContext.currentTime 秒)
     */
    createSession(sessionId, t0_capture, t1_workletEntry) {
        const session = {
            id: sessionId,

            // Worklet端时间戳 (AudioContext.currentTime 秒)
            t0_capture: t0_capture,
            t1_workletEntry: t1_workletEntry,
            t2_yinStart: null,
            t3_yinComplete: null,
            t4_featuresComplete: null,
            t5_messageSent: null,

            // 主线程端时间戳 (performance.now() 毫秒)
            t6_messageReceived: null,
            t7_handlerStart: null,
            t8_synthUpdate: null,
            t9_outputScheduled: null,  // AudioContext.currentTime 秒

            // 元数据
            createdAt: performance.now(),
            completedAt: null
        };

        this.sessions.set(sessionId, session);
        this.stats.totalSessions++;

        return session;
    }

    /**
     * 从Worklet接收完整的_profiling对象并创建/更新会话
     * @param {Object} profiling - Worklet发送的_profiling对象
     */
    recordWorkletData(profiling) {
        const sessionId = profiling.sessionId || `${profiling.t0_capture}-${profiling.t1_workletEntry}`;

        let session = this.sessions.get(sessionId);
        if (!session) {
            session = this.createSession(sessionId, profiling.t0_capture, profiling.t1_workletEntry);
        }

        // 更新Worklet端时间戳
        session.t2_yinStart = profiling.t2_yinStart;
        session.t3_yinComplete = profiling.t3_yinComplete;
        session.t4_featuresComplete = profiling.t4_featuresComplete;
        session.t5_messageSent = profiling.t5_messageSent;

        return session;
    }

    /**
     * 记录主线程端时间戳
     * @param {string} sessionId - 会话ID
     * @param {Object} timestamps - 主线程时间戳对象
     */
    recordMainThreadData(sessionId, timestamps) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn('[LatencyProfiler] Session not found:', sessionId);
            return null;
        }

        session.t6_messageReceived = timestamps.t6_messageReceived;
        session.t7_handlerStart = timestamps.t7_handlerStart;
        session.t8_synthUpdate = timestamps.t8_synthUpdate;
        session.t9_outputScheduled = timestamps.t9_outputScheduled;

        // 标记完成
        session.completedAt = performance.now();
        this.stats.completedSessions++;

        // 移动到完成列表
        this.completedSessions.push(session);
        if (this.completedSessions.length > this.maxCompletedSessions) {
            this.completedSessions.shift();
        }

        // 从活跃map中移除 (防止内存泄漏)
        this.sessions.delete(sessionId);

        // 计算延迟并检查告警
        const latency = this.calculateSessionLatency(session);
        this._checkThresholds(session, latency);

        return session;
    }

    /**
     * 计算单个会话的延迟
     * @param {Object} session - 会话对象
     * @returns {Object|null} 延迟数据
     */
    calculateSessionLatency(session) {
        if (!session.t9_outputScheduled || !session.t0_capture) {
            return null;
        }

        // 使用时钟同步工具计算延迟
        const clockSync = this.clockSync;

        // Worklet处理延迟 (T1→T4, 纯音频时间)
        const workletProcessing = (session.t4_featuresComplete - session.t1_workletEntry) * 1000;

        // 消息传输延迟 (T5→T6, 需要时钟转换)
        let messageTransfer;
        if (clockSync) {
            const t5_perf = clockSync.audioTimeToPerformanceTime(session.t5_messageSent);
            messageTransfer = session.t6_messageReceived - t5_perf;
        } else {
            // 近似: 假设音频时间与主线程时间差为固定偏移
            messageTransfer = session.t6_messageReceived - (session.t5_messageSent * 1000);
        }

        // 主线程处理延迟 (T6→T8, 纯主线程时间)
        const mainThreadProcessing = session.t8_synthUpdate - session.t6_messageReceived;

        // 输出缓冲延迟 (T8→T9)
        let outputBuffering;
        if (clockSync) {
            const t8_audio = clockSync.performanceTimeToAudioTime(session.t8_synthUpdate);
            outputBuffering = (session.t9_outputScheduled - t8_audio) * 1000;
        } else {
            outputBuffering = (session.t9_outputScheduled * 1000) - session.t8_synthUpdate;
        }

        // 总延迟 (T0→T9)
        let totalLatency;
        if (clockSync) {
            const t0_perf = clockSync.audioTimeToPerformanceTime(session.t0_capture);
            const t9_perf = clockSync.audioTimeToPerformanceTime(session.t9_outputScheduled);
            totalLatency = t9_perf - t0_perf;
        } else {
            totalLatency = (session.t9_outputScheduled - session.t0_capture) * 1000;
        }

        // 详细分解
        const breakdown = {
            yinAlgorithm: session.t3_yinComplete && session.t2_yinStart
                ? (session.t3_yinComplete - session.t2_yinStart) * 1000
                : 0,
            featureExtraction: session.t4_featuresComplete && session.t3_yinComplete
                ? (session.t4_featuresComplete - session.t3_yinComplete) * 1000
                : 0,
            handlerOverhead: session.t7_handlerStart && session.t6_messageReceived
                ? session.t7_handlerStart - session.t6_messageReceived
                : 0,
            toneJsUpdate: session.t8_synthUpdate && session.t7_handlerStart
                ? session.t8_synthUpdate - session.t7_handlerStart
                : 0
        };

        return {
            totalLatency,
            workletProcessing,
            messageTransfer,
            mainThreadProcessing,
            outputBuffering,
            breakdown
        };
    }

    /**
     * 检查延迟是否超过阈值并告警
     */
    _checkThresholds(session, latency) {
        if (!latency) return;

        const alerts = [];

        if (latency.totalLatency > this.thresholds.totalLatency) {
            alerts.push(`Total latency ${latency.totalLatency.toFixed(1)}ms > ${this.thresholds.totalLatency}ms`);
        }

        if (latency.workletProcessing > this.thresholds.workletProcessing) {
            alerts.push(`Worklet processing ${latency.workletProcessing.toFixed(1)}ms > ${this.thresholds.workletProcessing}ms`);
        }

        if (latency.outputBuffering > this.thresholds.outputBuffering) {
            alerts.push(`Output buffering ${latency.outputBuffering.toFixed(1)}ms > ${this.thresholds.outputBuffering}ms (likely Bluetooth device)`);
        }

        if (alerts.length > 0) {
            console.warn(`[LatencyProfiler] ⚠️ Latency alert (session ${session.id.substring(0, 8)}):`);
            alerts.forEach(msg => console.warn(`  - ${msg}`));
        }
    }

    /**
     * 生成统计报告
     * @returns {Object} 统计数据
     */
    generateReport() {
        const latencies = this.completedSessions
            .map(s => this.calculateSessionLatency(s))
            .filter(l => l !== null);

        if (latencies.length === 0) {
            return {
                sampleCount: 0,
                message: 'No completed sessions yet'
            };
        }

        const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        const p50 = arr => {
            const sorted = [...arr].sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length * 0.5)];
        };
        const p95 = arr => {
            const sorted = [...arr].sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length * 0.95)];
        };
        const max = arr => Math.max(...arr);
        const min = arr => Math.min(...arr);

        const report = {
            sampleCount: latencies.length,
            totalStats: this.stats,

            totalLatency: {
                avg: avg(latencies.map(l => l.totalLatency)),
                p50: p50(latencies.map(l => l.totalLatency)),
                p95: p95(latencies.map(l => l.totalLatency)),
                max: max(latencies.map(l => l.totalLatency)),
                min: min(latencies.map(l => l.totalLatency))
            },

            workletProcessing: {
                avg: avg(latencies.map(l => l.workletProcessing)),
                p50: p50(latencies.map(l => l.workletProcessing)),
                p95: p95(latencies.map(l => l.workletProcessing)),
                max: max(latencies.map(l => l.workletProcessing))
            },

            messageTransfer: {
                avg: avg(latencies.map(l => l.messageTransfer)),
                p50: p50(latencies.map(l => l.messageTransfer)),
                p95: p95(latencies.map(l => l.messageTransfer)),
                max: max(latencies.map(l => l.messageTransfer))
            },

            mainThreadProcessing: {
                avg: avg(latencies.map(l => l.mainThreadProcessing)),
                p50: p50(latencies.map(l => l.mainThreadProcessing)),
                p95: p95(latencies.map(l => l.mainThreadProcessing)),
                max: max(latencies.map(l => l.mainThreadProcessing))
            },

            outputBuffering: {
                avg: avg(latencies.map(l => l.outputBuffering)),
                p50: p50(latencies.map(l => l.outputBuffering)),
                p95: p95(latencies.map(l => l.outputBuffering)),
                max: max(latencies.map(l => l.outputBuffering))
            },

            breakdown: {
                yinAlgorithm: {
                    avg: avg(latencies.map(l => l.breakdown.yinAlgorithm)),
                    max: max(latencies.map(l => l.breakdown.yinAlgorithm))
                },
                featureExtraction: {
                    avg: avg(latencies.map(l => l.breakdown.featureExtraction)),
                    max: max(latencies.map(l => l.breakdown.featureExtraction))
                },
                handlerOverhead: {
                    avg: avg(latencies.map(l => l.breakdown.handlerOverhead)),
                    max: max(latencies.map(l => l.breakdown.handlerOverhead))
                },
                toneJsUpdate: {
                    avg: avg(latencies.map(l => l.breakdown.toneJsUpdate)),
                    max: max(latencies.map(l => l.breakdown.toneJsUpdate))
                }
            }
        };

        // 自动诊断
        report.diagnosis = this._generateDiagnosis(report);

        return report;
    }

    /**
     * 自动诊断延迟瓶颈
     */
    _generateDiagnosis(report) {
        const diagnosis = {
            severity: 'good',  // 'good' | 'warning' | 'critical'
            bottleneck: null,
            recommendations: []
        };

        const total = report.totalLatency.avg;

        if (total > 100) {
            diagnosis.severity = 'critical';

            if (report.outputBuffering.avg > 80) {
                diagnosis.bottleneck = 'output_device';
                diagnosis.recommendations.push('检测到高输出缓冲延迟(>80ms)，极可能是蓝牙音频设备');
                diagnosis.recommendations.push('建议: 切换到有线耳机/扬声器');
            } else if (report.workletProcessing.avg > 40) {
                diagnosis.bottleneck = 'worklet_accumulation';
                diagnosis.recommendations.push('Worklet处理延迟过高，可能是YIN缓冲累积问题');
                diagnosis.recommendations.push('建议: 实现动态缓冲大小或滑动窗口算法');
            } else {
                diagnosis.bottleneck = 'multiple';
                diagnosis.recommendations.push('延迟分散在多个环节，需要综合优化');
            }

        } else if (total > 50) {
            diagnosis.severity = 'warning';
            diagnosis.recommendations.push('延迟在可接受范围(50-100ms)，但仍有优化空间');

            if (report.workletProcessing.avg > 10) {
                diagnosis.recommendations.push('考虑优化Worklet处理逻辑');
            }
            if (report.outputBuffering.avg > 30) {
                diagnosis.recommendations.push('输出缓冲偏高，检查音频设备配置');
            }

        } else if (total < 20) {
            diagnosis.severity = 'excellent';
            diagnosis.recommendations.push('延迟<20ms，已达专业级实时演奏标准');
        } else {
            diagnosis.severity = 'good';
            diagnosis.recommendations.push('延迟<50ms，适合实时创作应用');
        }

        return diagnosis;
    }

    /**
     * 打印详细报告到控制台
     */
    printReport() {
        const report = this.generateReport();

        if (report.sampleCount === 0) {
            console.log('[LatencyProfiler] No data yet');
            return;
        }

        console.log('');
        console.log('═══════════════════════════════════════════════════');
        console.log('        LATENCY PROFILER DIAGNOSTIC REPORT          ');
        console.log('═══════════════════════════════════════════════════');
        console.log('');
        console.log(`📊 Samples: ${report.sampleCount} sessions`);
        console.log('');
        console.log('🕐 Total Latency (T0→T9):');
        console.log(`   Average: ${report.totalLatency.avg.toFixed(1)}ms`);
        console.log(`   P50:     ${report.totalLatency.p50.toFixed(1)}ms`);
        console.log(`   P95:     ${report.totalLatency.p95.toFixed(1)}ms`);
        console.log(`   Max:     ${report.totalLatency.max.toFixed(1)}ms`);
        console.log(`   Min:     ${report.totalLatency.min.toFixed(1)}ms`);
        console.log('');
        console.log('📈 Breakdown:');
        console.log(`   ├─ Worklet Processing:    ${report.workletProcessing.avg.toFixed(2)}ms (avg)`);
        console.log(`   │  ├─ YIN Algorithm:       ${report.breakdown.yinAlgorithm.avg.toFixed(2)}ms`);
        console.log(`   │  └─ Feature Extraction:  ${report.breakdown.featureExtraction.avg.toFixed(2)}ms`);
        console.log(`   ├─ Message Transfer:      ${report.messageTransfer.avg.toFixed(2)}ms`);
        console.log(`   ├─ Main Thread:           ${report.mainThreadProcessing.avg.toFixed(2)}ms`);
        console.log(`   │  ├─ Handler Overhead:    ${report.breakdown.handlerOverhead.avg.toFixed(2)}ms`);
        console.log(`   │  └─ Tone.js Update:      ${report.breakdown.toneJsUpdate.avg.toFixed(2)}ms`);
        console.log(`   └─ Output Buffering:      ${report.outputBuffering.avg.toFixed(2)}ms`);
        console.log('');
        console.log('🔍 Diagnosis:');
        console.log(`   Severity: ${report.diagnosis.severity.toUpperCase()}`);
        if (report.diagnosis.bottleneck) {
            console.log(`   Bottleneck: ${report.diagnosis.bottleneck}`);
        }
        report.diagnosis.recommendations.forEach(rec => {
            console.log(`   💡 ${rec}`);
        });
        console.log('');
        console.log('═══════════════════════════════════════════════════');
        console.log('');
    }

    /**
     * 清理过期的未完成会话 (防止内存泄漏)
     */
    cleanup() {
        const now = performance.now();
        const timeout = 5000;  // 5秒超时

        let cleaned = 0;
        for (const [id, session] of this.sessions.entries()) {
            if (now - session.createdAt > timeout) {
                this.sessions.delete(id);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.stats.droppedSessions += cleaned;
            console.warn(`[LatencyProfiler] Cleaned ${cleaned} expired sessions`);
        }
    }
}

// 定期清理
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        if (window.latencyProfiler) {
            window.latencyProfiler.cleanup();
        }
    }, 10000);  // 每10秒清理一次
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LatencyProfiler;
}

// 浏览器环境下暴露到全局 (确保通过非模块脚本加载时可访问)
if (typeof window !== 'undefined') {
    window.LatencyProfiler = LatencyProfiler;
}

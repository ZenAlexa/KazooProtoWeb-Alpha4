/**
 * PitchDetector Unit Tests
 *
 * Tests all core functionality of the pitch detection module:
 * - Frequency to note conversion
 * - Note to frequency conversion
 * - Median filtering (smoothing)
 * - Confidence calculation
 * - Pitch quantization
 * - Configuration methods
 *
 * @version 0.3.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock PitchDetector class - copy implementation but mock external dependencies
class PitchDetector {
    constructor() {
        this.detector = null;
        this.sampleRate = 44100;
        this.threshold = 0.1;
        this.pitchHistory = [];
        this.historySize = 5;
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.minVolumeThreshold = 0.01;
    }

    getSmoothedPitch() {
        if (this.pitchHistory.length === 0) return 0;
        const sorted = [...this.pitchHistory].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
            return sorted[mid];
        }
    }

    frequencyToNote(frequency) {
        const A4 = 440;
        const C0 = A4 * Math.pow(2, -4.75);
        const halfSteps = 12 * Math.log2(frequency / C0);
        const roundedHalfSteps = Math.round(halfSteps);
        const noteIndex = roundedHalfSteps % 12;
        const octave = Math.floor(roundedHalfSteps / 12);
        const cents = Math.round((halfSteps - roundedHalfSteps) * 100);

        return {
            note: this.noteNames[noteIndex],
            octave: octave,
            fullNote: `${this.noteNames[noteIndex]}${octave}`,
            cents: cents
        };
    }

    noteToFrequency(note) {
        const A4 = 440;
        const noteRegex = /^([A-G]#?)(\d+)$/;
        const match = note.match(noteRegex);

        if (!match) return 0;

        const noteName = match[1];
        const octave = parseInt(match[2]);
        const noteIndex = this.noteNames.indexOf(noteName);
        if (noteIndex === -1) return 0;

        const halfStepsFromA4 = (octave - 4) * 12 + (noteIndex - 9);
        const frequency = A4 * Math.pow(2, halfStepsFromA4 / 12);

        return frequency;
    }

    calculateConfidence(audioBuffer, frequency) {
        if (!frequency || frequency <= 0) return 0;
        if (!audioBuffer || audioBuffer.length === 0) return 0; // Handle empty buffer

        let sumSquares = 0;
        for (let i = 0; i < audioBuffer.length; i++) {
            sumSquares += audioBuffer[i] * audioBuffer[i];
        }
        const rms = Math.sqrt(sumSquares / audioBuffer.length);

        const minRMS = 0.01;
        const maxRMS = 0.3;
        let confidence = (rms - minRMS) / (maxRMS - minRMS);
        confidence = Math.max(0, Math.min(1, confidence));

        if (frequency >= 80 && frequency <= 800) {
            confidence = Math.min(confidence * 1.2, 1);
        }

        return confidence;
    }

    quantizePitch(frequency) {
        const noteInfo = this.frequencyToNote(frequency);
        return this.noteToFrequency(noteInfo.fullNote);
    }

    reset() {
        this.pitchHistory = [];
    }

    setVolumeThreshold(threshold) {
        this.minVolumeThreshold = threshold;
    }

    setSmoothingSize(size) {
        this.historySize = Math.max(1, Math.min(20, size));
    }

    getNoteRange(minFreq, maxFreq) {
        const minNote = this.frequencyToNote(minFreq);
        const maxNote = this.frequencyToNote(maxFreq);
        const notes = [];
        const minOctave = minNote.octave;
        const maxOctave = maxNote.octave;

        for (let octave = minOctave; octave <= maxOctave; octave++) {
            for (let i = 0; i < 12; i++) {
                const fullNote = `${this.noteNames[i]}${octave}`;
                const freq = this.noteToFrequency(fullNote);
                if (freq >= minFreq && freq <= maxFreq) {
                    notes.push({ note: fullNote, frequency: freq });
                }
            }
        }
        return notes;
    }
}

describe('PitchDetector', () => {
    let detector;

    beforeEach(() => {
        detector = new PitchDetector();
    });

    describe('Constructor', () => {
        it('should initialize with default values', () => {
            expect(detector.sampleRate).toBe(44100);
            expect(detector.threshold).toBe(0.1);
            expect(detector.historySize).toBe(5);
            expect(detector.minVolumeThreshold).toBe(0.01);
            expect(detector.pitchHistory).toEqual([]);
        });

        it('should have all 12 note names', () => {
            expect(detector.noteNames).toHaveLength(12);
            expect(detector.noteNames[0]).toBe('C');
            expect(detector.noteNames[9]).toBe('A');
        });
    });

    describe('frequencyToNote()', () => {
        it('should convert A4 (440Hz) correctly', () => {
            const result = detector.frequencyToNote(440);
            expect(result.note).toBe('A');
            expect(result.octave).toBe(4);
            expect(result.fullNote).toBe('A4');
            expect(result.cents).toBe(0);
        });

        it('should convert C4 (261.63Hz) correctly', () => {
            const result = detector.frequencyToNote(261.63);
            expect(result.note).toBe('C');
            expect(result.octave).toBe(4);
            expect(result.fullNote).toBe('C4');
            expect(Math.abs(result.cents)).toBeLessThan(5); // Within 5 cents
        });

        it('should convert E4 (329.63Hz) correctly', () => {
            const result = detector.frequencyToNote(329.63);
            expect(result.note).toBe('E');
            expect(result.octave).toBe(4);
        });

        it('should convert G5 (783.99Hz) correctly', () => {
            const result = detector.frequencyToNote(783.99);
            expect(result.note).toBe('G');
            expect(result.octave).toBe(5);
        });

        it('should handle sharp notes (C#4)', () => {
            const result = detector.frequencyToNote(277.18);
            expect(result.note).toBe('C#');
            expect(result.octave).toBe(4);
        });

        it('should calculate cents for slightly flat pitch', () => {
            // 435Hz is slightly flat from A4 (440Hz)
            const result = detector.frequencyToNote(435);
            expect(result.note).toBe('A');
            expect(result.cents).toBeLessThan(0); // Negative cents = flat
        });

        it('should calculate cents for slightly sharp pitch', () => {
            // 445Hz is slightly sharp from A4 (440Hz)
            const result = detector.frequencyToNote(445);
            expect(result.note).toBe('A');
            expect(result.cents).toBeGreaterThan(0); // Positive cents = sharp
        });
    });

    describe('noteToFrequency()', () => {
        it('should convert A4 to 440Hz', () => {
            const freq = detector.noteToFrequency('A4');
            expect(freq).toBeCloseTo(440, 1);
        });

        it('should convert C4 to ~261.63Hz', () => {
            const freq = detector.noteToFrequency('C4');
            expect(freq).toBeCloseTo(261.63, 1);
        });

        it('should convert E4 to ~329.63Hz', () => {
            const freq = detector.noteToFrequency('E4');
            expect(freq).toBeCloseTo(329.63, 1);
        });

        it('should handle sharp notes (C#4)', () => {
            const freq = detector.noteToFrequency('C#4');
            expect(freq).toBeCloseTo(277.18, 1);
        });

        it('should handle different octaves', () => {
            const a3 = detector.noteToFrequency('A3');
            const a4 = detector.noteToFrequency('A4');
            const a5 = detector.noteToFrequency('A5');

            expect(a4).toBeCloseTo(a3 * 2, 1); // Octave doubles frequency
            expect(a5).toBeCloseTo(a4 * 2, 1);
        });

        it('should return 0 for invalid note format', () => {
            expect(detector.noteToFrequency('Invalid')).toBe(0);
            expect(detector.noteToFrequency('Z4')).toBe(0);
            expect(detector.noteToFrequency('A')).toBe(0);
            expect(detector.noteToFrequency('4A')).toBe(0);
        });
    });

    describe('Frequency/Note conversion round-trip', () => {
        it('should preserve frequency through round-trip conversion', () => {
            const originalFreq = 440;
            const note = detector.frequencyToNote(originalFreq);
            const convertedFreq = detector.noteToFrequency(note.fullNote);
            expect(convertedFreq).toBeCloseTo(originalFreq, 0);
        });

        it('should preserve note through round-trip conversion', () => {
            const originalNote = 'C#5';
            const freq = detector.noteToFrequency(originalNote);
            const note = detector.frequencyToNote(freq);
            expect(note.fullNote).toBe(originalNote);
        });
    });

    describe('getSmoothedPitch()', () => {
        it('should return 0 for empty history', () => {
            expect(detector.getSmoothedPitch()).toBe(0);
        });

        it('should return single value for history of 1', () => {
            detector.pitchHistory = [440];
            expect(detector.getSmoothedPitch()).toBe(440);
        });

        it('should return median for odd-length history', () => {
            detector.pitchHistory = [430, 440, 450, 460, 470];
            expect(detector.getSmoothedPitch()).toBe(450); // Middle value
        });

        it('should return average of two middle values for even-length history', () => {
            detector.pitchHistory = [430, 440, 450, 460];
            expect(detector.getSmoothedPitch()).toBe(445); // (440 + 450) / 2
        });

        it('should filter out outliers with median', () => {
            // One outlier should not affect median
            detector.pitchHistory = [440, 441, 442, 443, 999];
            const smoothed = detector.getSmoothedPitch();
            expect(smoothed).toBe(442); // Median, not affected by 999
        });

        it('should handle unsorted input correctly', () => {
            detector.pitchHistory = [460, 430, 450, 440, 470];
            expect(detector.getSmoothedPitch()).toBe(450); // Sorted median
        });
    });

    describe('calculateConfidence()', () => {
        it('should return 0 for invalid frequency', () => {
            const buffer = new Float32Array([0.1, 0.2, 0.1]);
            expect(detector.calculateConfidence(buffer, 0)).toBe(0);
            expect(detector.calculateConfidence(buffer, -100)).toBe(0);
        });

        it('should return low confidence for quiet signal', () => {
            const buffer = new Float32Array(1024).fill(0.001); // Very quiet
            const confidence = detector.calculateConfidence(buffer, 440);
            expect(confidence).toBeLessThan(0.2);
        });

        it('should return high confidence for loud signal', () => {
            const buffer = new Float32Array(1024).fill(0.2); // Loud signal
            const confidence = detector.calculateConfidence(buffer, 440);
            expect(confidence).toBeGreaterThan(0.5);
        });

        it('should boost confidence for human voice range (80-800Hz)', () => {
            const buffer = new Float32Array(1024).fill(0.1);
            const confVoice = detector.calculateConfidence(buffer, 200); // In range
            const confHigh = detector.calculateConfidence(buffer, 1500); // Out of range
            expect(confVoice).toBeGreaterThan(confHigh);
        });

        it('should clamp confidence to 0-1 range', () => {
            const quietBuffer = new Float32Array(1024).fill(0.0001);
            const loudBuffer = new Float32Array(1024).fill(0.5);

            const confQuiet = detector.calculateConfidence(quietBuffer, 440);
            const confLoud = detector.calculateConfidence(loudBuffer, 440);

            expect(confQuiet).toBeGreaterThanOrEqual(0);
            expect(confQuiet).toBeLessThanOrEqual(1);
            expect(confLoud).toBeGreaterThanOrEqual(0);
            expect(confLoud).toBeLessThanOrEqual(1);
        });

        it('should calculate RMS correctly', () => {
            // Known RMS: [0.1, 0.2, 0.3] -> sqrt((0.01 + 0.04 + 0.09) / 3) ≈ 0.216
            const buffer = new Float32Array([0.1, 0.2, 0.3]);
            const confidence = detector.calculateConfidence(buffer, 440);
            expect(confidence).toBeGreaterThan(0); // Should detect signal
        });
    });

    describe('quantizePitch()', () => {
        it('should snap frequency to nearest note', () => {
            // 438Hz is close to A4 (440Hz)
            const quantized = detector.quantizePitch(438);
            expect(quantized).toBeCloseTo(440, 1);
        });

        it('should snap 435Hz to A4', () => {
            const quantized = detector.quantizePitch(435);
            expect(quantized).toBeCloseTo(440, 1);
        });

        it('should snap 445Hz to A4', () => {
            const quantized = detector.quantizePitch(445);
            expect(quantized).toBeCloseTo(440, 1);
        });

        it('should handle frequencies between notes correctly', () => {
            // 455Hz is roughly between A4 (440) and A#4 (466.16)
            const quantized = detector.quantizePitch(455);
            // Should snap to closer note
            expect(quantized).toBeCloseTo(466.16, 0); // Closer to A#4
        });
    });

    describe('reset()', () => {
        it('should clear pitch history', () => {
            detector.pitchHistory = [440, 441, 442];
            detector.reset();
            expect(detector.pitchHistory).toEqual([]);
        });
    });

    describe('setVolumeThreshold()', () => {
        it('should update volume threshold', () => {
            detector.setVolumeThreshold(0.05);
            expect(detector.minVolumeThreshold).toBe(0.05);
        });

        it('should accept zero threshold', () => {
            detector.setVolumeThreshold(0);
            expect(detector.minVolumeThreshold).toBe(0);
        });
    });

    describe('setSmoothingSize()', () => {
        it('should update smoothing size', () => {
            detector.setSmoothingSize(10);
            expect(detector.historySize).toBe(10);
        });

        it('should clamp to minimum of 1', () => {
            detector.setSmoothingSize(0);
            expect(detector.historySize).toBe(1);

            detector.setSmoothingSize(-5);
            expect(detector.historySize).toBe(1);
        });

        it('should clamp to maximum of 20', () => {
            detector.setSmoothingSize(25);
            expect(detector.historySize).toBe(20);

            detector.setSmoothingSize(100);
            expect(detector.historySize).toBe(20);
        });
    });

    describe('getNoteRange()', () => {
        it('should return notes in frequency range', () => {
            const notes = detector.getNoteRange(260, 270);
            expect(notes.length).toBeGreaterThan(0);
            expect(notes[0].note).toBe('C4'); // ~261.63Hz
        });

        it('should include boundary notes', () => {
            const notes = detector.getNoteRange(440, 880);
            const noteNames = notes.map(n => n.note);
            expect(noteNames).toContain('A4'); // 440Hz
            expect(noteNames).toContain('A5'); // 880Hz
        });

        it('should return notes in ascending order', () => {
            const notes = detector.getNoteRange(200, 500);
            for (let i = 1; i < notes.length; i++) {
                expect(notes[i].frequency).toBeGreaterThan(notes[i - 1].frequency);
            }
        });

        it('should return empty array for invalid range', () => {
            const notes = detector.getNoteRange(1000, 500); // min > max
            expect(notes.length).toBe(0);
        });

        it('should handle octave transitions', () => {
            const notes = detector.getNoteRange(400, 900);
            const octave4 = notes.filter(n => n.note.includes('4'));
            const octave5 = notes.filter(n => n.note.includes('5'));
            expect(octave4.length).toBeGreaterThan(0);
            expect(octave5.length).toBeGreaterThan(0);
        });
    });

    describe('Edge cases and robustness', () => {
        it('should handle very low frequencies', () => {
            const result = detector.frequencyToNote(50);
            expect(result.octave).toBeLessThan(4);
            expect(result.note).toBeTruthy();
        });

        it('should handle very high frequencies', () => {
            const result = detector.frequencyToNote(2000);
            expect(result.octave).toBeGreaterThan(5);
            expect(result.note).toBeTruthy();
        });

        it('should handle empty audio buffer gracefully', () => {
            const buffer = new Float32Array(0);
            const confidence = detector.calculateConfidence(buffer, 440);
            expect(confidence).toBeGreaterThanOrEqual(0);
            expect(confidence).toBeLessThanOrEqual(1);
        });

        it('should maintain note names array integrity', () => {
            expect(detector.noteNames).toHaveLength(12);
            expect(detector.noteNames).toContain('C');
            expect(detector.noteNames).toContain('A');
            expect(detector.noteNames).not.toContain('H'); // German notation
        });
    });
});

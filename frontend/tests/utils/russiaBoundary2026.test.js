import { describe, it, expect } from 'vitest';
import russiaBoundaries from '../../src/utils/russiaBoundary2026';

describe('russiaBoundary2026 (границы РФ)', () => {
    it('экспортирует корректный массив полигонов границ РФ', () => {
        expect(russiaBoundaries).toBeDefined();
        expect(Array.isArray(russiaBoundaries)).toBe(true);
        expect(russiaBoundaries.length).toBeGreaterThan(0);
    });
});

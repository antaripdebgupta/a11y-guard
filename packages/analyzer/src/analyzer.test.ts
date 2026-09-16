import { describe, it, expect } from 'vitest';
import {
  normalizeSelector,
  generateFingerprint,
  extractWcagMetadata,
  normalizeAxeViolations,
  computeScore,
  diffViolations,
  computeCheckConclusion,
} from './index';
import type { NormalizedViolation, RawAxeResult } from '@a11y-guard/shared-types';

describe('Analyzer Module', () => {
  describe('normalizeSelector', () => {
    it('removes :nth-child pseudoclasses', () => {
      const input = 'div.container > ul:nth-child(2) > li:nth-child(5)';
      expect(normalizeSelector(input)).toBe('div.container > ul > li');
    });

    it('removes dynamic IDs containing numbers', () => {
      const input = 'div#id-1234 > button#submit-1';
      expect(normalizeSelector(input)).toBe('div > button');
    });

    it('handles empty or blank selectors', () => {
      expect(normalizeSelector('')).toBe('');
    });
  });

  describe('generateFingerprint', () => {
    it('generates consistent 16-character hash regardless of hostname', () => {
      const fp1 = generateFingerprint(
        'color-contrast',
        'http://localhost:3000/page1',
        'button.submit',
      );
      const fp2 = generateFingerprint(
        'color-contrast',
        'https://staging.example.com/page1',
        'button.submit',
      );
      expect(fp1).toHaveLength(16);
      expect(fp1).toBe(fp2);
    });

    it('generates different hash for different selectors or rules', () => {
      const fp1 = generateFingerprint('color-contrast', '/page1', 'button.submit');
      const fp2 = generateFingerprint('image-alt', '/page1', 'button.submit');
      expect(fp1).not.toBe(fp2);
    });
  });

  describe('extractWcagMetadata', () => {
    it('extracts WCAG criteria and levels correctly', () => {
      const tags = ['wcag2a', 'wcag21aa', 'wcag143', 'cat.color'];
      const meta = extractWcagMetadata(tags);
      expect(meta.wcagLevel).toBe('AA');
      expect(meta.wcagCriteria).toContain('wcag143');
    });

    it('handles empty tags', () => {
      const meta = extractWcagMetadata([]);
      expect(meta.wcagLevel).toBeUndefined();
      expect(meta.wcagCriteria).toEqual([]);
    });
  });

  describe('normalizeAxeViolations', () => {
    it('converts raw axe results into NormalizedViolation array', () => {
      const raw: RawAxeResult = {
        url: 'http://localhost:3000/test',
        pageTitle: 'Test Page',
        axeResults: {
          violations: [
            {
              id: 'color-contrast',
              impact: 'serious',
              description: 'Ensures contrast is sufficient',
              helpUrl: 'https://deque.com',
              tags: ['wcag2aa', 'wcag143'],
              nodes: [
                {
                  target: ['span.text-muted:nth-child(1)'],
                  html: '<span class="text-muted">Low contrast</span>',
                },
              ],
            },
          ],
        },
      };

      const normalized = normalizeAxeViolations(raw);
      expect(normalized).toHaveLength(1);
      const v = normalized[0]!;
      expect(v.ruleId).toBe('color-contrast');
      expect(v.impact).toBe('serious');
      expect(v.normalizedSelector).toBe('span.text-muted');
      expect(v.wcagLevel).toBe('AA');
    });

    it('handles missing node targets safely', () => {
      const raw: RawAxeResult = {
        url: '/test',
        axeResults: {
          violations: [
            {
              id: 'document-title',
              impact: 'critical',
              description: 'Document must have title',
            },
          ],
        },
      };
      const normalized = normalizeAxeViolations(raw);
      expect(normalized).toHaveLength(1);
      expect(normalized[0]!.targetSelector).toBe('body');
    });
  });

  describe('computeScore', () => {
    it('returns 100 for zero violations', () => {
      expect(computeScore([])).toBe(100);
    });

    it('deducts based on severity weights correctly', () => {
      const violations: Partial<NormalizedViolation>[] = [
        { impact: 'critical' }, // -10
        { impact: 'serious' }, // -5
        { impact: 'moderate' }, // -2
        { impact: 'minor' }, // -0.5
      ];
      // 100 - (10 + 5 + 2 + 0.5) = 82.5
      expect(computeScore(violations as NormalizedViolation[])).toBe(82.5);
    });

    it('floors score at 0 for heavy violations', () => {
      const violations: Partial<NormalizedViolation>[] = Array(15).fill({ impact: 'critical' });
      // 15 * 10 = 150 deduction -> 0
      expect(computeScore(violations as NormalizedViolation[])).toBe(0);
    });
  });

  describe('diffViolations', () => {
    it('identifies new, existing, and resolved violations', () => {
      const v1: NormalizedViolation = {
        id: 'fp1',
        ruleId: 'r1',
        impact: 'critical',
        description: '',
        wcagCriteria: [],
        htmlSnippet: '',
        targetSelector: 'div',
        normalizedSelector: 'div',
        url: '/page1',
      };
      const v2: NormalizedViolation = {
        id: 'fp2',
        ruleId: 'r2',
        impact: 'serious',
        description: '',
        wcagCriteria: [],
        htmlSnippet: '',
        targetSelector: 'p',
        normalizedSelector: 'p',
        url: '/page1',
      };
      const v3: NormalizedViolation = {
        id: 'fp3',
        ruleId: 'r3',
        impact: 'moderate',
        description: '',
        wcagCriteria: [],
        htmlSnippet: '',
        targetSelector: 'a',
        normalizedSelector: 'a',
        url: '/page1',
      };

      const baseline = [v1, v2];
      const current = [v2, v3];

      const diff = diffViolations(baseline, current);

      expect(diff.newViolations).toEqual([v3]);
      expect(diff.existingViolations).toEqual([v2]);
      expect(diff.resolvedViolations).toEqual([v1]);
      expect(diff.totalCurrentCount).toBe(2);
      expect(diff.totalBaselineCount).toBe(2);
    });
  });

  describe('computeCheckConclusion', () => {
    it('passes quality gate when no new violations exceed severity threshold', () => {
      const diff = {
        newViolations: [{ impact: 'minor' } as NormalizedViolation],
        existingViolations: [],
        resolvedViolations: [],
        totalCurrentCount: 1,
        totalBaselineCount: 0,
      };

      const res = computeCheckConclusion(diff, { failOnSeverity: 'serious' });
      expect(res.conclusion).toBe('success');
      expect(res.failingViolations).toBe(0);
    });

    it('fails quality gate when new violation matches or exceeds severity threshold', () => {
      const diff = {
        newViolations: [{ impact: 'critical' } as NormalizedViolation],
        existingViolations: [],
        resolvedViolations: [],
        totalCurrentCount: 1,
        totalBaselineCount: 0,
      };

      const res = computeCheckConclusion(diff, { failOnSeverity: 'serious' });
      expect(res.conclusion).toBe('failure');
      expect(res.failingViolations).toBe(1);
    });
  });
});

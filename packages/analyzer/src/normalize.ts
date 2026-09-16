import crypto from 'node:crypto';
import type { NormalizedViolation, RawAxeResult, ImpactSeverity } from '@a11y-guard/shared-types';

export function normalizeSelector(selector: string): string {
  if (!selector) return '';
  return (
    selector
      // Remove :nth-child(N) patterns
      .replace(/:nth-child\(\d+\)/g, '')
      // Remove dynamic ID patterns like #react-select-2-input or #id-12345
      .replace(/#([a-zA-B0-9_-]*\d+[a-zA-B0-9_-]*)/g, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function generateFingerprint(
  ruleId: string,
  urlPath: string,
  normalizedSelector: string,
): string {
  // Normalize url to pathname if possible to prevent host variations from altering fingerprint
  let parsedPath = urlPath;
  try {
    const parsed = new URL(urlPath);
    parsedPath = parsed.pathname;
  } catch {
    // Keep as is if relative or invalid URL
  }
  const payload = `${ruleId}:${parsedPath}:${normalizedSelector}`;
  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);
}

export function extractWcagMetadata(tags: string[] = []): {
  wcagCriteria: string[];
  wcagLevel?: 'A' | 'AA' | 'AAA';
} {
  const wcagCriteria: string[] = [];
  let wcagLevel: 'A' | 'AA' | 'AAA' | undefined;

  for (const tag of tags) {
    if (tag.startsWith('wcag')) {
      if (tag === 'wcag2a' || tag === 'wcag21a') wcagLevel = wcagLevel || 'A';
      else if (tag === 'wcag2aa' || tag === 'wcag21aa' || tag === 'wcag22aa') {
        if (wcagLevel !== 'AAA') wcagLevel = 'AA';
      } else if (tag === 'wcag2aaa' || tag === 'wcag21aaa') {
        wcagLevel = 'AAA';
      } else {
        wcagCriteria.push(tag);
      }
    }
  }

  return { wcagCriteria, wcagLevel };
}

interface AxeNode {
  target?: string[];
  html?: string;
  failureSummary?: string;
}

interface AxeResultItem {
  id: string;
  impact?: string;
  description: string;
  help?: string;
  helpUrl?: string;
  tags?: string[];
  nodes?: AxeNode[];
}

export function normalizeAxeViolations(raw: RawAxeResult): NormalizedViolation[] {
  const violations: NormalizedViolation[] = [];
  const axeObj = raw.axeResults as { violations?: AxeResultItem[] } | null;
  const rawViolations = axeObj?.violations || [];

  for (const item of rawViolations) {
    const impact: ImpactSeverity = (item.impact as ImpactSeverity) || 'moderate';
    const { wcagCriteria, wcagLevel } = extractWcagMetadata(item.tags);

    const nodes =
      item.nodes && item.nodes.length > 0 ? item.nodes : [{ target: ['body'], html: '' }];

    for (const node of nodes) {
      const targetSelector = node.target?.join(' > ') || 'body';
      const normSelector = normalizeSelector(targetSelector);
      const fingerprint = generateFingerprint(item.id, raw.url, normSelector);

      violations.push({
        id: fingerprint,
        ruleId: item.id,
        impact,
        description: item.description || item.help || '',
        helpUrl: item.helpUrl,
        wcagCriteria,
        wcagLevel,
        htmlSnippet: node.html || '',
        targetSelector,
        normalizedSelector: normSelector,
        url: raw.url,
        pageTitle: raw.pageTitle,
      });
    }
  }

  return violations;
}

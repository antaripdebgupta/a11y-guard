import { describe, it, expect } from 'vitest';
import { parseRouteConfig } from './route-config.parser';

describe('Route Config Parser', () => {
  it('returns default config on invalid or empty YAML', () => {
    const config = parseRouteConfig('');
    expect(config.routes).toHaveLength(1);
    expect(config.routes[0]!.path).toBe('/');
    expect(config.gate.failOnSeverity).toBe('serious');
  });

  it('parses valid .a11yguard.yml correctly', () => {
    const yaml = `
routes:
  - path: /
    name: Home Page
  - path: /checkout
    name: Checkout Flow
gate:
  failOnSeverity: critical
options:
  timeoutMs: 15000
`;
    const config = parseRouteConfig(yaml);
    expect(config.routes).toHaveLength(2);
    expect(config.routes[1]!.path).toBe('/checkout');
    expect(config.gate.failOnSeverity).toBe('critical');
    expect(config.options?.timeoutMs).toBe(15000);
  });
});

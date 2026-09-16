import * as yaml from 'js-yaml';
import { z } from 'zod';

const RouteConfigEntrySchema = z.object({
  path: z.string(),
  label: z.string().optional(),
  waitForSelector: z.string().optional(),
  actions: z.array(z.record(z.unknown())).optional(),
});

const GateConfigSchema = z.object({
  failOnSeverity: z.enum(['critical', 'serious', 'moderate', 'minor']).default('serious'),
});

const OptionsConfigSchema = z.object({
  timeoutMs: z.number().optional(),
});

const RouteConfigSchema = z.object({
  routes: z.array(RouteConfigEntrySchema).min(1),
  baseUrl: z.string().optional(),
  defaultTimeout: z.number().optional(),
  tags: z.array(z.string()).optional(),
  gate: GateConfigSchema.default({ failOnSeverity: 'serious' }),
  options: OptionsConfigSchema.optional(),
});

export type RouteConfigEntry = z.infer<typeof RouteConfigEntrySchema>;
export type RouteConfig = z.infer<typeof RouteConfigSchema>;

export function parseRouteConfig(yamlContent: string): RouteConfig {
  try {
    const parsed = yaml.load(yamlContent);
    return RouteConfigSchema.parse(parsed);
  } catch {
    return getDefaultRouteConfig();
  }
}

export function getDefaultRouteConfig(): RouteConfig {
  return {
    routes: [{ path: '/', label: 'Home' }],
    gate: { failOnSeverity: 'serious' },
  };
}

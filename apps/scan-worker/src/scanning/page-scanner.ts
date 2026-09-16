import { chromium, Browser, Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createLogger, AppLogger } from '@a11y-guard/logger';
import { PageScanOptions, RawAxeResult } from '@a11y-guard/shared-types';

export interface IPageScanner {
  scan(url: string, options: PageScanOptions): Promise<RawAxeResult>;
}

export class PlaywrightAxeScanner implements IPageScanner {
  private readonly logger: AppLogger;

  constructor(logger?: AppLogger) {
    this.logger = logger ?? createLogger('page-scanner');
  }

  async scan(url: string, options: PageScanOptions = {}): Promise<RawAxeResult> {
    const timeoutMs = options.timeoutMs ?? 45_000;
    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page: Page = await context.newPage();

      await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });

      const pageTitle = await page.title();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();

      let screenshotBuffer: Buffer | undefined;
      try {
        screenshotBuffer = await page.screenshot({ fullPage: true });
      } catch (err) {
        this.logger.warn({ err, url }, 'Failed to capture screenshot');
      }

      return { url, pageTitle, axeResults: results, screenshotBuffer };
    } finally {
      if (browser) {
        await browser.close().catch((err) => {
          this.logger.warn({ err, url }, 'Failed to close browser');
        });
      }
    }
  }
}

// Loads a page in Chromium and runs axe with the WCAG 2.1 AA tags (#5). One
// browser is shared across scans; each scan gets a fresh context, so no
// cookies or storage carry over, and its own SSRF-guarding proxy.
import AxeBuilder from '@axe-core/playwright';
import { AXE_WCAG_TAGS, type A11yIssue } from '@curbcut/core';
import { chromium, type Browser } from 'playwright';
import { PermanentError, UnsafeUrlError } from '../errors';
import { assertScanUrl, type GuardOptions } from '../net/guard';
import { BLOCKED_HEADER, startGuardProxy } from '../net/proxy';
import { toA11yIssues } from './normalize';

export interface ScanResult {
  issues: A11yIssue[];
  axeVersion: string;
}

export interface ScannerOptions extends GuardOptions {
  /** Page load timeout. The plan sets 60 s; axe gets the same again. */
  timeoutMs?: number;
}

/** Rejects with `message` if `promise` hasn't settled within `ms`. */
async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export class Scanner {
  private browser: Promise<Browser> | undefined;
  private readonly timeoutMs: number;

  constructor(private readonly options: ScannerOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  /** Launches Chromium on first use, and again if it crashed. */
  private async getBrowser(): Promise<Browser> {
    const current = await this.browser?.catch(() => undefined);
    if (current?.isConnected()) return current;
    this.browser = chromium.launch({
      // WebRTC can reach local addresses without going through the proxy.
      args: ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
    });
    return this.browser;
  }

  async scan(url: string): Promise<ScanResult> {
    await assertScanUrl(url, this.options);
    const proxy = await startGuardProxy(this.options);
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      // `<-loopback>` stops Chromium sending localhost around the proxy.
      proxy: { server: proxy.url, bypass: '<-loopback>' },
      // A service worker could make requests the page's context doesn't see.
      serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(this.timeoutMs);
      const response = await page.goto(url, { waitUntil: 'load' }).catch((err: unknown) => {
        // A redirect to a blocked https host fails the tunnel rather than returning a page.
        if (proxy.blocked.length > 0) {
          throw new UnsafeUrlError(`Blocked a request to ${proxy.blocked.join(', ')}`);
        }
        throw err;
      });
      if (response?.headers()[BLOCKED_HEADER] === '1') {
        throw new UnsafeUrlError(`Blocked a request to ${proxy.blocked.join(', ')}`);
      }
      const status = response?.status() ?? 0;
      if (status >= 400) {
        // A 5xx may be a blip worth retrying; a 4xx won't change.
        const message = `${url} returned HTTP ${status}`;
        throw status < 500 ? new PermanentError(message) : new Error(message);
      }
      // Give client-rendered pages a moment to settle; carry on if they never go quiet.
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

      const results = await withTimeout(
        new AxeBuilder({ page }).withTags([...AXE_WCAG_TAGS]).analyze(),
        this.timeoutMs,
        `axe did not finish within ${this.timeoutMs / 1000}s`,
      );
      return { issues: toA11yIssues(results, url), axeVersion: results.testEngine.version };
    } finally {
      await context.close();
      await proxy.close();
    }
  }

  async close(): Promise<void> {
    const browser = await this.browser?.catch(() => undefined);
    await browser?.close();
  }
}

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Both snapshots use isolated CI apps, the same seeded catalogue and viewports.
// Only GET/HEAD to the intercepted local app is allowed; never visit production.
const origin = process.env.HOMEPAGE_QA_ORIGIN || 'http://127.0.0.1:3100';
const output = resolve(process.env.BROWSER_QA_OUTPUT, process.env.HOMEPAGE_QA_LABEL || 'after');
const browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true });
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }], ['small-mobile', { width: 360, height: 640 }]]) {
    const directory = resolve(output, name);
    await mkdir(directory, { recursive: true });
    const context = await browser.newContext({ viewport, isMobile: name !== 'desktop', hasTouch: name !== 'desktop', locale: 'ru-RU', reducedMotion: 'reduce', serviceWorkers: 'block' });
    const forbidden = [];
    const pending = new Set();
    const serve = async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname !== 'mu56.ru' || !['GET', 'HEAD'].includes(request.method())) { forbidden.push(request.url()); await route.abort(); return; }
      const local = new URL(url.pathname + url.search, origin);
      const response = await route.fetch({ url: local.href, maxRedirects: 0 });
      if (response.headers().location && new URL(response.headers().location, url).hostname !== 'mu56.ru') throw new Error('External redirect blocked');
      await route.fulfill({ response });
    };
    const handler = route => { const task = serve(route); pending.add(task); task.finally(() => pending.delete(task)); return task; };
    await context.route('**/*', handler);
    const page = await context.newPage();
    await page.goto('http://mu56.ru/');
    await page.getByRole('button', { name: 'Пока без аналитики', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    const sections = page.locator('main > section');
    for (let index = 0; index < await sections.count(); index++) {
      const section = sections.nth(index);
      await section.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.images].filter(image => {
        const rect = image.getBoundingClientRect();
        return rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
      }).every(image => image.complete && image.naturalWidth > 0));
      const heading = (await section.locator('h1,h2').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      await page.screenshot({ path: resolve(directory, `section-${String(index).padStart(2, '0')}.png`), animations: 'disabled' });
      await writeFile(resolve(directory, `section-${String(index).padStart(2, '0')}.txt`), heading);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    const metrics = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      pageHeight: document.documentElement.scrollHeight,
      pageWidth: document.documentElement.scrollWidth,
      sections: [...document.querySelectorAll('main > section')].map(section => ({
        id: section.id, heading: section.querySelector('h1,h2')?.textContent,
        top: section.getBoundingClientRect().top + scrollY,
        height: section.getBoundingClientRect().height,
        images: section.querySelectorAll('img').length,
      })),
    }));
    await page.screenshot({ path: resolve(directory, 'full-homepage.png'), fullPage: true, animations: 'disabled' });
    await writeFile(resolve(directory, 'metrics.json'), JSON.stringify(metrics, null, 2));
    if (metrics.pageWidth > viewport.width + 1) throw new Error(`${name}: page-wide overflow`);
    if (forbidden.length) throw new Error(`Forbidden requests: ${forbidden.join(', ')}`);
    await context.route('**/*', route => route.abort());
    await context.unroute('**/*', handler);
    await Promise.all([...pending]);
    await context.close();
  }
} finally { await browser.close(); }

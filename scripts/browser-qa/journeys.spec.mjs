import { test as base, expect } from '@playwright/test';

// All page requests are served by the isolated CI app. Keep the real hostname
// only to exercise the existing hostname-gated consent UI without changing it.
// No live API, analytics, messaging or enquiry submission is allowed here.
const test = base.extend({
  isolated: [async ({ context, page }, use) => {
    // Depending on page keeps this cleanup ahead of page/context disposal.
    void page;
    const forbidden = [];
    const pending = new Set();
    const serve = async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'mu56.ru' || !['GET', 'HEAD'].includes(request.method()) || /\/api\/v1\/leads\/?$/.test(url.pathname)) {
        forbidden.push(`${request.method()} ${url.origin}${url.pathname}`);
        await route.abort();
        return;
      }
      const local = new URL('http://127.0.0.1:3100');
      local.pathname = url.pathname;
      local.search = url.search;
      // Never let APIRequestContext follow a redirect outside the interception.
      const response = await route.fetch({ url: local.href, maxRedirects: 0 });
      const location = response.headers().location;
      if (location) {
        const target = new URL(location, url);
        if (target.hostname !== 'mu56.ru') {
          forbidden.push(`Redirect to ${target.origin}${target.pathname}`);
          await route.abort();
          return;
        }
      }
      await route.fulfill({ response });
    };
    const handler = route => {
      const request = serve(route);
      pending.add(request);
      request.then(() => pending.delete(request), () => pending.delete(request));
      return request;
    };
    await context.route('**/*', handler);
    await use();
    // Block any new prefetch while draining in-flight loopback requests. Never
    // remove interception while a page can issue requests to the fake origin.
    await context.route('**/*', route => route.abort());
    await context.unroute('**/*', handler);
    await Promise.all([...pending]);
    expect(forbidden, 'No production, analytics or enquiry requests').toEqual([]);
  }, { auto: true }],
});

async function capture(page, info, name) {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => [...document.images].filter(image => {
    const box = image.getBoundingClientRect();
    return box.width && box.height && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
  }).every(image => image.complete && image.naturalWidth > 0)), { message: 'Visible images must finish loading before screenshots' }).toBe(true);
  await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled' });
}
async function noOverflow(page) {
  const sizes = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
}
async function dismissAnalytics(page) {
  const decline = page.getByRole('button', { name: 'Пока без аналитики', exact: true });
  const denied = await page.evaluate(() => localStorage.getItem('mu56-analytics-v1') === 'denied');
  if (!denied) {
    await expect(decline).toBeVisible();
    await decline.click();
  }
  await expect(page.getByRole('complementary', { name: 'Настройки аналитики' })).toHaveCount(0);
}
async function visibleClose(page) {
  const close = page.getByRole('button', { name: 'Закрыть форму', exact: true });
  await expect(close).toBeVisible();
  const box = await close.boundingBox();
  const viewport = page.viewportSize();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  return close;
}

test('home consent, programme discovery and menu recovery', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Next normalizes the root trailing slash, as it already does for canonical.
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /^https:\/\/mu56\.ru\/?$/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://mu56.ru/media/social-preview-20261008-v5.jpg');
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'ru_RU');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Мир Улыбок/);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /Выездные детские праздники/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/mu56\.ru\/?$/);
  const decline = page.getByRole('button', { name: 'Пока без аналитики', exact: true });
  await expect(decline).toBeVisible();
  await noOverflow(page);
  await capture(page, info, 'home-first-visit');
  await decline.click();
  await expect(page.getByRole('complementary', { name: 'Настройки аналитики' })).toHaveCount(0);
  const choice = await page.evaluate(() => ({ choice: localStorage.getItem('mu56-analytics-v1'), expiry: Number(localStorage.getItem('mu56-analytics-dismissed-until')) }));
  expect(choice.choice).toBe('denied');
  expect(choice.expiry - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
  await capture(page, info, 'home-dismissed');
  // Locate the factual card independently of decorative home copy.
  const animator = page.getByRole('navigation', { name: 'Направления праздников' }).getByRole('link', { name: /Аниматоры/ });
  expect((await animator.innerText()).replace(/\s/g, '')).toContain('3500₽');
  await expect(page.locator('main a[href="/transformers/bumblebee"]').first()).toBeAttached();
  if (page.viewportSize().width <= 800) {
    const menu = page.getByRole('button', { name: 'Открыть меню', exact: true });
    await menu.click();
    const first = page.getByRole('navigation', { name: 'Основное меню', exact: true }).getByRole('link').first();
    await expect(first).toBeFocused();
    await capture(page, info, 'mobile-menu');
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
    await page.getByRole('navigation', { name: 'Основное меню', exact: true }).getByRole('link', { name: 'Персонажи', exact: true }).click();
    await expect(page).toHaveURL(/\/characters$/);
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await page.goBack();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
  }
  await page.reload();
  await expect(decline).toHaveCount(0);
});

test('character search, empty results and focus recovery', async ({ page }, info) => {
  await page.goto('/characters');
  await dismissAnalytics(page);
  const search = page.getByRole('searchbox', { name: 'Найти героя', exact: true });
  for (const [query, count] of [['человек паук', 2], ['черный', 1], ['Поттер Гарри', 1]]) {
    await search.fill(query);
    await expect(page.locator('#character-results .character-card')).toHaveCount(count);
    await noOverflow(page);
  }
  await search.fill('человек паук');
  await page.locator('#character-results').scrollIntoViewIfNeeded();
  await capture(page, info, 'search-spider-results');
  await page.getByRole('button', { name: 'Очистить поиск', exact: true }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await search.fill('несуществующий герой');
  await expect(page.getByRole('heading', { name: 'Такого героя пока не нашли' })).toBeVisible();
  await page.locator('.empty-search').scrollIntoViewIfNeeded();
  await capture(page, info, 'search-empty-recovery');
  await page.getByRole('button', { name: 'Показать всех', exact: true }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await noOverflow(page);
});

test('package enquiry stays recoverable through a long form', async ({ page }, info) => {
  await page.goto('/packages');
  await dismissAnalytics(page);
  await noOverflow(page);
  await capture(page, info, 'packages');
  const trigger = page.getByRole('button', { name: /^Выбрать пакет «/ }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/Ваше имя/)).toBeVisible();
  await visibleClose(page);
  await capture(page, info, 'package-dialog-top');
  await dialog.locator('textarea[name="comment"]').scrollIntoViewIfNeeded();
  await visibleClose(page);
  expect(await dialog.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await capture(page, info, 'package-dialog-scrolled');
  await (await visibleClose(page)).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('New Year exact slot seeds time and preserves an edited draft', async ({ page }, info) => {
  await page.goto('/new-year');
  await dismissAnalytics(page);
  const trigger = page.getByRole('button', { name: 'Обсудить 18:00 · 31 декабря', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  const date = dialog.locator('[name="event_date"]');
  const time = dialog.locator('[name="event_time"]');
  await expect(time).toHaveValue('18:00');
  await expect(date).toHaveValue('');
  await expect(dialog.getByRole('button', { name: 'Обсудить мой праздник', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: /Свернуть детали праздника/ }).click();
  await dialog.getByRole('button', { name: 'Изменить дату, время или тариф', exact: true }).click();
  await expect(date).toBeFocused();
  await capture(page, info, 'new-year-slot-prefill');
  await date.fill('2027-12-31');
  await time.fill('20:00');
  await (await visibleClose(page)).click();
  await trigger.click();
  await expect(date).toHaveValue('2027-12-31');
  await expect(time).toHaveValue('20:00');
  await dialog.getByRole('combobox', { name: /Формат новогоднего поздравления/ }).selectOption('eve-22');
  await expect(time).toHaveValue('22:00');
  await (await visibleClose(page)).click();
  await noOverflow(page);
});

test('animator and Bumblebee landing layouts', async ({ page }, info) => {
  for (const [route, name] of [['/animators', 'animators'], ['/transformers/bumblebee', 'bumblebee']]) {
    await page.goto(route);
    await dismissAnalytics(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await noOverflow(page);
    await capture(page, info, name);
  }
});

import { test as base, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

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
  const schemas = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.map(node => JSON.parse(node.textContent)));
  expect(schemas.filter(schema => schema['@type'] === 'WebSite')).toEqual([{
    '@context': 'https://schema.org', '@type': 'WebSite', '@id': 'https://mu56.ru/#website',
    name: 'Мир Улыбок', url: 'https://mu56.ru/',
  }]);
  expect(schemas.filter(schema => schema['@type'] === 'Organization')).toHaveLength(1);
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
  const animator = page.locator('.home-format-animation');
  expect((await animator.innerText()).replace(/\s/g, '')).toContain('3500₽');
  await page.locator('#home-services').scrollIntoViewIfNeeded();
  await capture(page, info, 'home-programme-navigation');
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

test('catalogue comparison context survives Back and Forward', async ({ page }, info) => {
  await page.goto('/characters');
  await dismissAnalytics(page);
  const search = page.getByRole('searchbox', { name: 'Найти героя', exact: true });
  const order = page.getByRole('combobox', { name: 'Порядок героев', exact: true });
  await search.fill('паук');
  await page.getByRole('button', { name: 'Супергерои', exact: true }).click();
  await order.selectOption('name');
  await expect(page.locator('#character-results .character-card')).toHaveCount(2);
  await expect(page).toHaveURL(/\/characters$/);
  const heroLink = page.getByRole('link', { name: 'Человек-паук', exact: true });
  await heroLink.scrollIntoViewIfNeeded();
  const catalogScroll = await page.evaluate(() => scrollY);
  await heroLink.click();
  await expect(page).toHaveURL(/\/characters\/spider-man$/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Аниматор Человек-паук на день рождения в Оренбурге. Игровая миссия, фотографии костюма, программа и стоимость. Выезд на вашу площадку.');
  await page.goBack();
  await expect(page).toHaveURL(/\/characters$/);
  await expect(search).toHaveValue('паук');
  await expect(order).toHaveValue('name');
  await expect(page.getByRole('button', { name: 'Супергерои', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#character-results .character-card')).toHaveCount(2);
  await expect.poll(async () => Math.abs(await page.evaluate(() => scrollY) - catalogScroll), { message: 'Return to the same catalogue position' }).toBeLessThan(16);
  await noOverflow(page);
  await page.locator('.catalog-tools').scrollIntoViewIfNeeded();
  await capture(page, info, 'catalogue-restored-after-back');
  await page.goForward();
  await expect(page).toHaveURL(/\/characters\/spider-man$/);
  await page.goBack();
  await expect(search).toHaveValue('паук');
  await expect(order).toHaveValue('name');
  await page.getByRole('button', { name: 'Сбросить фильтры', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(page.getByRole('button', { name: 'Все герои', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#character-results .character-card')).toHaveCount(32);
});

test('Back dismisses idle enquiry without losing the same-entry draft', async ({ page }, info) => {
  await page.goto('/characters');
  await dismissAnalytics(page);
  await page.getByRole('searchbox', { name: 'Найти героя', exact: true }).fill('паук');
  await page.getByRole('link', { name: 'Человек-паук', exact: true }).click();
  await expect(page).toHaveURL(/\/characters\/spider-man$/);
  const trigger = page.getByRole('button', { name: 'Хочу этого героя', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Герой анимации', exact: true })).toHaveValue('Человек-паук');
  // This non-personal draft text remains local to the isolated browser. No POST.
  await dialog.getByRole('textbox', { name: 'Пожелания (необязательно)', exact: true }).fill('Проверка восстановления выбора');
  await page.goBack();
  await expect(page).toHaveURL(/\/characters$/);
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Найти героя', exact: true })).toHaveValue('паук');
  await noOverflow(page);
  await capture(page, info, 'catalogue-after-dialog-back');
  await page.goForward();
  await expect(page).toHaveURL(/\/characters\/spider-man$/);
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Пожелания (необязательно)', exact: true })).toHaveValue('Проверка восстановления выбора');
  await expect(dialog.getByRole('combobox', { name: 'Герой анимации', exact: true })).toHaveValue('Человек-паук');
  await (await visibleClose(page)).click();
  await expect(trigger).toBeFocused();
});

test('package enquiry stays recoverable through a long form', async ({ page }, info) => {
  await page.goto('/packages');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Пять пакетов с аниматором и шоу в Оренбурге. Сравните состав, цены и время игр с ведущим. Фоновая музыка после программы показана отдельно.');
  await expect(page.locator('.page-intro')).toContainText('Музыка после программы — фоновая, пока команда собирает оборудование.');
  await dismissAnalytics(page);
  await noOverflow(page);
  await capture(page, info, 'packages');
  await page.locator('.comparison-scroll').scrollIntoViewIfNeeded();
  await capture(page, info, 'package-comparison');
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


test('three programme formats make price and next step explicit', async ({ page }, info) => {
  await page.goto('/');
  await dismissAnalytics(page);
  const heroHelp = page.getByRole('button', { name: 'Помогите выбрать праздник', exact: true });
  await heroHelp.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input[name="offering"]')).toHaveValue('');
  await (await visibleClose(page)).click();
  await expect(heroHelp).toBeFocused();
  await page.getByRole('link', { name: 'Сравнить форматы', exact: true }).click();
  await expect(page).toHaveURL(/#home-services$/);
  await expect(page.locator('.home-format')).toHaveCount(3);
  const normalize = text => text.replace(/\s/g, '');
  expect(normalize(await page.locator('.home-format-animation').innerText())).toContain('3500₽');
  expect(normalize(await page.locator('.home-format-transformer').innerText())).toContain('5800–6200₽');
  await expect(page.locator('.home-format-package')).toContainText('Игры и шоу с ведущим');
  await expect(page.locator('.home-choice-terms')).toContainText('выезд в удалённые районы');
  for (const kind of ['animation', 'transformer', 'package']) {
    const card = page.locator(`.home-format-${kind}`);
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page);
    await capture(page, info, `home-format-${kind}`);
    const link = card.getByRole('link');
    const box = await link.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const help = page.getByRole('button', { name: 'Помогите выбрать', exact: true });
  await help.click();
  await expect(dialog).toBeVisible();
  await (await visibleClose(page)).click();
  await expect(help).toBeFocused();
  await expect(page.locator('.home-choice-proof a[href="/gallery"]')).toBeAttached();
  await expect(page.locator('.home-choice-proof a[href="/reviews"]')).toBeAttached();
  await page.locator('.home-format-package').getByRole('link').click();
  await expect(page).toHaveURL(/\/packages$/);
});

test('package overview leads to a decision before the long timeline', async ({ page }, info) => {
  await page.goto('/packages');
  await dismissAnalytics(page);
  const overview = page.locator('#package-overview');
  await expect(overview.locator('li')).toHaveCount(5);
  await expect(overview.getByRole('link', { name: 'Сравнить пакеты', exact: true })).toHaveAttribute('href', '#compare');
  const firstOverview = await overview.boundingBox();
  const firstCard = await page.locator('.inner-packages').boundingBox();
  expect(firstOverview.y + firstOverview.height).toBeLessThanOrEqual(firstCard.y);
  await overview.scrollIntoViewIfNeeded();
  await capture(page, info, 'package-overview');
  const sweet = overview.getByRole('link', { name: 'Состав и условия пакета «Сладкий вайб»', exact: true });
  await sweet.focus();
  await sweet.press('Enter');
  await expect(page).toHaveURL(/\/packages\/sweet-vibe$/);
  const summary = page.locator('[data-package-summary="sweet-vibe"]');
  await expect(summary.locator('[data-package-price]')).toHaveText(/5\s500 ₽за программу/);
  await expect(summary.getByRole('list', { name: 'Игры и шоу в пакете' })).toContainText('Шоу сладкой ваты');
  await expect(summary).toContainText('1 ч 30 мин');
  await expect(summary).toContainText('10 мин фоновой музыки — без ведущего');
  const trigger = summary.getByRole('button', { name: 'Хочу эту программу', exact: true });
  await expect(trigger).toHaveCount(1);
  const triggerBox = await trigger.boundingBox();
  const imageBox = await page.locator('main img').first().boundingBox();
  await writeFile(info.outputPath('package-layout-metrics.json'), JSON.stringify({ viewport: page.viewportSize(), cta: triggerBox, image: imageBox }, null, 2));
  if (page.viewportSize().width <= 800) {
    expect(triggerBox.y + triggerBox.height).toBeLessThan(imageBox.y);
    expect(triggerBox.y).toBeLessThan(900);
  }
  await noOverflow(page);
  await capture(page, info, 'package-decision-first');
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('input[name="offering"]')).toHaveValue('sweet-vibe');
  await (await visibleClose(page)).click();
  await expect(trigger).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/packages$/);
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('#package-overview')).toBeVisible();
});

test('package decision summary preserves group sound and venue conditions', async ({ page }, info) => {
  await page.goto('/packages/sweet-vibe?occasion=graduation');
  await dismissAnalytics(page);
  const summary = page.locator('[data-package-summary="sweet-vibe"]');
  await expect(summary.locator('[data-package-price]')).toHaveText(/7\s500 ₽за программу со звуком/);
  await expect(summary).toContainText('Комплект звука: 2');
  await noOverflow(page);
  await capture(page, info, 'package-group-summary');
  await summary.getByRole('button', { name: 'Выбрать пакет для группы', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('input[name="offering"]')).toHaveValue('sweet-vibe');
  await expect(dialog.locator('.lead-quote')).toContainText(/Всего за программу: 7\s500 ₽/);
  const sound = dialog.getByRole('checkbox', { name: /Много звука/ });
  await expect(sound).toBeChecked();
  await expect(sound).toBeDisabled();
  await (await visibleClose(page)).click();
  await page.goto('/packages/silver-party');
  await expect(page.locator('[data-package-summary] .package-stage-condition')).toContainText('помещении');
  await expect(page.locator('[data-package-summary] a[href="/shows/silver"]')).toHaveCount(1);
  const conditionBox = await page.locator('[data-package-summary] .package-stage-condition').boundingBox();
  const silverCta = page.locator('[data-package-summary]').getByRole('button', { name: 'Хочу эту программу', exact: true });
  const silverCtaBox = await silverCta.boundingBox();
  expect(silverCtaBox.y - conditionBox.y - conditionBox.height).toBeGreaterThanOrEqual(16);
  await silverCta.scrollIntoViewIfNeeded();
  await noOverflow(page);
  await capture(page, info, 'package-silver-conditions');
});

test('early trust and choice criteria keep help available without a quiz', async ({ page }, info) => {
  await page.goto('/');
  await dismissAnalytics(page);
  const support = page.locator('[data-choice-support]');
  const lastFormat = await page.locator('.home-format-package').boundingBox();
  const supportBox = await support.boundingBox();
  expect(supportBox.y).toBeGreaterThan(lastFormat.y + lastFormat.height);
  const review = support.locator('[data-choice-review]');
  await expect(review.locator('blockquote')).toContainText('Замечательные аниматоры!');
  await expect(review.locator('figcaption')).toContainText('Андрей');
  const source = review.getByRole('link', { name: 'Профиль с отзывами на Авито', exact: true });
  await expect(source).toHaveAttribute('href', /^https:\/\/www\.avito\.ru\/brands\//);
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(source).toHaveAttribute('rel', /noopener/);
  await expect(support.locator('input, select, textarea')).toHaveCount(0);
  await expect(support.locator('details')).toHaveCount(4);
  await expect(support.locator('details[open]')).toHaveCount(0);
  await support.scrollIntoViewIfNeeded();
  await noOverflow(page);
  await capture(page, info, 'early-trust-and-choice');
  for (const details of await support.locator('details').all()) {
    const summary = details.locator('summary');
    const box = await summary.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await summary.focus();
    await summary.press('Enter');
    await expect(details).toHaveAttribute('open', '');
    await noOverflow(page);
    await summary.press('Enter');
    await expect(details).not.toHaveAttribute('open', '');
  }
  const guide = support.getByRole('link', { name: /выбрать программу/i });
  await expect(guide).toHaveAttribute('href', '/articles/kak-vybrat-programmu');
  const help = support.getByRole('button', { name: 'Помогите выбрать', exact: true });
  await help.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('input[name="offering"]')).toHaveValue('');
  await (await visibleClose(page)).click();
  await expect(help).toBeFocused();
  await guide.click();
  await expect(page).toHaveURL(/\/articles\/kak-vybrat-programmu$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

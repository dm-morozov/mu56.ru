import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Reuse the optional QA tools; no frontend dependencies or lockfiles change.
// Run: node scripts/check_analytics_consent_ui.mjs
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requireQA = createRequire(resolve(root, '.local/header-tests/package.json'));
const requireFrontend = createRequire(resolve(root, 'frontend/package.json'));
const { JSDOM } = requireQA('jsdom');
const { build } = requireQA('esbuild');
const { createElement, act } = requireFrontend('react');
const { createRoot } = requireFrontend('react-dom/client');
const bundle = resolve(root, '.local/analytics-consent-tests/component.cjs');
await mkdir(dirname(bundle), { recursive: true });
const result = await build({
  stdin: {
    contents: `
      export { SiteAnalytics, AnalyticsSettingsButton } from './site-analytics';
      export { StoreProvider, useAppDispatch, choose, close } from './store-provider';
    `,
    resolveDir: resolve(root, 'frontend/src/components'),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  outfile: bundle,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  tsconfig: resolve(root, 'frontend/tsconfig.json'),
  plugins: [{
    name: 'next-test-adapters',
    setup(builder) {
      builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: requireFrontend.resolve(args.path), external: true }));
      builder.onResolve({ filter: /^next\// }, args => ({ path: args.path, namespace: 'next-adapter' }));
      builder.onLoad({ filter: /.*/, namespace: 'next-adapter' }, args => ({
        contents: args.path === 'next/navigation'
          ? 'export function usePathname() { return globalThis.__analyticsTestPathname; }'
          : `import { createElement } from 'react';
             export default function Link(props) {
               return createElement('a', { ...props, onClick: event => event.preventDefault() });
             }`,
        loader: 'js',
      }));
    },
  }],
});
for (const file of result.outputFiles) await writeFile(file.path, file.contents);
const { SiteAnalytics, AnalyticsSettingsButton, StoreProvider, useAppDispatch, choose, close } = requireFrontend(bundle);
const CHOICE = 'mu56-analytics-v1';
const EXPIRY = 'mu56-analytics-dismissed-until';
const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 9, 18, 12);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let passed = 0;

async function scenario(name, run, options = {}) {
  // Scripts are never executed and external resources are never fetched by jsdom.
  const dom = new JSDOM('<div id="root"></div><button id="media" data-analytics-media="gallery">Media</button><video></video>', {
    url: options.url || 'https://mu56.ru/',
  });
  for (const key of ['window', 'document', 'location', 'localStorage', 'Element', 'HTMLElement', 'HTMLVideoElement', 'Node', 'Event', 'MouseEvent', 'StorageEvent']) {
    globalThis[key] = dom.window[key];
  }
  globalThis.__analyticsTestPathname = location.pathname;
  for (const [key, value] of Object.entries(options.storage || {})) localStorage.setItem(key, String(value));
  let now = START;
  const originalNow = Date.now;
  Date.now = () => now;
  const timers = new Map();
  let timerId = 0;
  window.setTimeout = (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; };
  window.clearTimeout = id => timers.delete(id);
  let dispatch;
  function SelectionProbe() { dispatch = useAppDispatch(); return null; }
  const host = createRoot(document.getElementById('root'));
  const render = () => act(() => host.render(createElement(StoreProvider, null,
    createElement(SelectionProbe),
    createElement(SiteAnalytics, { enabled: options.enabled !== false }),
    createElement(AnalyticsSettingsButton),
  )));
  const panel = () => document.querySelector('.analytics-notice');
  const button = label => [...(panel()?.querySelectorAll('button') || [])].find(node => node.textContent === label);
  const click = async label => {
    const target = button(label);
    assert.ok(target, `Missing consent action: ${label}`);
    await act(() => target.click());
  };
  const script = () => document.getElementById('mu56-metrika');
  const calls = () => window.ym?.a || [];
  const trackingCalls = () => calls().filter(call => ['init', 'hit', 'reachGoal'].includes(call[1]));
  const settings = () => act(() => document.querySelector('button.analytics-settings').click());
  const media = () => act(() => {
    document.getElementById('media').click();
    document.querySelector('video').dispatchEvent(new Event('play'));
    document.querySelector('video').dispatchEvent(new Event('ended'));
  });
  const load = () => act(() => script().dispatchEvent(new Event('load')));
  try {
    await render();
    await run({ panel, button, click, script, calls, trackingCalls, settings, media, load, timers,
      advance: milliseconds => { now += milliseconds; },
      dispatch: action => act(() => dispatch(action)),
      navigate: async path => { dom.reconfigure({ url: new URL(path, location.href).href }); globalThis.__analyticsTestPathname = path; await render(); },
    });
    passed++;
    console.log(`PASS ${name}`);
  } finally {
    await act(() => host.unmount());
    Date.now = originalNow;
    dom.window.close();
  }
}

await scenario('first visit exposes two explicit choices; no SDK or tracking before consent', async ui => {
  assert.ok(ui.panel());
  assert.equal(ui.panel().getAttribute('aria-label'), 'Настройки аналитики');
  assert.deepEqual([...ui.panel().querySelectorAll('button')].map(node => [node.textContent, node.type]), [
    ['Согласен', 'button'], ['Пока без аналитики', 'button'],
  ]);
  assert.equal(ui.panel().querySelector('a').getAttribute('href'), '/privacy');
  assert.equal(localStorage.getItem(CHOICE), null);
  await ui.media();
  assert.equal(ui.script(), null);
  assert.equal(window.ym, undefined);
  assert.deepEqual(ui.trackingCalls(), []);
});

await scenario('first-visit decline uses denied and the existing 24-hour dismissal without tracking', async ui => {
  document.cookie = '_ym_uid=test;path=/;Secure';
  document.cookie = 'other_cookie=keep;path=/;Secure';
  await ui.click('Пока без аналитики');
  assert.equal(ui.panel(), null);
  assert.equal(localStorage.getItem(CHOICE), 'denied');
  assert.equal(Number(localStorage.getItem(EXPIRY)), START + DAY);
  assert.equal(window.mu56AnalyticsReady, false);
  assert.ok(!document.cookie.includes('_ym_uid'));
  assert.ok(document.cookie.includes('other_cookie=keep'));
  assert.deepEqual([...ui.timers.values()].map(timer => timer.delay), [DAY]);
  await ui.media();
  await ui.navigate('/packages');
  assert.equal(ui.panel(), null);
  assert.equal(ui.script(), null);
  assert.equal(window.ym, undefined);
  assert.deepEqual(ui.trackingCalls(), []);
});

await scenario('saved denial keeps the panel dismissed and SDK absent on a later mount', async ui => {
  assert.equal(ui.panel(), null);
  await ui.media();
  assert.equal(ui.script(), null);
  assert.deepEqual(ui.trackingCalls(), []);
}, { storage: { [CHOICE]: 'denied', [EXPIRY]: START + DAY / 2 } });

await scenario('expiry restores the first-visit choice without changing the saved denial', async ui => {
  await ui.click('Пока без аналитики');
  ui.advance(DAY);
  await act(() => [...ui.timers.values()][0].callback());
  assert.ok(ui.button('Пока без аналитики'));
  assert.equal(localStorage.getItem(CHOICE), 'denied');
  assert.equal(ui.script(), null);
  assert.deepEqual(ui.trackingCalls(), []);
});

await scenario('acceptance creates one SDK element; tracking begins only after simulated load', async ui => {
  await ui.click('Согласен');
  assert.equal(localStorage.getItem(CHOICE), 'accepted');
  assert.equal(localStorage.getItem(EXPIRY), null);
  assert.equal(ui.panel(), null);
  assert.match(ui.script().src, /^https:\/\/mc\.yandex\.ru\/metrika\/tag\.js\?id=/);
  await ui.media();
  assert.deepEqual(ui.trackingCalls(), []);
  await ui.load();
  assert.equal(window.mu56AnalyticsReady, true);
  assert.deepEqual(ui.trackingCalls().map(call => call[1]), ['init', 'hit']);
  await ui.media();
  assert.equal(ui.trackingCalls().filter(call => call[1] === 'reachGoal').length, 3);
  await ui.navigate('/packages');
  assert.equal(ui.trackingCalls().filter(call => call[1] === 'hit').length, 2);
  assert.equal(document.querySelectorAll('#mu56-metrika').length, 1);
});

await scenario('saved acceptance works and footer settings preserve the disable label', async ui => {
  assert.equal(ui.panel(), null);
  assert.ok(ui.script());
  await ui.load();
  await ui.settings();
  assert.ok(ui.button('Отключить аналитику'));
  assert.equal(ui.button('Пока без аналитики'), undefined);
  document.cookie = '_ym_d=test;path=/;Secure';
  const count = ui.trackingCalls().length;
  await ui.click('Отключить аналитику');
  assert.equal(localStorage.getItem(CHOICE), 'denied');
  assert.equal(Number(localStorage.getItem(EXPIRY)), START + DAY);
  assert.equal(window.mu56AnalyticsReady, false);
  assert.ok(ui.calls().some(call => call[1] === 'destruct'));
  assert.ok(!document.cookie.includes('_ym_d'));
  await ui.media();
  assert.equal(ui.trackingCalls().length, count);
  await ui.settings();
  assert.ok(ui.button('Отключить аналитику'));
  await ui.click('Согласен');
  assert.equal(localStorage.getItem(CHOICE), 'accepted');
  assert.equal(localStorage.getItem(EXPIRY), null);
  assert.equal(window.mu56AnalyticsReady, true);
  assert.equal(document.querySelectorAll('#mu56-metrika').length, 1);
}, { storage: { [CHOICE]: 'accepted' } });

await scenario('settings reopened after initial decline can accept and clear the dismissal', async ui => {
  await ui.click('Пока без аналитики');
  await ui.settings();
  assert.ok(ui.button('Отключить аналитику'));
  assert.equal(ui.script(), null);
  await ui.click('Согласен');
  assert.equal(localStorage.getItem(CHOICE), 'accepted');
  assert.equal(localStorage.getItem(EXPIRY), null);
  assert.equal(ui.timers.size, 0);
  assert.ok(ui.script());
});

await scenario('denial before SDK load prevents late initialization and tracking', async ui => {
  await ui.click('Согласен');
  await ui.settings();
  await ui.click('Отключить аналитику');
  await ui.load();
  await ui.media();
  assert.equal(window.mu56AnalyticsReady, false);
  assert.deepEqual(ui.trackingCalls(), []);
});

await scenario('cross-tab denial stops tracking and applies the existing dismissal', async ui => {
  await ui.click('Согласен');
  await ui.load();
  const count = ui.trackingCalls().length;
  localStorage.setItem(CHOICE, 'denied');
  localStorage.setItem(EXPIRY, String(START + DAY));
  await act(() => window.dispatchEvent(new StorageEvent('storage', { key: CHOICE, newValue: 'denied' })));
  assert.equal(window.mu56AnalyticsReady, false);
  assert.equal(ui.panel(), null);
  await ui.media();
  assert.equal(ui.trackingCalls().length, count);
});

await scenario('booking dialog still suppresses the notice and preserves the unmade choice', async ui => {
  await ui.dispatch(choose({ offering: 'animation' }));
  assert.equal(ui.panel(), null);
  assert.equal(localStorage.getItem(CHOICE), null);
  await ui.dispatch(close());
  assert.ok(ui.button('Пока без аналитики'));
  assert.equal(ui.script(), null);
});

await scenario('failed consent storage fails closed without loading analytics', async ui => {
  const prototype = Object.getPrototypeOf(localStorage);
  const original = prototype.setItem;
  prototype.setItem = () => { throw new Error('Storage unavailable'); };
  try { await ui.click('Согласен'); } finally { prototype.setItem = original; }
  assert.equal(ui.panel(), null);
  assert.equal(ui.script(), null);
  assert.equal(window.mu56AnalyticsReady, false);
  assert.equal(localStorage.getItem(CHOICE), null);
});

for (const options of [
  { url: 'http://localhost/' },
  { url: 'https://dev.mu56.ru/' },
  { enabled: false },
]) {
  await scenario(`non-production/disabled gating stays intact (${options.url || 'disabled'})`, async ui => {
    assert.equal(ui.panel(), null);
    await ui.settings();
    await ui.media();
    assert.equal(ui.panel(), null);
    assert.equal(ui.script(), null);
    assert.deepEqual(ui.trackingCalls(), []);
  }, options);
}

await scenario('excluded paths retain their existing notice gating', async ui => {
  assert.equal(ui.panel(), null);
  await ui.settings();
  assert.equal(ui.panel(), null);
  assert.equal(ui.script(), null);
}, { url: 'https://mu56.ru/privacy' });

const css = await readFile(resolve(root, 'frontend/src/components/analytics-notice.module.css'), 'utf8');
const baseCss = await readFile(resolve(root, 'frontend/src/app/globals.css'), 'utf8');
assert.match(css, /flex-direction:\s*row/);
assert.match(css, /flex-wrap:\s*wrap/);
assert.match(css, /@media\s*\(max-width:\s*600px\)/);
assert.match(css, /flex-direction:\s*column/);
assert.match(css, /white-space:\s*normal/);
assert.match(baseCss, /\.analytics-notice \.button\{[^}]*min-height:44px/);
console.log(`${passed} actual-component consent scenarios passed, plus responsive CSS source checks. No SDK requests or production actions were performed. Browser layout still requires visual QA.`);

// Isolated React DOM checks. No browser, server, analytics SDK or real requests.
// Existing QA dependencies: .local/header-tests/{esbuild,jsdom}. Override their
// package.json location with ENQUIRY_TEST_TOOLS when using another QA workspace.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const qa = createRequire(resolve(root, process.env.ENQUIRY_TEST_TOOLS || '.local/header-tests/package.json'));
const { build } = qa('esbuild');
const { JSDOM } = qa('jsdom');
const frontend = createRequire(resolve(root, 'frontend/package.json'));
const work = resolve(root, '.local/enquiry-tests');
await mkdir(work, { recursive: true });
const result = await build({
  stdin: { contents: `export { LeadDialog } from './src/components/lead-dialog'; export { StoreProvider, choose, close, useAppDispatch } from './src/components/store-provider'; export { bookingCatalog } from './src/lib/booking-catalog'; export { messengers } from './src/lib/contacts'; export { contactChannel } from './src/lib/analytics';`, resolveDir: resolve(root, 'frontend'), loader: 'tsx' },
  bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
  tsconfig: resolve(root, 'frontend/tsconfig.json'),
  plugins: [{ name: 'enquiry-framework-stubs', setup(builder) {
    builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: frontend.resolve(args.path), external: true }));
    builder.onResolve({ filter: /^next\// }, args => ({ path: args.path, namespace: 'framework' }));
    builder.onLoad({ filter: /.*/, namespace: 'framework' }, args => ({ contents: `import { createElement } from 'react'; export default function Element({children, ...props}) { return createElement(${JSON.stringify(args.path === 'next/image' ? 'img' : 'a')}, props, children); }`, loader: 'js' }));
    builder.onLoad({ filter: /\.css$/ }, () => ({ contents: 'export default {};', loader: 'js' }));
  } }],
});
const bundle = resolve(work, 'enquiry.bundle.cjs');
await writeFile(bundle, result.outputFiles[0].text);

const dom = new JSDOM('<div id="root"></div>', { url: 'https://preview.example/animators' });
for (const key of ['window', 'document', 'Node', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLDialogElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'FormData']) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
HTMLElement.prototype.scrollIntoView = function () {};
HTMLDialogElement.prototype.showModal = function () { this.open = true; };
HTMLDialogElement.prototype.close = function () { this.open = false; };

const { createElement, act } = frontend('react');
const { createRoot } = frontend('react-dom/client');
const { LeadDialog, StoreProvider, choose, close, useAppDispatch, bookingCatalog, messengers, contactChannel } = frontend(bundle);
const fixture = (slug, kind, prices = []) => ({ slug, name: `Тест ${slug}`, kind, service_position: null, description: '', duration_minutes: 60, duration_is_approximate: false, included_performers: 1, availability: '', availability_label: '', requirements: '', prices, characters: [], parts: [] });
const catalog = bookingCatalog([
  fixture('animation', 'animation'),
  fixture('new-year', 'seasonal', [{ code: 'eve-18', label: '', context: 'base', amount_rub: 10000, duration_minutes: 50 }]),
  fixture('test-package', 'package', [{ code: 'base', label: '', context: 'base', amount_rub: 5000, duration_minutes: 60 }]),
]);
let dispatch;
function Harness() { dispatch = useAppDispatch(); return createElement(LeadDialog, { catalog }); }
const calls = [];
let handler = async url => {
  if (url === '/api/v1/csrf/') return new Response(JSON.stringify({ csrf_token: 'isolated-test-token' }));
  throw new Error(`No mock response configured: ${url}`);
};
globalThis.fetch = async (url, options = {}) => {
  assert.equal(typeof url, 'string');
  assert.ok(url.startsWith('/api/v1/'), `Unexpected request blocked: ${url}`);
  calls.push({ url, options });
  return handler(url, options);
};
const host = createRoot(document.getElementById('root'));
await act(() => host.render(createElement(StoreProvider, null, createElement(Harness))));
const field = name => document.querySelector(`[name="${name}"]`);
const form = () => document.querySelector('form');
const submitButton = () => document.querySelector('.form-submit');
const details = () => document.getElementById('lead-program-details');
const click = async selector => act(() => {
  const target = typeof selector === 'string' ? document.querySelector(selector) : selector;
  assert.ok(target, `Missing click target: ${selector}`);
  target.click();
});
const open = async payload => act(() => dispatch(choose(payload)));
const shut = async () => act(() => dispatch(close()));
const value = async (name, next) => act(() => {
  const input = field(name);
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set.call(input, next);
  input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
});
const submit = async () => act(() => form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
const leads = () => calls.filter(call => call.url === '/api/v1/leads/');
const deferred = () => { let resolvePromise; const promise = new Promise(resolve => { resolvePromise = resolve; }); return { promise, resolve: resolvePromise }; };
const checks = [];
const pass = label => checks.push(label);

await open({});
assert.match(field('name').closest('label').textContent, /необязательно/);
assert.equal(field('name').required, false);
assert.match(field('phone').closest('label').textContent, /обязательно/);
assert.equal(field('phone').required, true);
assert.equal(field('data_consent').required, true);
assert.equal(field('data_consent').checked, false);
assert.equal(details().hidden, true);
await click('.lead-details-toggle');
for (const name of ['event_date', 'event_time']) {
  assert.match(field(name).closest('label').textContent, /необязательно/);
  assert.equal(field(name).required, false);
}
pass('Optional labels and unchanged required phone/consent');

const links = Array.from(document.querySelectorAll('.lead-contact-options .messenger-links a'));
assert.deepEqual(links.map(link => link.href), messengers.map(item => item.href));
assert.deepEqual(links.map(link => contactChannel(link.href)), ['telegram', 'max']);
for (const link of links) {
  assert.equal(link.target, '_blank');
  assert.ok(link.relList.contains('noopener') && link.relList.contains('noreferrer'));
  assert.ok(link.getAttribute('aria-label').includes(link.textContent));
}
assert.equal(document.querySelector('.lead-contact-options .form-phone').href, 'tel:+79033922229');
assert.equal(calls.length, 0);
pass('Canonical contact fallbacks and existing analytics classification');

await value('name', 'Проверка формы');
await value('phone', '70000000000');
await value('comment', 'Изолированная проверка, не заявка');
await value('contact_method', 'telegram');
await click(field('data_consent'));
const pendingSubmission = deferred();
handler = async url => url === '/api/v1/csrf/' ? new Response(JSON.stringify({ csrf_token: 'isolated-test-token' })) : pendingSubmission.promise;
await submit();
assert.equal(form().getAttribute('aria-busy'), 'true');
assert.equal(submitButton().disabled, true);
assert.equal(document.querySelector('.lead-fields').disabled, true);
assert.equal(document.querySelector('.dialog-close').disabled, true);
const cancel = new Event('cancel', { cancelable: true });
await act(() => document.querySelector('dialog').dispatchEvent(cancel));
assert.equal(cancel.defaultPrevented, true);
const firstRequest = leads()[0];
const payload = JSON.parse(firstRequest.options.body);
assert.deepEqual(Object.keys(payload).sort(), ['name', 'phone', 'contact_method', 'event_date', 'event_time', 'comment', 'offering', 'venue', 'tariff_code', 'character', 'addons', 'second_performer', 'second_character', 'data_consent', 'consent_version', 'website'].sort());
assert.equal(payload.phone, '+7 (000) 000-00-00');
assert.equal(payload.name, 'Проверка формы');
assert.equal(payload.contact_method, 'telegram');
assert.equal(payload.data_consent, true);
assert.equal(payload.event_date, null);
assert.equal(payload.event_time, null);
assert.equal(payload.offering, null);
assert.deepEqual(payload.addons, []);
assert.ok(firstRequest.options.headers['Idempotency-Key']);
await act(() => pendingSubmission.resolve(new Response(JSON.stringify({ detail: 'Проверочная ошибка сервера' }), { status: 503 })));
assert.equal(form().getAttribute('aria-busy'), 'false');
assert.equal(submitButton().disabled, false);
assert.equal(submitButton().textContent, 'Повторить отправку');
assert.equal(submitButton().getAttribute('aria-describedby'), 'lead-submit-error');
assert.equal(document.activeElement.id, 'lead-submit-error');
assert.equal(field('name').value, 'Проверка формы');
assert.equal(field('phone').value, '+7 (000) 000-00-00');
assert.equal(field('data_consent').checked, true);
pass('Mocked submission busy state, unchanged payload, focused error and preserved values');

await shut();
await open({});
assert.equal(field('name').value, 'Проверка формы');
assert.equal(submitButton().textContent, 'Повторить отправку');
handler = async url => new Response(JSON.stringify(url === '/api/v1/csrf/' ? { csrf_token: 'isolated-test-token' } : { id: 'isolated-success' }));
await submit();
assert.equal(leads().length, 2);
assert.equal(leads()[1].options.body, firstRequest.options.body);
assert.equal(leads()[1].options.headers['Idempotency-Key'], firstRequest.options.headers['Idempotency-Key']);
assert.equal(document.activeElement.id, 'lead-success-title');
await shut();
await open({});
assert.equal(field('name').value, '');
assert.equal(field('phone').value, '');
assert.equal(field('data_consent').checked, false);
assert.equal(submitButton().textContent, 'Обсудить мой праздник');
pass('Same-entry recovery, idempotent retry, success focus and fresh form');

await shut();
const pendingQuote = deferred();
handler = async url => {
  assert.ok(url.startsWith('/api/v1/animation-quote/'));
  return pendingQuote.promise;
};
await open({ offering: 'animation' });
assert.equal(submitButton().disabled, true);
assert.equal(submitButton().getAttribute('aria-describedby'), 'lead-submit-help');
assert.match(document.getElementById('lead-submit-help').textContent, /после расчёта/);
await value('name', 'Сохранить при пересчёте');
await act(() => pendingQuote.resolve(new Response(JSON.stringify({ detail: 'Изолированная ошибка расчёта' }), { status: 503 })));
assert.equal(submitButton().disabled, true);
assert.match(document.getElementById('lead-submit-help').textContent, /Повторите расчёт/);
assert.ok(document.querySelector('.quote-retry'));
const retryQuote = deferred();
handler = async url => { assert.ok(url.startsWith('/api/v1/animation-quote/')); return retryQuote.promise; };
await click('.quote-retry');
assert.equal(document.querySelector('.quote-retry'), null);
assert.match(document.getElementById('lead-submit-help').textContent, /после расчёта/);
await act(() => retryQuote.resolve(new Response(JSON.stringify({ amount_rub: 2500, lines: [{ slug: 'animation', name: 'Тест animation', amount_rub: 2500 }] }))));
assert.equal(submitButton().disabled, false);
assert.equal(document.getElementById('lead-submit-help'), null);
assert.equal(field('name').value, 'Сохранить при пересчёте');
assert.match(document.querySelector('.lead-quote strong').textContent, /2\s500/);
pass('Pending/failed quote explanation, retry and preserved input/quote total');

await shut();
await open({ offering: 'new-year', tariff: 'eve-18' });
assert.match(field('event_date').closest('label').textContent, /нужна для тарифа/);
assert.match(field('event_time').closest('label').textContent, /нужно для тарифа/);
assert.equal(submitButton().disabled, true);
assert.equal(field('event_date').getAttribute('aria-describedby'), 'lead-schedule-error');
assert.match(field('event_time').getAttribute('aria-describedby'), /event-time-help lead-schedule-error/);
await value('name', 'Не потерять при раскрытии');
await click('.lead-details-toggle');
assert.equal(details().hidden, true);
await click('.lead-schedule-recovery button');
assert.equal(details().hidden, false);
assert.equal(document.activeElement, field('event_date'));
assert.equal(field('name').value, 'Не потерять при раскрытии');
await act(() => field('name').focus());
await click('.lead-schedule-recovery button');
assert.equal(details().hidden, false);
assert.equal(document.activeElement, field('event_date'));
await value('event_date', '2026-12-31');
await value('event_time', '18:00');
assert.equal(document.getElementById('lead-schedule-error'), null);
assert.equal(document.getElementById('lead-submit-help'), null);
assert.equal(submitButton().disabled, false);
assert.equal(field('event_time').getAttribute('aria-describedby'), 'event-time-help');
pass('Collapsed schedule recovery reveals controls, focuses date and clears resolved gate');

// A tariff remains in internal state when changing program; it must not make
// another program's optional date/time look mandatory.
await click('[role="combobox"]');
await click(Array.from(document.querySelectorAll('[role="option"]')).find(option => option.textContent.includes('Тест test-package')));
for (const name of ['event_date', 'event_time']) assert.match(field(name).closest('label').textContent, /необязательно/);
assert.equal(submitButton().disabled, false);
pass('Switching away from seasonal restores optional labels');

// Confirm every error/helper association points to a rendered element.
for (const element of document.querySelectorAll('[aria-describedby]')) {
  for (const id of element.getAttribute('aria-describedby').split(/\s+/)) assert.ok(document.getElementById(id), `Missing description: ${id}`);
}
const css = await readFile(resolve(root, 'frontend/src/components/lead-dialog.css'), 'utf8');
assert.match(css, /lead-schedule-recovery \.button\{min-height:44px/);
assert.match(css, /lead-contact-options \.form-phone\{[^}]*min-height:44px/);
assert.match(css, /lead-contact-options \.messenger-links\{[^}]*flex-wrap:wrap/);
pass('Description references and scoped touch/wrapping rules');

await act(() => host.unmount());
dom.window.close();
console.log(`${checks.length} enquiry recovery scenarios passed (React + jsdom; all requests mocked).`);
for (const label of checks) console.log(`- ${label}`);
console.log('Not covered: real-browser layout, native dialog focus trap/date picker, production delivery.');

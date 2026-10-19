import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
// Optional QA dependencies: npm install --prefix .local/header-tests jsdom@30.1.3 esbuild@0.28.2
const root = process.cwd();
const requireQA = createRequire(resolve(root, '.local/header-tests/package.json'));
const { JSDOM } = requireQA('jsdom');
const { build } = requireQA('esbuild');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://preview.example/' });
for (const name of ['window', 'document', 'Node', 'HTMLElement', 'Event']) globalThis[name] = dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__discoveryPathname = '/';
const requireFrontend = createRequire(resolve(root, 'frontend/package.json'));
const { createElement: h, act } = requireFrontend('react');
const { createRoot } = requireFrontend('react-dom/client');
const result = await build({
  stdin: { contents: `export { ChooseButton } from './frontend/src/components/choose-button';
    export { StoreProvider, useSelection } from './frontend/src/components/store-provider';
    export { PackageCard, OfferingCard } from './frontend/src/components/cards';
    export { PackageComparison } from './frontend/src/components/package-comparison';
    export { NewYearFormats } from './frontend/src/components/new-year-formats';
    export { HomePackageCard, HomeTransformerCard } from './frontend/src/components/home-photo-cards';`, resolveDir: root, loader: 'tsx' },
  bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', tsconfig: resolve(root, 'frontend/tsconfig.json'),
  plugins: [{ name: 'framework-stubs', setup(builder) {
    builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: requireFrontend.resolve(args.path), external: true }));
    builder.onResolve({ filter: /\.(png|jpe?g|webp|avif)$/ }, args => ({ path: args.path, namespace: 'image' }));
    builder.onLoad({ filter: /.*/, namespace: 'image' }, args => ({ contents: `export default {src:${JSON.stringify(args.path)},width:400,height:500}`, loader: 'js' }));
    builder.onResolve({ filter: /(?:^next\/|\.css$)/ }, args => ({ path: args.path, namespace: 'framework' }));
    builder.onLoad({ filter: /.*/, namespace: 'framework' }, args => ({ contents:
      args.path.endsWith('.css') ? 'export default {}' : args.path === 'next/navigation' ? 'export function usePathname(){return globalThis.__discoveryPathname}' :
      `import { createElement } from 'react'; export default function Element({children, ...props}){return createElement(${JSON.stringify(args.path === 'next/image' ? 'img' : 'a')}, props, children)}`, loader: 'js' }));
  } }],
});
const bundle = resolve(root, '.local/header-tests/discovery-actions.bundle.cjs');
await writeFile(bundle, result.outputFiles[0].text);
const { ChooseButton, StoreProvider, useSelection, PackageCard, OfferingCard, PackageComparison, NewYearFormats, HomePackageCard, HomeTransformerCard } = requireFrontend(bundle);
const host = createRoot(document.getElementById('root'));
let selection, submits = 0, checks = 0;
function Probe() { selection = useSelection(); return null; }
const render = async child => {
  await act(() => host.render(h(StoreProvider, null, child, h(Probe))));
  for (const button of document.querySelectorAll('button[aria-label]')) {
    const visible = button.textContent.trim();
    if (visible) assert.ok(button.getAttribute('aria-label').includes(visible), `Visible label is retained: ${visible}`);
  }
};
const choose = async (path, props = {}) => {
  globalThis.__discoveryPathname = path;
  await render(h('form', { onSubmit: event => { event.preventDefault(); submits++; } }, h(ChooseButton, props)));
  const button = document.querySelector('button');
  assert.equal(button.type, 'button'); assert.equal(button.getAttribute('aria-haspopup'), 'dialog');
  await act(() => button.click()); return button;
};
await choose('/'); assert.deepEqual(selection, { open: true, offering: '', character: '', tariff: '', addons: [], soundRequired: false, venue: '' }); checks++;
const action = await choose('/packages', { offering: 'full-party', character: 'spider-man', addons: ['sound'], ariaLabel: 'Выбрать пакет «Всё вместе»', children: 'Выбрать пакет' });
assert.equal(action.getAttribute('aria-label'), 'Выбрать пакет «Всё вместе»'); assert.equal(selection.offering, 'full-party'); assert.equal(selection.character, 'spider-man'); assert.deepEqual(selection.addons, ['sound']); checks++;
await choose('/holidays/graduation', { offering: 'full-party' }); assert.equal(selection.soundRequired, true); assert.deepEqual(selection.addons, ['sound']); checks++;
await choose('/venues/vinni-puh'); assert.equal(selection.venue, 'vinni-puh'); checks++;
await choose('/new-year', { offering: 'new-year', tariff: 'eve-18' }); assert.equal(selection.tariff, 'eve-18'); assert.equal(submits, 0); checks++;
const offering = { slug: 'sweet-vibe', name: 'Сладкий праздник', kind: 'package', service_position: null, description: 'Описание из каталога', duration_minutes: 90, duration_is_approximate: false, included_performers: 1, availability: 'available', availability_label: '', requirements: '', prices: [{ code: 'base', label: 'Базовая цена', context: 'base', amount_rub: 7654, duration_minutes: 90 }], characters: [], parts: [] };
await render(h(PackageCard, { offering, offerings: [offering] }));
assert.ok(document.querySelector('[aria-label="Выбрать пакет «Сладкий праздник»"]')); checks++;
await render(h(PackageComparison, { packages: [offering] }));
assert.ok(document.querySelector('[aria-label="Выбрать пакет «Сладкий праздник»"]')); assert.match(document.querySelector('.comparison-price').textContent, /7\s654/); checks++;
await render(h(OfferingCard, { offering: { ...offering, kind: 'transformer', slug: 'bumblebee' }, includeSound: true, soundPrice: 1234 }));
assert.ok(document.querySelector('[aria-label="Выбрать программу «Сладкий праздник»"]')); checks++;
await render(h(NewYearFormats, { offering: { ...offering, prices: [{ ...offering.prices[0], code: 'eve-18' }] } }));
assert.ok(document.querySelector('[aria-label="Обсудить 18:00 · 31 декабря"]'));
for (const button of document.querySelectorAll('button[aria-label]')) assert.ok(button.getAttribute('aria-label').includes(button.textContent.trim())); checks++;
await render(h(HomePackageCard, { offering, offerings: [offering] }));
assert.equal(document.querySelector('a[aria-label="Состав и условия пакета «Сладкий праздник»"]')?.getAttribute('href') || document.querySelector('a[href="/packages/sweet-vibe"]')?.getAttribute('href'), '/packages/sweet-vibe'); checks++;
const page = await readFile(resolve(root, 'frontend/src/app/page.tsx'), 'utf8');
assert.doesNotMatch(page, /HomeServiceNavigation|HomeChoiceSupport|ArticleCards/);
assert.match(page, /PhotoCarousel/); checks++;
await act(() => host.unmount()); dom.window.close();
console.log(`${checks} discovery action checks passed (real selection store; photo catalogue links; no network).`);

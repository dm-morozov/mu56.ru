import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
// Optional QA dependencies: npm install --prefix .local/header-tests jsdom@30.1.3 esbuild@0.28.2
const root = process.cwd();
const requireQA = createRequire(resolve(root, '.local/header-tests/package.json'));
const { JSDOM } = requireQA('jsdom');
const { build } = requireQA('esbuild');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://preview.example/characters' });
for (const name of ['window', 'document', 'Node', 'HTMLElement', 'Event', 'MouseEvent']) globalThis[name] = dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const requireFrontend = createRequire(resolve(root, 'frontend/package.json'));
const { createElement, act } = requireFrontend('react');
const { createRoot } = requireFrontend('react-dom/client');
const result = await build({
  entryPoints: [resolve(root, 'frontend/src/components/character-catalog.tsx')], bundle: true, write: false,
  format: 'cjs', platform: 'node', jsx: 'automatic', tsconfig: resolve(root, 'frontend/tsconfig.json'),
  plugins: [{ name: 'catalog-stubs', setup(builder) {
    builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: requireFrontend.resolve(args.path), external: true }));
    builder.onResolve({ filter: /(?:^@\/lib\/analytics$|^\.\/cards$|^\.\/choose-button$|\.css$)/ }, args => ({ path: args.path, namespace: 'stub' }));
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents:
      args.path === './cards' ? 'import { createElement } from "react"; export function CharacterCard({character}){return createElement("article",null,character.name)}' :
      args.path === './choose-button' ? 'import { createElement } from "react"; export function ChooseButton({children}){return createElement("button",{type:"button"},children)}' :
      args.path.endsWith('.css') ? '' : 'export function track(){}', loader: 'js' }));
  } }],
});
const bundle = resolve(root, '.local/header-tests/character-catalog.bundle.cjs');
await writeFile(bundle, result.outputFiles[0].text);
const { CharacterCatalog } = requireFrontend(bundle);
const characters = [
  { slug: 'spider-man', name: 'Человек-паук', category: 'Супергерои' },
  { slug: 'black-spider-man', name: 'Чёрный Человек-паук', category: 'Супергерои' },
  { slug: 'harry-potter', name: 'Гарри Поттер', category: 'Приключения' },
];
const original = JSON.stringify(characters);
const host = createRoot(document.getElementById('root'));
await act(() => host.render(createElement(CharacterCatalog, { characters })));
const input = () => document.getElementById('character-search');
const cards = () => [...document.querySelectorAll('article')].map(item => item.textContent);
const button = text => [...document.querySelectorAll('button')].find(item => item.textContent === text || item.getAttribute('aria-label') === text);
const click = async text => { const target = button(text); assert.ok(target, `Button: ${text}`); await act(() => { target.focus(); target.click(); }); };
const search = async text => { await act(() => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input(), text);
  input().dispatchEvent(new Event('input', { bubbles: true }));
}); };
let checks = 0;
assert.equal(cards().length, 3); assert.ok(document.querySelector('[role="status"][aria-atomic="true"]')); checks++;
await search('человек паук'); assert.deepEqual(cards(), characters.slice(0, 2).map(item => item.name)); checks++;
await search('черный'); assert.deepEqual(cards(), ['Чёрный Человек-паук']); checks++;
await click('Очистить поиск'); assert.equal(input().value, ''); assert.equal(document.activeElement, input()); assert.equal(cards().length, 3); checks++;
await click('Супергерои'); await search('Поттер Гарри'); assert.equal(cards().length, 0); assert.match(document.querySelector('.empty-search h2').textContent, /В этой категории/); checks++;
await click('Искать во всех категориях'); assert.equal(input().value, 'Поттер Гарри'); assert.equal(document.activeElement, input()); assert.deepEqual(cards(), ['Гарри Поттер']); checks++;
await click('Сбросить фильтры'); assert.equal(input().value, ''); assert.equal(cards().length, 3); assert.equal(document.activeElement, input()); assert.equal(button('Все герои').getAttribute('aria-pressed'), 'true'); checks++;
await search('несуществующий персонаж'); assert.equal(cards().length, 0); assert.ok(button('Помогите выбрать героя')); assert.equal(button('Искать во всех категориях'), undefined); checks++;
await click('Показать всех'); assert.equal(cards().length, 3); assert.equal(document.activeElement, input()); checks++;
await click('Супергерои'); assert.equal(cards().length, 2); await click('Сбросить фильтры'); assert.equal(cards().length, 3); checks++;
await act(() => { const sort = document.querySelector('select'); sort.value = 'name'; sort.dispatchEvent(new Event('change', { bubbles: true })); });
assert.deepEqual(cards(), [...characters].sort((a, b) => a.name.localeCompare(b.name, 'ru')).map(item => item.name)); assert.equal(JSON.stringify(characters), original); checks++;
for (const element of document.querySelectorAll('[aria-controls]')) assert.ok(document.getElementById(element.getAttribute('aria-controls'))); checks++;
const css = await readFile(resolve(root, 'frontend/src/components/character-catalog.css'), 'utf8');
assert.match(css, /::-webkit-search-cancel-button/); assert.match(css, /min-width: 44px/); assert.match(css, /font-size: 16px/); checks++;
await act(() => host.unmount()); dom.window.close();
console.log(`${checks} catalogue checks passed (React + jsdom; responsive geometry still needs browser QA).`);

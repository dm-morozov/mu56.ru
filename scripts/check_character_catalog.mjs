import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
// Optional QA dependencies: npm install --prefix .local/header-tests jsdom@30.1.3 esbuild@0.28.2
const root = process.cwd();
const requireQA = createRequire(resolve(root, '.local/header-tests/package.json'));
const { JSDOM } = requireQA('jsdom');
const { build } = requireQA('esbuild');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://preview.example/characters', pretendToBeVisual: true });
for (const name of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'Event', 'MouseEvent']) globalThis[name] = dom.window[name];
dom.window.scrollTo = ({ left = 0, top = 0 }) => { dom.window.scrollX = left; dom.window.scrollY = top; };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const requireFrontend = createRequire(resolve(root, 'frontend/package.json'));
const { createElement, act } = requireFrontend('react');
const { createRoot, hydrateRoot } = requireFrontend('react-dom/client');
const { renderToString } = requireFrontend('react-dom/server');
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
let host = createRoot(document.getElementById('root'));
const framework = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: ['catalogue'], renderedSearch: '' }, anotherConsumer: 'keep-me' };
window.history.replaceState(framework, '');
const initialUrl = window.location.href;
const initialHistoryLength = window.history.length;
await act(() => host.render(createElement(CharacterCatalog, { characters })));
const input = () => document.getElementById('character-search');
const cards = () => [...document.querySelectorAll('article')].map(item => item.textContent);
const button = text => [...document.querySelectorAll('button')].find(item => item.textContent === text || item.getAttribute('aria-label') === text);
const click = async text => { const target = button(text); assert.ok(target, `Button: ${text}`); await act(() => { target.focus(); target.click(); }); };
const search = async text => { await act(() => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input(), text);
  input().dispatchEvent(new Event('input', { bubbles: true }));
}); };
const sort = async value => { await act(() => { const select = document.querySelector('select'); select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); }); };
const traverse = async delta => { await act(() => new Promise(resolve => { window.addEventListener('popstate', resolve, { once: true }); window.history.go(delta); })); };
const remount = async () => { host = createRoot(document.getElementById('root')); await act(() => host.render(createElement(CharacterCatalog, { characters }))); };
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
await sort('name');
assert.deepEqual(cards(), [...characters].sort((a, b) => a.name.localeCompare(b.name, 'ru')).map(item => item.name)); assert.equal(JSON.stringify(characters), original); checks++;
for (const element of document.querySelectorAll('[aria-controls]')) assert.ok(document.getElementById(element.getAttribute('aria-controls'))); checks++;
const css = await readFile(resolve(root, 'frontend/src/components/character-catalog.css'), 'utf8');
assert.match(css, /::-webkit-search-cancel-button/); assert.match(css, /min-width: 44px/); assert.match(css, /font-size: 16px/); checks++;

assert.equal(window.location.href, initialUrl); assert.equal(window.history.length, initialHistoryLength);
for (const key of Object.keys(framework)) assert.deepEqual(window.history.state[key], framework[key]); checks++;

// Browser history really traverses here; remount represents the route boundary.
await click('Супергерои'); await search('паук'); await sort('name');
dom.window.scrollY = 734;
window.dispatchEvent(new Event('scroll'));
await new Promise(resolve => setTimeout(resolve, 170));
assert.equal(window.history.state.mu56Catalog.position.y, 734);
const savedCatalog = structuredClone(window.history.state);
await act(() => host.unmount());
window.history.pushState({ detail: 'spider-man' }, '', '/characters/spider-man');
dom.window.scrollY = 0;
await traverse(-1); await remount();
await new Promise(resolve => setTimeout(resolve, 30));
assert.equal(input().value, 'паук'); assert.equal(document.querySelector('select').value, 'name');
assert.equal(button('Супергерои').getAttribute('aria-pressed'), 'true');
assert.deepEqual(cards(), characters.slice(0, 2).map(item => item.name));
assert.equal(window.scrollY, 734); assert.deepEqual(window.history.state, savedCatalog); checks++;

await act(() => host.unmount()); await traverse(1);
assert.equal(window.location.pathname, '/characters/spider-man'); assert.deepEqual(window.history.state, { detail: 'spider-man' });
await traverse(-1); await remount();
assert.equal(input().value, 'паук'); assert.equal(document.querySelector('select').value, 'name'); checks++;

await click('Очистить поиск');
assert.equal(input().value, ''); assert.equal(document.activeElement, input());
assert.equal(button('Супергерои').getAttribute('aria-pressed'), 'true');
assert.equal(window.history.state.mu56Catalog.search, '');
await search('паук'); await click('Сбросить фильтры');
assert.equal(window.history.state.mu56Catalog.search, ''); assert.equal(window.history.state.mu56Catalog.category, 'Все герои');
assert.equal(window.history.state.mu56Catalog.sortOrder, 'name', 'Reset keeps the chosen order, as before'); checks++;

// A fresh /characters entry does not inherit a previous catalogue visit.
await act(() => host.unmount());
window.history.pushState(framework, '', '/characters'); await remount();
assert.equal(input().value, ''); assert.equal(cards().length, 3); assert.equal(document.querySelector('select').value, 'category'); checks++;

// Same-route popstate restores while mounted; unknown state falls back safely.
window.history.pushState(savedCatalog, '', '/characters');
window.history.pushState({ ...framework, mu56Catalog: { version: 1, search: 42, category: 'missing', sortOrder: 'invalid', position: { x: 0, y: -1 } } }, '', '/characters');
await traverse(-1);
assert.equal(input().value, 'паук'); assert.equal(document.querySelector('select').value, 'name');
await traverse(1);
assert.equal(input().value, ''); assert.equal(document.querySelector('select').value, 'category'); assert.equal(cards().length, 3); checks++;

// No history access during SSR, no mismatch during hydration, then restoration.
await act(() => host.unmount());
window.history.replaceState(savedCatalog, '');
const browserWindow = globalThis.window; delete globalThis.window;
const html = renderToString(createElement(CharacterCatalog, { characters }));
globalThis.window = browserWindow;
document.getElementById('root').innerHTML = html;
assert.equal(input().value, ''); assert.equal(cards().length, 3);
const hydrationErrors = [];
await act(() => { host = hydrateRoot(document.getElementById('root'), createElement(CharacterCatalog, { characters }), { onRecoverableError: error => hydrationErrors.push(error) }); });
assert.deepEqual(hydrationErrors, []); assert.equal(input().value, 'паук'); assert.equal(cards().length, 2); checks++;

// Link capture flushes the latest scroll before a client router changes entries.
const navigation = document.createElement('a'); navigation.href = '/characters/spider-man'; navigation.textContent = 'Open detail';
navigation.addEventListener('click', event => event.preventDefault()); document.body.append(navigation);
window.scrollY = 901; await act(() => navigation.click());
assert.equal(window.history.state.mu56Catalog.position.y, 901); navigation.remove(); checks++;

// Cancel a pending scroll restore when the user has already started a new action.
const requestFrame = window.requestAnimationFrame; const cancelFrame = window.cancelAnimationFrame;
const frames = new Map(); let frameId = 0;
window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
window.cancelAnimationFrame = id => frames.delete(id);
window.scrollY = 42;
await act(() => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })));
assert.equal(frames.size, 1);
await search('черный'); assert.equal(frames.size, 0); assert.equal(window.scrollY, 42); assert.deepEqual(cards(), ['Чёрный Человек-паук']);
window.requestAnimationFrame = requestFrame; window.cancelAnimationFrame = cancelFrame; checks++;

// A browser denying history writes cannot break filtering or clear/reset focus.
const replaceState = window.history.replaceState;
window.history.replaceState = () => { throw new DOMException('Restricted'); };
await search('Гарри'); await click('Искать во всех категориях'); assert.deepEqual(cards(), ['Гарри Поттер']);
await click('Сбросить фильтры'); assert.equal(cards().length, 3); assert.equal(document.activeElement, input());
window.history.replaceState = replaceState; checks++;

// Next can leave the old component alive briefly after changing the route.
window.history.pushState({ detail: 'untouched' }, '', '/characters/spider-man');
window.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('pagehide'));
await new Promise(resolve => setTimeout(resolve, 170));
assert.deepEqual(window.history.state, { detail: 'untouched' }); checks++;

await act(() => host.unmount()); window.history.pushState(framework, '', '/characters');
Object.defineProperty(window.history, 'state', { configurable: true, get() { throw new DOMException('Restricted'); } });
await remount(); assert.equal(input().value, ''); await search('Гарри'); assert.deepEqual(cards(), ['Гарри Поттер']);
delete window.history.state; checks++;
await act(() => host.unmount()); dom.window.close();
console.log(`${checks} catalogue checks passed (React + jsdom; responsive geometry still needs browser QA).`);

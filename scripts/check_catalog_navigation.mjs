import assert from 'node:assert/strict';
import { CATALOG_HISTORY_KEY, DEFAULT_CATALOG_FILTERS, readCatalogNavigation, saveCatalogNavigation } from '../frontend/src/lib/catalog-navigation.ts';

const categories = ['Все герои', 'Супергерои', 'Приключения'];
const filters = { search: 'паук', category: 'Супергерои', sortOrder: 'name' };
const position = { x: 0, y: 734 };
const nextTree = { tree: ['', { children: ['characters', {}] }], renderedSearch: '' };
const frameworkState = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: nextTree, anotherConsumer: { untouched: true } };
let writes = 0;
const history = {
  state: frameworkState,
  replaceState(...args) {
    assert.equal(args.length, 2, 'No URL update or router navigation');
    assert.equal(args[1], '');
    this.state = args[0];
    writes++;
  },
};
assert.equal(saveCatalogNavigation(history, filters, position), true);
assert.equal(writes, 1);
assert.equal(history.state.__NA, true);
assert.equal(history.state.__PRIVATE_NEXTJS_INTERNALS_TREE, nextTree);
assert.equal(history.state.anotherConsumer, frameworkState.anotherConsumer);
assert.deepEqual(readCatalogNavigation(history.state, categories), { ...filters, version: 1, position });
assert.deepEqual(frameworkState, { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: nextTree, anotherConsumer: { untouched: true } }, 'No mutation of framework state');
saveCatalogNavigation(history, filters, position);
assert.equal(writes, 1, 'Identical snapshot does not write again');

for (const state of [null, undefined, false, 3, 'bad', [], {}, { [CATALOG_HISTORY_KEY]: [] }, { [CATALOG_HISTORY_KEY]: { version: 2 } }]) {
  assert.equal(readCatalogNavigation(state, categories), null);
}
const saved = overrides => ({ [CATALOG_HISTORY_KEY]: { ...filters, version: 1, position, ...overrides } });
assert.deepEqual(readCatalogNavigation(saved({ category: 'Retired category', sortOrder: 'unknown', search: { value: 'bad' }, position: { x: 0, y: Infinity } }), categories), { ...DEFAULT_CATALOG_FILTERS, version: 1, position: null });
for (const invalid of [-1, NaN, Infinity, '10', 10_000_001]) {
  assert.equal(readCatalogNavigation(saved({ position: { x: 0, y: invalid } }), categories).position, null);
}
assert.equal(readCatalogNavigation(saved({ search: 'a'.repeat(1025) }), categories).search, '');
assert.equal(readCatalogNavigation(saved({ search: 'a'.repeat(1024) }), categories).search.length, 1024);
for (const sortOrder of ['category', 'popular', 'name']) assert.equal(readCatalogNavigation(saved({ sortOrder }), categories).sortOrder, sortOrder);
assert.equal(readCatalogNavigation(saved({ search: '  ЧЁРНЫЙ паук  ' }), categories).search, '  ЧЁРНЫЙ паук  ');
assert.equal(readCatalogNavigation(saved({ category: 'Приключения' }), ['Все герои']).category, 'Все герои');

saveCatalogNavigation(history, DEFAULT_CATALOG_FILTERS, { x: 0, y: 0 });
assert.deepEqual(readCatalogNavigation(history.state, categories), { ...DEFAULT_CATALOG_FILTERS, version: 1, position: { x: 0, y: 0 } });
saveCatalogNavigation(history, { ...filters, search: 'a'.repeat(2000) }, position);
assert.equal(readCatalogNavigation(history.state, categories).search, '');
assert.equal(saveCatalogNavigation({ state: null, replaceState() { throw new DOMException('Restricted'); } }, filters, position), false);
assert.equal(saveCatalogNavigation({ get state() { throw new Error('Restricted'); }, replaceState() { assert.fail(); } }, filters, position), false);
const circular = {}; circular.self = circular;
history.state = { ...frameworkState, [CATALOG_HISTORY_KEY]: circular };
assert.equal(saveCatalogNavigation(history, filters, position), true, 'Malformed circular snapshot can be replaced');
assert.deepEqual(readCatalogNavigation(history.state, categories), { ...filters, version: 1, position });
console.log('Catalogue history: entry-local snapshots, no URL argument, intact framework keys, defaults, bounded/malformed state, all sort modes and restricted history passed.');

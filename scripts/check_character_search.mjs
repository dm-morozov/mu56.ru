import assert from 'node:assert/strict';
import { matchesCharacterSearch, normalizeCharacterSearch } from '../frontend/src/lib/character-search.ts';

for (const query of ['человек паук', 'ЧЕЛОВЕК-ПАУК', 'паук человек', '  человек   паук ', 'человек‑паук', 'паук']) {
  assert.equal(matchesCharacterSearch('Человек-паук', query), true, query);
}
assert.equal(matchesCharacterSearch('Чёрный Человек-паук', 'черный паук'), true);
assert.equal(matchesCharacterSearch('Чёрный Человек-паук', 'че\u0308рный'), true);
assert.equal(matchesCharacterSearch('TikTok / стильный ведущий', 'tiktok ведущий'), true);
assert.equal(matchesCharacterSearch('Человек-паук', 'железный человек'), false);
assert.equal(matchesCharacterSearch('Гарри Поттер', '  '), true);
assert.equal(matchesCharacterSearch('Гарри Поттер', ''), true);
assert.equal(normalizeCharacterSearch(' ЧЁРНЫЙ—ПАУК / герой '), 'черный паук герой');
const names = ['Человек-паук', 'Чёрный Человек-паук', 'Гарри Поттер'];
assert.deepEqual(names.filter(name => matchesCharacterSearch(name, 'паук')), names.slice(0, 2));
assert.deepEqual(names.filter(name => matchesCharacterSearch(name, 'неизвестный герой')), []);
assert.deepEqual(names, ['Человек-паук', 'Чёрный Человек-паук', 'Гарри Поттер']);
console.log('Character search: case, ё/е, Unicode punctuation, whitespace, word order, partial names, no-match and immutable inputs passed.');

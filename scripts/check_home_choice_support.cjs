const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { compileFunction } = require('node:vm');

// Exercise the server component and its real catalogue helpers without a browser.
// Only framework UI boundaries, image imports and CSS are replaced with markers.
const root = path.resolve(__dirname, '../frontend');
const frontendRequire = createRequire(path.join(root, 'package.json'));
const { transformSync } = frontendRequire('next/dist/build/swc');
const modules = new Map();
const ChooseButton = () => null;
function load(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const { code } = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'typescript', tsx: filename.endsWith('.tsx') }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' },
    module: { type: 'commonjs' },
  });
  const localRequire = specifier => {
    if (specifier === 'next/image') return 'test-image';
    if (specifier === 'next/link') return 'test-link';
    if (specifier === './choose-button') return { ChooseButton };
    if (specifier === '@/lib/images') return { packageImage: slug => `/test/${slug}.jpg` };
    if (specifier.endsWith('.css')) return {};
    if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      const resolved = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
      return load(['.ts', '.tsx'].map(extension => resolved + extension).find(candidate => fs.existsSync(candidate)) || resolved);
    }
    return frontendRequire(specifier);
  };
  compileFunction(code, ['require', 'module', 'exports'], { filename })(localRequire, module, module.exports);
  return module.exports;
}

const { HomeChoiceSupport } = load(path.join(root, 'src/components/home-choice-support.tsx'));
const { HomeServiceNavigation } = load(path.join(root, 'src/components/home-service-navigation.tsx'));
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object') return [];
  return [node, ...nodes(node.props?.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  if (node == null || typeof node === 'boolean') return '';
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}
const review = Object.freeze({ author: 'Андрей', text: 'Полный актуальный текст из опубликованного API. Без переписывания.', source_label: 'Avito', source_url: 'https://www.avito.ru/brands/test-profile/all/' });
const populated = HomeChoiceSupport({ review });
const all = nodes(populated);
assert.equal(all.find(n => n.type === 'blockquote').props.children, review.text);
assert.equal(all.find(n => n.type === 'blockquote').props.cite, review.source_url);
const source = all.find(n => n.type === 'a');
assert.equal(source.props.href, review.source_url);
assert.equal(text(source), 'Профиль с отзывами на Авито');
assert.equal(source.props.target, '_blank');
assert.equal(source.props.rel, 'noopener noreferrer');
const details = all.filter(n => n.type === 'details');
assert.equal(details.length, 4);
assert.ok(details.every(n => n.props.open === undefined));
assert.equal(all.filter(n => n.type === 'summary').length, 4);
const actions = all.filter(n => n.type === ChooseButton);
assert.equal(actions.length, 1);
assert.equal(actions[0].props.offering, undefined);
assert.equal(actions[0].props.character, undefined);
assert.equal(text(actions[0]), 'Помогите выбрать');
assert.ok(all.indexOf(actions[0]) < all.indexOf(details[0]), 'help is before expandable detail');
assert.equal(all.filter(n => ['input', 'select', 'textarea', 'form'].includes(n.type)).length, 0);
assert.equal(all.filter(n => n.props?.href === '/articles/kak-vybrat-programmu').length, 1);
const empty = nodes(HomeChoiceSupport({}));
assert.equal(empty.filter(n => n.type === 'figure').length, 0);
assert.equal(empty.filter(n => n.type === 'details').length, 4);
assert.equal(empty.filter(n => n.type === ChooseButton).length, 1);
const home = nodes(HomeServiceNavigation({ offerings: [], reviews: [review] }));
assert.equal(home.find(n => n.type === HomeChoiceSupport).props.review, review);
const removed = nodes(HomeServiceNavigation({ offerings: [], reviews: [] }));
assert.equal(removed.find(n => n.type === HomeChoiceSupport).props.review, undefined);
const ambiguous = nodes(HomeServiceNavigation({ offerings: [], reviews: [review, {...review, text: 'Another'}] }));
assert.equal(ambiguous.find(n => n.type === HomeChoiceSupport).props.review, undefined);
console.log('Home choice support: verbatim published review, honest profile attribution, empty/ambiguous omission, native criteria, no-input help and article link passed.');

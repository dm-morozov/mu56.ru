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

const { PackageDetails } = load(path.join(root, 'src/components/package-details.tsx'));
const { getOccasion } = load(path.join(root, 'src/lib/occasions.ts'));
const { rubles } = load(path.join(root, 'src/lib/types.ts'));
const fixture = overrides => ({
  slug: 'sweet-vibe', name: 'Тестовый пакет', kind: 'package', description: 'Описание из каталога',
  included_performers: 1, requirements: 'Условия пакета из каталога',
  prices: [{ code: 'base', context: 'base', amount_rub: 5500 }, { code: 'second', context: 'second_performer', amount_rub: 5300 }],
  parts: [
    { position: 1, title: 'Игры с героем', duration_minutes: 60, led_by_performer: true, is_approximate: false, service_slug: 'animation' },
    { position: 2, title: 'Музыкальное шоу сладкой ваты', duration_minutes: 30, led_by_performer: true, is_approximate: false, service_slug: 'cotton-candy-show' },
    { position: 3, title: 'Фоновая музыка, без ведущих', duration_minutes: 10, led_by_performer: false, is_approximate: true, service_slug: null },
  ], ...overrides,
});
const sound = fixture({ slug: 'sound', kind: 'extra', prices: [{ context: 'base', amount_rub: 3500 }], parts: [] });
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
const render = (offering, occasion, allOfferings = [sound]) => PackageDetails({ offering, occasion, allOfferings });
const selected = tree => nodes(tree).filter(node => node.type === ChooseButton);
const displayedPrice = tree => text(nodes(tree).find(node => Object.hasOwn(node.props, 'data-package-price')));

const plain = render(fixture());
const summary = plain.props.children[0];
const program = plain.props.children[1];
assert.equal(summary.props['data-package-summary'], 'sweet-vibe');
assert.equal(summary.props['aria-labelledby'], 'package-summary-title');
assert.equal(program.props['aria-labelledby'], 'package-program-title');
const composition = nodes(summary).find(node => node.props['aria-label'] === 'Игры и шоу в пакете');
assert.equal(text(composition), 'Игры с героемМузыкальное шоу сладкой ваты');
assert.match(text(summary), /1 ч 30 минигры и шоу/);
assert.doesNotMatch(text(summary), /1 ч 40 мин/);
assert.match(text(summary), /1 аниматор/);
assert.match(text(summary), /около 10 мин фоновой музыки — без ведущего/);
assert.match(text(summary), /Оплата после праздника/);
assert.match(text(summary), /Удалённый выезд оплачивается отдельно/);
assert.equal(nodes(summary).some(node => node.type === 'test-image'), false);
assert.equal(nodes(program).filter(node => node.type === 'li').length, 3);
assert.match(text(program), /Описание из каталога/);
assert.match(text(program), /Фоновая музыка, без ведущих≈ 10 мин/);
assert.equal(nodes(plain).filter(node => Object.hasOwn(node.props, 'data-package-price')).length, 1);
assert.equal(displayedPrice(plain), `${rubles(5500)}за программу`);
assert.equal(selected(plain).length, 1);
assert.equal(selected(plain)[0].props.offering, 'sweet-vibe');
assert.equal(selected(plain)[0].props.addons, undefined);
assert.match(text(summary), /Добавить второго аниматора\+ 5\s300 ₽/);

const graduation = render(fixture(), getOccasion('graduation'));
assert.equal(displayedPrice(graduation), `${rubles(9000)}за программу со звуком`);
assert.equal(selected(graduation).length, 1);
assert.deepEqual(selected(graduation)[0].props.addons, ['sound']);
assert.equal(selected(graduation)[0].props.soundRequired, true);
assert.match(text(graduation), /Комплект звука: 3\s500 ₽/);

const kindergarten = render(fixture(), getOccasion('kindergarten'));
assert.equal(displayedPrice(kindergarten), `${rubles(5500)}за программу`);
assert.equal(selected(kindergarten)[0].props.soundRequired, false);
assert.equal(selected(kindergarten)[0].props.addons, undefined);

const foam = fixture({ slug: 'foam-party', parts: fixture().parts.map(part => part.position === 2 ? { ...part, service_slug: 'foam', is_approximate: true } : part) });
const foamWithSound = render(foam, getOccasion('graduation'));
assert.equal(displayedPrice(foamWithSound), `${rubles(5500)}за программу со звуком`);
assert.equal(selected(foamWithSound)[0].props.addons, undefined);
assert.equal(selected(foamWithSound)[0].props.soundRequired, true);
assert.match(text(foamWithSound), /Звук уже включён в базовый пакет — повторной доплаты нет/);
assert.match(text(foamWithSound.props.children[0]), /≈ 1 ч 30 мин/);

const silver = fixture({ slug: 'silver', requirements: 'Только в закрытом помещении. Освободите место.' });
const silverPackage = fixture({ parts: fixture().parts.map(part => part.position === 2 ? { ...part, service_slug: 'silver' } : part) });
const silverTree = render(silverPackage, undefined, [sound, silver]);
assert.match(text(silverTree), /Только в закрытом помещении/);
assert.equal(nodes(silverTree).find(node => node.type === 'test-link').props.href, '/shows/silver');
assert.match(text(silverTree), /Условия пакета из каталога/);
assert.equal(displayedPrice(render(fixture({ prices: [] }))), 'Цену уточнимза программу');
assert.equal(displayedPrice(render(fixture(), getOccasion('graduation'), [])), 'Цену уточнимза программу со звуком');

console.log('Package details: decision-first order, active-only composition/time, one total/CTA, group sound, included sound, full timeline, conditions and missing prices passed.');

// The overview must remain derived from catalogue edits, not a second price list.
const { PackageOverview } = load(path.join(root, 'src/components/package-overview.tsx'));
assert.equal(PackageOverview({ packages: [] }), null);
const edited = fixture({ name: 'Новый состав из каталога', included_performers: 2, prices: [{ context: 'base', amount_rub: 8765 }] });
const overview = PackageOverview({ packages: [edited, foam] });
assert.match(text(overview), /Новый состав из каталога/);
assert.match(text(overview), /8\s765 ₽/);
assert.match(text(overview), /В команде: 2 чел/);
assert.match(text(overview), /1 ч 30 мин/);
assert.doesNotMatch(text(overview), /1 ч 40 мин/);
const overviewLinks = nodes(overview).filter(node => node.type === 'test-link').map(node => node.props.href);
assert.deepEqual(overviewLinks, ['#compare', '/packages/sweet-vibe', '/packages/foam-party']);
assert.match(text(overview), /Комплект мощного звука с двумя микрофонами включён/);
assert.match(text(PackageOverview({ packages: [fixture({ prices: [], parts: [] })] })), /Состав программы уточнимИгры и шоу с ведущимВремя согласуемБазовая ценаЦену уточним/);
console.log('Package overview: catalogue edits, detail links, hosted time, included sound and incomplete data passed.');

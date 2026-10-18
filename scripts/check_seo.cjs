const assert = require('node:assert/strict');
// Next resolves extensionless TypeScript imports; the standalone Node check
// needs the same resolution for local .ts modules (Node 24+).
require('node:module').registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.') || /\.[a-z]+$/i.test(specifier)) throw error;
    return nextResolve(`${specifier}.ts`, context);
  }
} });
const seo = require('../frontend/src/lib/seo.ts');
const { offeringSearchDescription } = require('../frontend/src/lib/offering-seo.ts');
const result = seo.sitemapEntries(
  [{slug:'spider-man'}, {slug:'bumblebee'}, {slug:'new-year-duo'}],
  [{kind:'animation',slug:'animation'}, {kind:'transformer',slug:'bumblebee'}, {kind:'seasonal',slug:'new-year'}, {kind:'extra',slug:'sound'}],
  [{slug:'transformer-doma'}],
);
const urls = result.map(row => row.url);
assert.equal(new Set(urls).size, urls.length);
assert(urls.includes(seo.absoluteUrl('/transformers/bumblebee')));
assert(urls.includes(seo.absoluteUrl('/animators')));
assert(urls.includes(seo.absoluteUrl('/venues')));
assert(urls.includes(seo.absoluteUrl('/venues/vinni-puh')));
assert.equal(seo.servicePath('animation', 'animation'), '/animators');
assert(!urls.includes(seo.absoluteUrl('/characters/bumblebee')));
assert(!urls.includes(seo.absoluteUrl('/characters/new-year-duo')));
assert(!urls.some(url => url.includes('undefined') || url.includes('/privacy') || url.includes('/api/')));
assert.equal(seo.characterCanonical('snegurochka'), '/new-year');
assert.equal(seo.shortDescription(' a\n b '), 'a b');
assert.equal(seo.shortDescription(' \n\t '), '');
assert.equal(seo.shortDescription('а'.repeat(180)), 'а'.repeat(180));
assert.equal(seo.shortDescription('а'.repeat(181)), `${'а'.repeat(179)}…`);
assert.equal(seo.shortDescription(`${'Слово '.repeat(29)}оборудование и сборы`), `${'Слово '.repeat(29).trim()}…`);
const completeWordBoundary = `${'а'.repeat(173)} слово`;
assert.equal(seo.shortDescription(`${completeWordBoundary} дальше`), `${completeWordBoundary}…`);
assert.equal(seo.shortDescription('🎉'.repeat(181)), `${'🎉'.repeat(179)}…`);
assert.deepEqual(seo.website, {
  '@context': 'https://schema.org', '@type': 'WebSite', '@id': seo.absoluteUrl('/#website'),
  name: seo.organization.name, url: seo.absoluteUrl('/'),
});
assert(!('potentialAction' in seo.website));
assert(!('aggregateRating' in seo.website));
for (const ending of ['.', '!', '?', '…']) {
  const description = offeringSearchDescription({ kind: 'extra', name: 'Услуга', description: `Описание${ending} \n` });
  assert(description.includes(`Описание${ending} Состав`));
  assert(!description.includes(`${ending}.`));
}
assert(offeringSearchDescription({ kind: 'show', name: 'Шоу', description: 'Описание' }).includes('Описание. Состав'));
assert(offeringSearchDescription({ kind: 'extra', name: 'Услуга', description: ' \n' }).includes('Выездная программа на вашей площадке. Состав'));
assert.deepEqual(seo.crawlerRules(false), [{userAgent:'*',disallow:'/'}]);
const searchBot = seo.crawlerRules(true).find(r => r.userAgent === 'OAI-SearchBot');
assert.equal(searchBot.allow, '/');
assert(searchBot.disallow.includes('/api/') && searchBot.disallow.includes('/admin/'));
const schema = seo.serviceSchema({kind:'transformer',slug:'bumblebee',name:'Бамблби',prices:[{context:'base',amount_rub:6200,label:'Час'},{context:'base',amount_rub:null,label:'Неизвестно'},{context:'with_animation',amount_rub:3900,label:'Дополнение'}]},'Описание');
assert.deepEqual(schema.offers.map(p => p.price), [6200]);
assert.equal(schema.offers[0].priceCurrency, 'RUB');
assert(!('aggregateRating' in seo.organization));
assert(!('address' in seo.organization));
const payload = {name:'</script><script>alert(1)</script>'};
const encoded = seo.serializeJsonLd(payload);
assert(!encoded.includes('</script>'));
assert.deepEqual(JSON.parse(encoded), payload);
console.log('SEO checks passed: unique canonical URLs, sitemap exclusions, readable Unicode snippets, factual site name, confirmed offers, safe JSON-LD.');

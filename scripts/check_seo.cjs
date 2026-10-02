const assert = require('node:assert/strict');
const seo = require('../frontend/src/lib/seo.ts');
const result = seo.sitemapEntries(
  [{slug:'spider-man'}, {slug:'bumblebee'}, {slug:'new-year-duo'}],
  [{kind:'animation',slug:'animation'}, {kind:'transformer',slug:'bumblebee'}, {kind:'seasonal',slug:'new-year'}, {kind:'extra',slug:'sound'}],
  [{slug:'transformer-doma'}],
);
const urls = result.map(row => row.url);
assert.equal(new Set(urls).size, urls.length);
assert(urls.includes(seo.absoluteUrl('/transformers/bumblebee')));
assert(urls.includes(seo.absoluteUrl('/animators')));
assert.equal(seo.servicePath('animation', 'animation'), '/animators');
assert(!urls.includes(seo.absoluteUrl('/characters/bumblebee')));
assert(!urls.includes(seo.absoluteUrl('/characters/new-year-duo')));
assert(!urls.some(url => url.includes('undefined') || url.includes('/privacy') || url.includes('/api/')));
assert.equal(seo.characterCanonical('snegurochka'), '/new-year');
assert.equal(seo.shortDescription(' a\n b '), 'a b');
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
console.log('SEO checks passed: unique canonical URLs, sitemap exclusions, confirmed offers, safe JSON-LD.');

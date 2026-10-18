// Read-only check against the running local catalog or a saved API fixture.
// No enquiries are sent. BOOKING_CATALOG_FIXTURE accepts a complete API page
// (next: null) or an array of offerings, so before/after use identical input.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { bookingCatalog, bookingOfferings, characterSummary } from "../frontend/src/lib/booking-catalog.ts";

const heroKeys = ["slug", "name", "category", "availability"].sort();
const projectHero = ({ slug, name, category, availability }) => ({ slug, name, category, availability });
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function checkCharacters(characters) {
  const original = JSON.stringify(characters);
  deepFreeze(characters);
  const summaries = characters.map(characterSummary);
  assert.deepEqual(JSON.parse(JSON.stringify(summaries)), characters.map(projectHero),
    "The standalone character catalogue projection must preserve all four fields and order");
  assert.equal(JSON.stringify(characters), original, "Source character catalogue must remain unchanged");
  return summaries;
}

function checkProjection(offerings) {
  const original = JSON.stringify(offerings);
  deepFreeze(offerings);
  const compact = bookingCatalog(offerings);
  const transported = deepFreeze(JSON.parse(JSON.stringify(compact)));
  const beforeRestore = JSON.stringify(transported);
  const restored = bookingOfferings(transported);
  const uniqueHeroes = new Map(offerings.flatMap(offering => offering.characters).map(hero => [hero.slug, hero]));

  checkCharacters([...uniqueHeroes.values()]);
  assert.deepEqual(compact.characters, [...uniqueHeroes.values()].map(projectHero),
    "Deduplicated heroes must keep their first-seen order and all four booking fields");
  for (const hero of compact.characters) {
    assert.deepEqual(Object.keys(hero).sort(), heroKeys,
      "Booking characters must contain exactly the four fields used by the form");
  }
  assert.equal(new Set(compact.characters.map(hero => hero.slug)).size, compact.characters.length);
  assert.deepEqual(restored.map(offering => offering.slug), offerings.map(offering => offering.slug),
    "Offering order must not change");
  assert.equal(compact.offerings.length, offerings.length);
  offerings.forEach(({ characters, ...businessFields }, index) => {
    const { characterSlugs, ...transportedBusinessFields } = compact.offerings[index];
    const { characters: restoredHeroes, ...restoredBusinessFields } = restored[index];
    assert.deepEqual(transportedBusinessFields, businessFields,
      "Every offering field, including all prices, parts, descriptions and conditions, must be preserved");
    assert.deepEqual(restoredBusinessFields, businessFields,
      "JSON transport and restoration must preserve every offering field");
    assert.deepEqual(characterSlugs, characters.map(hero => hero.slug),
      "Compatibility references must preserve each offering's exact hero order");
    assert.deepEqual(restoredHeroes, characters.map(projectHero),
      "Restored heroes must preserve all four booking fields and compatibility order");
  });
  assert.equal(JSON.stringify(offerings), original, "Source catalog must remain unchanged");
  assert.equal(JSON.stringify(transported), beforeRestore, "Transported catalog must remain unchanged");
  return compact;
}

// A nonempty deterministic fixture catches projection errors even if the API is
// empty. Different ordering and repeated heroes exercise deduplication without
// depending on the current public business catalogue.
const hero = (slug, category, availability) => ({
  slug, name: `Герой ${slug}`, category, availability,
  description: "Описание для страницы героя. ".repeat(20),
  availability_label: "Только для полной карточки",
  photos: [{ url: `/test/${slug}.jpg`, alt: `Фото ${slug}`, position: 1, thumbnailPosition: "center top" }],
});
const first = hero("ordinary", "Анимация", "check");
const second = hero("large", "Большие герои", "available");
const seasonal = hero("seasonal", "Новый год", "unavailable");
const offering = (slug, characters) => ({
  slug, name: `Программа ${slug}`, kind: "package", service_position: 0,
  description: "Описание услуги сохраняется", duration_minutes: null,
  duration_is_approximate: true, included_performers: 2, availability: "check",
  availability_label: "Дату согласуем", requirements: "Условия сохраняются",
  prices: [
    { code: "base", label: "Основной", context: "base", amount_rub: 100, duration_minutes: null },
    { code: "support", label: "Второй", context: "transformer_support", amount_rub: 0, duration_minutes: 30 },
  ],
  characters,
  parts: [
    { position: 2, title: "Шоу", duration_minutes: 20, is_approximate: true, led_by_performer: true, service_slug: "test-show" },
    { position: 1, title: "Перерыв", duration_minutes: 0, is_approximate: false, led_by_performer: false, service_slug: null },
  ],
});
const fixture = [offering("first", [first, second]), offering("second", [second, seasonal, first]), offering("empty", [])];
const fixtureCatalog = checkProjection(fixture);
assert.deepEqual(checkProjection([]), { offerings: [], characters: [] });
assert.deepEqual(bookingOfferings(bookingCatalog([])), []);
assert.throws(() => bookingOfferings({
  characters: fixtureCatalog.characters,
  offerings: [{ ...fixtureCatalog.offerings[0], characterSlugs: ["missing-hero"] }],
}), { message: "Missing booking character: missing-hero" },
"Unknown compatibility references must fail explicitly, not fabricate incomplete heroes");

const offerings = [];
async function readFixture(path) {
  const fixture = JSON.parse(await readFile(path, "utf8"));
  assert.ok(Array.isArray(fixture) || (Array.isArray(fixture.results) && !fixture.next),
    "Saved fixture must be an array or a complete API page without a next page");
  return Array.isArray(fixture) ? fixture : fixture.results;
}
if (process.env.BOOKING_CATALOG_FIXTURE) {
  offerings.push(...await readFixture(process.env.BOOKING_CATALOG_FIXTURE));
} else {
  // CI uses port 8000; local Docker uses 8001. Follow the application's
  // explicit backend setting rather than accidentally checking a stale listener.
  const backendOrigin = process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";
  let url = new URL("/api/v1/offerings/", backendOrigin).href;
  while (url) {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const page = await response.json();
    assert.ok(Array.isArray(page.results));
    offerings.push(...page.results);
    url = page.next;
  }
}
const compact = checkProjection(offerings);

// Recreate the previous transport on this same input, keeping JSON key order
// identical, so gzip savings measure only the hero projection.
const previousCharacters = new Map();
const previous = {
  offerings: offerings.map(({ characters, ...fields }) => {
    characters.forEach(hero => previousCharacters.set(hero.slug, hero));
    return { ...fields, characterSlugs: characters.map(hero => hero.slug) };
  }),
  characters: [...previousCharacters.values()],
};
const bytes = value => Buffer.byteLength(JSON.stringify(value));
const gzipBytes = value => gzipSync(JSON.stringify(value), { level: 9 }).byteLength;
let characterCatalog;
if (process.env.CHARACTER_CATALOG_FIXTURE) {
  const characters = await readFixture(process.env.CHARACTER_CATALOG_FIXTURE);
  const summaries = checkCharacters(characters);
  characterCatalog = {
    characters: characters.length,
    originalBytes: bytes(characters), originalGzipBytes: gzipBytes(characters),
    compactBytes: bytes(summaries), compactGzipBytes: gzipBytes(summaries),
  };
}
console.log(JSON.stringify({
  offerings: offerings.length,
  uniqueHeroes: compact.characters.length,
  gzipLevel: 9,
  originalBytes: bytes(offerings),
  previousCatalogBytes: bytes(previous),
  previousCatalogGzipBytes: gzipBytes(previous),
  compactBytes: bytes(compact),
  compactGzipBytes: gzipBytes(compact),
  savedBytes: bytes(previous) - bytes(compact),
  savedGzipBytes: gzipBytes(previous) - gzipBytes(compact),
  characterCatalog,
  projection: "OK: all offering fields, four hero fields, compatibility/order, immutable source, empty and unknown-reference cases",
}, null, 2));

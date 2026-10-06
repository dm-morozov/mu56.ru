// Read-only check against the running local catalog. No enquiries are sent.
import assert from "node:assert/strict";
import { bookingCatalog, bookingOfferings } from "../frontend/src/lib/booking-catalog.ts";

const offerings = [];
let url = "http://127.0.0.1:8000/api/v1/offerings/";
while (url) {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const page = await response.json();
  offerings.push(...page.results);
  url = page.next;
}
const original = JSON.stringify(offerings);
const compact = bookingCatalog(offerings);
const transported = JSON.parse(JSON.stringify(compact));
assert.deepEqual(bookingOfferings(transported), offerings,
  "Transport must preserve all prices, parts, compatible heroes and their order");
assert.equal(JSON.stringify(offerings), original, "Source catalog must remain unchanged");
assert.equal(new Set(compact.characters.map(hero => hero.slug)).size, compact.characters.length);
assert.deepEqual(bookingOfferings(bookingCatalog([])), []);
console.log(JSON.stringify({
  offerings: offerings.length,
  uniqueHeroes: compact.characters.length,
  originalBytes: Buffer.byteLength(original),
  compactBytes: Buffer.byteLength(JSON.stringify(compact)),
  roundTrip: "OK",
}, null, 2));

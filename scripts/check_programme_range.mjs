import assert from 'node:assert/strict';
import { programmeRange } from '../frontend/src/lib/programme-range.ts';
assert.deepEqual(programmeRange([3500]), { min: 3500, max: 3500 });
assert.deepEqual(programmeRange([6200, 5800, 6200]), { min: 5800, max: 6200 });
assert.deepEqual(programmeRange([90, 145, 105, 135, 90]), { min: 90, max: 145 });
for (const values of [[], [undefined], [null], [0], [-1], [NaN], [Infinity], [3500, undefined], [3500, 0]]) {
  assert.equal(programmeRange(values), null, 'Incomplete or invalid catalogue must not create a partial price range');
}
const values = Object.freeze([6200, 5800, 6200]);
programmeRange(values);
assert.deepEqual(values, [6200, 5800, 6200]);
console.log('Programme range: prices, hosted durations, incomplete/invalid catalogue and immutable input passed.');

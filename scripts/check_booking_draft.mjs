import assert from 'node:assert/strict';
import { bookingDraftKey, resumeBookingDraft } from '../frontend/src/lib/booking-draft.ts';
const entry={offering:'animation',character:'',tariff:'',addons:[],soundRequired:false,venue:'vinni-puh'};
const original=bookingDraftKey(entry,'/venues/vinni-puh');
assert.equal(resumeBookingDraft(null,original),false);
assert.equal(resumeBookingDraft(original,bookingDraftKey({...entry},'/venues/vinni-puh')),true);
for(const change of [{offering:'sweet-vibe'},{character:'harry-potter'},{tariff:'group-with-sound'},{addons:['sound']},{soundRequired:true},{venue:''}])
  assert.equal(resumeBookingDraft(original,bookingDraftKey({...entry,...change},'/venues/vinni-puh')),false);
assert.equal(resumeBookingDraft(original,bookingDraftKey(entry,'/animators')),false);
const addons=['sound','photographer','sound'];
assert.equal(bookingDraftKey({...entry,addons},'/packages'),bookingDraftKey({...entry,addons:['photographer','sound']},'/packages'));
assert.deepEqual(addons,['sound','photographer','sound']);
// Completing a submission or mounting a fresh tab starts with no active entry.
assert.equal(resumeBookingDraft(null,original),false);
// Choosing B replaces A; returning to A must not recover an old discarded draft.
const other=bookingDraftKey({...entry,offering:'full-party'},'/venues/vinni-puh');
assert.equal(resumeBookingDraft(other,original),false);
console.log('Booking draft: same-entry resume; different program/hero/tariff/addons/sound/page reset; canonical addons; completed/fresh draft reset passed.');

import assert from 'node:assert/strict';
import { bookingQuoteTotal, requestBookingQuote } from '../frontend/src/lib/booking-quote.ts';
import { priceBand } from '../frontend/src/lib/analytics.ts';
import { createSubmissionKey } from '../frontend/src/lib/submission-key.ts';

const keys = Array.from({ length: 100 }, createSubmissionKey);
assert.equal(new Set(keys).size, keys.length);
assert(keys.every(key => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(key)));

const quote = { amount_rub: 7000, lines: [{ slug: 'animation', amount_rub: 3500 }, { slug: 'sound', amount_rub: 3500 }] };
assert.equal(bookingQuoteTotal(quote, 0), 7000);
assert.equal(priceBand(bookingQuoteTotal(quote, 0)), '5000_9999');
assert.equal(bookingQuoteTotal(quote, 2000), 9000);
assert.equal(bookingQuoteTotal(quote, undefined), undefined);
assert.equal(bookingQuoteTotal(null, 0), undefined);

const originalFetch = globalThis.fetch;
try {
  // A server that never replies must release the form to its retry state.
  globalThis.fetch = (_, { signal }) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(() => reject(new Error('Deadline did not abort fetch')), 1000);
    const abort = () => { clearTimeout(keepAlive); reject(signal.reason); };
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
  await assert.rejects(requestBookingQuote('/quote', new AbortController().signal, 20), /Расчёт занимает слишком долго/);
  const previous = new AbortController();
  const cancelled = requestBookingQuote('/old-selection', previous.signal, 100);
  previous.abort();
  await assert.rejects(cancelled, error => error.name === 'AbortError');

  // A retry/new composition can succeed after the cancelled request.
  globalThis.fetch = async () => new Response(JSON.stringify(quote), { status: 200 });
  assert.deepEqual(await requestBookingQuote('/new-selection', new AbortController().signal), quote);
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'Состав недоступен' }), { status: 400 });
  await assert.rejects(requestBookingQuote('/quote', new AbortController().signal), /Состав недоступен/);
} finally { globalThis.fetch = originalFetch; }
console.log('Booking quote: deadline, cancellation, retry, API errors and sound totals passed.');

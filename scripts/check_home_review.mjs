import assert from 'node:assert/strict';
import { homeReview } from '../frontend/src/lib/home-review.ts';

const source = 'https://www.avito.ru/brands/verified-profile/all/predlozheniya_uslug?page_from=test';
const review = Object.freeze({ author: 'Андрей', text: 'Текущий опубликованный отзыв.', source_label: 'Avito', source_url: source });
assert.equal(homeReview(Object.freeze([review])), review, 'reuse the actual published object, not copied quote text');
const edited = { ...review, text: 'Отредактированный отзыв из API.' };
assert.equal(homeReview([edited]), edited, 'editorial edits must appear automatically');
assert.equal(homeReview([]), undefined, 'removed or unpublished review has no static fallback');
assert.equal(homeReview([{ ...review, author: 'Другой клиент' }]), undefined, 'do not silently substitute a different review');
assert.equal(homeReview([review, { ...review, text: 'Another review with the same attribution' }]), undefined, 'ambiguous record is omitted');
assert.equal(homeReview([{ ...review, text: '  ' }]), undefined);
assert.equal(homeReview([{ ...review, source_label: 'Unknown source' }]), undefined);
for (const url of ['', 'invalid', 'javascript:alert(1)', 'http://avito.ru/brands/profile', 'https://avito.ru.evil.example/brands/profile', 'https://example.com/brands/profile', 'https://www.avito.ru/items/item', 'https://user:password@avito.ru/brands/profile']) {
  assert.equal(homeReview([{ ...review, source_url: url }]), undefined, url);
}
assert.equal(homeReview([{ ...review, source_label: 'Авито', source_url: 'https://avito.ru/brands/profile' }])?.text, review.text);
console.log('Home review: current object, edits, removal, ambiguity and profile-source validation passed.');

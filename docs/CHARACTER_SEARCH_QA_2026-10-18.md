# Character discovery improvements · 18 October 2026

## Evidence and scope

The current public catalogue returned no results for `человек паук`, `черный`
and `Поттер Гарри`, even though matching heroes exist. The hyphenated spelling
returned two Spider-Man results, and `чёрный` returned one. Its custom clear
action also moved keyboard focus to the page body after the button disappeared.
Chromium displayed both its native search clear control and the custom control.

Changes:

- Share one normalizer between the catalogue and the enquiry's hero picker:
  Unicode normalization, Russian lowercase, ё/е, punctuation, spaces and
  order-independent name fragments. No fuzzy guesses or new character aliases.
- Keep a query when searching across categories; distinguish a hidden match
  from a genuinely unmatched name.
- Offer explicit reset and enquiry help for empty results. Clear/reset actions
  restore the input focus. Preserve sorting and the original catalogue data.
- Announce result counts and connect filters to the result container.
- Use one labelled clear control, 44px touch targets and 16px mobile form text.

No prices, programme contents, popularity ranking, images, availability or
commercial copy were changed.

## Reproducible checks

Run from the repository root:

```sh
node --experimental-transform-types scripts/check_character_search.mjs
node scripts/check_character_catalog.mjs
```

The DOM check uses optional local-only dependencies:

```sh
npm install --prefix .local/header-tests jsdom@30.1.3 esbuild@0.28.2
```

Both passed. The 13 actual-component React/jsdom scenarios cover tolerant
queries, clear/reset focus, category recovery preserving the query, true empty
results, the enquiry helper, sorting without source mutation, live status,
valid ARIA references and scoped touch/font CSS rules. The helper also covers
decomposed Unicode, non-breaking hyphens and blank queries.

## Remaining verification

The DOM tests do not prove responsive geometry, keyboard behavior on a real
phone or visual presentation. Local Chromium execution is blocked by the
execution sandbox; the separate cloud browser cannot reach this container's
localhost. Before publication, visually check 320px, 390px, 768px and desktop
widths, 200% zoom, horizontal category scrolling and the enquiry help action.
No production form was submitted during QA.

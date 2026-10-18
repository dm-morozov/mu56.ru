# Programme discovery and action clarity · 18 October 2026

## Changes

- The homepage's named Bumblebee offer links to its matching detail page,
  rather than asking the visitor to choose again from all transformers. If
  that catalogue item is absent, the link still falls back to the listing.
- The homepage's animator shortcut shows duration and base price from the
  existing catalogue item. The summary is omitted when the price is unknown.
  There is no hardcoded price, site-wide “from” claim or new travel promise.
- Repeated package/programme buttons now include the programme name in their
  accessible label. Fixed New Year actions include the day as additional
  context, preserving the complete visible phrase for voice-control matching.
- Shared enquiry triggers explicitly use `type="button"` and announce a
  dialog. Their existing programme, hero, sound, tariff and venue payloads are
  unchanged.

The fixed New Year slot mapping is shared with the enquiry so its displayed
label and carried time cannot drift independently. Slot order, times, dates
without a year, prices and availability conditions are unchanged.

## Verification

`node scripts/check_discovery_actions.mjs` passes 13 React/jsdom scenarios.
It exercises the real StoreProvider/reducer, checks that buttons never submit
an enclosing form, and covers generic entry, programme/hero/add-ons, required
sound, venue context, tariff context and contextual labels. It renders real
package cards/comparison, New Year formats and home navigation. Synthetic
catalogue values verify that the displayed price/duration are not hardcoded;
missing data and the six existing navigation destinations are covered.

Optional local QA dependencies are the same `jsdom@30.1.3` and
`esbuild@0.28.2` described in the other component checks. No application
dependencies were added.

Independent source review found a New Year label mismatch (the date split the
visible action phrase). It was corrected and the regression test now asserts
that every rendered contextual button label contains its visible text.

## Limits

This is local source and DOM verification. It does not measure conversion or
prove rendered layout, phone keyboard behavior, live form delivery or a
deployment. The existing brand, photos and business terms were retained.

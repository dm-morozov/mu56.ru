# Isolated browser QA

Pull requests run a pinned Playwright Chromium suite after the existing build
and backend checks in `Site checks`. The existing temporary PostgreSQL database
and public seed commands provide the test catalogue. No production database, deployment
credentials or Telegram worker participates.

The test browser routes every `mu56.ru` request to the app at
`127.0.0.1:3100`. This lets it exercise the existing hostname-gated consent UI
without changing application code or DNS/security settings. All other origins
and every lead-submission request are aborted and fail the test. The temporary
Next server enables indexing only to render the existing consent component;
it is never exposed publicly. No lead is submitted, including to the local API.

The suite uses desktop 1440×900, mobile 390×844 and small-mobile 360×640
Chromium layouts. It checks first-visit consent/refusal, no page-wide horizontal
overflow, menu keyboard recovery, search variants and reset focus, long-dialog
close visibility, New Year time prefill and draft preservation. Screenshots
cover homepage before/after dismissal, menu, search, packages/dialogs and the
animator/Bumblebee landing pages. These are real browser screenshots but still
need visual review; passing assertions alone is not a design sign-off. Chromium
mobile emulation does not replace an iPhone Safari or Android device check.

Artifacts contain only screenshots, test results, and isolated-server logs.
GitHub retains them for seven days. Traces are kept only for failed tests.
Workflow permissions and production deployment gates are unchanged.

For a supported local test environment, start the migrated test backend on
port 8000, build Next with `BACKEND_ORIGIN=http://127.0.0.1:8000`, then start
Next on port 3100 with `SITE_INDEXING_ENABLED=true`. Install the locked test
dependencies with `npm ci --prefix scripts/browser-qa`, install Chromium using
the package's Playwright CLI, and run `npm --prefix scripts/browser-qa test`.

References: [Playwright CI](https://playwright.dev/docs/ci),
[GitHub upload-artifact](https://github.com/actions/upload-artifact).

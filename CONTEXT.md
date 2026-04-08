# Torn Museum App Context

This file is the long-term implementation context for the Torn plushie arbitrage single-page app.

## Product goals

1. **Answer one core question quickly:**
   - Is exchanging one plushie set for 10 points profitable right now?
2. **Require minimal setup for users:**
   - Paste Torn API key once, store it locally, and auto-refresh data.
3. **Stay lightweight and maintainable:**
   - No build step required.
   - Static hosting on GitHub Pages.

## Functional requirements (baseline contract)

The app must continue to support all of the following unless explicitly changed:

- Token input flow:
  - text/password field and **Apply** button when no token is stored.
  - token is stored in browser `localStorage`.
  - when a token is stored, show a **Clear** action instead of input flow.
- Token/key requirement:
  - require a **Torn Custom API key** with `market -> itemmarket` and `market -> pointsmarket` permissions (API v2).
  - these are the minimum permission expectations for plushie and points retrieval in this app.
- Data refresh behavior:
  - refresh all remote data every **30 seconds** while token is active.
- Plushie coverage:
  - Camel, Lion, Panda, Red Fox, Monkey, Nessie, Jaguar, Chamois,
    Wolverine, Stingray, Kitten, Sheep, Teddy Bear.
- Price outputs:
  - per plushie: current market price + 30-day average market price.
  - aggregate plushie set totals for current and 30-day average.
- Points output:
  - retrieve point market data via Torn API using token.
  - display average sell value over the past month.
- Arbitrage output:
  - compare 10-point value against plushie-set costs and show delta.

## Architecture guidance

### Front-end style

- Keep a **single static SPA** (`index.html`, `styles.css`, `app.js`).
- Use vanilla JavaScript unless complexity clearly requires a framework.
- Avoid introducing a build pipeline unless there is a strong documented reason.

### State and data flow

- Treat `localStorage` token as the source of truth for authenticated calls.
- Keep fetch logic separated from render logic:
  - data acquisition/parsing in dedicated functions.
  - UI rendering in dedicated functions.
- Keep calculation logic deterministic and side-effect free where possible.

### Error handling

- Never silently fail API calls.
- Surface user-facing status text for failures and refresh state.
- Preserve partial UI integrity when one source fails (avoid broken/blank app).

### Maintainability rules

- Prefer small, named functions over large multi-purpose blocks.
- Do not duplicate plushie metadata or ID mappings in multiple places.
- If adding new metrics, add them via explicit calculation functions.
- Keep comments focused on intent and constraints, not obvious syntax.

## Data-source guidance

- Key validation guidance:
  - if token-related issues occur, verify permissions via:
    `https://api.torn.com/key/?selections=info&key=YOUR_KEY_HERE`
  - missing `market -> pointsmarket` access should be surfaced clearly to users.

- Plushie market metrics are sourced from Torn API `market/{itemId}?selections=itemmarket`.
- Point market sell-average data is sourced from Torn API `market/?selections=pointsmarket`.
- Torn and third-party response schemas may evolve:
  - parse defensively;
  - keep fallback extraction logic explicit and tested.

## Deployment contract

- GitHub Actions workflow must continue deploying to GitHub Pages on push.
- Deployment should remain static-artifact based (no server dependency).

## Regression-prevention checklist

When changing app behavior, validate:

1. Token apply/clear cycle still works after page reload.
2. Refresh timer remains 30 seconds and does not multiply over time.
3. All 13 plushies are present and mapped to stable item IDs.
4. Set totals and arbitrage math match manual calculations.
5. Point-market average is displayed or clearly reported unavailable.
6. GitHub Pages workflow still publishes from repository changes.

## Change management note for future AI edits

Before large refactors, preserve these invariants:

- This is an arbitrage tool first, not a general Torn dashboard.
- Fast load + low complexity beats feature breadth.
- Explicit calculations and predictable data flow are preferred over abstractions
  that hide business logic.

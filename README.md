# torn-museum

Single-page app for Torn plushie-set arbitrage tracking.

## What it does

- Stores your Torn API token in browser local storage.
- Fetches plushie market prices for:
  Camel, Lion, Panda, Red Fox, Monkey, Nessie, Jaguar, Chamois, Wolverine, Stingray, Kitten, Sheep, Teddy Bear.
- Shows:
  - current market price for each plushie
  - 30-day average market price for each plushie
  - total plushie set current value (sum of one of each)
  - total plushie set 30-day average value
  - points market average price
  - arbitrage estimate against exchanging a plushie set for 10 points
- Auto-refreshes all API data every 30 seconds while a token is active.

## Local usage

Open `index.html` in a browser.

## Deployment

A GitHub Actions workflow at `.github/workflows/deploy-pages.yml` deploys the app to GitHub Pages on every push.


## Project context

See `CONTEXT.md` for goals, architecture guidance, and regression-prevention guardrails.


## API key requirement

Use a **Torn Custom API key** that includes **`market -> itemmarket`** and **`market -> pointsmarket`** permissions (API v2).
You can check a key's permissions at:
`https://api.torn.com/key/?selections=info&key=YOUR_KEY_HERE`

All market data now comes directly from Torn API v2 endpoints to avoid third-party CORS issues on GitHub Pages.

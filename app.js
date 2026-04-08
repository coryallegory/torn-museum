const STORAGE_KEY = 'torn_api_token';
const REFRESH_INTERVAL_MS = 30_000;

const PLUSHIES = [
  { name: 'Camel', id: 384 },
  { name: 'Lion', id: 281 },
  { name: 'Panda', id: 274 },
  { name: 'Red Fox', id: 269 },
  { name: 'Monkey', id: 273 },
  { name: 'Nessie', id: 268 },
  { name: 'Jaguar', id: 266 },
  { name: 'Chamois', id: 385 },
  { name: 'Wolverine', id: 215 },
  { name: 'Stingray', id: 187 },
  { name: 'Kitten', id: 186 },
  { name: 'Sheep', id: 267 },
  { name: 'Teddy Bear', id: 261 }
];

const els = {
  tokenForm: document.getElementById('token-form'),
  tokenInput: document.getElementById('token-input'),
  tokenActive: document.getElementById('token-active'),
  clearToken: document.getElementById('clear-token'),
  tokenStatus: document.getElementById('token-status'),
  tableBody: document.getElementById('plushie-table-body'),
  setCurrent: document.getElementById('set-current'),
  setAverage: document.getElementById('set-average'),
  pointsAverage: document.getElementById('points-average'),
  tenPointValue: document.getElementById('ten-point-value'),
  arbCurrent: document.getElementById('arb-current'),
  arbAverage: document.getElementById('arb-average'),
  lastUpdated: document.getElementById('last-updated')
};

let refreshTimer = null;

function formatMoney(value) {
  if (!Number.isFinite(value)) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function setTokenUi(hasToken) {
  els.tokenForm.classList.toggle('hidden', hasToken);
  els.tokenActive.classList.toggle('hidden', !hasToken);
}

function saveToken(token) {
  localStorage.setItem(STORAGE_KEY, token.trim());
}

function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
  setTokenUi(false);
  els.tokenInput.value = '';
  els.tokenStatus.textContent = 'Token cleared.';
  stopRefresh();
}

function getToken() {
  return localStorage.getItem(STORAGE_KEY);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function extractLowestListingPrice(itemmarket) {
  const listings = itemmarket?.listings;
  if (!listings) return NaN;

  const candidates = [];

  if (Array.isArray(listings)) {
    for (const listing of listings) {
      const price = Number(listing?.price);
      if (Number.isFinite(price) && price > 0) {
        candidates.push(price);
      }
    }
  } else if (typeof listings === 'object') {
    const asRecord = /** @type {Record<string, unknown>} */ (listings);
    for (const listing of Object.values(asRecord)) {
      const price = Number(listing?.price);
      if (Number.isFinite(price) && price > 0) {
        candidates.push(price);
      }
    }
  }

  if (!candidates.length) return NaN;
  return Math.min(...candidates);
}

function extractItemAveragePrice(itemmarket) {
  const average = Number(itemmarket?.item?.average_price);
  if (Number.isFinite(average) && average > 0) return average;
  return NaN;
}

async function getPlushiePrices(token) {
  const results = await Promise.all(
    PLUSHIES.map(async (plushie) => {
      const url = `https://api.torn.com/v2/market/${plushie.id}?selections=itemmarket&key=${encodeURIComponent(token)}`;
      const data = await fetchJson(url);

      if (data.error) {
        throw new Error(`Torn API error ${data.error.code}: ${data.error.error}`);
      }

      const itemmarket = data.itemmarket || data;
      const current = extractLowestListingPrice(itemmarket);
      const average30d = extractItemAveragePrice(itemmarket);

      return {
        ...plushie,
        current: Number.isFinite(current) ? current : 0,
        average30d: Number.isFinite(average30d) ? average30d : 0
      };
    })
  );

  return results;
}

function extractPointsAverage(data) {
  const pointsmarket = data?.pointsmarket ?? data;

  const candidates = [
    pointsmarket?.average_price,
    pointsmarket?.average,
    pointsmarket?.average_30d,
    pointsmarket?.month_average,
    pointsmarket?.sell_average,
    pointsmarket?.sell?.average,
    pointsmarket?.sell_price_average,
    pointsmarket?.stats?.month?.sell_average,
    pointsmarket?.market_value,
    pointsmarket?.point_value,
    pointsmarket?.value,
    pointsmarket?.price
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const listings = pointsmarket?.listings || pointsmarket?.points || [];
  if (Array.isArray(listings)) {
    const listingValues = listings
      .map((entry) => Number(entry.price ?? entry.cost ?? entry.value ?? entry.market_price ?? entry.point_value))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (listingValues.length) {
      return listingValues.reduce((a, b) => a + b, 0) / listingValues.length;
    }
  } else if (typeof listings === 'object') {
    const listingValues = Object.values(listings)
      .map((entry) => Number(entry?.price ?? entry?.cost ?? entry?.value ?? entry?.market_price ?? entry?.point_value))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (listingValues.length) {
      return listingValues.reduce((a, b) => a + b, 0) / listingValues.length;
    }
  }

  const history = pointsmarket?.history || pointsmarket?.sales || [];
  if (Array.isArray(history) && history.length > 0) {
    const values = history
      .map((entry) => Number(entry.price ?? entry.sell_price ?? entry.average_price))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (values.length) {
      return values.reduce((a, b) => a + b, 0) / values.length;
    }
  }

  // Last-resort fallback: scan nested objects for average/value fields.
  const fallbackValues = [];
  const queue = [pointsmarket];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;

    for (const [key, value] of Object.entries(current)) {
      if (value && typeof value === 'object') {
        queue.push(value);
        continue;
      }

      if (
        /(average|avg|price|value|cost)/i.test(key) &&
        !/(timestamp|quantity|amount|stock|id)/i.test(key)
      ) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) fallbackValues.push(n);
      }
    }
  }

  if (fallbackValues.length) {
    return fallbackValues.reduce((a, b) => a + b, 0) / fallbackValues.length;
  }

  return NaN;
}

async function getPointsAverage(token) {
  const url = `https://api.torn.com/v2/market/?selections=pointsmarket&key=${encodeURIComponent(token)}`;
  const data = await fetchJson(url);

  if (data.error) {
    throw new Error(`Torn API error ${data.error.code}: ${data.error.error}`);
  }

  return extractPointsAverage(data);
}

function render(plushies, pointsAverage) {
  els.tableBody.innerHTML = plushies
    .map(
      (p) => `
      <tr>
        <td>${p.name}</td>
        <td>${formatMoney(p.current)}</td>
        <td>${formatMoney(p.average30d)}</td>
      </tr>
    `
    )
    .join('');

  const setCurrent = plushies.reduce((sum, p) => sum + p.current, 0);
  const setAverage = plushies.reduce((sum, p) => sum + p.average30d, 0);
  const tenPointValue = Number.isFinite(pointsAverage) ? pointsAverage * 10 : NaN;

  els.setCurrent.textContent = formatMoney(setCurrent);
  els.setAverage.textContent = formatMoney(setAverage);
  els.pointsAverage.textContent = formatMoney(pointsAverage);
  els.tenPointValue.textContent = formatMoney(tenPointValue);
  els.arbCurrent.textContent = formatMoney(tenPointValue - setCurrent);
  els.arbAverage.textContent = formatMoney(tenPointValue - setAverage);
  els.lastUpdated.textContent = `Last updated: ${new Date().toLocaleString()}`;
}

async function refreshData() {
  const token = getToken();
  if (!token) {
    els.tokenStatus.textContent = 'Add a token to load data.';
    return;
  }

  try {
    els.tokenStatus.textContent = 'Refreshing data...';
    const [plushies, pointsAverage] = await Promise.all([
      getPlushiePrices(token),
      getPointsAverage(token)
    ]);

    render(plushies, pointsAverage);
    els.tokenStatus.textContent = 'Data is live. Refreshes every 30 seconds.';
  } catch (error) {
    console.error(error);
    els.tokenStatus.textContent = `Failed to refresh: ${error.message}`;
  }
}

function startRefresh() {
  stopRefresh();
  refreshData();
  refreshTimer = setInterval(refreshData, REFRESH_INTERVAL_MS);
}

function stopRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

els.tokenForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const token = els.tokenInput.value.trim();
  if (!token) {
    els.tokenStatus.textContent = 'Token is required.';
    return;
  }

  saveToken(token);
  setTokenUi(true);
  els.tokenStatus.textContent = 'Token saved.';
  startRefresh();
});

els.clearToken.addEventListener('click', clearToken);

(function init() {
  const token = getToken();
  setTokenUi(Boolean(token));
  if (token) {
    startRefresh();
  } else {
    els.tokenStatus.textContent = 'No token stored.';
  }
})();

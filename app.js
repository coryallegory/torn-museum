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

async function getPlushiePrices() {
  const results = await Promise.all(
    PLUSHIES.map(async (plushie) => {
      const data = await fetchJson(`https://weav3r.dev/marketplace/${plushie.id}`);
      return {
        ...plushie,
        current: Number(data.market_price) || 0,
        average30d: Number(data.bazaar_average) || 0
      };
    })
  );

  return results;
}

function extractPointsAverage(data) {
  const candidates = [
    data?.pointsmarket?.average_price,
    data?.pointsmarket?.average,
    data?.pointsmarket?.average_30d,
    data?.pointsmarket?.month_average,
    data?.pointsmarket?.sell_average,
    data?.pointsmarket?.sell?.average,
    data?.pointsmarket?.sell_price_average,
    data?.pointsmarket?.stats?.month?.sell_average
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const history = data?.pointsmarket?.history || data?.pointsmarket?.sales || [];
  if (Array.isArray(history) && history.length > 0) {
    const values = history
      .map((entry) => Number(entry.price ?? entry.sell_price ?? entry.average_price))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (values.length) {
      return values.reduce((a, b) => a + b, 0) / values.length;
    }
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
      getPlushiePrices(),
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

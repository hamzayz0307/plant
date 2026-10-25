// Weather from Open-Meteo (free, no API key). Cached for 3 hours on the device.

const CACHE_KEY = "yaprak.weather";
const TTL = 3 * 60 * 60 * 1000;

export async function findCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&language=tr&format=json&name=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("geo");
  const data = await res.json();
  const r = data.results && data.results[0];
  if (!r) return null;
  return { name: r.name, country: r.country_code, lat: r.latitude, lon: r.longitude };
}

export async function getWeather(place) {
  if (!place || !Number.isFinite(place.lat)) return null;
  const key = `${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (c && c.key === key && Date.now() - c.at < TTL) return c.data;
  } catch { /* ignore */ }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    `&hourly=precipitation&daily=temperature_2m_min,temperature_2m_max&past_days=1&forecast_days=3&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather");
  const d = await res.json();

  const now = Date.now();
  let rainLast24 = 0;
  (d.hourly?.time || []).forEach((t, i) => {
    const ms = new Date(t).getTime();
    if (ms <= now && ms > now - 24 * 3600 * 1000) rainLast24 += d.hourly.precipitation[i] || 0;
  });
  const mins = (d.daily?.temperature_2m_min || []).slice(1, 4).filter(Number.isFinite);
  const data = {
    place: place.name,
    rainLast24: Math.round(rainLast24 * 10) / 10,
    minNext: mins.length ? Math.min(...mins) : null,
  };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ key, at: now, data })); } catch { /* ignore */ }
  return data;
}

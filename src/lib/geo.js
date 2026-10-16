// Location checker for Smart Match (Factor 5).
// Turns free-text addresses into coordinates with OpenStreetMap Nominatim
// (free, no API key) and measures the straight-line distance between them.

const CACHE_KEY = 'lb_geocode_cache_v1';
const NEAR_KM = 5;   // within 5 km  → full 10 points
const FAR_KM  = 50;  // 50 km or more → 0 points (linear in between)

const loadCache = () => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; }
};
const saveCache = (cache) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
};

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Nominatim allows ~1 request per second
let lastRequest = 0;
async function nominatim(query) {
  const wait = 1100 - (Date.now() - lastRequest);
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = await res.json();
  return data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
}

// Full address first; if not found, retry with the broader parts (e.g. "Quezon City").
export async function geocode(address) {
  const key = norm(address);
  if (!key) return null;
  const cache = loadCache();
  if (key in cache) return cache[key];

  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  const attempts = [address];
  for (let i = 1; i < parts.length; i++) attempts.push(parts.slice(i).join(', '));

  let result = null;
  for (const q of attempts) {
    try { result = await nominatim(q); } catch { return null; } // network error: don't cache
    if (result) break;
  }
  cache[key] = result;
  saveCache(cache);
  return result;
}

// Great-circle distance in km (Haversine formula)
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Factor 5 points (0–10) from distance: near = 10, far = 0, proportional in between
export function locationPoints(km) {
  if (km <= NEAR_KM) return 10;
  if (km >= FAR_KM) return 0;
  return 10 * (1 - (km - NEAR_KM) / (FAR_KM - NEAR_KM));
}

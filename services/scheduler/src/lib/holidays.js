import { httpGet } from './httpClient.js';

const NAGER_URL   = process.env.NAGER_DATE_URL || 'https://date.nager.at';
const COUNTRY     = process.env.COUNTRY_CODE    || 'DE';
const cache       = new Map(); // year → Set of 'YYYY-MM-DD'

export async function isHoliday(date) {
  const d    = new Date(date);
  const year = d.getUTCFullYear();
  if (!cache.has(year)) await fetchYear(year);
  const key = d.toISOString().slice(0, 10);
  return cache.get(year)?.has(key) ?? false;
}

async function fetchYear(year) {
  try {
    const res  = await httpGet(`${NAGER_URL}/api/v3/PublicHolidays/${year}/${COUNTRY}`);
    const list = await res.json();
    cache.set(year, new Set(list.map(h => h.date)));
    console.log(`[holidays] Fetched ${list.length} holidays for ${year}`);
  } catch (err) {
    console.warn(`[holidays] Could not fetch ${year}:`, err.message);
    cache.set(year, new Set());
  }
}

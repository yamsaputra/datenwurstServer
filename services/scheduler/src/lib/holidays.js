import { httpGet } from './httpClient.js';
import { nowIso } from './logger.js';

const NAGER_URL    = process.env.NAGER_DATE_URL       || 'https://date.nager.at';
const COUNTRY      = process.env.COUNTRY_CODE         || 'DE';
const SUBDIVISION  = process.env.HOLIDAY_SUBDIVISION  || 'DE-BB';
const cache        = new Map(); // year → Set of 'YYYY-MM-DD' holiday dates that apply to SUBDIVISION

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

    // Confirmed live 2026-07-22 against the real v3 endpoint: entries use
    // `global` (boolean) and `counties` (string[] | null when nationwide) --
    // e.g. Reformationstag returns global:false, counties:["DE-BB", ...].
    // Nager.Date's own docs describe a newer `nationalHoliday`/
    // `subdivisionCodes` shape as a planned replacement for
    // `global`/`counties`, so both are handled here defensively; only the
    // former is live today. Previously this only ever read `h.date`, so
    // Brandenburg-only holidays (like Reformationstag) were silently missed
    // entirely -- a country-level-only query can never catch a state holiday.
    const applicable = list.filter(h =>
      h.global === true || h.nationalHoliday === true ||
      (h.counties ?? h.subdivisionCodes ?? []).includes(SUBDIVISION)
    );
    cache.set(year, new Set(applicable.map(h => h.date)));
    console.log(`[holidays][${nowIso()}] Fetched ${list.length} DE holidays for ${year}, ${applicable.length} apply to ${SUBDIVISION}`);
  } catch (err) {
    console.warn(`[holidays][${nowIso()}] Could not fetch ${year}:`, err.message);
    cache.set(year, new Set());
  }
}

import db from './db.js';

// Cast dates to text so pg never turns them into JS Date objects (its
// default DATE parser builds those in the process's local timezone, which
// would silently reintroduce the kind of UTC-vs-local bug this whole
// calendar system exists to eliminate). calendar.js works on plain
// 'YYYY-MM-DD' strings throughout -- ISO date strings compare correctly with
// plain string operators, no Date object needed.

export async function loadPeriods() {
  const { rows } = await db.query(`
    SELECT label, period_type,
           start_date::text AS start_date, end_date::text AS end_date,
           opens_local::text AS opens_local, closes_local::text AS closes_local,
           specificity
    FROM calendar_periods
  `);
  return rows;
}

export async function loadLectureFree() {
  const { rows } = await db.query(`
    SELECT label, start_date::text AS start_date, end_date::text AS end_date
    FROM calendar_lecture_free
  `);
  return rows;
}

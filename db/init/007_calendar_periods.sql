-- Semester/opening-hours calendar as data, not application constants, so a
-- future semester can be added with a migration/INSERT rather than a code
-- change. specificity drives overlap resolution (higher wins) -- see the
-- deliberate overlap between "SS26 Ferien" and "WS26 Vorlesungszeit" on
-- 2026-09-21/22 below, where lecture (3) must beat break (1).

CREATE TABLE IF NOT EXISTS calendar_periods (
  id             SERIAL PRIMARY KEY,
  label          TEXT NOT NULL,
  period_type    TEXT NOT NULL CHECK (period_type IN ('lecture', 'exam', 'break')),
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  opens_local    TIME NOT NULL,
  closes_local   TIME NOT NULL,
  semester_label TEXT,
  specificity    SMALLINT NOT NULL
);

-- Lecture-free days *inside* a lecture period take break hours, not closure
-- (e.g. Gründonnerstag is not a public holiday but the university has no
-- lectures that day) -- see calendar.js rule 3.
CREATE TABLE IF NOT EXISTS calendar_lecture_free (
  id         SERIAL PRIMARY KEY,
  label      TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL
);

INSERT INTO calendar_periods (label, period_type, start_date, end_date, opens_local, closes_local, semester_label, specificity)
SELECT * FROM (VALUES
  ('Pre-SS26 break',       'break',   DATE '2026-03-01', DATE '2026-03-22', TIME '10:00', TIME '17:00', NULL::text, 1::smallint),
  ('SS26 Vorlesungszeit',  'lecture', DATE '2026-03-23', DATE '2026-07-04', TIME '09:00', TIME '19:00', 'SS26',     3::smallint),
  ('SS26 Prüfungszeit',    'exam',    DATE '2026-07-05', DATE '2026-07-24', TIME '09:00', TIME '19:00', 'SS26',     2::smallint),
  ('SS26 Ferien',          'break',   DATE '2026-07-25', DATE '2026-09-22', TIME '10:00', TIME '17:00', 'SS26',     1::smallint),
  ('WS26 Vorlesungszeit',  'lecture', DATE '2026-09-21', DATE '2027-01-16', TIME '09:00', TIME '19:00', 'WS26',     3::smallint),
  ('WS26 Prüfungszeit',    'exam',    DATE '2027-01-17', DATE '2027-02-06', TIME '09:00', TIME '19:00', 'WS26',     2::smallint),
  ('WS26 Ferien',          'break',   DATE '2027-02-07', DATE '2027-03-22', TIME '10:00', TIME '17:00', 'WS26',     1::smallint)
) AS v(label, period_type, start_date, end_date, opens_local, closes_local, semester_label, specificity)
WHERE NOT EXISTS (
  SELECT 1 FROM calendar_periods cp WHERE cp.label = v.label AND cp.start_date = v.start_date
);

-- Christmas range confirmed as 2026-12-21..2026-12-31 (not through
-- 2027-01-02 -- both produce identical open/closed behavior this year since
-- Jan 1 is a holiday and Jan 2 is a Saturday, but 12-31 is the authoritative
-- source per the correctness-overhaul plan).
INSERT INTO calendar_lecture_free (label, start_date, end_date)
SELECT * FROM (VALUES
  ('Osterferien (lecture-free)',       DATE '2026-04-02', DATE '2026-04-07'),
  ('Tag der Arbeit (lecture-free)',    DATE '2026-05-01', DATE '2026-05-01'),
  ('Christi Himmelfahrt Brücke',       DATE '2026-05-14', DATE '2026-05-15'),
  ('Pfingstmontag (lecture-free)',     DATE '2026-05-25', DATE '2026-05-25'),
  ('Weihnachten (lecture-free)',       DATE '2026-12-21', DATE '2026-12-31')
) AS v(label, start_date, end_date)
WHERE NOT EXISTS (
  SELECT 1 FROM calendar_lecture_free clf WHERE clf.label = v.label AND clf.start_date = v.start_date
);

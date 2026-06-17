INSERT INTO config (key, value) VALUES
  ('max_occupancy',   '150'),
  ('opening_hours',   '{"mon":["08:00","20:00"],"tue":["08:00","20:00"],"wed":["08:00","20:00"],"thu":["08:00","20:00"],"fri":["08:00","18:00"],"sat":["10:00","16:00"],"sun":null}'),
  ('semester_breaks', '[]'),
  ('widget_title',    '"Bibliothek Auslastung"'),
  ('library_lat',     '48.1372'),
  ('library_lon',     '11.5755')
ON CONFLICT (key) DO NOTHING;

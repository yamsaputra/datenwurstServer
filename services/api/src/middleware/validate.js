export function validateIngestBody(body) {
  const errors = [];
  if (typeof body.device_id !== 'string' || !body.device_id.trim()) errors.push('device_id must be a non-empty string');
  if (typeof body.event_time !== 'string' || isNaN(Date.parse(body.event_time))) errors.push('event_time must be a valid ISO 8601 timestamp');
  if (!Number.isInteger(body.entries) || body.entries < 0) errors.push('entries must be a non-negative integer');
  if (!Number.isInteger(body.exits)   || body.exits   < 0) errors.push('exits must be a non-negative integer');
  return errors;
}

export function validateConfigBody(body) {
  const errors = [];
  if (typeof body.key !== 'string' || !body.key.trim()) errors.push('key must be a non-empty string');
  if (body.value === undefined) errors.push('value is required');
  return errors;
}

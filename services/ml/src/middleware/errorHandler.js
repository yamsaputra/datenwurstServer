import { nowIso } from '../lib/logger.js';

export default function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  if (status >= 500) console.error(`[ml][${nowIso()}]`, err);
  res.status(status).json({ error: message });
}

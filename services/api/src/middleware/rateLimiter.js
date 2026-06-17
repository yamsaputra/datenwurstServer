import rateLimit from 'express-rate-limit';

const make = (windowMs, max) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too many requests' }),
});

export const loginLimiter   = make(15 * 60 * 1000, 10);
export const widgetLimiter  = make(60 * 1000, 60);
export const ingestLimiter  = make(60 * 1000, 120);
export const defaultLimiter = make(60 * 1000, 300);

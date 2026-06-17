import { createHash, timingSafeEqual } from 'crypto';

const expectedKey = process.env.JETSON_API_KEY || '';
const expectedBuf = Buffer.from(expectedKey);

export default function apiKeyAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  let valid = false;
  try {
    const tokenBuf = Buffer.alloc(expectedBuf.length);
    Buffer.from(token).copy(tokenBuf);
    valid = token.length === expectedKey.length &&
            timingSafeEqual(expectedBuf, tokenBuf);
  } catch {
    valid = false;
  }

  if (!valid) {
    console.warn(`[ingest] rejected auth from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

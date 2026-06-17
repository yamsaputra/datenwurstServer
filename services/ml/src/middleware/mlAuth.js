import { timingSafeEqual } from 'crypto';

const expected    = process.env.ML_SECRET || '';
const expectedBuf = Buffer.from(expected);

export default function mlAuth(req, res, next) {
  const token = req.headers['x-ml-secret'] || '';
  let valid = false;
  try {
    const buf = Buffer.alloc(expectedBuf.length);
    Buffer.from(token).copy(buf);
    valid = token.length === expected.length && timingSafeEqual(expectedBuf, buf);
  } catch {
    valid = false;
  }
  if (!valid) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

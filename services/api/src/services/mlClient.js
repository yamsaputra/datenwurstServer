import fetch from 'node-fetch';

const ML_URL    = process.env.ML_SERVICE_URL || 'http://ml:3002';
const ML_SECRET = process.env.ML_SECRET || '';

async function mlFetch(path, options = {}) {
  const res = await fetch(`${ML_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-ML-Secret': ML_SECRET,
      ...(options.headers || {}),
    },
    timeout: 30 * 60 * 1000,
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try { message = JSON.parse(text).error ?? message; } catch {}
    throw Object.assign(new Error(message), { status: res.status });
  }
  return res.json();
}

export const triggerRetrain = (from, to) =>
  mlFetch('/retrain', { method: 'POST', body: JSON.stringify({ from, to }) });

export const getStatus = () => mlFetch('/status');

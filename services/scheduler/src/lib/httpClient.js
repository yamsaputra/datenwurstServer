import fetch from 'node-fetch';

export async function httpGet(url, opts = {}) {
  return retry(() => fetch(url, { ...opts, method: 'GET' }));
}

export async function httpPost(url, body, headers = {}) {
  return retry(() => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    timeout: 30 * 60 * 1000,
  }));
}

async function retry(fn, attempts = 3, delay = 1000) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fn();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return res;
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
}

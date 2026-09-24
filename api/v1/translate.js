const crypto = require('crypto');

function bearer(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
}

function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  const requestId = crypto.randomUUID();
  res.setHeader('x-vaml-request-id', requestId);

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required', requestId });

  const accessToken = process.env.VAML_TRANSLATOR_ACCESS_TOKEN;
  if (!accessToken) return res.status(503).json({ error: 'Translator access token is not configured', requestId });
  if (!safeEqual(bearer(req), accessToken)) return res.status(401).json({ error: 'Unauthorized', requestId });

  const body = bodyOf(req);
  const direction = body.direction === 'vaml-to-human' ? 'vaml-to-human' : body.direction === 'human-to-vaml' ? 'human-to-vaml' : '';
  const input = typeof body.input === 'string' ? body.input.normalize('NFC') : '';
  const source = typeof body.source === 'string' ? body.source.slice(0, 120) : 'unknown';

  if (!direction) return res.status(400).json({ error: 'direction must be human-to-vaml or vaml-to-human', requestId });
  if (!input.trim() || Buffer.byteLength(input, 'utf8') > 32768) {
    return res.status(400).json({ error: 'Invalid translation input', requestId });
  }

  const runtimeUrl = process.env.VAML_RUNTIME_API_URL;
  if (!runtimeUrl) {
    return res.status(503).json({
      error: 'Private VAML runtime is not configured',
      requestId
    });
  }

  const headers = {
    'content-type': 'application/json',
    accept: 'application/json',
    'x-vaml-request-id': requestId
  };
  if (process.env.VAML_RUNTIME_API_TOKEN) {
    headers.authorization = `Bearer ${process.env.VAML_RUNTIME_API_TOKEN}`;
  }

  try {
    const upstream = await fetch(runtimeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ direction, input, source, requestId }),
      signal: AbortSignal.timeout(20000)
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { output: text }; }

    if (!upstream.ok) {
      return res.status(502).json({
        error: 'Private VAML runtime request failed',
        upstreamStatus: upstream.status,
        requestId
      });
    }

    const output = [data.output, data.translation, data.result, data.text].find((value) => typeof value === 'string' && value.length);
    if (!output) return res.status(502).json({ error: 'Private VAML runtime returned no output', requestId });

    return res.status(200).json({
      output,
      direction,
      requestId
    });
  } catch (error) {
    return res.status(502).json({
      error: error && error.name === 'TimeoutError' ? 'Private VAML runtime timed out' : 'Private VAML runtime is unavailable',
      requestId
    });
  }
};

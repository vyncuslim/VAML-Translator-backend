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

function cleanHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-40).map((entry) => ({
    role: entry?.role === 'assistant' ? 'assistant' : 'user',
    content: typeof entry?.content === 'string' ? entry.content.normalize('NFC').slice(0, 32768) : ''
  })).filter((entry) => entry.content.trim());
}

module.exports = async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  const requestId = crypto.randomUUID();
  res.setHeader('x-vaml-request-id', requestId);

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required', requestId });

  const accessToken = process.env.VAML_CHAT_ACCESS_TOKEN || process.env.VAML_TRANSLATOR_ACCESS_TOKEN;
  if (!accessToken) return res.status(503).json({ error: 'Chat gateway access token is not configured', requestId });
  if (!safeEqual(bearer(req), accessToken)) return res.status(401).json({ error: 'Unauthorized', requestId });

  const body = bodyOf(req);
  const message = typeof body.message === 'string' ? body.message.normalize('NFC') : '';
  const history = cleanHistory(body.history);
  const source = typeof body.source === 'string' ? body.source.slice(0, 120) : 'unknown';

  if (!message.trim() || Buffer.byteLength(message, 'utf8') > 32768) {
    return res.status(400).json({ error: 'Invalid chat message', requestId });
  }

  const runtimeUrl = process.env.VAML_CHAT_RUNTIME_API_URL;
  if (!runtimeUrl) {
    return res.status(503).json({
      error: 'Private VAML chat runtime is not configured',
      requestId
    });
  }

  const headers = {
    'content-type': 'application/json',
    accept: 'application/json',
    'x-vaml-request-id': requestId
  };
  if (process.env.VAML_CHAT_RUNTIME_API_TOKEN) {
    headers.authorization = `Bearer ${process.env.VAML_CHAT_RUNTIME_API_TOKEN}`;
  }

  try {
    const upstream = await fetch(runtimeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        history,
        source,
        requestId,
        protocol: 'VAML/0.2'
      }),
      signal: AbortSignal.timeout(25000)
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { reply: text }; }

    if (!upstream.ok) {
      return res.status(502).json({
        error: 'Private VAML chat runtime request failed',
        upstreamStatus: upstream.status,
        requestId
      });
    }

    const reply = [data.reply, data.output, data.message, data.content, data.text]
      .find((value) => typeof value === 'string' && value.trim());

    if (!reply) {
      return res.status(502).json({ error: 'Private VAML chat runtime returned no reply', requestId });
    }

    return res.status(200).json({ reply, requestId });
  } catch (error) {
    return res.status(502).json({
      error: error && error.name === 'TimeoutError'
        ? 'Private VAML chat runtime timed out'
        : 'Private VAML chat runtime is unavailable',
      requestId
    });
  }
};
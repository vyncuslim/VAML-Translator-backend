module.exports = function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
  return res.status(200).json({
    service: 'vaml-translator-backend',
    version: '0.1.0',
    status: 'ok',
    canonicalHost: 'api.vaml.vynalthai.com',
    runtimeConfigured: Boolean(process.env.VAML_RUNTIME_API_URL),
    authConfigured: Boolean(process.env.VAML_TRANSLATOR_ACCESS_TOKEN)
  });
};

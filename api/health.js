module.exports = function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

  const translatorRuntimeConfigured = Boolean(process.env.VAML_RUNTIME_API_URL);
  const translatorAuthConfigured = Boolean(process.env.VAML_TRANSLATOR_ACCESS_TOKEN);
  const chatRuntimeConfigured = Boolean(process.env.VAML_CHAT_RUNTIME_API_URL);
  const chatDedicatedAuthConfigured = Boolean(process.env.VAML_CHAT_ACCESS_TOKEN);
  const chatAuthConfigured = Boolean(process.env.VAML_CHAT_ACCESS_TOKEN || process.env.VAML_TRANSLATOR_ACCESS_TOKEN);

  return res.status(200).json({
    service: 'vaml-translator-backend',
    version: '0.2.1',
    status: 'ok',
    canonicalHost: 'api.vaml.vynalthai.com',
    runtimeConfigured: translatorRuntimeConfigured,
    authConfigured: translatorAuthConfigured,
    translatorRuntimeConfigured,
    translatorAuthConfigured,
    chatRuntimeConfigured,
    chatAuthConfigured,
    chatDedicatedAuthConfigured,
    endpoints: {
      translate: '/v1/translate',
      chat: '/v1/chat'
    }
  });
};

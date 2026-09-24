# VAML Translator Backend

Authenticated Vercel API boundary for Human ↔ VAML translation.

## Canonical API

```text
https://api.vaml.vynalthai.com
```

Endpoints:

```text
GET  /health
POST /v1/translate
```

`POST /v1/translate` accepts the request shape used by `vyncuslim/Agent-language-Translate`:

```json
{
  "direction": "human-to-vaml",
  "input": "...",
  "source": "agent-language-translate"
}
```

or:

```json
{
  "direction": "vaml-to-human",
  "input": "...",
  "source": "agent-language-translate"
}
```

The endpoint requires:

```http
Authorization: Bearer <VAML_TRANSLATOR_ACCESS_TOKEN>
```

A successful response is:

```json
{
  "output": "...",
  "direction": "human-to-vaml",
  "requestId": "..."
}
```

## Important architecture boundary

This repository is the public API gateway. It intentionally does **not** contain private VAML semantic mappings, concept packs, production keys, or decrypted private corpus data.

The real translation engine must be configured server-side using:

```text
VAML_RUNTIME_API_URL
VAML_RUNTIME_API_TOKEN
```

If `VAML_RUNTIME_API_URL` is absent, `/v1/translate` returns `503` instead of pretending that an encoding such as Base64 is VAML.

## Vercel environment variables

```text
VAML_TRANSLATOR_ACCESS_TOKEN=<long random bearer secret>
VAML_RUNTIME_API_URL=<private translation runtime endpoint>
VAML_RUNTIME_API_TOKEN=<optional private runtime bearer token>
```

Generate the public gateway token locally, for example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Set the exact same generated value in the frontend project as:

```text
VAML_TRANSLATOR_API_TOKEN=<same secret>
```

and set:

```text
VAML_TRANSLATOR_API_URL=https://api.vaml.vynalthai.com/v1/translate
```

Never commit the real token to GitHub.

## Vercel custom domain

After importing this repository into Vercel, attach:

```text
api.vaml.vynalthai.com
```

as the project's custom domain. Configure the DNS record requested by Vercel for that subdomain, then verify the domain and TLS certificate before using it in production.

The included `vercel.json` exposes the clean public routes `/health` and `/v1/translate` while keeping the implementation inside Vercel Functions under `/api`.

## Health check

```bash
curl https://api.vaml.vynalthai.com/health
```

The health response exposes only configuration state, not secrets.

## Translation request

```bash
curl -X POST https://api.vaml.vynalthai.com/v1/translate \
  -H "Authorization: Bearer $VAML_TRANSLATOR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"direction":"human-to-vaml","input":"Hello","source":"manual-test"}'
```

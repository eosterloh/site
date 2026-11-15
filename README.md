# Erick Osterloh — personal site

Chat-first personal site ([erickosterloh.com](https://erickosterloh.com)). Grounded strictly on the bundled public dossier (`content/public`). Inference runs through Vercel AI Gateway (with optional local `OPENROUTER_API_KEY` fallback). Spark is not a public serving backend.

```bash
pnpm install
cp .env.example .env.local
# local: set AI_GATEWAY_API_KEY (or `vercel env pull`), or OPENROUTER_API_KEY
pnpm dev
```

Sync public files from the dossier on Spark (never private):

```bash
pnpm sync:public
```

## Env

| Variable | Purpose |
|---|---|
| `GATEWAY_MODEL` | Default `google/gemini-3.8-flash` |
| `AI_GATEWAY_API_KEY` | Local AI Gateway key. On Vercel, OIDC is used automatically. |
| `OPENROUTER_API_KEY` | Optional local fallback when AI Gateway credentials are not set. |
| `CHAT_DISABLED=1` | Kill switch for `/api/chat`. |

Starter chips are cached client-side and do not hit the model.

## Deploy

GitHub `eosterloh/site` deploys `main` to production on Vercel (`erickosterloh.com`). Do not expose dossier `:8765` on the public internet.

# Erick Osterloh — personal site

Chat-first site. Public dossier only. Inference is Vercel AI Gateway. Spark is not a serving backend.

```bash
pnpm install
cp .env.example .env.local
# local: set AI_GATEWAY_API_KEY, or `vercel env pull`
pnpm dev
```

Sync public files from the dossier on Spark (never private):

```bash
pnpm sync:public
```

## Env

| Variable | Point |
|---|---|
| `GATEWAY_MODEL` | Default `google/gemini-2.5-flash-lite` |
| `AI_GATEWAY_API_KEY` | Local Gateway. On Vercel, OIDC. |
| `CHAT_DISABLED=1` | Kill switch |

Free-text chat is capped at 5 questions per visitor per hour. Starter chips are cached and do not hit the model.

## Deploy

New Vercel project from this GitHub repo. `*.vercel.app` is fine until a domain exists. Enable AI Gateway on the team. Do not put dossier `:8765` on the public internet.

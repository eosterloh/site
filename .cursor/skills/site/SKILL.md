---
name: site
description: Work on Erick Osterloh's personal site (eosterloh/site). Use when editing the public dossier, starter answers, chat prompt, or deploying to Vercel.
---

# Site

Chat-first personal site. The public chat only knows `content/public`. Inference is Vercel AI Gateway. The Spark dossier on port 8765 is not a public backend.

## Content

- Public notes live in `content/public`. `pnpm dev` and `pnpm build` bundle them into `lib/public-docs.generated.ts`. Commit that generated file with content edits.
- Starter chips are `content/starters.json`. "My work" is the cached resume answer and does not hit the model. Keep it aligned with `content/public/resume.md`.
- Resume wording and numbers in `content/public/resume.md` are the source of truth. Do not invent product names, counts, or dates.
- Do not mention family, dating, exes, Trackman, or a phone number that is not already in a public file.

## Deploy

GitHub `eosterloh/site` is connected to the Vercel project `site` on team `erick-osterlohs-projects`. Production branch is `main`. A push to `main` deploys production.

- https://erickosterloh.com
- https://www.erickosterloh.com
- Project id: `prj_SyS61WKOb6Yc0sButj1UqpivR90v`

On Vercel, AI Gateway uses OIDC. Locally, set `AI_GATEWAY_API_KEY` or run `vercel env pull`. `CHAT_DISABLED=1` turns chat off.

Do not commit `.env*` or `.vercel`. Do not put the private dossier on the public internet.

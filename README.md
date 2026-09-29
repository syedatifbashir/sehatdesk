# SehatDesk — Hospital SaaS

WhatsApp-first hospital management for Pakistan. Monorepo:

- `apps/web` — Next.js 15 + Tailwind v4 SaaS portal (owner / doctor / receptionist / nurse / lab)
- `packages/db` — Prisma 6 schema + seed
- `n8n/workflows` — importable WhatsApp bot router workflow

## Quick start

```bash
cp .env.example .env        # fill JWT secrets + WhatsApp creds
docker compose up -d        # postgres + redis (or use Coolify)
npm install
npm run db:validate
cd packages/db && npx prisma migrate dev --name init && npm run db:seed
npm run dev                 # http://localhost:3000
```

Demo logins (seeded, password `password123`):
- Owner: `+923000000001` → /owner
- Receptionist: `+923000000003` → /receptionist
- Doctor: `+923000000011` → /doctor
- Nurse: `+923000000004` → /nurse
- Lab: `+923000000005` → /lab

## n8n backend

Set `N8N_WHATSAPP_WEBHOOK_URL` to your n8n webhook URL. Incoming WhatsApp
messages are forwarded there as JSON:

```json
{ "hospitalId": "...", "conversationId": "...", "from": "+92300…", "text": "…", "humanOwns": false }
```

Import `n8n/workflows/whatsapp-bot-router.json` into n8n, set env vars
`APP_URL` and `HMS_API_TOKEN`, activate. n8n owns the reply from there;
leave the variable empty to use the built-in fallback bot.

## Test

```bash
npm run test        # unit tests (slots, transitions, money)
npm run typecheck   # strict TS
npm run build       # production build
```

## Deploy (Coolify)

Postgres 16 + Redis from Coolify services, `DATABASE_URL` set, run
`prisma migrate deploy` then `npm run build && npm start`.

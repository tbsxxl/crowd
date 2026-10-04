# Gedränge-Planer

Statische Seite (`public/index.html`), ausgeliefert über Cloudflare Workers (Static Assets).

## Deployment

Bei jedem Push auf `main` deployt `.github/workflows/deploy.yml` per Wrangler.
Benötigte Repository-Secrets (GitHub → Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` – API-Token mit der Vorlage „Edit Cloudflare Workers“
- `CLOUDFLARE_ACCOUNT_ID` – Account-ID aus dem Cloudflare-Dashboard

Lokal: `npx wrangler deploy`

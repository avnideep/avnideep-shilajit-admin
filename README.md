# Avnideep Shilajit Admin Panel

Admin panel for Avnideep Shilajit - frontend (Cloudflare Pages) + API worker (Cloudflare Workers).

## Deploy

GitHub Actions deploy on push to main:
- `admin-frontend/src` -> Pages project `avnideep-admin` (https://admin.avnideep.in)
- `admin-api-worker` -> Worker `avnideep-admin-api`

Requires repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

# GitHub Deployment Setup for Admin Panel

## Setup Instructions

### 1. Configure GitHub Secrets

Add these secrets to your GitHub repository:

1. **CLOUDFLARE_API_TOKEN**
   - Go to Cloudflare Dashboard → Account → API Tokens
   - Create API Token with "Edit Cloudflare Workers" permission
   - Copy the token and add it as `CLOUDFLARE_API_TOKEN` secret

2. **CLOUDFLARE_ACCOUNT_ID**
   - Go to Cloudflare Dashboard → Account Home
   - Copy your Account ID (visible on the right sidebar)
   - Add it as `CLOUDFLARE_ACCOUNT_ID` secret

### 2. Set GitHub Repository Secrets

1. Go to GitHub → Your Repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`

### 3. Deployment Triggers

The workflow automatically deploys when you:
- **Push to main/master branch** with changes to `admin-panel/admin-frontend/**`
- **Manually trigger** via workflow_dispatch in GitHub Actions

### 4. Deployment Process

**For Production:**
```bash
git push origin main
```
This automatically triggers deployment to `https://admin.avnideepayurveda.in`

**For Staging (Manual):**
1. Go to GitHub Actions
2. Select "Deploy Admin Panel to Cloudflare Workers"
3. Click "Run workflow" → "Staging Deploy"

### 5. Verify Deployment

After deployment, check:
- Production: https://admin.avnideepayurveda.in
- Staging: https://admin-staging.avnideepayurveda.in (if configured)

## Workflow Details

### Files Deployed
- HTML pages (dashboard.html, orders.html, etc.)
- CSS styles (admin-panel/admin-frontend/src/css)
- JavaScript (admin-panel/admin-frontend/src/js)
- Static assets (icons, manifests, service workers)

### Routing Rules
- Static files: served with proper cache headers
- HTML files: served with Service Worker support
- SPA routing: fallback to index.html via _redirects

## Troubleshooting

**❌ Deployment fails with auth error**
- Verify CLOUDFLARE_API_TOKEN is set correctly
- Check token has "Edit Cloudflare Workers" permission
- Token should be valid and not expired

**❌ "Worker not found" error**
- Ensure worker name is "avnideep-admin" in wrangler.jsonc
- Verify CLOUDFLARE_ACCOUNT_ID is correct
- Confirm zone routes are properly configured

**❌ Files not serving**
- Check _redirects file in src/ directory
- Verify build configuration in wrangler.jsonc
- Check site bucket path points to src/

## Manual Deployment (if needed)

```bash
cd admin-panel/admin-frontend
npm install -D wrangler
wrangler login
wrangler deploy
```

## Environment Configuration

**Production Environment:**
- Worker name: `avnideep-admin`
- Domain: `admin.avnideepayurveda.in`
- Route: `admin.avnideepayurveda.in/*`

**Staging Environment:**
- Worker name: `avnideep-admin-staging`
- Domain: `admin-staging.avnideepayurveda.in`
- Route: `admin-staging.avnideepayurveda.in/*`

---

For more info, visit: https://developers.cloudflare.com/workers/

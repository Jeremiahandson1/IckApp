# Deploy Ick to Render

## 5-Minute Setup

### 1. Push to GitHub

```bash
cd ick
git init
git add -A
git commit -m "Ick v3 — production ready"
git remote add origin https://github.com/YOUR_USERNAME/ick.git
git push -u origin main
```

### 2. Create PostgreSQL Database on Render

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New → PostgreSQL**
3. Settings:
   - Name: `ick-db`
   - Database: `ick`
   - User: `ick`
   - Region: **Ohio** (closest to Eau Claire)
   - Plan: **Starter ($7/mo)** or Free (expires in 90 days)
4. Click **Create Database**
5. Wait for it to spin up, then **copy the Internal Database URL**

### 3. Create Web Service on Render

1. Click **New → Web Service**
2. Connect your GitHub repo
3. Settings:
   - Name: `ick`
   - Region: **Ohio**
   - Branch: `main`
   - Runtime: **Node**
   - Build Command: `./render-build.sh`
   - Start Command: `cd backend && node src/index.js`
   - Plan: **Starter ($7/mo)** or Free
4. **Environment Variables** — add these:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | *(paste the Internal Database URL from step 2)* |
| `JWT_SECRET` | *(click "Generate" for a random value)* |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `20` |
| `USDA_API_KEY` | *(free — get at https://fdc.nal.usda.gov/api-key-signup/)* |
| `FATSECRET_CLIENT_ID` | *(free — sign up at https://platform.fatsecret.com/)* |
| `FATSECRET_CLIENT_SECRET` | *(from FatSecret dashboard)* |

5. Click **Create Web Service**

### 4. Wait for Deploy

First deploy takes 10-15 minutes:
- Installs dependencies
- Builds frontend
- Creates database tables
- Seeds 56 recipes, harmful ingredients, swap mappings
- Imports 5,000 products from Open Food Facts

Watch the deploy logs. When you see:
```
Ick API running on port 10000
```
You're live.

### 5. Open It

Your app is at: **https://ick.onrender.com**

---

## After Deploy

### Custom Domain (ick.com)

1. In Render dashboard → your web service → **Settings → Custom Domains**
2. Add `ick.com`
3. Update your DNS:
   - CNAME record: `ick.com` → `ick.onrender.com`
4. Render auto-provisions HTTPS via Let's Encrypt

### Import More Products

SSH into your service or use Render Shell:
```bash
cd backend && node src/db/import-off.js --limit=50000
```
This adds ~50k products from Open Food Facts. Takes ~15 minutes.

### Add Stripe (Premium Subscriptions)

1. Create products and prices in [Stripe Dashboard](https://dashboard.stripe.com)
2. Add to Render environment variables:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_MONTHLY`
   - `STRIPE_PRICE_YEARLY`
3. Set up Stripe webhook pointing to: `https://ick.com/api/subscription/webhook`

### Redeploy

Push to `main` → Render auto-deploys:
```bash
git add -A && git commit -m "update" && git push
```

---

## Costs

| Service | Plan | Cost |
|---------|------|------|
| Render Web Service | Starter | $7/mo |
| Render PostgreSQL | Starter | $7/mo |
| **Total** | | **$14/mo** |

Free tier works for testing but sleeps after 15 min of inactivity (cold start takes ~30 sec).

---

## Troubleshooting

**Deploy fails with "render-build.sh: permission denied"**
→ Run `chmod +x render-build.sh` and push again.

**"Cannot find module" errors**
→ Make sure `NODE_VERSION=20` is set in env vars.

**Database connection refused**
→ Use the **Internal** Database URL (starts with `postgres://`), not the External one.

**App shows blank page**
→ Check that `frontend/dist/` was built. Look for "Building frontend..." in deploy logs.

**Products not loading**
→ Check seed/import logs. Run `node src/db/seed.js` manually in Render Shell.

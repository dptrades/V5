---
description: How to deploy the AntiGravity V3 dashboard to Vercel
---

# Deploying to Vercel

Follow these steps to deploy the application and ensure all real-time data features work correctly in production.

## 1. Prepare Environment Variables
You must add the following variables in the **Vercel Project Settings > Environment Variables** section. 

> [!IMPORTANT]
> Ensure all keys from your `.env.local` are copied exactly.

| Variable | Source / Purpose |
| :--- | :--- |
| `ALPACA_API_KEY` | Alpaca Dashboard |
| `ALPACA_API_SECRET` | Alpaca Dashboard |
| `FINNHUB_API_KEY` | Finnhub Dashboard |
| `PUBLIC_API_SECRET` | Public.com Personal Access Token Secret |
| `GEMINI_API_KEY` | Google AI Studio |
| `RESEND_API_KEY` | Resend.com API Key |
| `CLERK_SECRET_KEY` | Clerk Dashboard (Backend) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard (Frontend) |
| `JWT_SECRET` | A long random string for session tokens |
| `TRADER_ACCESS_KEY` | Your admin password for the dashboard |
| `SCHWAB_CLIENT_ID` | Schwab Developer Portal |
| `SCHWAB_CLIENT_SECRET` | Schwab Developer Portal |
| `SCHWAB_REFRESH_TOKEN` | Generated via Schwab OAuth flow |
| `ALERT_EMAIL` | Destination for trade alerts |
| `CRON_SECRET` | Any random string for securing cron endpoints |

## 2. Deployment Steps

### Option A: GitHub Integration (Recommended)
1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com/new).
3. Import your repository.
4. Paste the Environment Variables in the UI before clicking **Deploy**.

### Option B: Vercel CLI
If you have the Vercel CLI installed:
```bash
vercel --prod
```

## 3. Post-Deployment Checklist
- [ ] Verify **Clerk Authentication** works on the production URL.
- [ ] Check **Live Pulse** to ensure Finnhub and Public.com APIs are authorized.
- [ ] (Optional) Set up Vercel Cron Jobs if you need automated scanning at specific intervals.

---

### Need Help?
If the build fails, check the **Build Logs** in Vercel. Common issues include missing `NEXT_PUBLIC_` prefixes for variables used in client components.

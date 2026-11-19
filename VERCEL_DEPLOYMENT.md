# Deploying UPES Companion to Vercel

The web app is a Next.js 15 application and is configured for Vercel from the repository root.

## Fastest demo deployment

1. Push this repository to GitHub.
2. In Vercel, choose **Add New > Project** and import the repository.
3. Keep the repository root as the project root. `vercel.json` contains the monorepo build settings.
4. Deploy. Without environment variables, the portal still opens with labelled sample attendance and browser-local tools/fallbacks.

## Enable sign-in and account data

Add these Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` — HTTPS URL of the deployed API

The included Fastify API is a separate Node service. Host it on a Node-compatible service (for example Render/Railway/Fly.io) and point `NEXT_PUBLIC_API_URL` at it. Configure the API environment from the root `.env.example`, including database/auth values and `API_CORS_ORIGINS=https://YOUR-VERCEL-DOMAIN`.

## Important integration note

The UPES connector in this student project is explicitly mock development data. The project does not request or store a student's UPES password and does not claim an official UPES integration. Official university/Moodle data access would require authorised APIs or credentials from the institution.

## Before final submission

Run:

```bash
npm ci
npm test
npm run typecheck
npm run build -w @upes/web
```

Then test Dashboard, Attendance, Academic Performance, Assignments, Calendar, Policy AI, Directed Reading, Backlogs, Placement, Notifications, Settings, and mobile navigation.

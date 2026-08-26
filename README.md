# OpsFlow AI

OpsFlow AI is an organization-secure operations workspace for turning Sales signals into Customer Success handoffs, onboarding actions, and observable workflow execution. Mutating AI actions can require human approval, and execution plus audit records are tenant-scoped.

## Local setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`. Create an account to provision its organization, then complete `/onboarding`.

## Environment variables

Copy [.env.local.example](.env.local.example) and provide:

- Firebase browser configuration: `NEXT_PUBLIC_FIREBASE_*`
- Firebase Admin credentials: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`
- AI configuration: `AI_PROVIDER`, `AI_TIMEOUT_MS`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and optionally `OPENAI_API_KEY`, `OPENAI_MODEL`
- Server-only integrations: `WEBHOOK_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `CRM_API_URL`, `CRM_API_KEY`

Never commit `.env.local` or return server-only values from an API route.

## Commands

```bash
npm run dev
npx tsc --noEmit
npm run build
npm start
```

## Firebase requirements

Create a Firebase project with Authentication enabled for the sign-in methods you need and Firestore enabled. Create a service account for the Admin SDK, place its project ID, client email, and escaped private key in server environment variables, and deploy [firestore.rules](firestore.rules) and [firestore.indexes.json](firestore.indexes.json). Organization membership is resolved server-side from verified Firebase identity.

## Demo mode

Demo data is never seeded automatically. An authenticated owner/admin must trigger it from onboarding, and the endpoint is available only when `NODE_ENV=development` or `DEMO_MODE=true`. Records are marked `demo`, scoped to the current organization/user, and use mock integrations unless server credentials are configured.

## Integrations

Settings creates organization-scoped connection metadata only. Credentials remain in the server environment. Enabled connections use the configured webhook, SMTP, or CRM adapter; disabled or incomplete connections safely use the existing mock providers. Owners/admins can configure, enable, disable, and test connections. Operators/viewers can read safe status and metadata according to RBAC.

## Deployment

1. Create a Firebase project and configure Authentication, Firestore, rules, indexes, and an Admin SDK service account.
2. Deploy the repository to a standard Next.js host such as Vercel or a Node.js container.
3. Add all values from `.env.local.example` to the host's server and build-time environment settings. Keep Admin SDK and integration credentials server-only.
4. Run `npm run build`, deploy, then verify `GET /api/health` and sign up a test organization.

The app runs as a normal Next.js Node deployment; no additional infrastructure is required.
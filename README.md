# AI-Based Fake Job & Internship Scam Detection System

A web application that helps students check whether a job or internship offer is safe. The user pastes an offer (and, if wanted, the company name, job title, sender, salary and website). The system analyses the text, verifies the company, contact e-mail and website, and returns a **risk score (0-100)**, a **label** (Low Risk = Genuine, Needs Careful Checking = Suspicious, High Risk = Fraudulent), the **warning signs with the matching text**, and advice on what to do.

## What is implemented (and how it maps to the project presentation)

| Part of the project design | Implementation |
|---|---|
| React web app, job-details form, result dashboard | `src/` (React + Vite + Tailwind). Form fields: offer text, company, job title, sender, channel, **salary, website** |
| NLP processor (cleanText, tokenizeText, extractFeatures) | `server/preprocess.ts` |
| Fraud-indicator check, risk score, classification | `server/nlpRules.ts` (8 groups of rules; High / Medium / Low mapped to Fraudulent / Suspicious / Genuine) |
| Company verification (verifyCompany, verifyContact, checkWebsite) | `server/companyChecks.ts` (built-in checks) + `server/companyLookup.ts` (live domain-exists / domain-age checks) |
| AI / semantic analysis | `server/aiClassifier.ts`: optional Gemini AI. **Without a key the rule engine alone is used.** |
| Save result, view history | SQLite database (`data/scam_detection.db`) + browser storage; per-user history |
| Register / Login, Admin: monitor results, manage users, manage dataset | `server/auth.ts`, `server/api.ts`, `src/components/AuthModal.tsx`, `src/components/AdminView.tsx` |
| Backend API | Node.js + Express (`server.ts`) and Vercel functions (`api/`) sharing one implementation (`server/api.ts`) |

**Differences from the presentation (not implemented):** the presentation shows a *fine-tuned BERT model* and a *Python API*. This project uses a rule engine plus the Gemini API for the language-model part, and Node.js for the backend. A BERT model needs a labelled dataset and GPU training that are not part of this code base. The admin "Manage Dataset" page collects and exports labelled examples that can be used for that training later, and can already measure how well the current rules do on them.

## Run on your computer

1. Install Node.js 20 or newer.
2. In the project folder run: `npm install`
3. Copy `.env.example` to `.env.local` and set at least:
   - `AUTH_SECRET` (any long random text, 16+ characters)
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` (8+ characters): this creates the first administrator
   - `GEMINI_API_KEY` (optional, enables the AI layer)
4. Start: `npm run dev` (development) or `npm run build` then `npm start` (production mode, adds the strict security policy)
5. Open http://localhost:3000

Anyone can check an offer without signing in (history stays in their browser). Students who **Register** get a private history saved in their own account. The administrator signs in with the `ADMIN_EMAIL` account and opens the **Admin** tab.

## Test the project

```
npm run lint        # TypeScript check
npm test            # unit tests (rule engine and company verification): 83 tests
```
The API, browser (Playwright), Vercel-handler, performance, rate-limit, production-mode and restart tests are described in `tests/README.md`. Results of the last full run are in `tests/results/` and screenshots in `tests/evidence/`.

## Deploy (or redeploy) on Vercel

1. Push this corrected code to the Git repository connected to your Vercel project (or run `vercel --prod`).
2. In Vercel open **Project, Settings, Environment Variables** and add (for Production):
   - `AUTH_SECRET`: long random text (required, otherwise logins reset)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`: the first administrator
   - `GEMINI_API_KEY`: optional
3. Open **Deployments**, choose the latest one, **Redeploy**, and untick "Use existing Build Cache" (the dependencies changed).
4. Check it: open `https://<your-site>/api/system-status`. It should show `"status":"operational"` and `"environment":"vercel"`. Then run one check, register an account, and sign in as the administrator.

**Important limit of Vercel:** Vercel erases files between runs, so accounts and server-side history stored in the SQLite file are **temporary** on Vercel (the sign-in dialog says so). Checking offers works fully, and guest history in the browser is not affected. For permanent accounts on Vercel, connect a hosted database (for example Turso, Neon or Supabase) by replacing the storage functions in `server/db.ts`; for a viva or demo, running locally (`npm start`) keeps everything permanently.
The project uses 7 serverless functions (`api/*.ts`), within the free plan's limit of 12.

## API (summary)

| Address | Who | Purpose |
|---|---|---|
| `POST /api/analyze` | anyone | Check an offer (body: `text`, optional `companyName`, `jobTitle`, `senderInfo`, `channel`, `salary`, `website`) |
| `GET/POST/PATCH/DELETE /api/history` | signed-in user | Own saved checks (`?id=`, `?clearAll=true`, `?search=`, `?category=`) |
| `GET /api/export?format=csv|json` | signed-in user | Export own history |
| `GET /api/stats` | anyone | Statistics (own, or zeros for guests) |
| `POST /api/auth?action=register|login`, `GET /api/auth?action=me` | anyone | Accounts |
| `/api/admin?resource=overview|results|users|dataset|dataset-export|dataset-evaluate|label` | admin only | Monitor results, manage users and the dataset |
| `GET /api/system-status` | anyone | Health and feature status |

## Settings (`.env`)

| Name | Meaning |
|---|---|
| `AUTH_SECRET` | Signs login tokens (16+ characters). **Set it in production.** |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Creates the first administrator |
| `GEMINI_API_KEY` | Optional AI layer |
| `COMPANY_VERIFY_ONLINE` | `false` turns off the live domain checks (default on) |
| `RATE_LIMIT_PER_MIN` | Checks per minute per address (default 60) |
| `REGISTER_LIMIT_PER_HOUR` | New accounts per hour per address (default 10) |

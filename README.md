# BookLeaf Author Royalty Dashboard (MERN)

A MERN application for BookLeaf’s author royalty portal, admin operations view, and n8n royalty-summary workflow. The React UI reads from an Express API backed by MongoDB/Mongoose. The supplied source dataset is preserved in `data/Bookleaf Sample Data.json` and imported with the seed script.

## Requirements

- Node.js 18 or later
- MongoDB running locally or a MongoDB Atlas connection string

## Run in development

```sh
npm install
cp .env.example .env
```

Start MongoDB in a separate terminal. For a local database directory:

```sh
mkdir -p data/mongo-data
mongod --dbpath data/mongo-data
```

Then seed the supplied records and start the React and Express dev servers:

```sh
npm run seed
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` requests to the Express server on port 3000.

## Demo credentials

- Admin: `admin@bookleaf.demo` / `admin123`
- Authors: each dataset author’s email / `author123`

Set replacement demo credentials in `.env` before running `npm run seed`. Passwords are stored as bcrypt hashes in MongoDB.

## Production build

```sh
npm run build
NODE_ENV=production npm start
```

The Express server serves the built React app and API on port 3000. Configure `MONGODB_URI`, `JWT_SECRET`, and `APP_BASE_URL` in the deployment environment. Use HTTPS and a unique random JWT secret.

## Features

- Admin and author sign-in with HTTP-only JWT session cookies
- Author-only book and royalty data access
- Author overview, book-level royalty balances, platform availability, print partner, and payout status
- Admin author search, city and payout-status filters, detail view, notification history, and CSV export
- Single and bulk idempotent summary dispatch
- Callback-based success/failure logging for n8n executions
- Local demo summary mode when no n8n webhook is configured

## n8n AI workflow

Import `n8n/bookleaf-royalty-summary.workflow.json` into n8n. Configure these environment values in n8n:

- `BOOKLEAF_WEBHOOK_SECRET`: shared request token
- `OPENAI_API_KEY`: API key for royalty email generation
- `OPENAI_MODEL` (optional; defaults to `gpt-4o-mini`)

Set app-side `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `N8N_CALLBACK_SECRET`, and a publicly reachable `APP_BASE_URL` in `.env`. The app calls n8n with the ledger payload; n8n validates the shared secret, acknowledges the webhook, generates a personalized INR royalty summary, and calls the signed callback to update the MongoDB notification log. The callback is the assignment’s visible output path; the export does not send SMTP email.

Without `N8N_WEBHOOK_URL`, triggers create a deterministic local demo summary and clearly report that AI processing is not configured.

## Project structure

- `client/` — React application (Vite)
- `server/` — Express API, JWT auth, Mongoose models, and dataset seeder
- `data/Bookleaf Sample Data.json` — exact supplied JSON source
- `n8n/bookleaf-royalty-summary.workflow.json` — importable workflow export
- `docs/IMPLEMENTATION.md` — database, privacy, workflow, and assignment notes
- `design-reference/` — original supplied standalone HTML mockups; app functionality lives in the React client

## Assignment 2 submission status

This repository implements the requested product features in **MERN**, not Bubble. It is a useful working prototype and includes an n8n workflow export, but it is **not a complete Assignment 2 submission** until the Bubble-specific deliverables and live walkthrough are completed. The brief explicitly evaluates Bubble proficiency (25%), so a code-equivalent implementation is not a substitute for a Bubble app.

| Deliverable | In this repository | Remaining work |
|---|---|---|
| Author and admin portals, data model, login, privacy, royalty views | MERN implementation in `client/` and `server/` | Rebuild in Bubble and configure Bubble privacy rules |
| n8n workflow export | `n8n/bookleaf-royalty-summary.workflow.json` | Import, configure credentials/secrets, activate, and run a real callback against a reachable app |
| Schema/integration/prompt/error-handling documentation | `docs/IMPLEMENTATION.md` | Add Bubble schema/workflow notes as you build; document actual issues and learning |
| Bubble app access and test accounts | Not included | Share editor access and live URL plus one author and one admin test login |
| Screen recording (3–5 minutes) | Not included | Record both portals, one summary trigger, and the executing n8n workflow |

Use [docs/SUBMISSION-CHECKLIST.md](docs/SUBMISSION-CHECKLIST.md) for the remaining account-based steps and recording outline. Do not submit the demo passwords shown above as production credentials.

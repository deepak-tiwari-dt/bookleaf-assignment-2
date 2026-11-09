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

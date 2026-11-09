# BookLeaf MERN implementation notes

## Requirement mapping

| Requirement | MERN implementation |
|---|---|
| Relational author, book, and royalty data | Mongoose `Author`, `Book`, `User`, and `NotificationLog` models. A book has an ObjectId reference to its author and stable source IDs. Monetary amounts are INR. |
| Dataset import | `npm run seed` reads the supplied JSON and upserts all 10 authors, 18 books, and demo User accounts. Original input is retained at `data/Bookleaf Sample Data.json`. |
| Author login/private data | bcrypt password hashes and an HTTP-only signed JWT cookie. `/api/author/me` derives the author from the authenticated session; author log queries are scoped by `authorId`. |
| Author book and royalty view | React shows title, ISBN, genre, production/publication status, publication date, MRP, per-copy royalty, platform list, print partner, sold units, earned, paid, pending, payout date, and settlement indicator. |
| Royalty status indicator | Green for a zero balance; yellow for a pending balance within 90 days of the last payout (or publication if no payout); red if an outstanding balance exceeds 90 days. In-production titles show their production stage. |
| Admin overview | Express admin-only API supports author name/email search, city and payment-status filters, detailed author/book figures, CSV export, single summary requests, and bulk requests for authors with pending royalties. |
| Notification log | MongoDB stores each request, status, AI summary/error, trigger source, and timestamps. The UI polls for callback changes; authors see their own logs and admins see all logs. |
| Idempotency/error handling | A unique per-author 15-minute dispatch key prevents concurrent duplicate requests in the same time slot. n8n connection failures are logged immediately. Queued requests with no callback are marked failed after five minutes when logs or author details are next loaded. |
| n8n | `n8n/bookleaf-royalty-summary.workflow.json` validates a shared secret, responds to the webhook, requests an AI-generated email body, and posts a signed success/failure callback. The local fallback is labeled as demo output, not AI. |

## MongoDB data model

### Author

`authorId` (unique source ID), `name`, `email`, `phone`, `city`, `country`, `joinedDate`, and `verified`.

### Book

`bookId` (unique source ID), `author` (ObjectId reference), `authorId` (stable source ID), `title`, `isbn`, `genre`, `status`, `publishedAt`, `mrp`, `royaltyPerCopy`, `platforms`, `printPartner`, `copiesSold`, `earned`, `paid`, `pending`, and `lastPayout`.

### User

`email`, bcrypt `passwordHash`, `role` (`admin` or `author`), and optional `author` reference. No plaintext password is stored.

### NotificationLog

Unique `requestId`, `author` reference, stable `authorId`, `authorName`, `status`, `summary`, `error`, `source`, and Mongoose timestamps plus `finishedAt`.

The seed script upserts records using source IDs so it can be re-run without duplicating records. It does not delete records absent from the source file.

## API privacy

- `GET /api/author/me` uses the JWT's author ID and cannot accept an alternate author identifier.
- `GET /api/logs` filters to the current author's logs unless the caller is an admin.
- `GET /api/authors`, `GET /api/authors/:authorId`, `GET /api/authors.csv`, and bulk summary dispatch require the admin role.
- The n8n callback is not session-authenticated; it requires a separate `X-Callback-Token` and updates only the notification identified by its request ID.
- Login cookies are HttpOnly, SameSite=Lax, and Secure in production. Set `JWT_SECRET` to a random secret and serve over HTTPS in deployment.

## n8n integration

1. Admin creates a notification entry in `queued` status and the app sends its request ID, author profile, books, ledger totals, and callback URL to n8n.
2. n8n validates `X-BookLeaf-Token` against `BOOKLEAF_WEBHOOK_SECRET` and checks required payload fields. The complete ledger payload is sent so the workflow does not need a broad Bubble API credential.
3. The OpenAI prompt requests a personalized greeting, per-book sales/royalties, earned/paid/pending totals, quarterly schedule and 45-day window where relevant, fully paid acknowledgement, production title status, and warm closing. It directs the model to use only supplied facts and format values as INR.
4. n8n sends the summary or failure to `POST /api/n8n/callback` with `X-Callback-Token`. Express verifies the callback secret and updates the MongoDB log.
5. No SMTP node is configured; the summary returned through the callback is visible in both the admin and author notification log.

For n8n to reach the app, set `APP_BASE_URL` to an address reachable from the n8n runtime. Local n8n deployments may require a trusted tunnel. Activate the imported workflow only after setting webhook and OpenAI secrets.

## Bubble brief note

The assignment requests a Bubble app. This project implements the same feature set in MERN because the workspace has no Bubble account/editor access. The provided HTMLs remain under `design-reference/`. Bubble editor/live URLs and the requested walkthrough recording must be produced in account-owned services separately.

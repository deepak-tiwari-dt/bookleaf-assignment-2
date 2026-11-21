# Assignment 2: remaining submission work

The [submission deliverables table](../README.md#assignment-2-submission-deliverables) tracks the live URL, both test logins, the workflow export, and the recording in one place.

The repository contains a MERN implementation of the feature set. The brief requires the application itself to be built in Bubble, so the following work must happen in the candidate's Bubble and n8n accounts. This checklist is deliberately separate from the MERN demo: the current Express callback updates MongoDB, not Bubble.

## 1. Build the Bubble application

1. Create data types for `Author`, `Book`, `User` (or Bubble's built-in User with a role), and `NotificationLog`.
2. Import [authors.csv](../data/bubble/authors.csv) and [books.csv](../data/bubble/books.csv), prepared from `data/Bookleaf Sample Data.json`. Upload authors first, then books. Keep `author_id` and `book_id` as text fields and add an `author` field of type Author on Book. Populate that relation by matching each Book's `author_id` to the Author's `author_id`. The `available_on` column is comma-separated display text.
3. Add author and admin roles. Set Bubble privacy rules so authors can search/read only their own Author, Book, and NotificationLog records; admins can access all records. Verify these rules while logged in as two different authors.
4. Build the author page with login, book details, per-book and aggregate earned/paid/pending figures, copies sold, payout date, and green/yellow/red status. Treat in-production books separately from published-book payout status.
5. Build the admin page with author search, city and payout-status filters, author details, a single-author summary action, a bulk action for authors with pending royalties, and a notification log.
6. Make pending, queued, success, and failure visible in the UI. Show a useful error if the webhook request fails; do not leave the trigger in a loading state.

The MERN prototype and its field mapping are documented in [IMPLEMENTATION.md](IMPLEMENTATION.md); use it as a reference, not as evidence that Bubble has been completed.

## 2. Connect Bubble and n8n

1. Import the [Bubble workflow JSON template](../n8n/bookleaf-bubble-royalty-summary.workflow.json). In n8n, assign a Header Auth credential with the header `X-BookLeaf-Token` to the webhook and a separate Header Auth credential with `Authorization: Bearer <OpenAI API key>` to the OpenAI node.
2. In the two callback nodes, replace the example URL with your Bubble `royalty_summary_callback` endpoint. Assign a Bubble Header Auth credential with `Authorization: Bearer <Bubble API token>` to both nodes. The Bubble backend workflow should require admin API token authentication, accept `logId`, `status`, `summary`, and `error`, and update the matching queued log with the result and completion timestamp. Use the Bubble development endpoint during testing and switch to the live endpoint before the final verification.
3. From Bubble, create a notification record first, then call the active n8n webhook with `logId`, `author` containing `id` and `name`, a `books` array, and `totals` containing the royalty ledger figures.
4. Protect the webhook with a shared secret or API key header. Do not put a reusable admin API credential or an OpenAI key in page-visible/client-side data.
5. Test a successful run, an AI/API failure, a bad webhook secret, and a duplicate click. Confirm each run reaches the right Bubble log and that authors cannot read another author's logs.
6. Export the final configured workflow as JSON for submission. Do not include live secrets in the exported file.

The assignment accepts either sending an actual email (bonus) or returning the generated email content to the app and recording it in the notification log. The existing sample workflow uses the latter pattern.

## 3. Prepare access and recording

- Share Bubble editor access with the email supplied by the evaluators.
- Provide the live Bubble URL plus working test credentials for one author and one admin. Use non-production demo accounts.
- Provide n8n workspace view access if using n8n Cloud, as requested in the brief.
- Record a 3–5 minute walkthrough showing: author login and private data; admin search/filter and detail; one summary trigger; the generated summary and updated log; and the corresponding n8n execution. Keep the credentials and API keys out of the recording.
- Include the Bubble schema, privacy rules, Bubble↔n8n data flow, prompt strategy, error handling, and learning/challenges in the submission documentation.

## 4. Suggested recording outline

1. **0:00–0:45:** Sign in as an author; show books, totals, status badges, and the author's notification log.
2. **0:45–1:30:** Sign in as admin; search/filter authors and open an author detail view.
3. **1:30–2:30:** Trigger a royalty summary; show the generated output and success/failure status in Bubble.
4. **2:30–3:30:** Show the matching n8n execution, including webhook input, AI step, and Bubble callback.
5. **3:30–4:00:** Briefly show the Bubble data types/privacy rules and describe one error-handling or idempotency choice.

## Completion gate

Before submitting, confirm the Bubble app is reachable by the evaluator, both test accounts work, cross-author access is denied, the n8n workflow is active and exported, a real callback updates Bubble, and the recording link is accessible. None of those external account states can be verified from this local repository alone.

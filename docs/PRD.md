# FlatFlow Product Requirements

## Product

FlatFlow is a single-society maintenance management application for residents and society administrators. It will centralize maintenance bills, payment records, receipts, and billing disputes.

## Scope and stack

- One housing society; resident and admin roles.
- React and Vite frontend; Node.js and Express API; MongoDB with Mongoose.
- JWT sessions in HttpOnly cookies. Payment gateway integration is planned for test mode.
- Detailed visual styling is deferred until the functional workflows are established.

## Status

| Area | Status | Notes |
|---|---|---|
| React frontend and Express/MongoDB foundation | Implemented and locally tested | Frontend production build passes; API health endpoint reports MongoDB connected. |
| Authentication | Implemented and locally tested | Login, logout, current-user endpoint, password hashing, HttpOnly cookie, login rate limit, and role middleware. |
| User and flat data models | Implemented | User roles are resident/admin; public self-registration is not provided. |
| Admin account setup | Implemented | An explicit CLI bootstrap creates the first admin from local environment variables. |
| Resident/flat administration | Implemented and locally tested | Admin-only APIs and the admin screen add flats and create residents assigned to a flat. Duplicate flats and email addresses are rejected; resident access to admin APIs is denied. |
| Maintenance billing and search | Implemented and locally tested | Admins generate monthly bills for active flats; unique flat/period indexing makes generation safe to rerun. Residents only see their assigned flat's bills. Admin and resident views support validated filters and pagination. |
| Verified payments and receipts | Implemented, awaiting Razorpay test credentials | Server-side Razorpay orders, signed callback verification, captured-payment lookup, idempotent webhook settlement, resident payment history/receipts, and admin reconciliation listing are implemented. The full provider checkout has not been tested until valid test keys and webhook configuration are supplied. |
| Bill disputes | Implemented and locally tested | Residents can dispute bills assigned to their flat and track review outcomes; admins can review, respond, resolve, or reject disputes. One open dispute is allowed per bill. |
| In-app notifications | Implemented and locally tested | Authenticated users receive payment confirmations and resident dispute updates in a private inbox with unread count and read controls. |
| Collection analytics | Implemented and locally tested | Admins can view bill-derived billed, collected, outstanding, and overdue totals with monthly breakdowns over a validated range of up to 24 months. |
| Render deployment preparation, README, and demo guide | Prepared, not deployed | A single-origin Render Blueprint, production static serving, setup guide, and presenter walkthrough are ready. Live hosting still requires account setup, MongoDB network access, and deployment. |

## Authentication API

- `POST /api/auth/login` accepts an email and password; success returns a public user profile and sets the session cookie.
- `POST /api/auth/logout` clears the session cookie.
- `GET /api/auth/me` returns the authenticated user; missing, invalid, expired, inactive, or deleted sessions are rejected.
- `requireAuth` and `requireRole` middleware are intended for protected API routes.
- Administrator registration is not public. The initial admin is created with `npm run create-admin` after setting `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the local backend environment file.
- `GET /api/admin/flats` and `POST /api/admin/flats` list and create flats.
- `GET /api/admin/residents` lists resident accounts; optional `q` searches names/emails and optional `flatId` filters by assigned flat.
- `POST /api/admin/residents` creates a resident account with an initial password and active flat assignment. The initial password must be at least 12 characters and no more than 72 UTF-8 bytes.
- Every `/api/admin` endpoint requires an authenticated admin session.
- `POST /api/admin/bills/generate` accepts `billingPeriod` (`YYYY-MM`), `amount` (INR decimal string), `issueDate` and `dueDate` (`YYYY-MM-DD`). It creates one immutable-amount bill per active flat and reports existing bills as skipped without overwriting them.
- `GET /api/admin/bills` lists all society bills for admins; `GET /api/bills/my-bills` returns only the authenticated resident's flat bills.
- Bill list filters include `q`, `status` (`unpaid`, `overdue`, or `paid`), `billingPeriod`, `dueFrom`, `dueTo`, `minAmount`, `maxAmount`, `sort`, `order`, `page`, and `limit`. Search text is escaped and restricted to bill number, flat, wing, and (admin only) resident identity. Page size is capped at 100.
- Bill amounts are stored as integer paise. Overdue status is derived from the due date in the society's Asia/Kolkata calendar; it is not separately stored.
- `POST /api/payments/create-order` is resident-only and creates a Razorpay order using the stored bill amount; the amount submitted by the browser is never trusted.
- `POST /api/payments/verify` checks the Razorpay checkout HMAC, fetches the payment from Razorpay, and accepts only captured payments matching the stored order amount/currency. Bill/payment updates use a MongoDB transaction. Repeated verification is idempotent; an additional captured payment for an already-paid bill is recorded for admin reconciliation.
- `POST /api/payments/webhook` validates Razorpay's HMAC against the exact raw request body and processes `payment.captured` events idempotently.
- `GET /api/payments/my-payments` lists the authenticated resident's attempts; `GET /api/payments/:paymentId/receipt` serves a printable receipt only for a verified payment owned by that resident.
- `GET /api/admin/payments` lists payment records for admins and supports status filters (`pending`, `verified`, `reconciliation_required`) plus a limit capped at 100.
- `POST /api/bills/disputes` lets a resident dispute a bill assigned to their flat with a category, subject, and description. Only one open or under-review dispute may exist per bill.
- `GET /api/bills/my-disputes` returns the authenticated resident's disputes and admin responses.
- `GET /api/admin/disputes` lists disputes for admins and accepts an optional status filter (`open`, `under_review`, `resolved`, `rejected`) and a limit capped at 100.
- `PATCH /api/admin/disputes/:disputeId` lets an admin move an open dispute to review or closure; a response is required to resolve or reject it. Closed disputes cannot be reopened.
- `GET /api/notifications` returns the authenticated user's latest notifications and unread count; limit is capped at 50.
- `PATCH /api/notifications/:notificationId/read` and `PATCH /api/notifications/read-all` mark only the authenticated user's notifications as read.
- `GET /api/admin/analytics/collections` returns bill-count and paise totals for billed, collected, outstanding, and overdue amounts by billing month, plus range totals. Optional `from` and `to` use `YYYY-MM`; the range defaults to the latest 12 months and is capped at 24 months. Collected value is based on bills whose status is `paid`.
- Payment configuration is server-only: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in the private backend environment file. Only the public key ID is returned to the frontend for checkout.

## Current limitations and next work

- Resident accounts and flats can be administered by an admin; resident self-registration remains disabled.
- The frontend currently provides basic sign-in, flat/resident management, bill generation and views, collection analytics, Razorpay checkout initiation, payment history, receipts, an admin reconciliation list, resident/admin dispute workflows, and an in-app notification inbox.
- Razorpay test checkout remains unverified until valid test credentials and a webhook secret are configured.
- A live deployment and end-to-end Razorpay test checkout have not yet been performed. The hosting configuration and project documentation are prepared.
- Next: deploy the Render Blueprint with private database settings, then verify the hosted app; configure Razorpay test credentials only if a real test-mode checkout demo is needed.

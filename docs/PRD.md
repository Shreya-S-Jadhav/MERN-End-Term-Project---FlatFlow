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
| Verified payments and receipts | Planned | Razorpay test mode, subject to account availability. |
| Disputes, notifications, and analytics | Planned | |
| Deployment, full README, and demo | Planned | |

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

## Current limitations and next work

- Resident accounts and flats can be administered by an admin; resident self-registration remains disabled.
- The frontend currently provides basic sign-in, flat/resident management, bill generation, and bill views.
- Payments, disputes, notifications, reporting, and deployment are not complete.
- Next: implement verified test payments and receipts, then disputes and data-derived reports.

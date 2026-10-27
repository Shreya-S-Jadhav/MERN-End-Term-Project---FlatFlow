# FlatFlow

FlatFlow is a MERN application for a single housing society. Residents can review bills, make verified Razorpay payments, download receipts, raise bill disputes, and receive in-app notifications. Administrators can manage flats and resident accounts, generate bills, review payments and disputes, and view collection analytics.

## Features

- Resident and administrator sign-in with hashed passwords and HTTP-only session cookies.
- Administrator-managed flats and resident accounts; public registration is disabled.
- Monthly maintenance bills with duplicate-safe generation, search, filters, and pagination.
- Razorpay order creation, captured-payment verification, signed webhooks, payment history, and receipts.
- Resident bill disputes with administrator review, responses, and resolution.
- Recipient-private in-app payment and dispute notifications.
- Administrator collection totals and monthly billed, collected, outstanding, and overdue summaries.

## Technology

- React 19 and Vite
- Node.js, Express 5, and Mongoose
- MongoDB
- Razorpay Node SDK

## Requirements

- Node.js 20 or newer and npm.
- A MongoDB database. MongoDB Atlas is suitable for local development and Render deployment.
- Razorpay test credentials only if you want to test the hosted checkout. They are not required to run the rest of the app.

## Run locally

1. Configure the backend environment:

   ```powershell
   cd backend
   Copy-Item .env.example .env
   notepad .env
   ```

   Set `MONGODB_URI` to your database connection string and `JWT_SECRET` to a new random value with at least 32 characters. Keep `.env` local; it is ignored by Git. Leave the Razorpay variables empty until test credentials are available.

2. Install backend dependencies and create the first administrator:

   ```powershell
   npm ci
   ```

   Set `ADMIN_NAME`, `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD` in your local `backend/.env`. The password must be at least 12 characters and no more than 72 UTF-8 bytes. Then run:

   ```powershell
   npm run create-admin
   npm run dev
   ```

   Keep this terminal open. The API listens on `http://localhost:5000`; its health endpoint is `http://localhost:5000/api/health`.

3. In a second terminal, install and start the frontend:

   ```powershell
   cd client
   npm ci
   npm run dev
   ```

   Open the Vite URL printed in the terminal (normally `http://localhost:5173`). In development, the UI calls the API on `http://localhost:5000`. For another API URL, set `VITE_API_URL` in the client build environment.

4. Sign in with the administrator account you created. Add flats and resident accounts, then generate bills for a billing period.

## Test and build

From `backend`:

```powershell
npm test
npm audit --omit=dev
```

From `client`:

```powershell
npm run build
```

The backend tests cover authentication and role checks, payment and webhook signatures, dispute validation and status transitions, and analytics range/summary calculations. MongoDB-backed integration scenarios are described in [docs/DEMO.md](docs/DEMO.md); use temporary test records and remove them after testing.

## Deploy to Render

The repository includes [render.yaml](render.yaml), which defines a single Node web service. It builds the React app and serves the built UI and API from the same HTTPS origin. This keeps session cookies first-party and avoids a separate frontend/API CORS setup.

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint**, select this GitHub repository, and review the `flatflow` service before applying it.
3. Supply `MONGODB_URI` as a secret environment variable. Render generates `JWT_SECRET`; keep it private and do not replace it with a weak value. The service uses Render's `PORT` automatically.
4. Ensure MongoDB Atlas permits connections from the deployed Render service. Restrict network access as appropriate for your Atlas configuration; do not expose credentials in Git, logs, screenshots, or chat.
5. Wait for the build and deploy to finish. Check `https://<your-render-host>/api/health`; a healthy deployment responds with `{"status":"ok","database":"connected"}`.
6. Create the initial admin from a trusted local machine by setting `MONGODB_URI`, `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the ignored `backend/.env`, then running `npm run create-admin` from `backend`. Confirm that this command targets the intended database. It refuses to overwrite an existing account.
7. Test admin and resident sign-in, bill generation, notification privacy, disputes, and reports over HTTPS.

The free Render plan may spin down when idle, which can make the first request slow. Choose a paid plan only if you need always-on service. Render hosting and MongoDB Atlas accounts are external services; this repository does not create accounts or publish a deployment on your behalf.

### Optional Razorpay test checkout

Real gateway checkout is not yet verified. To test it:

1. Create Razorpay **test-mode** API keys and a webhook secret in your own Razorpay account.
2. Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` to Render's private environment settings. Never use live keys for the demo.
3. Configure the Razorpay test webhook URL as `https://<your-render-host>/api/payments/webhook` and subscribe to `payment.captured` and `payment.failed`. The configured secret must match the service environment variable.
4. Redeploy if necessary, create an unpaid bill, and use Razorpay's documented test payment details. Verify the bill status, payment history, receipt, and notification in the app.

The public key ID is used by the browser checkout; the secret key and webhook secret must remain server-only. Until this real test-mode flow is performed, treat checkout as implemented but not end-to-end verified.

## Project layout

```text
backend/
  scripts/       # First administrator bootstrap
  src/
    controllers/ # API handlers, validation, and reports
    middleware/  # Authentication and role checks
    models/      # Mongoose models
    routes/      # API routes
    services/    # Razorpay and notification helpers
  test/          # Backend unit tests
client/
  src/           # React screens and shared API configuration
docs/
  DEMO.md        # Presenter walkthrough and verification checklist
  PRD.md         # Scope, features, and API contract
render.yaml      # Render Blueprint for the single-origin web service
```

## Important limitations

- Razorpay checkout requires test credentials and a successful test-mode gateway run before it can be called end-to-end verified.
- Email, SMS, push notifications, and scheduled automatic billing are not implemented. Notifications are in-app and created for verified payments and administrator dispute updates.
- The app is designed for one society and has no public resident registration or self-service password reset.
- Do not use real resident or payment data in a demo environment.

See [docs/PRD.md](docs/PRD.md) for API details and [docs/DEMO.md](docs/DEMO.md) for the demo flow.

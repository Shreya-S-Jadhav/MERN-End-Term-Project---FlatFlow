# FlatFlow demo walkthrough

This guided walkthrough demonstrates the resident and administrator workflows. Allow 8–12 minutes. Use a test database and fictional people; never present real resident details, credentials, or payment information.

## Prepare before presenting

1. Start the API and frontend using the local setup in [README.md](../README.md), or use the deployed Render URL.
2. Create an administrator and confirm the API health endpoint reports the database as connected.
3. Sign in as the admin. Add two fictional flats and create one resident for each flat using strong, temporary passwords.
4. Generate the current or a future billing period for both flats. Use a modest demo amount and a due date that permits showing unpaid and paid statuses.
5. For a full checkout demonstration, configure Razorpay test keys and the captured/failed webhooks as described in the README. If not configured, skip checkout and explicitly state that gateway end-to-end testing is pending.
6. Open a separate browser profile or private window for the resident account. Keep the admin session in the first window.

## Presenter flow

1. **Administrator and data setup:** Show the admin dashboard, the two flats and assigned residents, then the monthly bill generator. Apply a period/status filter to the generated bill list.
2. **Resident bill privacy:** Sign in as the first resident. Show that only their assigned flat's bills are visible. Explain that another resident cannot view or dispute these bills.
3. **Payment and notification:** If Razorpay test mode is configured, pay one demo bill using test payment details. Show the server-verified paid status, payment history, printable receipt, and payment notification. Do not mark a bill paid manually to imply the provider verified it.
4. **Bill dispute:** Submit a dispute on a demo bill with a category, short subject, and clear fictional details. Show the new open dispute in the resident's dispute list.
5. **Administrator review:** Return to the admin session, open resident disputes, move the dispute to “Under review,” and add a response. Resolve or reject it with a response.
6. **Resident follow-up:** Refresh the resident's in-app notifications and disputes. Show the admin response and mark the notification read.
7. **Collection analytics:** As admin, filter the collection report to include the demo billing period. Explain billed, collected, outstanding, and overdue values and that only verified bill settlement appears as collected.
8. **Security and scope:** Point out that residents are created by admins, sessions use HTTP-only cookies, receipts are only accessible to their owner, and notifications are recipient-private.

## Verification checklist

- [ ] Admin and resident accounts are fictional demo accounts.
- [ ] Resident A cannot view Resident B's bills or dispute them.
- [ ] Monthly bill generation does not duplicate bills when repeated for the same period.
- [ ] The dispute appears to its owner and administrators, with the final response visible to the resident.
- [ ] The notification inbox shows the right recipient's event and updates its unread count when read.
- [ ] Analytics totals agree with the demo bills' persisted paid/unpaid statuses.
- [ ] If checkout is demonstrated, Razorpay is in test mode and settlement is verified by the API/webhook.
- [ ] Temporary demo accounts and bills are removed from the demo database afterward.

## Common demo issues

- **API unavailable:** Check `http://localhost:5000/api/health` and confirm `MONGODB_URI` is set in the backend environment.
- **Resident sees no bills:** Confirm the resident is assigned to an active flat and bills were generated for that flat.
- **Checkout says credentials are missing:** Skip the gateway segment. Do not put secret keys in frontend variables; configure the server-only environment variables first.
- **Notification not immediate:** The inbox refreshes periodically; open the notification panel or wait up to 30 seconds for a refresh.
- **Analytics shows zeros:** Set the report period to match the billing period. Reports use generated bill data, not payment attempt counts.

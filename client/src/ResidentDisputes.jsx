import { useCallback, useEffect, useState } from "react";
import { apiBaseUrl } from "./api.js";
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

const categories = [
  ["incorrect_amount", "Incorrect amount"],
  ["payment_issue", "Payment issue"],
  ["bill_details", "Bill details"],
  ["other", "Other"],
];

function ResidentDisputes({ bills }) {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activeBillIds = new Set(
    disputes
      .filter((dispute) => dispute.status === "open" || dispute.status === "under_review")
      .map((dispute) => dispute.bill?.id)
      .filter(Boolean),
  );
  const availableBills = bills.filter((bill) => !activeBillIds.has(bill.id));

  const loadDisputes = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/bills/my-disputes`, { credentials: "include" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to load your disputes.");
      setDisputes(result.disputes);
    } catch (loadError) {
      setError(loadError.message || "Unable to load your disputes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/bills/disputes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId: values.get("billId"),
          category: values.get("category"),
          subject: values.get("subject"),
          description: values.get("description"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to submit your dispute.");
      form.reset();
      setNotice("Your dispute has been submitted for review.");
      await loadDisputes();
    } catch (submitError) {
      setError(submitError.message || "Unable to submit your dispute.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="resident-disputes-heading">
      <h3 id="resident-disputes-heading">Bill disputes</h3>
      <p>Submit one open dispute per bill. You can raise another after the current dispute is closed.</p>
      {loading ? (
        <p role="status">Loading your disputes...</p>
      ) : bills.length === 0 ? (
        <p>You need a bill before you can submit a dispute.</p>
      ) : availableBills.length === 0 ? (
        <p>All currently displayed bills already have an active dispute.</p>
      ) : (
        <form className="management-form" onSubmit={handleSubmit}>
          <label>
            Bill
            <select name="billId" required defaultValue="">
              <option value="" disabled>Select a bill</option>
              {availableBills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.billNumber} — {currency.format(bill.amountPaise / 100)} ({bill.status})
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select name="category" required defaultValue="incorrect_amount">
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Subject
            <input name="subject" minLength="3" maxLength="100" required />
          </label>
          <label>
            Details
            <textarea name="description" minLength="10" maxLength="2000" rows="5" required />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit dispute"}
          </button>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && disputes.length === 0 ? (
        <p>You have not submitted any disputes.</p>
      ) : !loading && (
        <ul>
          {disputes.map((dispute) => (
            <li key={dispute.id}>
              <strong>{dispute.subject}</strong> — {dispute.bill?.billNumber || "Bill unavailable"} ({dispute.status.replaceAll("_", " ")})
              <p>{dispute.description}</p>
              {dispute.adminResponse && <p><strong>Admin response:</strong> {dispute.adminResponse}</p>}
              <small>Submitted {new Date(dispute.createdAt).toLocaleString("en-IN")}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ResidentDisputes;

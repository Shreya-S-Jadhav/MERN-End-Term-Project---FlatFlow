import { useEffect, useState } from "react";
import { apiBaseUrl } from "./api.js";
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function AdminPaymentReview() {
  const [status, setStatus] = useState("reconciliation_required");
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const query = status ? `?status=${encodeURIComponent(status)}&limit=100` : "?limit=100";

    fetch(`${apiBaseUrl}/api/admin/payments${query}`, { credentials: "include" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Unable to load payment records.");
        if (active) setPayments(result.payments);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load payment records.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [status]);

  return (
    <section aria-labelledby="payment-review-heading">
      <h3 id="payment-review-heading">Payment records and reconciliation</h3>
      <label>
        Payment status
        <select value={status} onChange={(event) => {
          setLoading(true);
          setError("");
          setStatus(event.target.value);
        }}>
          <option value="reconciliation_required">Needs reconciliation</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="verified">Verified</option>
          <option value="">All statuses</option>
        </select>
      </label>
      {loading ? (
        <p role="status">Loading payment records...</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : payments.length === 0 ? (
        <p>No payment records match this status.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Bill</th>
                <th>Resident</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Gateway reference</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.bill?.billNumber || "Bill unavailable"}</td>
                  <td>{payment.resident ? `${payment.resident.name} (${payment.resident.email})` : "Resident unavailable"}</td>
                  <td>{currency.format(payment.amountPaise / 100)}</td>
                  <td>{payment.status.replaceAll("_", " ")}</td>
                  <td>{payment.gatewayPaymentId || payment.failure?.gatewayPaymentId || payment.gatewayOrderId}</td>
                  <td>{new Date(payment.createdAt).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default AdminPaymentReview;

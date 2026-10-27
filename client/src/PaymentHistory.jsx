import { useEffect, useState } from "react";
import { apiBaseUrl } from "./api.js";
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function PaymentHistory({ refreshVersion }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetch(`${apiBaseUrl}/api/payments/my-payments`, { credentials: "include" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Unable to load payment history.");
        if (active) setPayments(result.payments);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load payment history.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshVersion]);

  async function handleReceipt(paymentId) {
    const receiptWindow = window.open("", "_blank");
    if (!receiptWindow) {
      setError("Allow pop-ups to open the payment receipt.");
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/payments/${paymentId}/receipt`, {
        credentials: "include",
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Unable to open the receipt.");
      }

      const receiptUrl = URL.createObjectURL(new Blob([await response.text()], { type: "text/html" }));
      receiptWindow.location.href = receiptUrl;
      window.setTimeout(() => URL.revokeObjectURL(receiptUrl), 60_000);
      setError("");
    } catch (receiptError) {
      receiptWindow.close();
      setError(receiptError.message || "Unable to open the receipt.");
    }
  }

  return (
    <section aria-labelledby="payment-history-heading">
      <h3 id="payment-history-heading">Payment history</h3>
      {loading ? (
        <p role="status">Loading payment history...</p>
      ) : payments.length === 0 ? (
        <p>No payment attempts yet.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Bill</th>
                <th>Amount</th>
                <th>Started</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.bill?.billNumber || "Bill unavailable"}</td>
                  <td>{currency.format(payment.amountPaise / 100)}</td>
                  <td>{new Date(payment.createdAt).toLocaleString("en-IN")}</td>
                  <td>{payment.status.replaceAll("_", " ")}</td>
                  <td>
                    {payment.status === "verified" ? (
                      <button type="button" onClick={() => handleReceipt(payment.id)}>
                        View receipt
                      </button>
                    ) : payment.status === "reconciliation_required" ? (
                      "Admin review required"
                    ) : payment.status === "failed" ? (
                      payment.failure?.description || "Payment failed"
                    ) : (
                      "Not available"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export default PaymentHistory;

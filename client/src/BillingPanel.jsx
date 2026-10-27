import { useCallback, useEffect, useState } from "react";
import PaymentHistory from "./PaymentHistory.jsx";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const currentPeriod = today.slice(0, 7);
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
let razorpayScriptPromise;

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.dataset.flatflowRazorpay = "true";
      script.onload = () => resolve();
      script.onerror = () => {
        razorpayScriptPromise = null;
        reject(new Error("Unable to load the Razorpay checkout."));
      };
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
}

function BillingPanel({ role, user }) {
  const isAdmin = role === "admin";
  const [bills, setBills] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payingBillId, setPayingBillId] = useState("");
  const [paymentHistoryRefresh, setPaymentHistoryRefresh] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadBills = useCallback(async (filters = new URLSearchParams()) => {
    setError("");
    setLoading(true);
    try {
      const path = isAdmin ? "/api/admin/bills" : "/api/bills/my-bills";
      const query = filters.toString();
      const response = await fetch(`${apiBaseUrl}${path}${query ? `?${query}` : ""}`, {
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to load bills.");
      setBills(result.bills);
      setPagination(result.pagination);
    } catch (loadError) {
      setError(loadError.message || "Unable to load bills.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  async function handleGenerate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/bills/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingPeriod: values.get("billingPeriod"),
          amount: values.get("amount"),
          issueDate: values.get("issueDate"),
          dueDate: values.get("dueDate"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to generate bills.");
      setNotice(`Generated ${result.created} bill(s); skipped ${result.skipped} already-existing bill(s).`);
      await loadBills();
    } catch (generateError) {
      setError(generateError.message || "Unable to generate bills.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFilter(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const filters = new URLSearchParams();
    for (const key of ["q", "status", "billingPeriod", "dueFrom", "dueTo", "minAmount", "maxAmount", "sort", "order"]) {
      const value = values.get(key);
      if (value) filters.set(key, value);
    }
    loadBills(filters);
  }

  async function handlePayBill(bill) {
    setPayingBillId(bill.id);
    setError("");
    setNotice("");
    let checkoutOpened = false;

    try {
      const orderResponse = await fetch(`${apiBaseUrl}/api/payments/create-order`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId: bill.id }),
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.message || "Unable to start the payment.");

      await loadRazorpayCheckout();
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "FlatFlow",
        description: `Maintenance bill ${order.billNumber}`,
        order_id: order.orderId,
        prefill: { name: user?.name || "", email: user?.email || "" },
        theme: { color: "#2563eb" },
        handler: async (gatewayResult) => {
          try {
            const verifyResponse = await fetch(`${apiBaseUrl}/api/payments/verify`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(gatewayResult),
            });
            const result = await verifyResponse.json();
            if (!verifyResponse.ok && verifyResponse.status !== 202) {
              throw new Error(result.message || "Payment verification is still pending.");
            }
            setNotice(result.message);
            await loadBills();
            setPaymentHistoryRefresh((version) => version + 1);
          } catch (verificationError) {
            setError(
              `${verificationError.message || "Payment verification failed."} Your bill will remain unpaid until the server confirms the payment.`,
            );
            setPaymentHistoryRefresh((version) => version + 1);
          } finally {
            setPayingBillId("");
          }
        },
        modal: {
          ondismiss: () => {
            setNotice("Checkout closed. The bill remains unpaid until payment is verified.");
            setPaymentHistoryRefresh((version) => version + 1);
            setPayingBillId("");
          },
        },
      });

      checkout.on("payment.failed", () => {
        setNotice("The gateway reported a failed payment. The bill remains unpaid.");
        setPaymentHistoryRefresh((version) => version + 1);
        setPayingBillId("");
      });
      checkout.open();
      checkoutOpened = true;
    } catch (paymentError) {
      setError(paymentError.message || "Unable to start the payment.");
    } finally {
      if (!checkoutOpened) setPayingBillId("");
    }
  }

  return (
    <section aria-labelledby="bills-heading">
      <h2 id="bills-heading">{isAdmin ? "Maintenance bills" : "My maintenance bills"}</h2>
      {isAdmin && (
        <section aria-labelledby="generate-bills-heading">
          <h3 id="generate-bills-heading">Generate monthly bills</h3>
          <p>Creates one bill for each active flat. Existing bills for the selected period are left unchanged.</p>
          <form className="management-form" onSubmit={handleGenerate}>
            <label>
              Billing period
              <input name="billingPeriod" type="month" defaultValue={currentPeriod} required />
            </label>
            <label>
              Amount per flat (INR)
              <input name="amount" type="number" min="0.01" max="99999999.99" step="0.01" required />
            </label>
            <label>
              Issue date
              <input name="issueDate" type="date" defaultValue={today} required />
            </label>
            <label>
              Due date
              <input name="dueDate" type="date" required />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? "Generating..." : "Generate bills"}
            </button>
          </form>
        </section>
      )}

      <form className="management-form" onSubmit={handleFilter}>
        {isAdmin && (
          <label>
            Search bill, flat, or resident
            <input name="q" maxLength="100" />
          </label>
        )}
        <label>
          Status
          <select name="status" defaultValue="">
            <option value="">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        <label>
          Billing period
          <input name="billingPeriod" type="month" />
        </label>
        <label>
          Due date from
          <input name="dueFrom" type="date" />
        </label>
        <label>
          Due date to
          <input name="dueTo" type="date" />
        </label>
        <label>
          Minimum amount (INR)
          <input name="minAmount" type="number" min="0" step="0.01" />
        </label>
        <label>
          Maximum amount (INR)
          <input name="maxAmount" type="number" min="0" step="0.01" />
        </label>
        <label>
          Sort by
          <select name="sort" defaultValue="dueDate">
            <option value="dueDate">Due date</option>
            <option value="billingPeriod">Billing period</option>
            <option value="amountPaise">Amount</option>
          </select>
        </label>
        <label>
          Order
          <select name="order" defaultValue="asc">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
        <button type="submit">Apply filters</button>
      </form>

      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading bills...</p>
      ) : bills.length === 0 ? (
        <p>No bills match these filters.</p>
      ) : (
        <>
          <p>{pagination?.total} bill(s)</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Bill number</th>
                  {isAdmin && <th>Flat / resident</th>}
                  <th>Period</th>
                  <th>Amount</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id}>
                    <td>{bill.billNumber}</td>
                    {isAdmin && (
                      <td>
                        {bill.flat ? `${bill.flat.wing ? `${bill.flat.wing} ` : ""}${bill.flat.flatNumber}` : "Flat unavailable"}
                        {bill.flat?.residents?.length > 0 && ` — ${bill.flat.residents.join(", ")}`}
                      </td>
                    )}
                    <td>{bill.billingPeriod}</td>
                    <td>{currency.format(bill.amountPaise / 100)}</td>
                    <td>{bill.issueDate}</td>
                    <td>{bill.dueDate}</td>
                    <td>
                      {bill.status}
                      {!isAdmin && bill.status !== "paid" && (
                        <button
                          type="button"
                          disabled={payingBillId === bill.id}
                          onClick={() => handlePayBill(bill)}
                        >
                          {payingBillId === bill.id ? "Starting..." : "Pay now"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!isAdmin && <PaymentHistory refreshVersion={paymentHistoryRefresh} />}
    </section>
  );
}

export default BillingPanel;

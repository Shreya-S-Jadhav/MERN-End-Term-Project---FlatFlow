import { useCallback, useEffect, useState } from "react";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const currentPeriod = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
}).format(new Date());

function previousPeriod(period, monthsBack) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 - monthsBack, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatAmount(amountPaise) {
  return currency.format(amountPaise / 100);
}

function CollectionAnalytics() {
  const [from, setFrom] = useState(() => previousPeriod(currentPeriod, 11));
  const [to, setTo] = useState(currentPeriod);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async (start = from, end = to) => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ from: start, to: end });
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/analytics/collections?${query}`, {
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to load collection analytics.");
      setReport(result);
    } catch (loadError) {
      setError(loadError.message || "Unable to load collection analytics.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  function handleFilter(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const start = values.get("from");
    const end = values.get("to");
    setFrom(start);
    setTo(end);
    loadReport(start, end);
  }

  return (
    <section aria-labelledby="collection-analytics-heading">
      <h3 id="collection-analytics-heading">Collection analytics</h3>
      <p>Totals are based on generated bills. Collected amounts include only bills marked paid; outstanding includes unpaid bills.</p>
      <form className="management-form" onSubmit={handleFilter}>
        <label>
          From billing period
          <input name="from" type="month" value={from} max={to} onChange={(event) => setFrom(event.target.value)} required />
        </label>
        <label>
          To billing period
          <input name="to" type="month" value={to} min={from} onChange={(event) => setTo(event.target.value)} required />
        </label>
        <button type="submit" disabled={loading}>Apply range</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading collection analytics...</p>
      ) : report && (
        <>
          <p>Billing periods {report.range.from} through {report.range.to}</p>
          <dl className="analytics-summary">
            <div><dt>Bills generated</dt><dd>{report.totals.billCount}</dd></div>
            <div><dt>Total billed</dt><dd>{formatAmount(report.totals.billedPaise)}</dd></div>
            <div><dt>Collected</dt><dd>{formatAmount(report.totals.collectedPaise)} ({report.totals.paidBillCount} bills)</dd></div>
            <div><dt>Outstanding</dt><dd>{formatAmount(report.totals.outstandingPaise)} ({report.totals.unpaidBillCount} bills)</dd></div>
            <div><dt>Overdue</dt><dd>{formatAmount(report.totals.overduePaise)} ({report.totals.overdueBillCount} bills)</dd></div>
          </dl>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Billing period</th>
                  <th>Bills</th>
                  <th>Billed</th>
                  <th>Collected</th>
                  <th>Outstanding</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {report.monthly.map((month) => (
                  <tr key={month.billingPeriod}>
                    <td>{month.billingPeriod}</td>
                    <td>{month.billCount} ({month.paidBillCount} paid)</td>
                    <td>{formatAmount(month.billedPaise)}</td>
                    <td>{formatAmount(month.collectedPaise)}</td>
                    <td>{formatAmount(month.outstandingPaise)}</td>
                    <td>{formatAmount(month.overduePaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default CollectionAnalytics;

import { useCallback, useEffect, useState } from "react";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function AdminDisputeReview() {
  const [status, setStatus] = useState("open");
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDisputes = useCallback(async () => {
    setError("");
    setLoading(true);
    const query = new URLSearchParams({ limit: "100" });
    if (status) query.set("status", status);

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/disputes?${query}`, { credentials: "include" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to load disputes.");
      setDisputes(result.disputes);
    } catch (loadError) {
      setError(loadError.message || "Unable to load disputes.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  async function handleUpdate(event, dispute) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setSavingId(dispute.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/disputes/${dispute.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: values.get("status"),
          adminResponse: values.get("adminResponse"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to update the dispute.");
      setNotice(`Updated dispute for ${result.dispute.bill?.billNumber || "the selected bill"}.`);
      await loadDisputes();
    } catch (updateError) {
      setError(updateError.message || "Unable to update the dispute.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section aria-labelledby="admin-disputes-heading">
      <h3 id="admin-disputes-heading">Resident bill disputes</h3>
      <label>
        Dispute status
        <select value={status} onChange={(event) => {
          setStatus(event.target.value);
          setNotice("");
        }}>
          <option value="open">Open</option>
          <option value="under_review">Under review</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
          <option value="">All statuses</option>
        </select>
      </label>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading disputes...</p>
      ) : error ? (
        <p>Dispute records are unavailable until the request succeeds.</p>
      ) : disputes.length === 0 ? (
        <p>No disputes match this status.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Bill / flat</th>
                <th>Resident</th>
                <th>Issue</th>
                <th>Submitted</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((dispute) => {
                const closed = ["resolved", "rejected"].includes(dispute.status);
                return (
                  <tr key={dispute.id}>
                    <td>
                      {dispute.bill?.billNumber || "Bill unavailable"}
                      {dispute.bill?.flat && <><br />{dispute.bill.flat.wing ? `${dispute.bill.flat.wing} ` : ""}{dispute.bill.flat.flatNumber}</>}
                      {dispute.bill && <><br />{currency.format(dispute.bill.amountPaise / 100)}</>}
                    </td>
                    <td>{dispute.resident ? `${dispute.resident.name} (${dispute.resident.email})` : "Resident unavailable"}</td>
                    <td>
                      <strong>{dispute.subject}</strong> ({dispute.category.replaceAll("_", " ")})
                      <p>{dispute.description}</p>
                    </td>
                    <td>{new Date(dispute.createdAt).toLocaleString("en-IN")}</td>
                    <td>
                      {closed ? (
                        <>
                          <strong>{dispute.status}</strong>
                          <p>{dispute.adminResponse}</p>
                        </>
                      ) : (
                        <form onSubmit={(event) => handleUpdate(event, dispute)}>
                          <label>
                            Status
                            <select name="status" defaultValue={dispute.status === "open" ? "under_review" : "resolved"}>
                              {dispute.status === "open" && <option value="under_review">Under review</option>}
                              <option value="resolved">Resolved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </label>
                          <label>
                            Response (required to close)
                            <textarea name="adminResponse" minLength="3" maxLength="2000" rows="3" defaultValue={dispute.adminResponse} />
                          </label>
                          <button type="submit" disabled={savingId === dispute.id}>
                            {savingId === dispute.id ? "Saving..." : "Save review"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default AdminDisputeReview;

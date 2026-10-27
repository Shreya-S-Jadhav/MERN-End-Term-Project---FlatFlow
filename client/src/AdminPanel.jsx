import { useCallback, useEffect, useState } from "react";
import AdminDisputeReview from "./AdminDisputeReview.jsx";
import AdminPaymentReview from "./AdminPaymentReview.jsx";
import BillingPanel from "./BillingPanel.jsx";
import CollectionAnalytics from "./CollectionAnalytics.jsx";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function adminRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "The request could not be completed.");
  }

  return result;
}

function AdminPanel() {
  const [flats, setFlats] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingFlat, setSubmittingFlat] = useState(false);
  const [submittingResident, setSubmittingResident] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadManagementData = useCallback(async () => {
    setError("");
    try {
      const [flatResult, residentResult] = await Promise.all([
        adminRequest("/api/admin/flats"),
        adminRequest("/api/admin/residents"),
      ]);
      setFlats(flatResult.flats);
      setResidents(residentResult.residents);
    } catch (loadError) {
      setError(loadError.message || "Unable to load flats and residents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadManagementData();
  }, [loadManagementData]);

  async function handleCreateFlat(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmittingFlat(true);
    setError("");
    setNotice("");

    try {
      await adminRequest("/api/admin/flats", {
        method: "POST",
        body: JSON.stringify({
          flatNumber: formData.get("flatNumber"),
          wing: formData.get("wing"),
        }),
      });
      form.reset();
      setNotice("Flat added.");
      await loadManagementData();
    } catch (createError) {
      setError(createError.message || "Unable to add flat.");
    } finally {
      setSubmittingFlat(false);
    }
  }

  async function handleCreateResident(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmittingResident(true);
    setError("");
    setNotice("");

    try {
      await adminRequest("/api/admin/residents", {
        method: "POST",
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password"),
          flatId: formData.get("flatId"),
        }),
      });
      form.reset();
      setNotice("Resident account created and assigned to the selected flat.");
      await loadManagementData();
    } catch (createError) {
      setError(createError.message || "Unable to create resident.");
    } finally {
      setSubmittingResident(false);
    }
  }

  return (
    <section aria-labelledby="admin-heading">
      <h2 id="admin-heading">Society administration</h2>
      {loading ? (
        <p role="status">Loading flats and residents...</p>
      ) : (
        <>
          <section aria-labelledby="flats-heading">
            <h3 id="flats-heading">Add a flat</h3>
            <form className="management-form" onSubmit={handleCreateFlat}>
              <label>
                Flat number
                <input name="flatNumber" maxLength="20" required />
              </label>
              <label>
                Wing (optional)
                <input name="wing" maxLength="20" />
              </label>
              <button type="submit" disabled={submittingFlat}>
                {submittingFlat ? "Adding..." : "Add flat"}
              </button>
            </form>
            <h4>Flats ({flats.length})</h4>
            {flats.length === 0 ? (
              <p>No flats added yet.</p>
            ) : (
              <ul>
                {flats.map((flat) => (
                  <li key={flat.id}>
                    {flat.wing ? `${flat.wing} ` : ""}{flat.flatNumber}
                    {!flat.active && " (inactive)"}
                    {flat.residents.length > 0 && ` — ${flat.residents.map((resident) => resident.name).join(", ")}`}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="residents-heading">
            <h3 id="residents-heading">Create a resident account</h3>
            {flats.filter((flat) => flat.active).length === 0 ? (
              <p>Add an active flat before creating a resident account.</p>
            ) : (
              <form className="management-form" onSubmit={handleCreateResident}>
                <label>
                  Resident name
                  <input name="name" minLength="2" maxLength="100" required />
                </label>
                <label>
                  Email
                  <input name="email" type="email" maxLength="254" required />
                </label>
                <label>
                  Initial password (at least 12 characters)
                  <input name="password" type="password" minLength="12" maxLength="72" autoComplete="new-password" required />
                </label>
                <label>
                  Flat
                  <select name="flatId" required defaultValue="">
                    <option value="" disabled>Select a flat</option>
                    {flats.filter((flat) => flat.active).map((flat) => (
                      <option key={flat.id} value={flat.id}>
                        {flat.wing ? `${flat.wing} ` : ""}{flat.flatNumber}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" disabled={submittingResident}>
                  {submittingResident ? "Creating..." : "Create resident"}
                </button>
              </form>
            )}
            <h4>Residents ({residents.length})</h4>
            {residents.length === 0 ? (
              <p>No resident accounts added yet.</p>
            ) : (
              <ul>
                {residents.map((resident) => (
                  <li key={resident.id}>
                    {resident.name} — {resident.email}
                    {resident.flat && ` — ${resident.flat.wing ? `${resident.flat.wing} ` : ""}${resident.flat.flatNumber}`}
                    {!resident.active && " (inactive)"}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <CollectionAnalytics />
      <BillingPanel role="admin" />
      <AdminDisputeReview />
      <AdminPaymentReview />
    </section>
  );
}

export default AdminPanel;

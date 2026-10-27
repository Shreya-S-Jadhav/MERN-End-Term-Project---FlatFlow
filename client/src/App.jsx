import { useEffect, useState } from "react";
import AdminPanel from "./AdminPanel.jsx";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetch(`${apiBaseUrl}/api/auth/me`, { credentials: "include" })
      .then(async (response) => {
        if (response.ok) {
          const result = await response.json();
          if (active) setUser(result.user);
        } else if (response.status !== 401) {
          throw new Error("Unable to check your sign-in status. Please try again.");
        }
      })
      .catch(() => {
        if (active) setError("Unable to connect to FlatFlow. Check that the API is running.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Sign-in failed.");
      }

      setUser(result.user);
      form.reset();
    } catch (loginError) {
      setError(loginError.message || "Unable to connect to FlatFlow.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Unable to sign out. Please try again.");
      }
      setUser(null);
    } catch (logoutError) {
      setError(logoutError.message || "Unable to connect to FlatFlow.");
    }
  }

  return (
    <main>
      <h1>FlatFlow</h1>
      <p>Society maintenance, bills, and payments in one place.</p>
      {loading ? (
        <p role="status">Checking your sign-in status...</p>
      ) : user ? (
        <section aria-labelledby="welcome-heading">
          <h2 id="welcome-heading">Welcome, {user.name}</h2>
          <p>Signed in as {user.role}.</p>
          {user.flat && <p>Flat: {user.flat.wing} {user.flat.flatNumber}</p>}
          {user.role === "admin" && <AdminPanel />}
          {user.role === "resident" && <p>Your resident dashboard will be added with the billing step.</p>}
          <button type="button" onClick={handleLogout}>Log out</button>
        </section>
      ) : (
        <section aria-labelledby="login-heading">
          <h2 id="login-heading">Sign in</h2>
          <form onSubmit={handleLogin}>
            <label>
              Email
              <input name="email" type="email" autoComplete="username" required />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}

export default App;

/*import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const API_URL = "http://localhost:5000/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!token) {
      setError("The reset link is missing its token.");
      return;
    }

    if (password.length < 6 || password.length > 12) {
      setError("Password must contain 6–12 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Password reset failed.");
      }

      setSuccess(true);
      setMessage(data.message || "Your password has been reset successfully.");
      setPassword("");
    } catch (err) {
      setError(err.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-container">
      <h2>Reset Password</h2>

      {success ? (
        <>
          <p role="status">{message}</p>
          <Link to="/auth">Return to login</Link>
        </>
      ) : (
        <>
          <p>Choose a new password between 6 and 12 characters.</p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              maxLength={12}
              autoComplete="new-password"
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Reset Password"}
            </button>
          </form>

          {error && <p role="alert">{error}</p>}
          <p>
            <Link to="/auth">Return to login</Link>
          </p>
        </>
      )}
    </main>
  );
}*/

import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const API_URL = "http://localhost:5000/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!token) {
      setError("The reset link is missing its token.");
      return;
    }
    if (password.length < 6 || password.length > 12) {
      setError("Password must contain 6–12 characters.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Password reset failed.");
      setSuccess(true);
      setMessage(data.message || "Your password has been reset successfully.");
      setPassword("");
    } catch (err) {
      setError(err.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="container">
        <div className="auth-container">
          <h1 className="page-title" style={{ marginBottom: "0.25rem" }}>
            Reset Password
          </h1>

          {success ? (
            <>
              <p
                role="status"
                style={{ marginTop: 12, color: "var(--success)" }}
              >
                {message}
              </p>
              <p className="auth-switch">
                <Link to="/auth" className="auth-link">
                  Return to sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <p style={{ color: "var(--text-muted)", fontSize: "0.925rem" }}>
                Choose a new password between 6 and 12 characters.
              </p>

              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-password">
                    New password
                  </label>
                  <input
                    id="new-password"
                    className="form-input"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    maxLength={12}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={loading}
                >
                  {loading ? "Updating…" : "Reset Password"}
                </button>
              </form>

              {error && (
                <p
                  role="alert"
                  style={{
                    marginTop: 16,
                    color: "var(--danger)",
                    fontSize: 14,
                  }}
                >
                  {error}
                </p>
              )}

              <p className="auth-switch">
                <Link to="/auth" className="auth-link">
                  Return to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

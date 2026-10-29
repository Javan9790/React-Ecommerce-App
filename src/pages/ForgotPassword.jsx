/*import { useState } from "react";
import { Link } from "react-router-dom";

const API_URL = "http://localhost:5000/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Request failed.");
      }

      setMessage(
        data.message ||
          "If the account exists, a reset link has been generated.",
      );
    } catch (err) {
      setError(err.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-container">
      <h2>Forgot Password</h2>
      <p>Enter the email address linked to your account.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="reset-email">Email address</label>
        <input
          id="reset-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Please wait..." : "Request Reset Link"}
        </button>
      </form>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <p>
        Remember your password? <Link to="/auth">Log in</Link>
      </p>
    </main>
  );
}*/

import { useState } from "react";
import { Link } from "react-router-dom";

const API_URL = "http://localhost:5000/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Request failed.");
      setMessage(
        data.message ||
          "If the account exists, a reset link has been generated.",
      );
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
            Forgot Password
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.925rem" }}>
            Enter the email address linked to your account.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">
                Email address
              </label>
              <input
                id="reset-email"
                className="form-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? "Please wait…" : "Request Reset Link"}
            </button>
          </form>

          {message && (
            <p
              role="status"
              style={{
                marginTop: 16,
                color: "var(--text-muted)",
                fontSize: 14,
              }}
            >
              {message}
            </p>
          )}
          {error && (
            <p
              role="alert"
              style={{ marginTop: 16, color: "var(--danger)", fontSize: 14 }}
            >
              {error}
            </p>
          )}

          <p className="auth-switch">
            Remember your password?{" "}
            <Link to="/auth" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

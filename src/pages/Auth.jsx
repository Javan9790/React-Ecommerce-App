/*import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Auth() {
  const [mode, setMode] = useState("signup");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { signUp, login } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  async function onSubmit(data) {
    setError(null);
    setLoading(true);

    try {
      const result =
        mode === "signup"
          ? await signUp(data.name, data.email, data.password)
          : await login(data.email, data.password);

      if (result.success) {
        navigate("/");
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError(null);
    reset();
  }

  return (
    <div className="page">
      <div className="container">
        <div className="auth-container">
          <h1 className="page-title">
            {mode === "signup" ? "Sign Up" : "Login"}
          </h1>

          <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
            {error && <div className="error-message">{error}</div>}

            {mode === "signup" && (
              <div className="form-group">
                <label className="form-label" htmlFor="name">
                  Full Name
                </label>

                <input
                  className="form-input"
                  type="text"
                  id="name"
                  autoComplete="name"
                  {...register("name", {
                    required: "Name is required",
                    maxLength: {
                      value: 100,
                      message: "Name is too long",
                    },
                  })}
                />

                {errors.name && (
                  <span className="form-error">{errors.name.message}</span>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email
              </label>

              <input
                className="form-input"
                type="email"
                id="email"
                autoComplete="email"
                {...register("email", {
                  required: "Email is required",
                })}
              />

              {errors.email && (
                <span className="form-error">{errors.email.message}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>

              <input
                className="form-input"
                type="password"
                id="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                  maxLength: {
                    value: 12,
                    message: "Password must be no more than 12 characters",
                  },
                })}
              />

              {errors.password && (
                <span className="form-error">{errors.password.message}</span>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "signup"
                  ? "Sign Up"
                  : "Login"}
            </button>
          </form>

          {mode === "login" && (
            <p className="auth-link">
              <Link to="/forgot-password">Forgot Password?</Link>
            </p>
          )}

          <div className="auth-switch">
            {mode === "signup" ? (
              <p>
                Already have an account?{" "}
                <span className="auth-link" onClick={() => switchMode("login")}>
                  Login
                </span>
              </p>
            ) : (
              <p>
                Don't have an account?{" "}
                <span
                  className="auth-link"
                  onClick={() => switchMode("signup")}
                >
                  Sign Up
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}*/

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Auth() {
  const [mode, setMode] = useState("signup");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { signUp, login } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  async function onSubmit(data) {
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === "signup"
          ? await signUp(data.name, data.email, data.password)
          : await login(data.email, data.password);
      if (result.success) {
        navigate("/");
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError(null);
    reset();
  }

  return (
    <div className="page">
      <div className="container">
        <div className="auth-container">
          <h1 className="page-title" style={{ marginBottom: "0.25rem" }}>
            {mode === "signup" ? "Create Account" : "Sign In"}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.925rem" }}>
            {mode === "signup"
              ? "Join ShopHub to start ordering."
              : "Welcome back to ShopHub."}
          </p>

          <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
            {error && <div className="error-message">{error}</div>}

            {mode === "signup" && (
              <div className="form-group">
                <label className="form-label" htmlFor="name">
                  Full Name
                </label>
                <input
                  className="form-input"
                  type="text"
                  id="name"
                  autoComplete="name"
                  {...register("name", {
                    required: "Name is required",
                    maxLength: {
                      value: 100,
                      message: "Name is too long",
                    },
                  })}
                />
                {errors.name && (
                  <span className="form-error">{errors.name.message}</span>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <input
                className="form-input"
                type="email"
                id="email"
                autoComplete="email"
                {...register("email", {
                  required: "Email is required",
                })}
              />
              {errors.email && (
                <span className="form-error">{errors.email.message}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <input
                className="form-input"
                type="password"
                id="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                  maxLength: {
                    value: 12,
                    message: "Password must be no more than 12 characters",
                  },
                })}
              />
              {errors.password && (
                <span className="form-error">{errors.password.message}</span>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-large btn-block"
              disabled={loading}
              style={{ marginTop: "0.5rem" }}
            >
              {loading
                ? "Please wait…"
                : mode === "signup"
                  ? "Create Account"
                  : "Sign In"}
            </button>
          </form>

          {mode === "login" && (
            <p className="auth-switch">
              <Link to="/forgot-password" className="auth-link">
                Forgot password?
              </Link>
            </p>
          )}

          <div className="auth-switch">
            {mode === "signup" ? (
              <p>
                Already have an account?{" "}
                <span className="auth-link" onClick={() => switchMode("login")}>
                  Sign in
                </span>
              </p>
            ) : (
              <p>
                Don&apos;t have an account?{" "}
                <span
                  className="auth-link"
                  onClick={() => switchMode("signup")}
                >
                  Create one
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

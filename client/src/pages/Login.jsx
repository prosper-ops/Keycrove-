import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { apiPost } from "../api";

export default function Login({
  onLogin,
  onNavigate,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function navigateTo(page) {
    if (typeof onNavigate === "function") {
      onNavigate(page);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Enter your email address and master password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await apiPost("/api/auth/login", {
        email: normalizedEmail,
        password,
      });

      if (typeof onLogin === "function") {
        await onLogin(result);
      }
    } catch (requestError) {
      setError(
        requestError?.status === 401
          ? "The email address or password is incorrect."
          : requestError?.status === 429
            ? "Too many attempts. Please wait before trying again."
            : requestError?.message ||
              "We couldn't sign you in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <a
          className="auth-brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("home");
          }}
          aria-label="KeyCrove home"
        >
          <span className="auth-brand-mark" aria-hidden="true">
            <KeyRound size={23} />
          </span>

          <span className="auth-brand-name">
            Key<span>Crove</span>
          </span>
        </a>

        <div className="auth-heading">
          <div className="auth-icon" aria-hidden="true">
            <LockKeyhole size={24} />
          </div>

          <p className="auth-eyebrow">
            WELCOME BACK
          </p>

          <h1>Access your vault.</h1>

          <p className="auth-description">
            Sign in to manage your accounts and keep your
            digital life organized.
          </p>
        </div>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <div className="auth-field">
            <label htmlFor="login-email">
              Email address
            </label>

            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              autoComplete="username"
              maxLength={254}
              required
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <div className="auth-label-row">
              <label htmlFor="login-password">
                Master password
              </label>

              <button
                type="button"
                className="auth-text-button"
                onClick={() => navigateTo("forgot-password")}
              >
                Forgot password?
              </button>
            </div>

            <div className="auth-password-wrap">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your master password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                autoComplete="current-password"
                required
                disabled={loading}
              />

              <button
                type="button"
                className="auth-password-toggle"
                onClick={() =>
                  setShowPassword((visible) => !visible)
                }
                aria-label={
                  showPassword
                    ? "Hide master password"
                    : "Show master password"
                }
                aria-pressed={showPassword}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoaderCircle
                  size={19}
                  className="auth-spinner"
                  aria-hidden="true"
                />
                Signing in...
              </>
            ) : (
              <>
                Sign in to KeyCrove
                <ArrowRight size={19} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>NEW TO KEYCROVE?</span>
        </div>

        <button
          type="button"
          className="auth-secondary-button"
          onClick={() => navigateTo("signup")}
        >
          Create an account
        </button>

        <div className="auth-security-note">
          <ShieldCheck size={18} aria-hidden="true" />

          <p>
            Your account deserves careful protection.
            Always sign in through the official KeyCrove website.
          </p>
        </div>

        <footer className="auth-footer">
          <span>KEYCROVE</span>
          <span>PRIVATE BY DESIGN</span>
        </footer>
      </section>
    </main>
  );
}

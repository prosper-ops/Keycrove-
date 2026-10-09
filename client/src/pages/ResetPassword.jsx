import { useState } from "react";
import {
ArrowLeft,
ShieldCheck,
LockKeyhole,
Eye,
EyeOff,
LoaderCircle,
CheckCircle2,
AlertCircle,
} from "lucide-react";
import { apiPost } from "../api";

export default function ResetPassword({ onNavigate }) {
const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [success, setSuccess] = useState(false);

const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";

async function handleSubmit(event) {
event.preventDefault();
setError("");

if (!token) {
  setError(
    "This password-reset link is missing its recovery token. Please request a new link."
  );
  return;
}

if (password.length < 12) {
  setError("Your new password must contain at least 12 characters.");
  return;
}

if (password.length > 128) {
  setError("Your password must not exceed 128 characters.");
  return;
}

if (password !== confirmPassword) {
  setError("The passwords do not match. Please check them and try again.");
  return;
}

setLoading(true);

try {
  await apiPost("/api/auth/reset-password", {
    token,
    password,
  });

  setSuccess(true);
} catch (requestError) {
  setError(
    requestError?.message ||
      "We couldn't reset your password. The link may have expired. Please request a new one if necessary."
  );
} finally {
  setLoading(false);
}

}

return (
<main className="auth-page">
<section className="auth-card">
<button
type="button"
className="auth-text-button"
onClick={() => onNavigate?.("login")}
disabled={loading}
aria-label="Return to login"
>
<ArrowLeft size={17} aria-hidden="true" />
Back to login
</button>

    <div className="auth-brand">
      <div className="auth-brand-mark" aria-hidden="true">
        <ShieldCheck size={25} />
      </div>

      <span className="auth-brand-name">KeyCrove</span>
    </div>

    {!success ? (
      <>
        <div className="auth-icon" aria-hidden="true">
          <LockKeyhole size={25} />
        </div>

        <p className="auth-eyebrow">ACCOUNT RECOVERY</p>

        <h1 className="auth-heading">Create a new password</h1>

        <p className="auth-description">
          Choose a strong, unique password for your KeyCrove account.
          Avoid reusing a password from another website.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="new-password">
              New password
            </label>

            <div className="auth-input-wrap auth-password-wrap">
              <LockKeyhole
                className="auth-input-icon"
                size={18}
                aria-hidden="true"
              />

              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="At least 12 characters"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={12}
                maxLength={128}
                required
                disabled={loading}
              />

              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>

            <p className="auth-field-hint">
              Use a long password that you haven't used elsewhere.
            </p>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="confirm-password">
              Confirm new password
            </label>

            <div className="auth-input-wrap auth-password-wrap">
              <LockKeyhole
                className="auth-input-icon"
                size={18}
                aria-hidden="true"
              />

              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Enter your new password again"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                maxLength={128}
                required
                disabled={loading}
              />

              <button
                type="button"
                className="auth-password-toggle"
                onClick={() =>
                  setShowConfirmPassword((current) => !current)
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide confirmation password"
                    : "Show confirmation password"
                }
                aria-pressed={showConfirmPassword}
                disabled={loading}
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <AlertCircle size={17} aria-hidden="true" />
              <span>{error}</span>
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
                  className="auth-spinner"
                  size={18}
                  aria-hidden="true"
                />
                Updating password...
              </>
            ) : (
              "Reset password"
            )}
          </button>
        </form>

        <div className="auth-security-note">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            Your new password should be unique to your KeyCrove account.
          </span>
        </div>
      </>
    ) : (
      <div className="auth-success" role="status">
        <div className="auth-icon" aria-hidden="true">
          <CheckCircle2 size={26} />
        </div>

        <p className="auth-eyebrow">PASSWORD UPDATED</p>

        <h1 className="auth-heading">You're ready to sign in</h1>

        <p className="auth-description">
          Your password-reset request was successful. Use your new
          password the next time you sign in.
        </p>

        <button
          type="button"
          className="auth-submit-button"
          onClick={() => onNavigate?.("login")}
        >
          Continue to login
        </button>
      </div>
    )}

    <footer className="auth-footer">
      <span>KeyCrove</span>
      <span aria-hidden="true">•</span>
      <span>Your digital security, taken seriously.</span>
    </footer>
  </section>
</main>

);
}

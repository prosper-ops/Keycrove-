import { useState } from "react";
import {
ArrowLeft,
Mail,
ShieldCheck,
LoaderCircle,
CheckCircle2,
AlertCircle,
} from "lucide-react";
import { apiPost } from "../api";

export default function ForgotPassword({ onNavigate }) {
const [email, setEmail] = useState("");
const [loading, setLoading] = useState(false);
const [message, setMessage] = useState("");
const [error, setError] = useState("");
const [submitted, setSubmitted] = useState(false);

async function handleSubmit(event) {
event.preventDefault();

setError("");
setMessage("");

const normalizedEmail = email.trim().toLowerCase();

if (!normalizedEmail) {
  setError("Please enter the email address associated with your account.");
  return;
}

setLoading(true);

try {
  await apiPost("/api/auth/forgot-password", {
    email: normalizedEmail,
  });

  setSubmitted(true);
  setMessage(
    "If an account exists with that email address, instructions for resetting your password will be sent to it."
  );
} catch {
  setError(
    "We couldn't process your request right now. Please check your connection and try again."
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

    {!submitted ? (
      <>
        <div className="auth-icon" aria-hidden="true">
          <Mail size={25} />
        </div>

        <p className="auth-eyebrow">ACCOUNT RECOVERY</p>

        <h1 className="auth-heading">Forgot your password?</h1>

        <p className="auth-description">
          It happens. Enter the email address associated with your
          KeyCrove account, and we'll help you get back in.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="recovery-email">
              Email address
            </label>

            <div className="auth-input-wrap">
              <Mail
                className="auth-input-icon"
                size={18}
                aria-hidden="true"
              />

              <input
                id="recovery-email"
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
                disabled={loading}
              />
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
                Sending request...
              </>
            ) : (
              "Send recovery instructions"
            )}
          </button>
        </form>

        <div className="auth-security-note">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            Your account information deserves careful protection.
          </span>
        </div>
      </>
    ) : (
      <div className="auth-success" role="status">
        <div className="auth-icon" aria-hidden="true">
          <CheckCircle2 size={26} />
        </div>

        <p className="auth-eyebrow">REQUEST RECEIVED</p>

        <h1 className="auth-heading">Check your inbox</h1>

        <p className="auth-description">{message}</p>

        <button
          type="button"
          className="auth-submit-button"
          onClick={() => onNavigate?.("login")}
        >
          Return to login
        </button>

        <p className="auth-field-hint">
          If you don't see an email, check your spam folder. You can also
          verify that you entered the correct email address.
        </p>
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

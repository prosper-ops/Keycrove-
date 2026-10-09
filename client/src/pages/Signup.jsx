import { useState } from "react";
import {
ArrowRight,
Eye,
EyeOff,
KeyRound,
LoaderCircle,
LockKeyhole,
ShieldCheck,
UserRound,
} from "lucide-react";
import { apiPost } from "../api";

export default function Signup({
onSignup,
onNavigate,
}) {
const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");

const [showPassword, setShowPassword] = useState(false);
const [showConfirmation, setShowConfirmation] = useState(false);

const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [successMessage, setSuccessMessage] = useState("");

function navigateTo(page) {
if (typeof onNavigate === "function") {
onNavigate(page);
}
}

function getPasswordStrength(value) {
if (!value) {
return {
label: "",
level: 0,
};
}

let score = 0;

if (value.length >= 12) score += 1;
if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
if (/\d/.test(value)) score += 1;
if (/[^A-Za-z0-9]/.test(value)) score += 1;

if (value.length < 8) {
  return {
    label: "Too short",
    level: 1,
  };
}

if (score <= 1) {
  return {
    label: "Could be stronger",
    level: 2,
  };
}

if (score <= 2) {
  return {
    label: "Fair",
    level: 3,
  };
}

if (score === 3) {
  return {
    label: "Strong",
    level: 4,
  };
}

return {
  label: "Very strong",
  level: 5,
};

}

const passwordStrength = getPasswordStrength(password);

async function handleSubmit(event) {
event.preventDefault();

if (loading) return;

const normalizedName = name.trim();
const normalizedEmail = email.trim().toLowerCase();

if (!normalizedName || !normalizedEmail || !password) {
  setError("Complete all required fields.");
  return;
}

if (normalizedName.length > 100) {
  setError("Your name must be 100 characters or fewer.");
  return;
}

if (password.length < 12) {
  setError(
    "For better protection, choose a master password with at least 12 characters."
  );
  return;
}

if (password.length > 128) {
  setError(
    "Your master password must be 128 characters or fewer."
  );
  return;
}

if (password !== confirmPassword) {
  setError("Your passwords do not match.");
  return;
}

setLoading(true);
setError("");
setSuccessMessage("");

try {
  const result = await apiPost("/api/auth/register", {
    name: normalizedName,
    email: normalizedEmail,
    password,
  });

  if (typeof onSignup === "function") {
    await onSignup(result);
  } else {
    setSuccessMessage(
      "Your registration request was submitted successfully."
    );
  }
} catch (requestError) {
  setError(
    requestError?.status === 409
      ? "An account with this email address may already exist. Try signing in instead."
      : requestError?.status === 429
        ? "Too many attempts. Please wait before trying again."
        : requestError?.message ||
          "We couldn't create your account. Please try again."
  );
} finally {
  setLoading(false);
}

}

return (
<main className="auth-page">
<section className="auth-card auth-card-signup">
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
        <ShieldCheck size={24} />
      </div>

      <p className="auth-eyebrow">
        START WITH KEYCROVE
      </p>

      <h1>Create your account.</h1>

      <p className="auth-description">
        Bring your digital accounts together in one
        organized place.
      </p>
    </div>

    <form
      className="auth-form"
      onSubmit={handleSubmit}
    >
      <div className="auth-field">
        <label htmlFor="signup-name">
          Your name
        </label>

        <div className="auth-input-wrap">
          <UserRound
            size={18}
            aria-hidden="true"
          />

          <input
            id="signup-name"
            name="name"
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
              setSuccessMessage("");
            }}
            autoComplete="name"
            maxLength={100}
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="auth-field">
        <label htmlFor="signup-email">
          Email address
        </label>

        <input
          id="signup-email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
            setSuccessMessage("");
          }}
          autoComplete="email"
          maxLength={254}
          required
          disabled={loading}
        />
      </div>

      <div className="auth-field">
        <label htmlFor="signup-password">
          Create a master password
        </label>

        <div className="auth-password-wrap">
          <input
            id="signup-password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 12 characters"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
              setSuccessMessage("");
            }}
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
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

        {password && (
          <div
            className="password-strength"
            aria-live="polite"
          >
            <div
              className="password-strength-bars"
              aria-hidden="true"
            >
              {[1, 2, 3, 4, 5].map((level) => (
                <span
                  key={level}
                  className={
                    level <= passwordStrength.level
                      ? `strength-level strength-level-${passwordStrength.level}`
                      : "strength-level"
                  }
                />
              ))}
            </div>

            <span className="password-strength-label">
              {passwordStrength.label}
            </span>
          </div>
        )}

        <p className="auth-field-hint">
          Use a long, unique password that you do not
          use for other accounts.
        </p>
      </div>

      <div className="auth-field">
        <label htmlFor="signup-confirm-password">
          Confirm master password
        </label>

        <div className="auth-password-wrap">
          <input
            id="signup-confirm-password"
            name="confirmPassword"
            type={
              showConfirmation ? "text" : "password"
            }
            placeholder="Enter your password again"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setError("");
              setSuccessMessage("");
            }}
            autoComplete="new-password"
            maxLength={128}
            required
            disabled={loading}
          />

          <button
            type="button"
            className="auth-password-toggle"
            onClick={() =>
              setShowConfirmation((visible) => !visible)
            }
            aria-label={
              showConfirmation
                ? "Hide password confirmation"
                : "Show password confirmation"
            }
            aria-pressed={showConfirmation}
            disabled={loading}
          >
            {showConfirmation ? (
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

      {successMessage && (
        <div className="auth-success" role="status">
          {successMessage}
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
            Creating account...
          </>
        ) : (
          <>
            Create my account
            <ArrowRight size={19} aria-hidden="true" />
          </>
        )}
      </button>
    </form>

    <div className="auth-divider">
      <span>ALREADY HAVE AN ACCOUNT?</span>
    </div>

    <button
      type="button"
      className="auth-secondary-button"
      onClick={() => navigateTo("login")}
    >
      Sign in instead
    </button>

    <div className="auth-security-note">
      <LockKeyhole size={18} aria-hidden="true" />

      <p>
        Choose a master password you can keep safe.
        Never share it with anyone.
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

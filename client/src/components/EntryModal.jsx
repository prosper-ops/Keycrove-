import { useEffect, useState } from "react";
import {
X,
Eye,
EyeOff,
LockKeyhole,
Globe,
UserRound,
FileText,
KeyRound,
Save,
LoaderCircle,
} from "lucide-react";

const EMPTY_FORM = {
type: "password",
title: "",
username: "",
password: "",
url: "",
notes: "",
};

export default function EntryModal({
initial,
onClose,
onSave,
}) {
const [form, setForm] = useState(() => ({
...EMPTY_FORM,
...(initial || {}),
}));

const [showPassword, setShowPassword] = useState(false);
const [saving, setSaving] = useState(false);
const [error, setError] = useState("");

const isEditing = Boolean(initial);

useEffect(() => {
function handleKeyDown(event) {
if (event.key === "Escape" && !saving) {
onClose?.();
}
}

window.addEventListener("keydown", handleKeyDown);

return () => {
  window.removeEventListener("keydown", handleKeyDown);
};

}, [onClose, saving]);

function updateField(event) {
const { name, value } = event.target;

setForm((current) => ({
  ...current,
  [name]: value,
}));

if (error) {
  setError("");
}

}

async function handleSubmit(event) {
event.preventDefault();

if (!form.title.trim()) {
  setError("Enter a name for this vault entry.");
  return;
}

if (saving) {
  return;
}

setSaving(true);
setError("");

try {
  if (typeof onSave !== "function") {
    throw new Error(
      "Saving is not connected yet. Please try again later."
    );
  }

  await onSave({
    ...form,
    title: form.title.trim(),
    username: form.username.trim(),
    url: form.url.trim(),
    notes: form.notes.trim(),
  });
} catch (saveError) {
  setError(
    saveError instanceof Error
      ? saveError.message
      : "Unable to save this entry. Please try again."
  );
} finally {
  setSaving(false);
}

}

return (
<div
className="entry-modal-backdrop"
onMouseDown={(event) => {
if (
event.target === event.currentTarget &&
!saving
) {
onClose?.();
}
}}
>
<section
className="entry-modal"
role="dialog"
aria-modal="true"
aria-labelledby="entry-modal-title"
aria-describedby="entry-modal-description"
>
<header className="entry-modal-header">
<div className="entry-modal-heading">
<div
className="entry-modal-icon"
aria-hidden="true"
>
<LockKeyhole size={22} />
</div>

        <div>
          <p className="entry-modal-eyebrow">
            YOUR SECURE VAULT
          </p>

          <h2 id="entry-modal-title">
            {isEditing
              ? "Edit entry"
              : "Add a new entry"}
          </h2>

          <p
            id="entry-modal-description"
            className="entry-modal-description"
          >
            {isEditing
              ? "Update the details for this account."
              : "Keep your account details organized in one place."}
          </p>
        </div>
      </div>

      <button
        type="button"
        className="entry-modal-close"
        onClick={() => onClose?.()}
        disabled={saving}
        aria-label="Close entry form"
      >
        <X size={20} />
      </button>
    </header>

    <form
      className="entry-modal-form"
      onSubmit={handleSubmit}
    >
      <div className="entry-form-field">
        <label htmlFor="entry-title">
          Entry name <span aria-hidden="true">*</span>
        </label>

        <div className="entry-input-wrap">
          <LockKeyhole
            className="entry-input-icon"
            size={18}
            aria-hidden="true"
          />

          <input
            id="entry-title"
            name="title"
            type="text"
            placeholder="e.g. GitHub Account"
            value={form.title}
            onChange={updateField}
            autoComplete="off"
            maxLength={120}
            required
            autoFocus
          />
        </div>
      </div>

      <div className="entry-form-field">
        <label htmlFor="entry-type">
          Entry type
        </label>

        <select
          id="entry-type"
          name="type"
          value={form.type}
          onChange={updateField}
        >
          <option value="password">Password</option>
          <option value="secure-note">Secure note</option>
          <option value="identity">Identity</option>
          <option value="card">Payment card</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="entry-form-field">
        <label htmlFor="entry-username">
          Username or email
        </label>

        <div className="entry-input-wrap">
          <UserRound
            className="entry-input-icon"
            size={18}
            aria-hidden="true"
          />

          <input
            id="entry-username"
            name="username"
            type="text"
            placeholder="Enter username or email"
            value={form.username}
            onChange={updateField}
            autoComplete="off"
            maxLength={254}
          />
        </div>
      </div>

      <div className="entry-form-field">
        <label htmlFor="entry-password">
          Password
        </label>

        <div className="entry-input-wrap">
          <KeyRound
            className="entry-input-icon"
            size={18}
            aria-hidden="true"
          />

          <input
            id="entry-password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter password"
            value={form.password}
            onChange={updateField}
            autoComplete="new-password"
            maxLength={4096}
            spellCheck={false}
          />

          <button
            type="button"
            className="entry-password-toggle"
            onClick={() =>
              setShowPassword((visible) => !visible)
            }
            aria-label={
              showPassword
                ? "Hide password"
                : "Show password"
            }
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff size={18} />
            ) : (
              <Eye size={18} />
            )}
          </button>
        </div>
      </div>

      <div className="entry-form-field">
        <label htmlFor="entry-url">
          Website address
        </label>

        <div className="entry-input-wrap">
          <Globe
            className="entry-input-icon"
            size={18}
            aria-hidden="true"
          />

          <input
            id="entry-url"
            name="url"
            type="text"
            placeholder="https://example.com"
            value={form.url}
            onChange={updateField}
            autoComplete="url"
            maxLength={2048}
          />
        </div>
      </div>

      <div className="entry-form-field">
        <label htmlFor="entry-notes">
          Notes <span>(optional)</span>
        </label>

        <div className="entry-input-wrap entry-textarea-wrap">
          <FileText
            className="entry-input-icon"
            size={18}
            aria-hidden="true"
          />

          <textarea
            id="entry-notes"
            name="notes"
            placeholder="Add any useful details..."
            value={form.notes}
            onChange={updateField}
            rows={3}
            maxLength={5000}
          />
        </div>
      </div>

      {error && (
        <div
          className="entry-form-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <footer className="entry-modal-footer">
        <button
          type="button"
          className="entry-button entry-button-secondary"
          onClick={() => onClose?.()}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="entry-button entry-button-primary"
          disabled={saving}
        >
          {saving ? (
            <>
              <LoaderCircle
                size={17}
                className="entry-button-spinner"
                aria-hidden="true"
              />
              Saving...
            </>
          ) : (
            <>
              <Save size={17} aria-hidden="true" />
              {isEditing ? "Save changes" : "Save entry"}
            </>
          )}
        </button>
      </footer>
    </form>
  </section>
</div>

);
}

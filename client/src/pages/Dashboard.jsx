import { useCallback, useEffect, useState } from "react";
import {
ShieldCheck,
LockKeyhole,
Plus,
Search,
KeyRound,
Globe,
UserRound,
FileText,
Eye,
EyeOff,
Copy,
Pencil,
Trash2,
LogOut,
RefreshCw,
X,
Check,
AlertCircle,
LoaderCircle,
ShieldAlert,
Fingerprint,
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import EntryModal from "../components/EntryModal";
import Toast from "../components/Toast";

function getEntriesFromResponse(response) {
if (Array.isArray(response)) return response;
if (Array.isArray(response?.entries)) return response.entries;
if (Array.isArray(response?.items)) return response.items;
if (Array.isArray(response?.data)) return response.data;
if (Array.isArray(response?.data?.entries)) return response.data.entries;
if (Array.isArray(response?.data?.items)) return response.data.items;

return [];
}

function createPassword(length = 20) {
const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const lower = "abcdefghijkmnopqrstuvwxyz";
const numbers = "23456789";
const symbols = "!@#$%^&*()-_=+";
const all = upper + lower + numbers + symbols;

const randomIndex = (max) => {
const values = new Uint32Array(1);
const limit = Math.floor(0x100000000 / max) * max;

do {
  crypto.getRandomValues(values);
} while (values[0] >= limit);

return values[0] % max;

};

const characters = [
upper[randomIndex(upper.length)],
lower[randomIndex(lower.length)],
numbers[randomIndex(numbers.length)],
symbols[randomIndex(symbols.length)],
];

while (characters.length < length) {
characters.push(all[randomIndex(all.length)]);
}

for (let i = characters.length - 1; i > 0; i -= 1) {
const j = randomIndex(i + 1);
[characters[i], characters[j]] = [characters[j], characters[i]];
}

return characters.join("");
}

function getEntryIcon(type) {
switch (type) {
case "login":
return Globe;
case "secure-note":
return FileText;
default:
return KeyRound;
}
}

function getEntryId(entry) {
return entry.id ?? entry._id ?? entry.entryId;
}

export default function Dashboard({ onLogout, onNavigate }) {
const [entries, setEntries] = useState([]);
const [loading, setLoading] = useState(true);
const [pageError, setPageError] = useState("");
const [search, setSearch] = useState("");
const [modalOpen, setModalOpen] = useState(false);
const [editingEntry, setEditingEntry] = useState(null);
const [visiblePasswords, setVisiblePasswords] = useState({});
const [toast, setToast] = useState(null);
const [saving, setSaving] = useState(false);
const [deletingId, setDeletingId] = useState(null);
const [generatorOpen, setGeneratorOpen] = useState(false);
const [generatedPassword, setGeneratedPassword] = useState("");
const [passwordLength, setPasswordLength] = useState(20);
const [copiedId, setCopiedId] = useState(null);

const showToast = useCallback((message, type = "info") => {
setToast({ message, type, id: Date.now() });
}, []);

const loadEntries = useCallback(async () => {
setLoading(true);
setPageError("");

try {
  const response = await apiGet("/api/vault");
  setEntries(getEntriesFromResponse(response));
} catch (error) {
  setPageError(
    error?.message ||
      "We couldn't load your vault. Please try again."
  );
} finally {
  setLoading(false);
}

}, []);

useEffect(() => {
loadEntries();
}, [loadEntries]);

const filteredEntries = entries.filter((entry) => {
const searchText = search.trim().toLowerCase();

if (!searchText) return true;

return [
  entry.title,
  entry.username,
  entry.email,
  entry.url,
  entry.notes,
  entry.type,
]
  .filter(Boolean)
  .some((value) => String(value).toLowerCase().includes(searchText));

});

function openNewEntry() {
setEditingEntry(null);
setModalOpen(true);
}

function openEditEntry(entry) {
setEditingEntry(entry);
setModalOpen(true);
}

async function saveEntry(entryData) {
setSaving(true);

try {
  if (editingEntry) {
    const id = getEntryId(editingEntry);

    if (id == null) {
      throw new Error("This entry is missing its identifier.");
    }

    await apiPut(
      `/api/vault/${encodeURIComponent(String(id))}`,
      entryData
    );

    showToast("Vault entry updated successfully.", "success");
  } else {
    await apiPost("/api/vault", entryData);
    showToast("Vault entry added successfully.", "success");
  }

  setModalOpen(false);
  setEditingEntry(null);
  await loadEntries();
} catch (error) {
  showToast(
    error?.message || "We couldn't save this entry. Please try again.",
    "error"
  );
} finally {
  setSaving(false);
}

}

async function deleteEntry(entry) {
const id = getEntryId(entry);

if (id == null) {
  showToast("This entry is missing its identifier.", "error");
  return;
}

const confirmed = window.confirm(
  `Delete "${entry.title || "this entry"}" from your vault? This action cannot be undone.`
);

if (!confirmed) return;

setDeletingId(String(id));

try {
  await apiDelete(`/api/vault/${encodeURIComponent(String(id))}`);

  setEntries((current) =>
    current.filter((item) => String(getEntryId(item)) !== String(id))
  );

  showToast("Vault entry deleted.", "success");
} catch (error) {
  showToast(
    error?.message || "We couldn't delete this entry. Please try again.",
    "error"
  );
} finally {
  setDeletingId(null);
}

}

async function copyToClipboard(value, id, label) {
if (!value) {
showToast("No ${label.toLowerCase()} is available to copy.", "warning");
return;
}

try {
  await navigator.clipboard.writeText(String(value));
  setCopiedId(id);

  showToast(`${label} copied to clipboard.`, "success");

  window.setTimeout(() => {
    setCopiedId((current) => (current === id ? null : current));
  }, 1800);
} catch {
  showToast(
    "Clipboard access was unavailable. Check your browser permissions.",
    "error"
  );
}

}

function generateNewPassword() {
try {
setGeneratedPassword(createPassword(passwordLength));
} catch {
showToast(
"Your browser doesn't support secure password generation.",
"error"
);
}
}

async function copyGeneratedPassword() {
if (!generatedPassword) return;

try {
  await navigator.clipboard.writeText(generatedPassword);
  showToast("Generated password copied.", "success");
} catch {
  showToast("Couldn't copy the password. Check clipboard permissions.", "error");
}

}

const passwordCount = entries.length;

return (
<main className="dashboard-page">
{toast && (
<Toast
key={toast.id}
message={toast.message}
type={toast.type}
onClose={() => setToast(null)}
/>
)}

  <header className="dashboard-header">
    <a
      className="dashboard-brand"
      href="#dashboard"
      onClick={(event) => event.preventDefault()}
      aria-label="KeyCrove dashboard"
    >
      <span className="dashboard-brand-mark">
        <ShieldCheck size={23} />
      </span>
      <span className="dashboard-brand-name">KeyCrove</span>
    </a>

    <div className="dashboard-header-actions">
      <span className="dashboard-security-label">
        <span className="dashboard-status-dot" />
        Vault
      </span>

      <button
        type="button"
        className="dashboard-logout-button"
        onClick={() => onLogout?.()}
      >
        <LogOut size={17} aria-hidden="true" />
        <span>Sign out</span>
      </button>
    </div>
  </header>

  <div className="dashboard-container" id="dashboard">
    <section className="dashboard-welcome">
      <div>
        <p className="dashboard-eyebrow">
          <LockKeyhole size={14} aria-hidden="true" />
          YOUR PRIVATE SPACE
        </p>

        <h1>Your password vault.</h1>

        <p className="dashboard-welcome-description">
          Manage your saved credentials in one place. Keep your digital
          life organized and your accounts protected.
        </p>
      </div>

      <div className="dashboard-welcome-icon" aria-hidden="true">
        <ShieldCheck size={43} strokeWidth={1.35} />
      </div>
    </section>

    <section className="dashboard-stats" aria-label="Vault overview">
      <article className="dashboard-stat-card">
        <span className="dashboard-stat-icon">
          <KeyRound size={19} />
        </span>

        <div>
          <p className="dashboard-stat-label">Saved entries</p>
          <p className="dashboard-stat-value">
            {loading ? "—" : passwordCount}
          </p>
        </div>
      </article>

      <article className="dashboard-stat-card">
        <span className="dashboard-stat-icon">
          <ShieldCheck size={19} />
        </span>

        <div>
          <p className="dashboard-stat-label">Vault status</p>
          <p className="dashboard-stat-value dashboard-stat-value-small">
            {loading ? "Loading" : pageError ? "Unavailable" : "Connected"}
          </p>
        </div>
      </article>

      <button
        type="button"
        className="dashboard-generator-card"
        onClick={() => {
          setGeneratorOpen(true);
          if (!generatedPassword) generateNewPassword();
        }}
      >
        <span className="dashboard-stat-icon">
          <Fingerprint size={20} />
        </span>

        <span>
          <span className="dashboard-stat-label">Password tools</span>
          <span className="dashboard-generator-link">
            Open generator <span aria-hidden="true">↗</span>
          </span>
        </span>
      </button>
    </section>

    <section className="dashboard-vault-section">
      <div className="dashboard-section-heading">
        <div>
          <p className="dashboard-eyebrow">YOUR COLLECTION</p>
          <h2>Vault entries</h2>
          <p className="dashboard-section-description">
            Find and manage the credentials you have saved.
          </p>
        </div>

        <button
          type="button"
          className="dashboard-add-button"
          onClick={openNewEntry}
        >
          <Plus size={18} aria-hidden="true" />
          Add entry
        </button>
      </div>

      <div className="dashboard-search-wrap">
        <Search size={19} aria-hidden="true" />

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search titles, usernames, or websites..."
          aria-label="Search vault entries"
        />

        {search && (
          <button
            type="button"
            className="dashboard-clear-search"
            onClick={() => setSearch("")}
            aria-label="Clear search"
          >
            <X size={17} />
          </button>
        )}
      </div>

      {pageError && (
        <div className="dashboard-error-panel" role="alert">
          <AlertCircle size={21} aria-hidden="true" />

          <div>
            <h3>Unable to load your vault</h3>
            <p>{pageError}</p>

            <button
              type="button"
              className="dashboard-retry-button"
              onClick={loadEntries}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="dashboard-loading" role="status">
          <LoaderCircle
            className="dashboard-loading-spinner"
            size={27}
            aria-hidden="true"
          />
          <p>Loading your vault...</p>
        </div>
      ) : !pageError && filteredEntries.length === 0 ? (
        <div className="dashboard-empty-state">
          <div className="dashboard-empty-icon">
            {search ? (
              <Search size={29} aria-hidden="true" />
            ) : (
              <LockKeyhole size={29} aria-hidden="true" />
            )}
          </div>

          <h3>{search ? "No matching entries" : "Your vault starts here"}</h3>

          <p>
            {search
              ? "Try a different search term to find a saved entry."
              : "Add your first entry to start organizing your credentials."}
          </p>

          {search ? (
            <button
              type="button"
              className="dashboard-secondary-button"
              onClick={() => setSearch("")}
            >
              Clear search
            </button>
          ) : (
            <button
              type="button"
              className="dashboard-add-button"
              onClick={openNewEntry}
            >
              <Plus size={18} aria-hidden="true" />
              Create your first entry
            </button>
          )}
        </div>
      ) : !pageError ? (
        <div className="dashboard-entry-list">
          {filteredEntries.map((entry) => {
            const id = getEntryId(entry);
            const entryKey = String(id ?? entry.title ?? Math.random());
            const EntryIcon = getEntryIcon(entry.type);
            const passwordVisible = Boolean(visiblePasswords[entryKey]);
            const isCopied = copiedId === entryKey;
            const isDeleting = deletingId === String(id);

            return (
              <article className="dashboard-entry-card" key={entryKey}>
                <div className="dashboard-entry-main">
                  <div className="dashboard-entry-icon">
                    <EntryIcon size={21} aria-hidden="true" />
                  </div>

                  <div className="dashboard-entry-details">
                    <h3>{entry.title || "Untitled entry"}</h3>

                    <p className="dashboard-entry-username">
                      <UserRound size={14} aria-hidden="true" />
                      {entry.username || entry.email || "No username saved"}
                    </p>

                    {entry.url && (
                      <p className="dashboard-entry-url">
                        <Globe size={14} aria-hidden="true" />
                        {entry.url}
                      </p>
                    )}
                  </div>
                </div>

                {entry.password && (
                  <div className="dashboard-entry-password">
                    <span aria-label={passwordVisible ? "Password visible" : "Password hidden"}>
                      {passwordVisible
                        ? entry.password
                        : "•".repeat(Math.min(String(entry.password).length, 20))}
                    </span>

                    <button
                      type="button"
                      className="dashboard-icon-button"
                      onClick={() =>
                        setVisiblePasswords((current) => ({
                          ...current,
                          [entryKey]: !current[entryKey],
                        }))
                      }
                      aria-label={
                        passwordVisible ? "Hide password" : "Show password"
                      }
                    >
                      {passwordVisible ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                    </button>

                    <button
                      type="button"
                      className="dashboard-icon-button"
                      onClick={() =>
                        copyToClipboard(entry.password, entryKey, "Password")
                      }
                      aria-label="Copy password"
                    >
                      {isCopied ? (
                        <Check size={17} />
                      ) : (
                        <Copy size={17} />
                      )}
                    </button>
                  </div>
                )}

                <div className="dashboard-entry-actions">
                  {entry.username || entry.email ? (
                    <button
                      type="button"
                      className="dashboard-icon-button"
                      onClick={() =>
                        copyToClipboard(
                          entry.username || entry.email,
                          `${entryKey}-username`,
                          "Username"
                        )
                      }
                      aria-label="Copy username"
                      title="Copy username"
                    >
                      <UserRound size={17} />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="dashboard-icon-button"
                    onClick={() => openEditEntry(entry)}
                    aria-label={`Edit ${entry.title || "entry"}`}
                    title="Edit entry"
                  >
                    <Pencil size={17} />
                  </button>

                  <button
                    type="button"
                    className="dashboard-icon-button dashboard-delete-button"
                    onClick={() => deleteEntry(entry)}
                    disabled={isDeleting}
                    aria-label={`Delete ${entry.title || "entry"}`}
                    title="Delete entry"
                  >
                    {isDeleting ? (
                      <LoaderCircle
                        className="dashboard-loading-spinner"
                        size={17}
                      />
                    ) : (
                      <Trash2 size={17} />
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>

    <footer className="dashboard-footer">
      <div className="dashboard-footer-brand">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>KeyCrove</span>
      </div>

      <p>
        Keep your account secure. Never share your master password.
      </p>
    </footer>
  </div>

  {modalOpen && (
    <EntryModal
      initial={editingEntry}
      onClose={() => {
        if (!saving) {
          setModalOpen(false);
          setEditingEntry(null);
        }
      }}
      onSave={saveEntry}
    />
  )}

  {generatorOpen && (
    <div
      className="dashboard-generator-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setGeneratorOpen(false);
        }
      }}
    >
      <section
        className="dashboard-generator-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generator-title"
      >
        <header className="dashboard-generator-header">
          <div>
            <p className="dashboard-eyebrow">PASSWORD TOOLS</p>
            <h2 id="generator-title">Password generator</h2>
          </div>

          <button
            type="button"
            className="dashboard-icon-button"
            onClick={() => setGeneratorOpen(false)}
            aria-label="Close password generator"
          >
            <X size={20} />
          </button>
        </header>

        <p className="dashboard-generator-description">
          Generate a random password using your browser's cryptographic
          random-number generator.
        </p>

        <label className="dashboard-generator-label" htmlFor="password-length">
          Password length <strong>{passwordLength} characters</strong>
        </label>

        <input
          id="password-length"
          className="dashboard-generator-range"
          type="range"
          min="12"
          max="64"
          value={passwordLength}
          onChange={(event) => setPasswordLength(Number(event.target.value))}
        />

        <div className="dashboard-generator-output">
          <code>{generatedPassword || "Generate a password"}</code>

          <button
            type="button"
            className="dashboard-icon-button"
            onClick={copyGeneratedPassword}
            disabled={!generatedPassword}
            aria-label="Copy generated password"
          >
            <Copy size={18} />
          </button>
        </div>

        <button
          type="button"
          className="dashboard-generator-refresh"
          onClick={generateNewPassword}
        >
          <RefreshCw size={17} aria-hidden="true" />
          Generate another
        </button>

        <div className="dashboard-generator-notice">
          <ShieldAlert size={18} aria-hidden="true" />
          <p>
            Save generated passwords in your vault if you want to keep
            them. Closing this window doesn't save them automatically.
          </p>
        </div>
      </section>
    </div>
  )}
</main>

);
}

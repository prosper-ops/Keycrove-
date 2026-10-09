import { useState } from "react";
import {
ArrowDownRight,
ArrowRight,
ArrowUpRight,
Check,
ChevronRight,
Fingerprint,
KeyRound,
LockKeyhole,
Menu,
ShieldCheck,
Sparkles,
X,
} from "lucide-react";

import { apiPost } from "./api";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";

const features = [
{
icon: LockKeyhole,
number: "01",
title: "A home for your credentials",
description:
"Bring your login details together in one organized place instead of searching through scattered notes and browser tabs.",
},
{
icon: KeyRound,
number: "02",
title: "Stronger passwords, less effort",
description:
"Create a dedicated password generator experience with customizable options for different account requirements.",
},
{
icon: Fingerprint,
number: "03",
title: "Security built into the design",
description:
"Develop account protection, carefully designed access controls, and a vault encryption system as core parts of the product.",
},
];

const previewEntries = [
{
initials: "G",
name: "Google",
username: "alex@example.com",
category: "Personal",
iconClass: "entry-google",
},
{
initials: "G",
name: "GitHub",
username: "developer@example.com",
category: "Development",
iconClass: "entry-github",
},
{
initials: "N",
name: "Netflix",
username: "viewer@example.com",
category: "Entertainment",
iconClass: "entry-netflix",
},
];

function Logo() {
return (
<a className="brand" href="#home" aria-label="KeyCrove home">
<span className="brand-mark" aria-hidden="true">
<LockKeyhole size={21} strokeWidth={1.8} />
</span>

  <span className="brand-name">
    Key<span>Crove</span>
  </span>
</a>

);
}

function VaultPreview() {
return (
<div className="vault-visual">
<div className="visual-orbit orbit-one" aria-hidden="true" />
<div className="visual-orbit orbit-two" aria-hidden="true" />

  <div className="vault-card">
    <div className="vault-card-top">
      <div>
        <span className="eyebrow">YOUR DIGITAL SPACE</span>
        <h2>My vault</h2>
      </div>

      <span className="vault-status">
        <span className="status-dot" />
        Interface preview
      </span>
    </div>

    <div className="vault-overview">
      <div className="vault-icon">
        <ShieldCheck size={25} strokeWidth={1.7} />
      </div>

      <div className="vault-overview-copy">
        <span>Saved accounts</span>
        <strong>
          03 <span>sample entries</span>
        </strong>
      </div>

      <div className="vault-sparkle" aria-hidden="true">
        <Sparkles size={19} />
      </div>
    </div>

    <div className="vault-search">
      <span className="search-symbol" aria-hidden="true">
        ⌕
      </span>
      <span>Find an account...</span>
      <span className="search-shortcut">⌘ K</span>
    </div>

    <div className="vault-list-heading">
      <span>RECENT ENTRIES</span>
      <span>PREVIEW</span>
    </div>

    <div className="vault-entries">
      {previewEntries.map((entry) => (
        <div className="vault-entry" key={entry.name}>
          <div className={`entry-icon ${entry.iconClass}`}>
            {entry.initials}
          </div>

          <div className="entry-details">
            <strong>{entry.name}</strong>
            <span>{entry.username}</span>
          </div>

          <div
            className="entry-password"
            aria-label="Sample masked password"
          >
            ••••••••
          </div>
        </div>
      ))}
    </div>

    <div className="vault-card-bottom">
      <div className="vault-bottom-icon">
        <LockKeyhole size={15} />
      </div>

      <span>Illustrative interface · No real credentials</span>

      <ArrowUpRight size={16} />
    </div>
  </div>

  <div className="floating-note floating-note-top">
    <span className="floating-note-icon">
      <KeyRound size={17} />
    </span>

    <span>
      <strong>Your keys, organized</strong>
      <small>Everything in one place</small>
    </span>
  </div>

  <div className="floating-note floating-note-bottom">
    <span className="floating-note-icon">
      <ShieldCheck size={18} />
    </span>

    <span>
      <strong>Security comes first</strong>
      <small>Built with protection in mind</small>
    </span>

    <Check size={16} className="floating-check" />
  </div>
</div>

);
}

function FeatureCard({ feature }) {
const Icon = feature.icon;

return (
<article className="feature-card">
<div className="feature-card-top">
<span className="feature-icon">
<Icon size={23} strokeWidth={1.7} />
</span>

    <span className="feature-number">{feature.number}</span>
  </div>

  <h3>{feature.title}</h3>

  <p>{feature.description}</p>

  <a href="#approach" className="feature-link">
    Explore our approach
    <ArrowUpRight size={16} />
  </a>
</article>

);
}

function HomePage({ onNavigate }) {
const [menuOpen, setMenuOpen] = useState(false);

function closeMenu() {
setMenuOpen(false);
}

function navigateTo(page) {
closeMenu();
onNavigate(page);
window.scrollTo({ top: 0, behavior: "auto" });
}

return (
<div className="site-shell" id="home">
<header className="site-header">
<div className="header-inner">
<Logo />

      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={
          menuOpen ? "Close navigation menu" : "Open navigation menu"
        }
        aria-expanded={menuOpen}
        aria-controls="main-navigation"
      >
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <nav
        className={`main-navigation ${
          menuOpen ? "navigation-open" : ""
        }`}
        id="main-navigation"
        aria-label="Main navigation"
      >
        <a href="#home" onClick={closeMenu}>
          Home
        </a>

        <a href="#features" onClick={closeMenu}>
          Features
        </a>

        <a href="#approach" onClick={closeMenu}>
          Our approach
        </a>

        <a
          href="#login"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("login");
          }}
        >
          Log in
        </a>

        <a
          href="#signup"
          className="nav-cta"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("signup");
          }}
        >
          Get started
          <ArrowUpRight size={16} />
        </a>
      </nav>
    </div>
  </header>

  <main>
    <section className="hero-section">
      <div className="hero-background-glow" aria-hidden="true" />

      <div className="hero-grid">
        <div className="hero-copy">
          <div className="announcement-pill">
            <span className="announcement-dot" />
            <span>A new approach to password management</span>
            <ChevronRight size={14} />
          </div>

          <h1>
            Your digital life.
            <br />
            <span>Under your control.</span>
          </h1>

          <p className="hero-description">
            Meet a more organized way to manage your digital credentials.
            KeyCrove is being built around a simple idea: your online
            accounts deserve a dedicated place and a thoughtful approach
            to security.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => navigateTo("signup")}
            >
              Get started
              <ArrowRight size={17} />
            </button>

            <a href="#approach" className="button button-secondary">
              Our security approach
              <ArrowDownRight size={17} />
            </a>
          </div>

          <div className="hero-footnote">
            <ShieldCheck size={17} />
            <span>
              Designed with privacy and security as priorities
            </span>
          </div>

          <div className="hero-divider" />

          <div className="hero-stat-row">
            <div className="hero-stat">
              <strong>One place.</strong>
              <span>Your credentials, organized.</span>
            </div>

            <div className="hero-stat">
              <strong>One clear goal.</strong>
              <span>Make password management simpler.</span>
            </div>
          </div>
        </div>

        <VaultPreview />
      </div>

      <div className="hero-bottom-label">
        <span>01 / A BETTER WAY TO MANAGE ACCESS</span>
        <span>SCROLL TO EXPLORE ↓</span>
      </div>
    </section>

    <section className="features-section" id="features">
      <div className="section-heading">
        <div className="section-heading-copy">
          <span className="eyebrow">THE KEYCROVE EXPERIENCE</span>

          <h2>
            Less scattered.
            <br />
            <span>More in control.</span>
          </h2>
        </div>

        <p>
          Your digital accounts are part of everyday life. Managing them
          shouldn't mean juggling scattered details, forgotten passwords,
          and unnecessary confusion.
        </p>
      </div>

      <div className="features-grid">
        {features.map((feature) => (
          <FeatureCard feature={feature} key={feature.number} />
        ))}
      </div>
    </section>

    <section className="approach-section" id="approach">
      <div className="approach-visual">
        <div className="approach-ring ring-outer" aria-hidden="true" />
        <div className="approach-ring ring-inner" aria-hidden="true" />

        <div className="approach-lock">
          <LockKeyhole size={43} strokeWidth={1.4} />
        </div>

        <span className="approach-orbit-label orbit-label-one">
          PRIVACY
        </span>

        <span className="approach-orbit-label orbit-label-two">
          CONTROL
        </span>

        <span className="approach-orbit-label orbit-label-three">
          SECURITY
        </span>
      </div>

      <div className="approach-copy">
        <span className="eyebrow">BUILT ON THE RIGHT PRINCIPLES</span>

        <h2>
          Security isn't
          <br />
          <span>just a feature.</span>
        </h2>

        <p>
          A password manager has a responsibility to handle sensitive
          information carefully. That means making considered decisions
          about encryption, authentication, data access, and recovery
          before asking people to trust it with their credentials.
        </p>

        <ul className="approach-list">
          <li>
            <Check size={17} />
            <span>Thoughtful protection of sensitive information</span>
          </li>

          <li>
            <Check size={17} />
            <span>Clear boundaries around account access</span>
          </li>

          <li>
            <Check size={17} />
            <span>Security features that must be tested, not assumed</span>
          </li>
        </ul>

        <a href="#get-started" className="text-link">
          Discover the project
          <ArrowRight size={17} />
        </a>
      </div>
    </section>

    <section className="closing-section" id="get-started">
      <div className="closing-glow" aria-hidden="true" />

      <span className="eyebrow">INTRODUCING KEYCROVE</span>

      <h2>
        Take a more
        <br />
        <span>considered approach.</span>
      </h2>

      <p>
        We're building KeyCrove one carefully considered step at a time,
        from the interface to the security architecture behind it.
      </p>

      <button
        type="button"
        className="button button-primary closing-button"
        onClick={() => navigateTo("signup")}
      >
        Create your account
        <ArrowUpRight size={17} />
      </button>

      <span className="closing-note">
        KeyCrove is under development. Account registration, secure vault
        storage, and encryption must be connected and tested before the
        service is ready for real credentials.
      </span>
    </section>
  </main>

  <footer className="site-footer">
    <div className="footer-main">
      <div className="footer-brand">
        <Logo />

        <p>
          A thoughtful approach to organizing and protecting your
          digital credentials.
        </p>
      </div>

      <div className="footer-links">
        <span className="footer-label">EXPLORE</span>
        <a href="#home">Home</a>
        <a href="#features">Features</a>
        <a href="#approach">Security approach</a>

        <button type="button" onClick={() => navigateTo("login")}>
          Log in
        </button>

        <button type="button" onClick={() => navigateTo("signup")}>
          Create an account
        </button>
      </div>

      <div className="footer-note">
        <span className="footer-label">THE PRINCIPLE</span>
        <p>
          Build with care.
          <br />
          Protect by design.
        </p>
      </div>
    </div>

    <div className="footer-bottom">
      <span>© {new Date().getFullYear()} KeyCrove</span>
      <span>Built with intention.</span>
    </div>
  </footer>
</div>

);
}

export default function App() {
const [view, setView] = useState(() => {
const params = new URLSearchParams(window.location.search);

if (params.has("token")) {
  return "reset-password";
}

return "home";

});

function navigateTo(page) {
setView(page);
window.scrollTo({ top: 0, behavior: "auto" });
}

async function handleLogout() {
try {
await apiPost("/api/auth/logout", {});
} catch {
// The backend logout endpoint will be implemented with authentication.
// The interface must not claim that a server session was revoked here.
} finally {
navigateTo("login");
}
}

if (view === "login") {
return (
<Login
onLogin={() => navigateTo("dashboard")}
onNavigate={navigateTo}
/>
);
}

if (view === "signup") {
return (
<Signup
onSignup={() => navigateTo("login")}
onNavigate={navigateTo}
/>
);
}

if (view === "forgot-password") {
return <ForgotPassword onNavigate={navigateTo} />;
}

if (view === "reset-password") {
return <ResetPassword onNavigate={navigateTo} />;
}

if (view === "dashboard") {
return (
<Dashboard
onLogout={handleLogout}
onNavigate={navigateTo}
/>
);
}

return <HomePage onNavigate={navigateTo} />;
}

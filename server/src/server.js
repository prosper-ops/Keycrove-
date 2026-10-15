import "dotenv/config";

import express from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import {
  pool,
  testDatabaseConnection,
  closeDatabaseConnection,
} from "./db.js";

import authRoutes from "./routes/auth.js";
import vaultRoutes from "./routes/vault.js";
import webauthnRoutes from "./routes/webauthn.js";

const app = express();

const PORT = Number(process.env.PORT || 4000);
const APP_ORIGIN = process.env.APP_ORIGIN;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

if (!APP_ORIGIN) {
  throw new Error(
    "APP_ORIGIN must be configured in the environment."
  );
}

if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.length < 32
) {
  throw new Error(
    "SESSION_SECRET must be configured with at least 32 characters."
  );
}

if (!process.env.KEYCROVE_ENCRYPTION_KEY) {
  throw new Error(
    "KEYCROVE_ENCRYPTION_KEY must be configured."
  );
}

if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(
  cors({
    origin: APP_ORIGIN,
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "X-CSRF-Token",
    ],
  })
);

app.use(
  express.json({
    limit: "100kb",
  })
);

const PgSession = pgSession(session);

app.use(
  session({
    name: "keycrove.sid",

    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),

    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,

    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    error:
      "Too many authentication requests. Please try again later.",
  },
});

const webauthnLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    error:
      "Too many passkey requests. Please try again later.",
  },
});

app.get("/", (_req, res) => {
  res.json({
    name: "KeyCrove API",
    status: "running",
    version: "1.0.0",

    endpoints: {
      health: "/health",
      authentication: "/api/auth",
      passkeys: "/api/webauthn",
      vault: "/api/vault",
    },
  });
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "healthy",
      database: "connected",
    });
  } catch {
    res.status(503).json({
      status: "unavailable",
      database: "disconnected",
    });
  }
});

app.use("/api/auth", authLimiter, authRoutes);

app.use(
  "/api/webauthn",
  webauthnLimiter,
  webauthnRoutes
);

app.use("/api/vault", vaultRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: "The requested API endpoint was not found.",
  });
});

app.use((err, _req, res, _next) => {
  console.error(
    "API request failed:",
    err.message
  );

  res.status(err.status || 500).json({
    error:
      isProduction && (err.status || 500) >= 500
        ? "An unexpected server error occurred."
        : err.message ||
          "An unexpected server error occurred.",
  });
});

let server;

async function startServer() {
  try {
    await testDatabaseConnection();

    server = app.listen(PORT, () => {
      console.log(
        `KeyCrove API is listening on port ${PORT}`
      );

      console.log(`Environment: ${NODE_ENV}`);
    });
  } catch (error) {
    console.error(
      "KeyCrove could not start:",
      error.message
    );

    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(
    `${signal} received. Shutting down KeyCrove...`
  );

  if (server) {
    server.close();
  }

  try {
    await closeDatabaseConnection();
  } catch (error) {
    console.error(
      "Error closing the database:",
      error.message
    );
  }

  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("SIGINT", () => shutdown("SIGINT"));

startServer();

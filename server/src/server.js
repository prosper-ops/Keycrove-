import "dotenv/config";

import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import {
  pool,
  testDatabaseConnection,
  closeDatabaseConnection,
} from "./db.js";

const app = express();

const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

const APP_ORIGIN = process.env.APP_ORIGIN?.trim();
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("The configured server port is invalid.");
}

if (!APP_ORIGIN) {
  throw new Error(
    "APP_ORIGIN is missing. Configure the trusted frontend origin."
  );
}

let parsedAppOrigin;

try {
  parsedAppOrigin = new URL(APP_ORIGIN);
} catch {
  throw new Error("APP_ORIGIN must be a valid URL.");
}

if (
  !["http:", "https:"].includes(parsedAppOrigin.protocol) ||
  parsedAppOrigin.origin !== APP_ORIGIN
) {
  throw new Error(
    "APP_ORIGIN must contain only the frontend origin, without a path or trailing slash."
  );
}

if (
  IS_PRODUCTION &&
  parsedAppOrigin.protocol !== "https:"
) {
  throw new Error(
    "Production deployments must use an HTTPS frontend origin."
  );
}

if (
  typeof SESSION_SECRET !== "string" ||
  Buffer.byteLength(SESSION_SECRET, "utf8") < 32
) {
  throw new Error(
    "SESSION_SECRET must contain at least 32 bytes of secret material."
  );
}

/*
 * Only enable proxy trust when the deployment is behind a
 * correctly configured trusted reverse proxy.
 *
 * Set TRUST_PROXY=true only when your hosting environment
 * requires this configuration.
 */
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

/*
 * Security headers.
 *
 * This server provides an API. The client application is
 * hosted separately and communicates with it over HTTP(S).
 */
app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

/*
 * Allow browser requests only from the configured frontend.
 *
 * Credentials are needed because KeyCrove uses session cookies.
 */
app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header may include health
      // checks or non-browser clients. Authentication is still
      // required for protected endpoints.
      if (!origin || origin === APP_ORIGIN) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed."));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    maxAge: 600,
  })
);

/*
 * Reject requests with oversized JSON bodies.
 * Vault entries should be kept reasonably small.
 */
app.use(
  express.json({
    limit: "100kb",
    strict: true,
  })
);

/*
 * Basic request throttling.
 *
 * Authentication routes should also receive a dedicated,
 * stricter rate limit when we implement them.
 */
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
    },
  },
});

app.use("/api", generalApiLimiter);

/*
 * PostgreSQL-backed sessions.
 *
 * Session data is stored on the server rather than trusted
 * directly from a client-controlled cookie.
 */
const PgSessionStore = connectPgSimple(session);

const sessionStore = new PgSessionStore({
  pool,
  tableName: "user_sessions",
  createTableIfMissing: true,
  pruneSessionInterval: 15 * 60,
});

app.use(
  session({
    name: "keycrove.sid",
    secret: SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    },
  })
);

/*
 * Health endpoint.
 *
 * This checks whether the server and database are available.
 * It does not disclose database credentials or error details.
 */
app.get("/api/health", async (req, res) => {
  try {
    await testDatabaseConnection();

    return res.status(200).json({
      success: true,
      data: {
        status: "ok",
        database: "connected",
      },
    });
  } catch {
    return res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "The service is temporarily unavailable.",
      },
    });
  }
});

/*
 * Temporary root endpoint.
 */
app.get("/", (req, res) => {
  res.status(200).json({
    name: "KeyCrove API",
    status: "running",
  });
});

/*
 * Temporary 404 handler.
 *
 * Authentication and vault routes will be mounted here after
 * their files have been created.
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "The requested endpoint was not found.",
    },
  });
});

/*
 * Central error handler.
 *
 * Do not expose internal exceptions, SQL errors, or secrets
 * in responses sent to clients.
 */
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.message === "Origin not allowed.") {
    return res.status(403).json({
      success: false,
      error: {
        code: "ORIGIN_NOT_ALLOWED",
        message: "This origin is not allowed.",
      },
    });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "The request contains invalid JSON.",
      },
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: {
        code: "REQUEST_TOO_LARGE",
        message: "The request body is too large.",
      },
    });
  }

  console.error("KeyCrove encountered an unexpected server error.");

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred.",
    },
  });
});

/*
 * Start the server only after confirming that PostgreSQL
 * is reachable.
 */
let httpServer;
let shuttingDown = false;

async function startServer() {
  await testDatabaseConnection();

  httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`KeyCrove API listening on port ${PORT}`);
  });
}

/*
 * Graceful shutdown.
 *
 * Stop accepting requests

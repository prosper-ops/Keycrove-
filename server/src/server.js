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

import authRoutes from "./routes/auth.js";
import vaultRoutes from "./routes/vault.js";

const app = express();

/*
|--------------------------------------------------------------------------
| CONFIGURATION
|--------------------------------------------------------------------------
*/

const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

const APP_ORIGIN = process.env.APP_ORIGIN?.trim();
const SESSION_SECRET = process.env.SESSION_SECRET;

/*
|--------------------------------------------------------------------------
| ENVIRONMENT VALIDATION
|--------------------------------------------------------------------------
*/

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
|--------------------------------------------------------------------------
| TRUSTED PROXY CONFIGURATION
|--------------------------------------------------------------------------
*/

if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

/*
|--------------------------------------------------------------------------
| SECURITY HEADERS
|--------------------------------------------------------------------------
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
|--------------------------------------------------------------------------
| CORS CONFIGURATION
|--------------------------------------------------------------------------
|
| Only the configured frontend origin is allowed to make
| browser requests with credentials.
|
*/

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === APP_ORIGIN) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed."));
    },

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

    maxAge: 600,
  })
);

/*
|--------------------------------------------------------------------------
| REQUEST BODY PARSING
|--------------------------------------------------------------------------
*/

app.use(
  express.json({
    limit: "100kb",
    strict: true,
  })
);

/*
|--------------------------------------------------------------------------
| GENERAL API RATE LIMITING
|--------------------------------------------------------------------------
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

      message:
        "Too many requests. Please try again later.",
    },
  },
});

app.use("/api", generalApiLimiter);

/*
|--------------------------------------------------------------------------
| DATABASE-BACKED SESSIONS
|--------------------------------------------------------------------------
|
| The browser receives a session cookie.
| Session information is stored on the server.
|
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

      sameSite: IS_PRODUCTION ? "none" : "lax",

      maxAge: 8 * 60 * 60 * 1000,

      path: "/",
    },
  })
);

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
|
| GET /api/health
|
| Checks whether the API and PostgreSQL database are available.
|
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

        message:
          "The service is temporarily unavailable.",
      },
    });
  }
});

/*
|--------------------------------------------------------------------------
| API ROOT
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  return res.status(200).json({
    name: "KeyCrove API",

    status: "running",

    message: "The KeyCrove API is available.",

    endpoints: {
      health: "/api/health",

      authentication: "/api/auth",

      vault: "/api/vault",
    },
  });
});

/*
|--------------------------------------------------------------------------
| AUTHENTICATION ROUTES
|--------------------------------------------------------------------------
|
| POST /api/auth/register
| POST /api/auth/login
| POST /api/auth/logout
| GET  /api/auth/me
| POST /api/auth/forgot-password
| POST /api/auth/reset-password
|
*/

app.use("/api/auth", authRoutes);

/*
|--------------------------------------------------------------------------
| PASSWORD VAULT ROUTES
|--------------------------------------------------------------------------
|
| GET    /api/vault
| POST   /api/vault
| PUT    /api/vault/:id
| DELETE /api/vault/:id
|
| The vault router requires authentication for its operations.
|
*/

app.use("/api/vault", vaultRoutes);

/*
|--------------------------------------------------------------------------
| NOT FOUND HANDLER
|--------------------------------------------------------------------------
|
| Requests that do not match an available endpoint reach here.
|
*/

app.use((req, res) => {
  return res.status(404).json({
    success: false,

    error: {
      code: "NOT_FOUND",

      message: "The requested endpoint was not found.",
    },
  });
});

/*
|--------------------------------------------------------------------------
| CENTRAL ERROR HANDLER
|--------------------------------------------------------------------------
|
| Keep internal exceptions, SQL errors, and secrets out of
| responses sent to clients.
|
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

        message:
          "The request contains invalid JSON.",
      },
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,

      error: {
        code: "REQUEST_TOO_LARGE",

        message:
          "The request body is too large.",
      },
    });
  }

  console.error(
    "KeyCrove encountered an unexpected server error."
  );

  return res.status(500).json({
    success: false,

    error: {
      code: "INTERNAL_SERVER_ERROR",

      message:
        "An unexpected server error occurred.",
    },
  });
});

/*
|--------------------------------------------------------------------------
| SERVER STARTUP
|--------------------------------------------------------------------------
*/

let httpServer;

let shuttingDown = false;

async function startServer() {
  await testDatabaseConnection();

  httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `KeyCrove API listening on port ${PORT}`
    );
  });

  httpServer.on("error", () => {
    console.error(
      "KeyCrove could not start its HTTP server."
    );

    process.exitCode = 1;
  });
}

/*
|--------------------------------------------------------------------------
| GRACEFUL SHUTDOWN
|--------------------------------------------------------------------------
|
| Stop accepting new connections and close the database pool.
|
*/

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(
    `KeyCrove received ${signal}. Shutting down.`
  );

  try {
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(() => resolve());
      });
    }

    await closeDatabaseConnection();

    console.log("KeyCrove shut down successfully.");

    process.exitCode = 0;
  } catch {
    console.error(
      "KeyCrove encountered an error during shutdown."
    );

    process.exitCode = 1;
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

/*
|--------------------------------------------------------------------------
| START THE APPLICATION
|--------------------------------------------------------------------------
*/

startServer().catch(async () => {
  console.error(
    "KeyCrove could not start. Check the server configuration and database connection."
  );

  try {
    await closeDatabaseConnection();
  } catch {
    console.error(
      "KeyCrove could not close the database connection cleanly."
    );
  }

  process.exitCode = 1;
});

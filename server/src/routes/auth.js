import { Router } from "express";
import argon2 from "argon2";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";

import { query, pool } from "../db.js";
import { sendPasswordResetEmail } from "../mailer.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/*
 * Authentication-specific rate limits.
 *
 * These limits help reduce automated login attempts and
 * password-reset abuse. Production deployments should also
 * consider limits at the hosting or reverse-proxy layer.
 */

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "LOGIN_RATE_LIMITED",
      message: "Too many login attempts. Please try again later.",
    },
  },
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "REGISTRATION_RATE_LIMITED",
      message: "Too many registration attempts. Please try again later.",
    },
  },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RESET_RATE_LIMITED",
      message: "Too many password-reset requests. Please try again later.",
    },
  },
});

/*
 * Validation schemas.
 */

const registrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name must not exceed 100 characters."),

  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254, "Email address is too long."),

  password: z
    .string()
    .min(12, "Password must contain at least 12 characters.")
    .max(128, "Password must not exceed 128 characters."),
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254),

  password: z
    .string()
    .min(1)
    .max(128),
});

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254),
});

const resetPasswordSchema = z.object({
  token: z
    .string()
    .min(32)
    .max(256),

  password: z
    .string()
    .min(12, "Password must contain at least 12 characters.")
    .max(128, "Password must not exceed 128 characters."),
});

/*
 * Helpers.
 */

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function hashResetToken(token) {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

function sendValidationError(res, error) {
  return res.status(400).json({
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: error.issues[0]?.message || "Invalid request data.",
    },
  });
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      resolve();
      return;
    }

    req.session.destroy((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function clearSessionCookie(res) {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie("keycrove.sid", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}

/*
 * POST /api/auth/register
 *
 * Creates an account using an Argon2id password hash.
 * The original password is never stored in the database.
 */

router.post("/register", registrationLimiter, async (req, res) => {
  const parsed = registrationSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  const name = parsed.data.name;
  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;

  try {
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const result = await query(
      `
        INSERT INTO users (name, email, password_hash)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        RETURNING id, name, email, created_at
      `,
      [name, email, passwordHash]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: "ACCOUNT_EXISTS",
          message: "An account with this email address already exists.",
        },
      });
    }

    return res.status(201).json({
      success: true,
      message: "Your account has been created. You can now log in.",
      data: {
        user: result.rows[0],
      },
    });
  } catch {
    console.error("KeyCrove account registration failed.");

    return res.status(500).json({
      success: false,
      error: {
        code: "REGISTRATION_FAILED",
        message: "We could not create your account. Please try again.",
      },
    });
  }
});

/*
 * POST /api/auth/login
 *
 * Verifies account credentials and creates a fresh session.
 * Regenerating the session helps prevent session fixation.
 */

router.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CREDENTIALS",
        message: "The email or password is incorrect.",
      },
    });
  }

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;

  try {
    const result = await query(
      `
        SELECT id, name, email, password_hash, created_at
        FROM users
        WHERE LOWER(email) = $1
        LIMIT 1
      `,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "The email or password is incorrect.",
        },
      });
    }

    const user = result.rows[0];

    const passwordMatches = await argon2.verify(
      user.password_hash,
      password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "The email or password is incorrect.",
        },
      });
    }

    await regenerateSession(req);

    req.session.userId = user.id;

    await saveSession(req);

    return res.status(200).json({
      success: true,
      message: "You have logged in successfully.",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at,
        },
      },
    });
  } catch {
    console.error("KeyCrove login failed.");

    return res.status(500).json({
      success: false,
      error: {
        code: "LOGIN_FAILED",
        message: "We could not complete your login. Please try again.",
      },
    });
  }
});

/*
 * POST /api/auth/logout
 *
 * Destroys the authenticated session and clears its cookie.
 */

router.post("/logout", requireAuth, async (req, res) => {
  try {
    await destroySession(req);
    clearSessionCookie(res);

    return res.status(200).json({
      success: true,
      message: "You have logged out successfully.",
    });
  } catch {
    console.error("KeyCrove logout failed.");

    return res.status(500).json({
      success: false,
      error: {
        code: "LOGOUT_FAILED",
        message: "We could not complete your logout. Please try again.",
      },
    });
  }
});

/*
 * GET /api/auth/me
 *
 * Returns the current authenticated user's public account details.
 */

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `
        SELECT id, name, email, created_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [req.session.userId]
    );

    if (result.rowCount === 0) {
      await destroySession(req);
      clearSessionCookie(res);

      return res.status(401).json({
        success: false,
        error: {
          code: "SESSION_INVALID",
          message: "Please log in again.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: result.rows[0],
      },
    });
  } catch {
    console.error("KeyCrove session verification failed.");

    return res.status(500).json({
      success: false,
      error: {
        code: "SESSION_CHECK_FAILED",
        message: "We could not verify

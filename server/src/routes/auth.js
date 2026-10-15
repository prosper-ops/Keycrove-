import { Router } from "express";
import argon2 from "argon2";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";

import { query, pool } from "../db.js";
import { sendPasswordResetEmail } from "../mailer.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/* -----------------------------------------------
   RATE LIMITING
------------------------------------------------ */

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

/* -----------------------------------------------
   VALIDATION
------------------------------------------------ */

const registrationSchema = z.object({
  name: z.string().trim().min(1).max(100),

  email: z.string().trim().email().max(254),

  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),

  password: z.string().min(1).max(128),
});

const emailSchema = z.object({
  email: z.string().trim().email().max(254),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),

  password: z.string().min(8).max(128),
});

/* -----------------------------------------------
   HELPERS
------------------------------------------------ */

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function hashResetToken(token) {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

function validationError(res, error) {
  return res.status(400).json({
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message:
        error.issues?.[0]?.message ||
        "Please check the information you entered.",
    },
  });
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error);
      else resolve();
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
      if (error) reject(error);
      else resolve();
    });
  });
}

function clearSessionCookie(res) {
  res.clearCookie("keycrove.sid", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

function genericRecoveryResponse(res) {
  return res.status(200).json({
    success: true,
    message:
      "If an account exists with that email address, password-reset instructions will be sent.",
  });
}

/* -----------------------------------------------
   REGISTER
   POST /api/auth/register
------------------------------------------------ */

router.post(
  "/register",
  registrationLimiter,
  async (req, res) => {
    const parsed = registrationSchema.safeParse(req.body);

    if (!parsed.success) {
      return validationError(res, parsed.error);
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
            message:
              "An account with this email address already exists.",
          },
        });
      }

      return res.status(201).json({
        success: true,
        message:
          "Your account has been created. You can now log in.",
        data: {
          user: result.rows[0],
        },
      });
    } catch {
      console.error("KeyCrove registration failed.");

      return res.status(500).json({
        success: false,
        error: {
          code: "REGISTRATION_FAILED",
          message:
            "We could not create your account. Please try again.",
        },
      });
    }
  }
);

/* -----------------------------------------------
   LOGIN
   POST /api/auth/login
------------------------------------------------ */

router.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(401).json({
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
        message:
          "We could not complete your login. Please try again.",
      },
    });
  }
});

/* -----------------------------------------------
   LOGOUT
   POST /api/auth/logout
------------------------------------------------ */

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
        message:
          "We could not complete your logout. Please try again.",
      },
    });
  }
});

/* -----------------------------------------------
   CURRENT USER
   GET /api/auth/me
------------------------------------------------ */

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
        message:
          "We could not verify your session. Please try again.",
      },
    });
  }
});

/* -----------------------------------------------
   REQUEST PASSWORD RESET
   POST /api/auth/forgot-password
------------------------------------------------ */

router.post(
  "/forgot-password",
  passwordResetLimiter,
  async (req, res) => {
    const parsed = emailSchema.safeParse(req.body);

    if (!parsed.success) {
      return validationError(res, parsed.error);
    }

    const email = normalizeEmail(parsed.data.email);

    try {
      const result = await query(
        `
          SELECT id, email
          FROM users
          WHERE LOWER(email) = $1
          LIMIT 1
        `,
        [email]
      );

      /*
       * Always return the same public response, whether or
       * not the account exists. This helps prevent account
       * enumeration.
       */

      if (result.rowCount === 0) {
        return genericRecoveryResponse(res);
      }

      const user = result.rows[0];

      const token = randomBytes(32).toString("hex");
      const tokenHash = hashResetToken(token);

      await query(
        `
          DELETE FROM password_reset_tokens
          WHERE user_id = $1
        `,
        [user.id]
      );

      await query(
        `
          INSERT INTO password_reset_tokens
            (user_id, token_hash, expires_at)
          VALUES
            ($1, $2, NOW() + INTERVAL '30 minutes')
        `,
        [user.id, tokenHash]
      );

      const frontendOrigin = process.env.APP_ORIGIN;

      if (!frontendOrigin) {
        throw new Error("APP_ORIGIN is not configured.");
      }

      const resetUrl = new URL(frontendOrigin);
      resetUrl.searchParams.set("token", token);

      try {
        await sendPasswordResetEmail({
          to: user.email,
          resetUrl: resetUrl.href,
        });
      } catch {
        /*
         * Remove the unusable reset token if the email
         * could not be sent.
         */
        await query(
          `
            DELETE FROM password_reset_tokens
            WHERE token_hash = $1
          `,
          [tokenHash]
        );

        console.error(
          "KeyCrove could not send a password-reset email."
        );
      }

      return genericRecoveryResponse(res);
    } catch {
      console.error("KeyCrove password recovery failed.");

      return res.status(500).json({
        success: false,
        error: {
          code: "RECOVERY_FAILED",
          message:
            "We could not process your request. Please try again.",
        },
      });
    }
  }
);

/* -----------------------------------------------
   RESET PASSWORD
   POST /api/auth/reset-password
------------------------------------------------ */

router.post(
  "/reset-password",
  passwordResetLimiter,
  async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      return validationError(res, parsed.error);
    }

    const tokenHash = hashResetToken(parsed.data.token);
    const newPassword = parsed.data.password;

    let client;

    try {
      client = await pool.connect();

      await client.query("BEGIN");

      const tokenResult = await client.query(
        `
          SELECT id, user_id
          FROM password_reset_tokens
          WHERE token_hash = $1
            AND expires_at > NOW()
            AND used_at IS NULL
          FOR UPDATE
        `,
        [tokenHash]
      );

      if (tokenResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          error: {
            code: "RESET_TOKEN_INVALID",
            message:
              "This reset link is invalid or has expired. Please request a new one.",
          },
        });
      }

      const resetRecord = tokenResult.rows[0];

      const passwordHash = await argon2.hash(newPassword, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });

      await client.query(
        `
          UPDATE users
          SET password_hash = $1,
              updated_at = NOW()
          WHERE id = $2
        `,
        [passwordHash, resetRecord.user_id]
      );

      await client.query(
        `
          UPDATE password_reset_tokens
          SET used_at = NOW()
          WHERE id = $1
        `,
        [resetRecord.id]
      );

      /*
       * Invalidate any other outstanding reset links
       * for this account.
       */
      await client.query(
        `
          DELETE FROM password_reset_tokens
          WHERE user_id = $1
            AND id <> $2
        `,
        [resetRecord.user_id, resetRecord.id]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message:
          "Your password has been updated. You can now log in.",
      });
    } catch {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the original failure.
        }
      }

      console.error("KeyCrove password reset failed.");

      return res.status(500).json({
        success: false,
        error: {
          code: "PASSWORD_RESET_FAILED",
          message:
            "We could not reset your password. Please try again.",
        },
      });
    } finally {
      client?.release();
    }
  }
);

export default router;

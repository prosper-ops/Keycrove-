import { Router } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const RP_NAME = process.env.RP_NAME || "KeyCrove";

const APP_ORIGIN = process.env.APP_ORIGIN;

if (!APP_ORIGIN) {
  throw new Error("APP_ORIGIN must be configured.");
}

const EXPECTED_ORIGIN = new URL(APP_ORIGIN).origin;

const RP_ID =
  process.env.RP_ID || new URL(APP_ORIGIN).hostname;

const SESSION_CHALLENGE_KEY = "webauthnChallenge";
const SESSION_USER_KEY = "webauthnUserId";
const SESSION_PURPOSE_KEY = "webauthnPurpose";

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
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

function clearChallenge(req) {
  delete req.session[SESSION_CHALLENGE_KEY];
  delete req.session[SESSION_USER_KEY];
  delete req.session[SESSION_PURPOSE_KEY];
}

function getCredentialTransports(transports) {
  if (!Array.isArray(transports)) return [];

  return transports.filter(
    (transport) => typeof transport === "string"
  );
}

/*
|--------------------------------------------------------------------------
| REGISTER A PASSKEY: GENERATE OPTIONS
|--------------------------------------------------------------------------
*/

router.post("/register/options", requireAuth, async (req, res) => {
  try {
    const userResult = await query(
      `SELECT id, name, email
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.session.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          message: "Please log in again.",
        },
      });
    }

    const user = userResult.rows[0];

    const credentialsResult = await query(
      `SELECT credential_id, transports
       FROM passkey_credentials
       WHERE user_id = $1`,
      [user.id]
    );

    const excludeCredentials = credentialsResult.rows.map(
      (credential) => ({
        id: credential.credential_id,
        transports: getCredentialTransports(
          credential.transports
        ),
      })
    );

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,

      userID: new TextEncoder().encode(String(user.id)),
      userName: user.email,
      userDisplayName: user.name,

      attestationType: "none",

      excludeCredentials,

      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    req.session[SESSION_CHALLENGE_KEY] = options.challenge;
    req.session[SESSION_USER_KEY] = String(user.id);
    req.session[SESSION_PURPOSE_KEY] = "register";

    await saveSession(req);

    return res.json({
      success: true,
      options,
    });
  } catch (error) {
    console.error("Passkey registration options failed:", error.message);

    return res.status(500).json({
      success: false,
      error: {
        message: "Unable to start passkey registration.",
      },
    });
  }
});

/*
|--------------------------------------------------------------------------
| REGISTER A PASSKEY: VERIFY RESPONSE
|--------------------------------------------------------------------------
*/

router.post("/register/verify", requireAuth, async (req, res) => {
  const expectedChallenge =
    req.session?.[SESSION_CHALLENGE_KEY];

  const expectedUserId =
    req.session?.[SESSION_USER_KEY];

  const purpose =
    req.session?.[SESSION_PURPOSE_KEY];

  if (
    !expectedChallenge ||
    !expectedUserId ||
    purpose !== "register" ||
    String(req.session.userId) !== expectedUserId
  ) {
    clearChallenge(req);

    return res.status(400).json({
      success: false,
      error: {
        message: "Registration expired. Please try again.",
      },
    });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      clearChallenge(req);
      await saveSession(req);

      return res.status(400).json({
        success: false,
        error: {
          message: "Passkey verification failed.",
        },
      });
    }

    const registrationInfo = verification.registrationInfo;
    const credential = registrationInfo.credential;

    const credentialId = credential.id;
    const publicKey = Buffer.from(credential.publicKey);
    const counter = credential.counter;

    const transports = getCredentialTransports(
      credential.transports
    );

    const deviceType = registrationInfo.credentialDeviceType;
    const backedUp = registrationInfo.credentialBackedUp;

    const userResult = await query(
      `SELECT id
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [expectedUserId]
    );

    if (userResult.rows.length === 0) {
      clearChallenge(req);
      await saveSession(req);

      return res.status(401).json({
        success: false,
        error: {
          message: "Please log in again.",
        },
      });
    }

    await query(
      `INSERT INTO passkey_credentials (
         user_id,
         credential_id,
         public_key,
         counter,
         transports,
         device_type,
         backed_up
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        expectedUserId,
        credentialId,
        publicKey,
        counter,
        transports,
        deviceType,
        backedUp,
      ]
    );

    clearChallenge(req);
    await saveSession(req);

    return res.json({
      success: true,
      message: "Passkey registered successfully.",
    });
  } catch (error) {
    clearChallenge(req);

    try {
      await saveSession(req);
    } catch {
      // The original error will be handled below.
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        error: {
          message: "This passkey is already registered.",
        },
      });
    }

    console.error("Passkey registration verification failed:", error.message);

    return res.status(400).json({
      success: false,
      error: {
        message: "Unable to verify this passkey. Please try again.",
      },
    });
  }
});

/*
|--------------------------------------------------------------------------
| SIGN IN WITH A PASSKEY: GENERATE OPTIONS
|--------------------------------------------------------------------------
*/

router.post("/login/options", async (req, res) => {
  try {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim()
        : "";

    if (!email || email.length > 254) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Enter a valid email address.",
        },
      });
    }

    const userResult = await query(
      `SELECT id
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Passkey sign-in is unavailable for this account.",
        },
      });
    }

    const userId = String(userResult.rows[0].id);

    const credentialsResult = await query(
      `SELECT credential_id, transports
       FROM passkey_credentials
       WHERE user_id = $1`,
      [userId]
    );

    if (credentialsResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Passkey sign-in is unavailable for this account.",
        },
      });
    }

    const allowCredentials = credentialsResult.rows.map(
      (credential) => ({
        id: credential.credential_id,
        transports: getCredentialTransports(
          credential.transports
        ),
      })
    );

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: "preferred",
    });

    clearChallenge(req);

    req.session[SESSION_CHALLENGE_KEY] = options.challenge;
    req.session[SESSION_USER_KEY] = userId;
    req.session[SESSION_PURPOSE_KEY] = "authenticate";

    await saveSession(req);

    return res.json({
      success: true,
      options,
    });
  } catch (error) {
    console.error("Passkey login options failed:", error.message);

    return res.status(500).json({
      success: false,
      error: {
        message: "Unable to start passkey sign-in.",
      },
    });
  }
});

/*
|--------------------------------------------------------------------------
| SIGN IN WITH A PASSKEY: VERIFY RESPONSE
|--------------------------------------------------------------------------
*/

router.post("/login/verify", async (req, res) => {
  const expectedChallenge =
    req.session?.[SESSION_CHALLENGE_KEY];

  const expectedUserId =
    req.session?.[SESSION_USER_KEY];

  const purpose =
    req.session?.[SESSION_PURPOSE_KEY];

  if (
    !expectedChallenge ||
    !expectedUserId ||
    purpose !== "authenticate"
  ) {
    clearChallenge(req);

    return res.status(400).json({
      success: false,
      error: {
        message: "Sign-in expired. Please try again.",
      },
    });
  }

  try {
    const credentialId = req.body?.id;

    if (
      typeof credentialId !== "string" ||
      credentialId.length === 0
    ) {
      clearChallenge(req);
      await saveSession(req);

      return res.status(400).json({
        success: false,
        error: {
          message: "Invalid passkey response.",
        },
      });
    }

    const credentialResult = await query(
      `SELECT
         id,
         user_id,
         credential_id,
         public_key,
         counter,
         transports
       FROM passkey_credentials
       WHERE credential_id = $1
         AND user_id = $2
       LIMIT 1`,
      [credentialId, expectedUserId]
    );

    if (credentialResult.rows.length === 0) {
      clearChallenge(req);
      await saveSession(req);

      return res.status(401).json({
        success: false,
        error: {
          message: "Passkey authentication failed.",
        },
      });
    }

    const storedCredential = credentialResult.rows[0];

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,

      credential: {
        id: storedCredential.credential_id,
        publicKey: new Uint8Array(storedCredential.public_key),
        counter: Number(storedCredential.counter),
        transports: getCredentialTransports(
          storedCredential.transports
        ),
      },

      requireUserVerification: false,
    });

    if (!verification.verified) {
      clearChallenge(req);
      await saveSession(req);

      return res.status(401).json({
        success: false,
        error: {
          message: "Passkey authentication failed.",
        },
      });
    }

    const newCounter =
      verification.authenticationInfo.newCounter;

    await query(
      `UPDATE passkey_credentials
       SET counter = $1,
           last_used_at = NOW()
       WHERE id = $2
         AND user_id = $3`,
      [
        newCounter,
        storedCredential.id,
        expectedUserId,
      ]
    );

    const userResult = await query(
      `SELECT id
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [expectedUserId]
    );

    if (userResult.rows.length === 0) {
      clearChallenge(req);
      await saveSession(req);

      return res.status(401).json({
        success: false,
        error: {
          message: "This account is unavailable.",
        },
      });
    }

    // Replace the pre-authentication session to prevent session fixation.
    await regenerateSession(req);

    req.session.userId = expectedUserId;

    await saveSession(req);

    return res.json({
      success: true,
      message: "Signed in successfully.",
    });
  } catch (error) {
    clearChallenge(req);

    try {
      await saveSession(req);
    } catch {
      // Preserve the original authentication error.
    }

    console.error("Passkey authentication failed:", error.message);

    return res.status(401).json({
      success: false,
      error: {
        message: "Passkey authentication failed. Please try again.",
      },
    });
  }
});

export default router;

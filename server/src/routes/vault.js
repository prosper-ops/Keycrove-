import { Router } from "express";
import { z } from "zod";

import { query } from "../db.js";
import { encryptJson, decryptJson } from "../crypto.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| VALIDATION
|--------------------------------------------------------------------------
*/

const entrySchema = z.object({
  type: z
    .enum([
      "password",
      "login",
      "secure-note",
      "identity",
      "card",
      "other",
    ])
    .default("password"),

  title: z.string().trim().min(1).max(120),

  username: z.string().max(254).default(""),

  password: z.string().max(4096).default(""),

  url: z.string().max(2048).default(""),

  notes: z.string().max(5000).default(""),
});

const entryIdSchema = z.string().uuid();

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function sendError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}

function validateEntryId(id) {
  return entryIdSchema.safeParse(id);
}

function prepareEntry(data) {
  return {
    type: data.type,
    title: data.title,
    username: data.username,
    password: data.password,
    url: data.url,
    notes: data.notes,
  };
}

function decryptEntry(row) {
  const decrypted = decryptJson(row.encrypted_data);

  return {
    id: row.id,
    ...decrypted,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/*
|--------------------------------------------------------------------------
| GET ALL VAULT ENTRIES
|--------------------------------------------------------------------------
| GET /api/vault
|
| Returns only the authenticated user's entries.
| Each entry is decrypted by the server before being returned.
*/

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `
        SELECT
          id,
          encrypted_data,
          created_at,
          updated_at
        FROM vault_entries
        WHERE user_id = $1
        ORDER BY updated_at DESC
      `,
      [req.session.userId]
    );

    const entries = result.rows.map(decryptEntry);

    return res.status(200).json({
      success: true,
      data: {
        entries,
      },
    });
  } catch {
    console.error("KeyCrove could not load vault entries.");

    return sendError(
      res,
      500,
      "VAULT_LOAD_FAILED",
      "We could not load your vault. Please try again."
    );
  }
});

/*
|--------------------------------------------------------------------------
| CREATE VAULT ENTRY
|--------------------------------------------------------------------------
| POST /api/vault
*/

router.post("/", requireAuth, async (req, res) => {
  const parsed = entrySchema.safeParse(req.body);

  if (!parsed.success) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ||
        "Please check the information you entered."
    );
  }

  try {
    const entry = prepareEntry(parsed.data);

    // Encrypt the complete entry before storing it.
    const encryptedData = encryptJson(entry);

    const result = await query(
      `
        INSERT INTO vault_entries (
          user_id,
          encrypted_data
        )
        VALUES ($1, $2::jsonb)
        RETURNING
          id,
          encrypted_data,
          created_at,
          updated_at
      `,
      [
        req.session.userId,
        JSON.stringify(encryptedData),
      ]
    );

    const savedEntry = decryptEntry(result.rows[0]);

    return res.status(201).json({
      success: true,
      message: "Vault entry created successfully.",
      data: {
        entry: savedEntry,
      },
    });
  } catch {
    console.error("KeyCrove could not create a vault entry.");

    return sendError(
      res,
      500,
      "VAULT_CREATE_FAILED",
      "We could not save this entry. Please try again."
    );
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE VAULT ENTRY
|--------------------------------------------------------------------------
| PUT /api/vault/:id
|
| The user ID condition prevents one user from modifying
| another user's entry.
*/

router.put("/:id", requireAuth, async (req, res) => {
  const parsedId = validateEntryId(req.params.id);

  if (!parsedId.success) {
    return sendError(
      res,
      400,
      "INVALID_ENTRY_ID",
      "The requested vault entry identifier is invalid."
    );
  }

  const parsedEntry = entrySchema.safeParse(req.body);

  if (!parsedEntry.success) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      parsedEntry.error.issues[0]?.message ||
        "Please check the information you entered."
    );
  }

  try {
    const entry = prepareEntry(parsedEntry.data);

    const encryptedData = encryptJson(entry);

    const result = await query(
      `
        UPDATE vault_entries
        SET
          encrypted_data = $1::jsonb,
          updated_at = NOW()
        WHERE
          id = $2
          AND user_id = $3
        RETURNING
          id,
          encrypted_data,
          created_at,
          updated_at
      `,
      [
        JSON.stringify(encryptedData),
        parsedId.data,
        req.session.userId,
      ]
    );

    if (result.rowCount === 0) {
      return sendError(
        res,
        404,
        "ENTRY_NOT_FOUND",
        "This vault entry was not found."
      );
    }

    const updatedEntry = decryptEntry(result.rows[0]);

    return res.status(200).json({
      success: true,
      message: "Vault entry updated successfully.",
      data: {
        entry: updatedEntry,
      },
    });
  } catch {
    console.error("KeyCrove could not update a vault entry.");

    return sendError(
      res,
      500,
      "VAULT_UPDATE_FAILED",
      "We could not update this entry. Please try again."
    );
  }
});

/*
|--------------------------------------------------------------------------
| DELETE VAULT ENTRY
|--------------------------------------------------------------------------
| DELETE /api/vault/:id
*/

router.delete("/:id", requireAuth, async (req, res) => {
  const parsedId = validateEntryId(req.params.id);

  if (!parsedId.success) {
    return sendError(
      res,
      400,
      "INVALID_ENTRY_ID",
      "The requested vault entry identifier is invalid."
    );
  }

  try {
    const result = await query(
      `
        DELETE FROM vault_entries
        WHERE
          id = $1
          AND user_id = $2
        RETURNING id
      `,
      [
        parsedId.data,
        req.session.userId,
      ]
    );

    if (result.rowCount === 0) {
      return sendError(
        res,
        404,
        "ENTRY_NOT_FOUND",
        "This vault entry was not found."
      );
    }

    return res.status(200).json({
      success: true,
      message: "Vault entry deleted successfully.",
      data: {
        id: result.rows[0].id,
      },
    });
  } catch {
    console.error("KeyCrove could not delete a vault entry.");

    return sendError(
      res,
      500,
      "VAULT_DELETE_FAILED",
      "We could not delete this entry. Please try again."
    );
  }
});

export default router;

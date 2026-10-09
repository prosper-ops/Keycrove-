-- ============================================================
-- KEYCROVE DATABASE SCHEMA
-- PostgreSQL
--
-- Defines the tables required for:
-- 1. User accounts
-- 2. Encrypted password-vault entries
-- 3. Password-reset tokens
-- 4. Passkey authentication
--
-- This file defines the database structure. It does not
-- create a database or configure a database connection.
-- ============================================================


-- ============================================================
-- 1. USERS
-- Stores account information.
-- Passwords must be stored as secure password hashes,
-- never as readable plaintext passwords.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,

    email VARCHAR(254) NOT NULL,

    password_hash TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_name_not_empty
        CHECK (LENGTH(TRIM(name)) > 0),

    CONSTRAINT users_email_not_empty
        CHECK (LENGTH(TRIM(email)) > 0),

    CONSTRAINT users_password_hash_not_empty
        CHECK (LENGTH(password_hash) > 0)
);


-- Email addresses are treated as case-insensitive.
-- The application should trim and normalize email addresses
-- before storing or searching for them.

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
    ON users (LOWER(email));


-- ============================================================
-- 2. VAULT ENTRIES
-- Stores encrypted vault records.
--
-- The encrypted_data column contains the encryption structure
-- produced by the server's encryption utility.
--
-- The server must verify ownership before reading, changing,
-- or deleting any vault entry.
-- ============================================================

CREATE TABLE IF NOT EXISTS vault_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    encrypted_data JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT vault_entries_encrypted_data_object
        CHECK (JSONB_TYPEOF(encrypted_data) = 'object')
);


-- Supports retrieving a user's vault entries efficiently.

CREATE INDEX IF NOT EXISTS vault_entries_user_id_idx
    ON vault_entries (user_id);


-- Supports sorting entries by most recently updated.

CREATE INDEX IF NOT EXISTS vault_entries_user_updated_idx
    ON vault_entries (user_id, updated_at DESC);


-- ============================================================
-- 3. PASSWORD RESET TOKENS
-- Stores hashed, single-use account password-reset tokens.
--
-- The original reset token must never be stored in this table.
-- Store only a cryptographic hash of the token.
--
-- The authentication routes must enforce expiration and
-- single-use behavior.
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT password_reset_token_hash_not_empty
        CHECK (LENGTH(token_hash) > 0)
);


-- Supports finding reset tokens belonging to a user.

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
    ON password_reset_tokens (user_id);


-- Supports cleanup and expiration-related queries.

CREATE INDEX IF NOT EXISTS password_reset_tokens_expiry_idx
    ON password_reset_tokens (expires_at);


-- ============================================================
-- 4. PASSKEY CREDENTIALS
-- Stores public credential information for WebAuthn/passkeys.
--
-- Passkeys use public-key cryptography.
-- The private credential key should remain with the
-- authenticator and must not be stored here.
--
-- The server must validate every WebAuthn challenge,
-- origin, relying-party ID, and authentication response.
-- ============================================================

CREATE TABLE IF NOT EXISTS passkey_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    credential_id TEXT NOT NULL UNIQUE,

    public_key BYTEA NOT NULL,

    counter BIGINT NOT NULL DEFAULT 0,

    transports TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    device_type TEXT,

    backed_up BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_used_at TIMESTAMPTZ,

    CONSTRAINT passkey_credential_id_not_empty
        CHECK (LENGTH(credential_id) > 0),

    CONSTRAINT passkey_public_key_not_empty
        CHECK (OCTET_LENGTH(public_key) > 0),

    CONSTRAINT passkey_counter_non_negative
        CHECK (counter >= 0)
);


-- Supports finding registered passkeys for an account.

CREATE INDEX IF NOT EXISTS passkey_credentials_user_id_idx
    ON passkey_credentials (user_id);


-- ============================================================
-- END OF KEYCROVE DATABASE SCHEMA
-- ============================================================

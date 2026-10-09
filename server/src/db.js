import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

/**
 * Validate the database configuration before starting.
 * The actual database URL must be supplied through environment variables.
 */
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Database configuration is missing. Set DATABASE_URL in the server environment."
  );
}

/**
 * Configure PostgreSQL's connection pool.
 *
 * DATABASE_SSL=require enables TLS for hosted databases that require it.
 * Leave DATABASE_SSL unset for a local database that does not use TLS.
 *
 * Never disable certificate verification to bypass TLS errors in production.
 */
const useSsl = process.env.DATABASE_SSL === "require";

export const pool = new Pool({
  connectionString: databaseUrl,

  ...(useSsl
    ? {
        ssl: {
          rejectUnauthorized: true,
        },
      }
    : {}),

  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: "keycrove-server",
});

/**
 * Handle unexpected errors from idle database connections.
 * Do not log connection strings or other sensitive configuration.
 */
pool.on("error", () => {
  console.error(
    "KeyCrove: An unexpected error occurred on an idle database connection."
  );
});

/**
 * Run a parameterized SQL query.
 *
 * Example:
 * query("SELECT * FROM users WHERE id = $1", [userId])
 *
 * Use $1, $2, and so on for user-supplied values.
 */
export async function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Check whether PostgreSQL is reachable.
 * This function can be used by the server's health-check endpoint.
 */
export async function testDatabaseConnection() {
  const result = await pool.query("SELECT 1 AS database_connected");

  return result.rows[0].database_connected === 1;
}

/**
 * Close the database connection pool gracefully.
 * Useful when the server shuts down.
 */
export async function closeDatabaseConnection() {
  await pool.end();
}

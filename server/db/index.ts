import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;

export interface DatabaseService {
  pool: pg.Pool;
  query: <R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<pg.QueryResult<R>>;
  runMigrations: () => Promise<void>;
  close: () => Promise<void>;
}

let dbInstance: DatabaseService | null = null;

export function createDatabase(connectionStringOrPool: string | pg.Pool): DatabaseService {
  const pool =
    typeof connectionStringOrPool === "string"
      ? new Pool({ connectionString: connectionStringOrPool })
      : connectionStringOrPool;

  const query: DatabaseService["query"] = <R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => pool.query<R>(text, params);

  const runMigrations = async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

      const appliedRes = await client.query<{ id: string }>(
        "SELECT id FROM schema_migrations"
      );
      const appliedSet = new Set(appliedRes.rows.map((r) => r.id));

      // Resolve migrations directory
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const migrationsDir = path.join(__dirname, "migrations");

      if (fs.existsSync(migrationsDir)) {
        const files = fs
          .readdirSync(migrationsDir)
          .filter((f) => f.endsWith(".sql"))
          .sort();

        for (const file of files) {
          if (!appliedSet.has(file)) {
            const sqlContent = fs.readFileSync(path.join(migrationsDir, file), "utf8");
            await client.query(sqlContent);
            await client.query(
              "INSERT INTO schema_migrations (id, applied_at) VALUES ($1, now())",
              [file]
            );
          }
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  };

  const close = async () => {
    await pool.end();
  };

  return {
    pool,
    query,
    runMigrations,
    close,
  };
}

export function initDatabase(connectionString: string): DatabaseService {
  if (!dbInstance) {
    dbInstance = createDatabase(connectionString);
  }
  return dbInstance;
}

export function getDatabase(): DatabaseService {
  if (!dbInstance) {
    throw new Error("Database has not been initialized. Call initDatabase() first.");
  }
  return dbInstance;
}

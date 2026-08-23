import crypto from "node:crypto";
import type { DatabaseService } from "../db/index.js";
import type { AppConfig } from "../config.js";

export interface SessionRecord {
  id: string;
  expires_at: Date;
  created_at: Date;
  last_seen_at: Date;
}

export class AuthService {
  constructor(
    private db: DatabaseService,
    private config: AppConfig
  ) {}

  verifyCredentials(username?: string, password?: string): boolean {
    if (!username || !password) return false;

    // Use SHA-256 digests for timing-safe equality comparison
    const expectedUserDigest = crypto
      .createHash("sha256")
      .update(this.config.authUsername)
      .digest();
    const providedUserDigest = crypto
      .createHash("sha256")
      .update(username)
      .digest();

    const expectedPassDigest = crypto
      .createHash("sha256")
      .update(this.config.authPassword)
      .digest();
    const providedPassDigest = crypto
      .createHash("sha256")
      .update(password)
      .digest();

    const userMatch = crypto.timingSafeEqual(expectedUserDigest, providedUserDigest);
    const passMatch = crypto.timingSafeEqual(expectedPassDigest, providedPassDigest);

    return userMatch && passMatch;
  }

  async createSession(): Promise<string> {
    const sessionId = crypto.randomUUID();
    const ttlMs = this.config.sessionTtlDays * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);

    await this.db.query(
      `INSERT INTO auth_session (id, expires_at)
       VALUES ($1, $2)`,
      [sessionId, expiresAt]
    );

    return sessionId;
  }

  async validateSession(sessionId: string): Promise<SessionRecord | null> {
    if (!sessionId) return null;

    const res = await this.db.query<SessionRecord>(
      `UPDATE auth_session
       SET last_seen_at = now()
       WHERE id = $1 AND expires_at > now()
       RETURNING id, expires_at, created_at, last_seen_at`,
      [sessionId]
    );

    if (res.rowCount === 0) {
      return null;
    }

    return res.rows[0];
  }

  async revokeSession(sessionId: string): Promise<void> {
    if (!sessionId) return;
    await this.db.query(`DELETE FROM auth_session WHERE id = $1`, [sessionId]);
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.db.query(`DELETE FROM auth_session WHERE expires_at < now()`);
  }
}

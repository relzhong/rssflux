import crypto from "node:crypto";
export class AuthService {
    db;
    config;
    constructor(db, config) {
        this.db = db;
        this.config = config;
    }
    verifyCredentials(username, password) {
        if (!username || !password)
            return false;
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
    async createSession() {
        const sessionId = crypto.randomUUID();
        const ttlMs = this.config.sessionTtlDays * 24 * 60 * 60 * 1000;
        const expiresAt = new Date(Date.now() + ttlMs);
        await this.db.query(`INSERT INTO auth_session (id, expires_at)
       VALUES ($1, $2)`, [sessionId, expiresAt]);
        return sessionId;
    }
    async validateSession(sessionId) {
        if (!sessionId)
            return null;
        const res = await this.db.query(`UPDATE auth_session
       SET last_seen_at = now()
       WHERE id = $1 AND expires_at > now()
       RETURNING id, expires_at, created_at, last_seen_at`, [sessionId]);
        if (res.rowCount === 0) {
            return null;
        }
        return res.rows[0];
    }
    async revokeSession(sessionId) {
        if (!sessionId)
            return;
        await this.db.query(`DELETE FROM auth_session WHERE id = $1`, [sessionId]);
    }
    async cleanupExpiredSessions() {
        await this.db.query(`DELETE FROM auth_session WHERE expires_at < now()`);
    }
}

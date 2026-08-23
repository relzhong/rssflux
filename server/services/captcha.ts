import crypto from "node:crypto";
import type { DatabaseService } from "../db/index.js";

// Exclude confusing characters: 0, O, 1, I, l
const CAPTCHA_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export interface CaptchaChallenge {
  id: string;
  image: string; // SVG string
}

export function hashCaptchaAnswer(answer: string): string {
  return crypto
    .createHash("sha256")
    .update(answer.trim().toUpperCase())
    .digest("hex");
}

export function generateRandomCaptcha(length = 4): { text: string; svg: string } {
  let text = "";
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * CAPTCHA_CHARS.length);
    text += CAPTCHA_CHARS[idx];
  }

  const width = 160;
  const height = 50;

  // Background and noise colors
  const bg = "#1e293b";
  const colors = ["#38bdf8", "#818cf8", "#c084fc", "#f472b6", "#34d399", "#fbbf24"];

  // Random noise lines
  let lines = "";
  for (let i = 0; i < 4; i++) {
    const x1 = Math.floor(Math.random() * width);
    const y1 = Math.floor(Math.random() * height);
    const x2 = Math.floor(Math.random() * width);
    const y2 = Math.floor(Math.random() * height);
    const stroke = colors[Math.floor(Math.random() * colors.length)];
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1.5" opacity="0.6" />`;
  }

  // Random noise dots
  let dots = "";
  for (let i = 0; i < 30; i++) {
    const cx = Math.floor(Math.random() * width);
    const cy = Math.floor(Math.random() * height);
    const r = Math.random() * 1.5 + 0.5;
    const fill = colors[Math.floor(Math.random() * colors.length)];
    dots += `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="${fill}" opacity="0.4" />`;
  }

  // Render characters with distortion
  let charsSvg = "";
  const charWidth = width / (length + 1);

  for (let i = 0; i < length; i++) {
    const char = text[i];
    const x = Math.floor(charWidth * (i + 0.8) + (Math.random() * 6 - 3));
    const y = Math.floor(height / 2 + (Math.random() * 8 - 4));
    const rotate = Math.floor(Math.random() * 36 - 18);
    const color = colors[Math.floor(Math.random() * colors.length)];
    const fontSize = Math.floor(26 + Math.random() * 6);

    charsSvg += `<text x="${x}" y="${y}" font-family="monospace, sans-serif" font-weight="bold" font-size="${fontSize}" fill="${color}" text-anchor="middle" dominant-baseline="central" transform="rotate(${rotate} ${x} ${y})">${char}</text>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background-color: ${bg}; border-radius: 8px; user-select: none;">${lines}${dots}${charsSvg}</svg>`;

  return { text, svg };
}

export class CaptchaService {
  constructor(private db: DatabaseService) {}

  async createChallenge(): Promise<CaptchaChallenge> {
    const id = crypto.randomUUID();
    const { text, svg } = generateRandomCaptcha(4);
    const answerHash = hashCaptchaAnswer(text);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

    // Invalidate and cleanup expired captchas asynchronously
    this.cleanupExpired().catch(() => {});

    await this.db.query(
      `INSERT INTO auth_captcha (id, answer_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [id, answerHash, expiresAt]
    );

    return { id, image: svg };
  }

  async verifyAndConsumeChallenge(id: string, answer: string): Promise<boolean> {
    if (!id || !answer) return false;

    const providedHash = hashCaptchaAnswer(answer);

    // Fetch and mark challenge as used in a single atomic query
    const res = await this.db.query<{ answer_hash: string; expires_at: Date; used_at: Date | null }>(
      `UPDATE auth_captcha
       SET used_at = now()
       WHERE id = $1 AND used_at IS NULL
       RETURNING answer_hash, expires_at, used_at`,
      [id]
    );

    if (res.rowCount === 0) {
      return false;
    }

    const record = res.rows[0];
    const now = new Date();

    if (now > new Date(record.expires_at)) {
      return false;
    }

    // Timing-safe comparison of SHA-256 hashes
    const expectedBuffer = Buffer.from(record.answer_hash, "hex");
    const providedBuffer = Buffer.from(providedHash, "hex");

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  }

  async cleanupExpired(): Promise<void> {
    await this.db.query(
      `DELETE FROM auth_captcha
       WHERE expires_at < now() OR (used_at IS NOT NULL AND created_at < now() - INTERVAL '1 hour')`
    );
  }
}

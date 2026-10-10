const crypto = require("crypto");
const pool = require("../db/connect");

// In-memory set for instantaneous O(1) blacklist lookups
const revokedMemorySet = new Set();

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function revokeToken(token, expiresAt, userId) {
  if (!token) return;
  const hash = hashToken(token);
  revokedMemorySet.add(hash);

  const expDate =
    expiresAt instanceof Date
      ? expiresAt
      : typeof expiresAt === "number"
      ? new Date(expiresAt * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

  await pool.promise().execute(
    "INSERT INTO revoked_token (token_hash, expires_at, fk_id_user) VALUES (?, ?, ?)",
    [hash, expDate, userId || null],
  );
}

async function isTokenRevoked(token) {
  if (!token) return false;
  const hash = hashToken(token);
  if (revokedMemorySet.has(hash)) {
    return true;
  }

  // Check persistent store if not in test environment
  if (process.env.NODE_ENV !== "test") {
    try {
      const [rows] = await pool.promise().execute(
        "SELECT id_revocation FROM revoked_token WHERE token_hash = ? AND expires_at > NOW() LIMIT 1",
        [hash],
      );
      if (rows && rows.length > 0) {
        revokedMemorySet.add(hash);
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

function clearMemoryBlacklist() {
  revokedMemorySet.clear();
}

module.exports = {
  hashToken,
  revokeToken,
  isTokenRevoked,
  clearMemoryBlacklist,
};

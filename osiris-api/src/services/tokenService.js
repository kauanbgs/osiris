const crypto = require("crypto");
const pool = require("../db/connect");

// In-memory set for instantaneous O(1) blacklist lookups
// Stores map of token_hash -> expires_at_timestamp to allow pruning expired hashes
const revokedMemoryMap = new Map();
const MAX_REVOKED_CACHE = 10000;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function pruneExpiredTokens() {
  const now = Date.now();
  for (const [hash, expMs] of revokedMemoryMap.entries()) {
    if (now > expMs) {
      revokedMemoryMap.delete(hash);
    }
  }
}

async function revokeToken(token, expiresAt, userId) {
  if (!token) return;
  const hash = hashToken(token);

  pruneExpiredTokens();

  if (revokedMemoryMap.size >= MAX_REVOKED_CACHE) {
    const oldest = revokedMemoryMap.keys().next().value;
    revokedMemoryMap.delete(oldest);
  }

  const expDate =
    expiresAt instanceof Date
      ? expiresAt
      : typeof expiresAt === "number"
      ? new Date(expiresAt * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

  revokedMemoryMap.set(hash, expDate.getTime());

  await pool.promise().execute(
    "INSERT INTO revoked_token (token_hash, expires_at, fk_id_user) VALUES (?, ?, ?)",
    [hash, expDate, userId || null],
  );
}

async function isTokenRevoked(token) {
  if (!token) return false;
  const hash = hashToken(token);
  const expMs = revokedMemoryMap.get(hash);
  if (expMs !== undefined) {
    if (Date.now() <= expMs) {
      return true;
    }
    revokedMemoryMap.delete(hash);
  }

  // Check persistent store if not in test environment
  if (process.env.NODE_ENV !== "test") {
    try {
      const [rows] = await pool.promise().execute(
        "SELECT id_revocation FROM revoked_token WHERE token_hash = ? AND expires_at > NOW() LIMIT 1",
        [hash],
      );
      if (rows && rows.length > 0) {
        revokedMemoryMap.set(hash, Date.now() + 60 * 60 * 1000);
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

function clearMemoryBlacklist() {
  revokedMemoryMap.clear();
}

module.exports = {
  hashToken,
  revokeToken,
  isTokenRevoked,
  clearMemoryBlacklist,
};

-- Server-side email OTP challenges (replaces the browser-generated demo OTP).
-- Only an HMAC-SHA256 hash of each code is stored; plaintext codes never touch the database.
CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  payload TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  send_count INTEGER NOT NULL DEFAULT 1,
  last_sent_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  request_ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_email_sent ON otp_challenges(email, last_sent_at);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_ip_created ON otp_challenges(request_ip, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_created ON otp_challenges(created_at);
-- Accounts are now identified by their verified email address.
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

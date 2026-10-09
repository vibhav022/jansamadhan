CREATE TABLE IF NOT EXISTS challenge_votes (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  voter_phone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(challenge_id, voter_phone)
);
CREATE INDEX IF NOT EXISTS idx_challenge_votes_challenge ON challenge_votes(challenge_id);

CREATE TABLE IF NOT EXISTS challenge_comments (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_challenge_comments_challenge ON challenge_comments(challenge_id, created_at);

CREATE TABLE IF NOT EXISTS solution_proposals (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  proposer_name TEXT NOT NULL,
  proposer_role TEXT NOT NULL,
  institution TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Submitted',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_solution_proposals_challenge ON solution_proposals(challenge_id, created_at);

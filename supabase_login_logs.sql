CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  at TIMESTAMP DEFAULT NOW(),
  device TEXT,
  ip TEXT,
  client_id TEXT
);

-- Rate limiting log para prevenir abuso
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  ts INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET'
);

CREATE INDEX IF NOT EXISTS rate_limit_ip_endpoint ON rate_limit_log (ip, endpoint, ts DESC);
CREATE INDEX IF NOT EXISTS rate_limit_cleanup ON rate_limit_log (ts);

CREATE TABLE IF NOT EXISTS contract_signers (
  id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('tenant','locator')),
  name TEXT NOT NULL, email TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','revoked')),
  signature_method TEXT NOT NULL DEFAULT '', signature_key TEXT NOT NULL DEFAULT '', consent_text TEXT NOT NULL DEFAULT '',
  invited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at INTEGER NOT NULL, signed_at TEXT, signed_ip TEXT NOT NULL DEFAULT '', user_agent TEXT NOT NULL DEFAULT '', document_hash TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE, UNIQUE(contract_id, role)
);
CREATE INDEX IF NOT EXISTS idx_contract_signers_token ON contract_signers(token_hash, expires_at);
CREATE TABLE IF NOT EXISTS contract_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT, contract_id TEXT NOT NULL, action TEXT NOT NULL, actor_role TEXT NOT NULL DEFAULT '', actor_email TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, ip_address TEXT NOT NULL DEFAULT '', user_agent TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_contract_audit_contract ON contract_audit(contract_id, occurred_at);

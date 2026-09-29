CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','sent','client_signed','signed','declined','cancelled')),
  tenant_name TEXT NOT NULL, tenant_address TEXT NOT NULL, tenant_email TEXT NOT NULL, tenant_phone TEXT NOT NULL, tenant_neq TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL, event_type TEXT NOT NULL, minors_present INTEGER NOT NULL DEFAULT 0, minors_count TEXT NOT NULL DEFAULT '', access_time TEXT NOT NULL, guest_time TEXT NOT NULL,
  room_price TEXT NOT NULL DEFAULT '', room_taxes TEXT NOT NULL DEFAULT '', deposit TEXT NOT NULL DEFAULT '', room_balance TEXT NOT NULL DEFAULT '', security_deposit TEXT NOT NULL DEFAULT '',
  meal_plan TEXT NOT NULL DEFAULT '', meal_count TEXT NOT NULL DEFAULT '', meal_deadline TEXT NOT NULL, meal_payment TEXT NOT NULL DEFAULT 'guests', meal_allocation TEXT NOT NULL DEFAULT '',
  beverage_payment TEXT NOT NULL DEFAULT 'guests', beverage_terms TEXT NOT NULL DEFAULT '', other_purchases TEXT NOT NULL DEFAULT '',
  onsite_contact TEXT NOT NULL, onsite_phone TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', locator_name TEXT NOT NULL DEFAULT '', locator_email TEXT NOT NULL DEFAULT '', accepted INTEGER NOT NULL DEFAULT 1,
  signature_request_id TEXT NOT NULL DEFAULT '', signed_file_key TEXT NOT NULL DEFAULT '', submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at TEXT, signed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_contracts_status_date ON contracts(status, event_date);

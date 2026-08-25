CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '/assets/point-g-salle.jpg',
  eventbriteId TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_public_date ON events(published, date);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  csrf TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
INSERT OR IGNORE INTO events (id, slug, title, summary, description, date, location, image, eventbriteId, published)
VALUES ('soiree-point-g-2026', 'soiree-point-g-2026', 'Soirée Point G', 'Une soirée festive dans l''ambiance distinctive de la Salle Point G.', 'Venez découvrir la Salle Point G lors d’une soirée où musique, rencontres et ambiance feutrée sont au rendez-vous.', '2026-10-17T20:00', '99, rue Saint-Georges, Saint-Jérôme', '/assets/point-g-salle.jpg', '1998914026663', 1);

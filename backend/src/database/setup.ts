import Database from 'better-sqlite3';
import path from 'path';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.resolve('./database.sqlite');

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  applySchema(_db);
  return _db;
}

function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS societies (
      id       TEXT PRIMARY KEY,
      name     TEXT,
      city     TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      phone         TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role          TEXT NOT NULL CHECK(role IN ('resident','professional','admin')),
      society_id    TEXT REFERENCES societies(id),
      created_at    TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS service_categories (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      icon_name      TEXT,
      description    TEXT,
      base_price_min INTEGER,
      base_price_max INTEGER,
      is_active      INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS professionals (
      id           TEXT PRIMARY KEY,
      user_id      TEXT UNIQUE REFERENCES users(id),
      bio          TEXT,
      hourly_rate  INTEGER,
      is_verified  INTEGER DEFAULT 0,
      is_available INTEGER DEFAULT 1,
      rating       REAL    DEFAULT 0,
      total_jobs   INTEGER DEFAULT 0,
      created_at   TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS professional_categories (
      professional_id TEXT REFERENCES professionals(id),
      category_id     TEXT REFERENCES service_categories(id),
      PRIMARY KEY (professional_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id                  TEXT PRIMARY KEY,
      resident_id         TEXT REFERENCES users(id),
      professional_id     TEXT REFERENCES users(id),
      category_id         TEXT REFERENCES service_categories(id),
      status              TEXT DEFAULT 'pending_quote'
        CHECK(status IN ('pending_quote','quoted','confirmed','in_progress','completed','cancelled')),
      scheduled_at        TEXT,
      address             TEXT NOT NULL,
      problem_description TEXT,
      quote_amount        REAL,
      final_amount        REAL,
      created_at          TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id              TEXT PRIMARY KEY,
      booking_id      TEXT REFERENCES bookings(id),
      professional_id TEXT REFERENCES users(id),
      amount          REAL NOT NULL,
      note            TEXT,
      status          TEXT DEFAULT 'pending'
        CHECK(status IN ('pending','accepted','rejected')),
      created_at      TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         TEXT PRIMARY KEY,
      booking_id TEXT REFERENCES bookings(id),
      sender_id  TEXT REFERENCES users(id),
      content    TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id              TEXT PRIMARY KEY,
      booking_id      TEXT UNIQUE REFERENCES bookings(id),
      resident_id     TEXT REFERENCES users(id),
      professional_id TEXT REFERENCES users(id),
      rating          INTEGER CHECK(rating BETWEEN 1 AND 5),
      comment         TEXT,
      created_at      TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_resident    ON bookings(resident_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_professional ON bookings(professional_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_category    ON bookings(category_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_status      ON bookings(status);
    CREATE INDEX IF NOT EXISTS idx_quotes_booking       ON quotes(booking_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_professional  ON quotes(professional_id);
    CREATE INDEX IF NOT EXISTS idx_messages_booking     ON messages(booking_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_professional ON reviews(professional_id);
    CREATE INDEX IF NOT EXISTS idx_prof_cats_category   ON professional_categories(category_id);
  `);
}

import pg from 'pg';

const url = process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/knotcount';
const useSsl = process.env.PGSSL === 'true' || /sslmode=require/.test(url) || /neon\.tech|supabase\.co/.test(url);

export const pool = new pg.Pool({
  connectionString: url,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 8,
});

export const q = (text, params) => pool.query(text, params);

export async function migrate() {
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS events (
      id            SERIAL PRIMARY KEY,
      user_id       INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      bride         TEXT NOT NULL DEFAULT '',
      groom         TEXT NOT NULL DEFAULT '',
      date_text     TEXT NOT NULL DEFAULT '',
      time_text     TEXT NOT NULL DEFAULT '',
      venue         TEXT NOT NULL DEFAULT '',
      invite_tpl    TEXT NOT NULL DEFAULT '',
      reminder_tpl  TEXT NOT NULL DEFAULT '',
      auto_reminders BOOLEAN NOT NULL DEFAULT false,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS guests (
      id            SERIAL PRIMARY KEY,
      event_id      INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      token         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      phone         TEXT NOT NULL DEFAULT '',
      email         TEXT NOT NULL DEFAULT '',
      side          TEXT NOT NULL DEFAULT 'both' CHECK (side IN ('bride','groom','both')),
      seats         INT  NOT NULL DEFAULT 1 CHECK (seats BETWEEN 1 AND 50),
      status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','declined')),
      attending     INT  NOT NULL DEFAULT 0 CHECK (attending BETWEEN 0 AND 60),
      meal          TEXT CHECK (meal IN ('veg','nonveg')),
      arrival       INT  CHECK (arrival BETWEEN 0 AND 1439),
      note          TEXT NOT NULL DEFAULT '',
      invited       BOOLEAN NOT NULL DEFAULT false,
      invited_at    TIMESTAMPTZ,
      reminded_at   TIMESTAMPTZ,
      responded_at  TIMESTAMPTZ,
      responded_via TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS guests_event_idx ON guests(event_id);
  `);
}

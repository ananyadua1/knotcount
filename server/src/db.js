import pg from 'pg';

const url = process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/knotcount';
const useSsl = process.env.PGSSL === 'true' || /sslmode=require/.test(url) || /neon\.tech|supabase\.co/.test(url);
const connection = new URL(url);
// pg connection-string SSL options otherwise replace the verified TLS settings.
if (useSsl) for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) connection.searchParams.delete(key);

export const pool = new pg.Pool({
  connectionString: connection.toString(),
  ssl: useSsl ? { rejectUnauthorized: true } : undefined,
  max: 8,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  statement_timeout: 15000,
});
pool.on('error', (error) => console.error('Idle database connection failed:', error.message));

export const q = (text, params) => pool.query(text, params);

export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn((sql, params) => client.query(sql, params));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

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
      user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    ALTER TABLE guests ADD COLUMN IF NOT EXISTS veg_count INT CHECK (veg_count >= 0);
    UPDATE guests SET veg_count = CASE meal WHEN 'veg' THEN attending ELSE 0 END
      WHERE veg_count IS NULL AND status = 'confirmed' AND meal IS NOT NULL;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS template TEXT NOT NULL DEFAULT 'classic';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS extra_text TEXT NOT NULL DEFAULT '';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS msg_style TEXT NOT NULL DEFAULT '';
    ALTER TABLE events DROP CONSTRAINT IF EXISTS events_user_id_key;
    CREATE INDEX IF NOT EXISTS events_user_idx ON events(user_id);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 0;
    ALTER TABLE guests ADD COLUMN IF NOT EXISTS guest_note TEXT NOT NULL DEFAULT '';
    ALTER TABLE guests ADD COLUMN IF NOT EXISTS email_claimed_at TIMESTAMPTZ;
    ALTER TABLE guests ADD COLUMN IF NOT EXISTS reminder_requested_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS mail_budget (
      day DATE PRIMARY KEY,
      used INT NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS email_verifications (
      user_id    INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      code_hash  TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts   INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS password_resets (
      user_id    INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      code_hash  TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts   INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS guests_event_idx ON guests(event_id);
  `);
}

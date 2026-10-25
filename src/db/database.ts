import * as SQLite from 'expo-sqlite';

// New development database.
// The original period_tracker.db remains untouched.
export const db = SQLite.openDatabaseSync(
  'period_tracker_v2.db'
);

export function initDatabase(): void {
  db.execSync('PRAGMA foreign_keys = ON;');

  db.execSync(`
    CREATE TABLE IF NOT EXISTS cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL UNIQUE,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed')),

      CHECK (end_date IS NULL OR end_date >= start_date),

      CHECK (
        (status = 'active' AND end_date IS NULL)
        OR
        (status = 'completed' AND end_date IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_active_cycle
    ON cycles(status)
    WHERE status = 'active';


    CREATE TABLE IF NOT EXISTS periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL UNIQUE,
      start_date TEXT NOT NULL UNIQUE,
      end_date TEXT,
      expected_duration_days INTEGER NOT NULL
        CHECK (expected_duration_days BETWEEN 1 AND 30),
      status TEXT NOT NULL DEFAULT 'ongoing'
        CHECK (status IN ('ongoing', 'completed')),

      FOREIGN KEY (cycle_id)
        REFERENCES cycles(id)
        ON DELETE CASCADE,

      CHECK (end_date IS NULL OR end_date >= start_date),

      CHECK (
        (status = 'ongoing' AND end_date IS NULL)
        OR
        (status = 'completed' AND end_date IS NOT NULL)
      )
    );


    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,

      bleeding_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (
          bleeding_status IN (
            'unknown', 'none', 'spotting', 'period'
          )
        ),

      flow TEXT
        CHECK (
          flow IS NULL
          OR flow IN ('Light', 'Medium', 'Heavy')
        ),

      mood TEXT
        CHECK (
          mood IS NULL
          OR mood IN (
            'Happy', 'Normal', 'Sad', 'Irritable'
          )
        ),

      notes TEXT,

      CHECK (
        bleeding_status = 'period'
        OR flow IS NULL
      )
    );


    CREATE TABLE IF NOT EXISTS symptoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );


    CREATE TABLE IF NOT EXISTS daily_log_symptoms (
      daily_log_id INTEGER NOT NULL,
      symptom_id INTEGER NOT NULL,

      PRIMARY KEY (daily_log_id, symptom_id),

      FOREIGN KEY (daily_log_id)
        REFERENCES daily_logs(id)
        ON DELETE CASCADE,

      FOREIGN KEY (symptom_id)
        REFERENCES symptoms(id)
    );


    CREATE TABLE IF NOT EXISTS ovulation_estimates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL UNIQUE,
      estimated_date TEXT NOT NULL,
      notes TEXT,

      created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (cycle_id)
        REFERENCES cycles(id)
        ON DELETE CASCADE
    );


    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),

      default_cycle_length INTEGER NOT NULL DEFAULT 28
        CHECK (default_cycle_length BETWEEN 15 AND 90),

      default_period_length INTEGER NOT NULL DEFAULT 5
        CHECK (default_period_length BETWEEN 1 AND 30),

      notifications_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (notifications_enabled IN (0, 1)),

      prediction_method TEXT NOT NULL DEFAULT 'statistical'
        CHECK (
          prediction_method IN ('statistical', 'ml')
        )
    );


    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.runSync(`
    INSERT OR IGNORE INTO user_settings (id)
    VALUES (1);
  `);

  db.runSync(`
    INSERT OR IGNORE INTO schema_migrations (version, name)
    VALUES (1, 'initial_schema');
  `);
  const defaultSymptoms = [
    'Cramps',
    'Headache',
    'Bloating',
    'Back Pain',
    'Breast Tenderness',
    'Fatigue',
    'Acne',
    'Nausea',
  ];

  for (const symptom of defaultSymptoms) {
    db.runSync(
      'INSERT OR IGNORE INTO symptoms (name) VALUES (?)',
      [symptom]
    );
  }
}


export function inspectDatabase(): void {
  const tables = db.getAllSync<{ name: string }>(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name;
  `);

  console.log('Database tables:', tables);

  const integrity = db.getFirstSync<{
    integrity_check: string;
  }>('PRAGMA integrity_check;');

  console.log('Database integrity:', integrity?.integrity_check);

  const foreignKeys = db.getFirstSync<{
    foreign_keys: number;
  }>('PRAGMA foreign_keys;');

  console.log('Foreign keys enabled:', foreignKeys?.foreign_keys === 1);
}



export function inspectCyclesAndPeriods(): void {
  const records = db.getAllSync<{
    cycle_id: number;
    cycle_start: string;
    cycle_end: string | null;
    cycle_status: string;
    period_id: number | null;
    period_start: string | null;
    period_end: string | null;
    period_status: string | null;
  }>(
    `SELECT
       c.id AS cycle_id,
       c.start_date AS cycle_start,
       c.end_date AS cycle_end,
       c.status AS cycle_status,
       p.id AS period_id,
       p.start_date AS period_start,
       p.end_date AS period_end,
       p.status AS period_status
     FROM cycles c
     LEFT JOIN periods p
       ON p.cycle_id = c.id
     ORDER BY c.start_date ASC`
  );

  console.log('Cycles and periods:', records);

  const foreignKeyErrors = db.getAllSync(
    'PRAGMA foreign_key_check;'
  );

  console.log('Foreign key errors:', foreignKeyErrors);
}

import type { FlowLevel } from '@/types/period';
import { db } from '../database';

export interface DailyLog {
  id: number;
  date: string;
  bleeding_status: 'unknown' | 'none' | 'spotting' | 'period';
  flow: FlowLevel | null;
  mood: 'Happy' | 'Normal' | 'Sad' | 'Irritable' | null;
  notes: string | null;
}
/*
export function saveDailyLog(
  date: string,
  isPeriod: boolean,
  flow: FlowLevel | null,
  notes: string = ''
): void {
  db.runSync(
    `
    INSERT INTO daily_logs
      (date, bleeding_status, flow, notes)
    VALUES (?, ?, ?, ?)

    ON CONFLICT(date)
    DO UPDATE SET
      bleeding_status = excluded.bleeding_status,
      flow = excluded.flow,
      notes = excluded.notes;
    `,
    [
      date,
      isPeriod ? 'period' : 'none',
      isPeriod ? flow : null,
      notes,
    ]
  );
}*/

export function getDailyLog(
  date: string
): DailyLog | null {
  return db.getFirstSync<DailyLog>(
    'SELECT * FROM daily_logs WHERE date = ?;',
    [date]
  );
}

export function getAllDailyLogs(): DailyLog[] {
  return db.getAllSync<DailyLog>(
    'SELECT * FROM daily_logs ORDER BY date DESC;'
  );
}


export type MoodLevel =
  | 'Happy'
  | 'Normal'
  | 'Sad'
  | 'Irritable';


export function saveDailyObservations(
  date: string,
  flow: FlowLevel | null,
  mood: MoodLevel | null,
  notes: string
): void {
  // Check whether this date belongs to a recorded period.
  const recordedPeriod = db.getFirstSync<{ id: number }>(
    `SELECT id
     FROM periods
     WHERE start_date <= ?
       AND (
         (end_date IS NOT NULL AND end_date >= ?)
         OR (
           end_date IS NULL
           AND status = 'ongoing'
         )
       )
     LIMIT 1`,
    [date, date]
  );

  const bleedingStatus = recordedPeriod
    ? 'period'
    : 'unknown';

  const validFlow = recordedPeriod
    ? flow
    : null;

  db.runSync(
    `INSERT INTO daily_logs
       (date, bleeding_status, flow, mood, notes)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date)
     DO UPDATE SET
       bleeding_status = excluded.bleeding_status,
       flow = excluded.flow,
       mood = excluded.mood,
       notes = excluded.notes`,
    [
      date,
      bleedingStatus,
      validFlow,
      mood,
      notes,
    ]
  );
}

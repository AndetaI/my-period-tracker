
import type { FlowLevel } from '@/types/period';
import { db } from './database';

export interface DailyLog {
  id: number;
  date: string;
  bleeding_status: 'unknown' | 'none' | 'spotting' | 'period';
  flow: FlowLevel | null;
  mood: 'Happy' | 'Normal' | 'Sad' | 'Irritable' | null;
  notes: string | null;
}

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
}

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

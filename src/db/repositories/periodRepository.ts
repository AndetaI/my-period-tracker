import { db } from '../database';

export type PeriodStatus = 'ongoing' | 'completed';

export interface Period {
  id: number;
  cycle_id: number;
  start_date: string;
  end_date: string | null;
  expected_duration_days: number;
  status: PeriodStatus;
}

export function createPeriod(
  cycleId: number,
  startDate: string,
  expectedDurationDays: number
): number {
  const result = db.runSync(
    `INSERT INTO periods (
      cycle_id,
      start_date,
      expected_duration_days,
      status
    )
    VALUES (?, ?, ?, 'ongoing')`,
    [cycleId, startDate, expectedDurationDays]
  );

  return result.lastInsertRowId;
}

export function getPeriodByCycleId(
  cycleId: number
): Period | null {
  return db.getFirstSync<Period>(
    `SELECT *
     FROM periods
     WHERE cycle_id = ?`,
    [cycleId]
  );
}

export function getAllPeriods(): Period[] {
  return db.getAllSync<Period>(
    `SELECT *
     FROM periods
     ORDER BY start_date DESC`
  );
}

export function completePeriod(
  periodId: number,
  endDate: string
): void {
  db.runSync(
    `UPDATE periods
     SET end_date = ?, status = 'completed'
     WHERE id = ? AND status = 'ongoing'`,
    [endDate, periodId]
  );
}

export function getPeriodForDate(date: string): Period | null {
  const today = new Date();
  const localToday =
    `${today.getFullYear()}-` +
    `${String(today.getMonth() + 1).padStart(2, '0')}-` +
    `${String(today.getDate()).padStart(2, '0')}`;

  return db.getFirstSync<Period>(
    `SELECT *
     FROM periods
     WHERE start_date <= ?
       AND (
         (end_date IS NOT NULL AND end_date >= ?)
         OR
         (
           end_date IS NULL
           AND status = 'ongoing'
           AND ? <= ?
         )
       )
     ORDER BY start_date DESC
     LIMIT 1`,
    [date, date, date, localToday]
  );
}


export function updatePeriod(
  periodId: number,
  startDate: string,
  endDate: string,
  expectedDurationDays: number
): void {
  const result = db.runSync(
    `UPDATE periods
     SET
       start_date = ?,
       end_date = ?,
       expected_duration_days = ?,
       status = 'completed'
     WHERE id = ?`,
    [
      startDate,
      endDate,
      expectedDurationDays,
      periodId,
    ]
  );

  if (result.changes !== 1) {
    throw new Error('Period not found or could not be updated.');
  }
}

export function deletePeriod(periodId: number): void {
  const result = db.runSync(
    `DELETE FROM periods
     WHERE id = ?`,
    [periodId]
  );

  if (result.changes !== 1) {
    throw new Error('Period not found or could not be deleted.');
  }
}

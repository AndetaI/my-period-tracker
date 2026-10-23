import { db } from '../database';

export type CycleStatus = 'active' | 'completed';

export interface Cycle {
  id: number;
  start_date: string;
  end_date: string | null;
  status: CycleStatus;
}

export function createCycle(startDate: string): number {
  const result = db.runSync(
    `INSERT INTO cycles (start_date, status)
     VALUES (?, 'active')`,
    [startDate]
  );

  return result.lastInsertRowId;
}

export function getActiveCycle(): Cycle | null {
  return db.getFirstSync<Cycle>(
    `SELECT *
     FROM cycles
     WHERE status = 'active'
     ORDER BY start_date DESC
     LIMIT 1`
  );
}

export function getAllCycles(): Cycle[] {
  return db.getAllSync<Cycle>(
    `SELECT *
     FROM cycles
     ORDER BY start_date DESC`
  );
}

export function completeCycle(
  cycleId: number,
  endDate: string
): void {
  db.runSync(
    `UPDATE cycles
     SET end_date = ?, status = 'completed'
     WHERE id = ? AND status = 'active'`,
    [endDate, cycleId]
  );
}

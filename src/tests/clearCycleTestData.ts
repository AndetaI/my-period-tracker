import { db } from '@/db/database';

export function clearCycleTestData(): void {
  db.withTransactionSync(() => {
    const rows = db.getAllSync<{
      id: number;
      start_date: string;
    }>(
      `SELECT id, start_date
       FROM cycles
       WHERE start_date IN (?, ?)
       ORDER BY start_date`,
      ['2026-10-01', '2026-10-29']
    );

    if (
      rows.length !== 2 ||
      rows[0].start_date !== '2026-10-01' ||
      rows[1].start_date !== '2026-10-29'
    ) {
      throw new Error(
        'Expected test cycles were not found. No records deleted.'
      );
    }

    const periods = db.getAllSync<{
      cycle_id: number;
      start_date: string;
    }>(
      `SELECT cycle_id, start_date
       FROM periods
       WHERE cycle_id IN (?, ?)`,
      [rows[0].id, rows[1].id]
    );

    if (
      periods.length !== 2 ||
      !periods.every(period =>
        period.start_date === '2026-10-01' ||
        period.start_date === '2026-10-29'
      )
    ) {
      throw new Error(
        'Period records do not match expected test data.'
      );
    }

    const result = db.runSync(
      `DELETE FROM cycles
       WHERE id IN (?, ?)`,
      [rows[0].id, rows[1].id]
    );

    if (result.changes !== 2) {
      throw new Error('Test cleanup was incomplete.');
    }
  });

  console.log('Test cycles and periods removed.');
}

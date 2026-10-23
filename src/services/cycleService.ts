import { db } from '@/db/database';

import {
  getActiveCycle,
  type Cycle,
} from '@/db/repositories/cycleRepository';

import {
  getPeriodByCycleId,
  type Period,
} from '@/db/repositories/periodRepository';

import { validateDate } from '@/utils/validation';

export interface ActiveCycleDetails {
  cycle: Cycle;
  period: Period | null;
}

export function getActiveCycleDetails(): ActiveCycleDetails | null {
  const cycle = getActiveCycle();

  if (!cycle) {
    return null;
  }

  return {
    cycle,
    period: getPeriodByCycleId(cycle.id),
  };
}

export function startFirstPeriod(
  startDate: string,
  expectedDurationDays: number
): void {
  validateDate(startDate);

  if (
    !Number.isInteger(expectedDurationDays) ||
    expectedDurationDays < 1 ||
    expectedDurationDays > 30
  ) {
    throw new Error('Expected duration must be between 1 and 30 days.');
  }

  db.withTransactionSync(() => {
    const activeCycle = getActiveCycle();

    if (activeCycle) {
      throw new Error(
        'An active cycle already exists. Complete its transition before starting another.'
      );
    }

    const cycleResult = db.runSync(
      `INSERT INTO cycles (start_date, status)
       VALUES (?, 'active')`,
      [startDate]
    );

    db.runSync(
      `INSERT INTO periods (
        cycle_id,
        start_date,
        expected_duration_days,
        status
      )
      VALUES (?, ?, ?, 'ongoing')`,
      [
        cycleResult.lastInsertRowId,
        startDate,
        expectedDurationDays,
      ]
    );
  });
}



export function endCurrentPeriod(endDate: string): void {
  validateDate(endDate);

  db.withTransactionSync(() => {
    const cycle = getActiveCycle();

    if (!cycle) {
      throw new Error('No active cycle exists.');
    }

    const period = getPeriodByCycleId(cycle.id);

    if (!period || period.status !== 'ongoing') {
      throw new Error('No ongoing period exists.');
    }

    if (endDate < period.start_date) {
      throw new Error(
        'Period end date cannot precede its start date.'
      );
    }

    const result = db.runSync(
      `UPDATE periods
       SET end_date = ?, status = 'completed'
       WHERE id = ? AND status = 'ongoing'`,
      [endDate, period.id]
    );

    if (result.changes !== 1) {
      throw new Error('Could not complete the period.');
    }
  });
}


export function startNextCycle(
  startDate: string,
  expectedDurationDays: number
): void {
  validateDate(startDate);

  if (
    !Number.isInteger(expectedDurationDays) ||
    expectedDurationDays < 1 ||
    expectedDurationDays > 30
  ) {
    throw new Error('Expected duration must be between 1 and 30 days.');
  }

  db.withTransactionSync(() => {
    const previousCycle = getActiveCycle();

    if (!previousCycle) {
      throw new Error(
        'No active cycle exists. Use startFirstPeriod instead.'
      );
    }

    if (startDate <= previousCycle.start_date) {
      throw new Error(
        'The next cycle must start after the previous cycle.'
      );
    }

    const previousPeriod = getPeriodByCycleId(previousCycle.id);

    if (!previousPeriod || previousPeriod.status !== 'completed') {
      throw new Error(
        'Complete the previous period before starting a new cycle.'
      );
    }

    if (
      previousPeriod.end_date &&
      startDate <= previousPeriod.end_date
    ) {
      throw new Error(
        'The next cycle cannot start before the previous period ends.'
      );
    }

    // The previous cycle ends one day before the next starts.
    const previousEndDate = new Date(
      `${startDate}T00:00:00Z`
    );

    previousEndDate.setUTCDate(
      previousEndDate.getUTCDate() - 1
    );

    const endDate = previousEndDate
      .toISOString()
      .slice(0, 10);

    const updateResult = db.runSync(
      `UPDATE cycles
       SET end_date = ?, status = 'completed'
       WHERE id = ? AND status = 'active'`,
      [endDate, previousCycle.id]
    );

    if (updateResult.changes !== 1) {
      throw new Error('Could not complete the previous cycle.');
    }

    const cycleResult = db.runSync(
      `INSERT INTO cycles (start_date, status)
       VALUES (?, 'active')`,
      [startDate]
    );

    db.runSync(
      `INSERT INTO periods (
        cycle_id,
        start_date,
        expected_duration_days,
        status
      )
      VALUES (?, ?, ?, 'ongoing')`,
      [
        cycleResult.lastInsertRowId,
        startDate,
        expectedDurationDays,
      ]
    );
  });
}



export function savePeriodRange(
  startDate: string,
  endDate: string,
  expectedDurationDays: number
): void {
  validateDate(startDate);
  validateDate(endDate);

  if (endDate < startDate) {
    throw new Error(
      'Period end date cannot be before its start date.'
    );
  }

  if (
    !Number.isInteger(expectedDurationDays) ||
    expectedDurationDays < 1 ||
    expectedDurationDays > 30
  ) {
    throw new Error(
      'Expected period duration must be between 1 and 30 days.'
    );
  }

  const actualDuration =
    Math.round(
      (
        new Date(`${endDate}T00:00:00Z`).getTime() -
        new Date(`${startDate}T00:00:00Z`).getTime()
      ) / 86400000
    ) + 1;

  if (actualDuration > 30) {
    throw new Error(
      'A recorded period cannot exceed 30 days.'
    );
  }

  db.withTransactionSync(() => {
    // Reject overlapping recorded periods.
    const overlap = db.getFirstSync<{ id: number }>(
      `SELECT id FROM periods
       WHERE start_date <= ?
         AND (
           end_date IS NULL
           OR end_date >= ?
         )
       LIMIT 1`,
      [endDate, startDate]
    );

    if (overlap) {
      throw new Error(
        'These dates overlap an existing recorded period.'
      );
    }

    const activeCycle = getActiveCycle();

    if (activeCycle) {
      const activePeriod = getPeriodByCycleId(
        activeCycle.id
      );

      if (
        !activePeriod ||
        activePeriod.status !== 'completed'
      ) {
        throw new Error(
          'Complete the ongoing period before starting another.'
        );
      }

      if (startDate <= activeCycle.start_date) {
        throw new Error(
          'The next period must start after the previous cycle.'
        );
      }

      // Complete the previous cycle one day before
      // the new period begins.
      const previousDay = new Date(
        `${startDate}T00:00:00Z`
      );

      previousDay.setUTCDate(
        previousDay.getUTCDate() - 1
      );

      const previousCycleEnd = previousDay
        .toISOString()
        .slice(0, 10);

      db.runSync(
        `UPDATE cycles
         SET end_date = ?, status = 'completed'
         WHERE id = ?`,
        [previousCycleEnd, activeCycle.id]
      );
    }

    // Create the new cycle.
    const cycleResult = db.runSync(
      `INSERT INTO cycles (start_date, status)
       VALUES (?, 'active')`,
      [startDate]
    );

    // Save the selected period as completed.
    db.runSync(
      `INSERT INTO periods (
         cycle_id,
         start_date,
         end_date,
         expected_duration_days,
         status
       )
       VALUES (?, ?, ?, ?, 'completed')`,
      [
        cycleResult.lastInsertRowId,
        startDate,
        endDate,
        expectedDurationDays,
      ]
    );

    // Synchronize the daily log bleeding status.
    // Existing symptoms, mood, and notes are preserved.
    // Any previously saved flow for these dates remains.
    db.runSync(
      `UPDATE daily_logs
       SET bleeding_status = 'period'
       WHERE date BETWEEN ? AND ?`,
      [startDate, endDate]
    );
  });
}

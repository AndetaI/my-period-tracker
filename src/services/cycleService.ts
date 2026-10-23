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

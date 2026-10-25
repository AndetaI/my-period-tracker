import { db } from '@/db/database';

import {
  getActiveCycle,
  type Cycle,
} from '@/db/repositories/cycleRepository';

import {
  getPeriodByCycleId,
  updatePeriod,
  type Period
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
        Date.parse(`${endDate}T00:00:00Z`) -
        Date.parse(`${startDate}T00:00:00Z`)
      ) / 86400000
    ) + 1;

  if (actualDuration > 30) {
    throw new Error(
      'A recorded period cannot exceed 30 days.'
    );
  }

  db.withTransactionSync(() => {
    // Check for overlapping periods.
    const overlap = db.getFirstSync<{ id: number }>(
      `SELECT id
       FROM periods
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

    // Find the period immediately before this one.
    const previousPeriod = db.getFirstSync<Period>(
      `SELECT *
       FROM periods
       WHERE start_date < ?
       ORDER BY start_date DESC
       LIMIT 1`,
      [startDate]
    );

    // Find the period immediately after this one.
    const nextPeriod = db.getFirstSync<Period>(
      `SELECT *
       FROM periods
       WHERE start_date > ?
       ORDER BY start_date ASC
       LIMIT 1`,
      [startDate]
    );

    // An ongoing period cannot be followed by another
    // recorded period until it has been completed.
    if (
      previousPeriod &&
      previousPeriod.status === 'ongoing'
    ) {
      throw new Error(
        'Complete the previous ongoing period first.'
      );
    }

    const activeCycle = getActiveCycle();

      if (activeCycle) {
        const temporaryEndDate = previousDate(startDate);

        // For historical insertion, the new period may be
        // earlier than the currently active cycle.
        // Keep its existing start date as a safe temporary end.
        const safeEndDate =
          temporaryEndDate >= activeCycle.start_date
            ? temporaryEndDate
            : activeCycle.start_date;

        db.runSync(
          `UPDATE cycles
          SET status = 'completed',
              end_date = ?
          WHERE id = ?`,
          [safeEndDate, activeCycle.id]
        );
      }

        const cycleResult = db.runSync(
          `INSERT INTO cycles (
            start_date,
            end_date,
            status
          )
      VALUES (?, ?, 'completed')`,
      [startDate, endDate]
    );

    // Insert the new period.
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

    // Recalculate cycle boundaries in chronological order.
    synchronizeCycleBoundaries();
  });
}

function previousDate(date: string): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() - 1);
  return result.toISOString().slice(0, 10);
}

function validatePeriodRange(
  startDate: string,
  endDate: string
): void {
  validateDate(startDate);
  validateDate(endDate);

  if (endDate < startDate) {
    throw new Error(
      'Period end date cannot be before its start date.'
    );
  }

  const duration =
    Math.round(
      (
        Date.parse(`${endDate}T00:00:00Z`) -
        Date.parse(`${startDate}T00:00:00Z`)
      ) / 86400000
    ) + 1;

  if (duration > 30) {
    throw new Error(
      'A recorded period cannot exceed 30 days.'
    );
  }
}

export function updateSavedPeriod(
  periodId: number,
  startDate: string,
  endDate: string
): void {
  validatePeriodRange(startDate, endDate);

  db.withTransactionSync(() => {
    const period = db.getFirstSync<Period>(
      `SELECT *
       FROM periods
       WHERE id = ?`,
      [periodId]
    );

    if (!period) {
      throw new Error('Period not found.');
    }

    if (period.status !== 'completed') {
      throw new Error(
        'Only completed periods can be edited.'
      );
    }

    // Check for overlapping periods, excluding this one.
    const overlap = db.getFirstSync<{ id: number }>(
      `SELECT id
       FROM periods
       WHERE id != ?
         AND start_date <= ?
         AND (
           end_date IS NULL
           OR end_date >= ?
         )
       LIMIT 1`,
      [periodId, endDate, startDate]
    );

    if (overlap) {
      throw new Error(
        'These dates overlap another recorded period.'
      );
    }

    // Find neighboring periods to preserve their order.
    const previous = db.getFirstSync<Period>(
      `SELECT *
       FROM periods
       WHERE id != ?
         AND start_date < ?
       ORDER BY start_date DESC
       LIMIT 1`,
      [periodId, period.start_date]
    );

    const next = db.getFirstSync<Period>(
      `SELECT *
       FROM periods
       WHERE id != ?
         AND start_date > ?
       ORDER BY start_date ASC
       LIMIT 1`,
      [periodId, period.start_date]
    );

    if (previous && startDate <= previous.start_date) {
      throw new Error(
        'The edited period cannot move before the previous period.'
      );
    }

    if (next && startDate >= next.start_date) {
      throw new Error(
        'The edited period cannot move after the next period.'
      );
    }

    // Update the period dates.
    updatePeriod(
      periodId,
      startDate,
      endDate,
      period.expected_duration_days
    );

    // Update its associated cycle.
    db.runSync(
      `UPDATE cycles
       SET start_date = ?
       WHERE id = ?`,
      [startDate, period.cycle_id]
    );

    // Recalculate all cycle boundaries.
    synchronizeCycleBoundaries();

    // Daily logs are deliberately left unchanged.
    // Existing flow, mood, notes and symptoms remain saved.
  });
}


export function deleteSavedPeriod(periodId: number): void {
  db.withTransactionSync(() => {
    const period = db.getFirstSync<Period>(
      `SELECT *
       FROM periods
       WHERE id = ?`,
      [periodId]
    );

    if (!period) {
      throw new Error('Period not found.');
    }

    if (period.status !== 'completed') {
      throw new Error(
        'Only completed periods can be deleted.'
      );
    }

    // Delete the associated cycle.
    // ON DELETE CASCADE also deletes its period
    // and any associated ovulation estimate.
    const result = db.runSync(
      `DELETE FROM cycles
       WHERE id = ?`,
      [period.cycle_id]
    );

    if (result.changes !== 1) {
      throw new Error(
        'Could not delete the selected period.'
      );
    }

    // Recalculate boundaries of remaining cycles.
    synchronizeCycleBoundaries();

    // Preserve daily logs, including bleeding observations,
    // flow, mood, notes and symptoms.
  });
}


function synchronizeCycleBoundaries(): void {
  const cycles = db.getAllSync<{
    id: number;
    start_date: string;
  }>(
    `SELECT id, start_date
     FROM cycles
     ORDER BY start_date ASC`
  );

  if (cycles.length === 0) {
    return;
  }

  // Temporarily complete the active cycle.
  // Both status and end_date must change together
  // to satisfy the CHECK constraint.
  const activeCycle = getActiveCycle();

  if (activeCycle) {
    db.runSync(
      `UPDATE cycles
       SET status = 'completed',
           end_date = start_date
       WHERE id = ?`,
      [activeCycle.id]
    );
  }

  // Recalculate all completed cycles.
  for (let index = 0; index < cycles.length - 1; index++) {
    const current = cycles[index];
    const next = cycles[index + 1];

    const endDate = previousDate(next.start_date);

    db.runSync(
      `UPDATE cycles
       SET end_date = ?,
           status = 'completed'
       WHERE id = ?`,
      [endDate, current.id]
    );
  }

  // Only the chronologically latest cycle is active.
  const latestCycle = cycles[cycles.length - 1];

  db.runSync(
    `UPDATE cycles
     SET end_date = NULL,
         status = 'active'
     WHERE id = ?`,
    [latestCycle.id]
  );
}

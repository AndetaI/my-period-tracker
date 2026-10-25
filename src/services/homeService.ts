
import {
    getActiveCycle,
    getAllCycles,
} from '@/db/repositories/cycleRepository';

import { getAllPeriods } from '@/db/repositories/periodRepository';
import { getUserSettings } from '@/db/repositories/settingsRepository';

// =====================================================
// DATE UTILITIES
// =====================================================

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function addDays(date: string, days: number): string {
  const result = parseDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function daysBetween(
  startDate: string,
  endDate: string
): number {
  return Math.round(
    (parseDate(endDate).getTime() -
      parseDate(startDate).getTime()) /
      86400000
  );
}

function getTodayString(): string {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

// =====================================================
// CURRENT CYCLE INFORMATION
// =====================================================

export interface HomeCycleInfo {
  cycleStartDate: string;
  cycleDay: number;
  expectedCycleLength: number;
  daysUntilNextPeriod: number;
  nextPeriodDate: string;
}

export function getHomeCycleInfo(): HomeCycleInfo | null {
  const activeCycle = getActiveCycle();

  if (!activeCycle) {
    return null;
  }

  const settings = getUserSettings();
  const today = getTodayString();

  const cycleDay = daysBetween(
    activeCycle.start_date,
    today
  ) + 1;

  const expectedCycleLength =
    settings.default_cycle_length;

  const nextPeriodDate = addDays(
    activeCycle.start_date,
    expectedCycleLength
  );

  const daysUntilNextPeriod = Math.max(
    0,
    daysBetween(today, nextPeriodDate)
  );

  return {
    cycleStartDate: activeCycle.start_date,
    cycleDay,
    expectedCycleLength,
    daysUntilNextPeriod,
    nextPeriodDate,
  };
}

// =====================================================
// MY CYCLES SUMMARY
// =====================================================

export interface MyCyclesSummary {
  cycleLength: number | null;
  periodLength: number | null;
  cycleVariation: number | null;
  regularity: 'Consistent' | 'Variable' | 'Not enough history';
}

export function getMyCyclesSummary(): MyCyclesSummary {
  const cycles = getAllCycles().filter(
    cycle =>
      cycle.status === 'completed' &&
      cycle.end_date !== null
  );

  const periods = getAllPeriods();

  if (cycles.length === 0) {
    return {
      cycleLength: null,
      periodLength: null,
      cycleVariation: null,
      regularity: 'Not enough history',
    };
  }

  const latestCycle = cycles[0];

  // Inclusive cycle duration.
  const cycleLength =
    daysBetween(
      latestCycle.start_date,
      latestCycle.end_date!
    ) + 1;

  const latestPeriod = periods.find(
    period => period.cycle_id === latestCycle.id
  );

  // Only completed periods have an actual duration.
  const periodLength = latestPeriod?.end_date
    ? daysBetween(
        latestPeriod.start_date,
        latestPeriod.end_date
      ) + 1
    : null;

  // Use up to six recent completed cycles.
  const cycleLengths = cycles
    .slice(0, 6)
    .map(
      cycle =>
        daysBetween(
          cycle.start_date,
          cycle.end_date!
        ) + 1
    );

  // Require at least three completed cycles
  // before describing the cycle pattern.
  if (cycleLengths.length < 3) {
    return {
      cycleLength,
      periodLength,
      cycleVariation: null,
      regularity: 'Not enough history',
    };
  }

  // Difference between the longest and shortest cycles.
  const cycleVariation =
    Math.max(...cycleLengths) -
    Math.min(...cycleLengths);

  // Descriptive app indicator, not a medical diagnosis.
  const regularity: MyCyclesSummary['regularity'] =
    cycleVariation <= 7
      ? 'Consistent'
      : 'Variable';

  return {
    cycleLength,
    periodLength,
    cycleVariation,
    regularity,
  };
}

// =====================================================
// CYCLE HISTORY
// =====================================================

export interface CycleHistoryItem {
  id: number;
  startDate: string;
  endDate: string | null;
  status: 'active' | 'completed';
  durationDays: number;
  periodStartDate: string | null;
  periodEndDate: string | null;
}

export function getCycleHistory(): CycleHistoryItem[] {
  const cycles = getAllCycles();
  const periods = getAllPeriods();
  const today = getTodayString();

  return cycles.map(cycle => {
    // Find the period associated with this cycle.
    const period = periods.find(
      item => item.cycle_id === cycle.id
    );

    // An active cycle continues through today.
    // A completed cycle uses its recorded end date.
    const effectiveEndDate =
      cycle.status === 'active'
        ? today
        : cycle.end_date;

    const durationDays = effectiveEndDate
      ? Math.max(
          0,
          daysBetween(
            cycle.start_date,
            effectiveEndDate
          ) + 1
        )
      : 0;

    return {
      id: cycle.id,
      startDate: cycle.start_date,
      endDate: cycle.end_date,
      status: cycle.status,
      durationDays,
      periodStartDate: period?.start_date ?? null,
      periodEndDate: period?.end_date ?? null,
    };
  });
}

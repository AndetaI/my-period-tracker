
import {
  getActiveCycle,
  getAllCycles,
} from '@/db/repositories/cycleRepository';

import { getAllPeriods } from '@/db/repositories/periodRepository';
import { getUserSettings } from '@/db/repositories/settingsRepository';

export interface CyclePrediction {
  periodStartDate: string;
  periodEndDate: string;
  ovulationDate: string;
}

const HISTORY_LIMIT = 6;
const MIN_CYCLE_LENGTH = 21;
const MAX_CYCLE_LENGTH = 45;

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);

  return Math.round((endTime - startTime) / 86400000);
}

function weightedAverage(values: number[]): number {
  if (values.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  values.forEach((value, index) => {
    // Values are ordered newest to oldest.
    const weight = values.length - index;
    weightedSum += value * weight;
    totalWeight += weight;
  });

  return Math.round(weightedSum / totalWeight);
}

export function getCyclePredictions(
  numberOfCycles = 12
): CyclePrediction[] {
  const activeCycle = getActiveCycle();
  const cycles = getAllCycles();
  const periods = getAllPeriods();
  const settings = getUserSettings();

  if (cycles.length === 0) {
    return [];
  }

  // Cycle starts are sorted newest first.
  const cycleStarts = [...new Set(cycles.map(c => c.start_date))]
    .sort((a, b) => b.localeCompare(a));

  const observedCycleLengths: number[] = [];

  for (
    let i = 0;
    i < cycleStarts.length - 1 &&
    observedCycleLengths.length < HISTORY_LIMIT;
    i++
  ) {
    const length = daysBetween(
      cycleStarts[i + 1],
      cycleStarts[i]
    );

    if (
      length >= MIN_CYCLE_LENGTH &&
      length <= MAX_CYCLE_LENGTH
    ) {
      observedCycleLengths.push(length);
    }
  }

  const cycleLength =
    observedCycleLengths.length > 0
      ? weightedAverage(observedCycleLengths)
      : settings.default_cycle_length;

  // Period duration is calculated from completed periods.
  const observedPeriodLengths = periods
    .filter(p => p.end_date !== null)
    .map(p => daysBetween(p.start_date, p.end_date!) + 1)
    .filter(length => length >= 1 && length <= 10)
    .slice(0, HISTORY_LIMIT);

  const periodLength =
    observedPeriodLengths.length > 0
      ? weightedAverage(observedPeriodLengths)
      : settings.default_period_length;

  if (
    !Number.isInteger(cycleLength) ||
    !Number.isInteger(periodLength) ||
    cycleLength <= 0 ||
    periodLength <= 0
  ) {
    return [];
  }

  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  // Prefer the most recent recorded cycle as the anchor.
  const anchorDate =
    activeCycle?.start_date ?? cycleStarts[0];

  const predictions: CyclePrediction[] = [];

  let nextStart = addDays(anchorDate, cycleLength);

  // Move forward until the predicted period is relevant.
  // Include the current estimated period if it has not ended.
  while (
    addDays(nextStart, periodLength - 1) < todayString
  ) {
    nextStart = addDays(nextStart, cycleLength);
  }

  for (let i = 0; i < numberOfCycles; i++) {
    const periodStartDate = nextStart;
    const periodEndDate = addDays(
      periodStartDate,
      periodLength - 1
    );

    // Approximate ovulation, not a confirmed event.
    const ovulationDate = addDays(
      periodStartDate,
      -14
    );

    predictions.push({
      periodStartDate,
      periodEndDate,
      ovulationDate,
    });

    nextStart = addDays(nextStart, cycleLength);
  }

  return predictions;
}

import { getActiveCycle } from '@/db/repositories/cycleRepository';
import { getUserSettings } from '@/db/repositories/settingsRepository';

export interface CyclePrediction {
  periodStartDate: string;
  periodEndDate: string;
  ovulationDate: string;
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function getCyclePredictions(
  numberOfCycles = 12
): CyclePrediction[] {
  const activeCycle = getActiveCycle();

  if (!activeCycle) {
    return [];
  }

  const settings = getUserSettings();

  const cycleLength = settings.default_cycle_length;
  const periodLength = settings.default_period_length;

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

  const predictions: CyclePrediction[] = [];

  for (let i = 1; i <= numberOfCycles; i++) {
    const periodStartDate = addDays(
      activeCycle.start_date,
      cycleLength * i
    );

    const periodEndDate = addDays(
      periodStartDate,
      periodLength - 1
    );

    const ovulationDate = addDays(
      periodStartDate,
      -14
    );

    // Include a cycle when at least one estimated
    // event is still relevant.
    if (
      periodEndDate >= todayString ||
      ovulationDate >= todayString
    ) {
      predictions.push({
        periodStartDate,
        periodEndDate,
        ovulationDate,
      });
    }
  }

  return predictions;
}

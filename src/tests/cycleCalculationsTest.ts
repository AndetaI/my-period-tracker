import {
    calculateCycleLength,
    calculatePeriodDuration,
} from '@/utils/cycleCalculations';

export function testCycleCalculations(): void {
  const periodDuration = calculatePeriodDuration(
    '2026-10-01',
    '2026-10-05'
  );

  const cycleLength = calculateCycleLength(
    '2026-10-01',
    '2026-10-29'
  );

  if (periodDuration !== 5) {
    throw new Error(
      `Expected period duration 5, got ${periodDuration}`
    );
  }

  if (cycleLength !== 28) {
    throw new Error(
      `Expected cycle length 28, got ${cycleLength}`
    );
  }

  console.log('Cycle calculation tests passed!');
}



import {
    endCurrentPeriod,
    startFirstPeriod,
    startNextCycle,
} from '@/services/cycleService';

import {
    getAllCycles,
} from '@/db/repositories/cycleRepository';

import {
    getAllPeriods,
} from '@/db/repositories/periodRepository';

export function testCycleLifecycle(): void {
  const existingCycles = getAllCycles();

  if (existingCycles.length > 0) {
    console.log(
      'Skipping cycle test: database already contains cycles.'
    );
    return;
  }

  console.log('Starting cycle lifecycle test...');

  startFirstPeriod('2026-10-01', 5);

  endCurrentPeriod('2026-10-05');

  startNextCycle('2026-10-29', 5);

  const cycles = getAllCycles();
  const periods = getAllPeriods();

  console.log('Cycles:', cycles);
  console.log('Periods:', periods);

  if (
    cycles.length !== 2 ||
    periods.length !== 2
  ) {
    throw new Error('Unexpected number of cycles or periods.');
  }

  const firstCycle = cycles.find(
    cycle => cycle.start_date === '2026-10-01'
  );

  const firstPeriod = periods.find(
    period => period.start_date === '2026-10-01'
  );

  if (
    firstCycle?.end_date !== '2026-10-28' ||
    firstCycle.status !== 'completed'
  ) {
    throw new Error('First cycle was not completed correctly.');
  }

  if (
    firstPeriod?.end_date !== '2026-10-05' ||
    firstPeriod.status !== 'completed'
  ) {
    throw new Error('First period was not completed correctly.');
  }

  console.log('Cycle lifecycle test passed!');
}

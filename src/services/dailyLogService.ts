import { db } from '@/db/database';

import {
    getDailyLog,
    saveDailyObservations,
    type DailyLog,
    type MoodLevel,
} from '@/db/repositories/dailyLogRepository';

import {
    getSymptomsForDate,
    saveSymptomsForDate,
    type Symptom,
} from '@/db/repositories/symptomRepository';

import type { FlowLevel } from '@/types/period';
import { validateDate } from '@/utils/validation';

export interface DailyLogInput {
  date: string;
  flow: FlowLevel | null;
  mood: MoodLevel | null;
  notes: string;
  symptomIds: number[];
}

export interface DailyLogDetails {
  log: DailyLog | null;
  symptoms: Symptom[];
}

export function getDailyLogDetails(
  date: string
): DailyLogDetails {
  validateDate(date);

  return {
    log: getDailyLog(date),
    symptoms: getSymptomsForDate(date),
  };
}

export function saveDailyLogDetails(
  input: DailyLogInput
): void {
  validateDate(input.date);

  if (input.notes.length > 2000) {
    throw new Error(
      'Notes cannot exceed 2000 characters.'
    );
  }

  if (
    input.symptomIds.some(
      id => !Number.isInteger(id) || id <= 0
    )
  ) {
    throw new Error('Invalid symptom ID.');
  }

  db.withTransactionSync(() => {
    saveDailyObservations(
      input.date,
      input.flow,
      input.mood,
      input.notes
    );

    saveSymptomsForDate(
      input.date,
      input.symptomIds
    );
  });
}

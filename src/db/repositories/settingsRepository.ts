
import { db } from '../database';

export interface UserSettings {
  id: number;
  default_cycle_length: number;
  default_period_length: number;
  notifications_enabled: number;
  prediction_method: 'statistical' | 'ml';
}

export function getUserSettings(): UserSettings {
  const settings = db.getFirstSync<UserSettings>(
    'SELECT * FROM user_settings WHERE id = 1'
  );

  if (!settings) {
    throw new Error(
      'User settings have not been initialized.'
    );
  }

  return settings;
}

export function saveUserSettings(
  cycleLength: number,
  periodLength: number
): void {
  if (
    !Number.isInteger(cycleLength) ||
    cycleLength < 15 ||
    cycleLength > 90
  ) {
    throw new Error(
      'Cycle length must be between 15 and 90 days.'
    );
  }

  if (
    !Number.isInteger(periodLength) ||
    periodLength < 1 ||
    periodLength > 30
  ) {
    throw new Error(
      'Period length must be between 1 and 30 days.'
    );
  }

  db.runSync(
    `INSERT INTO user_settings (
       id,
       default_cycle_length,
       default_period_length
     )
     VALUES (1, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET
       default_cycle_length = excluded.default_cycle_length,
       default_period_length = excluded.default_period_length`,
    [cycleLength, periodLength]
  );
}

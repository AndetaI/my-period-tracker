import { db } from '../database';

export interface Symptom {
  id: number;
  name: string;
}

export function getAllSymptoms(): Symptom[] {
  return db.getAllSync<Symptom>(
    'SELECT id, name FROM symptoms ORDER BY name'
  );
}

export function getSymptomsForDate(date: string): Symptom[] {
  return db.getAllSync<Symptom>(
    `SELECT s.id, s.name
     FROM symptoms s
     JOIN daily_log_symptoms dls
       ON dls.symptom_id = s.id
     JOIN daily_logs dl
       ON dl.id = dls.daily_log_id
     WHERE dl.date = ?
     ORDER BY s.name`,
    [date]
  );
}

export function saveSymptomsForDate(
  date: string,
  symptomIds: number[]
): void {
  const dailyLog = db.getFirstSync<{ id: number }>(
    'SELECT id FROM daily_logs WHERE date = ?',
    [date]
  );

  if (!dailyLog) {
    throw new Error(
      'Daily log must exist before saving symptoms.'
    );
  }

  db.runSync(
    'DELETE FROM daily_log_symptoms WHERE daily_log_id = ?',
    [dailyLog.id]
  );

  for (const symptomId of new Set(symptomIds)) {
    db.runSync(
      `INSERT INTO daily_log_symptoms
         (daily_log_id, symptom_id)
       VALUES (?, ?)`,
      [dailyLog.id, symptomId]
    );
  }
}

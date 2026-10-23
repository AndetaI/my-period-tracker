import type { PeriodLog } from '@/types/period';

export interface CyclePrediction {
  averageCycleLength: number;
  nextPeriodDate: string;     // "YYYY-MM-DD"
  estimatedOvulation: string; // "YYYY-MM-DD"
  fertileWindowStart: string; // "YYYY-MM-DD"
  fertileWindowEnd: string;   // "YYYY-MM-DD"
}

// Formats a Date object into "YYYY-MM-DD"
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Calculate rolling average length across past cycles
export function calculateAverageCycleLength(logs: PeriodLog[]): number {
  if (logs.length < 2) return 28; // Standard default fallback (28 days)

  let totalDays = 0;
  const count = Math.min(logs.length - 1, 6); // Look at last 6 cycles max

  for (let i = 0; i < count; i++) {
    const current = new Date(logs[i].start_date);
    const previous = new Date(logs[i + 1].start_date);
    const diffTime = Math.abs(current.getTime() - previous.getTime());
    totalDays += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  return Math.round(totalDays / count);
}

// Calculate predictions for next period, ovulation, and fertile window
export function getCyclePredictions(logs: PeriodLog[]): CyclePrediction | null {
  if (logs.length === 0) return null;

  const lastStartDateStr = logs[0].start_date;
  const avgLength = calculateAverageCycleLength(logs);

  // Next Period = Last Start Date + Average Cycle Length
  const nextPeriod = new Date(lastStartDateStr);
  nextPeriod.setDate(nextPeriod.getDate() + avgLength);

  // Ovulation = Estimated Next Period - 14 Days
  const ovulation = new Date(nextPeriod);
  ovulation.setDate(ovulation.getDate() - 14);

  // Fertile Window = 5 Days before ovulation to 1 day after
  const fertileStart = new Date(ovulation);
  fertileStart.setDate(fertileStart.getDate() - 5);

  const fertileEnd = new Date(ovulation);
  fertileEnd.setDate(fertileEnd.getDate() + 1);

  return {
    averageCycleLength: avgLength,
    nextPeriodDate: formatDate(nextPeriod),
    estimatedOvulation: formatDate(ovulation),
    fertileWindowStart: formatDate(fertileStart),
    fertileWindowEnd: formatDate(fertileEnd),
  };
}
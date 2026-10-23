export interface PeriodSelection {
  startDate: string;
  endDate: string;
}

export function addDays(
  date: string,
  days: number
): string {
  const result = new Date(`${date}T00:00:00Z`);

  result.setUTCDate(result.getUTCDate() + days);

  return result.toISOString().slice(0, 10);
}

export function createPeriodSelection(
  startDate: string,
  defaultDuration: number
): PeriodSelection {
  if (
    !Number.isInteger(defaultDuration) ||
    defaultDuration < 1 ||
    defaultDuration > 30
  ) {
    throw new Error(
      'Default period duration must be between 1 and 30 days.'
    );
  }

  return {
    startDate,
    endDate: addDays(startDate, defaultDuration - 1),
  };
}

export function updatePeriodSelection(
  selection: PeriodSelection,
  tappedDate: string,
  defaultDuration: number
): PeriodSelection {
  const { startDate, endDate } = selection;

  if (tappedDate === addDays(startDate, -1)) {
    return { startDate: tappedDate, endDate };
  }

  if (tappedDate === addDays(endDate, 1)) {
    return { startDate, endDate: tappedDate };
  }

  if (tappedDate === startDate && startDate !== endDate) {
    return {
      startDate: addDays(startDate, 1),
      endDate,
    };
  }

  if (tappedDate === endDate && startDate !== endDate) {
    return {
      startDate,
      endDate: addDays(endDate, -1),
    };
  }

  return createPeriodSelection(tappedDate, defaultDuration);
}

export function isDateSelected(
  date: string,
  selection: PeriodSelection | null
): boolean {
  return (
    selection !== null &&
    date >= selection.startDate &&
    date <= selection.endDate
  );
}

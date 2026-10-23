
export type FlowLevel = 'Light' | 'Medium' | 'Heavy';

export interface PeriodLog {
  id: number;
  start_date: string;
  end_date: string | null;
  flow: FlowLevel | null;
  notes: string | null;
}

export interface DailyLog {
  id: number;
  date: string;
  is_period: number;
  flow: FlowLevel | null;
  notes: string | null;
}

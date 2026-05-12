export type RecurrenceKind = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'every_n_days';
export interface Recurrence {
  kind: RecurrenceKind;
  byweekday?: number[];
  byday?: number;
  every?: number;
}

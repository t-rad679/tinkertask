// parsed-task.ts
export interface ParsedTask {
  title: string;
  body: string | null;
  kind: 'task' | 'habit';
  due_at: string | null;       // ISO-8601
  recurrence: { kind: string; byweekday?: number[]; byday?: number; every?: number } | null;
  target_value: number | null;
  target_period: 'day' | 'week' | null;
  tags: string[];
  scope: string | null;
}

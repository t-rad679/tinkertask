export interface ViewQuery {
  filter?: {
    kind?: Array<'task' | 'habit'>;
    scope?: { id: string | null; include_descendants: boolean };
    scope_type?: string[];
    tags?: { all?: string[]; any?: string[]; none?: boolean };
    status?: Array<'open' | 'completed' | 'archived'>;
    due?: {
      preset?: 'today' | 'overdue' | 'overdue_or_today' | 'this_week' | 'this_month' | null;
      before?: string;
      after?: string;
    };
    recurrence?: 'any' | 'none' | null;
    search?: string;
  };
  sort?: Array<{ field: 'due_at' | 'title' | 'created_at' | 'updated_at' | 'scope'; dir: 'asc' | 'desc' }>;
  group?: 'due' | 'scope' | 'scope_type' | 'kind' | 'status' | 'none';
  display?: { show_completed?: boolean; compact?: boolean };
}

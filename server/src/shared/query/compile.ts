import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  SQL,
  sql,
} from 'drizzle-orm';
import { tasks, taskTags, scopes } from '@/db/schema';
import { ViewQuery } from './view-query.types';

const MS_PER_DAY = 86_400_000;

function startOfTodayUtc(now: Date): Date {
  const t = new Date(now);
  t.setUTCHours(0, 0, 0, 0);
  return t;
}

function startOfWeekUtc(now: Date): Date {
  const t = startOfTodayUtc(now);
  const dow = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dow);
  return t;
}

function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function duePresetRange(
  preset: string,
  now: Date,
): { start?: Date; end?: Date; includeOverdue?: boolean } {
  const today = startOfTodayUtc(now);
  const tomorrow = new Date(today.getTime() + MS_PER_DAY);
  switch (preset) {
    case 'today':
      return { start: today, end: tomorrow };
    case 'overdue':
      return { end: today, includeOverdue: true };
    case 'overdue_or_today':
      return { end: tomorrow, includeOverdue: true };
    case 'this_week': {
      const start = startOfWeekUtc(now);
      const end = new Date(start.getTime() + 7 * MS_PER_DAY);
      return { start, end };
    }
    case 'this_month': {
      const start = startOfMonthUtc(now);
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return { start, end: next };
    }
    default:
      return {};
  }
}

export interface CompileContext {
  userId: string;
  now: Date;
  /** Async because scope descendants require a recursive CTE. */
  resolveScopeDescendants: (scopeId: string) => Promise<string[]>;
}

export async function compileViewQuery(q: ViewQuery, ctx: CompileContext) {
  const f = q.filter ?? {};
  const conds: (SQL | undefined)[] = [eq(tasks.userId, ctx.userId), isNull(tasks.deletedAt)];

  if (f.kind && f.kind.length > 0) {
    conds.push(inArray(tasks.kind, f.kind));
  }

  if (f.status && f.status.length > 0) {
    conds.push(inArray(tasks.status, f.status));
  }

  if (f.scope !== undefined) {
    if (f.scope.id === null) {
      conds.push(isNull(tasks.scopeId));
    } else {
      const ids = f.scope.include_descendants
        ? await ctx.resolveScopeDescendants(f.scope.id)
        : [f.scope.id];
      conds.push(inArray(tasks.scopeId, ids));
    }
  }

  if (f.scope_type && f.scope_type.length > 0) {
    // Subselect: tasks whose scope belongs to one of the given scope_type_ids
    conds.push(
      sql`${tasks.scopeId} IN (SELECT id FROM ${scopes} WHERE user_id = ${ctx.userId} AND scope_type_id = ANY(${f.scope_type as string[]}) AND deleted_at IS NULL)`,
    );
  }

  if (f.tags) {
    if (f.tags.none) {
      conds.push(
        sql`NOT EXISTS (SELECT 1 FROM ${taskTags} WHERE task_id = ${tasks.id} AND deleted_at IS NULL)`,
      );
    } else {
      if (f.tags.all && f.tags.all.length > 0) {
        for (const tagId of f.tags.all) {
          conds.push(
            sql`EXISTS (SELECT 1 FROM ${taskTags} WHERE task_id = ${tasks.id} AND tag_id = ${tagId} AND deleted_at IS NULL)`,
          );
        }
      }
      if (f.tags.any && f.tags.any.length > 0) {
        conds.push(
          sql`EXISTS (SELECT 1 FROM ${taskTags} WHERE task_id = ${tasks.id} AND tag_id = ANY(${f.tags.any as string[]}) AND deleted_at IS NULL)`,
        );
      }
    }
  }

  if (f.due) {
    const preset = f.due.preset;
    if (preset) {
      const r = duePresetRange(preset, ctx.now);
      if (r.includeOverdue) {
        if (r.end) conds.push(lt(tasks.dueAt, r.end));
      } else {
        if (r.start) conds.push(gte(tasks.dueAt, r.start));
        if (r.end) conds.push(lt(tasks.dueAt, r.end));
      }
    } else {
      if (f.due.after) conds.push(gte(tasks.dueAt, new Date(f.due.after)));
      if (f.due.before) conds.push(lt(tasks.dueAt, new Date(f.due.before)));
    }
  }

  if (f.recurrence === 'any') conds.push(sql`${tasks.recurrence} IS NOT NULL`);
  if (f.recurrence === 'none') conds.push(isNull(tasks.recurrence));

  if (f.search) {
    const pattern = `%${f.search.toLowerCase()}%`;
    conds.push(
      sql`(lower(${tasks.title}) LIKE ${pattern} OR lower(coalesce(${tasks.body}, '')) LIKE ${pattern})`,
    );
  }

  const where = and(...(conds.filter((c): c is SQL => !!c)));

  const sortClauses = (q.sort ?? []).map((s) => {
    const dir = s.dir === 'desc' ? desc : asc;
    switch (s.field) {
      case 'due_at':
        return dir(tasks.dueAt);
      case 'title':
        return dir(tasks.title);
      case 'created_at':
        return dir(tasks.createdAt);
      case 'updated_at':
        return dir(tasks.updatedAt);
      case 'scope':
        return dir(tasks.scopeId);
    }
  });

  return { where, sortClauses };
}

import { z } from 'zod';

const KindEnum = z.enum(['task', 'habit']);
const StatusEnum = z.enum(['open', 'completed', 'archived']);

export const ViewQuerySchema = z
  .object({
    filter: z
      .object({
        kind: z.array(KindEnum).optional(),
        scope: z
          .object({ id: z.string().uuid().nullable(), include_descendants: z.boolean() })
          .optional(),
        scope_type: z.array(z.string().uuid()).optional(),
        tags: z
          .object({
            all: z.array(z.string().uuid()).optional(),
            any: z.array(z.string().uuid()).optional(),
            none: z.boolean().optional(),
          })
          .optional(),
        status: z.array(StatusEnum).optional(),
        due: z
          .object({
            preset: z
              .enum(['today', 'overdue', 'overdue_or_today', 'this_week', 'this_month'])
              .nullable()
              .optional(),
            before: z.string().datetime().optional(),
            after: z.string().datetime().optional(),
          })
          .optional(),
        recurrence: z.enum(['any', 'none']).nullable().optional(),
        search: z.string().max(200).optional(),
      })
      .strict()
      .optional(),
    sort: z
      .array(
        z.object({
          field: z.enum(['due_at', 'title', 'created_at', 'updated_at', 'scope']),
          dir: z.enum(['asc', 'desc']),
        }),
      )
      .optional(),
    group: z.enum(['due', 'scope', 'scope_type', 'kind', 'status', 'none']).optional(),
    display: z
      .object({ show_completed: z.boolean().optional(), compact: z.boolean().optional() })
      .strict()
      .optional(),
  })
  .strict();

export function validateViewQuery(input: unknown) {
  const result = ViewQuerySchema.safeParse(input);
  if (!result.success) return { ok: false as const, errors: result.error.issues };
  return { ok: true as const, value: result.data };
}

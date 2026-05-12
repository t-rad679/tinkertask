import { isNull, SQL } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';

/** AND-able fragment to filter out tombstoned rows. */
export function notDeleted(col: PgColumn): SQL {
  return isNull(col);
}

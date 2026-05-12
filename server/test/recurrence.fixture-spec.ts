import fs from 'node:fs';
import path from 'node:path';
import { nextDueDate } from '@/shared/recurrence/next-due';

// Test runs from server/test/. Fixtures live at repo-root lib/fixtures/.
const FIXTURE = path.join(__dirname, '..', '..', 'lib', 'fixtures', 'recurrence.json');
const cases = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Array<{
  name: string;
  rec: Parameters<typeof nextDueDate>[0];
  anchor: string;
  from: string;
  expected: string;
}>;

describe('recurrence fixture parity', () => {
  for (const c of cases) {
    it(c.name, () => {
      const got = nextDueDate(c.rec, new Date(`${c.anchor}T00:00:00Z`), new Date(`${c.from}T00:00:00Z`));
      expect(got.toISOString().slice(0, 10)).toBe(c.expected);
    });
  }
});

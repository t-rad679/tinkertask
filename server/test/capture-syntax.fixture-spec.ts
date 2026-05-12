import fs from 'node:fs';
import path from 'node:path';
import { parseCaptureSyntax } from '@/shared/syntax/parser';

// Test runs from server/test/. Fixtures live at repo-root lib/fixtures/.
const FIXTURE = path.join(__dirname, '..', '..', 'lib', 'fixtures', 'capture_syntax.json');
const cases = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

describe('capture syntax fixtures', () => {
  for (const c of cases) {
    it(c.name, () => {
      const got = parseCaptureSyntax(c.input, { today: new Date(`${c.options.today}T00:00:00Z`), timezone: 'UTC' });
      expect(got).toEqual(c.expected);
    });
  }
});

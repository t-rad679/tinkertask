// src/shared/syntax/parser.ts
import fs from 'node:fs';
import path from 'node:path';
import peggy from 'peggy';
import { ParsedTask } from './parsed-task';

// Grammar lives at the monorepo's lib/grammar/. Resolve it whether we're running from:
//   - dev:  server/src/shared/syntax/parser.ts → 4 levels up to repo root
//   - prod: server/dist/shared/syntax/parser.js → 3 levels up to /app (Docker WORKDIR), and lib/ is copied alongside dist/
// Try both candidates and use whichever exists.
function locateGrammar(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', '..', 'lib', 'grammar', 'capture-syntax.peggy'), // dev (ts-node)
    path.resolve(__dirname, '..', '..', '..', 'lib', 'grammar', 'capture-syntax.peggy'),       // prod (built, inside Docker)
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error(`capture-syntax.peggy not found. Tried:\n${candidates.join('\n')}`);
  return found;
}
const grammar = fs.readFileSync(locateGrammar(), 'utf8');
const parser = peggy.generate(grammar, { output: 'parser', allowedStartRules: ['Root'] });

export interface ParseOptions {
  today?: Date;
  timezone?: string;
}

export function parseCaptureSyntax(text: string, options: ParseOptions = {}): ParsedTask {
  try {
    return parser.parse(text, options) as ParsedTask;
  } catch (e: any) {
    const err = new Error(e.message || 'parse failed') as any;
    err.location = e.location;
    err.position = e.location?.start?.offset ?? null;
    throw err;
  }
}

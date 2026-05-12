// src/shared/syntax/parser.ts
import peggy from 'peggy';
import { ParsedTask } from './parsed-task';
import { CAPTURE_SYNTAX_GRAMMAR } from './grammar';

const parser = peggy.generate(CAPTURE_SYNTAX_GRAMMAR, {
  output: 'parser',
  allowedStartRules: ['Root'],
});

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

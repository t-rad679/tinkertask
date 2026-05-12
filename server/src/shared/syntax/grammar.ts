// Peggy grammar source for capture syntax. Inlined as a String.raw template
// literal so it ships with the compiled JS — no runtime filesystem lookup, and
// no codegen step. String.raw preserves the \n/\t/\" escape sequences used in
// the grammar's character classes; do not switch to a plain template literal.
// The ${'`'} substitutions inject literal backticks (the grammar uses them in
// a comment) without terminating the template.
const BT = '`';

export const CAPTURE_SYNTAX_GRAMMAR = String.raw`{{
  // helpers — runtime; the parser's ${BT}options${BT} carries today + timezone
  function makeRoot(parts, options) {
    const titleTokens = [];
    let kind = 'task';
    let due = null;
    let recurrence = null;
    let targetValue = null;
    let targetPeriod = null;
    let note = null;
    const tags = [];
    let scope = null;

    for (const tok of parts) {
      if (tok.type === 'word') titleTokens.push(tok.value);
      else if (tok.type === 'tag') tags.push(tok.value);
      else if (tok.type === 'scope') scope = tok.value;
      else if (tok.type === 'habit') kind = 'habit';
      else if (tok.type === 'due') due = tok.value;
      else if (tok.type === 'repeat') recurrence = tok.value;
      else if (tok.type === 'target') { kind = 'habit'; targetValue = tok.value.value; targetPeriod = tok.value.period; }
      else if (tok.type === 'targetNone') { kind = 'habit'; targetValue = null; targetPeriod = null; }
      else if (tok.type === 'note') note = tok.value;
    }

    // bare habit → target_value=1, target_period=day (boolean daily)
    if (kind === 'habit' && targetValue === null && targetPeriod === null && !parts.some(p => p.type === 'targetNone')) {
      targetValue = 1;
      targetPeriod = 'day';
    }

    if (kind === 'habit' && due !== null) {
      error('due: is only valid for tasks, not habits');
    }

    return {
      title: titleTokens.join(' ').trim(),
      body: note,
      kind,
      due_at: due,
      recurrence,
      target_value: targetValue,
      target_period: targetPeriod,
      tags,
      scope,
    };
  }

  function resolveDate(spec, options) {
    const tz = options.timezone || 'UTC';
    const today = options.today instanceof Date ? options.today : new Date();
    // Use simple UTC arithmetic; for IANA-tz precision use a date lib in the host
    if (spec.kind === 'absolute') return spec.iso;
    if (spec.kind === 'today') return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString();
    if (spec.kind === 'tomorrow') {
      const t = new Date(today); t.setUTCDate(t.getUTCDate() + 1); t.setUTCHours(0,0,0,0); return t.toISOString();
    }
    if (spec.kind === 'in') {
      const t = new Date(today); t.setUTCHours(0,0,0,0);
      if (spec.unit === 'd') t.setUTCDate(t.getUTCDate() + spec.n);
      else if (spec.unit === 'w') t.setUTCDate(t.getUTCDate() + 7 * spec.n);
      else if (spec.unit === 'm') t.setUTCMonth(t.getUTCMonth() + spec.n);
      return t.toISOString();
    }
    if (spec.kind === 'weekday') {
      // next occurrence (strictly after today)
      const t = new Date(today); t.setUTCHours(0,0,0,0);
      const todayDow = (t.getUTCDay() + 6) % 7;
      const target = spec.dow;
      let add = (target - todayDow + 7) % 7;
      if (add === 0) add = 7;
      t.setUTCDate(t.getUTCDate() + add);
      return t.toISOString();
    }
    error('unknown date spec');
  }

  const DOW = { mon:0, tue:1, wed:2, thu:3, fri:4, sat:5, sun:6 };
}}

Root
  = _ parts:(Token (_ Token)*)? _ {
      const tokens = parts ? [parts[0]].concat(parts[1].map(p => p[1])) : [];
      return makeRoot(tokens, options);
    }

Token "token"
  = HabitMarker
  / Tag
  / Scope
  / Due
  / Repeat
  / TargetNone
  / Target
  / NoteDashDash
  / NoteKeyword
  / Word

HabitMarker
  = "habit" ![A-Za-z0-9_-] { return { type: 'habit' }; }

Tag
  = "#" name:Ident { return { type: 'tag', value: name }; }

Scope
  = "@" path:ScopePath { return { type: 'scope', value: path }; }

ScopePath
  = first:Ident rest:("/" Ident)* { return [first].concat(rest.map(r => r[1])).join('/'); }

Due
  = "due:"i s:DateSpec { return { type: 'due', value: resolveDate(s, options) }; }

DateSpec
  = "today"i  { return { kind: 'today' }; }
  / "tomorrow"i { return { kind: 'tomorrow' }; }
  / "in/" n:Integer u:("d"/"w"/"m") { return { kind: 'in', n, unit: u }; }
  / iso:IsoDate { return { kind: 'absolute', iso: iso }; }
  / w:Weekday { return { kind: 'weekday', dow: DOW[w] }; }

Repeat
  = "repeat:"i r:RepeatSpec { return { type: 'repeat', value: r }; }

RepeatSpec
  = "daily"i { return { kind: 'daily' }; }
  / "weekdays"i { return { kind: 'weekdays' }; }
  / "weekly/" days:WeekdayList { return { kind: 'weekly', byweekday: days.map(d => DOW[d]) }; }
  / "monthly/" n:Integer { return { kind: 'monthly', byday: n }; }
  / "every/" n:Integer "d" { return { kind: 'every_n_days', every: n }; }

WeekdayList
  = first:Weekday rest:("," Weekday)* { return [first].concat(rest.map(r => r[1])); }

Target
  = "target:"i n:Integer "/" p:("day"/"week") { return { type: 'target', value: { value: n, period: p } }; }

TargetNone
  = "target:"i "none"i { return { type: 'targetNone' }; }

NoteDashDash
  = "--" _ rest:$([^\n]*) { return { type: 'note', value: rest.trim() }; }

NoteKeyword
  = "note:"i '"' s:$([^"]*) '"' { return { type: 'note', value: s }; }
  / "note:"i s:Ident { return { type: 'note', value: s }; }

Word
  = chars:[^ \t\n#@] rest:$([^ \t\n]*) { return { type: 'word', value: chars + rest }; }

Ident = $([A-Za-z0-9_-]+)
Integer = digits:$([0-9]+) { return parseInt(digits, 10); }
Weekday = w:$("mon"/"tue"/"wed"/"thu"/"fri"/"sat"/"sun") { return w; }
IsoDate = $([0-9][0-9][0-9][0-9] "-" [0-9][0-9] "-" [0-9][0-9] ("T" [0-9][0-9] ":" [0-9][0-9])?)
_ = [ \t]*
`;

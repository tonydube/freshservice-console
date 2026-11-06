/**
 * Tiny evaluator for Freshservice's ticket filter query language, used by the mock only.
 * Grammar: expr := term (('AND'|'OR') term)* ; term := '(' expr ')' | field(':'|':>'|':<')value
 * AND binds tighter than OR.
 */
type Value = string | number | boolean | null;
type Pred = (t: Record<string, unknown>) => boolean;

export class FilterSyntaxError extends Error {}

function tokenize(q: string): string[] {
  const re = /\s*(\(|\)|AND\b|OR\b|[a-z_0-9]+:[<>]?(?:'[^']*'|[^\s()]+))/giy;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  let pos = 0;
  while (pos < q.length && (m = re.exec(q))) {
    out.push(m[1]);
    pos = re.lastIndex;
  }
  if (q.slice(pos).trim()) throw new FilterSyntaxError(`Unexpected input near "${q.slice(pos, pos + 20)}"`);
  return out;
}

function parseValue(raw: string): Value {
  if (raw.startsWith("'")) return raw.slice(1, -1);
  if (raw === 'null') return null;
  if (raw === 'true' || raw === 'false') return raw === 'true';
  const n = Number(raw);
  if (Number.isNaN(n)) throw new FilterSyntaxError(`Strings must be in single quotes: ${raw}`);
  return n;
}

export function compileFilter(query: string, resolve: (t: Record<string, unknown>, field: string) => unknown): Pred {
  const tokens = tokenize(query);
  let i = 0;

  const term = (): Pred => {
    const tok = tokens[i++];
    if (tok === '(') {
      const p = expr();
      if (tokens[i++] !== ')') throw new FilterSyntaxError('Missing )');
      return p;
    }
    const m = tok?.match(/^([a-z_0-9]+):([<>]?)(.+)$/i);
    if (!m) throw new FilterSyntaxError(`Bad term: ${tok}`);
    const [, field, op, rawVal] = m;
    const val = parseValue(rawVal);
    return (t) => {
      const actual = resolve(t, field);
      if (Array.isArray(actual)) return actual.includes(val);
      if (op === '') return (actual ?? null) === val || String(actual).slice(0, 10) === val;
      if (actual == null || val == null) return false;
      return op === '>' ? String(actual) >= String(val) || Number(actual) >= Number(val)
        : String(actual).slice(0, String(val).length) <= String(val) || Number(actual) <= Number(val);
    };
  };

  const andExpr = (): Pred => {
    let left = term();
    while (tokens[i]?.toUpperCase() === 'AND') {
      i++;
      const l = left, r = term();
      left = (t) => l(t) && r(t);
    }
    return left;
  };

  const expr = (): Pred => {
    let left = andExpr();
    while (tokens[i]?.toUpperCase() === 'OR') {
      i++;
      const l = left, r = andExpr();
      left = (t) => l(t) || r(t);
    }
    return left;
  };

  const p = expr();
  if (i < tokens.length) throw new FilterSyntaxError(`Unexpected ${tokens[i]}`);
  return p;
}

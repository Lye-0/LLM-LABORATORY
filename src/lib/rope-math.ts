import { coefficients, dot4, ropeQ, ropeK, type Four } from './rope';
// MathML is generated from fixed teaching data and numeric positions only.
export const num = (n: number) =>
  n < 0 ? `<mrow><mo>−</mo><mn>${-n}</mn></mrow>` : `<mn>${n}</mn>`;
export const op = (s: string) => `<mo>${s}</mo>`;
export const sub = (s: string, i: number) => `<msub><mi>${s}</mi>${num(i)}</msub>`;
export const row = (s: string) => `<mrow>${s}</mrow>`;
export const trans = (s: string) => `<msup>${row(op('(') + s + op(')'))}<mi>T</mi></msup>`;
export const angle = (p: number, i: number, t?: number) =>
  `${t === undefined ? num(p) : row(op('(') + num(t) + op('−') + num(p) + op(')'))}${sub('ω', i)}`;
export const trig = (fn: string, a: string) =>
  row(`<mi mathvariant="normal">${fn}</mi>${op('(')}${a}${op(')')}`);
export const matrix = (rows: string[][]) =>
  row(
    `<mo stretchy="true" minsize="${rows.length * 1.4}em">(</mo>` +
      `<mtable>${rows.map((r) => `<mtr>${r.map((v) => `<mtd>${v}</mtd>`).join('')}</mtr>`).join('')}</mtable>` +
      `<mo stretchy="true" minsize="${rows.length * 1.4}em">)</mo>`,
  );
export const vector = (v: Four, horizontal = false) =>
  matrix(horizontal ? [v.map(num)] : v.map((n) => [num(n)]));
export function rotation(p: number, t?: number) {
  const c = [0, 1].map((i) => trig('cos', angle(p, i, t))),
    s = [0, 1].map((i) => trig('sin', angle(p, i, t))),
    z = num(0);
  return matrix([
    [c[0], z, op('−') + s[0], z],
    [z, c[1], z, op('−') + s[1]],
    [s[0], z, c[0], z],
    [z, s[1], z, c[1]],
  ]);
}
function term(n: number, body: string, first: boolean) {
  if (!n) return '';
  return (
    (n < 0 ? op('−') : first ? '' : op('+')) + (Math.abs(n) === 1 ? '' : num(Math.abs(n))) + body
  );
}
function sum(terms: [number, string][]) {
  let s = '';
  for (const [n, body] of terms) s += term(n, body, !s);
  return s || num(0);
}
export function rotatedComponents(v: Four, p: number, t?: number): string[] {
  if ((t === undefined && p === 0) || t === p) return v.map(num);
  const [a, b, c, d] = v;
  const cs = [0, 1].map((i) => trig('cos', angle(p, i, t))),
    ss = [0, 1].map((i) => trig('sin', angle(p, i, t)));
  return [
    sum([
      [a, cs[0]],
      [-c, ss[0]],
    ]),
    sum([
      [b, cs[1]],
      [-d, ss[1]],
    ]),
    sum([
      [a, ss[0]],
      [c, cs[0]],
    ]),
    sum([
      [b, ss[1]],
      [d, cs[1]],
    ]),
  ];
}
export function rotated(v: Four, p: number, t?: number) {
  return matrix(rotatedComponents(v, p, t).map((x) => [x]));
}
export function dotExpansion(p: number, t: number) {
  const components = rotatedComponents(ropeK[t], p, t);
  return (
    '<mtable columnalign="left">' +
    ropeQ[p]
      .map(
        (n, i) =>
          '<mtr><mtd>' +
          (i ? op('+') : '') +
          row(op('(') + num(n) + op(')')) +
          op('×') +
          row(op('(') + components[i] + op(')')) +
          '</mtd></mtr>',
      )
      .join('') +
    '</mtable>'
  );
}

export function score(p: number, t: number) {
  if (p === t) return num(dot4(ropeQ[p], ropeK[t]));
  const c = coefficients(ropeQ[p], ropeK[t]);
  return sum(c.map((n, i) => [n, trig(i % 2 ? 'sin' : 'cos', angle(p, Math.floor(i / 2), t))]));
}
export function scoreLines(p: number, t: number) {
  if (p === t) return score(p, t);
  const terms = coefficients(ropeQ[p], ropeK[t])
    .map((n, i) => ({ n, i }))
    .filter((x) => x.n !== 0);
  return `<mtable columnalign="left">${terms.map(({ n, i }, j) => `<mtr><mtd>${term(n, trig(i % 2 ? 'sin' : 'cos', angle(p, Math.floor(i / 2), t)), j === 0)}</mtd></mtr>`).join('')}</mtable>`;
}
export const rotationSymbol = (p: number, t?: number) =>
  `<msub><mi>R</mi>${t === undefined ? num(p) : row(num(t) + op('−') + num(p))}</msub>`;
export const primed = (s: string, p: number) =>
  `<msubsup><mi>${s}</mi>${num(p)}<mo>′</mo></msubsup>`;
export const scaled = (p: number, t: number) =>
  `<mfrac>${row(scoreLines(p, t))}<msqrt>${num(128)}</msqrt></mfrac>`;

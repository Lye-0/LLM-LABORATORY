// Only authored calculation data is serialized here; no user input or external HTML.
const escape = (value: string | number) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export const m = {
  i: (s: string) => `<mi>${escape(s)}</mi>`,
  n: (s: string | number) => `<mn>${escape(s)}</mn>`,
  t: (s: string) => `<mtext>${escape(s)}</mtext>`,
  o: (s: string) => `<mo>${escape(s)}</mo>`,
  row: (...s: string[]) => `<mrow>${s.join('')}</mrow>`,
  sub: (base: string, index: string) => `<msub>${base}${index}</msub>`,
  sup: (base: string, power: string) => `<msup>${base}${power}</msup>`,
  frac: (a: string, b: string) => `<mfrac><mrow>${a}</mrow><mrow>${b}</mrow></mfrac>`,
  sqrt: (a: string) => `<msqrt>${a}</msqrt>`,
  sum: (lower: string, upper: string) => `<munderover><mo>∑</mo>${lower}${upper}</munderover>`,
  matrix: (rows: string[][]) =>
    `<mrow><mo>[</mo><mtable>${rows.map((row) => `<mtr>${row.map((cell) => `<mtd>${cell}</mtd>`).join('')}</mtr>`).join('')}</mtable><mo>]</mo></mrow>`,
};
export const at = (name: string, index: string) => m.sub(m.i(name), m.t(index));
export const eq = (...parts: string[]) => m.row(...parts);
export const call = (name: string, value: string) => m.row(m.i(name), m.o('('), value, m.o(')'));
export const tuple = (...values: (number | string)[]) =>
  vector(...values.map((value) => m.n(value)));
export const vector = (...values: string[]) =>
  m.row(m.o('('), ...values.flatMap((value, i) => [i ? m.o(',') : '', value]), m.o(')'));

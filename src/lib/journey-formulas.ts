import { m, call } from '../data/atlas/calculation-math';
const v = m.i,
  o = m.o,
  t = m.t,
  row = m.row,
  sub = (a: string, b: string) => m.sub(v(a), t(b));
const tr = (a: string) => m.sup(a, t('T'));
const equals = (a: string, b: string) => row(a, o('='), b);
const times = (a: string, b: string) => row(a, o('⊙'), b);
const H0 = sub('H', '0'),
  H1 = sub('H', '1'),
  H2 = sub('H', '2'),
  Xm = sub('X', 'MLP'),
  Hfinal = sub('H', 'final');
export function operationFormulas(step: string, key: string): string[] {
  const norm = ['norm', 'post-norm', 'final', 'heads'].includes(step);
  if (norm) {
    const input =
      step === 'norm'
        ? H0
        : step === 'post-norm'
          ? H1
          : step === 'final'
            ? m.sup(v('H'), t('(28)'))
            : v(key === 'q-norm' ? 'Q' : 'K');
    const output =
      step === 'norm' ? v('X') : step === 'post-norm' ? Xm : step === 'final' ? Hfinal : input;
    return [
      equals(
        v('r'),
        m.sqrt(
          row(
            m.frac(
              row(
                m.sup(sub('x', '1'), m.n(2)),
                o('+'),
                o('⋯'),
                o('+'),
                m.sup(sub('x', 'd'), m.n(2)),
              ),
              v('d'),
            ),
            o('+'),
            v('ε'),
          ),
        ),
      ),
      step === 'heads'
        ? row(output, o('←'), times(m.frac(input, v('r')), v('w')))
        : equals(output, times(m.frac(input, v('r')), v('w'))),
    ];
  }
  switch (step) {
    case 'qkv':
      return [equals(v(key.toUpperCase()), row(v('X'), tr(sub('W', key))))];
    case 'rope':
      return [
        equals(v('θ'), row(v('p'), v('ω'))),
        equals(v(key.toUpperCase() + '′'), row(call('R', v('θ')), v(key.toUpperCase()))),
      ];
    case 'transpose':
      return [equals(sub('(K′)ᵀ', 'j,i'), sub('K′', 'i,j'))];
    case 'scores':
      return [equals(v('S'), m.frac(row(v('Q′'), tr(v('K′'))), m.sqrt(v('d'))))];
    case 'mask':
      return [
        equals(sub('S', 'masked,i,j'), row(o('−'), v('∞'))),
        row(t('ただし '), v('j'), o('>'), v('i')),
      ];
    case 'softmax':
      return [
        equals(sub('e', 'j'), m.sup(v('e'), row(sub('s', 'j'), o('−'), call('max', v('s'))))),
        equals(sub('p', 'j'), m.frac(sub('e', 'j'), row(m.sub(o('∑'), v('k')), sub('e', 'k')))),
      ];
    case 'weighted':
      return [
        equals(v('C'), row(v('P'), v('V'))),
        equals(sub('C', 'i,c'), row(m.sub(o('∑'), v('t')), sub('P', 'i,t'), sub('V', 't,c'))),
      ];
    case 'concat':
      return [
        equals(
          v('C'),
          row(o('['), sub('Head', '0'), o('|'), sub('Head', '1'), o('|'), o('…'), o(']')),
        ),
      ];
    case 'o-proj':
      return [equals(v('A'), row(v('C'), tr(sub('W', 'o'))))];
    case 'residual-attn':
      return [equals(H1, row(H0, o('+'), v('A')))];
    case 'post-norm':
      return [];
    case 'gate':
      return [
        equals(
          v(key === 'gate' ? 'G' : 'U'),
          row(Xm, tr(sub('W', key === 'gate' ? 'gate' : 'up'))),
        ),
      ];
    case 'silu':
      return [
        equals(sub('G', 'a'), times(v('G'), call('σ', v('G')))),
        equals(
          call('σ', v('g')),
          m.frac(m.n(1), row(m.n(1), o('+'), m.sup(v('e'), row(o('−'), v('g'))))),
        ),
      ];
    case 'multiply':
      return [equals(v('M'), times(sub('G', 'a'), v('U')))];
    case 'down':
      return [equals(v('D'), row(v('M'), tr(sub('W', 'down'))))];
    case 'residual-mlp':
      return [equals(H2, row(H1, o('+'), v('D')))];
    case 'layers':
      return [
        equals(
          m.sup(v('H'), t('(l+1)')),
          row(sub('DecoderLayer', 'l'), o('('), m.sup(v('H'), t('(l)')), o(')')),
        ),
      ];
    case 'logits':
      return [equals(v('Z'), row(Hfinal, tr(sub('W', 'LM'))))];
    case 'sampling':
      return [
        equals(v('p'), call('softmax', sub('Z', 'last'))),
        equals(sub('id', 'next'), call('argmax', sub('Z', 'last'))),
      ];
    case 'append':
      return [equals(sub('ids', 'generated'), row(sub('ids', 'input'), o('∥'), sub('id', 'next')))];
    case 'cache':
      return ['K', 'V'].map((a) =>
        row(sub(a, 'cache'), o('←'), sub(a, 'cache'), o('∥'), sub(a, 'new')),
      );
    case 'decode':
      return [equals(v('text'), call('decode', sub('ids', 'generated')))];
    case 'embedding':
      return [equals(sub('H', '0,t'), sub('E', 'input_ids[t]'))];
    case 'ids':
      return [row(t('Token'), o('→'), t('ID'))];
    case 'text':
      return [t('こんにちは、今日はいい天気ですね')];
    case 'tokenize':
      return [row(t('文章'), o('→'), t('Tokenの列'))];
  }
  return [];
}
// Fixed authored examples only. No markup or unescaped external input is accepted.
export function exampleMath(text: string): string {
  return text
    .split(/([＋+×÷=≈→−⊙]|\d+(?:\.\d+)?(?:e[−-]?\d+)?)/)
    .filter(Boolean)
    .map((s) => {
      if (/^[＋+×÷=≈→−⊙]$/.test(s)) return o(s === '＋' ? '+' : s);
      if (/^\d/.test(s)) return m.n(s);
      return t(s);
    })
    .join('');
}
export const mathDocument = (xml: string) =>
  `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${xml}</math>`;
export const fractionExample = (a: number, b: number, result: number) =>
  row(
    m.frac(m.n(Number(a.toPrecision(3))), m.n(Number(b.toPrecision(3)))),
    o('≈'),
    m.n(Number(result.toPrecision(3))),
  );
export const scaledExample = (a: number, result: number) =>
  row(
    m.frac(m.n(Number(a.toPrecision(3))), m.sqrt(m.n(3))),
    o('≈'),
    m.n(Number(result.toPrecision(3))),
  );

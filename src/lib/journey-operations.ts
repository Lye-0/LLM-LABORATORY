import type { JourneySample } from './journey-scene';
import { actorId } from './journey-actors';
import * as m from './journey-model';
import { operationFormulas, exampleMath, fractionExample, scaledExample } from './journey-formulas';
import { clamp } from './journey-timing';

export interface OperationNote {
  key: string;
  title: string;
  formula: string[];
  explanation: string;
  detail: string[];
  x: number;
  y: number;
}
export interface OperationSymbol {
  key: string;
  text: string;
  x: number;
  y: number;
}
const n = (v: number) => Number(v.toPrecision(3)).toString().replace('-', '−');
const terms = (a: m.Matrix, b: m.Matrix, row: number) =>
  a[row].map((v, k) => `${n(v)}×(${n(b[k][0])})`);
function product(a: m.Matrix, b: m.Matrix, out: m.Matrix, row: number) {
  const t = terms(a, b, row),
    lines: string[] = [];
  for (let i = 0; i < t.length; i++) lines.push(`${i ? '＋ ' : ''}${t[i]}`);
  lines.push(`≈ ${n(out[row][0])}`);
  return lines;
}
export function journeyOperations(sample: JourneySample) {
  const { step, calculation: c } = sample,
    row = Math.min(6, Math.floor(c * 7));
  const notes: OperationNote[] = [],
    symbols: OperationSymbol[] = [];
  const byId = Object.fromEntries(sample.entities.map((e) => [e.id, e]));
  byId.attn = byId[actorId(step.id, 'attn')];
  byId.gate = byId[actorId(step.id, 'gate')];
  function note(
    key: string,
    title: string,
    explanation: string,
    detail: string[],
    x: number,
    y: number,
  ) {
    notes.push({
      key,
      title,
      formula: operationFormulas(step.id, key),
      explanation,
      detail: (step.id === 'sampling' ? sample.progress > 0.86 : c > 0)
        ? detail.map(exampleMath)
        : [],
      x,
      y,
    });
  }
  function symbol(key: string, text: string, x: number, y: number) {
    symbols.push({ key, text, x, y });
  }
  function rms(key: string, input: m.Matrix, output: m.Matrix, x: number, y: number, head = false) {
    const scale = Math.sqrt(
      input[row].reduce((sum, v) => sum + v * v, 0) / input[row].length + 1e-6,
    );
    note(
      key,
      'RMSNorm',
      head
        ? `位置${row}：Head内の成分を二乗 → 平均 → 平方根`
        : `位置${row}：成分を二乗 → 平均 → 平方根で尺度rを求める`,
      [
        `r ≈ ${n(scale)}  （この例の係数w = 1）`,
        `${n(input[row][0])} ÷ ${n(scale)} × 1 ≈ ${n(output[row][0])}`,
      ],
      x,
      y,
    );
    if (c > 0) notes.at(-1)!.detail[1] = fractionExample(input[row][0], scale, output[row][0]);
  }
  const f = m.firstLayer;
  switch (step.id) {
    case 'norm':
      rms('norm', m.embedding, f.x, 650, 180);
      break;
    case 'post-norm':
      rms('post-norm', f.h1, f.post, 650, 190);
      break;
    case 'final':
      rms('final-norm', m.layerStates[28], m.finalHidden, 650, 215);
      break;
    case 'qkv':
      (['q', 'k', 'v'] as const).forEach((id, i) => {
        const w = { q: f.wq, k: f.wk, v: f.wv }[id],
          out = { q: f.q, k: f.k, v: f.v }[id],
          name = id.toUpperCase();
        note(
          id,
          `Linear · ${name}を作る`,
          `位置${row}の行 × 全列を同時に計算（数値例は成分0）`,
          product(f.x, w, out, row),
          750,
          145 + i * 320,
        );
        const weight = byId[`weight-${id}`],
          result = byId[id];
        symbol(`times-${id}`, '×', weight.x - 36, result.y + result.h * 3.5);
        symbol(
          `equals-${id}`,
          '＝',
          (weight.x + weight.w * 3 + result.x) / 2,
          result.y + result.h * 3.5,
        );
      });
      break;
    case 'heads':
      rms('q-norm', f.q, f.qn, 750, 145, true);
      rms('k-norm', f.k, f.kn, 750, 465, true);
      break;
    case 'rope':
      (['q', 'k'] as const).forEach((id, i) => {
        const input = id === 'q' ? f.qn : f.kn,
          output = id === 'q' ? f.qr : f.kr;
        note(
          id,
          'RoPE',
          `位置${row}の成分0・1を回転する`,
          [
            `[x′,y′] = [x cosθ − y sinθ,`,
            `              x sinθ + y cosθ]`,
            `θ = ${row}×0.4 = ${n(row * 0.4)}`,
            `[${n(input[row][0])}, ${n(input[row][1])}] → [${n(output[row][0])}, ${n(output[row][1])}]`,
          ],
          750,
          145 + i * 320,
        );
      });
      break;
    case 'transpose': {
      const index = Math.min(20, Math.floor(clamp((sample.progress - 0.6) / 0.32) * 21)),
        i = Math.floor(index / 3),
        j = index % 3;
      note(
        'transpose',
        'Transpose',
        '同じ数値を、行i・列jから行j・列iへ',
        [`K′[${i},${j}] → (K′)ᵀ[${j},${i}]`, `値はどちらも ${n(f.kr[i][j])}`],
        400,
        420,
      );
      break;
    }
    case 'scores':
      note(
        'scores',
        'Scaled dot-product',
        `位置${row}のQ × 位置0のK（説明用d=3）`,
        product(
          [f.qr[row]],
          m.transpose(f.kr),
          [f.scores[row].map((v) => v * Math.sqrt(3))],
          0,
        ).concat([`内積 ÷ √3 ≈ ${n(f.scores[row][0])}`]),
        400,
        420,
      );
      if (c > 0)
        notes.at(-1)!.detail[notes.at(-1)!.detail.length - 1] = scaledExample(
          f.scores[row][0] * Math.sqrt(3),
          f.scores[row][0],
        );
      symbol('score-times', '×', 370, 280);
      symbol('score-scale', '×', 638, 280);
      symbol('score-equals', '＝', 700, 280);
      break;
    case 'mask':
      note(
        'mask',
        'Causal mask',
        '未来の位置は、参照候補から外す',
        [row < 6 ? `位置${row}：位置${row + 1}〜6を−∞へ` : '位置6：この入力内に未来位置はない'],
        710,
        205,
      );
      break;
    case 'softmax':
      note(
        'softmax',
        'Softmax',
        '指数関数で正の値にし、合計で割って割合にする',
        [`位置${row}：P[${row},0] ≈ ${n(f.probabilities[row][0])}`, '−∞だった位置の割合は0になる'],
        710,
        205,
      );
      break;
    case 'weighted':
      note(
        'weighted',
        'Weighted sum',
        `位置${row}：参照できる位置のVを全成分使う（数値例は成分0）`,
        [
          `C[${row},0] = Σₜ P[${row},t] V[t,0]`,
          `有効な${row + 1}位置を足すと ≈ ${n(f.context[row][0])}`,
        ],
        400,
        430,
      );
      symbol('weighted-times', '×', 469.5, 283.5);
      symbol('weighted-equals', '＝', 681, 283.5);
      break;
    case 'concat':
      note(
        'concat',
        'Head concatenation',
        'Headを並べて、ひとつの表現にする',
        ['説明用は1 Headなので、値は変わらない', '実モデル：16×128 → 2048成分'],
        650,
        225,
      );
      break;
    case 'o-proj':
      note(
        'o-proj',
        'Output projection',
        `位置${row}の行 × 出力射影の重み`,
        product(f.context, f.wo, f.attention, row),
        240,
        440,
      );
      symbol('o-times', '×', 441, 272);
      symbol('o-equals', '＝', 701, 272);
      break;
    case 'residual-attn':
    case 'residual-mlp': {
      const first = step.id === 'residual-attn',
        input = first ? m.embedding : f.h1,
        delta = first ? f.attention : f.down,
        out = first ? f.h1 : f.output;
      note(
        'residual',
        first ? 'Residual ①' : 'Residual ②',
        `位置${row}：同じ位置・同じ成分を足す`,
        [`${n(input[row][0])} ＋ (${n(delta[row][0])}) ≈ ${n(out[row][0])}`],
        240,
        490,
      );
      symbol('residual-plus', '＋', 385, 285);
      symbol('residual-equals', '＝', 670, 285);
      break;
    }
    case 'gate':
      (['gate', 'up'] as const).forEach((id, i) => {
        const g = id === 'gate',
          name = g ? 'G' : 'U';
        note(
          id,
          `Linear · ${name}を作る`,
          `同じ入力の位置${row}を別の重みへ`,
          product(f.post, g ? f.wg : f.wu, g ? f.gate : f.up, row),
          400,
          i === 0 ? 420 : 1000,
        );
        const e = byId[id],
          weight = byId[`weight-${id}`],
          cy = e.y + e.h * 3.5;
        symbol(`${id}-times`, '×', 360, cy);
        symbol(`${id}-equals`, '＝', (weight.x + weight.w * 6 + e.x) / 2, cy);
      });
      break;
    case 'silu': {
      const x = f.gate[row][0],
        sigmoid = 1 / (1 + Math.exp(-x));
      note(
        'silu',
        'SiLU',
        '各成分gに、なめらかな係数σ(g)を掛ける',
        [
          `位置${row}・成分0：g = ${n(x)}`,
          `sigmoid(g) ≈ ${n(sigmoid)}`,
          `${n(x)} × ${n(sigmoid)} ≈ ${n(f.activated[row][0])}`,
        ],
        680,
        285,
      );
      break;
    }
    case 'multiply':
      note(
        'multiply',
        'Element-wise product',
        `位置${row}：GₐとUの対応成分から、結果Mを求める`,
        [`${n(f.activated[row][0])} × ${n(f.up[row][0])} ≈ ${n(f.mixed[row][0])}`],
        240,
        490,
      );
      symbol('element-times', '⊙', 410, 285);
      symbol('element-equals', '＝', 700, 285);
      break;
    case 'down':
      note(
        'down',
        'Down projection',
        `位置${row}の行 × 幅を戻す重み`,
        product(f.mixed, f.wd, f.down, row),
        240,
        450,
      );
      symbol('down-times', '×', 500, 285);
      symbol('down-equals', '＝', 724, 285);
      break;
    case 'layers':
      note(
        'layers',
        'Decoder Layer',
        '前の層の出力を、次の層の入力にする',
        ['Attention → Residual ①', 'MLP → Residual ②'],
        700,
        240,
      );
      break;
    case 'logits':
      note(
        'logits',
        'LM head',
        `位置${row}の表現から候補スコアを作る`,
        product(m.finalHidden, m.lmWeight, m.logits, row),
        240,
        460,
      );
      symbol('lm-times', '×', 441, 292);
      symbol('lm-equals', '＝', 701, 292);
      break;
    case 'sampling':
      note(
        'sampling',
        'Greedy / Softmax',
        'この例では最大スコアのIDを選ぶ',
        [`next_id = ${m.candidates[m.chosen].id}`, 'Samplingはpから抽選する別の経路'],
        650,
        205,
      );
      break;
    case 'append':
      note('append', 'Concatenation', '選んだIDを、保持していたID列の末尾へ', [], 240, 430);
      break;
    case 'cache':
      note(
        'cache',
        'KV Cache',
        '①過去のK/Vを再表示 → ②新しいIDだけForward → ③新しい1位置を追加',
        [],
        650,
        300,
      );
      break;
    case 'decode':
      note('decode', 'Tokenizer decode', '保持したID列を、読める文字列へ戻す', [], 290, 365);
      break;
    case 'embedding':
      note('embedding', 'Embedding lookup', 'IDを語彙表の行番号として使う', [], 450, 390);
      break;
    case 'ids':
      note('ids', 'Vocabulary lookup', '同じTokenに、語彙表のIDを対応付ける', [], 355, 370);
      break;
  }
  return { notes, symbols, row };
}

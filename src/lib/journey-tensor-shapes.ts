import type { JourneySample } from './journey-scene';
import type { JourneyView } from './journey-slices';

export const SHAPE_HEADER_HEIGHT = 148;
export type TensorShapeRow = {
  name: string;
  axes: string[];
  values: number[];
  drawn: number[];
  tone: 'q' | 'k' | 'output';
};

// Full tensors, independent of the two-dimensional slice drawn on the stage.
export function tensorShapeRows(sample: JourneySample, view: JourneyView): TensorShapeRow[] {
  const { id } = sample.step,
    p = sample.progress;
  const real = view === 'shapes';
  const d = real ? 1024 : 3,
    h = real ? 16 : 2,
    kv = real ? 8 : 1;
  const hd = real ? 128 : 3,
    f = h * hd,
    m = real ? 3072 : 6,
    v = real ? 151936 : 3;
  const row = (
    name: string,
    axes: string[],
    values: number[],
    tone: TensorShapeRow['tone'] = 'output',
    drawn = [values.length - 2, values.length - 1],
  ): TensorShapeRow => ({ name, axes, values, tone, drawn });
  const hidden = (name: string, width = d, tone: TensorShapeRow['tone'] = 'output') =>
    row(name, ['Batch', 'Token位置', '表現成分'], [1, 7, width], tone);
  const head = (name: string, n = h, tone: TensorShapeRow['tone'] = 'q', transposed = false) =>
    row(
      name,
      ['Batch', 'Head', ...(transposed ? ['Head内成分', 'Key位置'] : ['Token位置', 'Head内成分'])],
      [1, n, ...(transposed ? [hd, 7] : [7, hd])],
      tone,
    );
  const score = (name: string) =>
    row(name, ['Batch', 'Head', 'Query位置', 'Key位置'], [1, h, 7, 7]);
  const weight = (name: string, input: number, output: number) =>
    row(name, ['入力成分', '出力成分'], [input, output], 'k');
  if (id === 'text' || id === 'tokenize') return [];
  if (id === 'ids') return [row('input_ids', ['Batch', 'Token位置'], [1, 7], 'q', [1])];
  if (id === 'embedding') return [hidden('H₀', 1024, 'q')];
  if (id === 'qkv')
    return [
      hidden('X', d, 'q'),
      hidden('Q', f, 'q'),
      hidden('K', kv * hd, 'k'),
      hidden('V', kv * hd),
    ];
  if (id === 'heads')
    return (['Q', 'K', 'V'] as const).map((name) => {
      const n = name === 'Q' ? h : kv,
        tone = name === 'Q' ? 'q' : name === 'K' ? 'k' : 'output';
      if (p < 0.12) return hidden(name, n * hd, tone);
      if (p < (real ? 0.7 : 0.6))
        return row(name, ['Batch', 'Token位置', 'Head', 'Head内成分'], [1, 7, n, hd], tone, [1, 3]);
      return head(name, n, tone);
    });
  if (id === 'rope') return [head('Q′'), head('K′', kv, 'k'), head('V', kv, 'output')];
  if (id === 'transpose')
    return [
      head('Q′'),
      head('K′（保存元）', kv, 'k'),
      head(p < 0.72 ? 'K_for_Q' : 'K_for_Qᵀ', h, 'k', p >= 0.72),
    ].map((r, i) => (i === 1 ? { ...r, drawn: [] } : r));
  if (id === 'scores') return [head('Q′'), head('K_for_Qᵀ', h, 'k', true), score('S')];
  if (id === 'mask' || id === 'softmax') return [score(id === 'mask' ? 'S_masked' : 'P')];
  if (id === 'weighted') return [score('P'), head('V_for_Q', h, 'output'), head('C', h, 'output')];
  if (id === 'concat') {
    const mergeStart = real ? 0.6 : 0.35,
      mergeEnd = real ? 0.9 : 0.6;
    return p < mergeStart
      ? [head('C', h, 'output')]
      : p < mergeEnd
        ? [row('C', ['Batch', 'Token位置', 'Head', 'Head内成分'], [1, 7, h, hd], 'output', [1, 3])]
        : [hidden('C', f)];
  }
  if (id === 'o-proj') return [hidden('C', f), weight('Wₒᵀ', f, d), hidden('A')];
  if (id === 'gate') return [hidden('X'), hidden('G', m, 'q'), hidden('U', m, 'k')];
  if (id === 'silu') return [hidden('Gₐ', m, 'q'), hidden('U', m, 'k')];
  if (id === 'multiply') return [hidden('Gₐ', m, 'q'), hidden('U', m, 'k'), hidden('M', m)];
  if (id === 'down') return [hidden('M', m), weight('W_downᵀ', m, d), hidden('D')];
  if (id === 'logits')
    return [
      hidden('H_final'),
      weight('W_LMᵀ', d, v),
      row('Z', ['Batch', 'Token位置', '語彙候補'], [1, 7, v]),
    ];
  if (id === 'sampling')
    return [
      row('Z', ['Batch', 'Token位置', '語彙候補'], [1, 7, v]),
      row('probs', ['Batch', '語彙候補'], [1, v], 'output', [1]),
      row('next_id', ['Batch', '選択数'], [1, 1], 'q', [1]),
    ];
  if (id === 'append' || id === 'decode')
    return [row('generated_ids', ['Batch', 'Token位置'], [1, 8], 'q', [1])];
  if (id === 'cache')
    return ['K', 'V'].map((name) =>
      row(
        `${name}_cache（各Layer）`,
        ['Batch', 'KV Head', '保存位置', 'Head内成分'],
        [1, kv, p < 0.91 ? 7 : 8, hd],
        name === 'K' ? 'k' : 'output',
      ),
    );
  const name =
    id === 'residual-attn'
      ? 'H₁'
      : id === 'residual-mlp'
        ? 'H₂'
        : id === 'final'
          ? 'H_final'
          : id === 'layers'
            ? `H（Layer ${sample.layer}）`
            : 'H';
  return [hidden(name, d, id === 'norm' ? 'q' : 'output')];
}

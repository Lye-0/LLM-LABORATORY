import { actorId, projectionActors, binaryActors } from './journey-actors';
export const clamp = (p: number) => Math.max(0, Math.min(1, p));
export const ease = (p: number) => {
  const t = clamp(p);
  return t * t * (3 - 2 * t);
};
// Begin updating only in the final instant of movement (more than 99% of the path).
export const CALCULATION_START = 0.58;
export const movementProgress = (p: number) => ease(p / 0.6);
export const calculationProgress = (p: number) => clamp((p - CALCULATION_START) / 0.28);
const groups: Record<string, string[]> = {
  text: ['token-'],
  tokenize: ['token-'],
  ids: ['token-', 'id-'],
  embedding: ['token-', 'id-', 'hidden'],
  norm: ['hidden'],
  qkv: ['hidden', 'weight-', 'q', 'k', 'v'],
  heads: ['q', 'k'],
  rope: ['q', 'k'],
  transpose: ['k'],
  scores: ['q', 'k', 'score'],
  mask: ['score'],
  softmax: ['score'],
  weighted: ['score', 'v', 'attn'],
  concat: ['attn'],
  'o-proj': ['attn', 'weight'],
  'residual-attn': ['attn', 'skip'],
  'post-norm': ['attn'],
  gate: ['attn', 'gate', 'up', 'weight-gate', 'weight-up'],
  silu: ['gate'],
  multiply: ['gate', 'up'],
  down: ['gate', 'weight'],
  'residual-mlp': ['gate', 'skip2'],
  layers: ['gate'],
  final: ['gate'],
  logits: ['gate', 'weight'],
  sampling: ['gate', 'prob', 'chosen'],
  append: ['id-', 'chosen'],
  cache: ['k', 'v', 'cache-', 'chosen'],
  decode: ['result'],
};
export function activeEntities(step: string, id: string) {
  const binary = binaryActors(step);
  if (binary && Object.values(binary).includes(id)) return true;
  const projection = projectionActors(step);
  if (projection && [projection.input, projection.output].includes(id)) return true;
  if (id === actorId(step, 'attn')) id = 'attn';
  if (id === actorId(step, 'gate')) id = 'gate';
  return (groups[step] ?? []).some((key) => (key.endsWith('-') ? id.startsWith(key) : id === key));
}

export function journeyPhaseLabel(id: string, p: number, c: number) {
  if (id === 'text') return '文章を入力';
  if (id === 'tokenize')
    return p < 0.24
      ? '分割する境界を示す'
      : p < 0.72
        ? '同じ文字をTokenに分ける'
        : '分割結果を確認';
  if (id === 'concat') return '1 Headなので値はそのまま · 配置を確認';
  if (id === 'sampling')
    return p < 0.43
      ? '末尾の行を選択'
      : p < 0.6
        ? '末尾のLogitsを取り出す'
        : p < 0.76
          ? 'Softmaxで確率へ'
          : p < 0.82
            ? '候補の確率を確認'
            : p < 0.94
              ? 'Greedyで次のIDを選ぶ'
              : '選んだIDを確認';
  if (id === 'append')
    return p < 0.35
      ? '保持したID列を再表示'
      : p < 0.82
        ? '選んだIDを末尾へ移動'
        : '7個＋1個＝8個のID列';
  if (id === 'cache')
    return p < 0.42
      ? '保持済みK/Vを再表示'
      : p < 0.65
        ? '新しいIDを次のForwardへ'
        : p < 0.9
          ? '新しい1位置だけ追加'
          : '過去と新しい位置を保持';
  if (id === 'decode')
    return p < 0.58 ? 'ID列を準備' : p < 0.86 ? 'IDを文字列へ戻す' : '生成文を確認';
  return c <= 0 ? '移動・準備' : c < 1 ? '計算・変換' : '結果を確認';
}

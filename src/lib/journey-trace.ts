import { actorId, projectionActors, binaryActors } from './journey-actors';
export const arithmeticSteps = new Set([
  'norm',
  'qkv',
  'heads',
  'rope',
  'scores',
  'mask',
  'softmax',
  'weighted',
  'o-proj',
  'residual-attn',
  'post-norm',
  'gate',
  'silu',
  'multiply',
  'down',
  'layers',
  'final',
  'logits',
  'embedding',
]);
export function traceRow(c: number, rows = 7) {
  return Math.min(rows - 1, Math.floor(c * rows));
}
// A row is a batch: all its output columns are computed together.
export function calculationFocus(step: string, id: string, c: number, i: number, j: number) {
  if (c <= 0 || c >= 1 || !arithmeticSteps.has(step)) return false;
  const r = traceRow(c),
    projection = projectionActors(step);
  const binary = binaryActors(step);
  if (binary) return Object.values(binary).includes(id) && i === r;
  if (projection) {
    if (id === projection.input || id === projection.output) return i === r;
    if (id === 'weight') return true;
    return false;
  }
  if (step === 'qkv')
    return id === 'hidden' || ['q', 'k', 'v'].includes(id) ? i === r : id.startsWith('weight-');
  if (step === 'gate')
    return [actorId(step, 'attn'), 'gate', 'up'].includes(id)
      ? i === r
      : id === 'weight-gate' || id === 'weight-up';
  if (step === 'scores')
    return id === 'q' ? i === r : id === 'k' ? true : id === 'score' ? i === r : false;
  if (step === 'weighted')
    return id === 'score'
      ? i === r && j <= r
      : id === 'attn'
        ? i === r
        : id === 'v'
          ? i <= r
          : false;
  if (step === 'heads') return ['q', 'k'].includes(id) && i === r;
  if (step === 'rope') return ['q', 'k'].includes(id) && i === r && j < 2;
  if (step === 'residual-attn') return [actorId(step, 'attn'), 'skip'].includes(id) && i === r;
  if (step === 'residual-mlp') return [actorId(step, 'gate'), 'skip2'].includes(id) && i === r;
  if (step === 'multiply') return ['gate', 'up'].includes(id) && i === r;
  if (step === 'embedding') return id === 'hidden' && i === r;
  const target =
    step === 'norm'
      ? 'hidden'
      : step === 'mask' || step === 'softmax'
        ? 'score'
        : step === 'post-norm'
          ? actorId(step, 'attn')
          : actorId(step, 'gate');
  return id === target && i === r;
}
export const completedRow = (c: number, row: number, rows: number) =>
  c >= 1 || c >= (row + 1) / rows;

export const rotationDegrees = (input: number[], position: number, fraction: number) =>
  ((Math.atan2(input[1], input[0]) + position * 0.4 * fraction) * 180) / Math.PI;

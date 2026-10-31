import { journeySteps } from '../data/journey';
const ranks = Object.fromEntries(journeySteps.map((s, i) => [s.id, i]));
export function actorId(step: string, logical: string): string {
  const rank = ranks[step];
  if (logical === 'attn' && rank >= ranks['residual-attn']) return 'residual-attn-state';
  if (logical === 'attn' && rank >= ranks['o-proj']) return 'attention-state';
  if (logical === 'gate')
    return rank >= ranks.logits
      ? 'logits-state'
      : rank >= ranks['residual-mlp']
        ? 'layer-state'
        : rank >= ranks.down
          ? 'mlp-state'
          : rank >= ranks.multiply
            ? 'mixed-state'
            : 'gate';
  return logical;
}
export function projectionActors(step: string) {
  return step === 'o-proj'
    ? { input: 'attn', output: 'attention-state' }
    : step === 'down'
      ? { input: 'mixed-state', output: 'mlp-state' }
      : step === 'logits'
        ? { input: 'layer-state', output: 'logits-state' }
        : null;
}
export function binaryActors(step: string) {
  return step === 'multiply'
    ? { input: 'gate', second: 'up', output: 'mixed-state' }
    : step === 'residual-attn'
      ? { input: 'attention-state', second: 'skip', output: 'residual-attn-state' }
      : step === 'residual-mlp'
        ? { input: 'mlp-state', second: 'skip2', output: 'layer-state' }
        : null;
}

import type { JourneySample } from './journey-scene';
import { ease, layerPosition } from './journey-timing';

export type JourneyView = 'numbers' | 'shapes';
// These times also drive the labels: changing the view never starts another clock.
export function headSliceMotion(sample: JourneySample, view: JourneyView) {
  const numeric = view === 'numbers',
    p = sample.progress;
  return {
    appear: ease((p - (numeric ? 0.08 : 0.58)) / 0.12),
    travel: ease((p - (numeric ? 0.42 : 0.66)) / (numeric ? 0.5 : 0.3)),
    merge: numeric ? ease(p / 0.6) : ease(sample.calculation),
  };
}
export function layerSliceMotion(sample: JourneySample) {
  const position = layerPosition(sample.progress);
  const transfer = sample.layer > 0 ? ease((position % 1) / 0.18) : 1;
  return {
    previous: Math.max(0, sample.layer - 1),
    current: sample.layer,
    transfer: sample.calculation >= 1 ? 1 : transfer,
  };
}
export function tokenSliceMotion(p: number) {
  return {
    focus: ease((p - 0.35) / 0.08),
    extract: ease((p - 0.43) / 0.15),
    label: ease((p - 0.43) / 0.15),
  };
}
export function cacheSliceMotion(p: number) {
  return { join: ease((p - 0.65) / 0.23), settle: ease((p - 0.88) / 0.06) };
}

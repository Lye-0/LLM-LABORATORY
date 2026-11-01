import type { JourneySample } from './journey-scene';
import { ease, layerPosition } from './journey-timing';

export type JourneyView = 'numbers' | 'shapes';
// These times also drive the labels: changing the view never starts another clock.
export function headSliceMotion(sample: JourneySample, view: JourneyView) {
  const numeric = view === 'numbers',
    p = sample.progress;
  const focus = ease((p - (numeric ? 0.28 : 0.58)) / (numeric ? 0.32 : 0.28));
  const restore = ease((p - (numeric ? 0.32 : 0.52)) / (numeric ? 0.28 : 0.34));
  return {
    appear: focus,
    travel: 1,
    local: ease(p / 0.12) * (1 - ease((p - 0.6) / 0.22)),
    other: 1 - focus,
    returnToMatrix: ease(p / (numeric ? 0.32 : 0.52)),
    restore,
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

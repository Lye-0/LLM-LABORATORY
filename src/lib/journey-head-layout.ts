import type { ShapePose } from './journey-shapes';
import { ease } from './journey-timing';

export const headCount = (id: string) => (id === 'q' ? 16 : 8);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const between = (a: ShapePose, b: ShapePose, t: number): ShapePose => ({
  cx: mix(a.cx, b.cx, t),
  cy: mix(a.cy, b.cy, t),
  width: mix(a.width, b.width, t),
  height: mix(a.height, b.height, t),
});
// Each plate is one complete 7×128 Head, never a cell of a toy matrix.
export function splitHeadPose(
  p: number,
  id: string,
  i: number,
  source: ShapePose,
  target: ShapePose,
): ShapePose {
  const n = headCount(id),
    cut = ease(p / 0.12),
    spread = ease((p - 0.12) / 0.28);
  const strip = {
    cx: source.cx - source.width / 2 + (source.width * (i + 0.5)) / n,
    cy: source.cy,
    width: source.width / n,
    height: source.height,
  };
  const grid = {
    cx: 256 + (i % 8) * 82,
    cy: (id === 'q' ? 205.5 : id === 'k' ? 485.5 : 675.5) + Math.floor(i / 8) * 105,
    width: 72,
    height: 51,
  };
  const start = i === 0 ? between(source, strip, cut) : strip;
  const separated = between(start, grid, spread);
  return i === 0 ? between(separated, target, ease((p - 0.7) / 0.16)) : separated;
}
export function splitHeadOpacity(p: number) {
  return ease(p / 0.12) * (1 - ease((p - 0.42) / 0.28));
}
export function mergeHeadPose(p: number, i: number): ShapePose {
  const grid = {
    cx: 688 + ((i - 1) % 3) * 100,
    cy: 230 + Math.floor((i - 1) / 3) * 90,
    width: 76,
    height: 54,
  };
  const strip = {
    cx: 500 - 105 + ((i + 0.5) * 210) / 16,
    cy: 285,
    width: 210 / 16,
    height: (210 * 136) / 192,
  };
  return between(grid, strip, ease((p - 0.6) / 0.3));
}

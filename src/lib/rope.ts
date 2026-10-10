export type Four = readonly [number, number, number, number];
/** Teaching values after Q/K normalization, immediately before RoPE; not model measurements. */
export const ropeQ: readonly Four[] = [
  [2, 4, 3, -2],
  [3, 2, -2, 5],
  [-2, 5, 4, 3],
  [4, -3, 3, 2],
  [5, 2, -3, -4],
  [2, -4, 5, 3],
  [-3, 3, 2, 5],
];
export const ropeK: readonly Four[] = [
  [3, 3, 4, 5],
  [5, 3, -2, 4],
  [-4, 5, 3, -2],
  [2, -3, -5, 4],
  [-2, 4, -3, 5],
  [3, 2, -4, -5],
  [5, -4, 2, -3],
];
export function coefficients(q: Four, k: Four): Four {
  const [a, b, c, d] = q,
    [e, f, g, h] = k;
  return [a * e + c * g, c * e - a * g, b * f + d * h, d * f - b * h];
}
export function allowed(p: number, t: number) {
  return t <= p;
}
export function dot4(q: Four, k: Four) {
  return q.reduce((s, x, i) => s + x * k[i], 0);
}
/** Numerical reference for verification only; the teaching UI keeps omega symbolic. */
export function rotate4(v: Four, pos: number, omega: readonly [number, number]): Four {
  const [a, b, c, d] = v,
    [x, y] = omega.map((w) => w * pos);
  return [
    a * Math.cos(x) - c * Math.sin(x),
    b * Math.cos(y) - d * Math.sin(y),
    a * Math.sin(x) + c * Math.cos(x),
    b * Math.sin(y) + d * Math.cos(y),
  ];
}

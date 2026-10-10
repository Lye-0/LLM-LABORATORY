import { describe, it, expect } from 'vitest';
import { ropeQ, ropeK, coefficients, allowed, dot4, rotate4, type Four } from '../../src/lib/rope';
import { score } from '../../src/lib/rope-math';
describe('RoPE teaching example', () => {
  it('matches supplied examples and every diagonal', () => {
    expect(coefficients(ropeQ[3], ropeK[1])).toEqual([14, 23, -1, 18]);
    expect(dot4(ropeQ[0], ropeK[0])).toBe(20);
    for (let p = 0; p < 7; p++) {
      const displayed = Number(
        score(p, p)
          .replace(/<[^>]*>/g, '')
          .replace('−', '-'),
      );
      expect(displayed).toBe(dot4(ropeQ[p], ropeK[p]));
    }
  });
  it('agrees with independent 128-dimensional rotation and preserves relative position', () => {
    function full(v: Four, pos: number, w: number[]) {
      const x = Array(128).fill(0);
      [0, 1, 64, 65].forEach((d, i) => (x[d] = v[i]));
      const y = Array(128).fill(0);
      for (let i = 0; i < 64; i++) {
        const a = pos * (w[i] ?? 0.1);
        y[i] = x[i] * Math.cos(a) - x[i + 64] * Math.sin(a);
        y[i + 64] = x[i] * Math.sin(a) + x[i + 64] * Math.cos(a);
      }
      return y;
    }
    for (const w of [
      [1, 0.7],
      [0.23, 1.9],
    ])
      for (let p = 0; p < 7; p++)
        for (let t = 0; t < 7; t++) {
          const q = full(ropeQ[p], p, w),
            k = full(ropeK[t], t, w),
            delta = t - p;
          const [a, b, c, d] = coefficients(ropeQ[p], ropeK[t]);
          const expected =
            a * Math.cos(delta * w[0]) +
            b * Math.sin(delta * w[0]) +
            c * Math.cos(delta * w[1]) +
            d * Math.sin(delta * w[1]);
          expect(q.reduce((s, v, i) => s + v * k[i], 0)).toBeCloseTo(expected, 10);
          expect(
            dot4(
              rotate4(ropeQ[p], p + 5, w as [number, number]),
              rotate4(ropeK[t], t + 5, w as [number, number]),
            ),
          ).toBeCloseTo(expected, 10);
          expect(dot4(ropeQ[p], rotate4(ropeK[t], delta, w as [number, number]))).toBeCloseTo(
            expected,
            10,
          );
        }
  });
  it('masks future positions only', () => {
    let count = 0;
    for (let p = 0; p < 7; p++)
      for (let t = 0; t < 7; t++) {
        expect(allowed(p, t)).toBe(t <= p);
        if (allowed(p, t)) count++;
      }
    expect(count).toBe(28);
  });
});

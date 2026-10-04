import { describe, expect, it } from 'vitest';
import {
  attention,
  dot,
  filteredDistribution,
  gradientStep,
  lookup,
  product,
  quantize,
  sample,
  softmax,
  unsqueeze,
} from '../../src/lib/simulations';
describe('shapeの契約', () => {
  it('スカラーには1要素、0長軸には0要素', () => {
    expect(product([])).toBe(1);
    expect(product([2, 0, 3])).toBe(0);
  });
  it('正負の軸指定で同じ形を作り、元の形を変更しない', () => {
    const original = [7];
    expect(unsqueeze(original, 0)).toEqual([1, 7]);
    expect(unsqueeze(original, -2)).toEqual([1, 7]);
    expect(unsqueeze(original, -1)).toEqual([7, 1]);
    expect(original).toEqual([7]);
    expect(() => unsqueeze(original, 2)).toThrow();
    expect(() => unsqueeze(original, -3)).toThrow();
  });
  it('EmbeddingはIDの重複と順番を保つ', () => {
    const weights = [
      [1, 2],
      [3, 4],
    ];
    expect(lookup([1, 0, 1], weights)).toEqual([
      [3, 4],
      [1, 2],
      [3, 4],
    ]);
    expect(() => lookup([2], weights)).toThrow();
    expect(() => lookup([0.5], weights)).toThrow();
  });
});
describe('数式の独立した小例', () => {
  it('内積の手計算', () => {
    expect(dot([1, 2], [0.5, -1])).toBe(-1.5);
    expect(() => dot([1], [1, 2])).toThrow();
  });
  it('softmaxは大きなlogitsでも安定し、平行移動で変わらない', () => {
    expect(softmax([1000, 1000])).toEqual([0.5, 0.5]);
    const p = softmax([2, 1, 0]);
    expect(p[0]).toBeCloseTo(0.6652409558, 8);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(softmax([102, 101, 100])).toEqual(p);
    expect(() => softmax([1, 2], 0)).toThrow();
    expect(() => softmax([-Infinity, -Infinity])).toThrow();
  });
  it('top-kとtop-pは必ず候補を残し、正規化する', () => {
    expect(filteredDistribution([3, 2, 1], 1, 1, 0.1)).toEqual([1, 0, 0]);
    const p = filteredDistribution([Math.log(0.5), Math.log(0.3), Math.log(0.2)], 1, 0, 0.7);
    expect(p).toEqual([0.625, 0.37499999999999994, 0]);
    expect(filteredDistribution([1, 1], 1, 0, 1)).toEqual([0.5, 0.5]);
  });
  it('確率0の候補を選ばない', () => {
    for (let seed = 0; seed < 100; seed++) expect(sample([0, 1, 0], seed)).toBe(1);
    expect(sample([0.5, 0.5], 42)).toBe(sample([0.5, 0.5], 42));
  });
  it('causal maskと加重和の手計算', () => {
    const result = attention(
      [
        [1, 0],
        [1, 1],
      ],
      [
        [1, 0],
        [0, 1],
      ],
      [
        [2, 0],
        [0, 4],
      ],
      true,
    );
    expect(result.probabilities).toEqual([
      [1, 0],
      [0.5, 0.5],
    ]);
    expect(result.output).toEqual([
      [2, 0],
      [1, 2],
    ]);
  });
  it('解析勾配と更新', () => {
    const result = gradientStep(0.5, 2, 3, 0.1);
    expect(result).toEqual({ prediction: 1, loss: 4, gradient: -8, next: 1.3 });
    const e = 1e-5;
    const numerical = (((0.5 + e) * 2 - 3) ** 2 - ((0.5 - e) * 2 - 3) ** 2) / (2 * e);
    expect(result.gradient).toBeCloseTo(numerical, 6);
  });
  it('量子化の飽和・ゼロ・誤差', () => {
    const zero = quantize([0, 0], 4);
    expect(zero.restored).toEqual([0, 0]);
    expect(zero.mse).toBe(0);
    const q = quantize([-1, -0.2, 0.3, 1], 4);
    expect(q.integers).toEqual([-7, -1, 2, 7]);
    expect(q.restored[2]).toBeCloseTo(2 / 7, 10);
    expect(quantize([4], 4, 1).restored).toEqual([1]);
    expect(() => quantize([1], 1)).toThrow();
  });
});

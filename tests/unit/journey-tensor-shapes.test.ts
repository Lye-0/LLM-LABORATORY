import { describe, it, expect } from 'vitest';
import { journeySteps, journeyStarts } from '../../src/data/journey';
import { sampleJourney } from '../../src/lib/journey-scene';
import { tensorShapeRows } from '../../src/lib/journey-tensor-shapes';
import type { JourneyView } from '../../src/lib/journey-slices';

const at = (id: string, p = 0.99, view: JourneyView = 'shapes') => {
  const i = journeySteps.findIndex((s) => s.id === id);
  return tensorShapeRows(sampleJourney(journeyStarts[i] + journeySteps[i].duration * p), view);
};
describe('全体shapeと表示スライスの区別', () => {
  it('reshape→transposeの軸順と、結合の逆順を示す', () => {
    expect(at('heads', 0.05)[0].values).toEqual([1, 7, 2048]);
    expect(at('heads', 0.4)[0]).toMatchObject({ values: [1, 7, 16, 128], drawn: [1, 3] });
    expect(at('heads')[0]).toMatchObject({ values: [1, 16, 7, 128], drawn: [2, 3] });
    expect(at('concat', 0.4)[0].values).toEqual([1, 16, 7, 128]);
    expect(at('concat', 0.75)[0].values).toEqual([1, 7, 16, 128]);
    expect(at('concat')[0].values).toEqual([1, 7, 2048]);
  });
  it('保存元のKV Headと、Q向けに対応させたHeadを混同しない', () => {
    const rows = at('transpose');
    expect(rows[1]).toMatchObject({ values: [1, 8, 7, 128], drawn: [] });
    expect(rows[2]).toMatchObject({ values: [1, 16, 128, 7] });
    expect(at('cache', 0.8)[0].values).toEqual([1, 8, 7, 128]);
    expect(at('cache')[0].values).toEqual([1, 8, 8, 128]);
  });
  it('数値例の2 Headと実モデルの16 Headを分ける', () => {
    expect(at('heads', 0.99, 'numbers')[0].values).toEqual([1, 2, 7, 3]);
    expect(at('logits', 0.99, 'numbers')[2].values).toEqual([1, 7, 3]);
    expect(at('logits')[2].values).toEqual([1, 7, 151936]);
    expect(at('sampling')[1].values).toEqual([1, 151936]);
  });
  it('全段階で軸名と寸法の数が一致し、色付けする軸が実在する', () => {
    for (const view of ['numbers', 'shapes'] as const)
      for (const step of journeySteps) {
        for (const row of at(step.id, 0.95, view)) {
          expect(row.axes.length).toBe(row.values.length);
          expect(row.drawn.every((i) => i >= 0 && i < row.axes.length)).toBe(true);
        }
      }
    expect(at('text')).toEqual([]);
  });
});

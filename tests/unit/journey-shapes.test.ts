import { describe, it, expect } from 'vitest';
import { journeySteps, journeyStarts } from '../../src/data/journey';
import { sampleJourney } from '../../src/lib/journey-scene';
import { shapeSpec, shapeOperations, shapeActors } from '../../src/lib/journey-shapes';

describe('形と軸の教材', () => {
  it('保持中の値を主処理へ広げず、完成時の図が左右にはみ出さない', () => {
    for (const [i, step] of journeySteps.entries()) {
      const actors = shapeActors(sampleJourney(journeyStarts[i] + step.duration * 0.99));
      for (const a of actors.filter((a) => a.entity.opacity > 0.9 && a.pose)) {
        expect(a.pose!.cx - a.pose!.width / 2, `${step.id}:${a.entity.id}`).toBeGreaterThanOrEqual(
          0,
        );
        expect(a.pose!.cx + a.pose!.width / 2, `${step.id}:${a.entity.id}`).toBeLessThanOrEqual(
          1000,
        );
      }
    }
    const i = journeySteps.findIndex((s) => s.id === 'multiply');
    expect(
      shapeActors(sampleJourney(journeyStarts[i] + 6000)).find((a) => a.entity.id === 'skip2')!
        .pose!.width,
    ).toBeLessThan(100);
    const down = journeySteps.findIndex((s) => s.id === 'down');
    expect(
      shapeActors(sampleJourney(journeyStarts[down] + 2000)).find((a) => a.entity.id === 'weight')!
        .spec,
    ).toMatchObject({ rows: 3072, cols: 1024 });
  });
  it('行列積の内側の寸法が一致し、外側の寸法が出力へ残る', () => {
    for (const step of journeySteps)
      for (const op of shapeOperations(step.id)) {
        if (op.inputs.length !== 2) continue;
        const [a, b] = op.inputs.map((id) => shapeSpec(step.id, id)!);
        const out = shapeSpec(step.id, op.output)!;
        if (op.kind === 'matmul') {
          expect(a.cols, step.id).toBe(b.rows);
          expect([out.rows, out.cols], step.id).toEqual([a.rows, b.cols]);
        } else
          expect(
            [
              [a.rows, a.cols],
              [b.rows, b.cols],
            ],
            step.id,
          ).toEqual([
            [out.rows, out.cols],
            [out.rows, out.cols],
          ]);
      }
  });
  it('Token位置、Head内成分、語彙候補を区別する', () => {
    expect(shapeSpec('scores', 'q')).toMatchObject({ rows: 7, cols: 128, rowAxis: 'Query位置' });
    expect(shapeSpec('scores', 'k')).toMatchObject({ rows: 128, cols: 7, colAxis: 'Key位置' });
    expect(shapeSpec('weighted', 'score')).toMatchObject({
      rows: 7,
      cols: 7,
      rowAxis: 'Query位置',
      colAxis: 'Key位置',
    });
    expect(shapeSpec('weighted', 'v')).toMatchObject({ rows: 7, cols: 128 });
    expect(shapeSpec('logits', 'weight')).toMatchObject({
      rows: 1024,
      cols: 151936,
      colAxis: '語彙候補',
    });
    expect(shapeSpec('logits', 'logits-state')).toMatchObject({ rows: 7, cols: 151936 });
    expect(shapeSpec('gate', 'gate')).toMatchObject({ cols: 3072 });
  });
  it('工程境界で同じ行列の位置と寸法を引き継ぐ', () => {
    for (const boundary of journeyStarts.slice(1)) {
      const before = shapeActors(sampleJourney(boundary - 0.001));
      const after = shapeActors(sampleJourney(boundary));
      for (const old of before.filter((a) => a.entity.opacity > 0.01 && a.pose)) {
        const next = after.find((a) => a.entity.id === old.entity.id)!;
        for (const key of ['cx', 'cy', 'width', 'height'] as const)
          expect(next.pose?.[key], `${old.entity.id}:${key}`).toBeCloseTo(old.pose![key], 2);
      }
    }
  });
});

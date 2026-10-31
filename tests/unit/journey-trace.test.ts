import { describe, it, expect } from 'vitest';
import { calculationFocus, completedRow, rotationDegrees } from '../../src/lib/journey-trace';
import { actorId, projectionActors } from '../../src/lib/journey-actors';
import { journeyStarts, journeySteps } from '../../src/data/journey';
import { sampleJourney } from '../../src/lib/journey-scene';
const focused = (step: string, id: string, rows: number, cols: number, c = 0.5) =>
  Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => calculationFocus(step, id, c, i, j)),
  )
    .flat()
    .filter(Boolean).length;
describe('処理に対応する強調と入力の単一性', () => {
  it('転置中のQ、連結のC、Cacheの過去データを計算対象として走査しない', () => {
    expect(focused('transpose', 'q', 7, 3)).toBe(0);
    expect(focused('concat', 'attn', 7, 3)).toBe(0);
    expect(focused('cache', 'v', 7, 3)).toBe(0);
  });
  it('行列積は入力の一行と相手の全列から出力の一行をまとめて作る', () => {
    expect(focused('weighted', 'score', 7, 7)).toBe(4);
    expect(focused('weighted', 'v', 7, 3)).toBe(12);
    expect(focused('weighted', 'attn', 7, 3)).toBe(3);
    expect(focused('logits', 'weight', 3, 3)).toBe(9);
    expect(focused('logits', actorId('logits', 'gate'), 7, 3)).toBe(3);
    expect(focused('residual-attn', 'skip', 7, 3)).toBe(3);
    expect(focused('residual-attn', actorId('residual-attn', 'attn'), 7, 3)).toBe(3);
    expect(completedRow(0.5, 3, 7)).toBe(false);
    expect(completedRow(4 / 7, 3, 7)).toBe(true);
  });
  it('RoPEの回転は入力の向きから位置の角度だけ回し、完了時にゼロへ戻らない', () => {
    expect(rotationDegrees([1, 0], 6, 1)).toBeCloseTo((2.4 * 180) / Math.PI);
    expect(rotationDegrees([0, 1], 6, 1) - rotationDegrees([0, 1], 6, 0)).toBeCloseTo(
      (2.4 * 180) / Math.PI,
    );
  });
  it('射影の前後で入力IDを保ち、新しい出力へ入力の値を複製しない', () => {
    for (const id of ['o-proj', 'down', 'logits']) {
      const i = journeySteps.findIndex((s) => s.id === id),
        ids = projectionActors(id)!;
      const previous = sampleJourney(journeyStarts[i] - 0.01).entities.find(
        (e) => e.id === ids.input,
      )!;
      for (const p of [0.01, 0.2, 0.45, 0.55, 0.8, 0.99]) {
        const scene = sampleJourney(journeyStarts[i] + journeySteps[i].duration * p),
          input = scene.entities.find((e) => e.id === ids.input)!,
          output = scene.entities.find((e) => e.id === ids.output)!;
        expect(input.start.data).toEqual(previous.end.data);
        expect(output.start.opacity).toBe(0);
        expect(output.start.data).toEqual(output.end.data);
        expect(scene.entities.some((e) => e.id.startsWith('operand-'))).toBe(false);
      }
    }
  });
});

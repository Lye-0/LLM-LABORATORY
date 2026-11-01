import { projectionActors, actorId } from '../../src/lib/journey-actors';
import { describe, expect, it } from 'vitest';
import {
  journeyAt,
  journeyDuration,
  journeyGroups,
  journeyStarts,
  journeySteps,
} from '../../src/data/journey';
import { layoutJourneyNotes, intersects } from '../../src/lib/journey-note-layout';
import { movementProgress, calculationProgress } from '../../src/lib/journey-timing';
import { journeyOperations } from '../../src/lib/journey-operations';
import { sampleJourney } from '../../src/lib/journey-scene';
import * as m from '../../src/lib/journey-model';
import { nodeById } from '../../src/data/atlas';

describe('一本の時間軸でつながる教材', () => {
  it('新しい結果の後は保持・移動・到着を経てから次の計算を始める', () => {
    for (const id of ['post-norm', 'down', 'layers']) {
      const i = journeySteps.findIndex((s) => s.id === id);
      const at = (p: number) => sampleJourney(journeyStarts[i] + journeySteps[i].duration * p);
      const entityId =
        id === 'post-norm'
          ? actorId(id, 'attn')
          : id === 'down'
            ? projectionActors(id)!.input
            : actorId(id, 'gate');
      const initial = at(0).entities.find((e) => e.id === entityId)!;
      const held = at(id === 'layers' ? 0.03 : 0.06).entities.find((e) => e.id === entityId)!;
      expect([held.x, held.y, held.w, held.h]).toEqual([
        initial.x,
        initial.y,
        initial.w,
        initial.h,
      ]);
      const ready = at(id === 'layers' ? 0.19 : 0.64);
      expect(ready.calculation).toBe(0);
      const actor = ready.entities.find((e) => e.id === entityId)!;
      expect([actor.x, actor.y, actor.w, actor.h]).toEqual([
        actor.end.x,
        actor.end.y,
        actor.end.w,
        actor.end.h,
      ]);
      expect(at(id === 'layers' ? 0.21 : 0.7).calculation).toBeGreaterThan(0);
      if (id === 'layers') expect(ready.layer).toBe(0);
    }
  });
  it('完成した行列は図の表示領域に収まる', () => {
    journeySteps.forEach((s, i) => {
      const sample = sampleJourney(journeyStarts[i] + s.duration * 0.999);
      sample.entities
        .filter((e) => e.opacity > 0.99)
        .forEach((e) => {
          const columns = e.transpose ? e.data.length : e.data[0].length;
          const rows = e.transpose ? e.data[0].length : e.data.length;
          expect(e.x + columns * e.w, `${s.id}:${e.id} right`).toBeLessThanOrEqual(1001);
          expect(e.y + rows * e.h, `${s.id}:${e.id} bottom`).toBeLessThanOrEqual(sample.height + 1);
        });
    });
  });
  it('地図と同じ4区分で、全工程に式・コード・接続先がある', () => {
    expect(journeyGroups.map((g) => g.no)).toEqual(['01', '02', '03', '04']);
    expect(new Set(journeySteps.map((s) => s.id)).size).toBe(journeySteps.length);
    journeySteps.forEach((s) => {
      expect(nodeById[s.node], s.node).toBeDefined();
      expect(s.code.length).toBeGreaterThan(0);
    });
    expect(journeyAt(-1).time).toBe(0);
    expect(journeyAt(Infinity).time).toBe(0);
    expect(journeyAt(journeyDuration + 1).time).toBe(journeyDuration);
  });
  it('全境界で、前の結果のパーツ位置・大きさ・可視性が次の開始へ引き継がれる', () => {
    for (const boundary of journeyStarts.slice(1)) {
      const before = sampleJourney(boundary - 0.001),
        after = sampleJourney(boundary);
      for (const old of before.entities.filter((e) => e.opacity > 0.01)) {
        const next = after.entities.find((e) => e.id === old.id)!;
        expect(next, `${before.step.id} → ${after.step.id}: ${old.id}`).toBeDefined();
        for (const key of ['x', 'y', 'w', 'h', 'opacity'] as const)
          expect(next[key], `${after.step.id}:${old.id}.${key}`).toBeCloseTo(old[key], 2);
        // The renderer uses the previous data at progress zero, including the transpose flag.
        expect(next.start.data, `${after.step.id}:${old.id} data`).toEqual(old.end.data);
      }
    }
  });
  it('転置は同じKの値を保持し、Residual・MLP・全層・候補選択が実際の前の結果を使う', () => {
    expect(m.transpose(m.transpose(m.firstLayer.kr))).toEqual(m.firstLayer.kr);
    expect(m.firstLayer.h1).toEqual(m.add(m.embedding, m.firstLayer.attention));
    expect(m.firstLayer.output).toEqual(m.add(m.firstLayer.h1, m.firstLayer.down));
    expect(m.layerStates[1]).toEqual(m.firstLayer.output);
    for (let l = 1; l < 28; l++)
      expect(m.layerStates[l + 1]).toEqual(m.decoder(m.layerStates[l], l).output);
    expect(m.logits).toEqual(m.matmul(m.finalHidden, m.lmWeight));
    expect(m.generated.ids.at(-1)).toBe(m.candidates[m.chosen].id);
    m.firstLayer.probabilities.forEach((row, i) => {
      expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
      expect(row.slice(i + 1).every((v) => v === 0)).toBe(true);
    });
    expect(m.layerStates.flat(2).every(Number.isFinite)).toBe(true);
  });
  it('行列名に計算式を混ぜず、別の処理説明が実際の数値更新に同期する', () => {
    journeySteps.forEach((s, i) => {
      const sample = sampleJourney(journeyStarts[i] + s.duration * 0.95);
      sample.entities
        .filter((e) => e.opacity > 0.9)
        .forEach((e) => expect(e.end.label).not.toMatch(/[→=⊙×]/));
      const op = journeyOperations(sample);
      op.notes.forEach((n) => expect(n.formula.length).toBeGreaterThan(0));
      const early = journeyOperations(sampleJourney(journeyStarts[i] + s.duration * 0.2));
      if (sampleJourney(journeyStarts[i] + s.duration * 0.2).calculation === 0)
        early.notes.forEach((n) => expect(n.detail).toEqual([]));
    });
    const normIndex = journeySteps.findIndex((s) => s.id === 'norm');
    const op = journeyOperations(
      sampleJourney(journeyStarts[normIndex] + journeySteps[normIndex].duration * 0.95),
    );
    expect(op.notes[0].formula.join(' ')).toContain('<msqrt>');
    expect(op.notes[0].detail.join(' ')).toContain('係数w');
  });
  it('説明位置を安定させ、完了時の行列との非重複と数式構造を保つ', () => {
    for (const [i, step] of journeySteps.entries())
      for (const p of [0.01, 0.2, 0.4, 0.57, 0.7, 0.95]) {
        const sample = sampleJourney(journeyStarts[i] + step.duration * p);
        const layout = layoutJourneyNotes(sample, journeyOperations(sample).notes);
        layout.notes.forEach((n, index) => {
          expect(
            layout.obstacles.some((o) => intersects(n, o)),
            `${step.id}:${n.key}`,
          ).toBe(false);
          expect(layout.notes.slice(0, index).some((o) => intersects(n, o))).toBe(false);
          expect(n.x + n.width).toBeLessThanOrEqual(1000);
          expect(n.formula.join('').replace(/<[^>]+>/g, '')).not.toMatch(/[√/]/);
        });
      }
    expect(calculationProgress(0.57)).toBe(0);
    expect(movementProgress(0.58)).toBeGreaterThan(0.995);
    expect(calculationProgress(0.6)).toBeGreaterThan(0);
    expect(calculationProgress(0.86)).toBe(1);
  });
  it('射影は左に入力、中央に正しい重み、右に出力を保持し、演算記号の高さを揃える', () => {
    const operations = [
      ['o-proj', 'attn', m.firstLayer.joined, m.firstLayer.wo, m.firstLayer.attention],
      ['down', 'gate', m.firstLayer.mixed, m.firstLayer.wd, m.firstLayer.down],
      ['logits', 'gate', m.finalHidden, m.lmWeight, m.logits],
    ] as const;
    for (const [id, _target, input, weight, out] of operations) {
      const i = journeySteps.findIndex((s) => s.id === id),
        sample = sampleJourney(journeyStarts[i] + journeySteps[i].duration * 0.95);
      const ids = projectionActors(id)!;
      const operand = sample.entities.find((e) => e.id === ids.input)!,
        parameter = sample.entities.find((e) => e.id === 'weight')!,
        result = sample.entities.find((e) => e.id === ids.output)!;
      expect(operand.end.data).toEqual(input);
      expect(parameter.start.data).toEqual(weight);
      expect(parameter.end.data).toEqual(weight);
      expect(result.end.data).toEqual(out);
      expect(operand.x + operand.w * input[0].length).toBeLessThan(parameter.x);
      expect(parameter.x + parameter.w * weight[0].length).toBeLessThan(result.x);
      const cy = result.y + (result.h * out.length) / 2;
      expect(parameter.y + (parameter.h * weight.length) / 2).toBeCloseTo(cy);
      journeyOperations(sample).symbols.forEach((s) => expect(s.y).toBeCloseTo(cy));
    }
    journeySteps.forEach((s, i) => {
      const sample = sampleJourney(journeyStarts[i] + s.duration * 0.99);
      layoutJourneyNotes(sample, journeyOperations(sample).notes).notes.forEach((n) =>
        expect(n.opacity, `${s.id}:${n.key}`).toBe(1),
      );
      sample.entities
        .filter((e) => e.opacity > 0.9 && e.tone === 'saved')
        .forEach((e) => expect(e.x).toBeLessThan(175));
    });
  });
  it('どこへシークしても同じ状態を再現できる', () => {
    const times = journeyStarts.flatMap((t, i) => [
      t,
      t + journeySteps[i].duration * 0.4,
      t + journeySteps[i].duration * 0.9,
    ]);
    const forward = times.map(sampleJourney);
    times
      .slice()
      .reverse()
      .forEach((t) => sampleJourney(t));
    expect(times.map(sampleJourney)).toEqual(forward);
  });
});

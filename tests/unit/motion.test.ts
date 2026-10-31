import { describe, it, expect } from 'vitest';
import { chapters, motionSteps, motionForNode, motionUrl } from '../../src/data/motion';
import { nodeById } from '../../src/data/atlas';
import reference from '../../src/data/motion-reference.json';
import { exampleProduct, linearCell } from '../../src/lib/motion-math';
describe('動きで学ぶの教材対応', () => {
  it('積和の数値が行・列の選択と一致する', () => {
    expect(exampleProduct).toEqual([
      [1, -3],
      [13, 2],
    ]);
    expect([0, 0.3, 0.6, 1].map((p) => linearCell(p).value)).toEqual([1, -3, 13, 2]);
  });
  it('全段階に目的・入出力・式・コードと、実在する地図の地点がある', () => {
    expect(new Set(motionSteps.map((s) => s.id)).size).toBe(motionSteps.length);
    for (const s of motionSteps) {
      expect(chapters.some((c) => c.id === s.chapter)).toBe(true);
      expect(nodeById[s.node], s.node).toBeDefined();
      for (const v of [s.purpose, s.action, s.input, s.output, s.formula, s.code])
        expect(v.length).toBeGreaterThan(0);
    }
    for (const [node, step] of Object.entries(motionForNode)) {
      expect(nodeById[node], node).toBeDefined();
      expect(motionSteps.some((s) => s.id === step)).toBe(true);
    }
  });
  it('同じ7位置と29状態の観察データを保持し、往復URLをエンコードする', () => {
    expect(reference.ids.length).toBe(7);
    expect(reference.vectors.length).toBe(7);
    expect(reference.states.length).toBe(29);
    expect(reference.states.every((v) => v.length === 8)).toBe(true);
    expect(reference.lastRaw.length).toBe(8);
    expect(motionUrl('rope', '/maps/#n-q-rope')).toBe(
      '/motion/?step=rope&from=%2Fmaps%2F%23n-q-rope',
    );
  });
});

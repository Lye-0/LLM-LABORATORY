import { describe, it, expect } from 'vitest';
import * as model from '../../src/lib/journey-model';
describe('説明モデルの2 Query Headsと共有KV Head', () => {
  it('射影の全成分を順序どおりに分け、Head内で個別に正規化する', () => {
    const f = model.firstLayer;
    for (let row = 0; row < 7; row++) {
      expect([...f.qHeads[0][row], ...f.qHeads[1][row]]).toEqual(f.q[row]);
      expect(f.q[row]).toHaveLength(6);
      expect(f.k[row]).toHaveLength(3);
      expect(f.v[row]).toHaveLength(3);
    }
    expect(f.qnHeads[0]).toEqual(model.norm(f.qHeads[0]));
    expect(f.qnHeads[1]).toEqual(model.norm(f.qHeads[1]));
    expect(f.qnHeads[0]).not.toEqual(f.qnHeads[1]);
  });
  it('両Headが共有K/Vで別々にAttentionを計算し、各Tokenの成分を結合する', () => {
    const f = model.firstLayer;
    for (let head = 0; head < 2; head++) {
      expect(f.scoresHeads[head]).toEqual(
        model
          .matmul(f.qrHeads[head], model.transpose(f.kr))
          .map((row) => row.map((value) => value / Math.sqrt(3))),
      );
      expect(f.contextHeads[head]).toEqual(model.matmul(f.probabilitiesHeads[head], f.v));
      for (const [i, row] of f.probabilitiesHeads[head].entries()) {
        expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        expect(row.slice(i + 1).every((value) => value === 0)).toBe(true);
      }
    }
    expect(f.contextHeads[0]).not.toEqual(f.contextHeads[1]);
    for (let row = 0; row < 7; row++)
      expect(f.joined[row]).toEqual([...f.contextHeads[0][row], ...f.contextHeads[1][row]]);
    expect(f.wo).toHaveLength(6);
    expect(f.attention).toEqual(model.matmul(f.joined, f.wo));
  });
});

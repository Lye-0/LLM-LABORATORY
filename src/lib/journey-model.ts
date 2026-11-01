import reference from '../data/motion-reference.json' with { type: 'json' };
export type Matrix = number[][];
export const tokenPieces = ['こんにちは', '、', '今日は', 'いい', '天', '気', 'ですね'];
export const tokenIds = reference.ids;
export const embedding: Matrix = reference.vectors;
export const transpose = (a: Matrix): Matrix => a[0].map((_, c) => a.map((row) => row[c]));
export const matmul = (a: Matrix, b: Matrix): Matrix =>
  a.map((row) => b[0].map((_, c) => row.reduce((sum, v, k) => sum + v * b[k][c], 0)));
export const add = (a: Matrix, b: Matrix): Matrix =>
  a.map((row, i) => row.map((v, j) => v + b[i][j]));
export const norm = (a: Matrix): Matrix =>
  a.map((row) => {
    const rms = Math.sqrt(row.reduce((s, v) => s + v * v, 0) / row.length + 1e-6);
    return row.map((v) => v / rms);
  });
export const silu = (a: Matrix): Matrix => a.map((row) => row.map((v) => v / (1 + Math.exp(-v))));
export const softmax = (a: Matrix): Matrix =>
  a.map((row) => {
    const max = Math.max(...row),
      ex = row.map((v) => Math.exp(v - max)),
      sum = ex.reduce((s, v) => s + v, 0);
    return ex.map((v) => v / sum);
  });
export const rope = (a: Matrix): Matrix =>
  a.map((row, i) => {
    const angle = i * 0.4,
      c = Math.cos(angle),
      s = Math.sin(angle);
    return [row[0] * c - row[1] * s, row[0] * s + row[1] * c, row[2]];
  });
function weight(rows: number, cols: number, seed: number): Matrix {
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => Math.sin((i + 1) * 2.3 + (j + 1) * 1.7 + seed) * 0.32),
  );
}
export function decoder(input: Matrix, layer = 0) {
  const x = norm(input),
    wq = weight(3, 6, layer + 0.1),
    wk = weight(3, 3, layer + 0.7),
    wv = weight(3, 3, layer + 1.4);
  const q = matmul(x, wq),
    k = matmul(x, wk),
    v = matmul(x, wv);
  // Two Query Heads share one KV Head, retaining the real model's 2:1 GQA ratio.
  const qHeads = [0, 1].map((head) => q.map((row) => row.slice(head * 3, head * 3 + 3)));
  const qnHeads = qHeads.map(norm),
    qrHeads = qnHeads.map(rope);
  const kn = norm(k),
    kr = rope(kn);
  const scoresHeads = qrHeads.map((head) =>
    matmul(head, transpose(kr)).map((row) => row.map((value) => value / Math.sqrt(3))),
  );
  const maskedHeads = scoresHeads.map((head) =>
    head.map((row, i) => row.map((value, j) => (j > i ? -Infinity : value))),
  );
  const probabilitiesHeads = maskedHeads.map(softmax);
  const contextHeads = probabilitiesHeads.map((head) => matmul(head, v));
  const [qn] = qnHeads,
    [qr] = qrHeads,
    [scores] = scoresHeads,
    [masked] = maskedHeads,
    [probabilities] = probabilitiesHeads,
    [context] = contextHeads;
  const joined = contextHeads[0].map((row, i) => [...row, ...contextHeads[1][i]]);
  const wo = weight(6, 3, layer + 2),
    attention = matmul(joined, wo),
    h1 = add(input, attention),
    post = norm(h1);
  const wg = weight(3, 6, layer + 3),
    wu = weight(3, 6, layer + 4),
    gate = matmul(post, wg),
    up = matmul(post, wu),
    activated = silu(gate);
  const mixed = activated.map((row, i) => row.map((v, j) => v * up[i][j])),
    wd = weight(6, 3, layer + 5),
    down = matmul(mixed, wd),
    output = add(h1, down);
  return {
    input,
    x,
    wq,
    wk,
    wv,
    q,
    k,
    v,
    qHeads,
    qnHeads,
    qrHeads,
    scoresHeads,
    maskedHeads,
    probabilitiesHeads,
    contextHeads,
    joined,
    qn,
    kn,
    qr,
    kr,
    scores,
    masked,
    probabilities,
    context,
    wo,
    attention,
    h1,
    post,
    wg,
    wu,
    gate,
    up,
    activated,
    mixed,
    wd,
    down,
    output,
  };
}
export const firstLayer = decoder(embedding);
export const layerStates: Matrix[] = [embedding, firstLayer.output];
for (let i = 1; i < 28; i++) layerStates.push(decoder(layerStates[i], i).output);
export const finalHidden = norm(layerStates[28]);
export const lmWeight = weight(3, 3, 7.2),
  logits = matmul(finalHidden, lmWeight),
  nextProbabilities = softmax([logits.at(-1)!])[0];
export const candidates = [
  { id: 1773, text: '。' },
  { id: 5373, text: '、' },
  { id: 89015, text: 'こんにちは' },
];
export const chosen = nextProbabilities.indexOf(Math.max(...nextProbabilities));
export const generated = {
  ids: [...tokenIds, candidates[chosen].id],
  pieces: [...tokenPieces, candidates[chosen].text],
};

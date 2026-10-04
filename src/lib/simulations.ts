export function product(shape: number[]): number {
  return shape.reduce((a, b) => a * b, 1);
}
export function unsqueeze(shape: number[], axis: number): number[] {
  const dim = axis < 0 ? axis + shape.length + 1 : axis;
  if (!Number.isInteger(dim) || dim < 0 || dim > shape.length)
    throw new Error('軸の挿入位置が範囲外です。');
  return [...shape.slice(0, dim), 1, ...shape.slice(dim)];
}
export function softmax(values: number[], temperature = 1): number[] {
  if (!Number.isFinite(temperature) || temperature <= 0)
    throw new Error('temperatureは0より大きくします。');
  if (!values.length || values.some((v) => Number.isNaN(v) || v === Infinity))
    throw new Error('有効なlogitsが必要です。');
  const max = Math.max(...values);
  if (max === -Infinity) throw new Error('すべての位置がmaskされています。');
  const exps = values.map((v) => Math.exp((v - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}
export function filteredDistribution(
  logits: number[],
  temperature: number,
  topK: number,
  topP: number,
): number[] {
  const probabilities = softmax(logits, temperature);
  let sorted = probabilities.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
  if (topK > 0) sorted = sorted.slice(0, Math.max(1, Math.floor(topK)));
  const mass = sorted.reduce((a, x) => a + x.p, 0);
  let cumulative = 0;
  const kept = sorted.filter((x, i) => {
    const keep = i === 0 || cumulative < topP;
    cumulative += x.p / mass;
    return keep;
  });
  const total = kept.reduce((a, x) => a + x.p, 0);
  return probabilities.map((_, i) => (kept.find((x) => x.i === i)?.p ?? 0) / total);
}
export function sample(probabilities: number[], seed: number): number {
  // Seeded educational sampler (Mulberry32); not PyTorch's RNG.
  let state = (seed >>> 0) + 0x6d2b79f5;
  state = Math.imul(state ^ (state >>> 15), state | 1);
  state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
  const random = ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  let cumulative = 0;
  for (let i = 0; i < probabilities.length; i++) {
    cumulative += probabilities[i];
    if (random < cumulative) return i;
  }
  return probabilities.length - 1;
}
export function quantize(values: number[], bits: number, limit?: number) {
  if (
    !Number.isInteger(bits) ||
    bits < 2 ||
    bits > 16 ||
    !values.length ||
    values.some((v) => !Number.isFinite(v))
  )
    throw new Error('量子化の入力が不正です。');
  const max = limit ?? Math.max(...values.map(Math.abs));
  if (!Number.isFinite(max) || max < 0) throw new Error('範囲が不正です。');
  const qmax = 2 ** (bits - 1) - 1;
  const scale = max === 0 ? 1 : max / qmax;
  const integers = values.map((v) => Math.max(-qmax, Math.min(qmax, Math.round(v / scale))));
  const restored = integers.map((v) => v * scale);
  const mse = values.reduce((acc, v, i) => acc + (v - restored[i]) ** 2, 0) / values.length;
  return { scale, integers, restored, mse };
}
export const embeddingWeights = [
  [0.6, -0.7, 0.1],
  [0.0, 0.3, -0.2],
  [-0.1, -0.5, 1.4],
  [-1.7, -1.6, -1.0],
  [-1.8, 0.1, 0.7],
];
export function lookup(ids: number[], weights = embeddingWeights) {
  if (ids.some((i) => !Number.isInteger(i) || i < 0 || i >= weights.length))
    throw new Error(`IDは0〜${weights.length - 1}の整数です。`);
  return ids.map((i) => [...weights[i]]);
}
export function dot(a: number[], b: number[]) {
  if (a.length !== b.length) throw new Error('内積の要素数が一致しません。');
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}
export function attention(q: number[][], k: number[][], v: number[][], causal: boolean) {
  const scores = q.map((row, i) =>
    k.map((key, j) => (causal && j > i ? -Infinity : dot(row, key) / Math.sqrt(row.length))),
  );
  const probabilities = scores.map((row) => softmax(row));
  const output = probabilities.map((row) =>
    v[0].map((_, col) => row.reduce((sum, p, i) => sum + p * v[i][col], 0)),
  );
  return { scores, probabilities, output };
}
export function gradientStep(w: number, x: number, target: number, rate: number) {
  const prediction = w * x;
  const loss = (prediction - target) ** 2;
  const gradient = 2 * (prediction - target) * x;
  return { prediction, loss, gradient, next: w - rate * gradient };
}

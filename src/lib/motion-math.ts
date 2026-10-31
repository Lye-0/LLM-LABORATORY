export const exampleInput = [
  [2, -1, 1],
  [0, 3, 2],
];
export const exampleWeight = [
  [1, 3, 2],
  [-2, 0, 1],
];
export const exampleProduct = exampleInput.map((row) =>
  exampleWeight.map((w) => row.reduce((sum, x, i) => sum + x * w[i], 0)),
);
export function linearCell(progress: number) {
  const index = Math.min(3, Math.floor(progress * 4)),
    row = Math.floor(index / 2),
    column = index % 2;
  const terms = exampleInput[row].map(
    (v, i) =>
      `${v < 0 ? `(${v})` : v} × ${exampleWeight[column][i] < 0 ? `(${exampleWeight[column][i]})` : exampleWeight[column][i]}`,
  );
  return { index, row, column, terms, value: exampleProduct[row][column] };
}

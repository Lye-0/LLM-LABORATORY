/** Chapter-to-chapter relationships shared by drawing and detail navigation. */
export const crossConnections: [string, string][] = [
  ['embedding', 'layer-input'],
  ['next-layer', 'final-norm'],
  ['lm-head', 'last-logits'],
  ['lm-head', 'shift'],
  ['zero-grad', 'device'],
  ['batch', 'device'],
  ['labels', 'shift'],
  ['optimizer', 'zero-grad'],
  ['resume', 'zero-grad'],
  ['load', 'torch'],
  ['initialize', 'torch'],
];

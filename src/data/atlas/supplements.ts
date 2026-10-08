import { learningMaps, type MapStep } from '../maps';
import { legacyNodes } from './legacy';
// Keep the existing verified code examples alongside the expanded static map.
export const supplements: Record<string, MapStep> = {};
for (const map of learningMaps)
  for (const section of map.sections)
    for (const step of section.steps) {
      const id = legacyNodes[map.slug]?.[section.id]?.[step.id];
      if (id && !supplements[id]) supplements[id] = step;
    }
export const lessonLocations: Record<string, string> = {
  overview: 'owner',
  environment: 'hardware',
  'first-generation': 'decode',
  'python-objects': 'dict',
  tensor: 'dtype',
  tokenizer: 'tokenize',
  bpe: 'tokenize',
  vocabulary: 'tokenizer-assets',
  'chat-template': 'template',
  batch: 'batch',
  embedding: 'embedding',
  qwen: 'hidden-tuple',
  linear: 'q-proj',
  position: 'q-rope',
  attention: 'scores',
  'transformer-block': 'residual-attn',
  logits: 'lm-head',
  sampling: 'sampling',
  'kv-cache': 'k-cache',
  'inference-memory': 'memory',
  loss: 'loss',
  autograd: 'backward',
  'data-evaluation': 'split',
  'model-editing': 'baseline',
  'vocab-extension': 'vocab-edit',
  lora: 'lora',
  quantization: 'quantize',
  'save-model': 'export',
  evaluation: 'evaluate',
};

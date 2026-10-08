export const legacyNodes: Record<string, Record<string, Record<string, string>>> = {
  inference: {
    inference: {
      ids: 'input-ids',
      embedding: 'embedding',
      context: 'layer-input',
      logits: 'lm-head',
      choose: 'greedy',
      loop: 'append',
      decode: 'decode',
    },
  },
  structure: {
    model: { embedding: 'embedding', layers: 'layer-input', norm: 'final-norm', head: 'lm-head' },
    block: {
      norm1: 'input-norm',
      attention: 'q-proj',
      add1: 'residual-attn',
      norm2: 'post-norm',
      mlp: 'gate-proj',
      add2: 'residual-mlp',
    },
    attention: { qkv: 'q-proj', rope: 'q-rope', mix: 'scores' },
  },
  training: {
    creation: {
      data: 'dataset',
      tokenizer: 'train-tokenize',
      initialize: 'train-start',
      train: 'train-mode',
      evaluate: 'evaluate',
      save: 'checkpoint',
    },
    update: { forward: 'layer-input', loss: 'loss', backward: 'backward', step: 'optimizer' },
    start: { scratch: 'train-start', finetune: 'train-start', lora: 'lora' },
  },
  modification: {
    change: {
      generation: 'generation-edit',
      embedding: 'embedding-edit',
      vocab: 'vocab-edit',
      lora: 'lora',
      quantize: 'quantize',
      replace: 'replace-layer',
    },
    compare: { baseline: 'baseline', compare: 'compare', restore: 'restore' },
  },
  runtime: {
    runtime: {
      files: 'weights',
      objects: 'load',
      tensor: 'memory',
      execute: 'torch',
      save: 'export',
      reload: 'reload',
    },
  },
};

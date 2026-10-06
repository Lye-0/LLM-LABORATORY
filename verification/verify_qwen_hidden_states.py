"""Verify Qwen checkpoints against layer hooks using existing cached weights only."""
import json
import os
import platform
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
import torch
import transformers
from transformers import AutoModelForCausalLM, AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
MODEL = 'Qwen/Qwen3-0.6B'
REVISION = 'c1899de289a04d12100db370d81485cdf75e47ca'
torch.set_num_threads(4)
tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION, local_files_only=True)
model = AutoModelForCausalLM.from_pretrained(
    MODEL, revision=REVISION, dtype=torch.bfloat16, device_map='cpu', local_files_only=True,
)
model.eval()
text = 'こんにちは、今日はいい天気ですね'
inputs = tokenizer(text, add_special_tokens=False, return_tensors='pt')
inputs = {key: value.to(model.get_input_embeddings().weight.device) for key, value in inputs.items()}
original_ids = inputs['input_ids'].clone()
observed = {}

def capture(name):
    def hook(module, args, result):
        observed[name] = (result[0] if isinstance(result, tuple) else result).detach().clone()
    return hook

handles = [layer.register_forward_hook(capture(f'layer-{i}')) for i, layer in enumerate(model.model.layers)]
handles.append(model.model.norm.register_forward_hook(capture('final-norm')))
try:
    with torch.no_grad():
        embedded = model.get_input_embeddings()(inputs['input_ids'])
        outputs = model(**inputs, output_hidden_states=True, use_cache=False)
finally:
    for handle in handles:
        handle.remove()

states = outputs.hidden_states
assert isinstance(states, tuple) and len(states) == 29
assert all(tuple(state.shape) == (1, 7, 1024) for state in states)
assert torch.equal(states[0], embedded)
assert all(torch.equal(states[i], observed[f'layer-{i - 1}']) for i in range(1, 28))
assert torch.equal(states[28], observed['final-norm'])
assert not torch.allclose(states[28], observed['layer-27'])
assert not torch.allclose(states[0], states[1])
assert torch.equal(inputs['input_ids'], original_ids)
assert outputs.past_key_values is None
assert tuple(outputs.logits.shape) == (1, 7, 151936)

with torch.no_grad():
    one = model(input_ids=inputs['input_ids'][:, :1], output_hidden_states=True, use_cache=False)
assert all(torch.allclose(full[:, :1].float(), prefix.float(), rtol=0, atol=0.02)
           for full, prefix in zip(states, one.hidden_states))

record = {
    'verifiedAt': '2026-10-07', 'python': platform.python_version(),
    'torch': torch.__version__, 'transformers': transformers.__version__,
    'model': MODEL, 'revision': REVISION, 'device': 'cpu', 'dtype': str(states[0].dtype),
    'text': text, 'ids': inputs['input_ids'].tolist(),
    'layerCount': len(model.model.layers), 'stateCount': len(states),
    'stateShapes': [list(state.shape) for state in states],
    'firstTokenFirst8': [state[0, 0, :8].float().tolist() for state in states],
    'layer27RawFirst8': observed['layer-27'][0, 0, :8].float().tolist(),
    'allcloseBeforeAfterLayer0': torch.allclose(states[0], states[1]),
    'checks': ['embedding-equality', 'every-intermediate-layer-hook', 'final-norm-hook',
               'last-state-is-not-raw-layer27', 'same-shape-different-values',
               'input-unchanged', 'no-kv-cache', 'first-position-causal-prefix'],
}
out = ROOT / 'tests/fixtures/qwen-hidden-states-reference.json'
out.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Qwen hidden-state checks passed:', ', '.join(record['checks']))
for i in [0, 1, 27, 28]:
    print(i, states[i][0, 0, :8])

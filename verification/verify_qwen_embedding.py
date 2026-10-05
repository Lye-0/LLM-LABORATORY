"""Verify trained Qwen embeddings from the existing cache, without downloads.

Run in an environment with PyTorch, Transformers and cached Qwen3-0.6B weights.
Only model loading and embedding lookup are performed; no generation or training.
"""
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
tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION, local_files_only=True)
model = AutoModelForCausalLM.from_pretrained(
    MODEL, revision=REVISION, dtype=torch.bfloat16, device_map='cpu', local_files_only=True,
)
model.eval()
embedding = model.get_input_embeddings()
assert embedding is model.get_input_embeddings()
assert tuple(embedding.weight.shape) == (151936, 1024)
assert embedding.weight.dtype == torch.bfloat16
assert tokenizer.vocab_size == 151643 and len(tokenizer) == 151669

with torch.no_grad():
    one = tokenizer.encode('こんにちは', add_special_tokens=False, return_tensors='pt')
    assert one.tolist() == [[89015]]
    output = embedding(one)
    assert tuple(output.shape) == (1, 1, 1024)
    assert torch.equal(output[0, 0], embedding.weight[89015])
    assert torch.allclose(output[0, 0], embedding.weight[89015])
    shapes = []
    for value in [89015, [89015], [[89015]]]:
        ids = torch.tensor(value, dtype=torch.long)
        converted = embedding(ids)
        assert torch.equal(converted.reshape(-1, 1024)[0], output[0, 0])
        shapes.append({'input': list(ids.shape), 'output': list(converted.shape)})
    text = 'こんにちは、今日はいい天気ですね'
    ids = tokenizer.encode(text, add_special_tokens=False, return_tensors='pt')
    original_ids = ids.clone()
    multiple = embedding(ids)
    assert ids.tolist() == [[89015, 5373, 133165, 126224, 35727, 94121, 128797]]
    assert tuple(multiple.shape) == (1, 7, 1024)
    assert torch.equal(ids, original_ids)
    for position, token_id in enumerate(ids[0].tolist()):
        assert torch.equal(multiple[0, position], embedding.weight[token_id])
    first_rows = embedding.weight[:3, :8].float().tolist()
    hello_prefix = output[0, 0, :10].float().tolist()
    token_prefixes = multiple[0, :, :3].float().tolist()

record = {
    'verifiedAt': '2026-10-05', 'python': platform.python_version(),
    'torch': torch.__version__, 'transformers': transformers.__version__,
    'model': MODEL, 'revision': REVISION, 'device': 'cpu', 'dtype': str(embedding.weight.dtype),
    'modelClass': str(type(model)), 'embeddingClass': str(type(embedding)),
    'embedding': str(embedding), 'weightShape': list(embedding.weight.shape),
    'weightBytes': embedding.weight.numel() * embedding.weight.element_size(),
    'modelVocabSize': model.config.vocab_size, 'baseVocabSize': tokenizer.vocab_size,
    'totalVocabSize': len(tokenizer), 'shapes': shapes,
    'firstRowsFirst8': first_rows, 'helloFirst10': hello_prefix,
    'text': text, 'ids': ids.tolist(), 'tokens': tokenizer.convert_ids_to_tokens(ids[0].tolist()),
    'outputShape': list(multiple.shape), 'eachTokenFirst3': token_prefixes,
    'sameLayer': embedding is model.get_input_embeddings(),
    'tiedWeights': embedding.weight.data_ptr() == model.get_output_embeddings().weight.data_ptr(),
    'modelDisplay': str(model),
    'checks': ['cached-trained-weights', 'layer-identity', 'vocabulary', 'single-lookup',
               'shape-preservation', 'seven-token-lookup', 'input-unchanged'],
}
out = ROOT / 'tests/fixtures/qwen-embedding-reference.json'
out.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Qwen embedding checks passed:', ', '.join(record['checks']))
print('weight:', record['weightShape'], record['dtype'], record['device'])
print('hello first 10:', [round(x, 4) for x in hello_prefix])
print('seven-token output:', record['outputShape'])

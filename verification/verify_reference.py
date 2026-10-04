"""CPU reference values from PyTorch and the bundled, offline Qwen tokenizer.
Run in an environment with torch and transformers. Does not download model weights.
"""
import json
import math
import platform
from pathlib import Path
import torch
import transformers
from transformers import AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
tokenizer = AutoTokenizer.from_pretrained(str(ROOT / 'public/data/qwen3'), local_files_only=True)
texts = ['こんにちは、今日はいい天気ですね', 'Hello world', ' Hello world', '改行\nを含む文章', '🦦と🌏', '<think>考える</think>', '']
encoded = []
for text in texts:
    ids = tokenizer.encode(text, add_special_tokens=False)
    encoded.append({'text': text, 'ids': ids, 'decoded': tokenizer.decode(ids, skip_special_tokens=False)})
assert encoded[0]['ids'] == [89015, 5373, 133165, 126224, 35727, 94121, 128797]
ids = torch.tensor(encoded[0]['ids'])
assert ids[0].shape == torch.Size([]) and ids[0].numel() == 1
assert ids[0:1].shape == torch.Size([1])
assert ids.unsqueeze(0).shape == torch.Size([1, 7])
embedding = torch.nn.Embedding(5, 3)
with torch.no_grad():
    embedding.weight.copy_(torch.tensor([[.6, -.7, .1], [0., .3, -.2], [-.1, -.5, 1.4], [-1.7, -1.6, -1.], [-1.8, .1, .7]]))
result = embedding(torch.tensor([[2, 0, 2]]))
assert result.shape == torch.Size([1, 3, 3])
assert torch.equal(result[0, 0], result[0, 2])
q = torch.tensor([[1., 0.], [1., 1.]])
k = torch.tensor([[1., 0.], [0., 1.]])
v = torch.tensor([[2., 0.], [0., 4.]])
scores = q @ k.T / math.sqrt(2)
scores = scores.masked_fill(torch.triu(torch.ones(2, 2, dtype=torch.bool), diagonal=1), -torch.inf)
attention = scores.softmax(-1) @ v
assert torch.allclose(attention, torch.tensor([[2., 0.], [1., 2.]]))
w = torch.tensor(.5, requires_grad=True)
loss = (w * 2 - 3) ** 2
loss.backward()
assert w.grad.item() == -8
record = {
    'verifiedAt': '2026-10-04', 'device': 'cpu', 'python': platform.python_version(),
    'torch': torch.__version__, 'transformers': transformers.__version__,
    'model': 'Qwen/Qwen3-0.6B', 'revision': 'c1899de289a04d12100db370d81485cdf75e47ca',
    'tokenizerClass': type(tokenizer).__name__, 'tokenizerCases': encoded,
    'embeddingOutput': result.detach().tolist(), 'attentionOutput': attention.tolist(),
    'gradient': w.grad.item(), 'vocabSize': tokenizer.vocab_size, 'totalVocab': len(tokenizer),
    'specialTokensMask': tokenizer.get_special_tokens_mask([151644, 89015, 151645], already_has_special_tokens=True),
    'checks': ['tokenizer', 'scalar', 'slice', 'unsqueeze', 'embedding', 'attention', 'gradient'],
}
out = ROOT / 'tests/fixtures/python-reference.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Reference checks passed:', ', '.join(record['checks']))

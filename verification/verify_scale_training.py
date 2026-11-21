"""Run the published recipes against cached Qwen3; no model download.

Run from the repository root with torch and transformers installed.
Writes a local report to .cache/scale-verification.json.
"""
import contextlib
import io
import json
from pathlib import Path

import torch
import transformers
from transformers import AutoModelForCausalLM, AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
recipes = {r['id']: r['code'] for r in json.loads(
    (ROOT / 'src/data/recipes.json').read_text(encoding='utf-8'))['recipes']}
revision = json.loads((ROOT / 'public/data/qwen3/manifest.json').read_text())['revision']
model_id = 'Qwen/Qwen3-0.6B'
device = 'cuda' if torch.cuda.is_available() else 'cpu'
tokenizer = AutoTokenizer.from_pretrained(model_id, revision=revision, local_files_only=True)
model = AutoModelForCausalLM.from_pretrained(
    model_id, revision=revision, local_files_only=True, dtype=torch.bfloat16,
).to(device).eval()
text = tokenizer.apply_chat_template(
    [{'role': 'user', 'content': '雨が降る仕組みを説明してください'}],
    tokenize=False, add_generation_prompt=True, enable_thinking=False,
)
inputs = {k: v.to(device) for k, v in tokenizer(
    text, return_tensors='pt', add_special_tokens=False).items()}
ns = dict(torch=torch, model=model, inputs=inputs)
exec(recipes['scale-mlp'], ns)
ScaledMLP = ns['ScaledMLP']
layer = model.model.layers[27]
original = layer.mlp
parameters = list(model.parameters())
flags = [p.requires_grad for p in parameters]
versions = [p._version for p in parameters]
fixed = ScaledMLP(original, scale=0.5)
learnable = ScaledMLP(original, learnable=True)
assert 'scale' not in fixed.state_dict()
assert 'scale' in learnable.state_dict()
assert learnable.scale.shape == torch.Size([])
assert learnable.scale.dtype == torch.float32
assert learnable.scale.device == original.down_proj.weight.device
assert learnable.gate_proj is original.gate_proj
with torch.no_grad():
    x = torch.zeros((1, 2, model.config.hidden_size), device=device, dtype=torch.bfloat16)
    x[..., 0] = 1
    expected = original(x)
    torch.testing.assert_close(fixed(x), expected * 0.5, rtol=0, atol=0)
    torch.testing.assert_close(learnable(x), expected, rtol=0, atol=0)
    assert learnable(x).dtype == expected.dtype
    assert torch.count_nonzero(ScaledMLP(original, scale=0)(x)).item() == 0

log = io.StringIO()
with contextlib.redirect_stdout(log):
    exec(recipes['compare-scale'], ns)
    exec(recipes['train-scale'], ns)
student = ns['student_mlp']
assert layer.mlp is original
assert all(p is q for p, q in zip(parameters, model.parameters()))
assert [p.requires_grad for p in parameters] == flags
assert [p._version for p in parameters] == versions
assert all(p.grad is None for p in parameters)
assert student.scale.grad is not None and torch.isfinite(student.scale.grad)
assert student.scale.item() != 1.0
assert ns['target_logits'].requires_grad is False
assert ns['target_logits'].shape == (model.config.vocab_size,)

# Check restoration on a failure after the Student has been installed.
normal_forward = ScaledMLP.forward
def fail_student(self, x):
    if isinstance(self.scale, torch.nn.Parameter):
        raise RuntimeError('intentional verification failure')
    return normal_forward(self, x)
ScaledMLP.forward = fail_student
try:
    try:
        exec(recipes['train-scale'], ns)
    except RuntimeError as exc:
        assert str(exc) == 'intentional verification failure'
    else:
        raise AssertionError('Expected the injected failure')
finally:
    ScaledMLP.forward = normal_forward
assert layer.mlp is original
assert [p.requires_grad for p in parameters] == flags

# Independent small examples: derivative, SGD update, accumulation.
s = torch.nn.Parameter(torch.tensor(1.0))
opt = torch.optim.SGD([s], lr=0.1)
loss = torch.nn.MSELoss()(2*s, torch.tensor(1.0))
loss.backward()
assert loss.item() == 1.0 and s.grad.item() == 4.0
opt.step()
assert abs(s.item() - 0.6) < 1e-6
s = torch.nn.Parameter(torch.tensor(1.0))
for expected_grad in (4.0, 8.0):
    ((2*s-1)**2).backward()
    assert s.grad.item() == expected_grad

report = dict(model=model_id, revision=revision, torch=torch.__version__,
              transformers=transformers.__version__, device=device,
              dtype=str(model.dtype), input_tokens=inputs['input_ids'].shape[1],
              final_scale=student.scale.item(), checks='passed', output=log.getvalue())
(ROOT / '.cache').mkdir(exist_ok=True)
(ROOT / '.cache/scale-verification.json').write_text(
    json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))

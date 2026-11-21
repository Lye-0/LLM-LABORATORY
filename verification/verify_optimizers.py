"""Verify the published comparison and Adam inspection with cached Qwen3."""
import contextlib
import io
import json
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
with contextlib.redirect_stdout(io.StringIO()):
    ns = runpy.run_path(str(ROOT / 'verification/verify_scale_training.py'))
recipes = ns['recipes']
torch = ns['torch']
log = io.StringIO()
with contextlib.redirect_stdout(log):
    exec(recipes['compare-optimizers'], ns)
assert ns['layer'].mlp is ns['original']
assert [p.requires_grad for p in ns['parameters']] == ns['flags']
assert [p._version for p in ns['parameters']] == ns['versions']
student = ns['student_mlp']
optimizer = ns['optimizer']
before = student.scale.item()
optimizer.zero_grad(set_to_none=True)
# One additional analytic loss checks the last-step update independently.
loss = (2 * student.scale - 1) ** 2
loss.backward()
optimizer.step()
with contextlib.redirect_stdout(log):
    exec(recipes['adam-state'], ns)
assert abs(before + ns['delta'] - student.scale.item()) < 1e-7
assert student.scale.grad is None
assert ns['state']['step'].item() == 61
assert torch.equal(ns['saved_m'], ns['state']['exp_avg'])
result = dict(checks='passed', model=ns['model_id'], revision=ns['revision'],
              torch=torch.__version__, transformers=ns['transformers'].__version__,
              device=ns['device'], output=log.getvalue())
(ROOT / '.cache/optimizer-verification.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(log.getvalue())
print('Optimizer verification passed')

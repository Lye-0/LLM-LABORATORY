"""CPU-only educational causal language model: initialize, train, save, reload.

Run: python tiny-language-model.py
Requires PyTorch. No pretrained model, download, or GPU is used.
Outputs are written under .cache/tiny-language-model in the current directory.
"""
import json
import platform
import sys
from pathlib import Path

import torch
from torch import nn
import torch.nn.functional as F

torch.manual_seed(42)
torch.set_num_threads(1)

# A fixed character vocabulary, independent of validation text.
vocab = "abcdefghijklmnopqrstuvwxyz .\n"
char_to_id = {char: index for index, char in enumerate(vocab)}
train_text = "sun is red.\nsky is blue.\nmoon is white.\nred sun rises.\nblue sky shines.\n"
validation_text = "sun shines.\nmoon rises.\n"
config = {"vocab_size": len(vocab), "width": 32, "heads": 2, "context": 16}


class TinyCausalLM(nn.Module):
    def __init__(self, vocab_size, width, heads, context):
        super().__init__()
        self.token_embedding = nn.Embedding(vocab_size, width)
        self.position_embedding = nn.Embedding(context, width)
        layer = nn.TransformerEncoderLayer(
            d_model=width, nhead=heads, dim_feedforward=64,
            dropout=0.0, batch_first=True, norm_first=True,
        )
        self.layers = nn.TransformerEncoder(layer, num_layers=1, enable_nested_tensor=False)
        self.norm = nn.LayerNorm(width)
        self.lm_head = nn.Linear(width, vocab_size)

    def forward(self, ids):
        length = ids.shape[1]
        positions = torch.arange(length, device=ids.device)
        x = self.token_embedding(ids) + self.position_embedding(positions)
        # True means forbidden: a position cannot attend to future positions.
        mask = torch.triu(torch.ones(length, length, dtype=torch.bool, device=ids.device), diagonal=1)
        x = self.layers(x, mask=mask)
        return self.lm_head(self.norm(x))


def windows(text):
    ids = torch.tensor([char_to_id[char] for char in text], dtype=torch.long)
    context = config["context"]
    # Manual shift: input at t predicts the character at t+1.
    inputs = torch.stack([ids[i:i + context] for i in range(len(ids) - context)])
    labels = torch.stack([ids[i + 1:i + context + 1] for i in range(len(ids) - context)])
    return inputs, labels


def loss_for(model, inputs, labels):
    logits = model(inputs)
    return F.cross_entropy(logits.reshape(-1, config["vocab_size"]), labels.reshape(-1))


def evaluate(model, inputs, labels):
    model.eval()
    with torch.no_grad():
        return loss_for(model, inputs, labels).item()


destination = Path(".cache/tiny-language-model")
checkpoint = destination / "checkpoint.pt"
if "--reload-only" in sys.argv:
    saved = torch.load(checkpoint, map_location="cpu", weights_only=True)
    restored = TinyCausalLM(**saved["config"])
    restored.load_state_dict(saved["state_dict"])
    restored.eval()
    with torch.no_grad():
        equal = torch.equal(restored(saved["probe_ids"]), saved["probe_logits"])
    assert equal
    print("Separate-process reload: identical logits")
    sys.exit(0)

model = TinyCausalLM(**config).to("cpu")
train_ids, train_labels = windows(train_text)
val_ids, val_labels = windows(validation_text)
initial_train_loss = evaluate(model, train_ids, train_labels)
initial_val_loss = evaluate(model, val_ids, val_labels)
original_weight = model.token_embedding.weight.detach().clone()
optimizer = torch.optim.AdamW(model.parameters(), lr=0.01)
first_gradient_norm = None

for iteration in range(120):
    model.train()
    rows = torch.randint(len(train_ids), (16,))
    optimizer.zero_grad()
    loss = loss_for(model, train_ids[rows], train_labels[rows])
    loss.backward()
    if iteration == 0:
        first_gradient_norm = model.token_embedding.weight.grad.norm().item()
    optimizer.step()

trained_loss = evaluate(model, train_ids, train_labels)
validation_loss = evaluate(model, val_ids, val_labels)
weight_changed = not torch.equal(original_weight, model.token_embedding.weight)
assert weight_changed and first_gradient_norm > 0
assert trained_loss < initial_train_loss

# Check causality: changing the future must not change earlier logits.
model.eval()
with torch.no_grad():
    observed = model(train_ids[:1])
    changed_ids = train_ids[:1].clone()
    changed_ids[0, -1] = (changed_ids[0, -1] + 1) % len(vocab)
    causal_check = torch.allclose(observed[:, :-1], model(changed_ids)[:, :-1], atol=1e-6)
assert causal_check

destination.mkdir(parents=True, exist_ok=True)
torch.save({"config": config, "vocab": vocab, "state_dict": model.state_dict(),
            "probe_ids": train_ids[:1], "probe_logits": observed}, checkpoint)
saved = torch.load(checkpoint, map_location="cpu", weights_only=True)
assert saved["vocab"] == vocab
restored = TinyCausalLM(**saved["config"])
restored.load_state_dict(saved["state_dict"])
restored.eval()
with torch.no_grad():
    restored_logits = restored(train_ids[:1])
reload_equal = torch.equal(observed, restored_logits)
assert reload_equal

# Greedy generation; recompute the last context window, without a KV Cache.
generated = [char_to_id[char] for char in "sun "]
with torch.no_grad():
    for _ in range(32):
        ids = torch.tensor([generated[-config["context"]:]], dtype=torch.long)
        next_id = restored(ids)[0, -1].argmax().item()
        generated.append(next_id)
generated_text = "".join(vocab[token_id] for token_id in generated)

report = {
    "python": platform.python_version(), "torch": torch.__version__,
    "device": "cpu", "dtype": "float32", "seed": 42, "iterations": 120,
    "config": config, "inputShape": list(train_ids[:1].shape),
    "logitsShape": list(observed.shape), "trainLossBefore": initial_train_loss,
    "trainLossAfter": trained_loss, "validationLossBefore": initial_val_loss,
    "validationLossAfter": validation_loss, "firstGradientNorm": first_gradient_norm,
    "weightChanged": weight_changed, "causalCheck": bool(causal_check),
    "reloadEqual": reload_equal, "generatedText": generated_text,
}
(destination / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))

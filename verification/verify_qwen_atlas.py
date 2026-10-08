"""Check atlas observations against the pinned, locally cached Qwen model."""
import json
import os
from pathlib import Path
os.environ['HF_HUB_OFFLINE'] = '1'
import torch
import transformers
from transformers import AutoModelForCausalLM, AutoTokenizer
import transformers.models.qwen3.modeling_qwen3 as qwen

MODEL = 'Qwen/Qwen3-0.6B'
REVISION = 'c1899de289a04d12100db370d81485cdf75e47ca'
torch.set_num_threads(4)
tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION, local_files_only=True)
model = AutoModelForCausalLM.from_pretrained(MODEL, revision=REVISION, local_files_only=True,
    dtype=torch.bfloat16, device_map='cpu', attn_implementation='eager').eval()
inputs = tokenizer('こんにちは、今日はいい天気ですね', add_special_tokens=False, return_tensors='pt')
observed = {}
phase = 'prefill'
handles = []
def hook(name):
    def record(module, args, result):
        observed[f'{phase}:{name}'] = {'in': list(args[0].shape), 'out': list(result.shape)}
    return record
layer = model.model.layers[0]
for name, module in [('input-norm', layer.input_layernorm), ('post-norm', layer.post_attention_layernorm),
                     *[(n,getattr(layer.self_attn,n)) for n in ['q_proj','k_proj','v_proj','q_norm','k_norm','o_proj']],
                     *[(n,getattr(layer.mlp,n)) for n in ['gate_proj','up_proj','down_proj']]]:
    handles.append(module.register_forward_hook(hook(name)))
original = qwen.eager_attention_forward
def inspect_attention(module, query, key, value, attention_mask, scaling, dropout=0.0, **kwargs):
    output, weights = original(module, query, key, value, attention_mask, scaling, dropout, **kwargs)
    if module.layer_idx == 0:
        k = qwen.repeat_kv(key, module.num_key_value_groups)
        v = qwen.repeat_kv(value, module.num_key_value_groups)
        scores = query @ k.transpose(2, 3) * scaling
        masked = scores if attention_mask is None else scores + attention_mask
        p = masked.softmax(dim=-1, dtype=torch.float32).to(query.dtype)
        mixed = p @ v
        assert torch.equal(p, weights)
        assert torch.equal(mixed.transpose(1,2).contiguous(), output)
        observed[f'{phase}:attention'] = {n:list(t.shape) for n,t in
            [('q-rope',query),('k-cache',key),('v-cache',value),('k-gqa',k),('v-gqa',v),
             ('scores',scores),('softmax',p),('weighted-sum',mixed),('attention-transpose',output)]}
    return output, weights
qwen.eager_attention_forward = inspect_attention
try:
    with torch.no_grad():
        first = model(**inputs, use_cache=True, output_hidden_states=True)
        next_id = first.logits[:, -1].argmax(-1, keepdim=True)
        phase = 'cached-decode'
        cached = model(input_ids=next_id, attention_mask=torch.ones(1,8,dtype=torch.long),
                       past_key_values=first.past_key_values, use_cache=True)
        phase = 'no-cache'
        full = model(input_ids=torch.cat([inputs['input_ids'], next_id], dim=1), use_cache=False)
    assert observed['prefill:q_norm']['in'] == [1,7,16,128]
    assert observed['prefill:k_norm']['in'] == [1,7,8,128]
    assert observed['prefill:attention']['scores'] == [1,16,7,7]
    assert observed['cached-decode:attention']['scores'] == [1,16,1,8]
    assert observed['no-cache:attention']['scores'] == [1,16,8,8]
    assert observed['prefill:o_proj']['in'] == [1,7,2048]
    assert observed['prefill:down_proj']['in'] == [1,7,3072]
    assert all(list(x.shape)==[1,7,1024] for x in first.hidden_states)
    assert model.lm_head.weight.data_ptr() == model.model.embed_tokens.weight.data_ptr()
    delta = (cached.logits[:, -1].float() - full.logits[:, -1].float()).abs().max().item()
finally:
    qwen.eager_attention_forward = original
    for handle in handles: handle.remove()
record = {'verifiedAt':'2026-10-08','model':MODEL,'revision':REVISION,'transformers':transformers.__version__,
          'torch':torch.__version__,'device':'cpu','dtype':'bfloat16','attention':'eager',
          'observations':observed,'tiedWeights':True,'cachedVsFullMaxLogitDelta':delta,
          'scope':'Layer 0 hooks; eager Attention intermediate equality; prefill/cached decode/no cache shapes. No quality benchmark.'}
path = Path(__file__).resolve().parents[1] / 'tests/fixtures/qwen-atlas-reference.json'
path.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'verified': True, 'observations': len(observed), 'fixture': str(path), 'maxDelta':delta}))

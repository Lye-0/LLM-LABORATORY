import { motionSteps, type MotionStep } from './motion';

export const journeyGroups = [
  { id: 'input', no: '01', title: '文章からベクトルへ', first: 'text', color: 'var(--accent)' },
  { id: 'decoder', no: '02', title: 'Decoder Layerの内側', first: 'norm', color: 'var(--teal)' },
  {
    id: 'output',
    no: '03',
    title: '全層から語彙のスコアへ',
    first: 'layers',
    color: 'var(--violet)',
  },
  {
    id: 'generation',
    no: '04',
    title: '次のTokenと生成の続き',
    first: 'sampling',
    color: 'var(--amber)',
  },
] as const;
export type JourneyStep = Omit<MotionStep, 'kind' | 'chapter'> & {
  group: (typeof journeyGroups)[number]['id'];
  duration: number;
  short: string;
};
function step(
  id: string,
  short: string,
  group: JourneyStep['group'],
  overrides: Partial<JourneyStep> = {},
): JourneyStep {
  const base = motionSteps.find((s) => s.id === id) ?? motionSteps[0];
  return { ...base, id, short, group, duration: 8000, ...overrides };
}
export const journeySteps: JourneyStep[] = [
  step('text', '文章', 'input', { duration: 3500 }),
  step('tokenize', 'Tokenに分割', 'input', { duration: 10000 }),
  step('ids', 'IDを割り当てる', 'input'),
  step('embedding', 'Embedding', 'input', {
    duration: 12000,
    action:
      '横のToken列を縦へ並べ、各IDのベクトルを取り出します。この7行を、そのまま次の計算へ渡します。',
  }),
  step('norm', 'RMSNorm', 'decoder', {
    code: 'residual = hidden\nnormalized = layer.input_layernorm(hidden)',
    action:
      '入力をResidual ①用に保存。同じ行列をその場所で正規化します。ここからは表示した3成分を全幅とする、小さな説明用モデルです。',
  }),
  step('qkv', 'Q・K・V', 'decoder', {
    duration: 12000,
    action:
      '同じ正規化済みの入力に、別々の重みを掛けます。Qは探す条件、Kは照合する特徴、Vは渡す情報。元の入力はResidual用に残ります。',
  }),
  step('heads', 'Head・Q/K Norm', 'decoder', {
    code: 'q = q.view(B, Tq, 16, 128)\nk = k.view(B, Tq, 8, 128)\nq = layer.self_attn.q_norm(q).transpose(1, 2)\nk = layer.self_attn.k_norm(k).transpose(1, 2)\nv = v.view(B, Tq, 8, 128).transpose(1, 2)',
    action:
      'Q/K/Vは同じ位置に保持。実モデルではHead軸へ分け、QとKだけにHead内のRMSNormを適用します。説明モデルはQ 2 Heads・共有KV 1 Head、各3成分です。',
  }),
  step('rope', 'RoPE', 'decoder', {
    duration: 8500,
    action:
      '同じQ・Kの成分ペアを位置に応じて回転します。Vは回転せず、そのまま次の合流まで保持します。',
  }),
  step('transpose', 'Kを転置', 'decoder', {
    title: '使っていたKの、行と列を入れ替える',
    name: 'K transpose',
    input: 'K [B,H,Tkv,d]',
    output: 'Kᵀ [B,H,d,Tkv]',
    formula: 'Kᵀ[j,i] = K[i,j]',
    code: 'k_for_q = repeat_kv(k, 2)  # 実モデルのGQAの対応\nkt = k_for_q.transpose(-2, -1)',
    node: 'scores',
    lesson: 'attention',
    action: 'Kの各数値を[i,j]から[j,i]へ移動。同じKを使い、Qの行とKᵀの列を掛けられる形にします。',
  }),
  step('scores', 'Q × Kᵀ', 'decoder', { duration: 9500, code: 'scores = q @ kt / (128 ** 0.5)' }),
  step('mask', 'Causal mask', 'decoder'),
  step('softmax', 'Softmax', 'decoder'),
  step('weighted', '割合 × V', 'decoder', {
    duration: 8500,
    action:
      '今できた参照割合と、待機していたVが合流します。割合の1行でVの各行を重み付けし、新しい情報を作ります。',
  }),
  step('concat', 'Headを連結', 'decoder', {
    title: '各Headの結果を、そのまま連結する',
    name: 'Head concatenation',
    input: '[B,16,Tq,128]',
    output: 'joined [B,Tq,2048]',
    formula: '16 Heads × 128成分 → 2048成分',
    code: 'joined = head_output.transpose(1, 2).reshape(B, Tq, 2048)',
    node: 'head-merge',
    action:
      '集めたVの情報をそのまま保持し、Headを連結。説明モデルでは2 Headの3成分ずつを連結して6成分にします。実モデルでは16×128を2048成分へ連結します。',
  }),
  step('o-proj', 'o_proj', 'decoder', {
    title: 'Attentionの結果を、残差に足せる幅へ',
    name: 'Output projection · o_proj',
    purpose: '集めた特徴を組み合わせ、hidden stateの幅へ戻す。',
    action:
      '直前の出力へo_projの重みを掛けます。完成した行列は、次のResidual ①へそのまま移動します。',
    input: 'Head連結後 [B,Tq,2048]',
    output: 'Attention出力 [B,Tq,1024]',
    formula: 'A = joined Wₒᵀ',
    code: 'attention_output = layer.self_attn.o_proj(joined)',
    node: 'o-proj',
    lesson: 'attention',
  }),
  step('residual-attn', 'Residual ①', 'decoder'),
  step('post-norm', 'RMSNorm', 'decoder', {
    title: '更新したhidden stateを、MLPへ渡す',
    name: 'Post-attention RMSNorm',
    purpose: 'MLPが受け取る特徴の尺度を整える。',
    action: 'Residual ①の結果をResidual ②用に保存。同じ行列を正規化し、そのままgate/upへ渡します。',
    input: 'H₁ [B,Tq,1024]',
    output: 'X [B,Tq,1024]',
    formula: 'X = RMSNorm(H₁)',
    code: 'residual_after_attention = hidden\nx = layer.post_attention_layernorm(hidden)',
    node: 'post-norm',
    lesson: 'transformer-block',
  }),
  step('gate', 'gate・up', 'decoder', {
    duration: 12000,
    formula: 'gate = XWgᵀ\nup = XWuᵀ',
    code: 'gate = layer.mlp.gate_proj(x)\nup = layer.mlp.up_proj(x)',
  }),
  step('silu', 'SiLU', 'decoder'),
  step('multiply', '要素ごとの積', 'decoder'),
  step('down', 'down_proj', 'decoder', {
    title: '広げた特徴を、hidden stateの幅へ戻す',
    name: 'Down projection',
    formula: 'Mout = M Wdᵀ',
    code: 'mlp_output = layer.mlp.down_proj(mixed)',
    input: 'mixed [B,Tq,3072]',
    output: 'MLP出力 [B,Tq,1024]',
    node: 'down-proj',
    action: '直前の要素積を入力に、down_projの重みを掛けます。Residualの加算は、次に行います。',
  }),
  step('residual-mlp', 'Residual ②', 'decoder', {
    title: '保存した経路へ、MLPの結果を加える',
    name: 'Residual connection ②',
    purpose: 'MLPの変換を内部表現へ反映する。',
    action: 'MLPに入る前に残したH₁と、今できたdown出力を、同じ位置・成分で足します。',
    input: 'H₁ と MLP出力',
    output: '次の層へ渡すhidden [B,Tq,1024]',
    formula: 'H₂ = H₁ + Mout',
    code: 'hidden = residual_after_attention + mlp_output',
    node: 'residual-mlp',
    lesson: 'transformer-block',
  }),
  step('layers', '次の層へ ×27', 'output', {
    duration: 32000,
    code: 'for layer in model.model.layers[1:]:\n    hidden = layer(hidden, ...)  # 残り27層。mask・位置情報等も渡す',
    action:
      '今できたLayer 0の出力が、そのままLayer 1の入力になります。同じ行列にLayer 1〜27の変換を重ねます。途中の値も同じ小さなモデルで計算しています。',
  }),
  step('final', 'Final RMSNorm', 'output'),
  step('logits', 'LM head', 'output', {
    code: 'logits = model.lm_head(final_hidden)',
    action:
      '最終hidden stateへLM headの重みを掛け、語彙ごとのスコアへ変換します。小さな例は3候補です。最後の行が次のTokenの予測に使われます。',
  }),
  step('sampling', '次のIDを選ぶ', 'generation', {
    code: 'next_logits = logits[:, -1, :]\nprobs = torch.softmax(next_logits, dim=-1)\nnext_id = next_logits.argmax(-1, keepdim=True)\n# Samplingなら torch.multinomial(probs, 1)',
    action:
      '最後の行のlogitsを確率へ変換して比較。ここではGreedyで最大スコアのIDを選び、次へ渡します。Samplingは同じ確率から抽選する別の選び方です。',
  }),
  step('append', '生成列へ追加', 'generation', {
    code: 'generated_ids = torch.cat([generated_ids, next_id], dim=1)',
    action:
      'いま選んだIDを、最初から保持していたID列の末尾へ加えます。この時点ではKV Cacheはまだ増えません。',
  }),
  step('cache', 'KV Cacheで続ける', 'generation', {
    duration: 9500,
    action:
      '追加したIDを次のForwardへ渡すと、各層で新しい位置のK/Vだけを追加します。保持した過去のK/Vは再計算せず、新しいQから参照します。',
  }),
  step('decode', '文字列へ戻す', 'generation', {
    title: '生成したID列を、文字列へ戻す',
    name: 'Tokenizer decode',
    purpose: '生成結果を読める文章として表示する。',
    action:
      'ここでは1 Tokenで区切ります。実際には終了条件まで同じループを繰り返し、完成したID列をdecodeします。',
    input: '生成ID列',
    output: '表示する文章',
    formula: 'text = decode(generated_ids)',
    code: 'text = tokenizer.decode(generated_ids[0], skip_special_tokens=True)',
    node: 'decode',
    lesson: 'kv-cache',
  }),
];
// Whole output rows are computed as batches, with time to read each batch.
for (const s of journeySteps) {
  if (['weighted', 'o-proj', 'down', 'logits'].includes(s.id)) s.duration = 12000;
  if (['qkv', 'gate'].includes(s.id)) s.duration = 14000;
}
export const journeyStarts = journeySteps.reduce<number[]>(
  (a, _s, i) => [...a, (a[i - 1] ?? 0) + (i ? journeySteps[i - 1].duration : 0)],
  [],
);
export const journeyDuration = journeyStarts.at(-1)! + journeySteps.at(-1)!.duration;
export function journeyIndex(id: string | null) {
  return Math.max(
    0,
    journeySteps.findIndex((s) => s.id === (id === 'linear' ? 'qkv' : id)),
  );
}
export function journeyAt(time: number) {
  const t = Number.isFinite(time) ? Math.max(0, Math.min(journeyDuration, time)) : 0;
  const index = Math.max(
    0,
    journeyStarts.findLastIndex((start) => start <= t),
  );
  return {
    index,
    progress: Math.min(1, (t - journeyStarts[index]) / journeySteps[index].duration),
    time: t,
  };
}

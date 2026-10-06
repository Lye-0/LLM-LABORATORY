import type { MapStep } from './maps';

/** Always-visible labels; full code and measurements remain in maps.ts. */
const captions: Record<string, Record<string, [string, string]>> = {
  tiny: {
    data: ['windows', '文字IDと次の正解を用意'],
    create: ['TinyCausalLM', '部品を組み、重みを初期化'],
    forward: ['forward', '過去の文字から次を予測'],
    update: ['loss → backward → step', '120回、重みを更新する'],
    save: ['torch.save / load_state_dict', '保存した値を読み直す'],
    generate: ['argmax → IDを追加', '次の文字を32回選ぶ'],
  },
  inference: {
    ids: ['Tokenizer', '分割して、語彙表のIDへ'],
    embedding: ['Embedding', '各IDに対応する行を引く'],
    context: ['Decoder Layers ×28', '過去の位置から情報を集める'],
    logits: ['LM head', '語彙候補のスコアを作る'],
    choose: ['greedy / sampling', '候補から次のIDを選ぶ'],
    loop: ['generate', 'IDを追加し、計算を繰り返す'],
    decode: ['Tokenizer.decode', 'IDの並びを表示用の文字へ'],
  },
  model: {
    embedding: ['embed_tokens', '重み表の行を取り出す'],
    layers: ['layers', '各層で表現を更新する'],
    norm: ['norm', '大きさを整える'],
    head: ['lm_head', '次トークン候補へ投影する'],
  },
  block: {
    norm1: ['input_layernorm', '元の入力r₁を残し、正規化'],
    attention: ['self_attn', '参照する位置の情報を集める'],
    add1: ['r₁ + Attention出力', '元の入力と要素ごとに足す'],
    norm2: ['post_attention_layernorm', '合流後の入力r₂を残す'],
    mlp: ['mlp', '広げて変換し、元の幅へ戻す'],
    add2: ['r₂ + MLP出力', '合流した表現を次の層へ'],
  },
  attention: {
    qkv: ['q_proj / k_proj / v_proj', '同じ入力から3本の枝を作る'],
    rope: ['Q/K Norm + RoPE', '位置情報を比較に反映する'],
    mix: ['mask → softmax → 加重和', 'Vを集めて出力投影する'],
  },
  creation: {
    data: ['データ準備', '学習用と評価用に分ける'],
    tokenizer: ['Tokenizer + batch', '文章をIDと正解の並びへ'],
    initialize: ['モデルクラス + config', '部品を組み、重みを初期化'],
    train: ['学習ループ', '予測のずれから重みを更新'],
    evaluate: ['未使用データで評価', '学習外の入力でも確かめる'],
    save: ['保存 → 再読込', '成果物から推論を再現する'],
  },
  update: {
    forward: ['forward', '現在の重みで予測する'],
    loss: ['cross_entropy', '予測と正解のずれを測る'],
    backward: ['loss.backward', '重みに対する勾配を求める'],
    step: ['optimizer.step', '勾配を使って重みを更新'],
  },
  start: {
    scratch: ['新しい初期重み', '構造を作るところから始める'],
    finetune: ['学習済みの重み', '既存の能力から追加学習'],
    lora: ['基盤 + adapter', '小さな更新行列を学習する'],
  },
  change: {
    generation: ['候補選択', '選び方と停止条件を変える'],
    embedding: ['入力Embedding / LM head', '特定IDの重みの行を変える'],
    vocab: ['Tokenizer + Embedding', '対応するIDと行数をそろえる'],
    lora: ['Linearに追加する経路', '低rankの更新行列を学習'],
    quantize: ['重みの保存・計算形式', '少ないビットの近似表現へ'],
    replace: ['Decoder Layer内の部品', '計算経路を置換・無効化する'],
  },
  compare: {
    baseline: ['条件を固定', '元の状態と結果を残す'],
    compare: ['同じ入力で比較', '品質・速度・メモリを見る'],
    restore: ['再読込 / 復元', '結果を再現し、元にも戻す'],
  },
  runtime: {
    files: ['モデルID + revision', '設定・数値・分割ルールを用意'],
    objects: ['from_pretrained', '資産をインスタンスへ読み込む'],
    tensor: ['Tokenizer / Tensor.to', '整数IDを実行先へ配置する'],
    execute: ['Transformers → PyTorch', '機器上でTensorを計算する'],
    save: ['save_pretrained', '数値・設定・Tokenizerを保存'],
    reload: ['構築 + 重みの読込', '保存した成果物から復元する'],
  },
};

export function mapPreview(sectionId: string, step: MapStep) {
  const [operation, meaning] = captions[sectionId]?.[step.id] ?? [step.title, '入力から出力へ'];
  function compact(value: string) {
    const lines = value.split('\n');
    const first = lines[0];
    const shapes = value.match(/\[(?:[\dBTDV]+(?:,\s*[\dBTDV]+)*)\]/g);
    const shape = shapes?.at(-1)?.replaceAll(' ', '');
    const label = first.replace(/\[[^\]]+\].*$/, '').trim();
    return shape ? `${label} ${shape}` : first;
  }
  const inferenceData: Record<string, [string, string]> = {
    ids: ['例文の文字列', '整数ID [1,7]'],
    embedding: ['整数ID [1,7]', 'ベクトル [1,7,1024]'],
    context: ['ベクトル [1,7,1024]', '文脈表現 [1,7,1024]'],
    logits: ['文脈表現 [1,7,1024]', 'logits [1,7,151936]'],
    choose: ['最後のスコア [1,151936]', '次のID [1,1]'],
    loop: ['元のID列 ＋ 次のID', 'ID列を1個ずつ延長'],
    decode: ['新しく生成したID列', '表示用の文字列'],
  };
  const otherData: Record<string, Record<string, [string, string]>> = {
    model: {
      embedding: ['整数ID [B,T]', 'ベクトル [B,T,1024]'],
      layers: ['ベクトル [B,T,1024]', '内部表現 [B,T,1024]'],
      norm: ['内部表現 [B,T,1024]', '正規化した表現 [B,T,1024]'],
      head: ['内部表現 [B,T,1024]', 'logits [B,T,151936]'],
    },
    change: {
      generation: ['候補のスコアと設定', '次のID・終了条件'],
      embedding: ['特定IDの重み', '入力ベクトル・出力スコア'],
      vocab: ['語彙表・モデルの行数', '追加ID・対応する行'],
      lora: ['元のLinearの重み', '元の経路 ＋ 更新の経路'],
      quantize: ['浮動小数の重み', '量子化した表現'],
      replace: ['元の部品・入出力の仕様', '変更した計算経路'],
    },
    runtime: {
      files: ['モデルID・固定revision', '配布資産・モデルクラス'],
      objects: ['設定・重み・Tokenizer資産', 'model・tokenizerの実物'],
      tensor: ['文章・Tokenizer・device', '整数IDのTensor'],
      execute: ['Tensor・モデルの重み', '活性値・logits・生成ID'],
      save: ['モデル・Tokenizer・実装', '保存したファイル'],
      reload: ['保存ファイル・構造の実装', '復元したモデル'],
    },
  };
  const [input, output] = (sectionId === 'inference'
    ? inferenceData[step.id]
    : otherData[sectionId]?.[step.id]) ?? [compact(step.input), compact(step.output)];
  return { operation, meaning, input, output };
}

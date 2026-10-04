export const projects = [
  {
    slug: 'observe',
    number: '01',
    title: 'モデルの内部を観察する',
    description: '変えずに見ることから始める。moduleの構造と、入力が通るshapeを記録します。',
    level: '観察',
    lessons: ['qwen', 'model-editing'],
    goal: '入力Embedding・Attention・MLP・出力層の役割とshapeを説明できる。',
    steps: [
      [
        '基準のモデルを用意する',
        'モデルID・revision・dtype・deviceを記録します。読み込みと生成が成功する状態をbaselineにします。',
      ],
      [
        '名前とshapeを列挙する',
        'named_modulesとnamed_parametersで観察する層を選びます。全重みの数値をprintせず、名前・shape・要素数を表へまとめます。',
      ],
      [
        '小さな入力を通す',
        'forward hookを一つだけ付け、同じ入力で入出力shapeを記録します。終わったらhookをremoveします。',
      ],
      [
        '全体図へ対応させる',
        '得られたshapeを[B,T]、[B,T,D]、[B,T,V]へ対応づけ、数値の所有者と意味を説明します。',
      ],
    ],
    checks: [
      '観察したモデルと依存版を記録した',
      'hookを外して元の挙動を維持した',
      'QとKVのhead数を区別した',
    ],
    code: 'for name, parameter in model.named_parameters():\n    print(name, tuple(parameter.shape), parameter.dtype)\n\nembedding = model.get_input_embeddings()\nprint(embedding.weight.shape)',
  },
  {
    slug: 'edit-embedding',
    number: '02',
    title: 'Embeddingの一部を変更する',
    description: '一つの行を変え、出力への影響を比較する。保存して戻せる小さな改造です。',
    level: '重みの変更',
    lessons: ['embedding', 'evaluation'],
    goal: '変更箇所を限定し、重み共有を考慮して影響と復元を確かめる。',
    steps: [
      [
        '変更前を記録する',
        '固定した入力でlogitsとgreedy生成を記録します。変更対象のIDを含む入力と、含まない入力を用意します。',
      ],
      [
        '対象の行を保存する',
        'get_input_embeddings().weightの1行をdetach().clone()で保存します。入力Embeddingとlm_headの重み共有を確認します。',
      ],
      [
        '小さな変更を加える',
        'no_gradの範囲で対象行の成分を変更します。直接書き換えと学習を区別し、変更量を記録します。',
      ],
      [
        '比較し、元へ戻す',
        '同条件のlogits・生成を比較します。共有された出力層へも影響し得るため、入力にIDがないケースも観察します。保存した行をcopy_で戻し、baselineとの差を確認します。',
      ],
    ],
    checks: [
      '対象IDと変更量を記録した',
      '変更前後で同じ入力と生成条件を使った',
      '復元後に元の値へ戻ることを確認した',
    ],
    code: 'weight = model.get_input_embeddings().weight\ntoken_id = tokenizer.encode("こんにちは", add_special_tokens=False)[0]\noriginal = weight[token_id].detach().clone()\ntry:\n    with torch.no_grad():\n        weight[token_id].mul_(0.5)\n    # 同じ入力でlogits・生成・評価を記録する\nfinally:\n    with torch.no_grad():\n        weight[token_id].copy_(original)',
  },
  {
    slug: 'adapt-lora',
    number: '03',
    title: 'LoRAで小さく適応させる',
    description: '学習対象の層とrankを決め、更新するパラメータと評価の変化を観察します。',
    level: '学習',
    lessons: ['lora', 'data-evaluation', 'loss'],
    goal: '更新範囲を特定し、未使用データで適応の効果を評価する。',
    steps: [
      [
        'データを分ける',
        '小さなtrainとvalidationを準備し、同じ内容が両方へ漏れないようにします。会話テンプレートとloss maskを固定します。',
      ],
      [
        '対象層とrankを選ぶ',
        'まずq_proj・v_projなど少数の対象から始めます。rankを変える前に、学習対象の数をprint_trainable_parametersで記録します。',
      ],
      [
        '短い学習を実行する',
        'lossの推移、実際にgradが付く重み、optimizer対象を確認します。学習率などを一度に複数変更しません。',
      ],
      [
        'adapterを再読み込みする',
        '基盤モデルとrevisionを記録してadapterを保存します。新しいプロセスへ読み込み、validationと元の能力の小評価を比較します。',
      ],
    ],
    checks: [
      'trainとvalidationの由来を分離した',
      '更新パラメータ数とrankを記録した',
      'adapterと基盤モデルの組で復元した',
    ],
    code: 'from peft import LoraConfig, get_peft_model\nconfig = LoraConfig(r=8, lora_alpha=16,\n    target_modules=["q_proj", "v_proj"], task_type="CAUSAL_LM")\nadapted = get_peft_model(model, config)\nadapted.print_trainable_parameters()\n# 学習・validationのあと、別の保存先へ\nadapted.save_pretrained("./adapter")',
  },
  {
    slug: 'compare-quantization',
    number: '04',
    title: '量子化の得失を測る',
    description: '小さいこと、速いこと、品質を保つこと。三つを別々に測定します。',
    level: '圧縮',
    lessons: ['quantization', 'evaluation', 'inference-memory'],
    goal: 'bit幅と実測の品質・速度・メモリの関係を説明できる。',
    steps: [
      [
        '数列で誤差を見る',
        'Quantization Labでbit幅と外れ値を変え、復元値とMSEを記録します。scaleを含む実形式と単純例を区別します。',
      ],
      [
        '対応する実装を選ぶ',
        '使うGPU・PyTorch・量子化ライブラリの対応を確認します。保存dtypeと計算dtypeを記録し、対象外の層も列挙します。',
      ],
      [
        '同条件で測定する',
        '同じ評価入力と生成設定を使い、warmup後の時間とpeak memoryを複数回測ります。EOSによる実生成長の差も記録します。',
      ],
      [
        '結果を表にする',
        '品質、容量、速度のどれが変わったかを分け、改善しなかった条件も残します。理論容量を実測VRAMとして報告しません。',
      ],
    ],
    checks: [
      '理論量と実測量を分けた',
      '同じデータ・生成条件で比較した',
      '誤差と対象タスクの品質を両方確認した',
    ],
    code: 'report = {\n    "format": "選んだ方式",\n    "weight_bits": 4,\n    "compute_dtype": "実際の設定",\n    "model_revision": "固定したrevision",\n    "quality": None,  # 評価後に実測を記録\n    "peak_memory_bytes": None,\n    "generated_tokens": None,\n    "elapsed_seconds": None,\n}',
  },
  {
    slug: 'ablate-layer',
    number: '05',
    title: '層を置換し、役割を調べる',
    description: '同じshapeの境界で一部を無効化し、モデル全体への影響を調べます。',
    level: '構造の変更',
    lessons: ['transformer-block', 'model-editing', 'evaluation'],
    goal: '実行の整合性と品質の変化を分け、ablationの限界を説明する。',
    steps: [
      [
        '置換できる境界を選ぶ',
        '小モデルのMLPなど、入力と出力が同じshapeの境界を選びます。Attention全体をIdentityへ置換すると戻り値形式が違う場合があります。',
      ],
      [
        '元のmoduleを保持する',
        '対象moduleを保存し、同じdevice・dtypeの置換を行います。モデルクラスとmodule名を確認してから操作します。',
      ],
      [
        'shapeと数値を確認する',
        'forwardを一度実行し、shape、NaN、実行エラーを点検します。その後、固定した評価を実行します。',
      ],
      [
        '元へ戻して再測定する',
        'moduleを戻してbaselineを再確認します。一つの層を外した結果だけで、層が常に不要だとは結論づけません。',
      ],
    ],
    checks: [
      '置換先の入出力形式を確認した',
      '一度に一箇所だけ変更した',
      '元のmoduleへ復元して確認した',
    ],
    code: 'from torch import nn\n# Qwenのmodule構造を確認してから実行\nblock = model.model.layers[0]\noriginal_mlp = block.mlp\ntry:\n    block.mlp = nn.Identity()\n    # shape・logits・固定評価セットを確認する\nfinally:\n    block.mlp = original_mlp',
  },
  {
    slug: 'independent-study',
    number: '06',
    title: '自分の改造実験を設計する',
    description: '仮説から評価・保存・再現まで、一つの研究としてまとめます。',
    level: '総合',
    lessons: ['evaluation', 'model-editing', 'save-model'],
    goal: '第三者が条件と結果を追える、再現可能な改造実験を完成させる。',
    steps: [
      [
        '仮説を書く',
        '変更箇所、期待する効果、悪化し得る指標を一文で明示します。何をもって結果を判断するかを先に決めます。',
      ],
      [
        'baselineと条件を固定する',
        'モデル・コード・データのrevision、実行環境、seed、評価条件を記録します。元の状態を復元可能にします。',
      ],
      [
        '最小の変更を試す',
        '一つの変更から始め、shapeと数値の健全性を確認した後に性能を比較します。差が出た理由と別の仮説を分けて記録します。',
      ],
      [
        '保存して他のプロセスで再現する',
        'モデル構造、重み、Tokenizer、依存条件を保存します。再読込後の出力と評価を照合し、結果と限界をまとめます。',
      ],
    ],
    checks: [
      '期待する結果と評価方法を事前に書いた',
      '未使用データで検証した',
      '別プロセスの再読込で再現した',
      '改善しなかった点と限界も記録した',
    ],
    code: 'experiment = {\n    "hypothesis": "何を変えると、何がどう変わるか",\n    "baseline": "モデルとコードの固定版",\n    "change": "一つの変更箇所",\n    "evaluation": "データ・指標・測定条件",\n    "result": "実測結果",\n    "limitations": "確認していない条件",\n    "reproduction": "再実行と復元の手順",\n}',
  },
];

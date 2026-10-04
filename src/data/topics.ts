export const topics = [
  {
    slug: 'runtime',
    title: '実行基盤の役割',
    summary: 'Transformers・PyTorch・Accelerate・CUDAを重ねて読む。',
    sections: [
      [
        'モデル実装と計算基盤',
        'TransformersはモデルやTokenizerを読み込み、共通のAPIで扱う入口です。PyTorchはTensor、演算、自動微分、Moduleを提供します。CUDAは対応GPUでの計算を支える基盤です。',
      ],
      [
        '配置と実行',
        'Accelerateはデバイス配置や分散実行などを支援します。device_mapで複数の配置先を使う場合、モデル全体を単純な一つのdeviceとして扱えないことがあります。',
      ],
      [
        '確認する順序',
        'まずPythonの実体と依存版、次にCUDAの利用可否、その後モデルと入力のdeviceを確認します。高レベルのAPIのエラーを、どの層の問題かに分けて調べます。',
      ],
    ],
    lesson: 'environment',
    url: 'https://huggingface.co/docs/accelerate/index',
  },
  {
    slug: 'reproducibility',
    title: '再現性とGit',
    summary: 'コードだけでなく、依存・データ・モデルの版を記録する。',
    sections: [
      [
        '固定する対象',
        'Gitのcommit、uv.lock、モデルrevision、Tokenizer、評価データを組にして残します。mainやlatestは後から指すものが変わるため、実験の根拠としては固定版が必要です。',
      ],
      [
        '乱数と環境',
        'seedは重要ですが、それだけで異なるGPUや演算方式をまたぐ完全一致を保証しません。dtype、kernel、batch、実行順序も結果に影響します。',
      ],
      [
        '小さく記録する',
        'モデルの巨大重みや仮想環境をGitへ入れず、取得元・hash・設定・再実行コードを管理します。結果には測定条件と未確認の範囲を添えます。',
      ],
    ],
    lesson: 'evaluation',
    url: 'https://docs.pytorch.org/docs/stable/notes/randomness.html',
  },
  {
    slug: 'formats',
    title: 'モデルの保存形式',
    summary: 'safetensors、GGUF、adapter、configを区別する。',
    sections: [
      [
        '重みと構造',
        'safetensorsはTensorを保存する形式です。モデルを動かすには構造の実装とconfigも必要です。重みファイルだけで独自moduleのコードが復元されるわけではありません。',
      ],
      [
        'エンジンの対応',
        'GGUFは対応する推論エンジンで利用する形式です。形式を変換できることと、独自の演算・構造が実行できることは別に確認します。',
      ],
      [
        'Adapter',
        'LoRA adapterは基盤モデルと合わせて使う差分です。基盤モデルのrevision、適用対象、統合の有無を記録し、再読込テストを行います。',
      ],
    ],
    lesson: 'save-model',
    url: 'https://huggingface.co/docs/safetensors/index',
  },
  {
    slug: 'engines',
    title: '推論エンジンとツール',
    summary: 'Ollama、llama.cpp、vLLMが担当する範囲を見る。',
    sections: [
      [
        '使うための包装',
        'Ollamaはモデルの取得・管理・実行を扱いやすくする道具です。内部構造を直接変更するPyTorchの研究環境とは、触れる境界が異なります。',
      ],
      [
        '実行の最適化',
        'llama.cppやvLLMは、対応する構造やhardwareに対して推論を効率化します。cache管理、batch、量子化やカーネルの対応も実行条件になります。',
      ],
      [
        '移す前の確認',
        '改造したモデルを別エンジンへ移すなら、モデル構造、演算、重み形式、Tokenizerとtemplateの互換性を確認します。同じ名前の生成設定でも仕様が同じとは限りません。',
      ],
    ],
    lesson: 'inference-memory',
    url: 'https://docs.vllm.ai/en/latest/',
  },
  {
    slug: 'rag',
    title: 'RAGと検索用Embedding',
    summary: '検索することと、モデルの重みを更新することを分ける。',
    sections: [
      [
        '検索で文脈を補う',
        'RAGは外部資料を検索し、その内容をモデルの入力へ加える構成です。参照文書を追加する操作が、モデルの重みを学習で更新することと同じではありません。',
      ],
      [
        '二つのEmbedding',
        'LLM内部のtoken embeddingは各IDに対応するベクトルです。検索用の文章Embeddingは、文章を比較するための表現を作るモデルやpoolingなどを使います。単語の行を平均すれば常に最適というわけではありません。',
      ],
      [
        '何を評価するか',
        '検索の正確さ、資料の網羅性、入力へ収まる長さ、引用と回答の対応を分けて評価します。重みの改造と外部知識の追加で、解決したい問題を選び分けます。',
      ],
    ],
    lesson: 'embedding',
    url: 'https://www.sbert.net/',
  },
  {
    slug: 'tools-multimodal',
    title: 'Tool Useとマルチモーダル',
    summary: '境界トークンの存在と、モデルや外側の処理を区別する。',
    sections: [
      [
        'Tool Call',
        'モデルが出す呼び出し形式を、外側のプログラムが検証して実行し、結果を会話へ戻します。トークンを出しただけで、実行が完了するわけではありません。',
      ],
      [
        '画像の処理',
        '画像を扱うモデルには、画像エンコーダーや表現を言語側へつなぐ部品などが必要です。Tokenizerの語彙にimage_padがあることだけでは、画像理解能力を判断できません。',
      ],
      [
        '形式と能力',
        '入力template、特殊トークン、学習済みの能力、実行プログラムをそれぞれ確認します。文字列としての目印と数値の内部計算を混同しないことが出発点です。',
      ],
    ],
    lesson: 'chat-template',
    url: 'https://huggingface.co/docs/transformers/chat_templating_multimodal',
  },
  {
    slug: 'licenses',
    title: 'データとモデルの利用条件',
    summary: 'モデルカード、ライセンス、データの由来を一緒に読む。',
    sections: [
      [
        '配布物ごとに確認する',
        'コード、モデル重み、Tokenizer、データセットは同じライセンスとは限りません。配布元のLICENSEとモデルカード、データの条件を個別に確認します。',
      ],
      [
        '再配布の記録',
        '利用した名称・revision・配布元・条件を記録し、再配布するファイルには必要なライセンスや通知を添えます。非公開データを公開教材へそのままコピーしないようにします。',
      ],
      [
        '改造した成果物',
        '派生モデル、adapter、変換済み形式であっても、元の条件を確認します。利用条件は更新され得るので、配布時点の原典を参照します。',
      ],
    ],
    lesson: 'save-model',
    url: 'https://huggingface.co/docs/hub/model-cards',
  },
  {
    slug: 'profiling',
    title: '性能測定とProfiler',
    summary: '時間だけでなく、どの計算が資源を使うかを見る。',
    sections: [
      [
        '測定を分離する',
        '取得、読み込み、prefill、decodeを分けます。CPUのタイマーではCUDA同期を確認し、warmupと繰返し測定を行います。',
      ],
      [
        'Profilerで絞る',
        'まず遅い区間を特定し、演算の時間・shape・メモリを観察します。全イベントを収集すると測定自体のコストが大きくなるため、代表的な短い区間を選びます。',
      ],
      [
        '比較の条件',
        '同じ入力長・生成長・batch・device・dtypeをそろえます。高速化しても品質が落ちた場合は、別の得失として報告します。',
      ],
    ],
    lesson: 'inference-memory',
    url: 'https://docs.pytorch.org/tutorials/recipes/recipes/profiler_recipe.html',
  },
  {
    slug: 'research',
    title: 'この先の研究テーマ',
    summary: '蒸留・Pruning・MoE・分散・高速化へ進むための入口。',
    sections: [
      [
        '重みと構造を減らす',
        '蒸留は教師の出力などを利用して別モデルを学習させる方法、pruningは不要と判断した要素や構造を除く方法です。減らす対象と、復元・再学習・評価の方法を設計します。',
      ],
      [
        '計算を選ぶ・分散する',
        'MoEは入力に応じてexpertを選ぶ構造です。分散学習ではパラメータ・勾配・optimizer stateや計算を分けます。通信とメモリの交換関係が重要になります。',
      ],
      [
        '同じ計算を効率化する',
        'FlashAttentionやtorch.compileなどは、計算とデータ移動の実装を改善する方向です。対応条件と数値差を確認し、独自の改造を入れた場合も性能が維持できるかを測ります。',
      ],
    ],
    lesson: 'evaluation',
    url: 'https://docs.pytorch.org/tutorials/intermediate/torch_compile_tutorial.html',
  },
];

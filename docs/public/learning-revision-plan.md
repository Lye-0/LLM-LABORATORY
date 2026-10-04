# 基礎教材の補強計画

作成日・実施日: 2026-10-04。状態: 実装・検証済み。照合したサイトの基準コミット: `629e42d`。

## 実施結果

| 項目 | 結果 |
|---|---|
| Pythonの基礎 | Counterを2個使う例、selfと属性、参照と呼び出し、import・type・inspect・nn.Moduleの説明を追加 |
| Tokenizer | 作成直後の実測出力、選択・読込・再利用の流れ、設定表示の抜粋と全文、設定表と関連リンクを追加 |
| 文脈長とThinking | 固定revisionのモデルカードの32768と、Tokenizerの131072・configの40960を区別。Thinking本文とhidden stateの違いを補足 |
| Tensorとbatch | 1要素の3種類のshape、軸の挿入位置、squeezeの復元例を追加。batchの前提と出力を明示 |
| Embedding | Tensor入力の理由、呼べる実物へのリンク、gradの語義を追加。既存の数値例は維持 |
| WSL環境 | 接続先・拡張・interpreter・実行Pythonの確認手順と、Any表示の読み方を追加 |

Python 3.13.15・PyTorch 2.14.1+cu130・Transformers 5.18.0で、7教材のPythonコード例38件を実行して出力を照合した。環境依存のCUDA表示は実環境の利用可否に合わせて検証し、Tokenizerは固定revisionの既存キャッシュを使用した。Tokenizerの設定全文と、追加したshape表も照合済み。

型検査、Pages用の静的ビルド、178ページの配信ファイル検査を実施。ブラウザーで7教材のモバイル幅、Python・Tokenizerのデスクトップ表示、設定全文の展開、関連APIへの移動を確認した。ブラウザーのコンソールエラーはなかった。

以下は実施時に使った計画と完了条件を残したものである。

Tokenizer・Vocabulary・Tensor・Embeddingの学習過程を既存教材と照合した。中心となる仕組みや数値例はすでに掲載されている。一方、Pythonの構文を実際のライブラリへ結びつける説明と、結果を比較して読む例には補強の余地がある。

## 1. 優先して補強する範囲

| 順序 | 対象 | 現状 | 追加する内容 |
|---|---|---|---|
| 1 | `src/content/lessons/python-objects.mdx` | Counterの例と分類表はあるが、self・import・typeの読み方が短い | 同じクラスから2個の実物を作る例、引数と属性、属性参照と呼び出し、種類を調べる手順 |
| 2 | `src/content/lessons/tokenizer.mdx`、`chat-template.mdx` | from_pretrainedの返り値は説明済みだが、読み込みの流れと設定表示の読み取りが薄い | import→設定読込→実物→再利用の流れ、作成直後の出力、設定表示の要点と参照先 |
| 3 | `src/content/lessons/tensor.mdx`、`batch.mdx` | scalar・slice・unsqueezeはあるが、比較が別々の節やページに分散している | 同じ1要素を異なるshapeで持つ比較、軸の挿入位置とsqueezeの対応 |
| 4 | `src/content/lessons/embedding.mdx` | ID・weight・output、索引、shape、勾配、seedは説明済み | Tensorを入力にする理由、呼べるインスタンスへの短い橋渡し、gradの語義 |
| 5 | `src/content/lessons/environment.mdx` | WSLとinterpreterの違いは1段落で説明 | 実行環境と解析環境を確認する順序、WSL側の拡張、Any表示の読み方 |

UIの構成・デザインや実験機能を変更する計画ではない。既存の本文・表・コード例・関連リンクで補う。

## 2. Pythonでオブジェクトを読む

既存のCounterを使い、初学者が追える順番に拡張する。

1. `Counter(2)`を呼ぶと、作られた実物が初期化され、`self.value = value`で属性へ保存されることを追う。右側の引数と左側の属性を分ける。
2. 初期値の違うCounterを2個作り、片方の`increment()`だけで片方の状態が変わる結果を示す。`self`が呼び出した実物を受け取る慣例名であることを説明する。
3. `counter.value`、`counter.increment`、`counter.increment()`を比較する。メソッドの参照と実行、画面表示と返り値を分ける。Pythonではメソッドも属性として参照できるため、「ドットの後ろはすべてデータ」などの規則にしない。
4. `import`と`from ... import ...`は名前を利用可能にする記法であり、読み込む対象の種類を決めないと説明する。`torch`、`torch.nn`、`nn.Embedding`、`AutoTokenizer`を並べる。
5. `type(list)`と`type([1])`を比較してから、`type(torch.Tensor)`とTensorの実物へつなぐ。メタクラスの表示が常に`type`になるとは説明しない。
6. 必要に応じて`inspect.ismodule`、`inspect.isclass`、`isinstance`で確認する短い例を置く。`inspect.isfunction`は組み込み関数をすべて拾うわけではなく、`callable=True`も関数である証拠ではないことを添える。
7. Pythonのモジュールと、ニューラルネットワーク部品の基底クラス`nn.Module`を区別する。

`__str__`・`__repr__`は「printした表示は実物そのものではなく、クラスが用意した文字列表現」という補足にとどめる。デコレーターやメタクラスの詳説を、この単元の前提として増やさない。

完了条件: 読者が、`from torch import nn`と`nn.Embedding(...)`と`embedding(ids)`のそれぞれで、何を参照し、何を呼び、何が返るか説明できる。

## 3. Tokenizerの作成と設定を読む

### 作成の流れ

`import`で使える名前を用意する → モデルIDまたは保存先の設定を読む → 適切なTokenizerを選んで作る → 返された実物を変数で参照する → tokenize・encode・decodeで再利用する、という流れをコードに対応させる。

「インスタンスを受け取る」と「返り値を受け取る」は両立する。`tokenizer = AutoTokenizer`という参照の代入とは違う。毎回from_pretrainedを呼び直さず、作った実物を再利用する理由も示す。

模式的な内部処理は、実装コードと混同しないよう明記する。`AutoTokenizer(model_id)`や`Qwen2Tokenizer(model_id)`を、同等に動く代替コードとして掲載しない。実際のクラス名は、ライブラリの版と設定を添えた観察結果として扱う。

### コードの直後に結果を置く

現在の作成例は`type(tokenizer)`と`name_or_path`をprintしているが、対応する出力ブロックがない。参照環境で実行して、その場で結果を読めるようにする。

続けて`print(tokenizer)`の主要部分を示し、必要なら同じ節の折りたたみで省略のない表示を読めるようにする。

| 確認する設定 | 本文で説明すること | 詳細の参照先 |
|---|---|---|
| `name_or_path` | どこから読み込んだか | 読み込みAPI |
| `vocab_size`、`len(tokenizer)` | 基本語彙と追加分 | Vocabulary |
| `model_max_length` | Tokenizer側の長さ設定 | 会話形式・位置情報 |
| `padding_side`、`truncation_side` | 埋める側・切り詰める側 | バッチと入力整形 |
| EOS・PADの登録 | トークンに与えた役割 | 会話形式と特殊トークン |
| `added_tokens_decoder` | IDと追加トークンの設定 | 特殊・追加トークン一覧 |

長さの説明では、Tokenizerの`model_max_length`、モデルconfig、モデルカードの文脈長、`max_new_tokens`を同じ値として扱わない。参照データでは`model_max_length=131072`、`max_position_embeddings=40960`であり、異なる設定値が存在する。数値の掲載時は固定revisionのモデルカードも別途照合する。

会話形式のページでは、Thinking本文は通常の生成トークン列であり、ニューラルネットワーク内のhidden stateそのものではない、という対応を一文と関連リンクで補う。生成数に含まれる説明は既存のものを活用する。

完了条件: 読者が、設定を持つ実物のメソッドを呼ぶ意味と、表示された数値の担当範囲を説明できる。詳細ページとの説明重複を最小限にする。

## 4. Tensorの比較を近くへ置く

`torch.tensor(89015)`、`torch.tensor([89015])`、`torch.tensor([[89015]])`を同じ表で比較する。値・shape・ndim・numelを並べ、要素が1個でも軸は0本・1本・2本になり得ることを示す。既存のscalarとsliceのコードは活用する。

`unsqueeze(0)`と`unsqueeze(1)`を同じ入力から実行し、`[1, 7]`と`[7, 1]`の違いを出力で確認する。2次元入力では挿入位置が3か所ある例を短い表で補い、`squeeze(dim)`との対応へつなぐ。元のTensor、返り値、共有されるデータは区別する。

batchページでは、Tensor側の操作説明へリンクし、`[batch_size, sequence_length]`としての意味とpaddingを中心に据える。

完了条件: 読者がshape・ndim・numelを混同せず、新しい入力のshapeも予測できる。

## 5. Embeddingは短い補足に絞る

- `torch.tensor([2, 3])`は、Tensorインスタンスを並べたPythonリストではなく、IDを含む1個のTensorであることを明記する。
- 整数Tensorを入力とするAPIにより、複数ID・多次元入力・CPU/GPU上の計算を統一して扱えると説明する。整数IDそのものに勾配を付ける説明にしない。
- `embedding.weight`は重みの属性参照、`embedding(ids)`は呼び出しに対応した層の実行、と使用箇所で短く説明し、Python単元へリンクする。
- `grad`がgradient（勾配）の略であり、重みを少し変えた際の損失の変化に関わる量であることを、既存の学習手順の前へ加える。

索引の違い、入力と出力のshape、初期値とseed、Parameterとrequires_grad、取得と更新の違いはすでに説明されている。これらの章を再び大きく増やす必要はない。

完了条件: Embeddingの目的からコードを読め、既存の9つの実行例と数値・変数の状態が引き続き一致する。

## 6. WSLとエディターの確認手順

環境ページに短い確認手順を追加する。

1. VS CodeがWSLへ接続しているか、リモート接続表示で確認する。WSLターミナルが開けることだけで、エディター全体の接続先を断定しない。
2. Python/Pylanceなど必要な拡張が、対象のWSL側で使える状態か確認する。
3. 選択したinterpreterと、`sys.executable`で確認した実行Pythonを照合する。
4. ホバー表示がAnyでも、実行時の型が存在しないとは考えず、type・inspect・定義を確認する。

拡張は種類によって実行先が異なり、対象のWSL環境へ導入する場合がある。通常、起動のたびに導入し直す操作ではない。個人のPC名・絶対パス・画面ログをそのまま掲載せず、一般化した例にする。

完了条件: 「コードは動くが補完がおかしい」場合に、実行と解析の環境を分けて確認できる。

## 7. 今回は追加不要と判断した内容

| 内容 | 既存の掲載先と判断 |
|---|---|
| 基本語彙・追加語彙・モデル語彙の違い | Vocabularyに掲載済み |
| 内部表記と日本語の違い、byte-level BPE | Tokenizer・Vocabulary・BPEに掲載済み |
| IDの近さは意味の近さではない | Vocabulary・Embeddingに掲載済み |
| 生テキストと会話テンプレート、Added Tokenとspecialフラグ | 会話形式と特殊トークンに掲載済み |
| Thinkingの本文と生成数、specialフラグ | 会話形式・特殊トークン一覧に掲載済み。hidden stateとの違いだけ短く補う |
| Transformers・PyTorch・CUDA・Ollamaの役割 | 周辺技術に掲載済み。必要箇所からのリンクで補う |
| Gitの細かい使い方、個別PCの構築ログ | 今回のLLM基礎本文には追加しない |
| 本物のQwenの学習済みEmbeddingの数値 | 今回の会話では次の実験として提案された段階。未実施の数値を作らない |

## 8. 実施順と確認方法

第一段階はPythonの基礎とTokenizerの補強。第二段階はTensor・Embedding・環境ページの小さな補足と関連リンクの調整。既存のAPI辞書に同じ説明がある場合はリンクを優先し、今回のために全APIの収録範囲を広げない。

実装時は次を確認する。

- 純粋なPython例とPyTorchのCPU例を実行し、表示・返り値・型・shape・状態変化を照合する。
- Tokenizer例は固定revisionと参照環境の版を記録し、既存のオフライン配布データで検証する。モデル本体の取得はこの補強に必須ではない。
- 追加・変更したコード例が、それまでに定義した変数で実行できることを確認する。
- 型検査、静的ビルド、内部リンク検査を行う。本文が増えたページと折りたたみを、広い画面・狭い画面で確認する。
- 実装後にこの計画の各項目を完了・見送りへ更新する。

## 仕様を確認する資料

- [Python: Classes](https://docs.python.org/3/tutorial/classes.html) — インスタンス、属性、メソッド、self、初期化。
- [Python: inspect](https://docs.python.org/3/library/inspect.html) — モジュール・クラス・関数・組み込み関数の判定。
- [Transformers: Auto classes](https://huggingface.co/docs/transformers/model_doc/auto) — 設定に応じたクラス選択とfrom_pretrained。
- [PyTorch: Embedding](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Embedding.html) — 整数Tensor入力、shape、層固有の設定。
- [VS Code: Developing in WSL](https://code.visualstudio.com/docs/remote/wsl) — 接続先と拡張機能の実行場所。

初回の計画保存では実装を行わず、その後の修正依頼を受けて上記の範囲を実施した。

# 実装構成

## スタックと役割

Astroの静的生成、Reactの操作部品、MDXの教材で構成する。TypeScriptを使い、依存はpnpm、Node.jsとpnpmの版はmise.tomlで管理する。

文書主体のページをHTMLへ出力し、入力と結果が連動する箇所だけをhydrateするためにAstroを採用した。SSR・DB・認証を前提にしない。

| 場所                                 | 役割                                 |
| ------------------------------------ | ------------------------------------ |
| `src/content/lessons/`               | 29単元のMDX本文                      |
| `src/content.config.ts`              | 教材のメタデータschema               |
| `src/data/catalog.ts`                | 段階・実験・出典の情報               |
| `src/data/api.ts` / `api-groups.ts`  | API詳細とライブラリ・所有者の分類    |
| `src/data/glossary.ts`               | 用語と比較                           |
| `src/data/projects.ts` / `topics.ts` | 改造課題と周辺技術                   |
| `src/layouts/SiteLayout.astro`       | 共通表示、セクション別ナビ、テーマ   |
| `src/components/labs/`               | 操作実験のUI                         |
| `src/components/ui/Select.tsx`       | 共通の選択欄と候補一覧               |
| `src/lib/simulations.ts`             | UIから独立した数式・shapeの計算      |
| `src/lib/paths.ts`                   | 配信先baseの付与・除去               |
| `src/workers/tokenizer.ts`           | Tokenizerの実処理と語彙の検索        |
| `src/data/maps.ts` / `src/pages/learn/maps/` | まとめ6ページと小モデルの実行教材 |
| `src/components/maps/` / `src/styles/maps.css` | 地点選択・入出力・構造図の共通表示 |
| `public/data/qwen3/`                 | 固定revisionの語彙・設定・ライセンス |

## 実験の実行方式

TokenizerはHugging Faceの `@huggingface/tokenizers` で実行する。語彙・結合規則は同梱した資産から必要時に取得する。入力文章はサーバーへ送信しない。全語彙の検索とページ分割もWorkerで行う。

Tensor形状、小行列、Embeddingのlookup、確率、勾配、量子化は教育用のTypeScript計算。実際のCUDA転送やモデル学習と表示しない。

Chat Template Builderはsystemと1件のuserを扱う限定例。Model Inspectorは公式configと構造に基づく表示であり、重みや活性値を実測したビューではない。

## 図でつなぐまとめ

全体地図は静的HTML、詳細の地点選択はReactのFlowExplorerで表示する。データ定義はノードの入力・出力・コード・説明・注意・関連リンクを持ち、sequenceとbranchesで処理順と選択肢を区別する。選択地点をセクションIDのqueryへ保存し、直リンク・再読込から復元する。小画面で地点を選んだ際は対応する説明へ移動し、読み込み時の自動スクロールは行わない。

全ノードの説明は静的なdetailsにも出力し、JavaScriptが無効でも内容へ到達できる。ページは学ぶ内のナビと検索へ登録する。Qwenの構造値と学習済みEmbeddingの実測を、教育用小モデルの値から区別する。

小モデルの正本は `public/examples/tiny-language-model.py`。教材全文はraw importで同じファイルから表示する。実行結果は `tests/fixtures/tiny-language-model-reference.json` に条件とsource hashを残す。学習済みcheckpointは `.cache/` に置き、公開ビルドやGitへ含めない。

## 検索の索引

`src/pages/search-index.json.ts` が教材・API・用語・トークン・課題などの構造化索引を出力する。名前・ID・日本語別名の照合に加えて、Pagefindの本文検索を使う。Pagefindはbuild後半で生成するため、本文検索の確認にはbuild済みpreviewを使う。

## 配信パス

通常はルート配信。GitHub Pagesでは `SITE_BASE=/LLM-LABORATORY/` を指定する。内部リンク、検索結果、検索索引、Workerからの取得先に `withBase()` を使う。左ナビの現在位置は `withoutBase()` でセクション内のパスとして判定する。

絶対パスを新たに直書きすると、ルート配信では動いてもPagesで壊れることがある。新規ページ・資産・Workerを追加したらサブパスの検証も行う。

## 状態とDOMの所有者

テーマはlocalStorageに保存し、辞書の条件と検索語はURLから復元する。実験の入力条件を変えたら旧結果をクリアし、古いリクエストの結果が表示されないようにする。

コードコピーは静的なpreへ追加する。外側のスクリプトからReact island内へDOMを追加しない。Reactの描画と競合してhydrationが失敗するためである。

静的HTMLが表示された時点とhydrate完了は異なる。操作の自動検証は、必要に応じて `astro:hydrate` を待つ。

## 公開境界

静的サイトの配信対象は `dist/` のみ。開発ドキュメントをGitへ含めることと、Webサイトの教材として配信することは別の判断にする。

モデルの重み、個人の原文資料、環境ファイル、ローカルバックアップを公開ビルドへ入れない。公開モデルの設定と検証用の数値例は、出典と再現条件を持つ形で管理する。

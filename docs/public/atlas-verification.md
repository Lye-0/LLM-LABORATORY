# LLMの地図：構成と確認記録

2026-10-08。独立した `/maps/` と7種類の主題別地図を追加。

## 表示と内容

- 全体地図は114地点。主題別も同じ地点データを利用する。
- Q/K/Vの投影、head分割、Q/K Norm、転置、RoPE、cache、GQA、score、mask、softmax、V加重和、head結合、出力投影を常時表示。
- MLPのgate/up分岐、SiLU、要素積、down投影と2本のResidualを常時表示。
- 全28層は1層の詳細図と繰り返し表示で表す。各層の重みが別であること、最後のhidden stateは最終Norm後であることを明記。
- 生成と学習は共通forwardから分かれる経路。領域間の長い接続は名前付きリンクで表す。
- 旧6地図URLと旧クエリ指定は新地点へ移行。小モデル教材は学ぶに残す。
- JavaScriptなしでも地点・入出力・分岐の説明・補足を読める。検索とSVG経路描画のみ追加機能。

## 数値の根拠

モデル `Qwen/Qwen3-0.6B`、revision `c1899de289a04d12100db370d81485cdf75e47ca`。
Transformers 5.18.0、PyTorch 2.14.1、CPU、bfloat16、eager Attention。

`verification/verify_qwen_atlas.py` を、既存のキャッシュ済みモデルで実行。
記録は `tests/fixtures/qwen-atlas-reference.json`。

|観察|実測shape|
|---|---|
|q_norm入力|[1,7,16,128]|
|k_norm入力|[1,7,8,128]|
|prefillのscore|[1,16,7,7]|
|次の1トークン・cache使用|[1,16,1,8]|
|8トークン列・cacheなし|[1,16,8,8]|
|o_proj入力|[1,7,2048]|
|down_proj入力|[1,7,3072]|

Layer 0の各部品をhookで観察。eager Attention内の分解計算のsoftmax・加重和が実装の結果と一致することも確認。入力EmbeddingとLM headの重み共有を確認。既存の層境界・最終Norm検証は `verify_qwen_hidden_states.py` とそのfixtureを参照。

実測の範囲は固定例・固定環境。RAG、Tool Use、改造の一般経路、マルチモーダルの接続は概念説明であり、このテキストモデルの実測内部ではない。

## 画面・操作の検証

- 320 / 390 / 768 / 1280 / 1440pxで8地図のページ横はみ出しなし。
- 720pxの再配置も確認。これは1440pxから200%拡大した際のレイアウト幅に相当するが、OS・実ブラウザーの拡大操作全般を保証しない。
- 明暗テーマ、補足のモーダル／非モーダル切替、Escape、フォーカス復帰、再読込、履歴移動、検索、幅拡張を検証。
- SVG経路が関係のないノードを横切らないことを、通常・補足表示後・狭幅で検証。
- JavaScript無効時の分岐・本文・補足、印刷時の主要情報、reduced motion設定を確認。
- 地図内・教材への移動、上部と左メニューの所属、旧URL変換、静的リンク、検索索引を確認。

自動検証：Astro check、Vitest 23件、GitHub Pages用Playwright 13件、193ページの静的出力・リンク検査。画像による確認はQ/K/V、MLP、改造分岐、PC・スマートフォン、明暗・補足で実施。利用者自身による理解しやすさの評価は未実施。

## 保守

地点・接続は `src/data/atlas/`、描画と操作は `src/components/atlas/`、外観は `src/styles/atlas.css`。
地点IDを変更するときは旧クエリ互換、検索索引、関連教材の対応も同時に更新する。
図は通常のHTMLとCSS Gridを基盤とし、接続線は実寸から再描画する。フォント・文字量・幅を変更したときは経路の交差も再確認する。

# 開発・検証・公開

## 別の端末で開発を始める

リポジトリをcloneし、プロジェクトルートで実行する。ユーザー名や固定のホームディレクトリを前提にしない。

```sh
mise trust
mise install
pnpm install --frozen-lockfile
pnpm dev
```

固定バージョンは `mise.toml` と `package.json` を確認する。通常の開発URLは `http://127.0.0.1:4321/`。

## 変更箇所を選ぶ

- 教材：`src/content/lessons/*.mdx`。前提・実験・出典のIDも確認する。
- API：`src/data/api.ts`。所有者を追加する場合は `api-groups.ts` に分類を追加する。
- 操作実験：UIは `src/components/labs/`、計算は `src/lib/simulations.ts`。
- 選択欄：共通Selectを再利用し、候補を開いた状態も確認する。
- URL：内部パスにbase対応を付け、ルート配信とPagesの両方を確認する。

## 通常の検証

```sh
pnpm validate
pnpm exec playwright install chromium
pnpm test:e2e
```

validateは型検査、単体テスト、静的生成、内部リンクと配信境界の確認を行う。E2Eはbuild済みの配布物を検証する。計算の変更には手計算値・Python参照値・不変条件を使い、実装の式をそのままテストへ複写しない。

## GitHub Pagesのサブパスを確認する

PowerShell:

```powershell
$env:SITE_BASE = '/LLM-LABORATORY/'
pnpm build
node scripts/check-output.mjs
pnpm exec playwright test --config playwright.pages.config.ts
```

通常のルート配信へ戻す場合は、SITE_BASEを解除して再ビルドする。Astro previewが別の設定で起動したままなら、対象を確認して停止し、テストが指定する設定で起動する。

## 参照データを更新する

Qwenの語彙・設定は固定revisionを使い、`public/data/qwen3/manifest.json` に取得条件とhashを記録する。更新時は元のファイル一式とライセンスを確認し、`pnpm prepare:data` で表示用の追加トークン情報を再生成する。

Python参照検証はtorch・transformersのある環境で `python verification/verify_reference.py` を実行する。結果は `tests/fixtures/python-reference.json`。個人のログや環境の絶対パスをfixtureへ追加しない。

学習済みEmbeddingの参照検証は `python verification/verify_qwen_embedding.py`。固定revisionのQwen3-0.6Bが既存キャッシュに必要で、ダウンロードは行わない。CPU・bfloat16でモデルを読み、層の同一性、1トークンと7トークンの参照、shape、入力が変化しないことを確認する。数値・環境・モデル表示は `tests/fixtures/qwen-embedding-reference.json` に保存する。通常のCIにはモデル本体の取得を追加しない。

## 公開の流れ

`.github/workflows/pages.yml` はmainへのpushで実行する。miseによる環境準備、公開ファイル境界の確認、依存導入、検証・ビルド、distのアップロード、Pagesへの公開を順に行う。

ワークフローが成功したら、実URLでページ移動、Tokenizer、本文検索、検索結果のリンクを確認する。ブラウザー内の処理とネットワーク取得のどちらが失敗したかを分けて調べる。

## 確認済みの範囲

2026-10-04の実装時には、単体19件、通常画面のE2E20件、Pages用E2E4件、178ページの静的リンク検査を実施した。以後の変更ではその時点の実行結果を正とする。

CPUの小例とTokenizerは参照検証を行っている。GPUを使った改造課題の完走、すべての実機、実際のスクリーンリーダーでの通読、公開後のCore Web Vitalsは、この記録だけから確認済みと扱わない。

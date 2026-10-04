# LLM LABORATORY

LLMの入力から内部計算・生成・学習・改造までを、読む・動かす・調べる日本語の学習サイトです。

Astroの静的生成とReactの操作教材で構成しています。配布物は `dist/`。実行時のアプリケーションサーバー、データベース、APIキーは不要です。

## 起動

```sh
mise trust
mise install
pnpm install --frozen-lockfile
pnpm dev
```

通常は `http://127.0.0.1:4321/` で開きます。Node.js 24.19.0、pnpm 11.19.0を `mise.toml` で固定しています。

## 静的ビルド

```sh
pnpm build
pnpm preview
```

通常のビルドはルート配信です。`SITE_BASE=/LLM-LABORATORY/` を指定するとGitHub PagesのプロジェクトURL用に、リンク・検索・実験データの取得先を含めてビルドします。

Tokenizerデータは約11.5MB（非圧縮）で、該当実験の実行時だけ取得します。配信側でgzip/Brotliと通常の静的キャッシュを有効にすると取得量を抑えられます。モデル本体の重みは含みません。

## 内容

- 29単元の教材、9つの周辺技術ページ
- 12種類の操作実験
- ライブラリ・クラス・用途別のAPI辞書、用語集、比較ページ、26項目の特殊・追加トークン
- 6つのモデル改造課題
- 日本語・API名・IDの検索、明暗テーマ、セクション別ナビゲーション

## 検証

```sh
pnpm check
pnpm test
pnpm build
node scripts/check-output.mjs
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm validate` は型検査・単体テスト・静的ビルド・出力検査を順に実行します。E2Eはビルド済みの静的配布物をローカルプレビューで検証します。

Python側の参照検証は、torchとtransformersを導入した環境で次を実行します。モデルの重みの取得や、既存環境へのパッケージ変更は行いません。

```sh
python verification/verify_reference.py
```

CPUの参照値は `tests/fixtures/python-reference.json`。JavaScriptのTokenizer結果と全ケースを照合します。実モデル全体のGPU推論・学習課題を自動で実行するテストではありません。

## GitHub Pages

公開URL: https://lye-0.github.io/LLM-LABORATORY/

`main` へのpushで `.github/workflows/pages.yml` が動きます。miseでNode.js・pnpmを用意し、公開ファイルの境界、型、参照値、ビルドを検証した後、`dist/` だけをPagesへ配信します。Pagesの公開元は **GitHub Actions** です。

ローカルでプロジェクトURLの動作を確認する場合（PowerShell）:

```powershell
$env:SITE_BASE = '/LLM-LABORATORY/'
pnpm build
node scripts/check-output.mjs
pnpm exec playwright test --config playwright.pages.config.ts
```

通常のルート配信へ戻すには、環境変数SITE_BASEを解除して再ビルドしてください。

## 公開する範囲

`docs/` はローカルの計画・参照資料・確認記録用で、Git管理と静的配信の対象外です。`.private/` はローカルバックアップ専用です。CIが必要とする検証データには、公開モデルと数値例だけの `tests/fixtures/` を使います。

`.gitignore` は新しい追跡を防ぐ設定です。資料を誤ってコミットした場合、ignoreへの追加だけで過去の履歴が消えるわけではありません。公開前に `node scripts/check-public-files.mjs` と送信する履歴を確認します。

Qwenの配布データには [Apache-2.0のライセンス](public/data/qwen3/LICENSE) と [revision・hashのmanifest](public/data/qwen3/manifest.json) を同梱しています。

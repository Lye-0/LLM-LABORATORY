# 開発ドキュメント

LLM LABORATORYの設計・実装・教材編集・公開手順をまとめた、リポジトリ共有用の文書です。基準日は2026-10-04です。

| 文書                                    | 内容                                                   |
| --------------------------------------- | ------------------------------------------------------ |
| [プロダクト方針](product.md)            | 目的、情報構造、機能の境界                             |
| [カリキュラム](curriculum.md)           | 学習範囲、前提、到達目標                               |
| [教材の編集方針](content-guide.md)      | コード・結果・解説、例の根拠、辞書の掲載範囲           |
| [UIの設計方針](design.md)               | ナビゲーション、分類、選択欄、テーマ、アクセシビリティ |
| [実装構成](architecture.md)             | ソースの役割、データ、検索、Worker、URL                |
| [開発・検証・公開](development.md)      | 別端末での準備、テスト、GitHub Pages                   |
| [公開されている参考資料](references.md) | 公式仕様とモデルの配布元                               |
| [わかりやすい学習ノートのガイド](notion_learning_notes_guide.md) | 学習ノートの書き方と説明の組み立て方 |
| [基礎教材の補強計画](learning-revision-plan.md) | Python・Tokenizerを中心とする説明の補強計画と実施結果 |

実際の依存バージョンは `package.json`・`pnpm-lock.yaml`、Node.js・pnpmは `mise.toml` を正本とします。ファイルの構造や挙動を変えた場合、この文書群も必要な範囲で更新します。

この文書群は開発用です。Webサイトへ配信する教材は `src/content/lessons/`、静的配布物は `dist/` です。

`docs/public/` 配下の文書をGitで共有します。新規文書はこのフォルダへ置いて通常どおりGitに追加できます。それ以外のdocsはignore対象です。

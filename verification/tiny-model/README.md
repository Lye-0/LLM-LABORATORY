# 小型言語モデルのWindows CPU検証環境

`public/examples/tiny-language-model.py`用のPython・PyTorch環境。
Python 3.12.15は通常ユーザーのuv既定保存先を利用し、Codex配布ランタイムやCodex固有のLocalCacheには依存しない。
Python本体の専用コピーは作らず、依存パッケージは`.cache/tiny-model-venv-uv`に分離する。
CPU版PyTorch 2.14.1と依存関係をuv.lockで固定する。

リポジトリのルートで実行する。

```powershell
./verification/tiny-model/sync.ps1
& ./.cache/tiny-model-venv-uv/Scripts/python.exe -I -B ./public/examples/tiny-language-model.py
& ./.cache/tiny-model-venv-uv/Scripts/python.exe -I -B ./public/examples/tiny-language-model.py --reload-only
```

検証にはダウンロード済みの学習済みモデルやGPUは不要。
実行結果は`.cache/tiny-language-model`へ保存される。
既存の`tests/fixtures/tiny-language-model-reference.json`は過去の検証結果なので、環境更新だけを理由に版や数値を書き換えない。

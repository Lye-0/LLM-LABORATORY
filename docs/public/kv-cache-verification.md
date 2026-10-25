# 自己回帰生成・KV Cache教材の検証（2026-10-25）

## 反映範囲

- `kv-cache.mdx`：Prefill / cache付きDecode / 全列再計算のshape比較、QとMLPを保存しない理由、手動生成、cache内部の観察、参照共有と生成列への再代入の違い。
- `inference-memory.mdx`：warmup・反復・同期を含む比較コード、CUDA Eventの読み方、計算量と経過時間の区別。
- 全体地図：K/V cacheとcache付きDecodeの補足、LinearのTq説明。配置や接続は変更していない。

学習会話の本文・個人の実行ログは転載していない。過去の検証で使用したTransformers 5.18.0とは分け、今回の掲載コードは5.20.2で確認した。

## 一次資料

- [Transformers 5.20.2 Qwen3](https://github.com/huggingface/transformers/blob/v5.20.2/src/transformers/models/qwen3/modeling_qwen3.py)
- [Transformers 5.20.2 Cache](https://github.com/huggingface/transformers/blob/v5.20.2/src/transformers/cache_utils.py)
- [公式Cache解説](https://huggingface.co/docs/transformers/cache_explanation)
- [Qwen3-0.6B固定config](https://huggingface.co/Qwen/Qwen3-0.6B/blob/c1899de289a04d12100db370d81485cdf75e47ca/config.json)
- [PyTorch 2.14 CUDA Event](https://docs.pytorch.org/docs/2.14/generated/torch.cuda.Event.html)

## 掲載コードの実行

PyTorch 2.14.1+cu130 / Transformers 5.20.2。固定revisionをCPU・bfloat16・4 threads・evalモードで実行した。入力はpaddingなしの1件。教材からPythonブロックを抽出し、モデルの配置先だけCPUに固定して順に実行した。

- 初期入力は7 Token。手動ループで5 Token生成し、cache有無のID列が一致した。最終生成列は12、cache長は11。
- 全28層でK/Vのshapeは `[1,8,7,128]` → `[1,8,8,128]`。追加後も、全層の過去7位置のK・Vがそれぞれ元の値と一致した。
- 続行時のlogitsはcacheあり `[1,1,151936]`、なし `[1,8,151936]`。
- Layer 0のgate_projをフックし、cacheありの出力 `[1,1,3072]` と、なしの `[1,8,3072]` を確認。全位置を計算してから最後だけ切り出す説明にはしていない。
- `next_outputs.past_key_values is cache` がTrueで、渡したDynamicCacheの長さが7→8へ更新された。
- 同じ8位置を参照したcache有無の最終logitsには、最大絶対差0.1875があった。この検証のID一致を、全環境でのlogits完全一致へ一般化しない。
- 同期つき時計の比較コードも、生成長を検証用の5 Tokenへ短縮して実行し、ID列の一致を確認した。CPUでの動作確認であり、GPU性能や一定の高速化率を保証しない。CUDA EventのGPU実測は今回の検証には含めない。

## サイトの確認

追補ではmodel()の入力・出力、最後のlogitsを選ぶ理由、測定結果のアンパッキング、CUDA Eventに待ち時間が入り得ることを補足した。延べ入力位置数はP=7、N=32で720対38、N=1024で530,944対1,030。これは計算から得る位置数で、測定済みの実行時間として扱わない。

型検査はエラー・警告0件、既存ユニットテスト28件成功。195ページの生成、検索索引、内部リンク・公開ファイル境界の検証に成功。地図の計算欄の既存ブラウザテスト3件も成功し、1280 / 390 / 320px幅の詳細ポップアップを検証した。教材の追加比較表はEdgeで目視確認した。

# Decoder Layer教材の補強・検証（2026-10-11）

## 反映範囲

既存のHidden State観察とRoPE実験を起点に、以下の説明を既存教材へ分散した。学習会話の本文や個人の実行ログは転載していない。

| 教材 | 補強内容 |
|---|---|
| Tensor / Linear | reshapeとtranspose、射影の入出力とweightのshape |
| 位置情報 | Token・Head・成分ペア、回転速度と角度、Qwen3のRoPEコード |
| Self-Attention | GQAのHead対応、スコアの各要素、Mask、Softmax、V合成、Concat・o_proj |
| Transformerブロック | Normの対象、手動再現、MLPと2回の残差接続 |
| KV Cache | PrefillとDecode、入力済みTokenへのCausal Mask、最終Hidden Stateとの違い |
| モデル改造 | Head・Norm・RoPE変更時の区別 |
| 全体地図 | 関連地点の詳細に短い説明と教材リンクを追加 |

## 一次資料

- [Transformers v5.18.0 Qwen3実装](https://github.com/huggingface/transformers/blob/v5.18.0/src/transformers/models/qwen3/modeling_qwen3.py)
- [Qwen3-0.6B 固定config](https://huggingface.co/Qwen/Qwen3-0.6B/blob/c1899de289a04d12100db370d81485cdf75e47ca/config.json)
- [PyTorch SDPAのMask仕様](https://docs.pytorch.org/docs/2.14/generated/torch.nn.functional.scaled_dot_product_attention.html)

## コード検証

既存キャッシュの固定revisionをCPU・bfloat16で読み込み、教材からPythonブロックを抽出して、Norm → RoPE → Attention → MLPの順で実行した。入力は「こんにちは、今日はいい天気ですね」、paddingなし、cacheなし、evalモード。

- RMSNormの基本演算による再現はモジュール出力と一致。
- K転置後 `[1,16,128,7]`、スコア `[1,16,7,7]`、Head結合後 `[1,7,2048]`、残差加算後 `[1,7,1024]` を確認。
- Softmax各行の和が約1、未来位置の重みが0であることを確認。
- Q Head 2と共有元K Head 1の手動内積が、対応するスコアと一致。
- 分解したMLPは、同じ入力のMLPモジュール出力と一致。
- 掲載コードのfloat32手動Attention経路とモデル本体のLayer 0出力には、最大絶対誤差0.0078125があった。演算精度・順序の違いを教材に明記し、完全一致を主張しない。

型検査はエラー・警告0件、ユニットテスト27件成功。194ページの生成と内部リンク検証に成功。

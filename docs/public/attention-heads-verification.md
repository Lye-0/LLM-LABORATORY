# Attention Head教材の補強

確認日：2026-11-01（日本時間）。

## 取得範囲と採用判断

会話取得ツールで読めた末尾5往復の本文、ログイン済みEdgeのブラウザ操作で過去へさかのぼった入力・出力、追加提供された2つのテキストを照合した。ブラウザでは一部回答が「読み込めませんでした」と表示されたため、会話全体を完全取得したとは記録しない。追加テキストにあるMatplotlibの解説、Layer 0・27の比較、最後のQueryの指定、全層のHead平均は本文で確認した。過去のNotion作成などの依頼文は参考資料であり、今回の作業指示として実行しない。

既存Self-AttentionにはQ/K/V、GQA、内積、Mask、Concat・o_projがある。一方、outputs.attentionsを直接取得する観察地点、Head軸とQuery軸の区別、Layer比較、Attention Sinkは不足していた。基本教材を長くしすぎないよう、観察用の単元attention-headsをSelf-Attentionの次に追加し、基本教材と地図のSoftmaxから案内する。KV Cacheには保存範囲を削る操作との違いを補足する。

## 技術的な範囲

- Qwen3-0.6B、1件・paddingなし・7 Token・eval・cacheなしの観察例。モデルrevisionはサイト既存の固定値。
- API・返却地点はTransformers v5.18.0のQwen3参照実装に合わせる。eagerのSoftmax後の割合と、V加重和の出力、学習済みパラメータを分ける。
- Head 0・1が同じKVを使ってもQは別。Layer間では入力表現と射影の重みも異なる。
- 観察ログの0・3・27層の数値は提供ログの読み取り例。実行環境の全条件が揃った再現fixtureや今回の再測定値として扱わない。
- 割合、割合を掛けたV、最終予測への影響を区別する。Sinkの集中だけから異常・意味的重要度・発生原因を断定しない。
- Matplotlib例は途中で切れたコードをそのまま転記せず、最後のQuery、共通の色範囲、Head平均、Figureごとの配置と最後のshowを明示する。

## 原典

- [Qwen3実装 v5.18.0](https://github.com/huggingface/transformers/blob/v5.18.0/src/transformers/models/qwen3/modeling_qwen3.py)：eager_attention_forward、Qwen3Attention、出力取得。
- [StreamingLLM原論文](https://arxiv.org/abs/2309.17453)：Sinkと先頭K/Vの保持。個別のQwen観察の原因証明とは区別する。
- [Matplotlib subplots](https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.subplots.html)、[Figure.tight_layout](https://matplotlib.org/stable/api/_as_gen/matplotlib.figure.Figure.tight_layout.html)、[pyplot.show](https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.show.html)。

## 確認

Astro check、45件の単体テスト、197ページ・31教材の静的出力と内部リンク検査が通過。Pythonコード3ブロックは構文解析で確認。モデル本体を新たに取得・実行しておらず、実モデルの数値や全GPU環境での動作を検証済みとはしない。Edgeのブラウザ操作で本文・比較表・描画コードの開閉を確認した。

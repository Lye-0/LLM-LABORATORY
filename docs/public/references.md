# 公開されている参考資料

技術仕様の根拠は公式資料とモデルの配布設定に置く。APIやモデルの版を更新した場合は、実際に採用する版で再確認する。

## 教材内容

| 分野      | 原典                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------ |
| Tokenizer | [Transformers Tokenizer](https://huggingface.co/docs/transformers/main_classes/tokenizer)        |
| BPE       | [Hugging Face LLM Course](https://huggingface.co/learn/llm-course/en/chapter6/5)                 |
| 会話形式  | [Chat templates](https://huggingface.co/docs/transformers/chat_templating)                       |
| Tensor    | [PyTorch Tensor](https://docs.pytorch.org/docs/2.14/tensors.html)                                |
| Embedding | [PyTorch Embedding](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Embedding.html)        |
| Module    | [PyTorch Module](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Module.html)              |
| 自動微分  | [Autograd tutorial](https://docs.pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html) |
| LoRA      | [PEFT LoRA](https://huggingface.co/docs/peft/main/conceptual_guides/lora)                        |
| 量子化    | [Transformers bitsandbytes](https://huggingface.co/docs/transformers/quantization/bitsandbytes)  |
| 評価      | [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness)                     |

## 参照モデル

[Qwen/Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-0.6B/tree/c1899de289a04d12100db370d81485cdf75e47ca)、revision `c1899de289a04d12100db370d81485cdf75e47ca`。同梱データのライセンスはApache-2.0。配布元のLICENSEと、リポジトリ内のmanifestを参照する。

Tokenizerの基本語彙151643、追加分込み151669、model configのvocab_size151936は所有者が異なる。hidden_size1024、Q heads16、KV heads8、head_dim128も、それぞれの設定として読む。

Tokenizer側model_max_length、model configの位置設定、モデルカードの文脈長を一つの値へ統合しない。必要なshapeは実物のmoduleから確認する。

## サイト実装

- [Astro Islands](https://docs.astro.build/en/concepts/islands/)
- [Content Collections](https://docs.astro.build/en/guides/content-collections/)
- [Hugging Face Tokenizers.js](https://github.com/huggingface/tokenizers.js)
- [Pagefind multilingual](https://pagefind.app/docs/multilingual/)
- [mise configuration](https://mise.jdx.dev/configuration.html)
- [uv projects](https://docs.astral.sh/uv/guides/projects/)
- [GitHub Pagesのカスタムワークフロー](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [AstroのGitHub Pages向け設定](https://docs.astro.build/en/guides/deploy/github/)

外部資料は全文コピーを増やすより、参照先・採用版・このプロジェクトで使う範囲を記録する。

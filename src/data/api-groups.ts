import { apiEntries } from './api';
export const apiLibraries = [
  {
    slug: 'pytorch',
    title: 'PyTorch',
    namespace: 'torch',
    description: 'Tensor・行列演算・ニューラルネットワーク・自動微分を扱う。',
  },
  {
    slug: 'transformers',
    title: 'Transformers',
    namespace: 'transformers',
    description: 'Tokenizer・事前学習済みモデル・テキスト生成を扱う。',
  },
] as const;
export const apiClasses = [
  {
    slug: 'torch',
    library: 'pytorch',
    owner: 'torch',
    title: 'torch',
    kind: 'モジュール',
    description: 'Tensorの作成、演算、勾配記録の制御。',
  },
  {
    slug: 'tensor',
    library: 'pytorch',
    owner: 'Tensor',
    title: 'torch.Tensor',
    kind: 'クラス',
    description: '値・shape・dtype・deviceと、形状変換。',
  },
  {
    slug: 'module',
    library: 'pytorch',
    owner: 'nn.Module',
    title: 'torch.nn.Module',
    kind: '基底クラス',
    description: '重みの管理、学習・推論の切替、保存と観察。',
  },
  {
    slug: 'embedding',
    library: 'pytorch',
    owner: 'nn.Embedding',
    title: 'torch.nn.Embedding',
    kind: 'クラス',
    description: 'IDに対応するベクトルを取り出す。',
  },
  {
    slug: 'linear',
    library: 'pytorch',
    owner: 'nn.Linear',
    title: 'torch.nn.Linear',
    kind: 'クラス',
    description: '入力の末尾の特徴軸を線形変換する。',
  },
  {
    slug: 'optimizer',
    library: 'pytorch',
    owner: 'Optimizer',
    title: 'torch.optim.Optimizer',
    kind: '基底クラス',
    description: '勾配の初期化とパラメータの更新。',
  },
  {
    slug: 'auto-tokenizer',
    library: 'transformers',
    owner: 'AutoTokenizer',
    title: 'AutoTokenizer',
    kind: 'ファクトリー',
    description: '設定から適切なTokenizerを選んで読み込む。',
  },
  {
    slug: 'tokenizer',
    library: 'transformers',
    owner: 'Tokenizer',
    title: 'Tokenizer',
    kind: '共通API',
    description: '文字列・ID・会話形式の変換と語彙の管理。',
  },
  {
    slug: 'pretrained-model',
    library: 'transformers',
    owner: 'PreTrainedModel',
    title: 'PreTrainedModel',
    kind: '基底クラス',
    description: 'モデルのEmbeddingと語彙サイズの管理。',
  },
  {
    slug: 'generation',
    library: 'transformers',
    owner: 'GenerationMixin',
    title: 'GenerationMixin',
    kind: 'Mixin',
    description: '生成条件に従って、次のトークンを選び続ける。',
  },
] as const;
export function getApiClass(owner: string) {
  return apiClasses.find((c) => c.owner === owner);
}
export function getClassEntries(owner: string) {
  return apiEntries.filter((e) => e.owner === owner);
}
export const apiKindLabels: Record<string, string> = {
  method: 'メソッド',
  property: '属性',
  class: 'クラス',
  'class method': 'クラスメソッド',
  function: '関数',
  'context manager': 'コンテキストマネージャー',
};

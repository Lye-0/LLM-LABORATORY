import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = 'public/data/qwen3/';
const config = JSON.parse(await readFile(base + 'tokenizer_config.json', 'utf8'));
const descriptions = {
  '<|endoftext|>': [
    '会話',
    'このTokenizerではPADとして登録。モデルconfigのBOS設定とは所有者が異なります。',
  ],
  '<|im_start|>': ['会話', 'メッセージの開始。続けてroleなどが置かれます。'],
  '<|im_end|>': ['会話', 'メッセージの終了。TokenizerのEOSとしても登録されています。'],
  '<|object_ref_start|>': ['領域', '物体参照の開始境界。'],
  '<|object_ref_end|>': ['領域', '物体参照の終了境界。'],
  '<|box_start|>': ['領域', '矩形領域の開始境界。'],
  '<|box_end|>': ['領域', '矩形領域の終了境界。'],
  '<|quad_start|>': ['領域', '四辺形領域の開始境界。'],
  '<|quad_end|>': ['領域', '四辺形領域の終了境界。'],
  '<|vision_start|>': ['Vision', '視覚情報の開始境界。'],
  '<|vision_end|>': ['Vision', '視覚情報の終了境界。'],
  '<|vision_pad|>': ['Vision', '視覚情報のプレースホルダー用表記。'],
  '<|image_pad|>': ['Vision', '画像情報のプレースホルダー用表記。'],
  '<|video_pad|>': ['Vision', '動画情報のプレースホルダー用表記。'],
  '<tool_call>': ['Tool', 'ツール呼び出し内容の開始。実行自体は外側のプログラムが行います。'],
  '</tool_call>': ['Tool', 'ツール呼び出し内容の終了。'],
  '<tool_response>': ['Tool', 'ツール応答の開始。'],
  '</tool_response>': ['Tool', 'ツール応答の終了。'],
  '<|fim_prefix|>': ['FIM', '途中補完形式で既知の前半を表す目印。'],
  '<|fim_middle|>': ['FIM', '途中補完する中央部分の目印。'],
  '<|fim_suffix|>': ['FIM', '既知の後半を表す目印。'],
  '<|fim_pad|>': ['FIM', 'FIM形式の埋め草用表記。'],
  '<|repo_name|>': ['ファイル', 'リポジトリ名を表す目印。'],
  '<|file_sep|>': ['ファイル', 'ファイル間の区切り。'],
  '<think>': ['Thinking', '思考用テキストの開始境界。special=Falseです。'],
  '</think>': ['Thinking', '思考用テキストの終了境界。本文は通常の語彙からなる列です。'],
};
const tokens = Object.entries(config.added_tokens_decoder).map(([id, t]) => ({
  id: Number(id),
  text: t.content,
  special: t.special,
  category: descriptions[t.content][0],
  description: descriptions[t.content][1],
  flags: {
    lstrip: t.lstrip,
    rstrip: t.rstrip,
    single_word: t.single_word,
    normalized: t.normalized,
  },
  roles: [
    ...(config.eos_token === t.content ? ['EOS'] : []),
    ...(config.pad_token === t.content ? ['PAD'] : []),
  ],
}));
await mkdir('src/data', { recursive: true });
await writeFile('src/data/tokens.json', JSON.stringify(tokens, null, 2) + '\n');
const files = [];
for (const name of ['tokenizer.json', 'tokenizer_config.json', 'config.json', 'LICENSE']) {
  const bytes = await readFile(base + name);
  files.push({
    name,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
await writeFile(
  base + 'manifest.json',
  JSON.stringify(
    {
      model: 'Qwen/Qwen3-0.6B',
      revision: 'c1899de289a04d12100db370d81485cdf75e47ca',
      license: 'Apache-2.0',
      retrievedAt: '2026-10-04',
      files,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Prepared ${tokens.length} tokens and asset manifest.`);

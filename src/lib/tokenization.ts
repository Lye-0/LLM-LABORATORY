import type { Tokenizer } from '@huggingface/tokenizers';
export function encodeText(tokenizer: Tokenizer, text: string) {
  const result = tokenizer.encode(text, { add_special_tokens: false });
  return {
    ids: result.ids,
    tokens: result.tokens,
    decoded: result.ids.length ? tokenizer.decode(result.ids, { skip_special_tokens: false }) : '',
    pieces: result.ids.map((id) => tokenizer.decode([id], { skip_special_tokens: false })),
  };
}

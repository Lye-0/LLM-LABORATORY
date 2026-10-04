import { readFileSync } from 'node:fs';
import { Tokenizer } from '@huggingface/tokenizers';
import { expect, it } from 'vitest';
import tokens from '../../src/data/tokens.json';
import { encodeText } from '../../src/lib/tokenization';
const tokenizer = new Tokenizer(
  JSON.parse(readFileSync('public/data/qwen3/tokenizer.json', 'utf8')),
  JSON.parse(readFileSync('public/data/qwen3/tokenizer_config.json', 'utf8')),
);
it('Qwenの参照入力とIDを照合する', () => {
  expect(
    tokenizer.encode('こんにちは、今日はいい天気ですね', { add_special_tokens: false }).ids,
  ).toEqual([89015, 5373, 133165, 126224, 35727, 94121, 128797]);
});
it('Python Transformersで確認した全ケースとID列が一致する', () => {
  const reference = JSON.parse(readFileSync('tests/fixtures/python-reference.json', 'utf8'));
  for (const item of reference.tokenizerCases) {
    const result = encodeText(tokenizer, item.text);
    expect(result.ids).toEqual(item.ids);
    expect(result.decoded).toBe(item.decoded);
  }
});
it.each(['Hello world', ' Hello world', '改行\nを含む文章', '🦦と🌏', '<think>考える</think>', ''])(
  'decodeで入力を復元する: %s',
  (text) => {
    expect(encodeText(tokenizer, text).decoded).toBe(text);
  },
);
it('特殊と追加を区別し、全26項目を保持する', () => {
  expect(tokens).toHaveLength(26);
  expect(new Set(tokens.map((t) => t.id)).size).toBe(26);
  expect(tokens.find((t) => t.text === '<think>')?.special).toBe(false);
  expect(tokens.find((t) => t.text === '<|im_end|>')?.special).toBe(true);
  for (const token of tokens)
    expect(tokenizer.encode(token.text, { add_special_tokens: false }).ids).toEqual([token.id]);
});

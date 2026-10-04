import { withBase } from '../lib/paths';
import { Tokenizer } from '@huggingface/tokenizers';
import { encodeText } from '../lib/tokenization';
let tokenizer: Tokenizer | undefined;
let entries: { token: string; id: number; added: boolean }[] = [];
let loading: Promise<void> | undefined;
async function load() {
  if (tokenizer) return;
  loading ??= (async () => {
    const responses = await Promise.all([
      fetch(withBase('/data/qwen3/tokenizer.json')),
      fetch(withBase('/data/qwen3/tokenizer_config.json')),
    ]);
    if (responses.some((r) => !r.ok)) throw new Error('Tokenizerデータを取得できませんでした。');
    const [data, config] = await Promise.all(responses.map((r) => r.json()));
    tokenizer = new Tokenizer(data, config);
    const base = new Map<string, number>(Object.entries(data.model.vocab));
    entries = [...base].map(([token, id]) => ({ token, id, added: false }));
    for (const token of data.added_tokens) {
      if (!base.has(token.content))
        entries.push({ token: token.content, id: token.id, added: true });
    }
    entries.sort((a, b) => a.id - b.id);
  })().catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
self.onmessage = async (event: MessageEvent) => {
  const {
    requestId,
    type,
    text = '',
    query = '',
    mode = 'id',
    page = 0,
    added = false,
  } = event.data;
  try {
    await load();
    if (!tokenizer) throw new Error('Tokenizerの初期化に失敗しました。');
    if (type === 'encode') {
      if (text.length > 2000) throw new Error('入力は2,000文字以内にしてください。');
      self.postMessage({ requestId, type, ...encodeText(tokenizer, text) });
    } else {
      let filtered = entries.filter((e) => !added || e.added);
      if (query) {
        if (mode === 'id') {
          const parts = query.split('-').map((v: string) => Number(v.trim()));
          if (parts.some((v: number) => !Number.isInteger(v) || v < 0) || parts.length > 2)
            throw new Error('IDまたは範囲を入力してください。例: 89015 / 89010-89020');
          const [from, to = from] = parts;
          filtered = filtered.filter((e) => e.id >= from && e.id <= to);
        } else if (mode === 'text') {
          const ids = new Set(tokenizer.encode(query, { add_special_tokens: false }).ids);
          filtered = filtered.filter((e) => ids.has(e.id));
        } else
          filtered = filtered.filter((e) => e.token.toLowerCase().includes(query.toLowerCase()));
      }
      self.postMessage({
        requestId,
        type,
        total: filtered.length,
        rows: filtered.slice(page * 50, (page + 1) * 50).map((e) => ({
          ...e,
          decoded: tokenizer!.decode([e.id], { skip_special_tokens: false }),
        })),
      });
    }
  } catch (error) {
    self.postMessage({
      requestId,
      type,
      error: error instanceof Error ? error.message : '処理できませんでした。',
    });
  }
};

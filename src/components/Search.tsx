import { withBase } from '../lib/paths';
import { useEffect, useMemo, useState } from 'react';
import Select from './ui/Select';
interface Entry {
  title: string;
  description: string;
  url: string;
  kind: string;
  keywords: string;
}
interface PagefindData {
  url: string;
  meta: { title?: string };
  excerpt?: string;
}
interface Pagefind {
  search: (q: string) => Promise<{ results: { data: () => Promise<PagefindData> }[] }>;
}
const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFKC');
const aliases: Record<string, string> = {
  埋め込み: 'embedding',
  語彙: 'vocab',
  軸を増やす: 'unsqueeze',
  形状: 'shape',
  スペシャルトークン: 'special',
  逆伝播: 'backward',
};
export default function Search() {
  const [query, setQuery] = useState(''),
    [kind, setKind] = useState('すべて'),
    [index, setIndex] = useState<Entry[]>([]),
    [fulltext, setFulltext] = useState<Entry[]>([]),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setQuery(new URLSearchParams(location.search).get('q') ?? '');
    fetch(withBase('/search-index.json'), { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setIndex(data);
        setLoaded(true);
      })
      .catch((e) => {
        if (e.name !== 'AbortError')
          setError('索引を取得できませんでした。ページを再読み込みしてください。');
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    let active = true;
    setFulltext([]);
    if (!query.trim() || !import.meta.env.PROD) return;
    const timeout = setTimeout(async () => {
      try {
        const url = withBase('/pagefind/pagefind.js');
        const pf = (await import(/* @vite-ignore */ url)) as Pagefind;
        const result = await pf.search(query);
        const data = await Promise.all(result.results.slice(0, 15).map((r) => r.data()));
        if (active)
          setFulltext(
            data.map((d) => ({
              title: d.meta.title ?? '本文の一致',
              description: (d.excerpt ?? '').replace(/<[^>]*>/g, ''),
              url: withBase(d.url),
              kind: '本文',
              keywords: '',
            })),
          );
      } catch {
        /* 構造化索引は独立して利用できます。 */
      }
    }, 220);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query]);
  const matches = useMemo(() => {
    const q = normalize(query.trim()),
      alias = aliases[query.trim()];
    const scored = index
      .map((e) => {
        const title = normalize(e.title),
          all = normalize(`${e.title} ${e.description} ${e.keywords}`);
        const score = !q
          ? 1
          : title === q
            ? 100
            : title.includes(q)
              ? 60
              : all.includes(q)
                ? 20
                : alias && all.includes(alias)
                  ? 15
                  : 0;
        return { entry: e, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.entry);
    const known = new Set(scored.map((e) => e.url));
    const candidates =
      kind === '本文' ? fulltext : [...scored, ...fulltext.filter((e) => !known.has(e.url))];
    return candidates.filter((e) => kind === 'すべて' || e.kind === kind).slice(0, 80);
  }, [index, query, kind, fulltext]);
  function change(value: string) {
    setQuery(value);
    const params = new URLSearchParams();
    if (value) params.set('q', value);
    history.replaceState(null, '', `${location.pathname}${params.size ? '?' + params : ''}`);
  }
  return (
    <div>
      <label className="sr-only" htmlFor="site-search">
        キーワードを検索
      </label>
      <input
        id="site-search"
        className="search-box"
        type="search"
        value={query}
        onChange={(e) => change(e.target.value)}
        placeholder="埋め込み、unsqueeze、151667…"
        autoComplete="off"
      />
      <div className="toolbar">
        <Select
          label="検索結果の種類"
          value={kind}
          onValueChange={setKind}
          options={[
            'すべて',
            '教材',
            'API',
            '実験',
            '用語',
            'トークン',
            '比較',
            '課題',
            '周辺技術',
            '本文',
          ].map((value) => ({ value, label: value }))}
        />
        <button
          className="button ghost"
          onClick={() => {
            change('');
            setKind('すべて');
          }}
        >
          条件を解除
        </button>
      </div>
      {!query && (
        <div className="segmented" style={{ marginBottom: 25 }}>
          {['Embedding', 'unsqueeze', 'vocab_size', '<think>', '量子化'].map((q) => (
            <button key={q} onClick={() => change(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!loaded && !error && <p role="status">検索索引を読み込んでいます…</p>}
      {loaded && (
        <>
          <p className="count" role="status">
            {matches.length} 件{matches.length === 80 ? '（最大80件）' : ''}
          </p>
          {matches.length === 0 ? (
            <div className="empty-state">
              <p>一致する項目はありません。</p>
              <p>短い語、英語のAPI名、別の分類で探せます。</p>
            </div>
          ) : (
            <div className="results">
              {matches.map((e, i) => (
                <a key={e.url + i} href={withBase(e.url)} className="search-result">
                  <div className="result-meta">
                    <span className="pill">{e.kind}</span>
                  </div>
                  <h2>{e.title}</h2>
                  <p>{e.description}</p>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

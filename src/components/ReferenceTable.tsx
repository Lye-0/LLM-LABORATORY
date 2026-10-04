import { withBase } from '../lib/paths';
import { useEffect, useState } from 'react';
import { apiEntries } from '../data/api';
import { apiKindLabels } from '../data/api-groups';
import tokens from '../data/tokens.json';
import Select from './ui/Select';

export default function ReferenceTable({
  kind,
  owner,
}: {
  kind: 'api' | 'tokens';
  owner?: string;
}) {
  const [query, setQuery] = useState(''),
    [group, setGroup] = useState('all'),
    [special, setSpecial] = useState('all');
  const available = apiEntries.filter((e) => !owner || e.owner === owner);
  const groups = [
    ...new Set(kind === 'api' ? available.map((e) => e.category) : tokens.map((t) => t.category)),
  ];
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQuery(params.get('q') ?? '');
    const g = params.get('group') ?? 'all';
    setGroup(groups.includes(g) ? g : 'all');
    const s = params.get('special');
    setSpecial(s === 'true' || s === 'false' ? s : 'all');
  }, []);
  function update(next: { q?: string; group?: string; special?: string }) {
    const q = next.q ?? query,
      g = next.group ?? group,
      s = next.special ?? special;
    setQuery(q);
    setGroup(g);
    setSpecial(s);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (g !== 'all') params.set('group', g);
    if (s !== 'all') params.set('special', s);
    history.replaceState(null, '', `${location.pathname}${params.size ? '?' + params : ''}`);
  }
  const normalized = query.toLocaleLowerCase().normalize('NFKC');
  const items = available.filter(
    (e) =>
      (group === 'all' || e.category === group) &&
      `${e.name} ${e.summary} ${e.category}`
        .toLocaleLowerCase()
        .normalize('NFKC')
        .includes(normalized),
  );
  const tokenItems = tokens.filter(
    (t) =>
      (group === 'all' || t.category === group) &&
      (special === 'all' || String(t.special) === special) &&
      `${t.text} ${t.id} ${t.description}`
        .toLocaleLowerCase()
        .normalize('NFKC')
        .includes(normalized),
  );
  return (
    <div>
      <div className="toolbar">
        <label>
          {kind === 'api' ? 'この対象の名前・用途から探す' : '表記・ID・用途から探す'}
          <input
            type="search"
            value={query}
            onChange={(e) => update({ q: e.target.value })}
            placeholder={kind === 'api' ? '名前や用途を入力' : '151667 / <think> / 終了'}
          />
        </label>
        <Select
          label={kind === 'api' ? '機能の分類' : '用途の分類'}
          value={group}
          onValueChange={(value) => update({ group: value })}
          options={[
            { value: 'all', label: 'すべての分類' },
            ...groups.map((g) => ({ value: g, label: g })),
          ]}
        />
        {kind === 'tokens' && (
          <Select
            label="specialフラグ"
            value={special}
            onValueChange={(value) => update({ special: value })}
            options={[
              { value: 'all', label: 'すべて', description: 'TrueとFalseの両方を表示' },
              { value: 'true', label: 'True', description: 'Tokenizer上で特殊扱いする' },
              { value: 'false', label: 'False', description: '特殊扱いの対象に含めない' },
            ]}
          />
        )}
        <button
          className="button ghost"
          onClick={() => update({ q: '', group: 'all', special: 'all' })}
        >
          条件を解除
        </button>
      </div>
      <p className="count" role="status" style={{ marginBottom: 20 }}>
        {kind === 'api' ? items.length : tokenItems.length} 件
      </p>
      {kind === 'api' ? (
        <div className="api-method-groups">
          {groups
            .filter((g) => items.some((e) => e.category === g))
            .map((category) => (
              <section className="api-method-group" key={category}>
                <div className="section-title">
                  <h2>{category}</h2>
                  <span className="count">
                    {items.filter((e) => e.category === category).length} 件
                  </span>
                </div>
                <div className="table-scroll reference-list">
                  <table>
                    <thead>
                      <tr>
                        <th>名前 / 種類</th>
                        <th>目的</th>
                        <th>返り値</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items
                        .filter((e) => e.category === category)
                        .map((e) => (
                          <tr key={e.slug}>
                            <td>
                              <a href={withBase(`/reference/api/${e.slug}/`)}>{e.name}</a>
                              <div className="kind">{apiKindLabels[e.kind] ?? e.kind}</div>
                            </td>
                            <td>{e.summary}</td>
                            <td>{e.returns}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          {items.length === 0 && (
            <p className="empty-state">一致する項目はありません。条件を変えて検索してください。</p>
          )}
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>表記と説明</th>
                <th>ID</th>
                <th>分類</th>
                <th>special</th>
              </tr>
            </thead>
            <tbody>
              {tokenItems.map((t) => (
                <tr id={`token-${t.id}`} key={t.id}>
                  <td>
                    <details className="token-detail">
                      <summary>{t.text}</summary>
                      <p>{t.description}</p>
                      <p>
                        役割: {t.roles.join(', ') || '個別のEOS/PAD登録なし'}
                        <br />
                        lstrip / rstrip / single_word / normalized:{' '}
                        {Object.values(t.flags)
                          .map((v) => String(v))
                          .join(' / ')}
                      </p>
                    </details>
                  </td>
                  <td>
                    <code>{t.id}</code>
                  </td>
                  <td>{t.category}</td>
                  <td>
                    <span className={`pill ${t.special ? 'teal' : ''}`}>{String(t.special)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tokenItems.length === 0 && (
            <p className="empty-state">
              一致するトークンはありません。条件を解除して確認できます。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

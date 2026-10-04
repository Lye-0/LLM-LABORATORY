import Select from '../ui/Select';
import { useEffect, useRef, useState } from 'react';
type Encoded = { ids: number[]; tokens: string[]; pieces: string[]; decoded: string };
type Row = { token: string; id: number; added: boolean; decoded: string };
function useTokenizer() {
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [encoded, setEncoded] = useState<Encoded | null>(null),
    [vocabulary, setVocabulary] = useState<{ rows: Row[]; total: number } | null>(null);
  useEffect(() => {
    const instance = new Worker(new URL('../../workers/tokenizer.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = instance;
    instance.onmessage = (e) => {
      if (e.data.requestId !== sequence.current) return;
      setBusy(false);
      if (e.data.error) {
        setError(e.data.error);
        return;
      }
      setError('');
      if (e.data.type === 'encode') setEncoded(e.data);
      else setVocabulary(e.data);
    };
    instance.onerror = () => {
      setBusy(false);
      setError('Tokenizerを読み込めませんでした。ページを再読み込みしてください。');
    };
    return () => instance.terminate();
  }, []);
  function send(data: Record<string, unknown>) {
    setError('');
    setBusy(true);
    sequence.current++;
    setEncoded(null);
    setVocabulary(null);
    worker.current?.postMessage({ ...data, requestId: sequence.current });
  }
  function clear() {
    sequence.current++;
    setBusy(false);
    setError('');
    setEncoded(null);
    setVocabulary(null);
  }
  return { send, clear, busy, error, encoded, vocabulary };
}
export function TokenizerLab() {
  const [text, setText] = useState('こんにちは、今日はいい天気ですね'),
    [selected, setSelected] = useState(0);
  const { send, clear, busy, error, encoded } = useTokenizer();
  return (
    <div>
      <div className="lab-controls">
        <label>
          入力する文章
          <textarea
            rows={3}
            maxLength={2000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              clear();
            }}
          />
        </label>
      </div>
      <div className="lab-controls">
        <Select
          label="例文"
          value={
            [
              'こんにちは、今日はいい天気ですね',
              'Hello world',
              ' Hello world',
              '改行\nを含む文章',
              '🦦と🌏',
              '<think>考える</think>',
            ].includes(text)
              ? text
              : ''
          }
          onValueChange={(value) => {
            setText(value);
            clear();
          }}
          placeholder="例文を選ぶ"
          options={[
            {
              value: 'こんにちは、今日はいい天気ですね',
              label: 'こんにちは、今日はいい天気ですね',
              description: '日本語の文字列',
            },
            { value: 'Hello world', label: 'Hello world', description: '英語の文字列' },
            { value: ' Hello world', label: '␠Hello world', description: '先頭に空白を含む' },
            {
              value: '改行\nを含む文章',
              label: '改行を含む文章',
              description: '途中の改行を観察する',
            },
            { value: '🦦と🌏', label: '🦦と🌏', description: '絵文字とバイトの境界' },
            {
              value: '<think>考える</think>',
              label: '<think>考える</think>',
              description: '追加トークンの認識',
            },
          ]}
        />
        <button
          className="button primary"
          disabled={busy}
          onClick={() => {
            setSelected(0);
            send({ type: 'encode', text });
          }}
        >
          トークンに分ける
        </button>
        <span className="count">
          {Array.from(text).length} 文字 / {new TextEncoder().encode(text).length} bytes
        </span>
      </div>
      {busy && (
        <p role="status" className="notice">
          語彙と結合規則を読み込んで処理しています。初回のみ約11.5MBのデータを取得します。
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error} 「トークンに分ける」で再試行できます。
        </p>
      )}
      {encoded && (
        <>
          <div className="stats">
            <dl className="stat">
              <dt>tokens</dt>
              <dd>{encoded.ids.length}</dd>
            </dl>
            <dl className="stat">
              <dt>入力との一致</dt>
              <dd>{encoded.decoded === text ? '一致' : '不一致'}</dd>
            </dl>
          </div>
          <div className="token-chips" aria-label="トークン一覧">
            {encoded.ids.map((id, i) => (
              <button
                key={i}
                className={`token-chip ${selected === i ? 'active' : ''}`}
                aria-pressed={selected === i}
                onClick={() => setSelected(i)}
              >
                <span>
                  {encoded.pieces[i].replaceAll(' ', '␠').replaceAll('\n', '↵') || '（空）'}
                </span>
                <small>{id}</small>
              </button>
            ))}
          </div>
          {encoded.ids.length > 0 && (
            <div className="lab-columns">
              <div className="lab-pane">
                <div className="pane-title">選択中のトークン / {selected}</div>
                <p className="lab-data">{encoded.tokens[selected]}</p>
                <p className="value-large">{encoded.ids[selected]}</p>
                <p className="lab-explanation">
                  内部表記とID。単独decodeでは不完全な文字が「�」になる場合があります。
                </p>
              </div>
              <div className="lab-pane">
                <div className="pane-title">列全体のdecode</div>
                <p className="lab-data">{encoded.decoded || '（空文字列）'}</p>
                <p className="lab-explanation">トークン境界は、文字や単語の境界とは限りません。</p>
              </div>
            </div>
          )}
          <p className="code-caption">input_ids · add_special_tokens=False</p>
          <pre>
            <code>{JSON.stringify(encoded.ids)}</code>
          </pre>
        </>
      )}
      <p className="lab-explanation">
        Qwen3-0.6Bの配布Tokenizerをブラウザーで実行します。空白は␠、改行は↵で示しています。入力内容はサーバーに送信しません。
      </p>
    </div>
  );
}
export function VocabularyLab() {
  const [query, setQuery] = useState('89010-89020'),
    [mode, setMode] = useState('id'),
    [page, setPage] = useState(0),
    [added, setAdded] = useState(false);
  const { send, clear, busy, error, vocabulary } = useTokenizer();
  const request = (next = 0) => {
    setPage(next);
    send({ type: 'vocabulary', query, mode, page: next, added });
  };
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          request();
        }}
        className="lab-controls"
      >
        <Select
          label="探し方"
          value={mode}
          onValueChange={(value) => {
            setMode(value);
            setQuery('');
            clear();
          }}
          options={[
            { value: 'id', label: 'ID・ID範囲', description: '番号から対応するトークンを探す' },
            {
              value: 'internal',
              label: '内部表記の部分一致',
              description: '語彙表のキーを検索する',
            },
            {
              value: 'text',
              label: '文章を分割して対応を探す',
              description: '入力した文章をencodeして調べる',
            },
          ]}
        />
        <label>
          検索
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              clear();
            }}
            placeholder={mode === 'id' ? '89015 / 89010-89020' : '検索する文字列'}
            maxLength={2000}
          />
        </label>
        <button className="button primary" disabled={busy} type="submit">
          語彙を調べる
        </button>
      </form>
      <label className="check-label">
        <input
          type="checkbox"
          checked={added}
          onChange={(e) => {
            setAdded(e.target.checked);
            clear();
          }}
        />
        追加トークンだけに絞る（検索で反映）
      </label>
      {busy && (
        <p role="status" className="notice">
          配布語彙を読み込んで検索しています。
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {vocabulary && (
        <>
          <div className="section-title">
            <span className="count">{vocabulary.total.toLocaleString()} 件</span>
            <div className="segmented">
              <button disabled={busy || page === 0} onClick={() => request(page - 1)}>
                前の50件
              </button>
              <button
                disabled={busy || (page + 1) * 50 >= vocabulary.total}
                onClick={() => request(page + 1)}
              >
                次の50件
              </button>
            </div>
          </div>
          {vocabulary.total === 0 ? (
            <p className="empty-state">一致する項目はありません。条件を変えて検索してください。</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>内部表記</th>
                    <th>単独decode</th>
                    <th>分類</th>
                  </tr>
                </thead>
                <tbody>
                  {vocabulary.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <code>{row.id}</code>
                      </td>
                      <td>
                        <code>{row.token}</code>
                      </td>
                      <td>
                        <code>{JSON.stringify(row.decoded)}</code>
                      </td>
                      <td>{row.added ? '追加' : '基本'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <p className="lab-explanation">
        空の検索は全件をID順で表示します。「文章を分割」は、その文章のencode結果に含まれるIDを探します。内部表記そのものを調べる検索とは異なります。
      </p>
    </div>
  );
}
export function ChatLab() {
  const [user, setUser] = useState('こんにちは'),
    [system, setSystem] = useState(''),
    [generation, setGeneration] = useState(true),
    [thinking, setThinking] = useState(false);
  const prompt =
    (system ? `<|im_start|>system\n${system}<|im_end|>\n` : '') +
    `<|im_start|>user\n${user}<|im_end|>\n` +
    (generation ? '<|im_start|>assistant\n' + (!thinking ? '<think>\n\n</think>\n\n' : '') : '');
  const { send, clear, busy, error, encoded } = useTokenizer();
  return (
    <div>
      <div className="lab-columns">
        <div>
          <label>
            system（任意）
            <textarea
              rows={2}
              value={system}
              maxLength={500}
              onChange={(e) => {
                setSystem(e.target.value);
                clear();
              }}
            />
          </label>
          <label style={{ marginTop: 16 }}>
            user
            <textarea
              rows={3}
              value={user}
              maxLength={1000}
              onChange={(e) => {
                setUser(e.target.value);
                clear();
              }}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={generation}
              onChange={(e) => {
                setGeneration(e.target.checked);
                clear();
              }}
            />
            assistantの生成開始を追加
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={thinking}
              onChange={(e) => {
                setThinking(e.target.checked);
                clear();
              }}
            />
            Thinkingを有効にする
          </label>
        </div>
        <div className="lab-pane">
          <div className="pane-title">モデルへ渡す文字列</div>
          <div className="lab-data">{prompt}</div>
        </div>
      </div>
      <div className="lab-controls" style={{ marginTop: 20 }}>
        <button
          className="button"
          disabled={busy}
          onClick={() => send({ type: 'encode', text: prompt })}
        >
          この入力のトークン数を調べる
        </button>
        {encoded && <span className="count">直前に計測した入力: {encoded.ids.length} tokens</span>}
      </div>
      {busy && <p role="status">Tokenizerを準備しています…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="lab-explanation">
        systemと1件のuserだけを扱う、Qwen参照テンプレートの限定例です。ツール呼び出し・履歴の再構成は含みません。ここで表示するのは入力形式で、回答は生成しません。空のthink境界も入力に含まれます。
      </p>
    </div>
  );
}

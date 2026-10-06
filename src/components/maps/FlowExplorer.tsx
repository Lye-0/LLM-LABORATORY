import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MapSection } from '../../data/maps';
import { mapPreview } from '../../data/map-previews';
import { withBase } from '../../lib/paths';

export default function FlowExplorer({ section }: { section: MapSection }) {
  const [index, setIndex] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const preferredColumns =
    section.steps.length > 6 ? 4 : section.steps.length > 4 ? 3 : section.steps.length;
  const [columns, setColumns] = useState(preferredColumns);
  const board = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const controls = useRef<(HTMLButtonElement | null)[]>([]);
  const branches = section.mode === 'branches';
  const panelId = `${section.id}-inspection`;
  const active = index === null ? null : section.steps[index];
  useEffect(() => {
    if (active && dialog.current && !dialog.current.open) dialog.current.showModal();
    else if (!active && dialog.current?.open) dialog.current.close();
  }, [active]);
  useEffect(() => {
    const sync = () => {
      const selected = new URLSearchParams(location.search).get(section.id);
      const next = section.steps.findIndex((s) => s.id === selected);
      setIndex(next < 0 ? null : next);
    };
    sync();
    setReady(true);
    window.addEventListener('popstate', sync);
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setColumns(
        Math.min(preferredColumns, width >= 850 ? 4 : width >= 620 ? 3 : width >= 450 ? 2 : 1),
      );
    });
    if (board.current) observer.observe(board.current);
    return () => {
      window.removeEventListener('popstate', sync);
      observer.disconnect();
    };
  }, [section, preferredColumns]);
  function select(next: number | null) {
    setIndex(next);
    const url = new URL(location.href);
    if (next === null) url.searchParams.delete(section.id);
    else url.searchParams.set(section.id, section.steps[next].id);
    history.replaceState(null, '', url);
  }
  function close() {
    dialog.current?.close();
    if (index !== null) controls.current[index]?.focus();
    select(null);
  }
  return (
    <div className="flow-explorer" data-flow={section.id}>
      <div className="map-board" ref={board}>
        <div className="map-board-key">
          <span>{branches ? '並列の選択肢' : '番号と矢印の順に読む'}</span>
          <span>入力 → 処理 → 出力</span>
        </div>
        <ol
          className={`map-nodes ${branches ? 'map-nodes-branches' : ''}`}
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          aria-label={`${section.title}の${branches ? '選択肢' : '処理順'}`}
        >
          {section.steps.map((s, i) => {
            const preview = mapPreview(section.id, s);
            const row = Math.floor(i / columns);
            const reversed = !branches && row % 2 === 1;
            const column = reversed ? columns - 1 - (i % columns) : i % columns;
            const direction = i % columns === columns - 1 ? 'down' : reversed ? 'left' : 'right';
            return (
              <li
                key={s.id}
                className={`map-node ${index === i ? 'is-expanded' : ''}`}
                style={{ gridColumn: column + 1, gridRow: row + 1 } as CSSProperties}
              >
                <div className="map-node-input">
                  <span>入力</span>
                  <p>{preview.input}</p>
                </div>
                <div className="map-node-process">
                  <span className="map-node-number">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{s.title}</h3>
                  <span className="map-operation-name">{preview.operation}</span>
                  <p>{preview.meaning}</p>
                </div>
                <div className="map-node-output">
                  <span>出力</span>
                  <p>{preview.output}</p>
                </div>
                <button
                  type="button"
                  className="map-detail-control"
                  disabled={!ready}
                  aria-expanded={index === i}
                  aria-haspopup="dialog"
                  aria-controls={panelId}
                  aria-label={`${s.title}の詳細${index === i ? 'を閉じる' : 'を開く'}`}
                  ref={(el) => {
                    controls.current[i] = el;
                  }}
                  onClick={() => select(index === i ? null : i)}
                >
                  {index === i ? '詳細を閉じる −' : '詳細・コード ＋'}
                </button>
                {!branches && i < section.steps.length - 1 && (
                  <span className={`map-route map-route-${direction}`} aria-hidden="true">
                    {direction === 'down' ? '↓' : direction === 'left' ? '←' : '→'}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {section.id === 'inference' && (
          <p className="map-return">
            ↺ 次のIDを列に追加 → モデルの計算へ戻る。終了条件に達したら、文字列へ。
          </p>
        )}
        {section.id === 'update' && (
          <p className="map-return">↺ 更新した重みで、次のbatchを予測する。</p>
        )}
        {section.id === 'model' && (
          <p className="map-shared">共有する数値：入力Embeddingの重み ↔ LM headの重み</p>
        )}
      </div>
      <dialog
        className="flow-inspection"
        id={panelId}
        ref={dialog}
        aria-label={`${section.title}の詳細`}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        {active && (
          <>
            <header className="flow-inspection-head">
              <div>
                <span className="eyebrow">地点 {index! + 1} の詳細</span>
                <h3>{active.title}</h3>
              </div>
              <button
                type="button"
                onClick={close}
                className="map-close"
                aria-label={`${section.title}の詳細を閉じる`}
              >
                閉じる ×
              </button>
            </header>
            <p className="flow-explanation">{active.explanation}</p>
            <div className="flow-data-row">
              <div className="flow-data">
                <h4>入るデータ</h4>
                <p className="map-detail-value">{active.input}</p>
              </div>
              <div className="flow-data flow-result">
                <h4>出るデータ</h4>
                <p className="map-detail-value">{active.output}</p>
              </div>
            </div>
            <div className="flow-operation">
              <h4>コード・部品</h4>
              <pre>
                <code>{active.code}</code>
              </pre>
            </div>
            <details className="map-conditions">
              <summary>実測条件と注意点</summary>
              <p>{active.note}</p>
            </details>
            <nav className="flow-links" aria-label={`${active.title}の関連情報`}>
              {active.links.map((link) => (
                <a key={link.url} href={withBase(link.url)}>
                  {link.title}
                  <span aria-hidden="true"> ↗</span>
                </a>
              ))}
            </nav>
          </>
        )}
      </dialog>
    </div>
  );
}

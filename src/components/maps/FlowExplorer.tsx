import { useEffect, useRef, useState } from 'react';
import type { MapSection } from '../../data/maps';
import { withBase } from '../../lib/paths';

export default function FlowExplorer({ section }: { section: MapSection }) {
  const [index, setIndex] = useState(0);
  const active = section.steps[index];
  const branches = section.mode === 'branches';
  const panelId = `${section.id}-inspection`;
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const sync = () => {
      const selected = new URLSearchParams(location.search).get(section.id);
      const next = section.steps.findIndex((s) => s.id === selected);
      setIndex(next < 0 ? 0 : next);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [section]);
  function select(next: number) {
    setIndex(next);
    const url = new URL(location.href);
    url.searchParams.set(section.id, section.steps[next].id);
    history.replaceState(null, '', url);
    if (window.matchMedia('(max-width: 999px)').matches) {
      panel.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    }
  }
  return (
    <div className="flow-explorer" data-flow={section.id}>
      <div className="flow-caption">
        {branches ? '変更する場所・役割を選ぶ' : '流れの中で、確かめたい地点を選ぶ'}
      </div>
      <ol
        className={`flow-track ${branches ? 'flow-branches' : ''}`}
        aria-label={`${section.title}の${branches ? '選択肢' : '処理順'}`}
      >
        {section.steps.map((s, i) => (
          <li key={s.id} className={i === index ? 'is-selected' : ''}>
            <button
              type="button"
              aria-pressed={i === index}
              aria-controls={panelId}
              onClick={() => select(i)}
            >
              <span className="flow-node-top">
                <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                <span>{i === index ? '選択中' : branches ? '選ぶ' : '見る'}</span>
              </span>
              <strong>{s.title}</strong>
              <span className="flow-node-output">{s.output.split('\n')[0]}</span>
            </button>
            {!branches && i < section.steps.length - 1 && (
              <span className="flow-connector" aria-hidden="true">
                ↓
              </span>
            )}
          </li>
        ))}
      </ol>
      <section
        className="flow-inspection"
        id={panelId}
        ref={panel}
        aria-label={`${section.title}の選択地点`}
      >
        <div className="flow-inspection-head">
          <div aria-live="polite" aria-atomic="true">
            <span className="eyebrow">
              {branches ? '選択した対象' : '現在の地点'} {index + 1} / {section.steps.length}
            </span>
            <h3>{active.title}</h3>
          </div>
          {!branches && (
            <div className="flow-controls">
              <button
                type="button"
                aria-label={`${section.title}の前の地点`}
                disabled={index === 0}
                onClick={() => select(index - 1)}
              >
                ← 前
              </button>
              <button
                type="button"
                aria-label={`${section.title}の次の地点`}
                disabled={index === section.steps.length - 1}
                onClick={() => select(index + 1)}
              >
                次 →
              </button>
            </div>
          )}
        </div>
        <div className="flow-data-row">
          <div className="flow-data">
            <div className="flow-label">入るデータ</div>
            <pre>{active.input}</pre>
          </div>
          <div className="flow-operation">
            <div className="flow-label">処理するコード・部品</div>
            <pre>
              <code>{active.code}</code>
            </pre>
          </div>
          <div className="flow-data flow-result">
            <div className="flow-label">出るデータ</div>
            <pre>{active.output}</pre>
          </div>
        </div>
        <p className="flow-explanation">{active.explanation}</p>
        <p className="flow-note">{active.note}</p>
        <nav className="flow-links" aria-label={`${active.title}の関連情報`}>
          {active.links.map((link) => (
            <a key={link.url} href={withBase(link.url)}>
              {link.title} <span aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>
      </section>
    </div>
  );
}

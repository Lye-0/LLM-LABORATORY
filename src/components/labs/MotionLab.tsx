import { useEffect, useRef, useState } from 'react';
import { chapters, motionSteps } from '../../data/motion';
import { withBase, withoutBase } from '../../lib/paths';
import MotionScene from './MotionScene';
import reference from '../../data/motion-reference.json';
import { linearCell } from '../../lib/motion-math';

const duration = 5600,
  movement = 3900;
export default function MotionLab() {
  const [index, setIndex] = useState(0),
    [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false),
    [auto, setAuto] = useState(false),
    [speed, setSpeed] = useState(1);
  const [reduced, setReduced] = useState(false),
    [layer, setLayer] = useState(0),
    [allLayers, setAllLayers] = useState(false);
  const [back, setBack] = useState(''),
    [ready, setReady] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const step = motionSteps[index],
    chapter = chapters.find((c) => c.id === step.chapter)!;
  const progress = reduced ? 1 : Math.min(1, elapsed / movement);
  const cell = linearCell(progress);
  function showScene() {
    stage.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function go(next: number, play = false) {
    setIndex(Math.max(0, Math.min(motionSteps.length - 1, next)));
    setElapsed(reduced ? duration : 0);
    setAuto(play && !reduced);
    setRunning(!reduced);
    setAllLayers(false);
  }
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const i = motionSteps.findIndex((s) => s.id === params.get('step'));
    if (i >= 0) setIndex(i);
    const l = Number(params.get('layer'));
    if (Number.isInteger(l) && l >= 0 && l < 28) setLayer(l);
    const from = params.get('from');
    if (from) {
      try {
        const u = new URL(from, location.origin);
        if (u.origin === location.origin && /^\/(maps|learn|labs)\//.test(withoutBase(u.pathname)))
          setBack(u.pathname + u.search + u.hash);
      } catch {
        /* Invalid return URLs are ignored. */
      }
    }
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      if (mq.matches) {
        setReduced(true);
        setRunning(false);
        setAuto(false);
        setElapsed(duration);
      }
    };
    change();
    mq.addEventListener('change', change);
    setReady(true);
    return () => mq.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const url = new URL(location.href);
    url.searchParams.set('step', step.id);
    if (step.kind === 'layers') url.searchParams.set('layer', String(layer));
    else url.searchParams.delete('layer');
    history.replaceState(null, '', url);
    document
      .querySelectorAll<HTMLAnchorElement>('.sidebar a[href*="/motion/?step="]')
      .forEach((a) => {
        const active =
          new URL(a.href).searchParams.get('step') ===
          motionSteps.find((s) => s.chapter === step.chapter)?.id;
        a.classList.toggle('active', active);
        if (active) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
  }, [ready, step.id, step.chapter, step.kind, layer]);
  useEffect(() => {
    if (!running || reduced) return;
    let id = 0,
      last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(80, now - last);
      last = now;
      setElapsed((e) => Math.min(duration, e + delta * speed));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [running, reduced, speed, index, layer]);
  useEffect(() => {
    if (!running || elapsed < duration) return;
    if (step.kind === 'layers' && allLayers && layer < 27) {
      setLayer((l) => l + 1);
      setElapsed(0);
      return;
    }
    if (auto && index < motionSteps.length - 1) {
      setIndex((i) => i + 1);
      setElapsed(0);
      setAllLayers(false);
    } else {
      setRunning(false);
      setAuto(false);
      setAllLayers(false);
    }
  }, [elapsed, running, auto, index, step.kind, allLayers, layer]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) {
        setRunning(false);
        setAuto(false);
      }
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  function chooseLayer(l: number) {
    setLayer(l);
    setElapsed(reduced ? duration : 0);
    setRunning(!reduced);
    setAuto(false);
    setAllLayers(false);
  }
  function toggleMotion(value: boolean) {
    setReduced(value);
    setAuto(false);
    setRunning(false);
    setElapsed(value ? duration : 0);
  }
  function key(e: React.KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    }
    if (e.key === ' ') {
      e.preventDefault();
      setAuto(false);
      if (elapsed >= duration) setElapsed(0);
      setRunning((v) => !v);
    }
  }
  return (
    <div className="motion-lab" data-motion-lab>
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <marker
            id="motion-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
        </defs>
      </svg>
      <header className="motion-intro">
        <div>
          <span className="motion-eyebrow">FOLLOW THE TRANSFORMATION</span>
          <h1>動きで学ぶ</h1>
          <p>一つの文章が、数値になり、層を通り、次のTokenになるまで。</p>
        </div>
        <div className="motion-intro-meta">
          <span>Qwen3-0.6B</span>
          <span>26の段階 · 自分のペースで</span>
        </div>
      </header>
      <nav className="motion-chapters" aria-label="アニメーションの章">
        {chapters.map((c, i) => (
          <button
            type="button"
            key={c.id}
            aria-current={c.id === step.chapter ? 'step' : undefined}
            onClick={() => go(motionSteps.findIndex((s) => s.chapter === c.id))}
          >
            <span>{String(i + 1).padStart(2, '0')}</span>
            {c.title}
          </button>
        ))}
      </nav>
      <div className="motion-current">
        <div>
          <span>{chapter.subtitle}</span>
          <h2 id="motion-title">{step.title}</h2>
          <div className="motion-name">{step.name}</div>
        </div>
        <span className="motion-counter">
          {String(index + 1).padStart(2, '0')} <small>/ {motionSteps.length}</small>
        </span>
      </div>
      <div className="motion-purpose">
        <span>この処理の目的</span>
        <strong>{step.purpose}</strong>
      </div>
      <div className="motion-controls" aria-label="再生の操作">
        <label className="motion-jump">
          段階
          <select
            aria-label="段階を直接選ぶ"
            value={index}
            onChange={(e) => go(Number(e.target.value))}
          >
            {motionSteps.map((s, i) => (
              <option key={s.id} value={i}>
                {String(i + 1).padStart(2, '0')} · {s.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="motion-previous"
          disabled={index === 0}
          onClick={() => go(index - 1)}
          aria-label="前の段階"
        >
          ← 前
        </button>
        <button
          type="button"
          className="motion-play"
          disabled={reduced}
          onClick={() => {
            if (running) {
              setRunning(false);
              setAuto(false);
            } else {
              if (elapsed >= duration) setElapsed(0);
              setAuto(true);
              setRunning(true);
              showScene();
            }
          }}
        >
          {running ? 'Ⅱ 一時停止' : '▶ 連続再生'}
        </button>
        <button
          type="button"
          disabled={index === motionSteps.length - 1}
          onClick={() => go(index + 1)}
        >
          次へ →
        </button>
        <button
          type="button"
          disabled={reduced}
          onClick={() => {
            setElapsed(0);
            setRunning(true);
            setAuto(false);
            showScene();
          }}
        >
          ↺ この動きを再生
        </button>
        <label className="motion-speed">
          速度{' '}
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </label>
        <label className="motion-reduce">
          <input
            type="checkbox"
            checked={reduced}
            onChange={(e) => toggleMotion(e.target.checked)}
          />
          動きを減らす
        </label>
        <label className="motion-scrub">
          <span>
            {reduced
              ? '静止表示'
              : running
                ? '再生中'
                : elapsed >= duration
                  ? 'この段階の結果'
                  : '停止中'}
          </span>
          <input
            aria-label="この段階の再生位置"
            type="range"
            min="0"
            max={duration}
            step="10"
            value={elapsed}
            disabled={reduced}
            onChange={(e) => {
              setRunning(false);
              setAuto(false);
              setElapsed(Number(e.target.value));
            }}
          />
          <span>{Math.round((elapsed / duration) * 100)}%</span>
        </label>
      </div>
      <div
        className="motion-stage"
        ref={stage}
        tabIndex={0}
        onKeyDown={key}
        role="region"
        aria-labelledby="motion-title"
      >
        <MotionScene step={step} p={progress} layer={layer} onLayer={chooseLayer} />
        {step.kind === 'layers' && (
          <button
            type="button"
            className="motion-all-layers"
            disabled={reduced}
            onClick={() => {
              setLayer(0);
              setElapsed(0);
              setAuto(false);
              setRunning(true);
              setAllLayers(true);
            }}
          >
            Layer 0から27まで、順に再生
          </button>
        )}
      </div>
      <div className="motion-explanation">
        <span>いま起きること</span>
        <p>{step.action}</p>
      </div>
      <div className="motion-shapes">
        <div>
          <span>入るデータ</span>
          <code>{step.input}</code>
        </div>
        <span aria-hidden="true">→</span>
        <div>
          <span>出るデータ</span>
          <code>{step.output}</code>
        </div>
      </div>
      <div className="motion-reading">
        <section>
          <div className="motion-reading-title">
            <span>01</span>
            <h3>計算のかたち</h3>
          </div>
          <pre className="motion-equation">
            <code>{step.formula}</code>
          </pre>
          {['linear', 'down', 'logits'].includes(step.kind) && (
            <p className="motion-current-equation">
              いまの小さな例：Y[{cell.row},{cell.column}] = {cell.terms.join(' + ')} = {cell.value}
            </p>
          )}
          <p>図のshapeは実モデルの寸法。小さな数値例では、計算を追えるサイズに縮めています。</p>
        </section>
        <section>
          <div className="motion-reading-title">
            <span>02</span>
            <h3>対応するコード</h3>
          </div>
          <pre>
            <code>
              {step.code.split('\n').map((line, i, lines) => (
                <span
                  key={i}
                  className={
                    i === Math.min(lines.length - 1, Math.floor(progress * lines.length))
                      ? 'motion-code-active'
                      : ''
                  }
                >
                  {line}
                  {i < lines.length - 1 ? '\n' : ''}
                </span>
              ))}
            </code>
          </pre>
          <p>処理に対応する抜粋です。model・layer・mask等の準備は関連教材に記載しています。</p>
        </section>
      </div>
      <div className="motion-neighbors">
        <button type="button" disabled={index === 0} onClick={() => go(index - 1)}>
          <span>前の段階</span>
          {motionSteps[index - 1]?.title ?? 'ここが始まりです'}
        </button>
        <button
          type="button"
          disabled={index === motionSteps.length - 1}
          onClick={() => go(index + 1)}
        >
          <span>次に起きること</span>
          {motionSteps[index + 1]?.title ?? '文章から生成までを追い終えました'}
        </button>
      </div>
      <nav className="motion-related" aria-label="関連する教材へ">
        <a href={withBase(`/learn/${step.lesson}/`)}>仕組みを読む ↗</a>
        <a href={withBase(`/maps/inference/#n-${step.node}`)}>地図のこの地点へ ↗</a>
        {back && <a href={back}>移動元のページへ戻る ↗</a>}
      </nav>
      <details className="motion-guide">
        <summary>表示の読み方・実測データの条件</summary>
        <p>
          青系＝入力、金系＝重み、緑系＝出力。色だけでなく名前・軸・shapeを併記します。小数は表示のみ3桁へ丸め、計算例では丸め前の値を使います。「…」は成分の省略です。
        </p>
        <p>
          TokenizerのID・Embeddingの先頭3成分・層ごとの位置0の先頭8成分は固定モデルの観察データです。revision:{' '}
          <code>{reference.revision}</code>、Transformers {reference.transformers}、
          {reference.dtype}、CPU、記録日 {reference.verifiedAt}
          。その他の数値図はその場の操作を説明する小さな計算例で、実モデルの全出力や実行速度を再現するものではありません。
        </p>
        <p>
          再生は説明の時間です。ブラウザでQwen本体の推論を実行している表示ではありません。上下の分岐は依存関係を示し、GPUでの同時実行の保証ではありません。図にフォーカスした状態で左右キーで段階移動、Spaceでその動きの再生・停止ができます。
        </p>
      </details>
      <p className="motion-screen-reader" role="status" aria-live="polite">
        {step.title}。{step.purpose}
      </p>
    </div>
  );
}

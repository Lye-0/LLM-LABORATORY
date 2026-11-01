import { journeyPhaseLabel, LAYERS_START, LAYERS_END } from '../../lib/journey-timing';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  journeyAt,
  journeyDuration,
  journeyGroups,
  journeyIndex,
  journeyStarts,
  journeySteps,
} from '../../data/journey';
import { sampleJourney } from '../../lib/journey-scene';
import { withBase, withoutBase } from '../../lib/paths';
import { operationFormulas, mathDocument } from '../../lib/journey-formulas';
import JourneyCanvas from './JourneyCanvas';
import JourneyShapeCanvas from './JourneyShapeCanvas';
import { shapeGuide, shapeOperations } from '../../lib/journey-shapes';
const NumericJourneyCanvas = memo(
  ({
    sample,
    reduced,
  }: {
    sample: ReturnType<typeof sampleJourney>;
    active: boolean;
    reduced: boolean;
  }) => <JourneyCanvas sample={sample} reduced={reduced} />,
  (previous, next) =>
    !next.active ||
    (previous.active && previous.sample === next.sample && previous.reduced === next.reduced),
);

export default function MotionLab() {
  const [time, setTime] = useState(0),
    [view, setView] = useState<'numbers' | 'shapes'>('numbers'),
    [running, setRunning] = useState(false),
    [destination, setDestination] = useState<number | null>(null),
    [speed, setSpeed] = useState(1),
    [reduced, setReduced] = useState(false),
    [back, setBack] = useState(''),
    [ready, setReady] = useState(false);
  const rail = useRef<HTMLDivElement>(null),
    manualRailUntil = useRef(0);
  const canvasScroll = useRef<HTMLDivElement>(null);
  const sample = useMemo(() => sampleJourney(time), [time]),
    { index, step } = sample,
    group = journeyGroups.find((g) => g.id === step.group)!;
  const previous = journeySteps[index - 1],
    next = journeySteps[index + 1];
  function writePosition(t: number) {
    const u = new URL(location.href),
      at = journeyAt(t);
    u.searchParams.set('step', journeySteps[at.index].id);
    u.searchParams.set('t', String(Math.round(at.time)));
    u.searchParams.delete('layer');
    history.replaceState(null, '', u);
  }
  function seek(t: number) {
    const safe = journeyAt(t).time;
    setTime(safe);
    setRunning(false);
    setDestination(null);
    writePosition(safe);
  }
  function changeView(value: 'numbers' | 'shapes') {
    setView(value);
    const u = new URL(location.href);
    if (value === 'shapes') u.searchParams.set('view', 'shapes');
    else u.searchParams.delete('view');
    history.replaceState(null, '', u);
  }
  function go(i: number) {
    const target = Math.max(0, Math.min(journeySteps.length - 1, i));
    seek(journeyStarts[target] + (reduced ? journeySteps[target].duration * 0.95 : 0));
  }
  function togglePlay() {
    setDestination(null);
    if (running) {
      setRunning(false);
      writePosition(time);
    } else {
      if (time >= journeyDuration) setTime(0);
      setRunning(true);
    }
  }
  function move(i: number) {
    if (reduced) {
      go(i);
      return;
    }
    setDestination(journeyStarts[Math.max(0, Math.min(journeySteps.length - 1, i))]);
    setRunning(true);
  }
  useEffect(() => {
    function restore() {
      const params = new URLSearchParams(location.search),
        raw = params.get('t');
      setView(params.get('view') === 'shapes' ? 'shapes' : 'numbers');
      let t =
        raw !== null && Number.isFinite(Number(raw))
          ? journeyAt(Number(raw)).time
          : journeyStarts[journeyIndex(params.get('step'))];
      const layer = Number(params.get('layer'));
      if (
        params.get('step') === 'layers' &&
        params.has('layer') &&
        Number.isInteger(layer) &&
        layer >= 0 &&
        layer <= 27
      )
        t =
          journeyStarts[journeyIndex('layers')] +
          journeySteps[journeyIndex('layers')].duration *
            (layer === 0 ? 0 : LAYERS_START + ((layer - 0.5) / 27) * (LAYERS_END - LAYERS_START));
      setTime(t);
      setRunning(false);
      const from = params.get('from');
      if (from)
        try {
          const u = new URL(from, location.origin);
          if (
            u.origin === location.origin &&
            /^\/(maps|learn|labs)\//.test(withoutBase(u.pathname))
          )
            setBack(u.pathname + u.search + u.hash);
        } catch {
          /* Invalid return URLs are ignored. */
        }
    }
    restore();
    const drawing = canvasScroll.current;
    if (drawing) drawing.scrollLeft = Math.max(0, (drawing.scrollWidth - drawing.clientWidth) / 2);
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      setReduced(mq.matches);
      if (mq.matches) setRunning(false);
    };
    change();
    mq.addEventListener('change', change);
    const pause = () => {
      if (document.hidden) setRunning(false);
    };
    document.addEventListener('visibilitychange', pause);
    window.addEventListener('popstate', restore);
    setReady(true);
    return () => {
      mq.removeEventListener('change', change);
      document.removeEventListener('visibilitychange', pause);
      window.removeEventListener('popstate', restore);
    };
  }, []);
  useEffect(() => {
    if (!running || reduced) return;
    let frame = 0,
      last: number | null = null;
    const end = destination ?? journeyDuration,
      direction = end < time ? -1 : 1;
    const tick = (now: number) => {
      const delta = last === null ? 0 : Math.max(0, Math.min(100, now - last));
      last = last === null ? now : Math.max(last, now);
      setTime((t) =>
        direction > 0 ? Math.min(end, t + delta * speed) : Math.max(end, t - delta * speed),
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, reduced, speed, destination]);
  useEffect(() => {
    if (
      running &&
      (time >= journeyDuration || (destination !== null && Math.abs(time - destination) < 0.01))
    ) {
      setRunning(false);
      setDestination(null);
      writePosition(time);
    }
  }, [time, running, destination]);
  useEffect(() => {
    if (!ready) return;
    writePosition(time);
    const active = rail.current?.querySelector<HTMLElement>('[aria-current="step"]');
    if (active && rail.current && Date.now() > manualRailUntil.current)
      rail.current.scrollTo({
        left:
          rail.current.scrollLeft +
          active.getBoundingClientRect().left -
          rail.current.getBoundingClientRect().left -
          rail.current.clientWidth / 2 +
          active.clientWidth / 2,
        behavior: reduced ? 'instant' : 'smooth',
      });
    document
      .querySelectorAll<HTMLAnchorElement>('.sidebar a[href*="/motion/?step="]')
      .forEach((a) => {
        const isActive = new URL(a.href).searchParams.get('step') === group.first;
        a.classList.toggle('active', isActive);
        if (isActive) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
  }, [index, ready, group.first, reduced]);
  function key(e: React.KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      move(index + 1);
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      move(index - 1);
    }
    if (e.key === ' ' && !reduced) {
      e.preventDefault();
      togglePlay();
    }
  }
  const totalSeconds = Math.round(journeyDuration / 1000),
    elapsedSeconds = Math.floor(time / 1000);
  return (
    <div
      className="journey"
      data-motion-lab
      data-journey-time={time}
      data-journey-view={view}
      style={{ '--journey-color': group.color } as React.CSSProperties}
    >
      <header className="journey-heading">
        <div>
          <span className="journey-eyebrow">ONE CONTINUOUS JOURNEY</span>
          <h1>動きで学ぶ</h1>
        </div>
        <p>
          ひとつの文章を、最後まで。
          <br />
          <span>前の出力が、そのまま次の入力になる。</span>
        </p>
      </header>
      <section className="journey-current" aria-labelledby="motion-title">
        <span className="journey-group-number">{group.no}</span>
        <div>
          <p>
            {group.title} <span>／ {step.name}</span>
          </p>
          <h2 id="motion-title">{step.title}</h2>
          <span className="journey-phase">
            {journeyPhaseLabel(step.id, sample.progress, sample.calculation)}
          </span>
          <span className="journey-position-note">
            {view === 'numbers'
              ? '淡い枠は追跡位置。オレンジは今の処理対象。行列積は行×全列をまとめて進めます。'
              : 'Qwen3-0.6Bの形と軸を表示 · B=1。寸法は正確、図の比率は模式的。色は処理対象で、参照割合の大小ではありません。'}
          </span>
        </div>
        <span className="journey-count">
          {String(index + 1).padStart(2, '0')} <small>/ {journeySteps.length}</small>
        </span>
      </section>
      <div
        className="journey-theater"
        tabIndex={0}
        onKeyDown={key}
        role="region"
        aria-label="連続するデータの動き"
      >
        <aside className="journey-before">
          <span>ここまでに</span>
          <h3>{previous?.short ?? 'この文章から出発'}</h3>
          <p>{previous?.output ?? 'こんにちは、今日はいい天気ですね'}</p>
        </aside>
        <aside className="journey-after">
          <span>この先で</span>
          <h3>{next?.short ?? 'ひとつの生成が完成'}</h3>
          <p>{next?.purpose ?? '終了条件までは、次のTokenを選ぶループへ戻ります。'}</p>
        </aside>
        <div className="journey-canvas-scroll" ref={canvasScroll}>
          <div hidden={view !== 'numbers'}>
            <NumericJourneyCanvas sample={sample} active={view === 'numbers'} reduced={reduced} />
          </div>
          <div hidden={view !== 'shapes'}>
            {view === 'shapes' && <JourneyShapeCanvas sample={sample} reduced={reduced} />}
          </div>
        </div>
        <p className="journey-caption">
          {view === 'numbers'
            ? sample.caption
            : shapeGuide(step.id) || shapeOperations(step.id)[0]?.text}
        </p>
      </div>
      <div className="journey-action">
        <span>いま、起きていること</span>
        <p>{step.action}</p>
      </div>
      <div className="journey-orbit-footer">
        <section className="journey-formula">
          <span>計算のかたち</span>
          <div
            className="journey-reference-math"
            dangerouslySetInnerHTML={{
              __html: operationFormulas(
                step.id,
                step.id === 'qkv'
                  ? 'q'
                  : step.id === 'heads'
                    ? 'q-norm'
                    : step.id === 'gate'
                      ? 'gate'
                      : step.id,
              )
                .map(mathDocument)
                .join(''),
            }}
          />
          <p className="journey-formula-guide">
            {view === 'numbers'
              ? '具体的な計算は、中央の行列に添えた「処理」で確認できます。'
              : '中央の図で、掛け合わせる軸と結果に残る軸を確認できます。実モデル全体の数値計算は実行していません。'}
          </p>
          <p className="journey-dimensions">
            実モデル：{step.input} → {step.output}
          </p>
        </section>
        <section className="journey-code">
          <span>この動きに対応するコード</span>
          <pre>
            <code>
              {step.code.split('\n').map((line, i, all) => (
                <span
                  key={i}
                  className={
                    sample.calculation > 0 &&
                    i === Math.min(all.length - 1, Math.floor(sample.calculation * all.length))
                      ? 'active'
                      : ''
                  }
                >
                  {line}
                  {i < all.length - 1 ? '\n' : ''}
                </span>
              ))}
            </code>
          </pre>
        </section>
      </div>
      <nav className="journey-related" aria-label="関連する教材へ">
        <a href={withBase(`/learn/${step.lesson}/`)}>仕組みを読む ↗</a>
        <a href={withBase(`/maps/inference/#n-${step.node}`)}>地図のこの地点へ ↗</a>
        {back && <a href={back}>移動元のページへ戻る ↗</a>}
      </nav>
      <details className="journey-guide">
        <summary>図の読み方・数値と省略について</summary>
        <p>
          TokenとID、およびEmbeddingの先頭3成分は固定revisionのQwen3-0.6Bの観察値です。その後は、表示した3成分を全幅として扱う説明用の小さなモデルで、前の計算結果を次へ渡します。実モデルの1024成分や全151936候補の推論結果ではありません。7位置・Q
          2 Heads（各3成分）・共有KV 1
          Head・MLP幅6・候補3つへ縮め、数値は表示時のみ小数2桁へ丸めています。式とコードのshapeは実モデルに対応します。
        </p>
        <p>
          色に加えて名前でも入力・重み・出力・保存した経路を区別します。転置は同じ要素の行と列の交換、RoPEは成分ペアの回転です。省略した軸や層はラベルで明示します。KV
          Cacheの各マスは1位置のベクトルを表す構造図です。
        </p>
        <p>
          図にフォーカスした状態で左右キーで工程移動、Spaceで再生・停止。動きを減らした場合も全体バーで結果をたどれます。これは説明の時間軸で、実モデルの実行時間を表すものではありません。
        </p>
      </details>
      <footer className="journey-dock" aria-label="全工程の再生操作">
        <nav
          className="journey-rail"
          aria-label="すべての処理"
          ref={rail}
          onWheel={() => {
            manualRailUntil.current = Date.now() + 3000;
          }}
          onPointerDown={() => {
            manualRailUntil.current = Date.now() + 3000;
          }}
        >
          {journeyGroups.map((g) => (
            <div
              className="journey-rail-group"
              key={g.id}
              style={{ '--rail-color': g.color } as React.CSSProperties}
            >
              <span>
                {g.no} {g.title}
              </span>
              <div>
                {journeySteps.map((s, i) =>
                  s.group === g.id ? (
                    <button
                      type="button"
                      key={s.id}
                      data-step={s.id}
                      aria-current={i === index ? 'step' : undefined}
                      onClick={() => go(i)}
                    >
                      {s.short}
                    </button>
                  ) : null,
                )}
              </div>
            </div>
          ))}
        </nav>
        <div className="journey-transport">
          <button
            type="button"
            aria-label="前の工程"
            disabled={index === 0}
            onClick={() => move(index - 1)}
          >
            ←
          </button>
          <button type="button" className="journey-play" disabled={reduced} onClick={togglePlay}>
            {running ? 'Ⅱ 一時停止' : '▶ 全体を再生'}
          </button>
          <button
            type="button"
            aria-label="次の工程"
            disabled={index === journeySteps.length - 1}
            onClick={() => move(index + 1)}
          >
            →
          </button>
          <span className="journey-time">
            {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}{' '}
            <small>
              / {Math.floor(totalSeconds / 60)}:{String(totalSeconds % 60).padStart(2, '0')}
            </small>
          </span>
          <div className="journey-speed" aria-label="再生速度">
            {[0.5, 1, 2].map((v) => (
              <button type="button" key={v} aria-pressed={v === speed} onClick={() => setSpeed(v)}>
                {v}×
              </button>
            ))}
          </div>
          <div className="journey-view-switch" role="group" aria-label="行列の表示方法">
            <button
              type="button"
              aria-pressed={view === 'numbers'}
              onClick={() => changeView('numbers')}
            >
              数値で見る
            </button>
            <button
              type="button"
              aria-pressed={view === 'shapes'}
              onClick={() => changeView('shapes')}
            >
              形と軸で見る
            </button>
          </div>
          <label className="journey-reduce">
            <input
              type="checkbox"
              checked={reduced}
              onChange={(e) => {
                setReduced(e.target.checked);
                setRunning(false);
              }}
            />
            動きを減らす
          </label>
        </div>
        <div className="journey-track">
          <div aria-hidden="true">
            {journeyGroups.map((g) => {
              const start = journeyStarts[journeyIndex(g.first)],
                sum = journeySteps
                  .filter((s) => s.group === g.id)
                  .reduce((v, s) => v + s.duration, 0);
              return (
                <span
                  key={g.id}
                  style={{
                    left: `${(start / journeyDuration) * 100}%`,
                    width: `${(sum / journeyDuration) * 100}%`,
                    background: g.color,
                  }}
                />
              );
            })}
          </div>
          <input
            type="range"
            min="0"
            max={journeyDuration}
            step="10"
            value={time}
            aria-label="最初から最後までの再生位置"
            aria-valuetext={`${step.name}、全体の${Math.round((time / journeyDuration) * 100)}パーセント`}
            onChange={(e) => seek(Number(e.target.value))}
          />
        </div>
      </footer>
      <p className="journey-sr" role="status" aria-live="polite">
        {step.title}。{step.purpose}
      </p>
    </div>
  );
}

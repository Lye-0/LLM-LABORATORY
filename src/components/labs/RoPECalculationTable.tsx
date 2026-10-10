import { memo, useEffect, useRef } from 'react';
import { allowed, ropeK, ropeQ } from '../../lib/rope';
import {
  dotExpansion,
  num,
  op,
  primed,
  rotated,
  rotation,
  rotationSymbol,
  scoreLines,
  sub,
  trans,
  vector,
} from '../../lib/rope-math';
function MathBlock({ xml }: { xml: string }) {
  return (
    <div
      className="rope-inline-math"
      dangerouslySetInnerHTML={{
        __html: `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${xml}</math>`,
      }}
    />
  );
}
const HeadCalculation = memo(function HeadCalculation({
  type,
  pos,
}: {
  type: 'Q' | 'K';
  pos: number;
}) {
  const v = type === 'Q' ? ropeQ[pos] : ropeK[pos];
  return (
    <div className="rope-head-calculation">
      <h4>
        {type}
        {pos}の回転
      </h4>
      <p>元の4成分 [0,1,64,65]</p>
      <MathBlock xml={sub(type, pos) + op('=') + vector(v)} />
      <p>① 位置{pos}で回転する</p>
      <MathBlock xml={primed(type, pos) + op('=') + rotation(pos) + vector(v)} />
      <p>
        ② 回転を完了した{type}′{pos}
      </p>
      <MathBlock xml={primed(type, pos) + op('=') + rotated(v, pos)} />
    </div>
  );
});
const Calculation = memo(function Calculation({ p, t }: { p: number; t: number }) {
  const q = ropeQ[p],
    k = ropeK[t];
  return (
    <div className="rope-cell-calculation">
      <p>① 完成したQ′とK′で、head全体の内積</p>
      <MathBlock
        xml={
          trans(primed('Q', p)) +
          primed('K', t) +
          op('=') +
          trans(rotationSymbol(p) + sub('Q', p)) +
          '<mrow>' +
          op('(') +
          rotationSymbol(t) +
          sub('K', t) +
          op(')') +
          '</mrow>'
        }
      />
      <MathBlock
        xml={
          op('=') + trans(sub('Q', p)) + trans(rotationSymbol(p)) + rotationSymbol(t) + sub('K', t)
        }
      />
      <MathBlock xml={op('=') + trans(sub('Q', p)) + rotationSymbol(p, t) + sub('K', t)} />
      <p>② 元の整数値と相対回転行列を代入</p>
      <MathBlock xml={vector(q, true) + rotation(p, t) + vector(k)} />
      <p>③ 相対回転行列とKを掛ける</p>
      <MathBlock xml={rotationSymbol(p, t) + sub('K', t) + op('=') + rotated(k, p, t)} />
      <p>④ 4成分の寄与を足し合わせる（他124成分は0）</p>
      <MathBlock xml={dotExpansion(p, t)} />
      <div className="rope-cell-answer">
        <p>⑤ 内積Sの最終式（√128で割る前）</p>
        <MathBlock
          xml={
            `<msub><mi>S</mi><mrow>${num(p)}<mo>,</mo>${num(t)}</mrow></msub>` +
            op('=') +
            scoreLines(p, t)
          }
        />
      </div>
      <p>
        {allowed(p, t)
          ? 'Attentionではこの値を√128で割り、行ごとのsoftmaxへ。'
          : '未来位置：mask後は−∞、softmax後の重みは0。'}
      </p>
    </div>
  );
});
export default function RoPECalculationTable({
  p,
  t,
  future,
  jump,
  onSelect,
}: {
  p: number;
  t: number;
  future: boolean;
  jump: number;
  onSelect: (p: number, t: number) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  function move(kind: 'cell' | 'q' | 'k' | 'start') {
    const el = viewport.current;
    if (!el) return;
    const target =
      kind === 'cell'
        ? el.querySelector<HTMLElement>(`[data-pair="${p}-${t}"]`)
        : kind === 'q'
          ? el.querySelector<HTMLElement>(`[data-q-rotation="${p}"]`)
          : kind === 'k'
            ? el.querySelector<HTMLElement>(`[data-k-rotation="${t}"]`)
            : null;
    if (!target) {
      el.scrollTo({ left: 0, top: 0, behavior: 'instant' });
      return;
    }
    const a = el.getBoundingClientRect(),
      r = target.getBoundingClientRect();
    el.scrollTo({
      left: kind === 'q' ? 0 : el.scrollLeft + r.left - a.left - 54,
      top: kind === 'k' ? 0 : el.scrollTop + r.top - a.top - 36,
      behavior: 'instant',
    });
  }
  useEffect(() => {
    move('cell');
  }, [p, t, jump, future]);
  return (
    <div className="rope-calculation-view">
      <p>
        回転は上端のK・左端のQ、内積は交点に展開しています。RₚᵀRₜ =
        Rₜ₋ₚは同じ内積の書き換えです。表全体を縦・横にスクロールできます。
      </p>
      <div className="rope-controls">
        <button type="button" onClick={() => move('start')}>
          表の先頭へ
        </button>
        <button type="button" onClick={() => move('q')}>
          Q{p}の回転へ
        </button>
        <button type="button" onClick={() => move('k')}>
          K{t}の回転へ
        </button>
        <button type="button" onClick={() => move('cell')}>
          選択中の計算へ
        </button>
      </div>
      <div
        ref={viewport}
        className="rope-calculation-scroll"
        role="region"
        aria-label="回転と内積の計算一覧（縦横にスクロール可能）"
        tabIndex={0}
      >
        <table className="rope-calculation-table">
          <caption className="sr-only">Q/Kの回転と7×7の内積計算</caption>
          <colgroup>
            <col className="rope-label-column" />
            <col className="rope-q-column" />
            {ropeK.map((_, i) => (
              <col key={i} className="rope-pair-column" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Q＼K</th>
              <th scope="col">Qの回転</th>
              {ropeK.map((_, i) => (
                <th scope="col" key={i} className={i === t ? 'is-axis-selected' : ''}>
                  K{i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <span>K回転</span>
              </th>
              <td className="rope-table-guide">
                <h4>回転 → head全体の内積</h4>
                <p>
                  行：Qの位置p
                  <br />
                  列：Kの位置t
                </p>
                <p>
                  各見出しでQ/Kの回転を完了し、交点で内積を求めます。64ペアのうち、値を持つ2ペアの4成分を表示しています。
                </p>
                <p>式は説明用の仮定値です。三角関数は記号のまま扱います。</p>
              </td>
              {ropeK.map((_, i) => (
                <td key={i} data-k-rotation={i} className={i === t ? 'is-axis-selected' : ''}>
                  <HeadCalculation type="K" pos={i} />
                </td>
              ))}
            </tr>
            {ropeQ.map((_, i) => (
              <tr key={i}>
                <th scope="row" className={i === p ? 'is-axis-selected' : ''}>
                  <span>Q{i}</span>
                </th>
                <td data-q-rotation={i} className={i === p ? 'is-axis-selected' : ''}>
                  <HeadCalculation type="Q" pos={i} />
                </td>
                {ropeK.map((_, j) => (
                  <td
                    key={j}
                    data-pair={`${i}-${j}`}
                    className={`${i === p || j === t ? 'is-related ' : ''}${i === p && j === t ? 'is-pair-selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="rope-pair-select"
                      aria-pressed={p === i && t === j}
                      disabled={!future && !allowed(i, j)}
                      onClick={() => onSelect(i, j)}
                    >
                      Q{i} × K{j}を選択
                    </button>
                    <p>
                      p={i}、t={j} ／ t−p={j}−{i}={j - i} ／{' '}
                      {allowed(i, j) ? '○ 参照可能' : '× 未来位置・mask対象'}
                    </p>
                    {future || allowed(i, j) ? (
                      <Calculation p={i} t={j} />
                    ) : (
                      <p>
                        未来位置のためmask対象です。「未来位置の内積も調べる」を有効にすると、計算過程を表示できます。
                      </p>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

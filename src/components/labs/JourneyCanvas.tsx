import JourneySliceContext from './JourneySliceContext';
import { actorId, projectionActors, binaryActors } from '../../lib/journey-actors';
import { calculationFocus, completedRow, traceRow, rotationDegrees } from '../../lib/journey-trace';
import type { Entity, JourneySample } from '../../lib/journey-scene';
import { layoutJourneyNotes } from '../../lib/journey-note-layout';
import { mathDocument } from '../../lib/journey-formulas';
import { journeyOperations } from '../../lib/journey-operations';
import * as model from '../../lib/journey-model';
import { clamp, ease, activeEntities } from '../../lib/journey-timing';
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export function numberLabel(v: number | string) {
  return typeof v === 'string' ? v : v === -Infinity ? '−∞' : Number(v.toFixed(2)).toString();
}
type MovingEntity = JourneySample['entities'][number];
export function JourneyTensor({
  entity: e,
  progress,
  step,
  calculation,
  view = 'numbers',
}: {
  entity: MovingEntity;
  progress: number;
  step: string;
  calculation: number;
  view?: 'numbers' | 'shapes';
}) {
  if (step === 'o-proj' && e.id === 'context-head-1') return null;
  const active = activeEntities(step, e.id);
  const saving = (step === 'norm' || step === 'post-norm') && e.id.startsWith('skip');
  const a = e.start,
    b = e.end;
  const phase =
    step === 'sampling' && e.id === 'prob'
      ? clamp((progress - 0.6) / 0.16)
      : step === 'sampling' && e.id === 'chosen'
        ? clamp((progress - 0.82) / 0.1)
        : calculation;
  const projection = projectionActors(step);
  const binary = binaryActors(step);
  const outputFrame = projection?.output === e.id || binary?.output === e.id;
  const updating = a.data !== b.data;
  const born = a.opacity === 0 && b.opacity > 0;
  const isParameter = e.id === 'weight' || e.id.startsWith('weight-');
  const isOperand = projection?.input === e.id || binary?.input === e.id || binary?.second === e.id;
  const held = step === 'cache' || (step === 'append' && e.id.startsWith('id-'));
  const splitLabel =
    step !== 'heads'
      ? null
      : e.id === 'q'
        ? progress < 0.08
          ? a.label
          : phase === 0
            ? 'Q · 分割した3成分'
            : phase < 1
              ? 'Q · 正規化中'
              : b.label.replace(' Head 0', '')
        : e.id === 'k'
          ? phase === 0
            ? 'K · 3成分'
            : phase < 1
              ? 'K · 正規化中'
              : b.label.replace('共有K Head 0', 'K')
          : null;

  const rows = outputFrame ? b.data.length : Math.max(a.data.length, b.data.length),
    cols =
      (step === 'heads' && e.id === 'q') || (step === 'concat' && e.id === 'attn')
        ? 3
        : outputFrame
          ? b.data[0].length
          : Math.max(a.data[0]?.length ?? 0, b.data[0]?.length ?? 0);
  const get = (pose: Entity, i: number, j: number) => ({
    x: pose.transpose ? i * pose.w : j * pose.w,
    y: pose.transpose ? j * pose.h : i * pose.h,
  });
  return (
    <g
      data-entity={view === 'numbers' ? e.id : undefined}
      data-shape-entity={view === 'shapes' ? e.id : undefined}
      data-role={
        e.tone === 'saved'
          ? 'saved'
          : isOperand
            ? 'operand'
            : e.id.startsWith('weight')
              ? 'parameter'
              : outputFrame
                ? 'result'
                : 'value'
      }
      transform={`translate(${e.x},${e.y})`}
      opacity={Math.max(0, Math.min(1, e.opacity))}
      className={`journey-tensor tone-${e.tone} ${active ? 'is-active' : 'is-support'}`}
    >
      <text y="-16" className="tensor-label" opacity={saving ? ease((progress - 0.44) / 0.16) : 1}>
        {splitLabel !== null
          ? splitLabel
          : step === 'concat' && e.id === 'attn'
            ? 'Head 0の結果'
            : held
              ? b.label
              : step === 'sampling' && e.id === 'prob'
                ? phase < 1
                  ? progress < 0.6
                    ? '末尾のLogits · 取り出し中'
                    : '末尾のLogits · Softmax中'
                  : b.label
                : outputFrame
                  ? b.label + (phase < 1 ? (phase > 0 ? ' · 構築中' : ' · 計算待ち') : '')
                  : phase > 0
                    ? b.label + (updating && phase < 1 ? ' · 更新中' : '')
                    : a.label}
      </text>
      {Array.from({ length: rows }, (_, i) =>
        Array.from({ length: cols }, (_, j) => {
          const old = a.data[i]?.[j],
            next = b.data[i]?.[j],
            rowReady = completedRow(phase, i, b.data.length),
            value = outputFrame
              ? (next ?? '')
              : ((updating && rowReady ? next : old) ?? next ?? '');
          const start = get(a, i, j),
            end = get(b, i, j);
          let x = lerp(start.x, end.x, e.blend),
            y = lerp(start.y, end.y, e.blend);
          let traveling = false;
          if (step === 'transpose' && e.id === 'k') {
            const local = Math.max(
              0,
              Math.min(1, Math.max(0, (progress - 0.6) / 0.32) * rows * cols - (i * cols + j)),
            );
            traveling = local > 0 && local < 1;
            const corridor = 300 + j * 28;
            x =
              local < 0.25
                ? lerp(start.x, corridor, local / 0.25)
                : local < 0.65
                  ? corridor
                  : lerp(corridor, end.x, (local - 0.65) / 0.35);
            y =
              local < 0.25
                ? start.y
                : local < 0.65
                  ? lerp(start.y, end.y, (local - 0.25) / 0.4)
                  : end.y;
          }
          const present = next === undefined ? 1 - phase : old === undefined ? phase : 1;
          const ready =
            held || (step === 'sampling' && e.id === 'prob')
              ? true
              : step === 'sampling' && e.id === 'chosen'
                ? progress > 0.86
                : outputFrame
                  ? phase > 0 && rowReady
                  : !born || isParameter || isOperand || (phase > 0 && rowReady);
          const text = numberLabel(value),
            font =
              e.font ??
              (e.plain
                ? e.id === 'result'
                  ? 30
                  : 15
                : Math.min(17, (e.w - 8) / (text.length * 0.6)));
          return (
            <g
              key={`${i}-${j}`}
              data-cell={`${e.id}:${i}:${j}`}
              data-value={String(value)}
              data-ready={ready}
              data-updated={updating && rowReady}
              data-x={e.x + x}
              data-y={e.y + y}
              transform={`translate(${x},${y})`}
              opacity={
                Math.max(0, present) *
                (step === 'cache' &&
                e.id.startsWith('cache-') &&
                !e.id.startsWith('cache-new-') &&
                j === 7
                  ? ease((progress - 0.65) / 0.25)
                  : 1) *
                (step === 'transpose' &&
                e.id === 'k' &&
                progress > 0.6 &&
                progress < 0.92 &&
                !traveling
                  ? 0.4
                  : 1)
              }
            >
              {!e.plain && (
                <rect
                  width={Math.max(12, e.w - 4)}
                  height={Math.max(12, e.h - 3)}
                  rx="4"
                  opacity={step === 'tokenize' ? ease((progress - 0.18) / 0.54) : 1}
                  className={
                    (i === 6 ? 'last-position ' : '') +
                    (step === 'o-proj' && e.id === 'attn' && j >= 3 ? 'head-one-component ' : '') +
                    (step === 'cache' &&
                    (e.id.startsWith('cache-new-') || (e.id.startsWith('cache-') && j === 7))
                      ? 'new-cache-position '
                      : '') +
                    (calculationFocus(step, e.id, phase, i, j) ||
                    traveling ||
                    (step === 'sampling' &&
                      e.id === 'prob' &&
                      ((progress > 0.6 && progress < 0.76) ||
                        (progress >= 0.82 && j === model.chosen))) ||
                    (step === 'cache' &&
                      (e.id.startsWith('cache-new-') || (e.id.startsWith('cache-') && j === 7)) &&
                      progress > 0.65 &&
                      progress < 0.92)
                      ? 'calculation-component '
                      : '') +
                    (step === 'decode' &&
                    progress > 0.58 &&
                    progress < 0.86 &&
                    ((e.id.startsWith('id-') &&
                      Number(e.id.slice(3)) ===
                        Math.min(7, Math.floor(clamp((progress - 0.58) / 0.28) * 8))) ||
                      (e.id === 'chosen' && Math.floor(clamp((progress - 0.58) / 0.28) * 8) === 7))
                      ? 'calculation-component '
                      : '') +
                    (step === 'mask' && j > i ? 'future-position' : '')
                  }
                />
              )}
              <text
                x={e.w / 2 - 2}
                y={e.h / 2 + 4}
                textAnchor="middle"
                style={{ fontSize: font }}
                opacity={saving ? ease((progress - 0.44) / 0.16) : 1}
              >
                {step === 'decode' && e.id === 'result'
                  ? model.generated.pieces
                      .slice(0, Math.floor(clamp((progress - 0.58) / 0.28) * 8))
                      .join('')
                  : ready
                    ? text
                    : '·'}
              </text>
            </g>
          );
        }),
      )}
    </g>
  );
}
/** Shared token boundaries retain the same cues in both representations. */
export function JourneyTokenCuts({ sample }: { sample: JourneySample }) {
  const { entities, progress: p } = sample;
  const byId = Object.fromEntries(entities.map((e) => [e.id, e]));
  return (
    <>
      {sample.step.id === 'tokenize' &&
        entities
          .filter((e) => e.id.startsWith('token-'))
          .slice(1)
          .map((e, i) => {
            const left = byId[`token-${i}`];
            const x = (left.x + left.w + e.x) / 2;
            return (
              <g
                key={e.id}
                className="journey-cut"
                opacity={ease(p / 0.15) * (1 - clamp((p - 0.7) / 0.18))}
              >
                <path d={`M${x},${e.y - 9} v${e.h + 18}`} />
                <circle cx={x} cy={e.y - 12} r="2.5" />
              </g>
            );
          })}
    </>
  );
}
/** The same waiting-area language and separator are used with either matrix view. */
export function JourneyStorage({
  height,
  boundary = 175,
  textX = 35,
}: {
  height: number;
  boundary?: number;
  textX?: number;
}) {
  return (
    <g className="journey-storage" aria-label="待機・保存中の値。現在の演算には含めない">
      <path d={`M${boundary},135 V${height}`} />
      <text x={textX} y="145">
        待機・保存
      </text>
      <text x={textX} y="165" className="storage-caption">
        ここでは計算しない
      </text>
    </g>
  );
}
export function JourneyRotationGlyph({
  x,
  y,
  before = 0,
  angle,
  position,
  marker,
}: {
  x: number;
  y: number;
  before?: number;
  angle: number;
  position: number;
  marker: string;
}) {
  return (
    <g transform={`translate(${x},${y})`} className="journey-rotation">
      <circle r="31" />
      <path d="M0,0 H31" />
      <path d="M0,0 H30" transform={`rotate(${before})`} opacity=".45" strokeDasharray="3 3" />
      <g transform={`rotate(${angle})`}>
        <path d="M0,0 H30" className="rotating-vector" markerEnd={`url(#${marker})`} />
      </g>
      <text y="55" textAnchor="middle">
        位置{position}の成分ペア
      </text>
    </g>
  );
}
function center(e: MovingEntity, side: 'left' | 'right') {
  return {
    x: e.x + (side === 'right' ? (e.transpose ? e.data.length : e.data[0].length) * e.w : 0),
    y: e.y + ((e.transpose ? e.data[0].length : e.data.length) * e.h) / 2,
  };
}
export default function JourneyCanvas({
  sample,
  reduced = false,
}: {
  sample: JourneySample;
  reduced?: boolean;
}) {
  const { step, entities, progress: p } = sample;
  const byId = Object.fromEntries(entities.map((e) => [e.id, e]));
  byId.attn = byId[actorId(step.id, 'attn')];
  byId.gate = byId[actorId(step.id, 'gate')];
  const operation = journeyOperations(sample);
  const noteLayout = layoutJourneyNotes(sample, operation.notes);
  const links: [string, string][] =
    step.id === 'qkv'
      ? [
          ['hidden', 'weight-q'],
          ['hidden', 'weight-k'],
          ['hidden', 'weight-v'],
          ['weight-q', 'q'],
          ['weight-k', 'k'],
          ['weight-v', 'v'],
        ]
      : step.id === 'gate'
        ? [
            ['attn', 'weight-gate'],
            ['weight-gate', 'gate'],
            ['attn', 'weight-up'],
            ['weight-up', 'up'],
          ]
        : step.id === 'weighted'
          ? [
              ['score', 'v'],
              ['v', 'attn'],
            ]
          : step.id === 'scores'
            ? [
                ['q', 'k'],
                ['k', 'score'],
              ]
            : [];
  return (
    <svg
      viewBox={`0 0 1000 ${noteLayout.height}`}
      className="journey-svg"
      role="img"
      aria-label={`${step.name}。${step.action}`}
      data-journey-scene
    >
      {entities.some(
        (e) =>
          (e.tone === 'saved' ||
            (e.id === 'v' &&
              ['heads', 'rope', 'transpose', 'scores', 'mask', 'softmax'].includes(step.id)) ||
            (e.id === 'up' && step.id === 'silu')) &&
          e.opacity > 0.01 &&
          e.x < 175,
      ) && <JourneyStorage height={Math.min(noteLayout.height - 50, 700)} />}
      <defs>
        <marker
          id="journey-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M0 1 L9 5 L0 9" fill="none" stroke="currentColor" />
        </marker>
      </defs>
      <JourneySliceContext sample={sample} view="numbers" reduced={reduced} />
      <JourneyTokenCuts sample={sample} />
      {links.map(([from, to]) => {
        const a = byId[from],
          b = byId[to];
        if (!a || !b) return null;
        const start = center(a, 'right'),
          end = center(b, 'left');
        return (
          <path
            key={from + to}
            d={`M${start.x + 8},${start.y} C${(start.x + end.x) / 2},${start.y} ${(start.x + end.x) / 2},${end.y} ${end.x - 8},${end.y}`}
            className="journey-link"
            markerEnd="url(#journey-arrow)"
          />
        );
      })}
      {entities.map((e) => (
        <g key={e.id} opacity={activeEntities(step.id, e.id) ? 1 : 0.72}>
          <JourneyTensor entity={e} progress={p} calculation={sample.calculation} step={step.id} />
        </g>
      ))}
      {step.id === 'scores' && (
        <foreignObject
          className="journey-score-scale"
          x="648"
          y="250"
          width="40"
          height="64"
          opacity={ease((p - 0.54) / 0.06)}
        >
          <div
            dangerouslySetInnerHTML={{
              __html: mathDocument('<mfrac><mn>1</mn><msqrt><mi>d</mi></msqrt></mfrac>'),
            }}
          />
        </foreignObject>
      )}
      {operation.symbols.map((symbol) => (
        <text
          key={symbol.key}
          x={symbol.x}
          y={symbol.y}
          textAnchor="middle"
          dominantBaseline="middle"
          opacity={ease((p - 0.54) / 0.06)}
          className={`journey-operator ${symbol.text.length > 2 ? 'is-weight-name' : ''}`}
        >
          {symbol.text}
        </text>
      ))}
      {noteLayout.notes.map((note) => (
        <foreignObject
          key={note.key}
          className="journey-operation-note"
          opacity={note.opacity}
          data-owner={note.key}
          x={note.x}
          y={note.y}
          width={note.width}
          height={note.height}
        >
          <div className="operation-content">
            <p className="operation-title">処理 · {note.title}</p>
            <div
              className="operation-formula"
              dangerouslySetInnerHTML={{ __html: note.formula.map(mathDocument).join('') }}
            />
            <p className="operation-explanation">{note.explanation}</p>
            <div
              className="operation-detail"
              dangerouslySetInnerHTML={{ __html: note.detail.map(mathDocument).join('') }}
            />
          </div>
        </foreignObject>
      ))}
      {step.id === 'rope' &&
        ['q', 'k'].map((id) => {
          const e = byId[id],
            row = traceRow(sample.calculation),
            input = (id === 'q' ? model.firstLayer.qn : model.firstLayer.kn)[row],
            fraction = sample.calculation >= 1 ? 1 : ease((sample.calculation * 7) % 1);
          return (
            <JourneyRotationGlyph
              key={id}
              x={e.x - 80}
              y={e.y + 58}
              before={-rotationDegrees(input, row, 0)}
              angle={-rotationDegrees(input, row, fraction)}
              position={row}
              marker="journey-arrow"
            />
          );
        })}
      {step.id === 'layers' && (
        <text x="470" y="440" className="journey-layer-label">
          Layer {sample.layer} / 27{' '}
          <tspan x="470" dy="28">
            同じ7行のhidden state
          </tspan>
        </text>
      )}
      {step.id === 'sampling' && (
        <g className="journey-story" opacity={ease((p - 0.4) / 0.12)}>
          <path d="M496,374 V407" markerEnd="url(#journey-arrow)" />
          <text x="530" y="400">
            ① 末尾の行だけを使う
          </text>
          <text x="360" y="410">
            ② Softmax
          </text>
          <g opacity={ease((p - 0.8) / 0.1)}>
            <path d="M643,465 H689" markerEnd="url(#journey-arrow)" />
            <text x="650" y="510">
              ③ 最大の候補を選ぶ
            </text>
          </g>
        </g>
      )}
      {['append', 'cache', 'decode'].includes(step.id) && (
        <g className="journey-story">
          <text x="70" y={step.id === 'append' ? 240 : 155}>
            {step.id === 'decode' ? '生成ID列 · 8個' : '保持していた入力ID · 7個'}
          </text>
          {step.id === 'append' && (
            <>
              <path d="M70,338 H790" />
              <text x="805" y="355">
                ＋ 1個
              </text>
            </>
          )}
          {step.id === 'append' &&
            model.tokenPieces.map((piece, i) => (
              <text key={i} x={70 + i * 105 + 47} y="355" textAnchor="middle">
                {piece}
              </text>
            ))}
          {step.id === 'append' && (
            <text x="852" y="380" textAnchor="middle" opacity={ease((p - 0.75) / 0.15)}>
              {model.candidates[model.chosen].text}
            </text>
          )}
          {step.id === 'cache' && (
            <g opacity={ease((p - 0.42) / 0.12)}>
              <path
                d="M852,230 V245 H680 V280"
                strokeDasharray="4 6"
                markerEnd="url(#journey-arrow)"
              />
              <text x="640" y="315">
                次のForward
              </text>
              <text x="640" y="335">
                新しい1位置だけ計算
              </text>
              <path
                d="M680,350 V500 H277 V480 M680,500 H547 V480"
                strokeDasharray="4 6"
                markerEnd="url(#journey-arrow)"
              />
              <text x="710" y="480">
                過去の7位置は再計算しない
              </text>
            </g>
          )}
          {step.id === 'decode' && (
            <>
              <path d="M500,230 V245" markerEnd="url(#journey-arrow)" />
              <text x="520" y="235">
                同じ8個のIDから文字列へ
              </text>
            </>
          )}
        </g>
      )}
      {step.id === 'sampling' && (
        <text x="360" y="535" className="journey-note">
          候補：
          {model.candidates
            .map((c, i) =>
              p > 0.76 ? `${c.text} ${(model.nextProbabilities[i] * 100).toFixed(1)}%` : c.text,
            )
            .join(' ／ ')}
        </text>
      )}
      {step.id === 'cache' &&
        ['k', 'v'].map((id) => {
          const e = byId[`cache-new-${id}`];
          return (
            <text
              key={id}
              x={e.x + e.w * 3 + 12}
              y={e.y + 16}
              className="journey-note"
              opacity={e.opacity}
            >
              {id === 'k' ? 'Knew' : 'Vnew'}
            </text>
          );
        })}
      {step.id === 'cache' && (
        <text x="190" y="805" className="journey-note">
          ⋮ 中間の層も保持 ／ 新しいQは過去＋現在のK/Vへ
        </text>
      )}
    </svg>
  );
}

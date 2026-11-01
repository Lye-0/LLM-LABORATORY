import type { JourneySample } from '../../lib/journey-scene';
import { shapeActors } from '../../lib/journey-shapes';
import { ease } from '../../lib/journey-timing';

const attentionStages = [
  'qkv',
  'heads',
  'rope',
  'transpose',
  'scores',
  'mask',
  'softmax',
  'weighted',
  'concat',
  'o-proj',
];
const cubic = (a: number, b: number, c: number, d: number, t: number) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;

export default function JourneySliceContext({
  sample,
  view,
  reduced = false,
}: {
  sample: JourneySample;
  view: 'numbers' | 'shapes';
  reduced?: boolean;
}) {
  const stage = sample.step.id,
    p = sample.progress;
  if (!attentionStages.includes(stage)) return null;
  const numeric = view === 'numbers';
  const splitting = stage === 'heads' && (numeric ? p < 0.6 : sample.calculation < 0.5);
  const joined =
    stage === 'o-proj' || (stage === 'concat' && (numeric ? p >= 0.6 : sample.calculation >= 1));
  const state =
    stage === 'qkv'
      ? 'unsplit'
      : splitting
        ? 'splitting'
        : joined
          ? 'joined'
          : stage === 'concat'
            ? 'joining'
            : 'slice';
  const enter = stage === 'qkv' ? ease(p / 0.18) : 1;
  const leave = stage === 'o-proj' ? 1 - ease((p - 0.82) / 0.18) : 1;
  // Travel follows the shared timeline, rather than a CSS animation that restarts on seek/view change.
  const start = numeric ? 0.6 : 0.74;
  const travel = stage === 'heads' ? ease((p - start) / (0.97 - start)) : 1;
  const headOpacity =
    stage === 'qkv' || stage === 'o-proj'
      ? 0
      : stage === 'heads'
        ? ease((p - (numeric ? 0.38 : 0.71)) / (numeric ? 0.12 : 0.03))
        : stage === 'concat'
          ? 1 - ease(p / 0.2)
          : 1;
  const totals = stage === 'heads' ? ease((travel - 0.82) / 0.18) : 1;
  const actors = stage === 'heads' && !numeric ? shapeActors(sample) : [];
  return (
    <g
      data-slice-view={view}
      data-head-state={state}
      className="journey-slice-panel"
      opacity={enter * leave}
    >
      <foreignObject x="200" y="12" width="600" height="28">
        <div className="journey-slice-context">
          <span className="slice-caption">表示スライス</span>
          <span className="slice-location">Batch 0 · Layer 0</span>
        </div>
      </foreignObject>
      {['q', 'k'].map((id, i) => {
        const e = sample.entities.find((entity) => entity.id === id);
        const pose = actors.find((actor) => actor.entity.id === id)?.pose;
        const sourceX = pose?.cx ?? (e ? e.x + 1.5 * e.w : 500);
        const sourceY = pose ? pose.cy - pose.height / 2 - 90 : (e?.y ?? 180) - 54;
        const targetX = i === 0 ? 415 : 585;
        const moving = stage === 'heads' && !reduced;
        const x = moving
          ? cubic(sourceX, i === 0 ? sourceX : 180, i === 0 ? targetX : 180, targetX, travel)
          : targetX;
        const y = moving ? cubic(sourceY, i === 0 ? 90 : sourceY, 60, 60, travel) : 60;
        return (
          <text
            key={id}
            className="slice-head-label"
            data-slice-head={id}
            data-slice-travel={travel}
            data-slice-arrived={travel === 1}
            x={x}
            y={y}
            textAnchor="middle"
            opacity={headOpacity}
          >
            <tspan>{i === 0 ? 'Q Head 0' : 'KV Head 0'}</tspan>
            <tspan opacity={totals}> / 全{numeric ? (i === 0 ? 2 : 1) : i === 0 ? 16 : 8}</tspan>
          </text>
        );
      })}
    </g>
  );
}

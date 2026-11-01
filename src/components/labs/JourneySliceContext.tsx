import type { JourneySample } from '../../lib/journey-scene';
import { shapeActors } from '../../lib/journey-shapes';
import {
  headSliceMotion,
  layerSliceMotion,
  tokenSliceMotion,
  type JourneyView,
} from '../../lib/journey-slices';
import { ease } from '../../lib/journey-timing';

const decoderStages = [
  'norm',
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
  'residual-attn',
  'post-norm',
  'gate',
  'silu',
  'multiply',
  'down',
  'residual-mlp',
];
const headStages = [
  'heads',
  'rope',
  'transpose',
  'scores',
  'mask',
  'softmax',
  'weighted',
  'concat',
];
const cubic = (a: number, b: number, c: number, d: number, t: number) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;

export default function JourneySliceContext({
  sample,
  view,
  reduced = false,
}: {
  sample: JourneySample;
  view: JourneyView;
  reduced?: boolean;
}) {
  const stage = sample.step.id,
    p = sample.progress,
    numeric = view === 'numbers';
  const motion = headSliceMotion(sample, view),
    layer = layerSliceMotion(sample);
  const splitting = stage === 'heads' && (numeric ? p < 0.6 : sample.calculation < 0.5);
  const joined = stage === 'o-proj' || (stage === 'concat' && motion.merge >= 1);
  const enter = 1;
  const leave = stage === 'decode' ? 1 - ease(p / 0.18) : 1;
  const hasLayer = decoderStages.includes(stage) || stage === 'layers' || stage === 'final';
  const layerOpacity =
    stage === 'norm' ? ease(p / 0.18) : stage === 'final' ? 1 - ease(p / 0.18) : 1;
  const actors = !numeric && ['heads', 'concat'].includes(stage) ? shapeActors(sample) : [];
  const merging = stage === 'concat';
  const qCount = numeric ? 2 : 16,
    kvCount = numeric ? 1 : 8;
  const layerNumber = stage === 'layers' ? layer.current : stage === 'final' ? 27 : 0;
  return (
    <g
      data-slice-view={view}
      data-head-state={
        stage === 'qkv'
          ? 'unsplit'
          : splitting
            ? 'splitting'
            : joined
              ? 'joined'
              : merging
                ? 'joining'
                : 'slice'
      }
      className="journey-slice-panel"
      opacity={enter * leave}
    >
      <foreignObject x="200" y="12" width="600" height="32">
        <div className="journey-slice-context">
          <span className="slice-caption">表示スライス</span>
          <span className="slice-location">
            <span>Batch 0</span>
            {hasLayer && (
              <span
                className="slice-layer-slot"
                style={{
                  opacity: layerOpacity,
                  marginLeft: 8 * layerOpacity,
                  minWidth: 0,
                  width: 66 * layerOpacity,
                  overflow: 'hidden',
                }}
              >
                {stage === 'layers' && !reduced && layer.transfer < 1 && (
                  <span
                    className="slice-layer-previous"
                    style={{
                      opacity: 1 - layer.transfer,
                      transform: `translateY(${-7 * layer.transfer}px)`,
                    }}
                  >
                    · Layer {layer.previous}
                  </span>
                )}
                <span
                  data-slice-layer={layerNumber}
                  style={
                    stage === 'layers'
                      ? {
                          opacity: reduced ? 1 : layer.transfer,
                          transform: `translateY(${reduced ? 0 : 7 * (1 - layer.transfer)}px)`,
                        }
                      : undefined
                  }
                >
                  · Layer {layerNumber}
                </span>
              </span>
            )}
          </span>
        </div>
      </foreignObject>
      {['q', 'k'].map((id, i) => {
        const topX = i === 0 ? 415 : 585;
        let x = topX,
          y = 60;
        if (merging && i === 0 && !reduced) {
          const output = sample.entities.find((entity) => entity.id === 'attn')!;
          const shape = actors.find((actor) => actor.entity.id === 'attn')?.pose;
          const cx = shape?.cx ?? output.x + 1.5 * output.w;
          const cy = shape ? shape.cy - shape.height / 2 - 90 : output.y - 54;
          x = cubic(topX, topX, cx, cx, motion.returnToMatrix);
          y = cubic(60, 85, cy, cy, motion.returnToMatrix);
        }
        const opacity = !headStages.includes(stage)
          ? 0
          : stage === 'heads'
            ? motion.appear
            : merging
              ? i === 0
                ? 1 - motion.restore
                : 1 - ease(p / 0.18)
              : 1;
        return (
          <text
            key={id}
            className="slice-head-label"
            data-slice-head={id}
            data-slice-travel={motion.travel}
            data-slice-arrived={motion.travel === 1}
            data-slice-merge={merging ? motion.merge : 0}
            x={x}
            y={y}
            textAnchor="middle"
            opacity={opacity}
          >
            {i === 0 ? `Q Head 0 / 全${qCount}` : `KV Head 0 / 全${kvCount}`}
          </text>
        );
      })}
      {stage === 'heads' &&
        (numeric ? ['q', 'k'] : ['q', 'k', 'v']).map((id, i) => {
          const e = sample.entities.find((entity) => entity.id === id)!;
          const pose = actors.find((actor) => actor.entity.id === id)?.pose;
          return (
            <text
              key={`local-${id}`}
              className="slice-head-label"
              data-local-head={id}
              x={pose?.cx ?? e.x + 1.5 * e.w}
              y={pose ? pose.cy - pose.height / 2 - (15 + 75 * ease((p - 0.7) / 0.16)) : e.y - 54}
              textAnchor="middle"
              opacity={motion.local}
            >
              {i === 0 ? 'Head 0' : 'KV Head 0'}
            </text>
          );
        })}
      {['sampling', 'append'].includes(stage) && (
        <text
          className="slice-head-label"
          data-slice-token="6"
          x="500"
          y={
            60 +
            (reduced
              ? 0
              : stage === 'append'
                ? -8 * ease(p / 0.18)
                : 8 * (1 - tokenSliceMotion(p).label))
          }
          textAnchor="middle"
          opacity={stage === 'append' ? 1 - ease(p / 0.18) : tokenSliceMotion(p).label}
        >
          Token位置 6 / 全7
        </text>
      )}
      {stage === 'cache' && (
        <text
          className="slice-head-label"
          data-slice-cache="true"
          x="500"
          y="60"
          textAnchor="middle"
          opacity={ease((p - 0.5) / 0.15)}
        >
          KV Head 0 / 全{kvCount}
        </text>
      )}
    </g>
  );
}

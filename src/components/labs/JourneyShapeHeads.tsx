import type { JourneySample } from '../../lib/journey-scene';
import { shapeSize, shapeSpec, type ShapePose } from '../../lib/journey-shapes';
import {
  splitHeadPose,
  splitHeadOpacity,
  headCount,
  mergeHeadPose,
} from '../../lib/journey-head-layout';
import { headSliceMotion } from '../../lib/journey-slices';
import { ease } from '../../lib/journey-timing';

export default function JourneyShapeHeads({ sample }: { sample: JourneySample }) {
  const p = sample.progress;
  if (sample.step.id === 'heads') {
    return (
      <g className="shape-head-partitions">
        {['q', 'k', 'v'].map((id) => {
          const size = shapeSize(shapeSpec('qkv', id)!);
          const source: ShapePose = {
            cx: 815,
            cy: id === 'q' ? 250 : id === 'k' ? 570 : 890,
            ...size,
          };
          return (
            <g key={id} className={`tone-${id === 'v' ? 'output' : id}`}>
              <text
                className="shape-head-group-label"
                x="220"
                y={id === 'q' ? 135 : id === 'k' ? 415 : 605}
                opacity={ease((p - 0.18) / 0.16) * (1 - ease((p - 0.58) / 0.12))}
              >
                {id.toUpperCase()} · {headCount(id)} Heads
              </text>
              {Array.from({ length: headCount(id) - 1 }, (_, j) => j + 1).map((i) => {
                const pos = splitHeadPose(p, id, i, source, source);
                return (
                  <g
                    key={i}
                    data-head-partition={`${id}:${i}`}
                    className="shape-head-part"
                    transform={`translate(${pos.cx - pos.width / 2},${pos.cy - pos.height / 2})`}
                    opacity={splitHeadOpacity(p)}
                  >
                    <rect width={pos.width} height={pos.height} rx="3" />
                    <g opacity={ease((p - 0.25) / 0.15)}>
                      <text
                        className="shape-head-index"
                        x={pos.width / 2}
                        y="-12"
                        textAnchor="middle"
                      >
                        Head {i}
                      </text>
                      <text
                        className="shape-head-type"
                        style={{ fontSize: Math.min(12, (pos.width - 8) / 4.34) }}
                        x={pos.width / 2}
                        y={pos.height / 2 + 4}
                        textAnchor="middle"
                      >
                        7 × 128
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          );
        })}
      </g>
    );
  }
  if (sample.step.id === 'concat') {
    const motion = headSliceMotion(sample, 'shapes');
    return (
      <g className="shape-extra-heads tone-output">
        {Array.from({ length: 15 }, (_, j) => j + 1).map((i) => {
          const pos = mergeHeadPose(p, i);
          return (
            <g
              key={i}
              className="shape-head-part"
              data-merge-head={i}
              transform={`translate(${pos.cx - pos.width / 2},${pos.cy - pos.height / 2})`}
              opacity={motion.restore * (1 - ease((motion.merge - 0.7) / 0.3))}
            >
              <rect width={pos.width} height={pos.height} rx="3" />
              <g opacity={1 - ease(motion.merge / 0.18)}>
                <text className="shape-head-index" x={pos.width / 2} y="-12" textAnchor="middle">
                  Head {i}
                </text>
                <text
                  className="shape-head-type"
                  style={{ fontSize: Math.min(12, (pos.width - 8) / 4.34) }}
                  x={pos.width / 2}
                  y={pos.height / 2 + 4}
                  textAnchor="middle"
                >
                  7 × 128
                </text>
              </g>
            </g>
          );
        })}
      </g>
    );
  }
  return null;
}

import { ease } from '../../lib/journey-timing';

/** Only the feature axis factors/joins; the Token axis stays in place. */
export default function JourneyHeadDimensions({
  progress,
  heads,
  merging = false,
  y,
}: {
  progress: number;
  heads: number;
  merging?: boolean;
  y: number;
}) {
  const split = merging ? 1 - ease((progress - 0.6) / 0.3) : ease((progress - 0.06) / 0.24);
  const opacity = merging
    ? ease((progress - 0.35) / 0.15) * (1 - ease((progress - 0.9) / 0.06))
    : ease(progress / 0.1) * (1 - ease((progress - 0.58) / 0.12));
  return (
    <g
      className="journey-head-dimensions"
      transform={`translate(560,${y})`}
      opacity={opacity}
      data-axis-factorization
    >
      <text x="-105" y="-30" className="dimension-axis">
        Token位置
      </text>
      <text x="-105">7 ×</text>
      <g opacity={1 - ease(split / 0.5)}>
        <text x="-25" y="-30" className="dimension-axis">
          表現成分
        </text>
        <text x="-25">{heads * 128}</text>
      </g>
      <g opacity={ease((split - 0.5) / 0.5)}>
        <text x={-25 - split * 8} y="-30" className="dimension-axis">
          Head数
        </text>
        <text x={-25 - split * 8}>{heads}</text>
        <text x={20 + split * 16}>×</text>
        <text x={40 + split * 28} y="-30" className="dimension-axis">
          Head内成分
        </text>
        <text x={40 + split * 28}>128</text>
      </g>
    </g>
  );
}

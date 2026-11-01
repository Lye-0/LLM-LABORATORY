import type { JourneySample } from '../../lib/journey-scene';
import type { JourneyView } from '../../lib/journey-slices';
import { tensorShapeRows } from '../../lib/journey-tensor-shapes';

export default function JourneyTensorShapes({
  sample,
  view,
}: {
  sample: JourneySample;
  view: JourneyView;
}) {
  const rows = tensorShapeRows(sample, view);
  return (
    <g className="journey-full-shapes" data-full-shapes>
      <text x="500" y="19" textAnchor="middle" className="journey-shape-caption">
        全体のshape · {view === 'shapes' || sample.step.id === 'embedding' ? '実モデル' : '数値例'}
      </text>
      {!rows.length && (
        <text x="500" y="47" textAnchor="middle">
          {sample.step.id === 'text' ? 'text：文字列' : 'tokens：文字列のリスト'}（Tensor化前）
        </text>
      )}
      {rows.map((r, index) => (
        <text
          key={r.name}
          x="500"
          y={45 + index * 26}
          textAnchor="middle"
          className={`tone-${r.tone}`}
          data-tensor-shape={r.name}
        >
          <tspan className="journey-shape-name">{r.name}.shape </tspan>
          <tspan>[</tspan>
          {r.axes.map((axis, i) => (
            <tspan key={axis}>
              <tspan className={r.drawn.includes(i) ? 'shape-axis-drawn' : ''}>{axis}</tspan>
              {i < r.axes.length - 1 ? ', ' : ''}
            </tspan>
          ))}
          <tspan>] = [</tspan>
          {r.values.map((value, i) => (
            <tspan key={i}>
              <tspan className={r.drawn.includes(i) ? 'shape-axis-drawn' : ''}>{value}</tspan>
              {i < r.values.length - 1 ? ', ' : ''}
            </tspan>
          ))}
          <tspan>]</tspan>
        </text>
      ))}
    </g>
  );
}

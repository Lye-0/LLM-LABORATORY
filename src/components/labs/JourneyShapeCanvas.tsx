import type { JourneySample } from '../../lib/journey-scene';
import { shapeActors, shapeOperations, shapeEquations, shapeGuide } from '../../lib/journey-shapes';
import { activeEntities, ease, clamp } from '../../lib/journey-timing';
import { actorId } from '../../lib/journey-actors';
import { traceRow } from '../../lib/journey-trace';
import { mathDocument } from '../../lib/journey-formulas';

export default function JourneyShapeCanvas({ sample }: { sample: JourneySample }) {
  const { step, progress: p, calculation: c } = sample;
  const actors = shapeActors(sample),
    operations = shapeOperations(step.id),
    equations = shapeEquations(sample);
  const outputIds = new Set(operations.filter((o) => o.kind !== 'transpose').map((o) => o.output));
  const targetBottom = Math.max(
    400,
    ...actors
      .filter((a) => a.entity.end.opacity > 0 && a.pose)
      .map((a) => a.pose!.cy + a.pose!.height / 2 + 70),
  );
  const noteY =
    step.id === 'qkv' ? 1040 : step.id === 'gate' ? 990 : Math.max(490, targetBottom + 40);
  const height = Math.max(sample.height, noteY + 180 + equations.length * 125);
  const row = traceRow(c),
    working = c > 0 && c < 1;
  const branches =
    step.id === 'qkv'
      ? ['q', 'k', 'v'].map((id) => ['hidden', `weight-${id}`])
      : step.id === 'gate'
        ? ['gate', 'up'].map((id) => [actorId(step.id, 'attn'), `weight-${id}`])
        : [];
  return (
    <svg
      viewBox={`0 0 1000 ${height}`}
      className="journey-svg journey-shape-svg"
      role="img"
      aria-label={`${step.name}。形と軸で見る。${shapeGuide(step.id)}`}
      data-shape-scene
    >
      <defs>
        <pattern id="shape-mask-pattern" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6" className="shape-mask-line" />
        </pattern>
        <marker
          id="shape-arrow"
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
      {branches.map(([from, to]) => {
        const a = actors.find((a) => a.entity.id === from)?.pose,
          b = actors.find((a) => a.entity.id === to)?.pose;
        if (!a || !b) return null;
        return (
          <path
            key={to}
            className="shape-branch"
            d={`M${a.cx + a.width / 2},${a.cy} C${a.cx + a.width / 2 + 20},${a.cy} ${b.cx - b.width / 2 - 40},${b.cy} ${b.cx - b.width / 2 - 28},${b.cy}`}
            opacity={ease((p - 0.35) / 0.2)}
            markerEnd="url(#shape-arrow)"
          />
        );
      })}
      {step.id === 'concat' && (
        <g
          className="shape-extra-heads"
          opacity={1 - ease(c)}
          transform={`translate(${790 - 230 * c},${225 + 40 * c})`}
        >
          <text y="-22">他の15 Headの出力も連結</text>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${i * 8},${i * 16})`}>
              <rect width="140" height="42" rx="3" />
              <text x="70" y="26" textAnchor="middle">
                Head {i === 2 ? '…15' : i + 1} · 7 × 128
              </text>
            </g>
          ))}
        </g>
      )}
      {actors.map(({ entity: e, spec, pose }) => {
        if (!spec || !pose) {
          if (
            !e.id.startsWith('token-') &&
            !e.id.startsWith('id-') &&
            !['chosen', 'result'].includes(e.id)
          )
            return null;
          const label =
            e.id === 'chosen'
              ? '次のID'
              : e.id === 'result'
                ? 'ID列を文字列へ戻す'
                : String(e.end.data[0]?.[0] ?? '');
          return (
            <g
              key={e.id}
              data-shape-entity={e.id}
              opacity={e.opacity}
              transform={`translate(${e.x},${e.y})`}
              className="shape-token"
            >
              {!e.plain && <rect width={e.w} height={e.h} rx="5" />}
              <text
                x={e.w / 2}
                y={e.h / 2}
                dominantBaseline="middle"
                textAnchor="middle"
                fontSize={e.id.startsWith('token-') ? 22 : 15}
              >
                {label}
              </text>
            </g>
          );
        }
        const compact = pose.width < 100;
        const result = outputIds.has(e.id);
        const born = e.start.opacity === 0;
        const isNew = (result && e.start.data !== e.end.data) || (result && born);
        const ready = isNew ? c : 1;
        const rows = spec.rows <= 8 ? spec.rows : 6,
          cols = spec.cols <= 8 ? spec.cols : 6;
        const w = pose.width,
          h = pose.height;
        const active = activeEntities(step.id, e.id);
        const op = operations.find((o) => o.kind === 'matmul' && o.inputs.includes(e.id));
        const contract = op ? (op.inputs[0] === e.id ? 'columns' : 'rows') : null;
        const keyTable = spec.square;
        const masked = keyTable && ['mask', 'softmax', 'weighted'].includes(step.id);
        const axLabel = (n: number, axis: string) => `${n} · ${axis}`;
        const title =
          step.id === 'layers' && e.id === actorId(step.id, 'gate')
            ? `H · Layer ${sample.layer}の出力`
            : step.id === 'sampling' && e.id === 'prob' && p < 0.76
              ? 'z_last · 末尾のスコア'
              : spec.name;
        const scansRows = !['transpose', 'concat', 'append', 'cache', 'decode'].includes(step.id);
        const rightOperand = contract === 'rows';
        const rowY = rightOperand
          ? 0
          : step.id === 'sampling' && e.id === 'logits-state'
            ? (6 * h) / 7
            : (Math.min(rows - 1, row) * h) / rows;
        const rowHeight = rightOperand
          ? step.id === 'weighted'
            ? ((row + 1) * h) / rows
            : h
          : h / rows;
        return (
          <g
            key={e.id}
            data-shape-entity={e.id}
            data-shape={`${spec.rows}x${spec.cols}`}
            data-shape-ready={ready}
            data-shape-contract={contract ?? ''}
            data-shape-cx={pose.cx}
            data-shape-cy={pose.cy}
            transform={`translate(${pose.cx - w / 2},${pose.cy - h / 2})`}
            opacity={
              (e.start.opacity > 0 && e.end.opacity === 0
                ? Math.min(e.opacity, 1 - clamp(p / 0.18))
                : e.opacity) * (active ? 1 : 0.55)
            }
            className={`shape-matrix ${compact ? 'is-stored' : ''} ${result ? 'is-result' : ''} ${contract && working ? 'is-contracting' : ''}`}
          >
            <title>
              {title}。[{spec.rows}×{spec.cols}]。縦：{spec.rowAxis}。横：{spec.colAxis}。
              {spec.badge}
            </title>
            <text className="shape-name" y={compact ? -12 : -46} fontSize={compact ? 10 : 16}>
              {compact ? spec.name.split(' · ')[0] : title}
            </text>
            {!compact && (
              <>
                <text
                  className={`shape-axis shape-column-axis ${contract === 'columns' && working ? 'is-matching' : ''}`}
                  x={w / 2}
                  y="-15"
                  textAnchor="middle"
                >
                  {axLabel(spec.cols, spec.colAxis)}
                </text>
                <text
                  className={`shape-axis shape-row-axis ${contract === 'rows' && working ? 'is-matching' : ''}`}
                  transform={`translate(-18,${h / 2}) rotate(-90)`}
                  textAnchor="middle"
                >
                  {axLabel(spec.rows, spec.rowAxis)}
                </text>
              </>
            )}
            <rect className="shape-body" width={w} height={h} rx="5" />
            {Array.from({ length: rows }, (_, i) =>
              Array.from({ length: cols }, (_, j) => {
                const future = masked && j > i;
                const completed = !isNew || c >= (i + 1) / rows;
                return (
                  <rect
                    key={`${i}-${j}`}
                    className={`shape-cell ${future ? 'is-masked' : ''} ${completed ? 'is-complete' : ''}`}
                    x={(j * w) / cols + 2}
                    y={(i * h) / rows + 2}
                    width={w / cols - 4}
                    height={h / rows - 4}
                    rx="2"
                    fill={future ? 'url(#shape-mask-pattern)' : undefined}
                  />
                );
              }),
            )}
            {working && active && !compact && scansRows && (
              <rect
                className="shape-processing-row"
                x="0"
                y={rowY}
                width={w}
                height={rowHeight}
                rx="3"
              />
            )}
            {contract && working && !compact && (
              <path
                className="shape-contracted-edge"
                d={contract === 'columns' ? `M0,-5 H${w}` : `M-5,0 V${h}`}
              />
            )}
            <rect
              className="shape-dimension-back"
              x={compact ? 3 : 8}
              y={h / 2 - (compact ? 12 : 22)}
              width={w - (compact ? 6 : 16)}
              height={compact ? 24 : 44}
              rx="3"
            />
            <text
              className="shape-dimension"
              x={w / 2}
              y={h / 2 + 1}
              dominantBaseline="middle"
              textAnchor="middle"
              fontSize={compact ? 12 : spec.cols === 151936 ? 23 : 26}
            >
              {spec.rows} × {spec.cols}
            </text>
            {!compact && (
              <text className="shape-badge" x={w / 2} y={h + 25} textAnchor="middle">
                {spec.badge ??
                  (result
                    ? ready >= 1
                      ? '計算結果を次へ渡す'
                      : ready > 0
                        ? '結果を行ごとに生成中'
                        : '計算待ち'
                    : spec.rows > 8 || spec.cols > 8
                      ? '細かい区切りは省略'
                      : '')}
              </text>
            )}
            {compact && (
              <text className="shape-badge" x={w / 2} y={h + 16} textAnchor="middle">
                保持・待機
              </text>
            )}
            {step.id === 'mask' && e.id === 'score' && (
              <text className="shape-badge" x={w / 2} y={h + 43} textAnchor="middle">
                斜線：未来のKey位置を除外
              </text>
            )}
            {step.id === 'concat' && e.id === 'attn' && (
              <g className="shape-head-slices">
                {Array.from({ length: 16 }, (_, i) => (
                  <rect key={i} x={(i * w) / 16 + 1} y={h - 10} width={w / 16 - 2} height="8" />
                ))}
              </g>
            )}
            {step.id === 'transpose' && e.id === 'k' && (
              <text className="shape-swap" x={w - 10} y={h - 10} textAnchor="end">
                ⇄
              </text>
            )}
          </g>
        );
      })}
      {operations
        .filter((op) => op.inputs.length === 2)
        .map((op) => {
          const a = actors.find((a) => a.entity.id === op.inputs[0])?.pose,
            b = actors.find((a) => a.entity.id === op.inputs[1])?.pose,
            out = actors.find((a) => a.entity.id === op.output)?.pose;
          if (!a || !b || !out) return null;
          return (
            <g key={op.output} className="shape-operators" opacity={ease((p - 0.54) / 0.06)}>
              <text
                x={(a.cx + a.width / 2 + b.cx - b.width / 2) / 2 - 11}
                y={b.cy}
                dominantBaseline="middle"
                textAnchor="middle"
              >
                {op.kind === 'add' ? '+' : op.kind === 'product' ? '⊙' : '×'}
              </text>
              <text
                x={(b.cx + b.width / 2 + out.cx - out.width / 2) / 2 - 11}
                y={out.cy}
                dominantBaseline="middle"
                textAnchor="middle"
              >
                =
              </text>
            </g>
          );
        })}
      {step.id === 'sampling' && (
        <g className="shape-story" opacity={ease((p - 0.43) / 0.15)}>
          <path d="M500,340 V430" markerEnd="url(#shape-arrow)" />
          <text x="530" y="385">
            末尾1行を取り出す
          </text>
          <path d="M625,535 H695" markerEnd="url(#shape-arrow)" />
          <text x="660" y="505">
            候補から選択
          </text>
        </g>
      )}
      {step.id === 'append' && (
        <g className="shape-story">
          <path d="M70,340 H790" />
          <text x="70" y="370">
            保持した7つのID
          </text>
          <text x="805" y="370">
            + 1位置
          </text>
        </g>
      )}
      {step.id === 'cache' && (
        <g className="shape-story">
          <text x="180" y="710">
            各層・各KV Head： [7 × 128] + 新しい [1 × 128] → [8 × 128]
          </text>
          <text x="180" y="740">
            次の比較： Q [1 × 128] × Kᵀ [128 × 8] → スコア [1 × 8]
          </text>
        </g>
      )}
      <foreignObject
        x="190"
        y={noteY}
        width="770"
        height={height - noteY - 20}
        className="shape-explanation"
      >
        <div>
          <p className="shape-operation-title">
            {equations.length ? '軸をつないで、結果の形へ' : 'いまの処理と軸の意味'}
          </p>
          {equations.map((eq) => (
            <div key={eq.output} className="shape-equation">
              <div dangerouslySetInnerHTML={{ __html: mathDocument(eq.math) }} />
              {eq.contracted !== null && <span>共通の {eq.contracted} の軸で掛けて足す</span>}
              <p>{eq.text}</p>
            </div>
          ))}
          <p>{shapeGuide(step.id)}</p>
          {step.id === 'scores' && (
            <p>7×7の各マスは「Query位置 × Key位置」の組。Mask・Softmax後に参照割合へ変わります。</p>
          )}
          {step.id === 'weighted' && (
            <p>行の7はQuery位置、掛け合わせる7はKey / Value位置。同じ数でも役割が異なります。</p>
          )}
        </div>
      </foreignObject>
    </svg>
  );
}

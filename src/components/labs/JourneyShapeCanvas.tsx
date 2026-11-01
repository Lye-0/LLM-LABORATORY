import JourneySliceContext from './JourneySliceContext';
import { tokenSliceMotion, cacheSliceMotion } from '../../lib/journey-slices';
import { JourneyTensor, JourneyTokenCuts, JourneyStorage } from './JourneyCanvas';
import type { JourneySample } from '../../lib/journey-scene';
import { shapeActors, shapeOperations, shapeEquations, shapeGuide } from '../../lib/journey-shapes';
import { activeEntities, ease, clamp } from '../../lib/journey-timing';
import { actorId } from '../../lib/journey-actors';
import { shapeProcess } from '../../lib/journey-shape-process';
import { mathDocument } from '../../lib/journey-formulas';

export default function JourneyShapeCanvas({
  sample,
  reduced = false,
}: {
  sample: JourneySample;
  reduced?: boolean;
}) {
  const { step, progress: p, calculation: c } = sample;
  const actors = shapeActors(sample),
    operations = shapeOperations(step.id),
    equations = shapeEquations(sample);
  const process = shapeProcess(sample);
  const outputIds = new Set(operations.filter((o) => o.kind !== 'transpose').map((o) => o.output));
  const targetBottom = Math.max(
    400,
    ...actors
      .filter((a) => a.entity.end.opacity > 0 && a.pose)
      .map((a) => a.pose!.cy + a.pose!.height / 2 + 70),
  );
  const stored = actors.filter((a) => a.pose && a.pose.width < 100 && a.entity.opacity > 0.02);
  const scalarBottom = Math.max(
    0,
    ...actors
      .filter(
        (a) =>
          !a.pose && a.entity.opacity > 0.02 && /^(token-|id-|chosen$|result$)/.test(a.entity.id),
      )
      .map((a) => a.entity.y + a.entity.h + 45),
  );
  const noteY =
    step.id === 'qkv'
      ? 1040
      : step.id === 'gate'
        ? 990
        : Math.max(
            step.id === 'embedding' ? 640 : step.id === 'layers' ? 550 : 490,
            targetBottom + 40,
            scalarBottom + 40,
          );
  const height = Math.max(
    sample.height,
    noteY + 180 + equations.length * 125 + (process ? 190 + process.formulas.length * 65 : 0),
  );
  const chosen = sample.entities.find((e) => e.id === 'chosen');
  const leaving = actors.some((a) => a.entity.start.opacity > 0 && a.entity.end.opacity === 0);
  const working = c > 0 && c < 1;
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
      {stored.length > 0 && (
        <JourneyStorage
          boundary={150}
          textX={25}
          height={Math.max(430, ...stored.map((a) => a.pose!.cy + a.pose!.height / 2 + 45))}
        />
      )}
      <JourneySliceContext sample={sample} view="shapes" reduced={reduced} />
      <JourneyTokenCuts sample={sample} />
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
          opacity={ease((p - 0.52) / 0.06) * (1 - ease(c))}
          transform={`translate(${790 - 230 * c},${225 + 40 * c})`}
        >
          <text y="-22">他の15 Headの出力も連結</text>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(0,${i * 60})`}>
              <rect width="140" height="42" rx="3" />
              <text x="70" y="26" textAnchor="middle">
                Head {i === 2 ? '3〜15' : i + 1} · {i === 2 ? '各' : ''}7 × 128
              </text>
            </g>
          ))}
        </g>
      )}
      {actors.map(({ entity: e, spec, pose, moving, movement, rotation, turning }) => {
        if (step.id === 'decode' && e.id.startsWith('cache-new-')) return null;
        if (!spec || !pose) {
          if (
            !e.id.startsWith('token-') &&
            !e.id.startsWith('id-') &&
            !['chosen', 'result'].includes(e.id)
          )
            return null;
          // Token pieces and vocabulary IDs have identical meaning in both views.
          // Reuse the numeric renderer without changing shape-specific matrix layouts.
          if (e.id.startsWith('token-') || e.id.startsWith('id-')) {
            return (
              <g key={e.id} opacity={activeEntities(step.id, e.id) ? 1 : 0.72}>
                <JourneyTensor
                  entity={e}
                  progress={p}
                  calculation={c}
                  step={step.id}
                  view="shapes"
                />
              </g>
            );
          }
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
              className={`shape-token journey-tensor tone-id is-active`}
            >
              <text className="tensor-label" y="-16">
                {e.id === 'chosen' ? 'next_id · 選んだID' : ''}
              </text>
              {!e.plain && <rect width={e.w - 4} height={e.h - 3} rx="4" />}
              <text
                x={e.w / 2 - 2}
                y={e.h / 2 + 4}
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
        const w = pose.width,
          h = pose.height;
        const spinning = turning && c > 0 && c < 1;
        const physicalW = turning ? 192 : rotation === 90 ? h : w;
        const physicalH = turning ? 136 : rotation === 90 ? w : h;
        const active = activeEntities(step.id, e.id);
        const storedLabel =
          e.id === 'skip'
            ? 'H₀ · Residual ①用'
            : e.id === 'skip2'
              ? 'H₁ · Residual ②用'
              : `${e.id.toUpperCase()} · 待機`;
        const op = operations.find((o) => o.kind === 'matmul' && o.inputs.includes(e.id));
        const contract = op ? (op.inputs[0] === e.id ? 'columns' : 'rows') : null;
        const keyTable = spec.square;
        const maskAmount = keyTable
          ? step.id === 'mask'
            ? ease(c)
            : ['softmax', 'weighted'].includes(step.id)
              ? 1
              : 0
          : 0;
        const axLabel = (n: number, axis: string) => `${n} · ${axis}`;
        const baseTitle =
          step.id === 'layers' && e.id === actorId(step.id, 'gate')
            ? `H · Layer ${sample.layer}の出力`
            : step.id === 'sampling' && e.id === 'prob' && p < 0.76
              ? 'z_last · 末尾のスコア'
              : spec.name;
        const cacheNew = step.id === 'cache' && e.id.startsWith('cache-new-');
        const cachePast = step.id === 'cache' && ['k', 'v'].includes(e.id);
        const cache = cacheSliceMotion(p);
        const detailOpacity = cacheNew
          ? 1 - ease(cache.join / 0.2)
          : spinning
            ? 0
            : moving
              ? 1 - ease((movement - 0.03) / 0.12) + ease((movement - 0.88) / 0.12)
              : 1;
        const appearance = cacheNew
          ? ease((p - 0.5) / 0.1)
          : step.id === 'sampling' && e.id === 'prob'
            ? ease((p - 0.43) / 0.08)
            : born
              ? ease((p - 0.5) / 0.1)
              : 1;
        const processActive = active && process && !compact && !e.id.startsWith('weight');
        const progressTitles: Record<string, string> = {
          norm: 'H₀ → X · 正規化中',
          'post-norm': 'H₁ → Xₘ · 正規化中',
          final: 'H → Hfinal · 最終正規化中',
          mask: 'S → Sₘ · Mask適用中',
          softmax: 'Sₘ → P · 参照割合へ変換中',
          silu: 'G → Gₐ · SiLU適用中',
          transpose: 'K′ · 転置中',
          heads: `${e.id.toUpperCase()} · Head分割・正規化中`,
          rope: `${e.id.toUpperCase()} · RoPE適用中`,
        };
        const title = processActive && working ? (progressTitles[step.id] ?? baseTitle) : baseTitle;
        const typeTransition =
          working && ((turning && e.id === 'k') || (step.id === 'heads' && active));
        const state = processActive
          ? process.phase
          : result
            ? c >= 1
              ? '完了'
              : c > 0
                ? '生成中'
                : '計算待ち'
            : '';
        return (
          <g
            key={e.id}
            data-shape-entity={e.id}
            data-shape={`${spec.rows}x${spec.cols}`}
            data-shape-ready={ready}
            data-shape-contract={contract ?? ''}
            data-shape-cx={pose.cx}
            data-shape-cy={pose.cy}
            data-shape-rotation={rotation}
            transform={`translate(${pose.cx - w / 2},${pose.cy - h / 2})`}
            opacity={
              (e.start.opacity > 0 && e.end.opacity === 0
                ? Math.min(e.opacity, 1 - clamp(p / 0.1))
                : e.opacity) *
              appearance *
              (active ? 1 : 0.72)
            }
            className={`shape-matrix tone-${e.tone} ${compact ? 'is-stored' : ''} ${result ? 'is-result' : ''} ${processActive && working ? 'is-processing' : ''}`}
          >
            <title>
              {title}。[{spec.rows}×{spec.cols}]。縦：{spec.rowAxis}。横：{spec.colAxis}。
              {spec.badge}
            </title>
            <text
              className="shape-name"
              opacity={cacheNew ? detailOpacity : 1}
              x={compact ? w / 2 : 0}
              textAnchor={compact ? 'middle' : undefined}
              y={compact ? -12 : -46}
              fontSize={compact ? 10 : 16}
            >
              {compact ? storedLabel : title}
            </text>
            {!compact && (
              <>
                <text
                  opacity={detailOpacity}
                  className={`shape-axis shape-column-axis ${contract === 'columns' && working ? 'is-matching' : ''}`}
                  x={w / 2}
                  y="-15"
                  textAnchor="middle"
                >
                  {axLabel(spec.cols, spec.colAxis)}
                </text>
                <text
                  opacity={detailOpacity}
                  className={`shape-axis shape-row-axis ${contract === 'rows' && working ? 'is-matching' : ''}`}
                  transform={`translate(-18,${h / 2}) rotate(-90)`}
                  textAnchor="middle"
                >
                  {axLabel(spec.rows, spec.rowAxis)}
                </text>
              </>
            )}
            <g transform={`translate(${w / 2},${h / 2}) rotate(${rotation})`} data-shape-plate>
              <rect
                className="shape-body"
                x={-physicalW / 2}
                y={-physicalH / 2}
                width={physicalW}
                height={physicalH}
                rx="5"
              />
              {processActive && working && !keyTable && (
                <rect
                  className="shape-process-wash"
                  x={-physicalW / 2}
                  y={-physicalH / 2}
                  width={physicalW}
                  height={physicalH}
                  rx="5"
                  opacity={Math.sin(Math.PI * c) * 0.13}
                />
              )}
              {step.id === 'sampling' && e.id === actorId(step.id, 'gate') && (
                <rect
                  className="shape-token-slice"
                  data-slice-source-row="6"
                  x={-physicalW / 2}
                  y={physicalH / 2 - physicalH / 7}
                  width={physicalW}
                  height={physicalH / 7}
                  opacity={tokenSliceMotion(p).focus * (1 - ease((p - 0.47) / 0.1))}
                />
              )}
              {maskAmount > 0 && (
                <path
                  className="shape-mask-region"
                  data-mask-progress={maskAmount}
                  d={`M${-physicalW / 2},${-physicalH / 2} H${physicalW / 2} V${physicalH / 2} Z`}
                  fill="url(#shape-mask-pattern)"
                  opacity={maskAmount}
                />
              )}
            </g>
            <text
              className="shape-dimension"
              opacity={
                cacheNew
                  ? detailOpacity
                  : cachePast
                    ? 1 - Math.sin(Math.PI * cache.settle)
                    : typeTransition
                      ? 1 - Math.sin(Math.PI * c)
                      : 1
              }
              x={w / 2}
              y={h / 2 + 1}
              dominantBaseline="middle"
              textAnchor="middle"
              fontSize={Math.min(
                compact ? 12 : spec.cols === 151936 ? 23 : 26,
                (w - 10) / (`${spec.rows} × ${spec.cols}`.length * 0.62),
              )}
            >
              {spec.rows} × {spec.cols}
            </text>
            {!compact && (
              <foreignObject
                opacity={detailOpacity}
                className="shape-badge-wrap"
                x="-8"
                y={h + 12}
                width={w + 16}
                height="44"
              >
                <div>
                  {state
                    ? `${state} · ${processActive ? (step.id === 'transpose' ? '行と列の軸を交換' : step.id === 'heads' ? 'Head軸と成分を整える' : '型を保って値を変換') : c >= 1 ? '計算結果を次へ渡す' : '入力から別の結果を作る'}`
                    : (spec.badge ??
                      (result
                        ? ready >= 1
                          ? '計算結果を次へ渡す'
                          : ready > 0
                            ? '結果の行列を生成中'
                            : '計算待ち'
                        : spec.rows > 8 || spec.cols > 8
                          ? '行列全体を模式的に表示'
                          : ''))}
                </div>
              </foreignObject>
            )}
            {compact && (
              <text className="shape-badge" x={w / 2} y={h + 16} textAnchor="middle">
                保持・待機
              </text>
            )}
            {step.id === 'mask' && e.id === 'score' && (
              <text className="shape-badge" x={w / 2} y={h + 78} textAnchor="middle">
                斜線：未来のKey位置を除外
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
      {step.id === 'layers' && (
        <text x="500" y="445" textAnchor="middle" className="journey-layer-label">
          Layer {sample.layer} / 27
          <tspan x="500" dy="25">
            同じ7行のhidden stateを次の層へ
          </tspan>
        </text>
      )}
      {step.id === 'sampling' && (
        <g className="shape-story journey-story" opacity={ease((p - 0.43) / 0.15)}>
          <path d="M500,340 V430" markerEnd="url(#shape-arrow)" />
          <text x="530" y="415">
            末尾1行を取り出す
          </text>
          <path d="M625,535 H695" markerEnd="url(#shape-arrow)" />
          <text x="660" y="505">
            候補から選択
          </text>
        </g>
      )}
      {step.id === 'append' && (
        <g className="shape-story journey-story">
          <path d="M70,340 H790" />
          <text x="70" y="370">
            保持していた入力ID · 7個
          </text>
          <text
            x={chosen ? chosen.x + chosen.w / 2 : 852}
            y={Math.max(370, chosen ? chosen.y + chosen.h + 25 : 370)}
            textAnchor="middle"
          >
            + 1位置
          </text>
        </g>
      )}
      {['cache', 'decode'].includes(step.id) && (
        <g className="journey-story">
          <text x="70" y="155">
            {step.id === 'decode' ? '生成ID列 · 8個' : '保持していた入力ID · 7個'}
          </text>
        </g>
      )}
      {step.id === 'cache' && (
        <g className="shape-story journey-story">
          <text x="180" y="740">
            各層・各KV Head： [7 × 128] + 新しい [1 × 128] → [8 × 128]
          </text>
          <text x="180" y="770">
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
        opacity={leaving ? ease((p - 0.1) / 0.08) : 1}
      >
        <div>
          {process && (
            <section className="shape-process-note" data-shape-process={step.id}>
              <p className="shape-operation-title">処理 · {process.name}</p>
              <div className="shape-process-math">
                {process.formulas.map((formula, i) => (
                  <div key={i} dangerouslySetInnerHTML={{ __html: mathDocument(formula) }} />
                ))}
              </div>
              <p className="shape-process-status">
                <span>{process.phase}</span>
                {process.status}
              </p>
              <p>{process.meaning}</p>
            </section>
          )}
          {(equations.length > 0 || shapeGuide(step.id)) && (
            <p className="shape-operation-title">
              {equations.length ? '軸をつないで、結果の形へ' : 'いまの処理と軸の意味'}
            </p>
          )}
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

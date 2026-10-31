import reference from '../../data/motion-reference.json';
import type { MotionStep } from '../../data/motion';
export const pieces = ['こんにちは', '、', '今日は', 'いい', '天', '気', 'ですね'];
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const smooth = (p: number) => p * p * (3 - 2 * p);
const n = (v: number) => Number(v.toFixed(3)).toString();
const demoX = [
    [2, -1, 1],
    [0, 3, 2],
  ],
  demoW = [
    [1, 3, 2],
    [-2, 0, 1],
  ];
const product = demoX.map((row) => demoW.map((w) => row.reduce((sum, x, i) => sum + x * w[i], 0)));
function Matrix({
  data,
  x = 0,
  y = 0,
  label = '',
  activeRow = -1,
  activeCol = -1,
  tone = 'input',
  cell = 48,
}: {
  data: (number | string)[][];
  x?: number;
  y?: number;
  label?: string;
  activeRow?: number;
  activeCol?: number;
  tone?: string;
  cell?: number;
}) {
  return (
    <g transform={`translate(${x},${y})`} className={`motion-matrix ${tone}`}>
      <text className="matrix-label" x="0" y="-18">
        {label}
      </text>
      {data.map((row, i) =>
        row.map((value, j) => (
          <g key={`${i}-${j}`} transform={`translate(${j * cell},${i * cell})`}>
            <rect
              width={cell - 5}
              height={cell - 5}
              rx="6"
              className={i === activeRow || j === activeCol ? 'cell active' : 'cell'}
            />
            <text x={(cell - 5) / 2} y={(cell - 5) / 2 + 5} textAnchor="middle">
              {typeof value === 'number' ? n(value) : value}
            </text>
          </g>
        )),
      )}
    </g>
  );
}
function FlowArrow({
  x = 450,
  y = 60,
  length = 75,
  label = '',
}: {
  x?: number;
  y?: number;
  length?: number;
  label?: string;
}) {
  return (
    <g className="motion-flow">
      <path d={`M${x},${y} v${length}`} markerEnd="url(#motion-arrow)" />
      <text x={x + 13} y={y + length / 2}>
        {label}
      </text>
    </g>
  );
}
function Canvas({
  children,
  label,
  height = 340,
}: {
  children: React.ReactNode;
  label: string;
  height?: number;
}) {
  return (
    <svg className="motion-svg" viewBox={`0 0 900 ${height}`} role="img" aria-label={label}>
      {children}
    </svg>
  );
}
function Branch({
  title,
  subtitle,
  code,
  values,
  p,
  index = 0,
}: {
  title: string;
  subtitle: string;
  code: string;
  values: number[][];
  p: number;
  index?: number;
}) {
  return (
    <section className="motion-branch">
      <div className="motion-branch-heading">
        <span className="motion-branch-letter">{title}</span>
        <div>
          <strong>{subtitle}</strong>
          <code>{code}</code>
        </div>
      </div>
      <Canvas label={`${title}の分岐：${subtitle}`} height={135}>
        <Matrix data={[[2, -1, 1]]} x={40} y={45} label="共通の入力（小さな例）" />
        <g className="motion-flow">
          <path d="M205 67 H605" markerEnd="url(#motion-arrow)" />
        </g>
        <g transform={`translate(${lerp(240, 460, smooth(p))},35)`} className="motion-process">
          <rect width="122" height="60" rx="8" />
          <text x="61" y="36" textAnchor="middle">
            {code}
          </text>
        </g>
        <g opacity={Math.min(1, p * 3)}>
          <Matrix data={values} x={650} y={45} label={`${title} の出力例`} tone="output" />
        </g>
        <circle
          cx={lerp(205, 615, Math.max(0, Math.min(1, p - index * 0.04)))}
          cy="68"
          r="4"
          className="motion-particle"
        />
      </Canvas>
    </section>
  );
}
export default function MotionScene({
  step,
  p,
  layer,
  onLayer,
}: {
  step: MotionStep;
  p: number;
  layer: number;
  onLayer: (layer: number) => void;
}) {
  const t = smooth(p),
    ids = reference.ids as number[];
  if (['text', 'tokens', 'ids', 'embedding'].includes(step.kind))
    return (
      <div>
        <div className="motion-evidence-label">
          固定Tokenizer・Embeddingの観察データ <span>Qwen3-0.6B · paddingなし</span>
        </div>
        <Canvas
          height={step.kind === 'embedding' ? 430 : 320}
          label={`${step.title}。${step.action}`}
        >
          {step.kind === 'text' ? (
            <>
              <text x="450" y="150" textAnchor="middle" className="motion-sentence">
                こんにちは、今日はいい天気ですね
              </text>
              <text x="450" y="206" textAnchor="middle" className="motion-caption">
                この1本の文章を、同じ位置のまま追います
              </text>
            </>
          ) : (
            pieces.map((piece, i) => {
              const widths = pieces.map((x) => x.length * 22),
                total = widths.reduce((a, b) => a + b, 0);
              const start =
                450 - total / 2 + widths.slice(0, i).reduce((a, b) => a + b, 0) + widths[i] / 2;
              const column = 66 + i * 126;
              const x =
                step.kind === 'embedding'
                  ? lerp(column, 115, t)
                  : step.kind === 'tokens'
                    ? lerp(start, column, t)
                    : column;
              const y = step.kind === 'embedding' ? lerp(96, 62 + i * 48, t) : 114;
              return (
                <g key={i} transform={`translate(${x},${y})`}>
                  <rect
                    x="-58"
                    y="-30"
                    width="116"
                    height="55"
                    rx="8"
                    className="motion-token"
                    opacity={step.kind === 'tokens' ? t : 1}
                  />
                  <text textAnchor="middle" y="4" className="motion-token-text">
                    {piece}
                  </text>
                  {step.kind === 'ids' && (
                    <g opacity={t} transform={`translate(0,${lerp(20, 95, t)})`}>
                      <text className="motion-id" textAnchor="middle">
                        {ids[i]}
                      </text>
                      <text className="motion-caption" y="31" textAnchor="middle">
                        位置 {i}
                      </text>
                    </g>
                  )}
                  {step.kind === 'embedding' && (
                    <g opacity={t} transform="translate(90,0)">
                      <text className="motion-id" y="4">
                        {ids[i]}
                      </text>
                      <text x="100" y="4" className="motion-caption">
                        →
                      </text>
                      <Matrix
                        x={140}
                        y={-22}
                        cell={77}
                        data={[reference.vectors[i].map(n)]}
                        tone="output"
                      />
                      <text x="382" y="5" className="motion-caption">
                        … 残り1021成分
                      </text>
                    </g>
                  )}
                </g>
              );
            })
          )}
          {step.kind === 'embedding' && (
            <text x="450" y="419" textAnchor="middle" className="motion-caption">
              各Tokenが1行になる · [1, 7] → [1, 7, 1024]（batch軸は省略して描画）
            </text>
          )}
        </Canvas>
      </div>
    );
  if (step.kind === 'transpose')
    return (
      <>
        <div className="motion-evidence-label">
          小さな計算例 <span>各数字は同じ要素を追跡</span>
        </div>
        <Canvas label="3行2列のAの各要素が、転置後の2行3列へ移動する">
          <Matrix
            data={[
              [1, 2],
              [3, 4],
              [5, 6],
            ]}
            x={100}
            y={100}
            label="A [3,2]"
          />
          {[1, 2, 3, 4, 5, 6].map((v, i) => {
            const r = Math.floor(i / 2),
              c = i % 2;
            return (
              <g
                key={v}
                transform={`translate(${lerp(100 + c * 48, 580 + r * 48, t)},${lerp(100 + r * 48, 100 + c * 48, t)})`}
                className="motion-matrix output"
              >
                <rect width="43" height="43" rx="6" className="cell active" />
                <text x="21.5" y="27" textAnchor="middle">
                  {v}
                </text>
              </g>
            );
          })}
          <text x="580" y="82" className="matrix-label">
            Aᵀ [2,3]
          </text>
          <text x="450" y="285" className="motion-caption" textAnchor="middle">
            行番号と列番号が入れ替わる。数字の対応は変わらない。
          </text>
        </Canvas>
      </>
    );
  if (['linear', 'down', 'logits'].includes(step.kind)) {
    const q = Math.min(3, Math.floor(p * 4)),
      r = Math.floor(q / 2),
      c = q % 2,
      terms = demoX[r].map(
        (v, i) => `${v < 0 ? `(${v})` : v} × ${demoW[c][i] < 0 ? `(${demoW[c][i]})` : demoW[c][i]}`,
      );
    return (
      <>
        <div className="motion-evidence-label">
          小さな行列で計算を展開{' '}
          <span>
            {step.kind === 'logits'
              ? '実モデルは1024 → 151936'
              : step.kind === 'down'
                ? '実モデルは3072 → 1024'
                : '実モデルの寸法とは別の計算例'}
          </span>
        </div>
        <Canvas label={`行列積。出力${r + 1}行${c + 1}列は${product[r][c]}`}>
          <Matrix data={demoX} x={65} y={90} label="X [2,3]" activeRow={r} />
          <text x="265" y="140" className="motion-operator">
            ×
          </text>
          <Matrix
            data={[
              [1, -2],
              [3, 0],
              [2, 1],
            ]}
            x={330}
            y={90}
            label="Wᵀ [3,2]"
            activeCol={c}
            tone="weight"
          />
          <text x="510" y="140" className="motion-operator">
            =
          </text>
          <Matrix
            data={product.map((row, i) => row.map((v, j) => (i * 2 + j <= q ? v : '·')))}
            x={600}
            y={90}
            label="Y [2,2]"
            activeRow={r}
            activeCol={c}
            tone="output"
          />
          <g className="motion-sum" transform={`translate(${lerp(85, 100, t)},260)`}>
            <text>
              {terms.join(' + ')} = {product[r][c]}
            </text>
          </g>
          <text x="450" y="310" textAnchor="middle" className="motion-caption">
            選択した入力の行 × 重みの列 → 出力の1成分
          </text>
        </Canvas>
      </>
    );
  }
  if (step.kind === 'qkv')
    return (
      <div className="motion-branches">
        <div className="motion-evidence-label">
          同じ入力からの3分岐 <span>数値は役割を説明する小さな例</span>
        </div>
        <Branch title="Q" subtitle="いま、何を参照したいか" code="q_proj" values={[[2, 1]]} p={p} />
        <Branch
          title="K"
          subtitle="参照先として、何に対応するか"
          code="k_proj"
          values={[[1, 2]]}
          p={p}
          index={1}
        />
        <Branch
          title="V"
          subtitle="参照されたとき、何を渡すか"
          code="v_proj"
          values={[[3, -1]]}
          p={p}
          index={2}
        />
      </div>
    );
  if (step.kind === 'gate')
    return (
      <div className="motion-branches">
        <div className="motion-evidence-label">
          post_attention_layernorm後の共通入力 <span>各位置を別々に変換</span>
        </div>
        <Branch
          title="gate"
          subtitle="非線形変換を経て、upと組み合わせる"
          code="gate_proj"
          values={[[2, -1, 1]]}
          p={p}
        />
        <Branch
          title="up"
          subtitle="拡張した特徴を作る"
          code="up_proj"
          values={[[3, 2, -2]]}
          p={p}
        />
      </div>
    );
  if (step.kind === 'rope') {
    const angle = t * Math.PI * 0.7,
      x = 110 * Math.cos(angle),
      y = -110 * Math.sin(angle);
    return (
      <>
        <div className="motion-evidence-label">
          1 Head内の1ペアを拡大 <span>角度は説明用 · Vは回転しない</span>
        </div>
        <Canvas label="RoPEの成分ペアの回転。元のベクトルと位置を反映したベクトルを比較">
          <g transform="translate(360,170)">
            <circle r="125" className="motion-orbit" />
            <path d="M-160 0 H180 M0 -145 V145" className="motion-axis" />
            <path d="M0 0 L110 0" className="motion-original-vector" />
            <path
              d={`M0 0 L${x} ${y}`}
              className="motion-rotated-vector"
              markerEnd="url(#motion-arrow)"
            />
            <circle cx={x} cy={y} r="7" className="motion-particle" />
            <text x="160" y="23" className="motion-caption">
              成分 i
            </text>
            <text x="10" y="-133" className="motion-caption">
              成分 i+64
            </text>
          </g>
          <text x="620" y="142" className="matrix-label">
            位置 p → 角度 pω
          </text>
          <text x="620" y="182" className="motion-caption">
            QとKへ、それぞれ適用
          </text>
          <text x="620" y="214" className="motion-caption">
            比較に相対位置が反映される
          </text>
        </Canvas>
      </>
    );
  }
  if (['scores', 'mask', 'softmax'].includes(step.kind)) {
    const scores = [
      [2, 1, -1],
      [1, 3, 2],
      [0, 1, 2],
    ];
    const result = scores.map((row, i) =>
      row.map((v, j) =>
        step.kind === 'mask' && j > i && p > 0.3
          ? '−∞'
          : step.kind === 'softmax'
            ? j > i
              ? 0
              : Math.exp(v) / row.slice(0, i + 1).reduce((a, b) => a + Math.exp(b), 0)
            : v,
      ),
    );
    return (
      <>
        <div className="motion-evidence-label">
          3位置・1 Headの計算例 <span>行＝問い合わせの位置 ／ 列＝参照先の位置</span>
        </div>
        <Canvas label={`${step.name}の行列。未来位置は右上にある`}>
          <Matrix
            data={scores}
            x={120}
            y={85}
            label="QとKからのスコア例"
            activeRow={Math.min(2, Math.floor(p * 3))}
          />
          <text x="400" y="164" className="motion-operator">
            →
          </text>
          <Matrix
            data={result}
            x={560}
            y={85}
            cell={65}
            label={
              step.kind === 'softmax'
                ? '各行の合計 = 1'
                : step.kind === 'mask'
                  ? '右上の未来を隠す'
                  : 'QKᵀ / √d'
            }
            tone="output"
          />
          <text x="450" y="315" textAnchor="middle" className="motion-caption">
            {step.kind === 'softmax'
              ? '未来位置の割合は0。各行で参照割合を求める。'
              : '形は [Tq,Tkv]。Token位置間の関係を表す行列。'}
          </text>
        </Canvas>
      </>
    );
  }
  if (step.kind === 'weighted')
    return (
      <>
        <div className="motion-evidence-label">
          2つの参照先で計算する例 <span>割合 × V → 加重和</span>
        </div>
        <Canvas label="0.8倍のV1と0.2倍のV2を足す">
          <Matrix data={[[3, 1]]} x={80} y={90} label="V₁" />
          <Matrix data={[[-2, 4]]} x={80} y={200} label="V₂" />
          <g transform={`translate(${lerp(290, 420, t)},0)`}>
            <text y="118" className="motion-operator">
              × 0.8
            </text>
            <text y="228" className="motion-operator">
              × 0.2
            </text>
          </g>
          <Matrix data={[[2, 1.6]]} x={630} y={145} label="0.8V₁ + 0.2V₂" tone="output" />
        </Canvas>
      </>
    );
  if (step.kind === 'layers' || step.kind === 'final') {
    const before = step.kind === 'final' ? reference.lastRaw : reference.states[layer];
    const after =
      step.kind === 'final'
        ? reference.states[28]
        : layer === 27
          ? reference.lastRaw
          : reference.states[layer + 1];
    return (
      <>
        <div className="motion-evidence-label">
          実測値：位置0「こんにちは」の先頭8成分 <span>全成分は1024 · 表示は小数3桁</span>
        </div>
        {step.kind === 'layers' && (
          <div className="motion-layer-selector">
            <label>
              観察する層{' '}
              <select value={layer} onChange={(e) => onLayer(Number(e.target.value))}>
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i} value={i}>
                    Layer {i}
                  </option>
                ))}
              </select>
            </label>
            <div aria-label="28層の位置">
              {Array.from({ length: 28 }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  title={`Layer ${i}`}
                  aria-label={`Layer ${i}を観察`}
                  aria-pressed={i === layer}
                  onClick={() => onLayer(i)}
                >
                  {[0, 1, 26, 27].includes(i) ? i : '·'}
                </button>
              ))}
            </div>
          </div>
        )}
        <Canvas
          height={285}
          label={
            step.kind === 'final'
              ? 'Layer 27直後から最終Normへの値の変化'
              : `Layer ${layer}の前後の同じ8成分を比較`
          }
        >
          <Matrix
            data={[before.map(n)]}
            x={50}
            y={60}
            cell={96}
            label={step.kind === 'final' ? 'Layer 27直後' : `Layer ${layer}の入力`}
          />
          <FlowArrow
            y={115}
            length={45}
            label={step.kind === 'final' ? 'Final RMSNorm' : `Decoder Layer ${layer}`}
          />
          <g opacity={Math.min(1, p * 3)} transform={`translate(0,${lerp(-25, 0, t)})`}>
            <Matrix
              data={[after.map(n)]}
              x={50}
              y={205}
              cell={96}
              label={step.kind === 'final' ? 'hidden_states[28]' : `Layer ${layer}の出力`}
              tone="output"
            />
          </g>
        </Canvas>
        <p className="motion-scene-note">
          shapeは [1,7,1024]
          のまま。同じ位置・同じ成分の数値を比較しています。数値は補間せず、観察した前後の値を表示します。
        </p>
      </>
    );
  }
  if (step.kind === 'sampling')
    return (
      <div className="motion-branches">
        <div className="motion-evidence-label">
          代替ルート：どちらかを選ぶ <span>架空の3候補 · 生成結果の予告ではありません</span>
        </div>
        {['Greedy：最大スコアを選ぶ', 'Sampling：確率で選ぶ'].map((title, i) => (
          <section className="motion-branch" key={title}>
            <h3>{title}</h3>
            <div className="motion-candidates">
              {['A', 'B', 'C'].map((c, j) => (
                <div key={c} className={(i === 0 ? j === 0 : j === 1) && p > 0.7 ? 'chosen' : ''}>
                  <span>{c}</span>
                  <div style={{ width: `${[66.5, 24.5, 9][j]}%` }} />
                  <code>{[66.5, 24.5, 9][j]}%</code>
                </div>
              ))}
            </div>
            <p>{i === 0 ? 'argmax(logits) → A' : 'softmax → multinomial → 今回の例ではB'}</p>
          </section>
        ))}
      </div>
    );
  if (step.kind === 'append' || step.kind === 'cache')
    return (
      <>
        <div className="motion-evidence-label">
          生成ループの説明図 <span>追加するIDは固定モデルの観察例「。」= 1773</span>
        </div>
        <Canvas
          height={345}
          label={
            step.kind === 'cache'
              ? '各層の過去7位置のK/Vに、新しい1位置を追加する'
              : '7つのIDの末尾へ新しいIDを連結する'
          }
        >
          {Array.from({ length: 8 }, (_, i) => (
            <g
              key={i}
              transform={`translate(${64 + i * 99},${i === 7 ? lerp(30, 120, t) : 120})`}
              opacity={i === 7 ? Math.min(1, p * 3) : 1}
            >
              <rect
                width="90"
                height="65"
                rx="8"
                className={i === 7 ? 'motion-cache-new' : 'motion-token'}
              />
              <text x="45" y="28" textAnchor="middle" className="motion-caption">
                {i < 7 ? pieces[i] : '。'}
              </text>
              <text x="45" y="52" textAnchor="middle" className="motion-id">
                {i < 7 ? ids[i] : 1773}
              </text>
            </g>
          ))}
          <text x="450" y="245" textAnchor="middle" className="matrix-label">
            {step.kind === 'append'
              ? '生成列 [1,7] → [1,8]'
              : '各層の K/V [1,8,7,128] → [1,8,8,128]'}
          </text>
          <text x="450" y="286" textAnchor="middle" className="motion-caption">
            {step.kind === 'append'
              ? 'IDを選んで追加しただけでは、cacheはまだ増えない。'
              : '新しいIDを全28層へ通す。新しいQは過去＋現在のK/Vを参照。'}
          </text>
        </Canvas>
      </>
    );
  // Local examples keep an operation fully visible without implying a full model execution.
  const simple: Record<string, { left: number[][]; right: number[][]; op: string; label: string }> =
    {
      norm: {
        left: [[2, 1, -1]],
        right: [[Math.SQRT2, 1 / Math.SQRT2, -1 / Math.SQRT2]],
        op: 'RMSNorm',
        label: 'w=1、εを無視した説明例',
      },
      residual: {
        left: [
          [2, -1, 1],
          [0.5, 2, -0.5],
        ],
        right: [[2.5, 1, 0.5]],
        op: '＋',
        label: '上：保存した入力 ／ 下：Attention出力',
      },
      silu: {
        left: [[2, -1, 1]],
        right: [[2 / (1 + Math.exp(-2)), -1 / (1 + Math.exp(1)), 1 / (1 + Math.exp(-1))]],
        op: 'SiLU',
        label: 'gateの各成分へ適用',
      },
      multiply: {
        left: [
          [2, -1, 1],
          [3, 2, -2],
        ],
        right: [[6, -2, -2]],
        op: '⊙',
        label: '上：活性化後のgateの例 ／ 下：upの例',
      },
      concat: {
        left: [
          [1, 2],
          [3, 4],
        ],
        right: [[1, 2, 3, 4]],
        op: '連結',
        label: '2 Heads × 2成分の小さな例。続いてo_projで射影',
      },
      heads: {
        left: [[1, 2, 3, 4]],
        right: [
          [1, 2],
          [3, 4],
        ],
        op: 'Head分割',
        label: '4成分を2 Headsへ。数字は変えず、軸を分ける',
      },
    };
  const d = simple[step.kind] ?? simple.norm;
  return (
    <>
      <div className="motion-evidence-label">
        小さな計算例 <span>{d.label}</span>
      </div>
      <Canvas label={`${step.title}。${d.label}`}>
        <Matrix
          data={d.left}
          x={65}
          y={100}
          label="入力"
          activeRow={Math.min(d.left.length - 1, Math.floor(p * d.left.length))}
        />
        <g className="motion-process" transform={`translate(${lerp(310, 380, t)},100)`}>
          <rect width="140" height="70" rx="10" />
          <text x="70" y="42" textAnchor="middle">
            {d.op}
          </text>
        </g>
        <g opacity={Math.min(1, p * 3)}>
          <Matrix data={d.right} x={580} y={100} label="出力" tone="output" />
        </g>
        <text x="450" y="280" textAnchor="middle" className="motion-caption">
          {step.kind === 'multiply'
            ? '対応する要素だけを掛ける。内積や行列積とは別。'
            : step.kind === 'residual'
              ? '2つの入力を、同じ位置・同じ成分で足し合わせる。'
              : '入力・変換・出力の対応を、同じ画面で追う。'}
        </text>
      </Canvas>
    </>
  );
}

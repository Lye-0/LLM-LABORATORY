import Select from '../ui/Select';
import { useState } from 'react';
import {
  attention,
  dot,
  embeddingWeights,
  filteredDistribution,
  gradientStep,
  lookup,
  product,
  quantize,
  sample,
  unsqueeze,
} from '../../lib/simulations';
export function Stats({ values }: { values: [string, string | number][] }) {
  return (
    <div className="stats">
      {values.map(([label, value]) => (
        <dl className="stat" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </dl>
      ))}
    </div>
  );
}
function Matrix({
  data,
  selected = -1,
  onSelect,
}: {
  data: number[][];
  selected?: number;
  onSelect?: (i: number) => void;
}) {
  return (
    <table className="matrix">
      <caption className="sr-only">行列の値</caption>
      <tbody>
        {data.map((row, i) => (
          <tr className={i === selected ? 'selected' : ''} key={i}>
            <th scope="row">
              {onSelect ? (
                <button
                  onClick={() => onSelect(i)}
                  aria-pressed={i === selected}
                  aria-label={`ID ${i} の行を選択`}
                >
                  {i}
                </button>
              ) : (
                i
              )}
            </th>
            {row.map((v, j) => (
              <td key={j}>{Number.isFinite(v) ? v.toFixed(2) : '−∞'}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export function TensorLab() {
  const [op, setOp] = useState('none');
  const base = [89015, 5373, 133165, 126224, 35727, 94121, 128797];
  const options = [
    ['none', '元のTensor'],
    ['index', 'tensor[0]'],
    ['slice', 'tensor[0:1]'],
    ['item', 'tensor[0].item()'],
    ['axis0', 'unsqueeze(0)'],
    ['axis1', 'unsqueeze(1)'],
    ['squeeze', 'unsqueeze(0).squeeze(0)'],
  ];
  const scalar = op === 'index',
    python = op === 'item';
  const shape = scalar
    ? []
    : op === 'slice'
      ? [1]
      : op === 'axis0'
        ? unsqueeze([7], 0)
        : op === 'axis1'
          ? unsqueeze([7], 1)
          : [7];
  const values = ['index', 'slice', 'item'].includes(op) ? base.slice(0, 1) : base;
  return (
    <div>
      <div className="segmented" aria-label="Tensorの操作">
        {options.map(([id, label]) => (
          <button aria-pressed={op === id} onClick={() => setOp(id)} key={id}>
            {label}
          </button>
        ))}
      </div>
      <div className="lab-columns" style={{ marginTop: 24 }}>
        <div className="lab-pane">
          <div className="pane-title">元のtensor / 変更されない</div>
          <div className="tensor-cells">
            {base.map((v) => (
              <span className="tensor-cell" key={v}>
                {v}
              </span>
            ))}
          </div>
          <p className="value-small">shape [7] · int64 · cpu</p>
        </div>
        <div className="lab-pane">
          <div className="pane-title">選んだ操作の返り値</div>
          {op === 'axis0' && <span className="pill teal">batch軸を追加 · 1件</span>}
          <div className={`tensor-cells ${op === 'axis1' ? 'column' : ''}`}>
            {values.map((v) => (
              <span className="tensor-cell" key={v}>
                {v}
              </span>
            ))}
          </div>
          <p className="value-small">
            {python ? 'Python int' : `shape ${JSON.stringify(shape)} · int64 · cpu`}
          </p>
        </div>
      </div>
      <Stats
        values={
          python
            ? [
                ['type', 'int'],
                ['value', 89015],
              ]
            : [
                ['shape', JSON.stringify(shape)],
                ['ndim', shape.length],
                ['numel()', product(shape)],
                ['element_size()', '8 bytes'],
              ]
        }
      />
      <p className="lab-explanation">
        {python
          ? 'item()はTensorからPythonの数値を取り出します。返り値はshapeやdeviceを持ちません。'
          : scalar
            ? '軸は0本ですが、値は1個です。shape=[]とnumel()=1は両立します。'
            : op === 'slice'
              ? '位置0から1の直前までを、長さ1の並びとして取り出します。'
              : op.startsWith('axis')
                ? '長さ1の軸を挿入します。軸の本数は増えますが、要素数は7のままです。'
                : '値の並びをshapeと一緒に観察します。'}
      </p>
      <p className="code-caption">
        PyTorchのshape規則を示すブラウザー上の模式実験。CPU/GPUの転送は行いません。
      </p>
    </div>
  );
}
export function EmbeddingLab() {
  const [ids, setIds] = useState([2]),
    [batch, setBatch] = useState(false),
    [selected, setSelected] = useState(2);
  const [weights, setWeights] = useState(embeddingWeights.map((row) => [...row]));
  const output = lookup(ids, weights);
  function choose(i: number) {
    setSelected(i);
    setIds([i]);
  }
  return (
    <div>
      <div className="lab-controls">
        <Select
          label="入力ID列"
          value={ids.join(',')}
          onValueChange={(value) => setIds(value.split(',').map(Number))}
          options={[
            ...[0, 1, 2, 3, 4].map((i) => ({ value: String(i), label: `[${i}]` })),
            { value: '2,0,2', label: '[2, 0, 2]', description: '同じIDを2回含む列' },
            { value: '0,1,2,3,4', label: '[0, 1, 2, 3, 4]', description: 'すべての行を参照' },
          ]}
        />
        <label className="check-label">
          <input type="checkbox" checked={batch} onChange={(e) => setBatch(e.target.checked)} />
          batch軸を追加
        </label>
        <button
          className="button"
          onClick={() => {
            setIds([2]);
            setBatch(false);
            setSelected(2);
            setWeights(embeddingWeights.map((r) => [...r]));
          }}
        >
          初期値に戻す
        </button>
      </div>
      <div className="lab-columns three">
        <div className="lab-pane">
          <div className="pane-title">INPUT IDS</div>
          <p className="value-large">{JSON.stringify(batch ? [ids] : ids)}</p>
          <p className="value-small">
            shape {JSON.stringify(batch ? [1, ids.length] : [ids.length])}
          </p>
        </div>
        <div className="lab-pane">
          <div className="pane-title">WEIGHT / [5, 3]</div>
          <Matrix data={weights} selected={selected} onSelect={choose} />
          <p className="lab-explanation">行番号を選ぶと、そのIDを入力します。</p>
          <label>
            行{selected}の第0成分
            <input
              type="range"
              min="-2"
              max="2"
              step=".1"
              value={weights[selected][0]}
              onChange={(e) => {
                const value = Number(e.target.value);
                setWeights((w) =>
                  w.map((row, i) => (i === selected ? [value, ...row.slice(1)] : row)),
                );
              }}
            />
          </label>
        </div>
        <div className="lab-pane">
          <div className="pane-title">OUTPUT</div>
          {output.map((row, i) => (
            <div className="output-vector" key={i}>
              {row.map((v, j) => (
                <span key={j}>{v.toFixed(1)}</span>
              ))}
            </div>
          ))}
          <p className="value-small">
            shape {JSON.stringify(batch ? [1, ids.length, 3] : [ids.length, 3])}
          </p>
        </div>
      </div>
      <Stats
        values={[
          ['num_embeddings', 5],
          ['embedding_dim', 3],
          ['parameters', 15],
        ]}
      />
      <p className="lab-explanation">
        入力shapeの末尾にembedding_dimが加わります。同じIDは同じ表の行を参照します。ID
        2は添字2、上から3行目です。ここで変更するのは説明用の重みで、学習済みQwenの値ではありません。
      </p>
    </div>
  );
}
export function LinearLab() {
  const [x, setX] = useState([1, 2]),
    [w, setW] = useState([
      [1, 0],
      [0.5, -1],
    ]),
    [bias, setBias] = useState(0);
  const output = w.map((row) => dot(x, row) + bias);
  return (
    <div>
      <div className="lab-columns">
        <div className="lab-pane">
          <div className="pane-title">INPUT / [2]</div>
          <div className="inline-input">
            {x.map((v, i) => (
              <label key={i}>
                x[{i}]
                <input
                  type="number"
                  min="-10"
                  max="10"
                  step=".5"
                  value={v}
                  onChange={(e) =>
                    setX((a) => a.map((n, j) => (i === j ? Number(e.target.value) : n)))
                  }
                />
              </label>
            ))}
          </div>
          <label style={{ marginTop: 24 }}>
            共通bias
            <input
              type="range"
              min="-3"
              max="3"
              step=".5"
              value={bias}
              onChange={(e) => setBias(Number(e.target.value))}
            />
            <span>{bias}</span>
          </label>
        </div>
        <div className="lab-pane">
          <div className="pane-title">WEIGHT / [out_features, in_features]</div>
          <table className="matrix">
            <tbody>
              {w.map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => (
                    <td key={j}>
                      <input
                        aria-label={`weight ${i} ${j}`}
                        type="number"
                        min="-10"
                        max="10"
                        step=".5"
                        value={v}
                        onChange={(e) =>
                          setW((a) =>
                            a.map((r, k) =>
                              k === i ? r.map((n, l) => (l === j ? Number(e.target.value) : n)) : r,
                            ),
                          )
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="lab-pane" style={{ marginTop: 20 }}>
        <div className="pane-title">OUTPUT / [2]</div>
        {w.map((row, i) => (
          <p className="lab-data" key={i}>
            {x[0]} × {row[0]} + {x[1]} × {row[1]} + {bias} ={' '}
            <strong style={{ color: 'var(--teal)' }}>{output[i].toFixed(2)}</strong>
          </p>
        ))}
      </div>
      <p className="lab-explanation">
        PyTorchのLinearは重みを[out_features,
        in_features]として持ちます。各出力は入力と重みの1行の内積にbiasを加えた値です。
      </p>
    </div>
  );
}
export function AttentionLab() {
  const [causal, setCausal] = useState(true),
    [row, setRow] = useState(1),
    [scale, setScale] = useState(1);
  const q = [
      [1, 0],
      [scale, 1],
      [0, 1],
    ],
    k = [
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    v = [
      [1, 0],
      [0, 1],
      [2, 2],
    ];
  const result = attention(q, k, v, causal);
  return (
    <div>
      <div className="lab-controls">
        <Select
          label="詳しく見るQuery位置"
          value={String(row)}
          onValueChange={(value) => setRow(Number(value))}
          options={[0, 1, 2].map((i) => ({ value: String(i), label: `位置 ${i}` }))}
        />
        <label>
          Q[1,0] = {scale.toFixed(1)}
          <input
            type="range"
            min="-2"
            max="3"
            step=".2"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
          />
        </label>
        <label className="check-label">
          <input type="checkbox" checked={causal} onChange={(e) => setCausal(e.target.checked)} />
          未来の位置をmask
        </label>
      </div>
      <div className="lab-columns three">
        {[
          ['Q', q],
          ['K', k],
          ['V', v],
        ].map(([name, data]) => (
          <div className="lab-pane" key={name as string}>
            <div className="pane-title">{name as string} / [3, 2]</div>
            <Matrix data={data as number[][]} />
          </div>
        ))}
      </div>
      <div className="lab-columns three" style={{ marginTop: 20 }}>
        <div className="lab-pane">
          <div className="pane-title">1. QKᵀ / √2 + MASK</div>
          <Matrix data={result.scores} selected={row} />
        </div>
        <div className="lab-pane">
          <div className="pane-title">2. SOFTMAX</div>
          <Matrix data={result.probabilities} selected={row} />
        </div>
        <div className="lab-pane">
          <div className="pane-title">3. WEIGHTED SUM OF V</div>
          <Matrix data={result.output} selected={row} />
        </div>
      </div>
      <p className="lab-explanation">
        位置{row}の確率の和は{result.probabilities[row].reduce((a, b) => a + b, 0).toFixed(3)}
        。この重みでVの各行を混ぜます。
        {causal
          ? '未来の位置は−∞のスコアになり、確率が0になります。'
          : 'maskを外した状態です。生成モデルの学習では未来を見せない制約が必要です。'}{' '}
        数値は説明用で、言葉の意味や因果関係を測ったものではありません。
      </p>
    </div>
  );
}
export function SamplingLab() {
  const labels = ['です', 'でした', 'だ', 'でしょう', '。'];
  const [temperature, setTemperature] = useState(1),
    [topK, setTopK] = useState(0),
    [topP, setTopP] = useState(1),
    [seed, setSeed] = useState(42),
    [greedy, setGreedy] = useState(false),
    [selected, setSelected] = useState<number | null>(null);
  const logits = [3, 2.1, 1.5, 0.8, 0.2];
  const probabilities = greedy
    ? [1, 0, 0, 0, 0]
    : filteredDistribution(logits, temperature, topK, topP);
  const change = () => setSelected(null);
  return (
    <div>
      <div className="lab-controls">
        <label>
          temperature · {temperature.toFixed(1)}
          <input
            disabled={greedy}
            type="range"
            min=".1"
            max="2"
            step=".1"
            value={temperature}
            onChange={(e) => {
              setTemperature(Number(e.target.value));
              change();
            }}
          />
        </label>
        <Select
          label="top-k"
          value={String(topK)}
          disabled={greedy}
          onValueChange={(value) => {
            setTopK(Number(value));
            change();
          }}
          options={[
            { value: '0', label: 'すべて', description: '候補数を制限しない' },
            ...[1, 2, 3, 4].map((i) => ({
              value: String(i),
              label: `${i}`,
              description: `上位${i}候補を残す`,
            })),
          ]}
        />
        <label>
          top-p · {topP.toFixed(2)}
          <input
            disabled={greedy}
            type="range"
            min=".05"
            max="1"
            step=".05"
            value={topP}
            onChange={(e) => {
              setTopP(Number(e.target.value));
              change();
            }}
          />
        </label>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={greedy}
          onChange={(e) => {
            setGreedy(e.target.checked);
            change();
          }}
        />
        greedy（最大logitを選ぶ）
      </label>
      <div className="lab-columns">
        <div className="lab-pane">
          <div className="pane-title">候補分布 / 説明用logits</div>
          {labels.map((label, i) => (
            <div key={label} className={`bar-row ${selected === i ? 'selected' : ''}`}>
              <span>{label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${probabilities[i] * 100}%` }} />
              </div>
              <span>{(probabilities[i] * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <div className="lab-pane">
          <div className="pane-title">一つ選ぶ</div>
          <label>
            seed
            <input
              type="number"
              value={seed}
              min="0"
              max="4294967295"
              step="1"
              onChange={(e) => setSeed(Number(e.target.value))}
            />
          </label>
          <button
            className="button primary"
            style={{ marginTop: 18 }}
            onClick={() => setSelected(greedy ? 0 : sample(probabilities, seed))}
          >
            この条件で選ぶ
          </button>
          <p className="value-large" aria-live="polite">
            {selected === null ? '—' : labels[selected]}
          </p>
          <p className="lab-explanation">
            同じ条件とseedでは同じ結果です。別の試行にはseedを変えます。
          </p>
        </div>
      </div>
      <p className="lab-explanation">
        logitsは固定した説明用スコアです。temperatureはsoftmax前のスコアを割る値。top-kで候補を絞り、残った分布を正規化してtop-pを適用します。実モデルの生成結果ではありません。
      </p>
      <pre>
        <code>{`logits = [${logits.join(', ')}]\nprobabilities = softmax(logits / temperature)`}</code>
      </pre>
    </div>
  );
}
export function GenerationLab() {
  const [step, setStep] = useState(0),
    [cache, setCache] = useState(true);
  const tokens = ['今日は', 'よい', '天気', 'です', '。'];
  const initial = 2,
    current = initial + step;
  return (
    <div>
      <div className="lab-controls">
        <button
          className="button primary"
          disabled={step === 3}
          onClick={() => setStep((s) => s + 1)}
        >
          次のトークンへ進む
        </button>
        <button className="button" onClick={() => setStep(0)}>
          最初へ戻る
        </button>
        <label className="check-label">
          <input type="checkbox" checked={cache} onChange={(e) => setCache(e.target.checked)} />
          KV Cacheを使う
        </label>
      </div>
      <div className="lab-pane">
        <div className="pane-title">
          {step === 0 ? 'PREFILL / 入力を処理' : 'DECODE / 直前に追加したトークンを処理'}
        </div>
        <div className="cache-boxes">
          {tokens.slice(0, current).map((t, i) => (
            <span
              key={i}
              className={`cache-box ${i === current - 1 && step > 0 ? 'new' : cache && step > 0 ? 'cached' : ''}`}
            >
              {t}
              <br />
              <small>
                {i === current - 1 && step > 0
                  ? '新しい位置'
                  : cache && step > 0
                    ? 'K・Vを再利用'
                    : '計算対象'}
              </small>
            </span>
          ))}
        </div>
      </div>
      <Stats
        values={[
          ['列全体の長さ', current],
          ['今回のQuery位置数', step > 0 && cache ? 1 : current],
          ['参照するK/V位置数', current],
        ]}
      />
      <p className="lab-explanation">
        {step === 0
          ? '最初は入力の各位置をまとめて処理するprefillです。'
          : 'decodeでは新しい位置から過去のK/Vを参照します。'}{' '}
        Cacheは過去のK/Vの再計算を減らしますが、新しいQueryと過去のKeyの計算まで不要になるわけではありません。表示する語句と速度は模式例です。
      </p>
    </div>
  );
}
export function GradientLab() {
  const [w, setW] = useState(0.5),
    [rate, setRate] = useState(0.1),
    [step, setStep] = useState(0);
  const x = 2,
    target = 3;
  const r = gradientStep(w, x, target, rate);
  return (
    <div>
      <div className="lab-controls">
        <label>
          学習率 η · {rate.toFixed(2)}
          <input
            type="range"
            min=".01"
            max=".5"
            step=".01"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </label>
        <button
          className="button primary"
          disabled={!Number.isFinite(r.next) || Math.abs(r.next) > 1e8}
          onClick={() => {
            setW(r.next);
            setStep((s) => s + 1);
          }}
        >
          1回更新する
        </button>
        <button
          className="button"
          onClick={() => {
            setW(0.5);
            setStep(0);
          }}
        >
          初期値に戻す
        </button>
      </div>
      <Stats
        values={[
          ['step', step],
          ['weight', w.toFixed(4)],
          ['loss', r.loss.toFixed(4)],
        ]}
      />
      <div className="lab-columns">
        <div className="lab-pane">
          <div className="pane-title">FORWARD</div>
          <p className="lab-data">
            x = 2, target = 3<br />
            prediction = w × x = {r.prediction.toFixed(4)}
            <br />L = (prediction − target)² = {r.loss.toFixed(4)}
          </p>
        </div>
        <div className="lab-pane">
          <div className="pane-title">GRADIENT → UPDATE</div>
          <p className="lab-data">
            dL/dw = 2(wx − target)x
            <br />
            gradient = {r.gradient.toFixed(4)}
            <br />
            次のw = w − η × gradient
            <br />= {r.next.toFixed(4)}
          </p>
        </div>
      </div>
      <p className="lab-explanation">
        ブラウザーで解析的な勾配を計算する小例です。PyTorchのAutogradを実行しているわけではありません。学習率を大きくすると、更新しても損失が減らない場合があります。
      </p>
    </div>
  );
}
export function QuantizationLab() {
  const [bits, setBits] = useState(4),
    [outlier, setOutlier] = useState(false),
    [clip, setClip] = useState(false);
  const values = [-0.93, -0.58, -0.13, 0, 0.18, 0.42, 0.77, outlier ? 4 : 1];
  const r = quantize(values, bits, clip ? 1 : undefined);
  return (
    <div>
      <div className="lab-controls">
        <Select
          label="ビット幅"
          value={String(bits)}
          onValueChange={(value) => setBits(Number(value))}
          options={[2, 3, 4, 8].map((i) => ({ value: String(i), label: `${i} bit` }))}
        />
        <label className="check-label">
          <input type="checkbox" checked={outlier} onChange={(e) => setOutlier(e.target.checked)} />
          最後の値を外れ値4.0にする
        </label>
        <label className="check-label">
          <input type="checkbox" checked={clip} onChange={(e) => setClip(e.target.checked)} />
          範囲を±1.0に固定
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>元の値</th>
              <th>整数</th>
              <th>復元値</th>
              <th>絶対誤差</th>
            </tr>
          </thead>
          <tbody>
            {values.map((v, i) => (
              <tr key={i}>
                <td>
                  <code>{v.toFixed(3)}</code>
                </td>
                <td>
                  <code>{r.integers[i]}</code>
                </td>
                <td>
                  <code>{r.restored[i].toFixed(3)}</code>
                </td>
                <td>
                  <code>{Math.abs(v - r.restored[i]).toFixed(3)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Stats
        values={[
          ['scale', r.scale.toFixed(4)],
          ['MSE', r.mse.toFixed(5)],
          ['FP32データ', `${values.length * 4} B`],
          ['理論packedデータ', `${(values.length * bits) / 8} B`],
        ]}
      />
      <p className="lab-explanation">
        単純な対称量子化です。q = clip(round(x / scale))、復元値 = q ×
        scale。容量はscaleなどの付加情報を除く理論値で、ブラウザーの配列の使用メモリではありません。丸めはJavaScriptのMath.roundを使います。実際の量子化方式やPyTorchの丸め規則と区別してください。
      </p>
    </div>
  );
}
export function ModelLab() {
  const [selected, setSelected] = useState('embedding');
  const rows = [
    [
      'embedding',
      'Token Embedding',
      '[151936, 1024]',
      'IDから1024成分のベクトルを取り出す。Tokenizerの語彙件数151669とは異なります。',
    ],
    [
      'q',
      'Q projection',
      '[2048, 1024]',
      '16 query heads × head_dim 128 = 2048。hidden_size ÷ headsをhead_dimと決めつけません。',
    ],
    [
      'kv',
      'K / V projection',
      '各 [1024, 1024]',
      '8 KV heads × 128。GQAではQのhead数と異なります。',
    ],
    [
      'mlp',
      'MLP gate / up',
      '各 [3072, 1024]',
      'SwiGLUのgateとup。down projectionは[1024, 3072]です。',
    ],
    ['layers', 'Transformer blocks', '28 layers', '同じ構造を重ねます。各層の重みは別です。'],
    [
      'head',
      'LM head',
      '[151936, 1024]',
      'tie_word_embeddings=true。入力Embeddingとの共有をパラメータ数で二重計上しないようにします。',
    ],
  ];
  const current = rows.find((r) => r[0] === selected)!;
  return (
    <div>
      <div className="lab-columns">
        <div className="segmented" style={{ flexDirection: 'column' }}>
          {rows.map((r) => (
            <button key={r[0]} aria-pressed={selected === r[0]} onClick={() => setSelected(r[0])}>
              {r[1]}
            </button>
          ))}
        </div>
        <div className="lab-pane">
          <div className="pane-title">{current[1]}</div>
          <p className="value-large" style={{ fontSize: 24 }}>
            {current[2]}
          </p>
          <p className="lab-explanation">{current[3]}</p>
        </div>
      </div>
      <Stats
        values={[
          ['hidden_size', 1024],
          ['Q heads', 16],
          ['KV heads', 8],
          ['head_dim', 128],
        ]}
      />
      <p className="lab-explanation">
        Qwen3-0.6Bの固定revisionのconfigと構造から整理した値です。重みの実測ビューやモデルの実行ではありません。実モデルを読み込んだときはnamed_parameters()やweight.shapeで照合してください。
      </p>
    </div>
  );
}

import { useState } from 'react';
import { allowed, ropeQ, ropeK } from '../../lib/rope';
import {
  num,
  op,
  primed,
  rotated,
  rotation,
  rotationSymbol,
  row,
  scaled,
  scoreLines,
  sub,
  trans,
  vector,
} from '../../lib/rope-math';
import { withBase } from '../../lib/paths';
import '../../styles/rope.css';
function Formula({ xml, label }: { xml: string; label: string }) {
  return (
    <div
      className="rope-formula"
      role="region"
      aria-label={label}
      tabIndex={0}
      dangerouslySetInnerHTML={{
        __html: `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${xml}</math>`,
      }}
    />
  );
}
export default function RoPELab() {
  const [p, setP] = useState(3),
    [t, setT] = useState(1),
    [future, setFuture] = useState(false),
    [expressions, setExpressions] = useState(false);
  function select(q: number, k: number) {
    setP(q);
    setT(k);
  }
  const q = ropeQ[p],
    k = ropeK[t],
    valid = allowed(p, t);
  return (
    <div className="rope-lab">
      <p className="notice">
        説明用の仮定値です。学習済みモデルの実測値ではありません。Q/K
        Norm後・RoPE直前の値を仮定し、回転と内積に絞って観察します。
      </p>
      <p>
        Qwen3-0.6Bはhidden size 1024、Q 16 heads、K/V 8 heads。ここではQ head 0と対応するK head
        0の、7位置を比較します。1 headは128次元・64ペアです。
      </p>
      <p>
        成分の並びは <code>[0, 1, 64, 65]</code>。ペアは <strong>(0,64)</strong> と{' '}
        <strong>(1,65)</strong>、残り124成分は0です。ω₀・ω₁は各ペアの1位置あたりの回転角を表します。
      </p>
      <ol className="rope-flow">
        <li>Q/Kを位置ごとに回転</li>
        <li>完成した128次元同士で内積</li>
        <li>√128で割る → mask → softmax</li>
      </ol>
      <section aria-labelledby="rope-grid-title">
        <h3 id="rope-grid-title">7×7表：どのQとKを比べる？</h3>
        <p>
          行は情報を集めるQの位置p、列は参照されるKの位置t。各マスは1
          head全体の組み合わせです。選ぶと下の回転・内積の式が切り替わります。
        </p>
        <div className="rope-controls">
          {[
            [0, 0],
            [3, 1],
            [6, 2],
          ].map(([q, k]) => (
            <button
              key={`${q}-${k}`}
              type="button"
              onClick={() => select(q, k)}
              aria-pressed={p === q && t === k}
            >
              Q{q} × K{k}
            </button>
          ))}
          <label>
            <input
              type="checkbox"
              checked={future}
              onChange={(e) => {
                setFuture(e.target.checked);
                if (!e.target.checked && t > p) setT(p);
              }}
            />
            未来位置の内積も調べる
          </label>
          <label>
            <input
              type="checkbox"
              checked={expressions}
              onChange={(e) => setExpressions(e.target.checked)}
            />
            各マスに内積の式を表示
          </label>
        </div>
        <div
          className="rope-table-scroll"
          role="region"
          aria-label="QとKの7×7参照表（横にスクロール可能）"
          tabIndex={0}
        >
          <table className={`rope-table${expressions ? ' rope-table-expressions' : ''}`}>
            <caption>
              ○：参照可能　×：未来位置（mask対象）{expressions && ' ／ 式は√128で割る前の内積S'}
            </caption>
            <thead>
              <tr>
                <th scope="col">Q ＼ K</th>
                {ropeK.map((_, i) => (
                  <th scope="col" key={i}>
                    K{i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ropeQ.map((_, i) => (
                <tr key={i}>
                  <th scope="row">Q{i}</th>
                  {ropeK.map((_, j) => (
                    <td key={j} className={!allowed(i, j) ? 'rope-masked' : ''}>
                      <button
                        type="button"
                        disabled={!future && !allowed(i, j)}
                        aria-pressed={p === i && t === j}
                        aria-label={`Q${i} × K${j}、位置差${j - i}、${allowed(i, j) ? '参照可能' : '未来位置・mask対象'}`}
                        onClick={() => select(i, j)}
                      >
                        <strong>{allowed(i, j) ? '○' : '×'}</strong>
                        <small>t−p={j - i}</small>
                        {expressions && (future || allowed(i, j)) && (
                          <span
                            className="rope-cell-formula"
                            dangerouslySetInnerHTML={{
                              __html: `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${scoreLines(i, j)}</math>`,
                            }}
                          />
                        )}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rope-selection" role="status">
          選択：Q{p} × K{t} ／ 相対位置 t−p = {t}−{p} = {t - p} ／{' '}
          {valid ? '参照可能' : '未来位置：内積は調べられますが、Attentionではmask対象です'}
        </p>
      </section>
      <section aria-labelledby="rope-rotation-title">
        <h3 id="rope-rotation-title">1. QとKを、それぞれの位置で回転する</h3>
        <p>
          下は128×128の回転のうち、値を持つ4成分を抜き出した行列です。列ベクトル表記を使います。横に長い数式はスクロールして読めます。
        </p>
        <div className="rope-heads">
          {(['Q', 'K'] as const).map((type) => {
            const pos = type === 'Q' ? p : t,
              v = type === 'Q' ? q : k;
            return (
              <article className="lab-pane" key={type}>
                <h4>
                  {type}
                  {pos} → {type}′{pos}：回転を完了
                </h4>
                <Formula label={`${type}の元ベクトル`} xml={sub(type, pos) + op('=') + vector(v)} />
                <Formula
                  label={`${type}の回転行列と行列積`}
                  xml={primed(type, pos) + op('=') + rotation(pos) + vector(v)}
                />
                <Formula
                  label={`${type}の回転後の成分`}
                  xml={primed(type, pos) + op('=') + rotated(v, pos)}
                />
              </article>
            );
          })}
        </div>
      </section>
      <section aria-labelledby="rope-dot-title">
        <h3 id="rope-dot-title">2. 完成したQ′とK′で、1つの内積を求める</h3>
        <p>
          64ペアの回転を終えた128次元同士を比較します。ペアごとに別のAttentionスコアを作るわけではありません。
        </p>
        <Formula
          label="回転後の内積"
          xml={
            trans(primed('Q', p)) +
            primed('K', t) +
            op('=') +
            trans(rotationSymbol(p) + sub('Q', p)) +
            row(op('(') + rotationSymbol(t) + sub('K', t) + op(')'))
          }
        />
        <Formula
          label="相対位置が現れる変形"
          xml={
            op('=') +
            trans(sub('Q', p)) +
            trans(rotationSymbol(p)) +
            rotationSymbol(t) +
            sub('K', t) +
            op('=') +
            trans(sub('Q', p)) +
            rotationSymbol(p, t) +
            sub('K', t)
          }
        />
        <p>
          回転の転置は逆回転なので、RₚᵀRₜ =
          Rₜ₋ₚ。これは同じ計算の書き換えで、実装がさらにKを回し直すという意味ではありません。
        </p>
        <details>
          <summary>整数ベクトルと相対回転行列を代入する</summary>
          <Formula
            label="相対回転行列への代入"
            xml={vector(q, true) + rotation(p, t) + vector(k)}
          />
          <Formula
            label="相対回転行列とKの積"
            xml={rotationSymbol(p, t) + sub('K', t) + op('=') + rotated(k, p, t)}
          />
          <Formula label="元のQと相対回転したKの積" xml={vector(q, true) + rotated(k, p, t)} />
        </details>
        <div className="rope-result">
          <h4>内積 S（スケーリング前）</h4>
          <Formula
            label="内積の最終式"
            xml={
              `<msub><mi>S</mi><mrow>${num(p)}<mo>,</mo>${num(t)}</mrow></msub>` +
              op('=') +
              scoreLines(p, t)
            }
          />
          <p>
            {p === t
              ? '同じ位置では相対回転が0になり、回転前のQとKの内積と一致します。'
              : '整数係数だけを計算し、(t−p)ωとsin・cosを残しています。同じ位置差でも、元のQ/Kが異なれば内積は異なります。'}
          </p>
        </div>
      </section>
      <section aria-labelledby="rope-score-title">
        <h3 id="rope-score-title">3. Attentionスコアへ：スケールとmask</h3>
        <Formula
          label="スケーリングしたAttentionスコア"
          xml={row('<mi>score</mi>') + op('=') + scaled(p, t)}
        />
        <p>
          {valid
            ? 'この組は参照可能なので、この後の行ごとのsoftmaxへ進みます。'
            : 'この組は未来位置です。mask後は−∞（理想化表記）となり、softmax後の重みは0になります。'}
        </p>
        <p>
          ここで表示したのは確率になる前のスコアです。選択したheadの表は7×7、全Q heads・batch=1では{' '}
          <code>[1,16,7,7]</code>。その後、行ごとのsoftmaxでVを混ぜる割合を求めます。
        </p>
        <a className="text-link" href={withBase('/labs/attention/')}>
          Attention Labでmask・softmax・Vの加重和へ →
        </a>
      </section>
      <details>
        <summary>説明に使った7位置の元データ</summary>
        <div
          className="rope-table-scroll"
          role="region"
          aria-label="説明用のQ/Kデータ"
          tabIndex={0}
        >
          <table>
            <caption>成分順：[0,1,64,65]。各位置で残り124成分は0。</caption>
            <thead>
              <tr>
                <th>位置</th>
                <th>Q</th>
                <th>K</th>
              </tr>
            </thead>
            <tbody>
              {ropeQ.map((v, i) => (
                <tr key={i}>
                  <th scope="row">{i}</th>
                  <td>
                    <code>[{v.join(', ')}]</code>
                  </td>
                  <td>
                    <code>[{ropeK[i].join(', ')}]</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p>
        <a
          className="text-link"
          href="https://github.com/huggingface/transformers/blob/v5.18.0/src/transformers/models/qwen3/modeling_qwen3.py"
        >
          確認したQwen3実装：rotate_half・apply_rotary_pos_emb・Attention
        </a>
      </p>
    </div>
  );
}

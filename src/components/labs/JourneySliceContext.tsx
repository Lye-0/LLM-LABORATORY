import type { JourneySample } from '../../lib/journey-scene';
import { tokenPieces } from '../../lib/journey-model';
import { ease } from '../../lib/journey-timing';

export default function JourneySliceContext({
  sample,
  view,
}: {
  sample: JourneySample;
  view: 'numbers' | 'shapes';
}) {
  const stage = sample.step.id;
  if (
    ![
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
    ].includes(stage)
  )
    return null;
  const numeric = view === 'numbers';
  const joining = stage === 'concat',
    joined =
      stage === 'o-proj' ||
      (joining && (numeric ? sample.progress >= 0.6 : sample.calculation >= 1));
  const splitting =
    stage === 'heads' && (numeric ? sample.progress < 0.6 : sample.calculation < 0.5);
  const before = stage === 'qkv';
  const factor = numeric ? 3 : 128,
    count = numeric ? 2 : 16;
  const headIds = numeric ? ['0', '1'] : ['0', '1', '…', '15'];
  const merge = joining ? (numeric ? ease(sample.progress / 0.6) : ease(sample.calculation)) : 0;
  const current = Math.min(6, Math.floor(sample.calculation * 7));
  const focus = before
    ? '各TokenからQ・K・Vを作る'
    : joining
      ? '同じTokenの成分を横へ連結。Tokenの7行は維持する'
      : stage === 'o-proj'
        ? '連結した全成分を使って出力射影する'
        : stage === 'transpose' && numeric
          ? sample.progress < 0.6
            ? 'Kの位置を整えてから転置する'
            : sample.progress < 0.92
              ? 'Kの行と列を交換中。Q Head 0は保持する'
              : 'Kの転置が完了。Q Head 0との比較へ進む'
          : sample.calculation <= 0
            ? '位置を整えてから処理する'
            : sample.calculation >= 1
              ? '全7位置の処理が完了'
              : stage === 'heads'
                ? `正規化中：Token位置 ${current}「${tokenPieces[current]}」`
                : stage === 'transpose'
                  ? 'Kの行と列を交換中。Q Head 0は保持する'
                  : `${numeric ? '詳細計算' : '代表例'}：Query位置 ${current}「${tokenPieces[current]}」`;
  return (
    <foreignObject x="220" y="12" width="560" height="124" className="journey-slice-panel">
      <div
        className="journey-slice-context"
        data-slice-view={view}
        data-head-state={
          before
            ? 'unsplit'
            : splitting
              ? 'splitting'
              : joined
                ? 'joined'
                : joining
                  ? 'joining'
                  : 'slice'
        }
      >
        <div className="slice-location">
          <span>表示範囲</span>
          <strong>Batch 0 · Layer 0 · Token位置 0〜6</strong>
          <small>{numeric ? '説明モデル Q 2 / KV 1' : '実モデル Q 16 / KV 8'}</small>
        </div>
        <div className="slice-head-row">
          <strong>
            {before
              ? '分割前のQ'
              : splitting
                ? 'Qの成分を分割'
                : joined
                  ? '全Head連結済み'
                  : joining
                    ? 'Headの結果を結合'
                    : 'Q Head 0の経路を表示'}
          </strong>
          {!before && (
            <div
              className={`slice-heads ${joined ? 'is-joined' : ''}`}
              style={{ gap: joining ? `${(1 - merge) * 12}px` : undefined }}
            >
              {headIds.map((id) => (
                <span key={id} className={id === '0' && !joined ? 'is-current' : ''}>
                  {id === '…' ? '…' : `Head ${id}`}
                </span>
              ))}
            </div>
          )}
          <span>
            {before
              ? `${numeric ? 6 : 2048}成分 → ${count} Heads × ${factor}成分`
              : joined
                ? `${count} × ${factor} = ${count * factor}成分`
                : joining
                  ? `${count} Heads → 各Tokenの${count * factor}成分`
                  : `共有 KV Head 0${numeric ? '' : ' / 8'} → Q Head 0・1`}
          </span>
        </div>
        <div className="slice-focus">
          {focus}
          {!before && !joining && !joined && <small>ほかのHeadも、それぞれ同じ処理を行う</small>}
        </div>
      </div>
    </foreignObject>
  );
}

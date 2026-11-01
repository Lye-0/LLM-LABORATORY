import type { JourneySample } from '../../lib/journey-scene';

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
  const splitting =
    stage === 'heads' && (numeric ? sample.progress < 0.6 : sample.calculation < 0.5);
  const joined =
    stage === 'o-proj' ||
    (stage === 'concat' && (numeric ? sample.progress >= 0.6 : sample.calculation >= 1));
  // Full-token rows and arithmetic highlights are not sliced axes. During the
  // split/merge, several Heads are visible, so don't claim a single Head slice.
  const headSlice = !['qkv', 'concat', 'o-proj'].includes(stage) && !splitting;

  return (
    <foreignObject x="220" y="12" width="560" height="64" className="journey-slice-panel">
      <div
        className="journey-slice-context"
        data-slice-view={view}
        data-head-state={
          stage === 'qkv'
            ? 'unsplit'
            : splitting
              ? 'splitting'
              : joined
                ? 'joined'
                : stage === 'concat'
                  ? 'joining'
                  : 'slice'
        }
      >
        <span className="slice-caption">表示スライス</span>
        <span className="slice-location">Batch 0 · Layer 0</span>
        {headSlice && (
          <span className="slice-head-range">
            Q Head 0 / 全{numeric ? 2 : 16} · KV Head 0 / 全{numeric ? 1 : 8}
          </span>
        )}
      </div>
    </foreignObject>
  );
}

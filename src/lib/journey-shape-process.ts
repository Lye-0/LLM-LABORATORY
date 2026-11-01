import type { JourneySample } from './journey-scene';
import { operationFormulas } from './journey-formulas';

const processes: Record<
  string,
  { name: string; before: string; during: string; after: string; meaning: string; keys?: string[] }
> = {
  norm: {
    name: 'RMSNorm',
    before: 'Embeddingを受け取る',
    during: '各Tokenの成分の尺度を整える',
    after: '正規化したXをQ・K・Vの射影へ渡す',
    meaning:
      'xは1行の成分、d=1024。RMSのrで割り、学習済みの係数wを掛ける。εは計算を安定させる小さな値。型は7×1024を維持する。',
  },
  heads: {
    name: 'Head分割・Q/K RMSNorm',
    before: '射影で作ったQ・K・Vを受け取る',
    during: 'Head軸へ分け、QとKのHead内成分を正規化する',
    after: '1 Headあたり7位置×128成分。Vは正規化しない',
    meaning:
      'Qは16 Heads、K/Vは8 Heads。QとKのRMSは別に求める。xは1 Headの成分、d=128、rはRMS、wは学習済み係数。εは計算を安定させる小さな値。表示は対応する1 Head。',
    keys: ['q-norm', 'k-norm'],
  },
  rope: {
    name: 'RoPE',
    before: 'Head内で正規化したQ・Kを受け取る',
    during: '同じToken位置のQ・Kへ、位置に応じた回転を適用する',
    after: '位置を反映したQ′・K′を次へ。Vは保持する',
    meaning:
      'pはToken位置、ωは成分ペアごとの周波数、Rは回転行列。回転するのは各成分ペアで、行列全体の軸は交換しない。',
    keys: ['q', 'k'],
  },
  transpose: {
    name: 'Transpose · Kを転置',
    before: 'K′の縦はKey位置、横は比較する成分',
    during: '同じ長方形を回転し、行と列の軸を交換する',
    after: '縦128成分×横7 Key位置。Q′と掛けられる型になる',
    meaning:
      'iはKey位置、jは成分。行列全体のスピンは軸交換を表す模式的な動き。型は7×128から128×7へ。RoPEの成分ペアの回転とは別の処理。',
  },
  mask: {
    name: 'Causal mask',
    before: 'Q′とK′から作った参照スコアSを受け取る',
    during: '未来のKey位置を参照候補から外す',
    after: '未来への参照を禁止したSₘ。型は7×7のまま',
    meaning:
      'iはQuery位置、jはKey位置。j>iのスコアを−∞にし、次のSoftmaxで割合が0になるようにする。斜線は参照禁止範囲の模式図。',
  },
  softmax: {
    name: 'Softmax',
    before: 'Maskを適用したスコアSₘを受け取る',
    during: '各Queryの行で指数関数を適用し、行の合計で割る',
    after: '各行の合計が1の参照割合P。禁止位置は0になる',
    meaning:
      'sは1つのQueryのスコアの行。最大値を引いて計算を安定させる。7×7の型は変わらず、スコアから割合へ意味が変わる。',
  },
  'post-norm': {
    name: 'RMSNorm · MLPの前',
    before: 'Residual ①の結果H₁を受け取る',
    during: 'H₁を保存し、MLPへ渡す成分の尺度を整える',
    after: '正規化したXₘをGate・Upへ渡す',
    meaning:
      '保存したH₁はResidual ②で使う。xは1行の成分、d=1024、rはRMS、wは学習済み係数、εは安定化の小さな値。型は7×1024のまま。',
  },
  silu: {
    name: 'SiLU',
    before: 'Gate射影の出力Gを受け取る',
    during: 'Gの各成分へSiLU関数を適用する',
    after: 'SiLU後のGₐ。保持していたUとの要素積へ進む',
    meaning: 'σはシグモイド関数。各成分gにg×σ(g)を適用する。7×3072の型は維持する。',
  },
  final: {
    name: 'Final RMSNorm',
    before: '28層を通ったhidden stateを受け取る',
    during: '各Tokenの成分の尺度を最終的に整える',
    after: 'HfinalをLM headへ渡す。型は7×1024のまま',
    meaning:
      'xは1行の成分、d=1024、rはRMS、wは学習済み係数、εは安定化の小さな値。語彙候補のスコアへ写す前に正規化する。',
  },
  layers: {
    name: 'Decoder Layerの反復',
    before: '1層目の出力を受け取る',
    during: '前の層の結果を、次の層の入力として使う',
    after: '全28層の処理が完了。最終RMSNormへ進む',
    meaning: '各層で使う重みは別。7位置×1024成分の型を維持しながら内部表現を更新する。',
  },
  sampling: {
    name: 'Softmax・Greedy選択',
    before: '各位置の語彙候補スコアZを受け取る',
    during: '末尾の1行を取り出し、確率へ変換して候補を選ぶ',
    after: '選んだ次のIDを、保持していたID列の末尾へ追加する',
    meaning: 'ここではGreedy選択を示す。pは候補の確率。argmaxは最も大きい候補の位置を返す。',
  },
};

export function shapeProcess(sample: JourneySample) {
  const process = processes[sample.step.id];
  if (!process) return null;
  const c = sample.calculation;
  const decomposition =
    sample.step.id === 'heads'
      ? [
          '<mrow><mtext>Q：</mtext><mn>2048</mn><mo>=</mo><mn>16</mn><mo>×</mo><mn>128</mn><mspace width="1em"/><mtext>K/V：</mtext><mn>1024</mn><mo>=</mo><mn>8</mn><mo>×</mo><mn>128</mn></mrow>',
        ]
      : [];
  return {
    ...process,
    formulas: decomposition.concat(
      (process.keys ?? [sample.step.id])
        .flatMap((key) => operationFormulas(sample.step.id, key))
        .filter((formula, i, all) => sample.step.id !== 'rope' || all.indexOf(formula) === i),
    ),
    status:
      c === 0
        ? process.before
        : c >= 1
          ? process.after
          : `${process.during} · ${Math.round(c * 100)}%`,
    phase: c === 0 ? '処理前' : c >= 1 ? '完了' : '処理中',
  };
}

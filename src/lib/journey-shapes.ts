import { journeySteps } from '../data/journey';
import { actorId, binaryActors, projectionActors } from './journey-actors';
import { journeyFrames, type Entity, type JourneySample } from './journey-scene';
import { ease, stageMovement } from './journey-timing';

export interface ShapeSpec {
  name: string;
  rows: number;
  cols: number;
  rowAxis: string;
  colAxis: string;
  badge?: string;
  square?: boolean;
}
export interface ShapePose {
  cx: number;
  cy: number;
  width: number;
  height: number;
}
const rank = (id: string) => journeySteps.findIndex((s) => s.id === id);
const feature = (name: string, cols = 1024, badge?: string): ShapeSpec => ({
  name,
  rows: 7,
  cols,
  rowAxis: 'Token位置',
  colAxis: '表現の成分',
  badge,
});
const weight = (name: string, rows: number, cols: number): ShapeSpec => ({
  name,
  rows,
  cols,
  rowAxis: '入力の成分',
  colAxis: '出力の成分',
});

// Structural facts for Qwen3-0.6B, independent of the small numerical example.
export function shapeSpec(step: string, id: string): ShapeSpec | null {
  const i = rank(step);
  if (id === 'hidden') return feature(i < rank('norm') ? 'H₀ · Embedding' : 'X · RMSNorm後');
  if (id === 'skip') return feature('H₀ · 保存した入力');
  if (id === 'skip2') return feature('H₁ · 保存した入力');
  if (id === 'attn')
    return {
      ...feature(
        'C · Head出力',
        i >= rank('concat') ? 2048 : 128,
        i >= rank('concat') ? '16 Heads × 128成分を連結' : '1 Headを表示 / 全16 Heads',
      ),
      rowAxis: i < rank('concat') ? 'Query位置' : 'Token位置',
    };
  if (id === 'attention-state') return feature('A · Attention出力');
  if (id === 'residual-attn-state')
    return feature(i >= rank('post-norm') ? 'Xₘ · MLPへの入力' : 'H₁ · Residual ①の結果');
  if (id === 'gate') return feature(i >= rank('silu') ? 'Gₐ · SiLU後' : 'G · Gate射影', 3072);
  if (id === 'up') return feature('U · Up射影', 3072);
  if (id === 'mixed-state') return feature('M · 要素積の結果', 3072);
  if (id === 'mlp-state') return feature('D · MLP出力');
  if (id === 'layer-state')
    return feature(i >= rank('final') ? 'Hfinal · 最終正規化後' : 'H · 層の出力');
  if (id === 'logits-state')
    return {
      ...feature('Z · 語彙候補のスコア', 151936),
      colAxis: '語彙候補',
      badge: '各位置で151936候補を採点',
    };
  if (id === 'q' || id === 'k' || id === 'v') {
    const isQ = id === 'q',
      isK = id === 'k';
    const split = i >= rank('heads');
    const spec = feature(
      isQ ? 'Q · 情報を集める側' : isK ? 'K · 参照先の照合' : 'V · 渡す情報',
      split ? 128 : isQ ? 2048 : 1024,
    );
    spec.rowAxis = isQ ? 'Query位置' : 'Key / Value位置';
    spec.colAxis = isQ || isK ? '比較する成分' : '渡す情報の成分';
    spec.badge = split
      ? isQ
        ? 'Q Head 0 / 全16 Heads'
        : 'KV Head 0 / 全8 Heads · Q Head 0・1で共有'
      : isQ
        ? '16 Heads × 128成分'
        : '8 Heads × 128成分';
    if (isK && i >= rank('transpose') && i < rank('cache'))
      return {
        ...spec,
        name: '(K′)ᵀ · 転置後',
        rows: 128,
        cols: 7,
        rowAxis: '比較する成分',
        colAxis: 'Key位置',
      };
    if (i >= rank('cache'))
      return {
        ...spec,
        name: isK ? 'K · 保持済みの値' : 'V · 保持済みの値',
        badge: 'Layer 0 / KV Head 0 · 過去7位置を保持',
      };
    if (i >= rank('rope') && (isQ || isK)) spec.name = isQ ? 'Q′ · RoPE後' : 'K′ · RoPE後';
    return spec;
  }
  if (id === 'score')
    return {
      name:
        i >= rank('softmax')
          ? 'P · 参照割合'
          : i >= rank('mask')
            ? 'Sₘ · Mask後'
            : 'S · 参照スコア',
      rows: 7,
      cols: 7,
      rowAxis: 'Query位置',
      colAxis: 'Key位置',
      square: true,
      badge: '1 Headの対戦表 / 全16 Heads',
    };
  if (id === 'weight-q') return weight('Wqᵀ · Qの重み', 1024, 2048);
  if (id === 'weight-k' || id === 'weight-v')
    return weight(id === 'weight-k' ? 'Wkᵀ · Kの重み' : 'Wvᵀ · Vの重み', 1024, 1024);
  if (id === 'weight-gate' || id === 'weight-up')
    return weight(id === 'weight-gate' ? 'Wgateᵀ' : 'Wupᵀ', 1024, 3072);
  if (id === 'weight')
    return i >= rank('logits')
      ? { ...weight('WLMᵀ · LM headの重み', 1024, 151936), colAxis: '語彙候補' }
      : i >= rank('down')
        ? weight('Wdownᵀ', 3072, 1024)
        : weight('Woᵀ', 2048, 1024);
  if (id === 'prob')
    return {
      name: 'p · 次Tokenの確率',
      rows: 1,
      cols: 151936,
      rowAxis: '末尾のQuery',
      colAxis: '語彙候補',
      badge: '最後の行から候補を比較',
    };
  if (id.startsWith('cache-new-'))
    return {
      ...feature(id.endsWith('k') ? '新しいK' : '新しいV', 128),
      rows: 1,
      rowAxis: '追加する1位置',
      badge: 'この層・このHeadの新しい値',
    };
  if (id.startsWith('cache-'))
    return {
      name: `Layer ${id.split('-')[1]} · ${id.endsWith('K') ? 'K' : 'V'}`,
      rows: 8,
      cols: 128,
      rowAxis: '保持する位置',
      colAxis: 'Head内の成分',
      badge: '過去7位置 + 新しい1位置 / KV Headごとに保存',
    };
  return null;
}

export function shapeSize(s: ShapeSpec): { width: number; height: number } {
  if (s.square || (s.rows === 7 && s.cols === 7)) return { width: 176, height: 176 };
  if (s.rows === 128 && s.cols === 7) return { width: 136, height: 192 };
  const width = s.cols >= 2048 ? (s.cols === 151936 && s.rows <= 7 ? 230 : 210) : 192;
  return { width, height: s.rows === 1 ? 70 : (width * 136) / 192 };
}

function pose(step: string, e: Entity, s: ShapeSpec): ShapePose {
  const { width, height } = shapeSize(s);
  const columns = e.transpose ? e.data.length : (e.data[0]?.length ?? 1);
  const rows = e.transpose ? (e.data[0]?.length ?? 1) : e.data.length;
  let cx = e.x + (columns * e.w) / 2,
    cy = e.y + (rows * e.h) / 2;
  const projection = projectionActors(step),
    binary = binaryActors(step);
  if (e.id.startsWith('skip') && binary?.second !== e.id && binary?.input !== e.id)
    return { cx: 88, cy: e.y + 62, width: 76, height: (76 * 136) / 192 };
  if (step === 'embedding' && e.id === 'hidden') cx = 670;
  if (step === 'qkv') {
    if (e.id === 'hidden') {
      cx = 275;
      cy = 570;
    }
    for (const [j, id] of ['q', 'k', 'v'].entries()) {
      if (e.id === `weight-${id}`) {
        cx = 540;
        cy = 250 + j * 320;
      }
      if (e.id === id) {
        cx = 815;
        cy = 250 + j * 320;
      }
    }
  } else if (step === 'gate') {
    if (e.id === actorId(step, 'attn')) {
      cx = 275;
      cy = 550;
    }
    for (const [j, id] of ['gate', 'up'].entries()) {
      if (e.id === `weight-${id}`) {
        cx = 540;
        cy = 250 + j * 540;
      }
      if (e.id === id) {
        cx = 815;
        cy = 250 + j * 540;
      }
    }
  } else if (projection) {
    if (e.id === projection.input) {
      cx = 275;
      cy = 285;
    }
    if (e.id === 'weight') {
      cx = 545;
      cy = 285;
    }
    if (e.id === projection.output) {
      cx = 825;
      cy = 285;
    }
  } else if (binary) {
    if (e.id === (step === 'multiply' ? binary.input : binary.second)) {
      cx = 275;
      cy = 285;
    }
    if (e.id === (step === 'multiply' ? binary.second : binary.input)) {
      cx = 550;
      cy = 285;
    }
    if (e.id === binary.output) {
      cx = 815;
      cy = 285;
    }
  } else if (step === 'scores' || step === 'transpose') {
    if (e.id === 'q') {
      cx = 275;
      cy = 285;
    }
    if (e.id === 'k') {
      cx = 535;
      cy = 285;
    }
    if (e.id === 'score') {
      cx = 815;
      cy = 285;
    }
  } else if (step === 'weighted') {
    if (e.id === 'score') {
      cx = 275;
      cy = 285;
    }
    if (e.id === 'v') {
      cx = 535;
      cy = 285;
    }
    if (e.id === 'attn') {
      cx = 815;
      cy = 285;
    }
  } else if (['norm', 'post-norm', 'concat', 'layers', 'final', 'mask', 'softmax'].includes(step)) {
    const main =
      step === 'norm'
        ? 'hidden'
        : ['mask', 'softmax'].includes(step)
          ? 'score'
          : step === 'post-norm' || step === 'concat'
            ? actorId(step, 'attn')
            : actorId(step, 'gate');
    if (e.id === main) {
      cx = 500;
      cy = 285;
    }
  } else if (step === 'sampling') {
    if (e.id === actorId(step, 'gate')) {
      cx = 500;
      cy = 260;
    }
    if (e.id === 'prob') {
      cx = 500;
      cy = 535;
    }
  } else if (step === 'cache') {
    if (e.id === 'k' || e.id === 'cache-new-k') {
      cx = 350;
      cy = e.id === 'k' ? 380 : 620;
    }
    if (e.id === 'v' || e.id === 'cache-new-v') {
      cx = 700;
      cy = e.id === 'v' ? 380 : 620;
    }
    if (/^cache-(1|27)-/.test(e.id)) {
      cx = e.id.endsWith('K') ? 350 : 700;
      cy = e.id.includes('-27-') ? 1190 : 910;
    }
  }
  if ((e.id === 'v' || e.id === 'up') && e.x < 175)
    return { cx: 88, cy: e.y + 62, width: 76, height: (76 * 136) / 192 };
  return { cx, cy, width, height };
}

export function shapeActors(sample: JourneySample) {
  const previous = journeySteps[Math.max(0, sample.index - 1)].id;
  const p = stageMovement(sample.step.id, sample.progress);
  return sample.entities.map((e) => {
    const before =
        e.start.opacity === 0 ? shapeSpec(sample.step.id, e.id) : shapeSpec(previous, e.id),
      after = shapeSpec(sample.step.id, e.id);
    let start = before
      ? pose(e.start.opacity === 0 ? sample.step.id : previous, e.start, before)
      : null;
    if (e.id.startsWith('skip') && !journeyFrames[Math.max(0, sample.index - 1)].entities[e.id]) {
      const sourceId = e.id === 'skip' ? 'hidden' : actorId(previous, 'attn');
      const sourceSpec = shapeSpec(previous, sourceId);
      if (sourceSpec) start = pose(previous, { ...e.start, id: sourceId }, sourceSpec);
    }
    let end = after ? pose(sample.step.id, e.end, after) : null;
    if (e.end.opacity === 0 && start) end = start;
    const a = start ?? end,
      b = end ?? start;
    const at =
      a && b
        ? {
            cx: a.cx + (b.cx - a.cx) * p,
            cy: a.cy + (b.cy - a.cy) * p,
            width: a.width + (b.width - a.width) * p,
            height: a.height + (b.height - a.height) * p,
          }
        : null;
    const fromAngle = before?.rows === 128 && before.cols === 7 ? 90 : 0;
    const toAngle = after?.rows === 128 && after.cols === 7 ? 90 : 0;
    const turning = sample.step.id === 'transpose' && e.id === 'k';
    const rotation = fromAngle + (toAngle - fromAngle) * (turning ? ease(sample.calculation) : p);
    if (at && turning && a && b) {
      // A rigid plate spins; its sides never morph into a different rectangle.
      const radians = (rotation * Math.PI) / 180;
      at.width = 192 * Math.abs(Math.cos(radians)) + 136 * Math.abs(Math.sin(radians));
      at.height = 192 * Math.abs(Math.sin(radians)) + 136 * Math.abs(Math.cos(radians));
    }
    // The retained Up value travels below Gate rather than crossing through it.
    if (at && sample.step.id === 'multiply' && e.id === 'up') at.cy += 220 * Math.sin(Math.PI * p);
    return {
      rotation,
      turning,
      moving: Boolean(
        a &&
        b &&
        Math.abs(a.cx - b.cx) +
          Math.abs(a.cy - b.cy) +
          Math.abs(a.width - b.width) +
          Math.abs(a.height - b.height) >
          1,
      ),
      movement: p,
      entity: e,
      spec:
        (['heads', 'transpose'].includes(sample.step.id)
          ? sample.calculation >= 0.5
          : sample.calculation > 0) || !before
          ? after
          : before,
      target: after,
      pose: at,
    };
  });
}

export interface ShapeOperation {
  inputs: string[];
  output: string;
  kind: 'matmul' | 'add' | 'product' | 'transpose' | 'unary';
  text: string;
}
export function shapeOperations(step: string): ShapeOperation[] {
  const projection = projectionActors(step),
    binary = binaryActors(step);
  if (projection)
    return [
      {
        inputs: [projection.input, 'weight'],
        output: projection.output,
        kind: 'matmul',
        text:
          step === 'logits'
            ? '1024成分を語彙候補それぞれのスコアへ写す。Tokenizerの語彙数とは別の、モデルの出力候補数。'
            : step === 'down'
              ? '3072成分を1024成分へ戻す。Token位置の軸は保持する。'
              : '16 Headを連結した2048成分を1024成分へ写す。',
      },
    ];
  if (binary)
    return [
      {
        inputs: step === 'multiply' ? [binary.input, binary.second] : [binary.second, binary.input],
        output: binary.output,
        kind: step === 'multiply' ? 'product' : 'add',
        text:
          step === 'multiply'
            ? '同じ位置・同じ成分を掛ける。内側の軸を縮約する行列積とは異なる。'
            : '同じ位置・同じ成分を足す。入力2つは保持し、新しい結果を作る。',
      },
    ];
  if (step === 'qkv')
    return ['q', 'k', 'v'].map((id) => ({
      inputs: ['hidden', `weight-${id}`],
      output: id,
      kind: 'matmul',
      text: id === 'q' ? 'Qは16 Head × 128成分。' : 'K/Vは8 Head × 128成分。',
    }));
  if (step === 'gate')
    return ['gate', 'up'].map((id) => ({
      inputs: [actorId(step, 'attn'), `weight-${id}`],
      output: id,
      kind: 'matmul',
      text: '同じ入力を別の重みへ通し、特徴の幅を3072成分へ広げる。',
    }));
  if (step === 'scores')
    return [
      {
        inputs: ['q', 'k'],
        output: 'score',
        kind: 'matmul',
        text: '128成分で内積を取り、√128でスケールを整える。残る2軸はQuery位置とKey位置。ここではまだスコア。',
      },
    ];
  if (step === 'weighted')
    return [
      {
        inputs: ['score', 'v'],
        output: 'attn',
        kind: 'matmul',
        text: 'Keyの7位置を通じてVを集める。出力に残るのはQuery位置と渡す情報の成分。',
      },
    ];
  if (step === 'transpose')
    return [
      {
        inputs: ['k'],
        output: 'k',
        kind: 'transpose',
        text: 'Key位置と成分の軸を交換する。値を作り直したり、RoPEのようにベクトルを回転したりする処理ではない。',
      },
    ];
  return [];
}

export function shapeGuide(step: string): string {
  return (
    (
      {
        text: '同じ文章から出発する。形の表示でも、TokenとIDの対応を引き継ぐ。',
        tokenize: '同じ文字列に境界が入り、7つのTokenへ分かれる。',
        ids: 'Tokenを語彙表の整数IDへ対応させる。IDは1024成分のベクトルとは別。',
        embedding: '7つのIDから、それぞれ1024成分のEmbeddingを取り出す。各Tokenが行になる。',
        norm: '各Tokenの成分方向をRMSNormで正規化する。7位置と1024成分のshapeは変わらない。',
        heads:
          'Qは16 Heads、K/Vは8 Headsに分け、1 Headは128成分。表示はQ Head 0と対応するKV Head 0。Q/KのみHead内で正規化する。',
        rope: '同じ位置のQとKへ位置に応じた回転を適用する。128成分という幅は変えず、Vには適用しない。',
        mask: '未来のKey位置を参照対象から外す。7×7の軸はそのまま。最後のQueryは7位置すべてを参照できる。',
        softmax:
          '各Queryの行ごとにKeyへのスコアを参照割合へ変える。7×7は同じ形でも、数値の意味が変わる。',
        concat: '16 Headそれぞれの128成分を、Tokenごとに連結する。16×128=2048。位置は7のまま。',
        'post-norm':
          'H₁をResidual ②用に保存し、成分方向をRMSNormで整える。7×1024という形は保持する。',
        silu: 'Gateの各成分へSiLUを適用する。値を変換するが、7×3072という形は変えない。',
        layers: '完成した層の出力を次の層へ渡す。残り27層でも形は7×1024のまま、内部表現が変わる。',
        final: '最終RMSNormで各位置の1024成分を整える。位置数と成分数は変えない。',
        sampling:
          '7×151936の末尾1行を取り出し、151936候補から次のIDを選ぶ。表示は構造の説明で、実モデルの予測結果ではない。',
        append:
          '選んだIDを保持していた7個のID列へ追加する。特徴の連結ではなく、Token位置が7から8へ増える。',
        cache:
          '各層の8 KV Headsそれぞれに過去7位置を保持し、新しい1位置のK/Vだけを追加する。次のQueryは1位置、参照するK/Vは8位置。',
        decode: '生成したID列をTokenizerで文字列へ戻す。ここに示す生成IDと文章は説明例。',
      } as Record<string, string>
    )[step] ?? ''
  );
}

export function shapeEquations(sample: JourneySample) {
  const factor = (id: string) => {
    const s = shapeSpec(sample.step.id, id)!;
    return `<munder><mi mathvariant="normal">${s.name.split(' · ')[0]}</mi><mrow><mo>[</mo><mn>${s.rows}</mn><mo>×</mo><mn>${s.cols}</mn><mo>]</mo></mrow></munder>`;
  };
  return shapeOperations(sample.step.id)
    .filter((op) => op.kind !== 'transpose')
    .map((op) => ({
      ...op,
      math:
        (sample.step.id === 'scores' ? '<mfrac><mrow>' : '') +
        factor(op.inputs[0]) +
        `<mo>${op.kind === 'add' ? '+' : op.kind === 'product' ? '⊙' : '×'}</mo>` +
        factor(op.inputs[1]) +
        (sample.step.id === 'scores' ? '</mrow><msqrt><mn>128</mn></msqrt></mfrac>' : '') +
        `<mo>=</mo>` +
        factor(op.output),
      contracted: op.kind === 'matmul' ? shapeSpec(sample.step.id, op.inputs[0])!.cols : null,
    }));
}

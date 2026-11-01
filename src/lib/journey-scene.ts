import { journeyAt, journeySteps } from '../data/journey';
import { actorId, binaryActors } from './journey-actors';
import * as m from './journey-model';
import {
  clamp,
  ease,
  movementProgress,
  stageMovement,
  stageCalculation,
  layerPosition,
  LAYERS_START,
  LAYERS_END,
} from './journey-timing';
export interface Entity {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  data: (number | string)[][];
  label: string;
  opacity: number;
  tone: string;
  plain?: boolean;
  transpose?: boolean;
  emphasis?: number;
  font?: number;
}
export interface Frame {
  entities: Record<string, Entity>;
  height: number;
  caption: string;
}
const clone = (f: Frame): Frame => ({
  entities: Object.fromEntries(Object.entries(f.entities).map(([k, v]) => [k, { ...v }])),
  height: f.height,
  caption: f.caption,
});
const textWidths = m.tokenPieces.map((piece) => Array.from(piece).length * 30);
const textStart = (1000 - textWidths.reduce((a, b) => a + b, 0)) / 2;
const tokenWidths = [150, 62, 110, 88, 62, 62, 110];
const tokenStart = (1000 - tokenWidths.reduce((a, b) => a + b, 0) - 6 * 20) / 2;
const initial: Frame = {
  entities: Object.fromEntries(
    m.tokenPieces.map((piece, i) => [
      `token-${i}`,
      {
        id: `token-${i}`,
        x: textStart + textWidths.slice(0, i).reduce((a, b) => a + b, 0),
        y: 200,
        w: textWidths[i],
        h: 52,
        data: [[piece]],
        label: '',
        tone: 'input',
        opacity: 1,
        plain: true,
        font: 30,
      },
    ]),
  ),
  height: 570,
  caption: '同じ文字に境界を入れ、Tokenとして切り分けます。',
};

function put(
  f: Frame,
  id: string,
  data: Entity['data'],
  x: number,
  y: number,
  label: string,
  tone = 'input',
  w = 42,
  h = 30,
  plain = false,
) {
  f.entities[id] = { id, x, y, w, h, data, label, tone, opacity: 1, plain };
}
function change(f: Frame, id: string, props: Partial<Entity>) {
  f.entities[id] = { ...f.entities[id], ...props };
}
function hide(f: Frame, ...ids: string[]) {
  ids.forEach((id) => {
    if (f.entities[id]) change(f, id, { opacity: 0 });
  });
}
function visibleOnly(f: Frame, ids: string[]) {
  Object.values(f.entities).forEach((e) => (e.opacity = ids.includes(e.id) ? 1 : 0));
}
function weight(f: Frame, data: m.Matrix, label: string, y = 200) {
  put(f, 'weight', data, 660, y, label, 'weight', 44, 36);
}
const frames: Frame[] = [];
let f = clone(initial);
for (const s of journeySteps) {
  f = clone(f);
  f.caption =
    s.group === 'input'
      ? 'TokenとID・Embeddingの先頭3成分は、固定モデルの観察例。'
      : '前の結果を使う説明用モデル：7位置・幅3 ／ MLP幅6 ／ Q 2 Heads・KV 1 Head。';
  switch (s.id) {
    case 'text':
      break;
    case 'tokenize':
      m.tokenPieces.forEach((_, i) =>
        change(f, `token-${i}`, {
          x: tokenStart + tokenWidths.slice(0, i).reduce((a, b) => a + b, 0) + i * 20,
          y: 220,
          w: tokenWidths[i],
          h: 48,
          plain: false,
          font: 26,
        }),
      );
      f.caption = '同じ文字に境界が入り、間隔が開いて7つのTokenになる。文字自体は入れ替えません。';
      break;
    case 'ids':
      m.tokenIds.forEach((id, i) =>
        put(
          f,
          `id-${i}`,
          [[id]],
          f.entities[`token-${i}`].x + (tokenWidths[i] - 90) / 2,
          286,
          '',
          'id',
          90,
          34,
          true,
        ),
      );
      break;
    case 'embedding':
      m.tokenPieces.forEach((_, i) => {
        change(f, `token-${i}`, { x: 245, y: 115 + i * 30, w: 140, h: 32, font: 18 });
        change(f, `id-${i}`, { x: 382, y: 115 + i * 30, w: 94, h: 32 });
      });
      put(f, 'hidden', m.embedding, 500, 115, 'H₀ · Embedding', 'output', 62, 30);
      f.caption = 'IDとEmbeddingの3成分は固定モデルの観察値。ここから同じ7行を使います。';
      break;
    case 'norm':
      visibleOnly(f, ['hidden']);
      put(f, 'skip', m.embedding, 40, 200, 'H₀ · Residual ①用', 'saved', 26, 20);
      change(f, 'hidden', { data: m.firstLayer.x, x: 407, label: 'X · RMSNorm後', tone: 'input' });
      f.caption =
        '以降は、この3成分を全幅とする説明用モデル。実モデルの1024成分の計算とは区別します。';
      break;
    case 'qkv':
      f.height = 1180;
      change(f, 'hidden', { x: 210, y: 500, w: 44, h: 28, label: 'X · 正規化した入力' });
      change(f, 'skip', { x: 40, y: 200 });
      put(f, 'q', m.firstLayer.q, 600, 180, 'Q · 探す条件', 'q', 44, 28);
      put(f, 'k', m.firstLayer.k, 600, 500, 'K · 照合する特徴', 'k', 44, 28);
      put(f, 'v', m.firstLayer.v, 600, 820, 'V · 渡す情報', 'output', 44, 28);
      ['q', 'k', 'v'].forEach((id, i) =>
        put(
          f,
          `weight-${id}`,
          [m.firstLayer.wq, m.firstLayer.wk, m.firstLayer.wv][i],
          420,
          230 + i * 320,
          `W${id}ᵀ`,
          'weight',
          40,
          32,
        ),
      );
      change(f, 'weight-q', { x: 390, w: 30 });
      f.caption = 'Q・K・Vは同じ入力から別の重みで作る。保存した入力は迂回したまま残る。';
      break;
    case 'heads':
      f.height = 900;
      hide(f, 'hidden', 'weight', 'weight-q', 'weight-k', 'weight-v');
      put(f, 'q-head-1', m.firstLayer.qHeads[1], 40, 720, 'Q Head 1 · 分割時の値', 'q', 26, 18);
      change(f, 'q', { x: 430, data: m.firstLayer.qn, label: 'Q Head 0 · Head内正規化後' });
      change(f, 'k', { x: 430, data: m.firstLayer.kn, label: '共有K Head 0 · Head内正規化後' });
      change(f, 'v', { x: 40, y: 500, w: 30, h: 20, label: 'V · 加重和まで待機' });
      f.caption =
        'Qの6成分を2 Headsへ分割。各Headは3成分。共有K/V Head 0を使い、Q/KをHead内で正規化する。';
      break;
    case 'rope':
      hide(f, 'q-head-1');
      change(f, 'q', { data: m.firstLayer.qr, label: 'Q′ · RoPE後' });
      change(f, 'k', { data: m.firstLayer.kr, label: 'K′ · RoPE後' });
      f.caption = '同じ位置のQ/Kを回す。小さな例は成分0・1を回転し、Vと成分2は保持。';
      break;
    case 'transpose':
      f.height = 760;
      change(f, 'q', { x: 220, y: 175, w: 40, h: 30 });
      change(f, 'k', { x: 400, y: 235, w: 32, h: 30, transpose: true, label: '(K′)ᵀ · 転置後' });
      change(f, 'v', { x: 40, y: 500, w: 30, h: 20, label: 'V · 加重和まで待機' });
      change(f, 'skip', { x: 40, y: 200, h: 18 });
      break;
    case 'scores':
      put(f, 'score', m.firstLayer.scores, 720, 175, 'S · Attention scores', 'output', 40, 30);
      f.caption = 'Qの1行とKᵀの1列を掛けて足す。位置間の7 × 7スコアができる。';
      break;
    case 'mask':
      hide(f, 'q', 'k');
      change(f, 'score', {
        x: 332,
        y: 150,
        w: 48,
        h: 36,
        data: m.firstLayer.masked,
        label: 'Sₘ · Mask適用後',
      });
      break;
    case 'softmax':
      change(f, 'score', {
        data: m.firstLayer.probabilities,
        label: 'P · 参照割合',
      });
      break;
    case 'weighted':
      change(f, 'score', { x: 220, y: 175, w: 32, h: 31 });
      change(f, 'skip', { x: 40, y: 200, h: 18 });
      change(f, 'v', { x: 495, y: 175, w: 44, h: 31, label: 'V · 渡す情報' });
      f.height = 920;
      put(
        f,
        'context-head-1',
        m.firstLayer.contextHeads[1],
        40,
        720,
        'C Head 1 · 別経路の結果',
        'output',
        26,
        18,
      );
      put(f, 'attn', m.firstLayer.context, 735, 175, 'C Head 0 · 集めた情報', 'output', 44, 31);
      break;
    case 'concat':
      hide(f, 'score', 'v');
      change(f, 'attn', {
        x: 300,
        y: 180,
        w: 44,
        h: 31,
        data: m.firstLayer.joined,
        label: 'C · 全Head連結後',
      });
      change(f, 'context-head-1', { x: 432, y: 180, w: 44, h: 31, label: 'Head 1の結果' });
      f.caption =
        '同じToken位置のHead 0・1の3成分を横に連結する。Tokenは7行のまま、各行が6成分になる。';
      break;
    case 'o-proj':
      hide(f, 'context-head-1');
      put(
        f,
        'operand-o-proj',
        m.firstLayer.joined,
        210,
        160,
        'C · 全Head連結した入力',
        'input',
        32,
        32,
      );
      change(f, 'attn', {
        x: 760,
        y: 160,
        w: 44,
        h: 32,
        label: 'A · 出力',
        data: m.firstLayer.attention,
      });
      weight(f, m.firstLayer.wo, 'Woᵀ', 224);
      change(f, 'weight', { x: 490, y: 176, w: 38, h: 32 });
      f.caption = '左のCは入力として保持。Cの行と重みの列から、右にAttention出力Aを作る。';
      break;
    case 'residual-attn':
      f.height = 570;
      hide(f, 'weight', 'operand-o-proj');
      change(f, 'skip', { x: 250, y: 140, w: 38, h: 27, label: 'H₀ · 保存した入力' });
      change(f, 'attn', {
        x: 430,
        y: 160,
        data: m.firstLayer.h1,
        label: 'H₁ · Residual ①の結果',
        tone: 'output',
      });
      hide(f, 'skip');
      f.caption =
        '入力H₀とAの同じ位置・成分を足し、別の結果H₁を作る。右の同じ場所でAからH₁へ表示を切り替える（入力の上書きではない）。';
      break;
    case 'post-norm':
      put(f, 'skip2', m.firstLayer.h1, 40, 200, 'H₁ · Residual ②用', 'saved', 26, 20);
      change(f, 'attn', { x: 430, y: 160, data: m.firstLayer.post, label: 'Xₘ · MLPへの入力' });
      break;
    case 'gate':
      f.height = 1320;
      change(f, 'attn', { x: 210, y: 500, w: 42, h: 30 });
      put(f, 'weight-gate', m.firstLayer.wg, 400, 243, 'Wgateᵀ', 'weight', 30, 28);
      put(f, 'weight-up', m.firstLayer.wu, 400, 823, 'Wupᵀ', 'weight', 30, 28);
      put(f, 'gate', m.firstLayer.gate, 650, 180, 'G · Gate射影', 'q', 40, 30);
      put(f, 'up', m.firstLayer.up, 650, 760, 'U · Up射影', 'k', 40, 30);
      change(f, 'skip2', { x: 40, y: 200, h: 18 });
      break;
    case 'silu':
      f.height = 800;
      hide(f, 'attn', 'weight-gate', 'weight-up');
      change(f, 'up', { x: 40, y: 500, w: 18, h: 16, label: 'U · 要素積まで待機' });
      change(f, 'gate', { x: 370, y: 240, data: m.firstLayer.activated, label: 'Gₐ · SiLU後' });
      break;
    case 'multiply':
      f.height = 760;
      change(f, 'up', { x: 690, y: 180, w: 40, h: 30, label: 'U · 今回の入力' });
      change(f, 'skip2', { x: 40, y: 200 });
      change(f, 'gate', { y: 180, data: m.firstLayer.mixed, label: 'M · 要素積の結果' });
      hide(f, 'up');
      f.caption =
        '入力GₐとUの対応する成分を掛け、別の結果Mを作る。見比べやすいよう、左の同じ場所でGₐからMへ表示を切り替える（入力の上書きではない）。';
      break;
    case 'down':
      put(f, 'operand-down', m.firstLayer.mixed, 220, 180, 'M · 今回の入力', 'input', 40, 30);
      change(f, 'gate', {
        data: m.firstLayer.down,
        x: 800,
        y: 180,
        w: 44,
        h: 30,
        label: 'D · 出力',
      });
      weight(f, m.firstLayer.wd, 'Wdownᵀ', 195);
      change(f, 'weight', { x: 540, w: 36, h: 30 });
      f.caption = '左のMは幅6の入力。重みの列と掛けて足し、右に幅3のMLP出力Dを作る。';
      break;
    case 'residual-mlp':
      f.height = 570;
      hide(f, 'weight', 'operand-down');
      change(f, 'skip2', { x: 245, y: 140, w: 38, h: 27 });
      change(f, 'gate', { x: 430, y: 160, data: m.firstLayer.output, label: 'H₂ · Layer 0の出力' });
      hide(f, 'skip2');
      f.caption =
        '入力H₁とDの同じ位置・成分を足し、別の結果H₂を作る。右の同じ場所でDからH₂へ表示を切り替える（入力の上書きではない）。H₂がLayer 0の出力になる。';
      break;
    case 'layers':
      change(f, 'gate', { data: m.layerStates[28], label: 'H⁽²⁸⁾ · Layer 27の出力' });
      f.caption =
        '直前のH₂を、層の出力H⁽¹⁾として引き継ぐ。残り27層も、同じ値を入力にして計算する。';
      break;
    case 'final':
      change(f, 'gate', { data: m.finalHidden, label: 'Hfinal · 最終正規化後' });
      break;
    case 'logits':
      put(f, 'operand-logits', m.finalHidden, 240, 180, 'Hfinal · 今回の入力', 'input', 44, 32);
      change(f, 'gate', {
        x: 760,
        y: 180,
        w: 44,
        h: 32,
        data: m.logits,
        label: 'Z · 出力Logits',
        tone: 'output',
      });
      weight(f, m.lmWeight, 'WLMᵀ', 244);
      change(f, 'weight', { x: 510, w: 44, h: 32 });
      f.caption = '最終hidden stateは左に保持。LM headの重みで、右に候補ごとのLogitsを作る。';
      break;
    case 'sampling':
      hide(f, 'weight', 'operand-logits');
      change(f, 'gate', { x: 430, y: 145, label: 'Z · Logits' });
      put(f, 'prob', [m.nextProbabilities], 360, 445, 'p · 次Tokenの確率', 'output', 92, 40);
      put(
        f,
        'chosen',
        [[m.candidates[m.chosen].id]],
        700,
        445,
        `next_id ·「${m.candidates[m.chosen].text}」`,
        'id',
        110,
        40,
        false,
      );
      f.caption =
        '①末尾のLogitsを取り出す → ②Softmaxで確率へ → ③最大スコアの候補のIDを選ぶ（Greedy）。';
      break;
    case 'append':
      visibleOnly(f, ['chosen', ...m.tokenIds.map((_, i) => `id-${i}`)]);
      m.tokenIds.forEach((_, i) =>
        change(f, `id-${i}`, { x: 70 + i * 105, y: 280, w: 94, h: 38, plain: false }),
      );
      change(f, 'chosen', {
        x: 805,
        y: 280,
        w: 94,
        h: 38,
        label: 'next_id · 追加したID',
        plain: false,
      });
      f.caption = '保持していた7個のIDはそのまま。選んだ1個を末尾へ加え、7個から8個の列にする。';
      break;
    case 'cache':
      f.height = 860;
      m.tokenIds.forEach((_, i) => change(f, `id-${i}`, { y: 190, w: 90, h: 30 }));
      change(f, 'chosen', { y: 190 });
      change(f, 'k', {
        opacity: 1,
        transpose: false,
        x: 220,
        y: 290,
        w: 38,
        h: 23,
        label: 'Layer 0 · 保持していたK',
      });
      change(f, 'v', {
        opacity: 1,
        x: 490,
        y: 290,
        w: 38,
        h: 23,
        label: 'Layer 0 · V · 渡す情報',
      });
      put(f, 'cache-new-k', [['新', '新', '新']], 220, 451, '', 'weight', 38, 23);
      put(f, 'cache-new-v', [['新', '新', '新']], 490, 451, '', 'output', 38, 23);
      [1, 27].forEach((layer, r) =>
        ['K', 'V'].forEach((name, k) => {
          put(
            f,
            `cache-${layer}-${name}`,
            [[0, 1, 2, 3, 4, 5, 6, '新']],
            190,
            550 + r * 140 + k * 60,
            `Layer ${layer} · ${r === 1 ? '… ' : ''}${name}`,
            name === 'K' ? 'weight' : 'output',
            66,
            33,
          );
        }),
      );
      f.caption =
        '次のForwardで新しい位置を追加する構造図。「新」の数値は省略。過去のK/Vは保持する。';
      break;
    case 'decode':
      f.height = 570;
      Object.keys(f.entities)
        .filter((id) => id.startsWith('cache-'))
        .forEach((id) => change(f, id, { opacity: 0 }));
      hide(f, 'k', 'v');
      put(
        f,
        'result',
        [[m.generated.pieces.join('')]],
        130,
        250,
        'text · 生成した文章',
        'output',
        740,
        50,
        true,
      );
      break;
  }
  frames.push(f);
}
// The original input keeps its identity. A new output starts empty; no input clone is drawn.
frames.forEach((frame, index) => {
  const step = journeySteps[index].id,
    entities = frame.entities;
  const attn = entities.attn,
    gate = entities.gate;
  if (actorId(step, 'attn') !== 'attn' && attn) {
    entities['attention-state'] = { ...attn, id: 'attention-state' };
    const input = entities['operand-o-proj'];
    if (input) entities.attn = { ...input, id: 'attn' };
    delete entities['operand-o-proj'];
  }
  if (index >= journeySteps.findIndex((s) => s.id === 'down') && gate) {
    entities['mlp-state'] = { ...gate, id: 'mlp-state' };
    const input = entities['operand-down'];
    if (input) entities.gate = { ...input, id: 'gate' };
    delete entities['operand-down'];
  }
  if (actorId(step, 'gate') === 'logits-state' && gate) {
    entities['logits-state'] = { ...gate, id: 'logits-state' };
    const input = entities['operand-logits'];
    if (input) entities['mlp-state'] = { ...input, id: 'mlp-state' };
    delete entities['operand-logits'];
  }
});
// Keep each binary input intact; its newly born result becomes the next stage's input.
for (const [stage, source, result] of [
  ['residual-attn', 'attention-state', 'residual-attn-state'],
  ['multiply', 'gate', 'mixed-state'],
  ['residual-mlp', 'mlp-state', 'layer-state'],
] as const) {
  const first = journeySteps.findIndex((s) => s.id === stage);
  const original = frames[first - 1].entities[source];
  for (let i = first; i < frames.length; i++) {
    const frame = frames[i],
      current = frame.entities[source];
    if (current) frame.entities[result] = { ...current, id: result };
    frame.entities[source] = { ...original, id: source, opacity: i === first ? 1 : 0 };
  }
  const frame = frames[first],
    ids = binaryActors(stage)!;
  const wide = stage === 'multiply';
  Object.assign(frame.entities[ids.input], {
    x: wide ? 185 : 445,
    y: 180,
    w: wide ? 32 : 38,
    h: 30,
  });
  Object.assign(frame.entities[ids.second], {
    x: wide ? 440 : 210,
    y: 180,
    w: wide ? 32 : 38,
    h: 30,
    opacity: 1,
    tone: 'input',
  });
  Object.assign(frame.entities[ids.output], {
    x: 745,
    y: 180,
    w: wide ? 32 : 38,
    h: 30,
    tone: 'output',
  });
  frame.height = 800;
  frame.caption =
    stage === 'multiply'
      ? '入力GₐとUはそのまま残し、対応する成分を掛けて右に新しい結果Mを作る。できたMを次のdown_projへ渡す。'
      : stage === 'residual-attn'
        ? '入力H₀とAはそのまま残し、対応する成分を足して右に新しい結果H₁を作る。できたH₁を次の処理へ渡す。'
        : '入力H₁とDはそのまま残し、対応する成分を足して右に新しい結果H₂を作る。H₂がLayer 0の出力となり、次の層へ進む。';
}
export const journeyFrames = frames;
export function sampleJourney(time: number) {
  const at = journeyAt(time),
    step = journeySteps[at.index];
  const before = at.index ? frames[at.index - 1] : initial,
    after = frames[at.index];
  const p = stageMovement(step.id, at.progress);
  let target = after;
  let layer = 0;
  if (step.id === 'layers') {
    const position = layerPosition(at.progress);
    layer = at.progress <= LAYERS_START ? 0 : Math.min(27, Math.floor(position) + 1);
    target = clone(after);
    const id = actorId(step.id, 'gate');
    target.entities[id] = {
      ...after.entities[id],
      data: m.layerStates[layer + 1],
      label: `H⁽${layer + 1}⁾ · Layer ${layer}の出力`,
    };
  }
  const entities = Object.values(target.entities).map((end) => {
    let start = before.entities[end.id] ?? { ...end, opacity: 0 };
    if (step.id === 'heads' && end.id === 'q-head-1') {
      const source = before.entities.q;
      const right = ease(at.progress / 0.15),
        down = ease((at.progress - 0.15) / 0.22),
        left = ease((at.progress - 0.37) / 0.23);
      start = {
        ...source,
        id: end.id,
        x: source.x + source.w * 3,
        data: m.firstLayer.qHeads[1],
        label: '',
        opacity: 1,
      };
      return {
        ...end,
        start,
        end,
        blend: p,
        opacity: 1,
        x: start.x + (800 - start.x) * right + (end.x - 800) * left,
        y: start.y + (end.y - start.y) * down,
        w: start.w + (end.w - start.w) * p,
        h: start.h + (end.h - start.h) * p,
      };
    }
    if (step.id === 'concat' && end.id === 'attn') {
      const move = ease(at.progress / 0.35);
      return {
        ...end,
        start,
        end,
        blend: move,
        opacity: 1,
        x: start.x + (end.x - start.x) * move,
        y: start.y + (end.y - start.y) * move,
        w: start.w + (end.w - start.w) * move,
        h: start.h + (end.h - start.h) * move,
      };
    }
    if (step.id === 'concat' && end.id === 'context-head-1') {
      const across = ease(at.progress / 0.35),
        rise = ease((at.progress - 0.35) / 0.25);
      return {
        ...end,
        start,
        end,
        blend: p,
        opacity: 1,
        x: start.x + (end.x - start.x) * across,
        y: start.y + (end.y - start.y) * rise,
        w: start.w + (end.w - start.w) * p,
        h: start.h + (end.h - start.h) * p,
      };
    }
    if (step.id === 'layers' && end.id === actorId(step.id, 'gate') && layer > 0)
      start = { ...start, data: m.layerStates[layer] };
    if (step.id === 'tokenize' && end.id.startsWith('token-')) {
      const split = ease((at.progress - 0.24) / 0.48);
      return {
        ...end,
        start,
        end,
        blend: split,
        x: start.x + (end.x - start.x) * split,
        y: start.y + (end.y - start.y) * split,
        w: start.w + (end.w - start.w) * split,
        h: start.h + (end.h - start.h) * split,
        font: (start.font ?? 30) + ((end.font ?? 26) - (start.font ?? 30)) * split,
      };
    }
    if (step.id === 'sampling' && end.id === 'prob') {
      const source = before.entities[actorId(step.id, 'gate')],
        destination = target.entities[actorId(step.id, 'gate')];
      const branch = ease((at.progress - 0.43) / 0.15),
        move = movementProgress(at.progress);
      const sx = source.x + (destination.x - source.x) * move,
        sy =
          source.y +
          (destination.y - source.y) * move +
          6 * (source.h + (destination.h - source.h) * move);
      start = {
        ...end,
        x: sx,
        y: sy,
        w: 44,
        h: 32,
        data: [m.logits.at(-1)!],
        opacity: 0,
        label: '末尾のLogits',
      };
      return {
        ...end,
        start,
        end,
        blend: branch,
        x: sx + (end.x - sx) * branch,
        y: sy + (end.y - sy) * branch,
        w: 44 + (end.w - 44) * branch,
        h: 32 + (end.h - 32) * branch,
        opacity: ease((at.progress - 0.43) / 0.1),
      };
    }
    if (step.id === 'sampling' && end.id === 'chosen')
      return { ...end, start, end, blend: p, opacity: ease((at.progress - 0.82) / 0.12) };
    if (step.id === 'append' && end.id.startsWith('id-'))
      return {
        ...end,
        start: { ...end, opacity: 0 },
        end,
        blend: p,
        opacity: ease(at.progress / 0.25),
      };
    if (step.id === 'cache' && end.id.startsWith('cache-new-'))
      return { ...end, start, end, blend: p, opacity: ease((at.progress - 0.65) / 0.25) };
    if (
      (step.id === 'heads' && end.id === 'v') ||
      (step.id === 'silu' && end.id === 'up') ||
      (step.id === 'weighted' && end.id === 'v')
    ) {
      const parking = step.id !== 'weighted';
      return {
        ...end,
        start,
        end,
        blend: p,
        x: start.x + (end.x - start.x) * ease(at.progress / (parking ? 0.3 : 0.35)),
        y:
          start.y +
          (end.y - start.y) * ease((at.progress - (parking ? 0.3 : 0.35)) / (parking ? 0.3 : 0.25)),
        w: start.w + (end.w - start.w) * p,
        h: start.h + (end.h - start.h) * p,
      };
    }
    if (step.id === 'transpose' && (end.id === 'q' || end.id === 'k')) {
      const move = end.id === 'q' ? ease(at.progress / 0.22) : ease((at.progress - 0.22) / 0.33);
      return {
        ...end,
        start,
        end,
        blend: move,
        x: start.x + (end.x - start.x) * move,
        y: start.y + (end.y - start.y) * move,
        w: start.w + (end.w - start.w) * move,
        h: start.h + (end.h - start.h) * move,
      };
    }
    if (step.id === 'gate' && end.id === actorId(step.id, 'attn'))
      return {
        ...end,
        start,
        end,
        blend: p,
        x: start.x + (end.x - start.x) * ease(at.progress / 0.25),
        y: start.y + (end.y - start.y) * ease((at.progress - 0.25) / 0.35),
        w: start.w + (end.w - start.w) * p,
        h: start.h + (end.h - start.h) * p,
      };
    if (step.id === 'embedding' && /^(token|id)-\d+$/.test(end.id)) {
      const i = Number(end.id.split('-')[1]),
        isId = end.id.startsWith('id-');
      const spread = ease(Math.min(1, at.progress / 0.3));
      const align = ease(Math.max(0, Math.min(1, (at.progress - 0.3) / 0.22)));
      const settle = ease(Math.max(0, Math.min(1, (at.progress - 0.52) / 0.16)));
      const temporaryY = start.y + (55 + i * 70 + (isId ? 40 : 0) - start.y) * spread;
      return {
        ...end,
        start,
        end,
        blend: p,
        x: start.x + (end.x - start.x) * align,
        y: temporaryY + (end.y - temporaryY) * settle,
        font:
          start.font === undefined && end.font === undefined
            ? undefined
            : (start.font ?? 26) + ((end.font ?? 26) - (start.font ?? 26)) * p,
        w: start.w + (end.w - start.w) * p,
        h: start.h + (end.h - start.h) * p,
      };
    }
    if (
      (end.id === 'weight' || end.id.startsWith('weight-')) &&
      start.opacity === 0 &&
      end.opacity > 0
    )
      start = { ...end, opacity: 0 };
    // Saved branches originate from the actual input, rather than appearing elsewhere.
    if (!before.entities[end.id] && (end.id === 'skip' || end.id === 'skip2'))
      start = {
        ...before.entities[end.id === 'skip' ? 'hidden' : actorId(step.id, 'attn')],
        id: end.id,
      };
    const blend =
      step.id === 'append'
        ? ease(Math.min(1, at.progress / 0.35))
        : step.id === 'embedding'
          ? ease(Math.max(0, Math.min(1, (at.progress - 0.48) / 0.34)))
          : p;
    // Separate rows first, then align columns. This keeps tokens from colliding.
    const yp =
      step.id === 'append'
        ? ease(Math.max(0, Math.min(1, (at.progress - 0.45) / 0.37)))
        : step.id === 'embedding'
          ? ease(Math.min(1, at.progress / 0.38))
          : p;
    return {
      ...end,
      x: start.x + (end.x - start.x) * blend,
      y: start.y + (end.y - start.y) * yp,
      font:
        start.font === undefined && end.font === undefined
          ? undefined
          : (start.font ?? 26) + ((end.font ?? 26) - (start.font ?? 26)) * p,
      w: start.w + (end.w - start.w) * p,
      h: start.h + (end.h - start.h) * p,
      opacity:
        start.opacity > 0 &&
        end.opacity === 0 &&
        (['attn', 'gate', 'mlp-state', 'attention-state'].includes(end.id) ||
          end.id.startsWith('weight') ||
          (step.id === 'heads' && end.id === 'hidden'))
          ? 1 - clamp(at.progress / 0.18)
          : step.id === 'norm' && /^(token|id)-/.test(end.id)
            ? 1 - clamp(at.progress / 0.14)
            : (step.id === 'norm' || step.id === 'post-norm') &&
                end.id.startsWith('skip') &&
                !before.entities[end.id]
              ? 0.2 * p + 0.8 * ease((at.progress - 0.46) / 0.14)
              : step.id === 'embedding' && end.id === 'hidden'
                ? clamp((at.progress - 0.64) / 0.1)
                : start.opacity + (end.opacity - start.opacity) * p,
      start,
      end,
      blend: p,
    };
  });
  return {
    ...at,
    step,
    entities,
    height:
      before.height +
      (after.height - before.height) *
        (step.id === 'multiply'
          ? ease((at.progress - 0.5) / 0.32)
          : step.id === 'decode'
            ? ease((at.progress - 0.7) / 0.3)
            : p),
    caption: target.caption,
    layer,
    calculation:
      step.id === 'layers'
        ? at.progress >= LAYERS_END
          ? 1
          : clamp((layerPosition(at.progress) % 1) / 0.8)
        : step.id === 'embedding'
          ? clamp((at.progress - 0.8) / 0.13)
          : stageCalculation(step.id, at.progress),
  };
}
export type JourneySample = ReturnType<typeof sampleJourney>;

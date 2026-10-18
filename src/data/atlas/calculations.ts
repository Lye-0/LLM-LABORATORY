import { m, at, eq, call, tuple, vector } from './calculation-math';

export interface CalculationFormula {
  label: string;
  math: string;
  reading: string;
}
export interface CalculationTable {
  caption: string;
  columns: string[];
  rows: string[][];
}
export interface AtlasCalculation {
  kind: string;
  meaning: string;
  formulas: CalculationFormula[];
  symbols: { name: string; meaning: string; shape?: string }[];
  scope?: string;
  note?: string;
  example?: {
    intro: string;
    formulas?: CalculationFormula[];
    table?: CalculationTable;
    note?: string;
  };
}
const formula = (label: string, math: string, reading: string): CalculationFormula => ({
  label,
  math,
  reading,
});
const equals = m.o('='),
  plus = m.o('+'),
  times = m.o('×');
const transpose = (s: string) => m.sup(m.i(s), m.t('T'));
const sum = (index: string, size: string | number) =>
  m.sum(
    eq(m.i(index), equals, m.n(0)),
    eq(typeof size === 'number' ? m.n(size) : m.i(size), m.o('−'), m.n(1)),
  );
const smallLinear: AtlasCalculation['example'] = {
  intro: '入力2成分・出力2成分に縮めた、1つの位置の例です。各重みの行と入力の内積を取ります。',
  formulas: [
    formula(
      '入力と重み',
      eq(
        m.i('x'),
        equals,
        tuple(2, -1),
        m.o(','),
        m.i('W'),
        equals,
        m.matrix([
          [m.n(1), m.n(3)],
          [m.n(4), m.n(-2)],
        ]),
      ),
      'xは2とマイナス1、Wの行は1と3、4とマイナス2。',
    ),
    formula(
      '出力の0番目の成分',
      eq(
        at('y', '0'),
        equals,
        m.n(2),
        times,
        m.n(1),
        plus,
        m.o('('),
        m.n(-1),
        m.o(')'),
        times,
        m.n(3),
        equals,
        m.n(-1),
      ),
      '出力の0番目は2かける1引く3でマイナス1。',
    ),
    formula(
      '出力の1番目の成分',
      eq(
        at('y', '1'),
        equals,
        m.n(2),
        times,
        m.n(4),
        plus,
        m.o('('),
        m.n(-1),
        m.o(')'),
        times,
        m.o('('),
        m.n(-2),
        m.o(')'),
        equals,
        m.n(10),
      ),
      '出力の1番目は2かける4足す2で10。',
    ),
  ],
};
function linear(
  name: string,
  input: number,
  output: number,
  meaning: string,
  lm = false,
): AtlasCalculation {
  const x = lm ? 'H' : 'X',
    y = lm ? 'Z' : name;
  return {
    kind: '行列積 · Linear',
    meaning,
    formulas: [
      formula(
        '全体の計算',
        eq(m.i(y), equals, m.i(x), transpose('W')),
        `${y}は${x}と重みWの転置の行列積。`,
      ),
      formula(
        '出力の1成分',
        eq(at(y, 'b,t,j'), equals, sum('d', input), at(x, 'b,t,d'), at('W', 'j,d')),
        `${y}のb,t,j成分は、dが0から${input - 1}まで、${x}のb,t,d成分とWのj,d成分の積を足した値。`,
      ),
    ],
    symbols: [
      { name: x, meaning: '入力。各位置の特徴ベクトル', shape: `[B,Tq,${input}]` },
      {
        name: 'W',
        meaning: `${lm ? 'lm_head' : name.toLowerCase() + '_proj'}.weight（学習済み）。行が出力、列が入力`,
        shape: `[${output},${input}]`,
      },
      {
        name: y,
        meaning: lm ? '各候補のlogits。確率にする前のスコア' : '変換後の特徴',
        shape: `[B,Tq,${output}]`,
      },
      {
        name: 'b / t / d / j',
        meaning: '入力番号 / Token位置 / 入力成分 / 出力成分。Tは転置の記号',
      },
    ],
    scope: 'Qwen3-0.6B · 固定revisionの寸法',
    note: `各Token位置に同じWを使います。${lm ? 'Embeddingの重みと共有しますが、行を引くlookupとは異なる計算です。' : 'この行列積では、別のToken位置の値は混ぜません。'}参照モデルのこのLinearにはbiasはありません。`,
    example: smallLinear,
  };
}
function norm(width: number, shape: string): AtlasCalculation {
  return {
    kind: '正規化 · RMSNorm',
    meaning: `各Token${width === 128 ? '・各Head' : ''}の${width}成分から共通の大きさを求め、各成分を割ってから学習済みの係数を掛けます。`,
    formulas: [
      formula(
        '大きさを求める',
        eq(
          m.i('r'),
          equals,
          m.sqrt(
            eq(
              m.frac(m.n(1), m.i('D')),
              sum('i', 'D'),
              m.sup(at('x', 'i'), m.n(2)),
              plus,
              m.i('ε'),
            ),
          ),
        ),
        'rは、D成分の二乗の平均にイプシロンを足した値の平方根。',
      ),
      formula(
        '各成分を整える',
        eq(at('y', 'i'), equals, m.frac(at('x', 'i'), m.i('r')), at('w', 'i')),
        'yのi成分は、xのi成分をrで割り、学習済み係数wのi成分を掛けた値。',
      ),
    ],
    symbols: [
      { name: 'x → y', meaning: '正規化の前 → 後。同じshape', shape },
      { name: 'D', meaning: `正規化する最後の軸の幅：${width}` },
      {
        name: 'w',
        meaning: `学習済みの係数。各位置${width === 128 ? '・各Head' : ''}に共通`,
        shape: `[${width}]`,
      },
      { name: 'ε', meaning: 'ゼロ除算を防ぐ小さな値：0.000001' },
    ],
    scope: 'Qwen3-0.6B · 固定revisionの寸法',
    note: '平均値を引く処理や、0〜1の確率にする処理ではありません。計算する部品ごとに別のwを持ちます。',
    example: {
      intro: '2成分に縮め、ε=0、w=(1,1)として大きさだけを見ます。',
      formulas: [
        formula(
          'RMSで割る',
          eq(
            m.i('x'),
            equals,
            tuple(3, 4),
            m.o('⇒'),
            m.i('r'),
            equals,
            m.sqrt(m.frac(m.n(25), m.n(2))),
            m.o('⇒'),
            m.i('y'),
            m.o('≈'),
            tuple('0.8485', '1.1314'),
          ),
          'xが3と4のとき、rは12.5の平方根、yは約0.8485と1.1314。',
        ),
      ],
    },
  };
}
function residual(second: boolean): AtlasCalculation {
  return {
    kind: '要素ごとの加算 · Residual addition',
    meaning: second
      ? '保持しておいたAttention後の値に、MLPの出力を同じ成分同士で足します。'
      : 'この層へ入ったhidden stateに、Self-Attentionの出力を同じ成分同士で足します。',
    formulas: [
      formula(
        '2つの入力から1つの出力へ',
        eq(m.i('Y'), equals, m.i('R'), plus, m.i('F')),
        'Yは、保持したRと処理結果Fの要素ごとの和。',
      ),
      formula(
        '出力の1成分',
        eq(at('Y', 'b,t,d'), equals, at('R', 'b,t,d'), plus, at('F', 'b,t,d')),
        '同じ入力番号・Token位置・特徴成分の値を足す。',
      ),
    ],
    symbols: [
      {
        name: 'R',
        meaning: second
          ? 'Residual ①の出力。post_attention_layernormより前で保持'
          : '層の入力。input_layernormより前で保持',
        shape: '[B,Tq,1024]',
      },
      {
        name: 'F',
        meaning: second ? 'MLPのdown_proj出力' : 'Self-Attentionのo_proj出力',
        shape: '[B,Tq,1024]',
      },
      {
        name: 'Y',
        meaning: second ? 'このDecoder Layerの出力' : 'Attentionの変化を加えたhidden state',
        shape: '[B,Tq,1024]',
      },
    ],
    scope: 'Qwen3-0.6B · 固定revisionの寸法',
    note: '行列積ではありません。足し合わせる両方の経路に、学習中は勾配が流れます。',
    example: {
      intro: '2成分の説明用ベクトルです。',
      formulas: [
        formula(
          '成分同士を足す',
          eq(tuple(2, -1), plus, tuple('0.5', 3), equals, tuple('2.5', 2)),
          '2とマイナス1に、0.5と3を足すと、2.5と2。',
        ),
      ],
    },
  };
}
function rearrange(
  meaning: string,
  before: string,
  after: string,
  math: string,
  reading: string,
): AtlasCalculation {
  return {
    kind: '形・軸の変更 · reshape / transpose',
    meaning,
    formulas: [formula('成分の対応', math, reading)],
    symbols: [
      { name: 'X', meaning: '変更前', shape: before },
      { name: 'Y', meaning: '変更後', shape: after },
      { name: 'b / t / h / d', meaning: '入力番号 / Token位置 / Head番号 / Head内の成分' },
    ],
    scope: 'Qwen3-0.6B · 固定revisionの寸法',
    note: '特徴の値を掛けたり足したりする計算ではありません。数値の対応を保ち、区切り方や軸順を変えます。',
  };
}
function rope(name: string, heads: number): AtlasCalculation {
  return {
    kind: '2成分ずつの回転 · RoPE',
    meaning: `${name}の同じToken・Head内で、前半と後半の成分を組にして位置pに応じて回転します。`,
    formulas: [
      formula(
        '前半の成分',
        eq(
          at('x′', 'i'),
          equals,
          at('x', 'i'),
          call('cos', m.i('θ')),
          m.o('−'),
          at('x', 'i+64'),
          call('sin', m.i('θ')),
        ),
        '回転後のi成分は、元のi成分かけるコサインθ、引くiプラス64成分かけるサインθ。',
      ),
      formula(
        '後半の成分',
        eq(
          at('x′', 'i+64'),
          equals,
          at('x', 'i'),
          call('sin', m.i('θ')),
          plus,
          at('x', 'i+64'),
          call('cos', m.i('θ')),
        ),
        '回転後のiプラス64成分は、元のi成分かけるサインθ、足すiプラス64成分かけるコサインθ。',
      ),
      formula(
        '回転角',
        eq(
          m.i('θ'),
          equals,
          m.i('p'),
          at('ω', 'i'),
          m.o(','),
          at('ω', 'i'),
          equals,
          m.sup(m.n(1000000), m.frac(eq(m.o('−'), m.n(2), m.i('i')), m.n(128))),
        ),
        'θは位置pかけるペアごとの回転速度ω。ωは百万のマイナス2i割る128乗。',
      ),
    ],
    symbols: [
      { name: 'x → x′', meaning: `${name}の回転前 → 後`, shape: `[B,${heads},Tq,128]` },
      { name: 'i', meaning: 'ペア番号：0〜63。(0,64)、(1,65)…が組になる' },
      { name: 'p / θ / ω', meaning: 'Tokenの位置 / 回転角（ラジアン） / ペアごとの回転速度' },
    ],
    scope: 'Qwen3-0.6B · split-half方式・固定revision',
    note: '他のTokenとの内積は、この後のAttention scoresで取ります。Vにはこの回転を適用しません。',
    example: {
      intro: '1組だけを90°（π/2）回す説明用の例です。位置や回転速度を表す実測値ではありません。',
      formulas: [
        formula(
          'cos=0、sin=1の回転',
          eq(tuple(2, 3), m.o('→'), tuple(-3, 2)),
          '2と3の組を90度回転すると、マイナス3と2。',
        ),
      ],
    },
  };
}
function softmax(attention: boolean): AtlasCalculation {
  return {
    kind: '確率への正規化 · Softmax',
    meaning: attention
      ? 'Qの1位置・1Headごとに、参照先Kの位置全体で合計1になる割合を求めます。'
      : '1入力ごとに、語彙の候補全体で合計1になる確率を求めます。',
    formulas: [
      formula(
        '1候補の確率',
        eq(
          at('p', 'j'),
          equals,
          m.frac(
            call('exp', eq(at('s', 'j'), m.o('−'), m.i('a'))),
            sum('k', 'N') + call('exp', eq(at('s', 'k'), m.o('−'), m.i('a'))),
          ),
        ),
        'pのj成分は、スコアsのj成分から最大値aを引いた値の指数を、全候補の同じ指数の合計で割った値。',
      ),
    ],
    symbols: [
      {
        name: 's → p',
        meaning: attention ? 'mask適用済みスコア → 参照割合' : '候補スコア → 確率',
        shape: attention ? '[B,16,Tq,Tkv]' : '[B,V]',
      },
      {
        name: 'N / j / k',
        meaning: attention
          ? '参照先の数Tkv / 注目する参照先 / 合計する参照先'
          : '語彙幅V / 注目する候補 / 合計する候補',
      },
      { name: 'a', meaning: 'その行の最大スコア。引くとオーバーフローを抑えられる' },
    ],
    note: '正規化するのは最後の軸（dim=-1）です。exp(−∞)=0なので、maskされた候補の割合は0になります。少なくとも1候補は有効である必要があります。',
    example: {
      intro: '候補を2つに縮めた説明用の例です。',
      formulas: [
        formula(
          'スコア → 確率',
          eq(
            vector(m.n(0), call('ln', m.n(3))),
            m.o('→'),
            vector(m.frac(m.n(1), m.n(4)), m.frac(m.n(3), m.n(4))),
          ),
          'スコア0と自然対数3のSoftmaxは、4分の1と4分の3。',
        ),
      ],
    },
  };
}

export const calculations: Record<string, AtlasCalculation> = {
  embedding: {
    kind: '行の取り出し · Embedding lookup',
    meaning: '整数IDを重み表の行番号として使い、その行の1024成分を取り出します。',
    formulas: [
      formula(
        '1位置のベクトル',
        eq(at('H', 'b,t,d'), equals, at('E', 'I[b,t],d')),
        'Hのb,t,d成分は、入力IDを行番号にした重み表Eのd成分。',
      ),
    ],
    symbols: [
      { name: 'I', meaning: 'input_ids。値は整数の行番号', shape: '[B,T]' },
      { name: 'E', meaning: 'embed_tokens.weight（学習済み）', shape: '[151936,1024]' },
      { name: 'H', meaning: 'Embedding後のhidden state', shape: '[B,T,1024]' },
    ],
    scope: 'Qwen3-0.6B · 固定revisionの寸法',
    note: 'IDに重みを掛ける計算ではありません。例えばID 89015なら、Eの89015番の行を選びます。',
  },
  'input-norm': norm(1024, '[B,Tq,1024]'),
  'post-norm': norm(1024, '[B,Tq,1024]'),
  'final-norm': norm(1024, '[B,Tq,1024]'),
  'q-norm': norm(128, '[B,Tq,16,128]'),
  'k-norm': norm(128, '[B,Tq,8,128]'),
  'q-proj': linear(
    'Q',
    1024,
    2048,
    'Q用の重みの各行と入力の内積を取り、情報を探す側の表現を作ります。',
  ),
  'k-proj': linear('K', 1024, 1024, 'K用の別の重みを使い、Qと照合される表現を作ります。'),
  'v-proj': linear('V', 1024, 1024, 'V用の別の重みを使い、参照割合に従って集める情報を作ります。'),
  'o-proj': linear('O', 2048, 1024, '全Headを連結した2048成分を混ぜ、1024成分へ戻します。'),
  'gate-proj': linear('Gate', 1024, 3072, '正規化後の入力から、gate側の3072成分を作ります。'),
  'up-proj': linear('Up', 1024, 3072, 'gateと同じ入力から、別の重みでup側の3072成分を作ります。'),
  'down-proj': linear(
    'Down',
    3072,
    1024,
    '要素積の3072成分を重み付きで組み合わせ、モデル幅へ戻します。',
  ),
  'lm-head': linear(
    'Z',
    1024,
    151936,
    '各位置のhidden stateと語彙の各候補の重みを比較し、候補ごとのスコアを作ります。',
    true,
  ),
  'residual-attn': residual(false),
  'residual-mlp': residual(true),
  silu: {
    kind: '成分ごとの関数 · SiLU',
    meaning: 'gateの各値に、その値から求めたsigmoidを掛けます。学習する重みはありません。',
    formulas: [
      formula(
        '各成分の変換',
        eq(
          call('SiLU', m.i('g')),
          equals,
          m.i('g'),
          call('σ', m.i('g')),
          equals,
          m.frac(m.i('g'), eq(m.n(1), plus, m.sup(m.i('e'), eq(m.o('−'), m.i('g'))))),
        ),
        'SiLUのgは、gかけるシグモイドg、つまりg割る1足すeのマイナスg乗。',
      ),
    ],
    symbols: [
      { name: 'g', meaning: 'gate_projの出力の1成分' },
      { name: 'σ(g)', meaning: 'sigmoid。0〜1の係数' },
      { name: 'Gate → SiLU(Gate)', meaning: '同じ位置・成分ごとに計算', shape: '[B,Tq,3072]' },
    ],
    note: '係数σ(g)は0〜1ですが、SiLUの出力g×σ(g)は負にも1より大きくもなります。',
    example: {
      intro: '説明用のスカラーです。',
      formulas: [
        formula(
          '正の入力と負の入力',
          eq(
            call('SiLU', m.n(2)),
            m.o('≈'),
            m.n('1.7616'),
            m.o(','),
            call('SiLU', m.n(-2)),
            m.o('≈'),
            m.n('−0.2384'),
          ),
          'SiLUの2は約1.7616、SiLUのマイナス2は約マイナス0.2384。',
        ),
      ],
    },
  },
  multiply: {
    kind: '要素ごとの積 · Hadamard product',
    meaning: 'SiLUを通したgateとupを、同じ位置・同じ成分同士で掛けます。',
    formulas: [
      formula(
        '全体の計算',
        eq(m.i('M'), equals, call('SiLU', m.i('G')), m.o('⊙'), m.i('U')),
        'MはSiLUを適用したGとUの要素ごとの積。',
      ),
      formula(
        '出力の1成分',
        eq(at('M', 'b,t,j'), equals, call('SiLU', at('G', 'b,t,j')), at('U', 'b,t,j')),
        '同じb,t,jのgate成分をSiLUで変換し、up成分を掛ける。',
      ),
    ],
    symbols: [
      {
        name: 'G / U',
        meaning: 'gate_proj出力 / up_proj出力。別々の重みで同じ入力から作る',
        shape: '[B,Tq,3072]',
      },
      { name: 'M', meaning: 'down_projへ渡す値', shape: '[B,Tq,3072]' },
      { name: '⊙', meaning: '要素積。行列積と違い、ここでは成分を足し合わせない' },
    ],
    example: {
      intro: 'SiLUの後の値とupの値を2成分に縮めた説明用の例です。',
      formulas: [
        formula(
          '対応する成分を掛ける',
          eq(tuple(2, -1), m.o('⊙'), tuple('0.5', 3), equals, tuple(1, -3)),
          '2とマイナス1に、0.5と3を成分ごとに掛けると、1とマイナス3。',
        ),
      ],
    },
  },
  'q-rope': rope('Q', 16),
  'k-rope': rope('K', 8),
  position: {
    kind: '回転角の準備 · RoPE cos / sin',
    meaning: '位置pとペア番号iから回転角を求め、Q・Kの回転に使うcosとsinを用意します。',
    formulas: [
      formula(
        'ペアごとの回転角',
        eq(
          at('θ', 'p,i'),
          equals,
          m.i('p'),
          m.sup(m.n(1000000), m.frac(eq(m.o('−'), m.n(2), m.i('i')), m.n(128))),
        ),
        '位置p、ペアiの角度は、pかける百万のマイナス2i割る128乗。',
      ),
      formula(
        '回転に使う係数',
        eq(
          at('c', 'p,i'),
          equals,
          call('cos', at('θ', 'p,i')),
          m.o(','),
          at('s', 'p,i'),
          equals,
          call('sin', at('θ', 'p,i')),
        ),
        '角度θのコサインcとサインsを求める。',
      ),
    ],
    symbols: [
      { name: 'p', meaning: 'Tokenの絶対位置。cache使用時も続きの位置を使う' },
      { name: 'i', meaning: '64組のペア番号：0〜63' },
      {
        name: 'c / s',
        meaning: '前半と後半で同じ係数を使い、各Headへbroadcastする',
        shape: '[1 または B,Tq,128]',
      },
    ],
    scope: 'Qwen3-0.6B · split-half方式・固定revision',
    note: '位置0なら全ペアでcos=1・sin=0です。位置情報をEmbeddingへ足すのではなく、この係数で各層のQ・Kを回転させます。',
  },
  'causal-mask': {
    kind: '参照可否の条件 · Causal / Padding mask',
    meaning: '参照先が未来でなく、paddingでもない場合だけ参照を許可します。',
    formulas: [
      formula(
        '参照できる条件',
        eq(
          m.t('許可'),
          m.o('⇔'),
          m.o('('),
          m.i('t'),
          m.o('≤'),
          m.i('p'),
          m.o(')'),
          m.o('∧'),
          m.o('('),
          at('valid', 'b,t'),
          equals,
          m.n(1),
          m.o(')'),
        ),
        '参照先位置tが問い合せ位置p以下で、かつその参照先が有効である場合に許可。',
      ),
    ],
    symbols: [
      { name: 'p / t', meaning: '問い合せの絶対位置 / 参照先の絶対位置。cacheの過去の位置も含む' },
      { name: 'valid', meaning: 'attention_mask由来。1が有効、0がpadding', shape: '[B,Tkv]' },
      { name: '∧', meaning: '両方の条件を満たす（AND）' },
    ],
    note: '許可を加算型maskの0、禁止を−∞としてscoresへ反映します。単純な下三角行列はcacheなしの位置対応の場合の見方です。',
  },
  scores: {
    kind: '内積とスケーリング · Scaled dot product',
    meaning: '1つのQ位置と各K位置の128成分を掛けて足し、√128で割ります。',
    formulas: [
      formula(
        'Headごとの行列積',
        eq(m.i('S'), equals, m.frac(eq(m.i('Q'), transpose('K')), m.sqrt(m.n(128)))),
        'SはQとKの転置の行列積を128の平方根で割った値。',
      ),
      formula(
        '位置pと位置tの1スコア',
        eq(
          at('S', 'b,h,p,t'),
          equals,
          m.frac(eq(sum('d', 128), at('Q', 'b,h,p,d'), at('K', 'b,h,t,d')), m.sqrt(m.n(128))),
        ),
        '同じHeadで、Q位置pとK位置tの対応する128成分の積を合計し、128の平方根で割る。',
      ),
    ],
    symbols: [
      { name: 'Q', meaning: 'RoPE後のQuery', shape: '[B,16,Tq,128]' },
      { name: 'K', meaning: 'RoPE・cache・GQA対応後のKey', shape: '[B,16,Tkv,128]' },
      { name: 'S', meaning: '各Q位置 × 各K位置のスコア', shape: '[B,16,Tq,Tkv]' },
      {
        name: 'p / t / d',
        meaning: '問い合せ位置 / 参照先位置 / Head内の成分。Kᵀは最後の2軸だけ転置',
      },
    ],
    scope: 'Qwen3-0.6B · 固定revisionの寸法',
    example: {
      intro: '1 Headを2成分に縮めた説明用の例です（分母も√2に変更）。',
      formulas: [
        formula(
          '1マスの計算',
          eq(
            m.frac(eq(m.n(1), times, m.n(3), plus, m.n(2), times, m.n(4)), m.sqrt(m.n(2))),
            equals,
            m.frac(m.n(11), m.sqrt(m.n(2))),
            m.o('≈'),
            m.n('7.7782'),
          ),
          'Qが1と2、Kが3と4なら、内積11を2の平方根で割り、約7.7782。',
        ),
      ],
    },
  },
  'masked-scores': {
    kind: '参照禁止の反映 · Additive mask',
    meaning: '許可された位置のスコアは保ち、参照禁止の位置を−∞にして、後のSoftmaxで0にします。',
    formulas: [
      formula(
        'スコアにmaskを足す',
        eq(m.i('S′'), equals, m.i('S'), plus, m.i('M')),
        'mask適用後のスコアは、元のスコアSと加算型maskの和。',
      ),
    ],
    symbols: [
      { name: 'S → S′', meaning: '元のスコア → mask適用後', shape: '[B,16,Tq,Tkv]' },
      { name: 'M', meaning: '許可位置は0、禁止位置は−∞。必要な軸へbroadcastして足す' },
    ],
    note: 'ここでのMは加算型maskの概念表現です。inputのattention_mask（1=有効・0=padding）をそのまま足す意味ではありません。',
    example: {
      intro: '3候補のうち最後だけを禁止する説明用の例です。',
      formulas: [
        formula(
          '未来の候補を外す',
          eq(tuple(2, 1, 4), plus, tuple(0, 0, '−∞'), equals, tuple(2, 1, '−∞')),
          '2、1、4に0、0、マイナス無限大を足すと、2、1、マイナス無限大。',
        ),
      ],
    },
  },
  softmax: softmax(true),
  probabilities: softmax(false),
  'weighted-sum': {
    kind: '行列積 · Vの加重和',
    meaning: '各参照先のVに参照割合を掛け、参照先の軸に沿って足し合わせます。',
    formulas: [
      formula(
        'Headごとの計算',
        eq(m.i('O'), equals, m.i('A'), m.i('V')),
        'OはAttentionの割合AとVの行列積。',
      ),
      formula(
        '出力の1成分',
        eq(at('O', 'b,h,p,d'), equals, sum('t', 'Tkv'), at('A', 'b,h,p,t'), at('V', 'b,h,t,d')),
        '問い合せ位置pの出力d成分は、各参照先tの割合とVのd成分を掛けて合計した値。',
      ),
    ],
    symbols: [
      { name: 'A', meaning: 'Softmaxで求めた参照割合', shape: '[B,16,Tq,Tkv]' },
      { name: 'V', meaning: 'cache・GQA対応後のValue', shape: '[B,16,Tkv,128]' },
      { name: 'O', meaning: '位置ごと・Headごとの出力', shape: '[B,16,Tq,128]' },
      { name: 'p / t / d', meaning: '問い合せ位置 / 参照先位置 / Head内の成分' },
    ],
    example: {
      intro: '参照先を2位置・特徴を2成分に縮めた説明用の例です。',
      formulas: [
        formula(
          '情報を混ぜる',
          eq(
            m.n('0.75'),
            times,
            tuple(2, 4),
            plus,
            m.n('0.25'),
            times,
            tuple(6, 0),
            equals,
            tuple(3, 3),
          ),
          '0.75かける2と4、足す0.25かける6と0は、3と3。',
        ),
      ],
    },
  },
  'last-logits': {
    kind: '位置の選択 · Tensor slicing',
    meaning: '最後の入力位置の行を取り出します。語彙候補の軸はすべて残ります。',
    formulas: [
      formula(
        '最後の位置の全候補',
        eq(at('s', 'b,j'), equals, at('Z', 'b,Tq−1,j')),
        'sのb,j成分は、logits Zの最後の位置Tqマイナス1のj成分。',
      ),
    ],
    symbols: [
      { name: 'Z', meaning: 'LM headの出力logits', shape: '[B,Tq,151936]' },
      { name: 's', meaning: '次のIDを選ぶためのスコア', shape: '[B,151936]' },
      { name: 'j', meaning: '語彙候補のID。ここでは最大値を探さない' },
    ],
    note: 'paddingのない入力での例です。右paddingがある場合は、有効な最終位置を取り出す必要があります。',
  },
  processors: {
    kind: '分布の調整 · Temperature / Top-k / Top-p',
    meaning:
      'Temperatureでスコアを調整し、Top-k・Top-pで残す候補を絞ります。外した候補は−∞にします。',
    formulas: [
      formula(
        'Temperature',
        eq(at('s′', 'j'), equals, m.frac(at('s', 'j'), m.i('τ'))),
        '調整後のスコアsダッシュは元のスコアsを正の温度τで割った値。',
      ),
      formula(
        'Top-pの境界',
        eq(
          m.i('m'),
          equals,
          m.i('min'),
          m.o('{'),
          m.i('r'),
          m.o(':'),
          m.sum(eq(m.i('i'), equals, m.n(1)), m.i('r')),
          at('p', '(i)'),
          m.o('≥'),
          m.i('P'),
          m.o('}'),
        ),
        'mは、確率を降順に並べ、先頭からの累積確率がP以上になる最初の順位。',
      ),
    ],
    symbols: [
      { name: 's → s′', meaning: 'Temperature前 → 後のスコア', shape: '[B,V]' },
      { name: 'τ / k / P', meaning: '正の温度 / Top-kの個数 / Top-pの累積確率のしきい値' },
      { name: 'p₍ᵢ₎', meaning: 'その時点のスコアをSoftmaxし、降順に並べた確率（順位iは1始まり）' },
      { name: 'm', meaning: 'Top-pで残す先頭の個数。境界を越える候補も含む' },
    ],
    note: 'τが小さいほど高スコアに集中します。Top-kを使うときは先に上位k個を残し、その後の分布でTop-pを計算。このカード内の順序に対応します。同点の境界処理は実装によります。',
    example: {
      intro:
        'Temperature・Top-kの後の確率を仮定した説明用の例です。Top-p=0.8なら最初の3候補を残します。',
      table: {
        caption: 'Top-p：累積が0.8に達する候補まで残す',
        columns: ['候補ID', '確率', '累積', '判定'],
        rows: [
          ['7', '0.50', '0.50', '残す'],
          ['2', '0.25', '0.75', '残す'],
          ['9', '0.15', '0.90', '残す（境界）'],
          ['4', '0.10', '1.00', '除外'],
        ],
      },
      note: '残した候補のスコアから、Sampling側で再びSoftmaxを取ります。再正規化後は約0.5556、0.2778、0.1667、0です。',
    },
  },
  greedy: {
    kind: '最大値の位置 · argmax',
    meaning: '最も高いスコアの場所を探し、そのIndexを次のToken IDにします。',
    formulas: [
      formula(
        '次のID',
        eq(m.i('id'), equals, m.sub(m.i('argmax'), m.i('j')), at('s', 'j')),
        '次のIDはスコアsが最大となる候補のIndex j。',
      ),
    ],
    symbols: [
      { name: 's', meaning: '候補ごとのスコア', shape: '[B,V]' },
      { name: 'id', meaning: '値ではなくIndex。keepdim=Trueで長さ1の軸を残す', shape: '[B,1]' },
    ],
    note: 'argmaxだけならSoftmaxは不要です。同点の最大値が複数あるtorch.argmaxは、最初のIndexを返します。',
    example: {
      intro: '候補数3の説明用の例です。',
      table: {
        caption: '最大スコア4.2のIndexは1',
        columns: ['候補ID', 'スコア', '選択'],
        rows: [
          ['0', '1.5', ''],
          ['1', '4.2', '← このID'],
          ['2', '−0.7', ''],
        ],
      },
      note: '返るのは1です。4.2でも文字列でもありません。',
    },
  },
  sampling: {
    ...softmax(false),
    kind: '確率を計算 → 抽選 · Sampling',
    meaning: '調整済みスコアをSoftmaxで確率にし、その分布から1個のIDを抽選します。',
    formulas: [
      ...softmax(false).formulas,
      formula(
        '次のIDを抽選',
        eq(m.i('id'), m.o('∼'), call('Categorical', m.i('p'))),
        '次のIDを確率分布pから1個抽選する。',
      ),
    ],
    symbols: [
      ...softmax(false).symbols,
      { name: 'id', meaning: 'multinomial(num_samples=1)が返すIndex', shape: '[B,1]' },
    ],
    example: {
      intro: '確率は説明用です。毎回最大の候補を返す処理ではありません。',
      table: {
        caption: 'それぞれのIDが選ばれる確率',
        columns: ['候補ID', '確率'],
        rows: [
          ['0', '0.60'],
          ['1', '0.30'],
          ['2', '0.10'],
        ],
      },
      note: 'ID 0が選ばれやすい一方、ID 1や2も選ばれます。乱数のseedと生成設定によって結果が変わります。',
    },
  },
  append: {
    kind: '列の連結 · concatenation',
    meaning: '選んだIDを各入力列の末尾へ1つ追加します。',
    formulas: [
      formula(
        '生成列を伸ばす',
        eq(m.i('Y'), equals, call('concat', eq(m.i('I'), m.o(','), m.i('id')))),
        'Yは元のID列Iと次のIDをToken軸に沿って連結した列。',
      ),
    ],
    symbols: [
      { name: 'I', meaning: '現在のID列', shape: '[B,T]' },
      { name: 'id', meaning: '今回選んだ次のID', shape: '[B,1]' },
      { name: 'Y', meaning: '1Token長くなった列', shape: '[B,T+1]' },
    ],
  },
  'next-layer': {
    kind: '層の反復 · Decoder Layer stack',
    meaning:
      '各層は前の層の出力を受け取り、AttentionとMLPでhidden stateを更新します。重みは層ごとに別です。',
    formulas: [
      formula(
        'AttentionとResidual ①',
        eq(at('A', 'ℓ'), equals, at('H', 'ℓ'), plus, call('Attnℓ', call('Norm1ℓ', at('H', 'ℓ')))),
        '層ℓのAは、入力Hと、正規化したHのAttention出力の和。',
      ),
      formula(
        'MLPとResidual ②',
        eq(at('H', 'ℓ+1'), equals, at('A', 'ℓ'), plus, call('MLPℓ', call('Norm2ℓ', at('A', 'ℓ')))),
        '次の層へのHは、Aと、正規化したAのMLP出力の和。',
      ),
    ],
    symbols: [
      { name: 'Hℓ / Hℓ₊₁', meaning: '層ℓの入力 / 出力', shape: '[B,Tq,1024]' },
      { name: 'Aℓ', meaning: 'Residual ①の出力。同じshape' },
      { name: 'ℓ', meaning: 'Decoder Layer番号：0〜27' },
    ],
    note: 'H₀はEmbedding後。H₂₈はLayer 27直後です。outputs.hidden_states[28]はH₂₈そのものではなく、さらに最終RMSNormを通した値です。',
  },
  shift: {
    kind: '予測と正解の位置合わせ · causal shift',
    meaning: '位置tのlogitsに、位置t+1の正解IDを対応させます。',
    formulas: [
      formula(
        '次のTokenを正解にする',
        eq(at('Z', 'b,t,:'), m.o('↔'), at('L', 'b,t+1')),
        '位置tの全候補スコアと、位置tプラス1の正解IDを対応させる。',
      ),
    ],
    symbols: [
      { name: 'Z', meaning: 'logits[:, :-1, :]', shape: '[B,T−1,V]' },
      { name: 'L', meaning: 'labels[:, 1:]', shape: '[B,T−1]' },
    ],
    note: '通常のモデルAPIでlabelsを渡す場合は内部でshiftされます。ここでの対応を重ねて適用しないようにします。',
  },
  loss: {
    kind: '正解確率の損失 · Cross entropy',
    meaning:
      '次の正解IDへ与えた確率が小さいほど、大きな損失になります。有効な予測位置で平均します。',
    formulas: [
      formula(
        '1位置の損失',
        eq(at('L', 'n'), equals, m.o('−'), call('log', at('p', 'n,yₙ'))),
        '位置nの損失は、正解候補y nの確率の自然対数にマイナスを付けた値。',
      ),
      formula(
        '有効位置の平均',
        eq(m.i('L'), equals, m.frac(eq(sum('n', 'N'), at('L', 'n')), m.i('N'))),
        '全体の損失は有効なN位置の損失の平均。',
      ),
    ],
    symbols: [
      { name: 'pₙ,ᵧₙ', meaning: '位置合わせ後のlogitsをSoftmaxした、正解IDの確率' },
      { name: 'N', meaning: 'shift後、labelsが−100でない有効位置数（N>0）' },
      { name: 'L', meaning: '平均損失。1つの数', shape: 'スカラー' },
    ],
    note: 'cross_entropyには確率ではなくlogitsを渡します。内部で安定なlog_softmax相当の計算を行います。',
    example: {
      intro: '正解に与える確率だけを比較する説明用の例です。',
      formulas: [
        formula(
          '高い確率ほど損失が小さい',
          eq(
            m.o('−'),
            call('log', m.n('0.8')),
            m.o('≈'),
            m.n('0.2231'),
            m.o(','),
            m.o('−'),
            call('log', m.n('0.2')),
            m.o('≈'),
            m.n('1.6094'),
          ),
          '正解確率0.8なら損失は約0.2231、0.2なら約1.6094。',
        ),
      ],
    },
  },
  backward: {
    kind: '微分 · Backpropagation',
    meaning: '損失が各重みの小さな変化でどれだけ変わるかを、計算グラフに沿って求めます。',
    formulas: [
      formula(
        '各重みの勾配',
        eq(at('g', 'i'), equals, m.frac(eq(m.o('∂'), m.i('L')), eq(m.o('∂'), at('θ', 'i')))),
        '重みθのi成分の勾配は、損失Lのその重みによる偏微分。',
      ),
    ],
    symbols: [
      { name: 'L', meaning: '計算した損失', shape: 'スカラー' },
      { name: 'θ / g', meaning: 'パラメータ / parameter.grad。同じshape' },
    ],
    note: 'backwardは重み自体を更新しません。既存の.gradがある場合は勾配を加算するので、蓄積しない学習では先にzero_gradします。',
  },
  optimizer: {
    kind: '重みの更新 · Optimizer',
    meaning: '計算済みの勾配とoptimizerのルールを使って、重みを更新します。',
    formulas: [
      formula(
        '最も単純なSGDの式',
        eq(at('θ', 'new'), equals, at('θ', 'old'), m.o('−'), m.i('η'), m.i('g')),
        '更新後の重みは、更新前の重みから学習率ηかける勾配gを引いた値。',
      ),
    ],
    symbols: [
      { name: 'θ / g', meaning: '更新対象の重み / 勾配。同じshape' },
      { name: 'η', meaning: '学習率。更新する量の係数' },
    ],
    note: 'この式はmomentum・weight decayなしのSGDです。AdamWなどでは勾配の履歴や重み減衰も使うため、更新式は異なります。',
    example: {
      intro: 'SGDの説明用です。重み2、勾配0.3、学習率0.1とします。',
      formulas: [
        formula(
          '重みを少し動かす',
          eq(m.n(2), m.o('−'), m.n('0.1'), times, m.n('0.3'), equals, m.n('1.97')),
          '2引く0.1かける0.3は1.97。',
        ),
      ],
    },
  },
  lora: {
    kind: '低ランクの更新経路 · LoRA',
    meaning:
      '元の重みを凍結し、小さな2つの行列の経路を足します。行ベクトルの入力に合わせた式です。',
    formulas: [
      formula(
        '元の経路 ＋ adapter',
        eq(
          m.i('Y'),
          equals,
          m.i('X'),
          transpose('W'),
          plus,
          m.frac(m.i('α'), m.i('r')),
          m.o('('),
          m.i('X'),
          transpose('A'),
          m.o(')'),
          transpose('B'),
        ),
        'YはXとWの転置の積に、α割るランクrかける、XとAの転置とBの転置の積を足した値。',
      ),
    ],
    symbols: [
      { name: 'X → Y', meaning: '入力 → 出力', shape: '[…,in] → […,out]' },
      { name: 'W', meaning: '元の凍結した重み', shape: '[out,in]' },
      { name: 'A / B', meaning: '学習するadapterの重み', shape: '[r,in] / [out,r]' },
      { name: 'r / α', meaning: '小さな中間幅 / スケールを決める設定値' },
    ],
    note: '一般的なLoRAの基本式です。実際のスケールやdropoutは設定・方式によります。',
  },
  quantize: {
    kind: '丸めとスケール · Quantization',
    meaning: '浮動小数点の値を、スケール付きの少ない整数で近似する基本例です。',
    formulas: [
      formula(
        '対称量子化の基本形',
        eq(
          m.i('q'),
          equals,
          call(
            'clip',
            eq(
              call('round', m.frac(m.i('w'), m.i('s'))),
              m.o(','),
              at('q', 'min'),
              m.o(','),
              at('q', 'max'),
            ),
          ),
        ),
        'qはwをスケールsで割って丸め、整数の表現範囲へ収めた値。',
      ),
      formula(
        '元の尺度での近似値',
        eq(m.i('ŵ'), equals, m.i('s'), m.i('q')),
        '近似値はスケールsかける整数q。',
      ),
    ],
    symbols: [
      { name: 'w → q → ŵ', meaning: '元の値 → 量子化した整数 → 復元した近似値' },
      { name: 's', meaning: '正のスケール。共有する範囲は方式による' },
      { name: 'clip', meaning: 'qmin〜qmaxの範囲外を端の値にする' },
    ],
    note: '説明用の対称量子化です。zero-pointや非一様な値を使う方式もあり、実際の保存形式・計算精度・誤差は方式によって異なります。',
    example: {
      intro: 's=0.1、w=0.26、整数範囲内とする説明用の例です。',
      formulas: [
        formula(
          '近似による差',
          eq(
            m.i('q'),
            equals,
            call('round', m.n('2.6')),
            equals,
            m.n(3),
            m.o('⇒'),
            m.i('ŵ'),
            equals,
            m.n('0.3'),
          ),
          '2.6を丸めて整数3、復元値は0.3。',
        ),
      ],
    },
  },
};

calculations.grad = {
  ...calculations.backward,
  meaning:
    '各重みと同じshapeで、損失の変化率を保持します。hidden stateの値そのものではありません。',
};

for (const [name, heads, width] of [
  ['q', 16, 2048],
  ['k', 8, 1024],
  ['v', 8, 1024],
] as const) {
  calculations[`${name}-heads`] = rearrange(
    '1位置の特徴をHeadごとに区切ります。',
    `[B,Tq,${width}]`,
    `[B,Tq,${heads},128]`,
    eq(at('Y', 'b,t,h,d'), equals, at('X', 'b,t,128h+d')),
    '変更後のb,t,h,d成分は、変更前のb,t,128hプラスd成分。',
  );
  calculations[`${name}-transpose`] = rearrange(
    'Head軸とToken位置軸を入れ替えます。',
    `[B,Tq,${heads},128]`,
    `[B,${heads},Tq,128]`,
    eq(at('Y', 'b,h,t,d'), equals, at('X', 'b,t,h,d')),
    '変更後のb,h,t,d成分は、変更前のb,t,h,d成分。',
  );
}
calculations['attention-transpose'] = rearrange(
  'Head軸とToken位置軸を元の順に戻します。',
  '[B,16,Tq,128]',
  '[B,Tq,16,128]',
  eq(at('Y', 'b,t,h,d'), equals, at('X', 'b,h,t,d')),
  '変更後のb,t,h,d成分は、変更前のb,h,t,d成分。',
);
calculations['head-merge'] = rearrange(
  '16 Headの128成分を、2048成分の1本の軸へつなぎます。',
  '[B,Tq,16,128]',
  '[B,Tq,2048]',
  eq(at('Y', 'b,t,128h+d'), equals, at('X', 'b,t,h,d')),
  '変更後のb,t,128hプラスd成分は、変更前のb,t,h,d成分。',
);
for (const name of ['K', 'V']) {
  calculations[`${name.toLowerCase()}-cache`] = {
    kind: 'Token軸での連結 · KV cache',
    meaning: `過去に保存した${name}の後ろへ今回の${name}をつなぎます。各層はそれぞれのcacheを持ちます。`,
    formulas: [
      formula(
        '今回の分を追加',
        eq(
          at(name, 'all'),
          equals,
          call('concat', eq(at(name, 'past'), m.o(','), at(name, 'new'))),
        ),
        `${name}の全体は過去の値と今回の値をToken軸に沿って連結したもの。`,
      ),
    ],
    symbols: [
      { name: `${name}past`, meaning: '保存済みの値', shape: '[B,8,Tpast,128]' },
      { name: `${name}new`, meaning: '今回計算した値', shape: '[B,8,Tq,128]' },
      { name: `${name}all`, meaning: '参照できる全位置。Tkv=Tpast+Tq', shape: '[B,8,Tkv,128]' },
    ],
    note: '通常の伸長型cacheの概念式です。事前確保したcacheでは、同じ論理位置へ書き込む実装もあります。',
  };
  calculations[`${name.toLowerCase()}-gqa`] = {
    kind: 'Headの共有 · Grouped-query attention',
    meaning: `QのHead番号hに、${name}のHead番号⌊h/2⌋を対応させます。`,
    formulas: [
      formula(
        'Q Headに対応する値',
        eq(at(`${name}′`, 'b,h,t,d'), equals, at(name, 'b,⌊h/2⌋,t,d')),
        `${name}ダッシュのHead hは元の${name}のHead、h割る2の切り捨てに対応。`,
      ),
    ],
    symbols: [
      { name, meaning: '元の8 KV heads', shape: '[B,8,Tkv,128]' },
      { name: `${name}′`, meaning: '16 Q headsに対応させた論理上の並び', shape: '[B,16,Tkv,128]' },
      { name: '⌊h/2⌋', meaning: 'h÷2の小数点以下を切り捨てる。hは0〜15' },
    ],
    note: '順序は0,0,1,1,…,7,7。新しい情報を作る学習ではなく共有です。実装によっては物理的な複製を省きます。',
  };
}

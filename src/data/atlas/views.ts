import { nodeById, sectionById, type AtlasMap, type AtlasNode, type AtlasSection } from './index';
import { crossConnections } from './connections';

/** A map is a reading path, not just an unmodified subset of the overall map. */
export function mapSections(map: AtlasMap): AtlasSection[] {
  return map.sections.map((id) => {
    const section = sectionById[id];
    if (map.slug === 'training' && id === 'input') {
      return {
        ...section,
        title: '学習用batchをモデルへ渡す',
        note: '前の章で作ったID・maskを使います。文章の入力やToken化をもう一度行う必要はありません。',
        blocks: [{ lanes: [['device', 'prefill', 'embedding']] }],
        edges: [
          { from: 'device', to: 'prefill' },
          { from: 'prefill', to: 'embedding' },
        ],
      };
    }
    return section;
  });
}

export function mapNode(id: string, map: AtlasMap): AtlasNode {
  const original = nodeById[id];
  if (map.slug !== 'training') return original;
  const overrides: Record<string, Partial<AtlasNode>> = {
    prefill: {
      title: 'Forward：学習用batchの計算を開始',
      code: 'model(**batch, use_cache=False)',
      meaning: 'IDとmaskからEmbedding〜LM headを計算し、Lossへつなぐ。勾配の記録を有効にする。',
      detail:
        '推論のprefillと共通のForward計算ですが、ここでは過去のKV cacheを使い回しません。labelsは後の照合に使います。model.train()と勾配の記録は別の設定です。',
    },
    'k-cache': {
      title: 'Kの受け渡し：学習ではcacheを使わない',
      code: 'use_cache=False',
      input: '今回のK [B,8,T,128]',
      output: '同じK / Tkv=Tq=T',
      meaning: '生成用の過去Kを追加せず、batch全体のKをそのまま渡す。',
      detail:
        '元の推論マップではcache更新が選択可能な地点です。この学習経路では過去のcacheを使わず、今回のbatchの全位置を計算します。',
    },
    'v-cache': {
      title: 'Vの受け渡し：学習ではcacheを使わない',
      code: 'use_cache=False',
      input: '今回のV [B,8,T,128]',
      output: '同じV / Tkv=Tq=T',
      meaning: 'Kと同じ範囲の、今回のbatchのVを渡す。',
      detail: '過去の生成から蓄積したVは連結しません。KとVは同じToken範囲を参照します。',
    },
    embedding: {
      output: 'hidden [B,T,1024]',
      meaning: '学習用batchの各IDからベクトルを取り出す。BとTはbatchに応じて変わる。',
    },
  };
  return { ...original, ...overrides[id] };
}

export function mapConnections(map: AtlasMap) {
  const visible = new Set(mapSections(map).flatMap((s) => s.blocks.flatMap((b) => b.lanes.flat())));
  return crossConnections.filter(([from, to]) => visible.has(from) && visible.has(to));
}

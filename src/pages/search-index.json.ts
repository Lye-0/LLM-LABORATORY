import { withBase } from '../lib/paths';
import { getCollection } from 'astro:content';
import { apiEntries } from '../data/api';
import { apiClasses, apiLibraries, getApiClass } from '../data/api-groups';
import { glossary, comparisons } from '../data/glossary';
import { labs } from '../data/catalog';
import { projects } from '../data/projects';
import { topics } from '../data/topics';
import { learningMaps } from '../data/maps';
import tokens from '../data/tokens.json';
export async function GET() {
  const lessons = await getCollection('lessons');
  const index = [
    {
      title: '図でつなぐ — LLMの全体地図',
      description: '推論・作成・学習・改造を見渡す',
      url: '/learn/maps/',
      kind: 'まとめ',
      keywords: '全体図 作成 改造 データ プログラム',
    },
    ...learningMaps.map((map) => ({
      title: map.title,
      description: map.description,
      url: `/learn/maps/${map.slug}/`,
      kind: 'まとめ',
      keywords: map.sections
        .flatMap((section) => section.steps.map((step) => `${step.title} ${step.explanation}`))
        .join(' '),
    })),
    {
      title: '小さな言語モデルを作る',
      description: 'CPUで初期化・学習・生成・保存・再読込を追う',
      url: '/learn/maps/training/small-model/',
      kind: '教材',
      keywords: '新規作成 Transformer 学習 loss 勾配 optimizer 保存',
    },
    ...apiLibraries.map((l) => ({
      title: l.title,
      description: l.description,
      url: `/reference/libraries/${l.slug}/`,
      kind: 'API',
      keywords: l.namespace,
    })),
    ...apiClasses.map((c) => ({
      title: c.title,
      description: c.description,
      url: `/reference/classes/${c.slug}/`,
      kind: 'API',
      keywords: `${c.library} ${c.owner} ${c.kind}`,
    })),
    ...lessons.map((l) => ({
      title: l.data.title,
      description: l.data.description,
      url: `/learn/${l.id}/`,
      kind: '教材',
      keywords: [...l.data.tags, l.body ?? ''].join(' '),
    })),
    ...apiEntries.map((e) => ({
      title: e.name,
      description: `${getApiClass(e.owner)?.library === 'pytorch' ? 'PyTorch' : 'Transformers'} / ${e.owner} · ${e.summary}`,
      url: `/reference/api/${e.slug}/`,
      kind: 'API',
      keywords: `${e.owner} ${e.signature} ${e.returns} ${e.caveat}`,
    })),
    ...glossary.map((g) => ({
      title: g.title,
      description: g.definition,
      url: `/reference/glossary/${g.slug}/`,
      kind: '用語',
      keywords: g.example,
    })),
    ...comparisons.map((c) => ({
      title: c.title,
      description: c.rule,
      url: `/reference/compare/${c.slug}/`,
      kind: '比較',
      keywords: `${c.a} ${c.b}`,
    })),
    ...labs.map((l) => ({
      title: l.title,
      description: l.summary,
      url: `/labs/${l.slug}/`,
      kind: '実験',
      keywords: `${l.ja} ${l.tag}`,
    })),
    ...projects.map((p) => ({
      title: p.title,
      description: p.description,
      url: `/projects/${p.slug}/`,
      kind: '課題',
      keywords: p.goal,
    })),
    ...topics.map((t) => ({
      title: t.title,
      description: t.summary,
      url: `/topics/${t.slug}/`,
      kind: '周辺技術',
      keywords: t.sections.map((s) => s.join(' ')).join(' '),
    })),
    ...tokens.map((t) => ({
      title: `${t.text} · ${t.id}`,
      description: t.description,
      url: `/reference/tokens/?q=${encodeURIComponent(String(t.id))}`,
      kind: 'トークン',
      keywords: `${t.category} special ${t.special}`,
    })),
  ];
  return new Response(
    JSON.stringify(index.map((entry) => ({ ...entry, url: withBase(entry.url) }))),
    {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    },
  );
}

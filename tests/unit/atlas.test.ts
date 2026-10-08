import { describe, it, expect } from 'vitest';
import { maps, sections, nodes, nodeById, sectionById, nodeUrl } from '../../src/data/atlas';
import { legacyNodes } from '../../src/data/atlas/legacy';
import { learningMaps } from '../../src/data/maps';
import { lessonLocations } from '../../src/data/atlas/supplements';
import measured from '../fixtures/qwen-atlas-reference.json';

describe('atlas relations and migration', () => {
  it('prefill precedes model computation; only continuation loops back after stopping decision', () => {
    const input = sectionById.input.blocks.flatMap((b) => b.lanes.flat());
    expect(input.indexOf('prefill')).toBeLessThan(input.indexOf('embedding'));
    const generation = sectionById.generation;
    expect(generation.blocks.flatMap((b) => b.lanes.flat())).not.toContain('prefill');
    expect(
      generation.edges
        .filter((e) => e.from === 'stop')
        .map((e) => e.to)
        .sort(),
    ).toEqual(['cached-decode', 'decode', 'no-cache']);
    for (const id of ['cached-decode', 'no-cache'])
      expect(generation.edges).toContainEqual(
        expect.objectContaining({ from: id, to: 'last-logits', kind: 'update' }),
      );
    expect(generation.edges.some((e) => e.from === 'decode')).toBe(false);
  });
  it('every visible edge and cross-map link resolves to one stable node', () => {
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
    const overall = maps[0].sections.flatMap((id) =>
      sectionById[id].blocks.flatMap((b) => b.lanes.flat()),
    );
    expect(new Set(overall).size).toBe(overall.length);
    expect([...overall].sort()).toEqual(nodes.map((n) => n.id).sort());
    for (const s of sections) {
      const ids = s.blocks.flatMap((b) => b.lanes.flat());
      for (const id of ids) expect(nodeById[id], id).toBeDefined();
      for (const edge of s.edges) {
        expect(ids).toContain(edge.from);
        expect(ids).toContain(edge.to);
        expect(edge.from).not.toBe(edge.to);
      }
      for (const link of s.links || []) expect(overall).toContain(link.node);
    }
    for (const map of maps) {
      const ids = map.sections.flatMap((id) =>
        sectionById[id].blocks.flatMap((b) => b.lanes.flat()),
      );
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(Object.keys(lessonLocations)).toHaveLength(29);
    for (const id of Object.values(lessonLocations)) expect(overall).toContain(id);
  });
  it('Q/K/V are separate paths, V bypasses norm/RoPE, and residuals have real merges', () => {
    const edges = sectionById.decoder.edges;
    const children = (id: string) => edges.filter((e) => e.from === id).map((e) => e.to);
    expect(children('input-norm')).toEqual(['q-proj', 'k-proj', 'v-proj']);
    expect(children('v-heads')).toEqual(['v-transpose']);
    expect(children('q-heads')).toEqual(['q-norm']);
    expect(children('k-heads')).toEqual(['k-norm']);
    expect(
      edges
        .filter((e) => e.to === 'multiply')
        .map((e) => e.from)
        .sort(),
    ).toEqual(['silu', 'up-proj']);
    expect(
      edges
        .filter((e) => e.to === 'residual-attn')
        .map((e) => e.from)
        .sort(),
    ).toEqual(['layer-input', 'o-proj']);
    expect(
      edges
        .filter((e) => e.to === 'residual-mlp')
        .map((e) => e.from)
        .sort(),
    ).toEqual(['down-proj', 'residual-attn']);
  });
  it('every old section/step resolves to a visible new anchor, including query collisions', () => {
    for (const old of learningMaps)
      for (const section of old.sections)
        for (const step of section.steps) {
          const id = legacyNodes[old.slug][section.id][step.id];
          expect(nodeById[id], `${old.slug}/${section.id}/${step.id}`).toBeDefined();
          expect(
            nodeUrl(
              id,
              maps.find((m) => m.slug === old.slug)!,
            ),
          ).toMatch(/#n-/);
        }
    expect(legacyNodes.inference.inference.embedding).toBe('embedding');
    expect(legacyNodes.modification.change.embedding).toBe('embedding-edit');
  });
  it('the concrete head dimensions and cache distinctions match the pinned measured model', () => {
    expect(measured.observations['prefill:q_norm'].in).toEqual([1, 7, 16, 128]);
    expect(measured.observations['prefill:k_norm'].in).toEqual([1, 7, 8, 128]);
    expect(measured.observations['cached-decode:attention'].scores).toEqual([1, 16, 1, 8]);
    expect(measured.observations['no-cache:attention'].scores).toEqual([1, 16, 8, 8]);
    for (const [id, name] of [
      ['q-proj', 'q_proj'],
      ['k-proj', 'k_proj'],
      ['v-proj', 'v_proj'],
      ['o-proj', 'o_proj'],
      ['gate-proj', 'gate_proj'],
      ['up-proj', 'up_proj'],
      ['down-proj', 'down_proj'],
    ]) {
      const observation = measured.observations[
        `prefill:${name}` as keyof typeof measured.observations
      ] as { in: number[]; out: number[] };
      expect(nodeById[id].output).toContain(String(observation.out.at(-1)));
      expect(nodeById[id].input).toContain(String(observation.in.at(-1)));
    }
  });
});

import { projectionActors } from './journey-actors';
import { ease } from './journey-timing';
import { journeyFrames, type Entity, type JourneySample } from './journey-scene';
import type { OperationNote } from './journey-operations';
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const intersects = (a: Rect, b: Rect, gap = 14) =>
  a.x < b.x + b.width + gap &&
  a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap &&
  a.y + a.height + gap > b.y;
function bounds(e: Entity): Rect {
  const cols = e.transpose ? e.data.length : e.data[0].length,
    rows = e.transpose ? e.data[0].length : e.data.length;
  return {
    x: e.x,
    y: e.y - 30,
    width: Math.max(cols * e.w, Math.min(260, e.label.length * 7)),
    height: rows * e.h + 30,
  };
}
export function layoutJourneyNotes(sample: JourneySample, source: OperationNote[]) {
  const obstacles = Object.values(journeyFrames[sample.index].entities)
      .filter((e) => e.opacity > 0)
      .map(bounds),
    notes: (OperationNote & Rect & { opacity: number })[] = [];
  const stageHeight = journeyFrames[sample.index].height;
  // Token captions and the +1 caption are SVG annotations, not tensor actors.
  // Reserve their whole band so operation notes cannot occupy it.
  if (sample.step.id === 'append') obstacles.push({ x: 70, y: 330, width: 830, height: 65 });
  let height = Math.max(sample.height, stageHeight);
  let useBelow = false;
  for (const note of source) {
    const linked = ['qkv', 'heads', 'rope'].includes(sample.step.id);
    const projection = [
      'o-proj',
      'down',
      'logits',
      'scores',
      'transpose',
      'sampling',
      'append',
      'multiply',
      'residual-attn',
      'residual-mlp',
    ].includes(sample.step.id);
    const gate = sample.step.id === 'gate';
    const width = linked
      ? 250
      : projection
        ? sample.step.id === 'scores' || sample.step.id === 'transpose'
          ? 580
          : 700
        : gate
          ? 560
          : note.x >= 740
            ? 250
            : 300;
    const detailCount = ['down', 'o-proj'].includes(sample.step.id)
      ? 7
      : sample.step.id === 'scores'
        ? 5
        : ['qkv', 'gate', 'o-proj', 'logits', 'rope'].includes(sample.step.id)
          ? 4
          : sample.step.id === 'silu'
            ? 3
            : 2;
    const noteHeight =
      54 +
      note.formula.reduce(
        (h, f) =>
          h +
          (f.includes('<msqrt>') && f.includes('<munderover>')
            ? 96
            : f.includes('<mfrac>')
              ? 66
              : 42),
        0,
      ) +
      52 +
      detailCount * 30;
    const preferred = linked
      ? { x: 750, y: 190 + notes.length * 330 }
      : projection
        ? {
            x: sample.step.id === 'scores' || sample.step.id === 'transpose' ? 400 : 240,
            y: sample.step.id === 'sampling' ? 600 : note.y,
          }
        : gate
          ? { x: 400, y: note.y }
          : null;
    const candidates = [
      ...(preferred ? [preferred] : []),
      { x: Math.min(note.x, 1000 - width), y: Math.max(180, note.y - 20) },
      ...[700, 740]
        .filter((x) => x + width <= 1000)
        .flatMap((x) =>
          [Math.max(180, note.y - 20), ...notes.map((n) => n.y + n.height + 24)].map((y) => ({
            x,
            y,
          })),
        ),
    ];
    const position = candidates.find(
      (p) =>
        ![...obstacles, ...notes].some((other) =>
          intersects({ ...p, width, height: noteHeight }, other),
        ),
    );
    if (!position) useBelow = true;
    const placed = {
      ...note,
      opacity: 1,
      ...(position ?? {
        x: Math.min(310, 1000 - width),
        y: Math.max(
          stageHeight + 30,
          ...obstacles.map((o) => o.y + o.height + 30),
          ...notes.map((n) => n.y + n.height + 24),
        ),
      }),
      width,
      height: noteHeight,
    };
    notes.push(placed);
    height = Math.max(height, placed.y + placed.height + 35);
  }
  if (useBelow && notes.length > 1 && !linkedStage(sample.step.id)) {
    const gap = 24,
      width = (948 - gap * (notes.length - 1)) / notes.length;
    const y = Math.max(stageHeight + 30, ...obstacles.map((o) => o.y + o.height + 30));
    notes.forEach((n, i) => {
      n.x = 26 + i * (width + gap);
      n.y = y;
      n.width = width;
    });
    height = Math.max(sample.height, y + Math.max(...notes.map((n) => n.height)) + 35);
  }
  for (const note of notes) {
    for (const actor of sample.entities.filter((e) => e.opacity > 0.01)) {
      const projected = projectionActors(sample.step.id)?.output === actor.id;
      const e = projected
        ? { ...actor, data: actor.end.data, transpose: actor.end.transpose }
        : actor;
      const r = bounds(e);
      if (sample.step.id === 'transpose' && actor.id === 'k' && sample.progress < 0.92) {
        r.height = Math.max(r.height, actor.start.data.length * actor.start.h + 30);
        r.width = Math.max(r.width, 390);
      }
      const distance = Math.max(
        r.x - note.x - note.width,
        note.x - r.x - r.width,
        r.y - note.y - note.height,
        note.y - r.y - r.height,
      );
      note.opacity = Math.min(note.opacity, ease((distance - 4) / 12));
    }
  }
  return { notes, height, obstacles };
}

const linkedStage = (id: string) => ['qkv', 'heads', 'rope'].includes(id);

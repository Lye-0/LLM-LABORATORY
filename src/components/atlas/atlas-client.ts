import { crossConnections } from '../../data/atlas/connections';
import type { AtlasEdge } from '../../data/atlas';

export function initAtlas() {
  const root = document.querySelector<HTMLElement>('[data-atlas]');
  if (!root) return;
  root.classList.add('is-enhanced');
  const all = Array.from(root.querySelectorAll<HTMLElement>('[data-node]'));
  const byId = new Map(all.map((n) => [n.dataset.node!, n]));
  const dialog = root.querySelector<HTMLDialogElement>('.atlas-inspector')!;
  const content = root.querySelector<HTMLElement>('[data-inspector-body]')!;
  let opener: HTMLElement | null = null;
  const close = (restore = true, historyUpdate = true) => {
    dialog.close();
    document.body.classList.remove('atlas-modal-open');
    if (restore) {
      opener?.focus({ preventScroll: true });
      requestAnimationFrame(() => opener?.scrollIntoView({ block: 'center', behavior: 'instant' }));
    }
    if (historyUpdate) {
      const url = new URL(location.href);
      url.searchParams.delete('detail');
      history.replaceState(null, '', url);
    }
  };
  function show(id: string, push = true) {
    const el = byId.get(id);
    if (!el) return;
    opener = el.querySelector('summary');
    content.replaceChildren(el.querySelector('.atlas-detail-body')!.cloneNode(true));
    content.querySelectorAll('h4,h5').forEach((heading) => {
      const replacement = document.createElement(heading.tagName === 'H4' ? 'h3' : 'h4');
      replacement.textContent = heading.textContent;
      heading.replaceWith(replacement);
    });
    content.querySelectorAll<HTMLButtonElement>('.copy-code').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(
            button.closest('pre')!.querySelector('code')!.textContent || '',
          );
          button.textContent = 'コピー済み';
        } catch {
          button.textContent = '選択してコピー';
        }
      });
    });
    if (dialog.open) dialog.close();
    dialog.showModal();
    dialog.scrollTop = 0;
    document.body.classList.add('atlas-modal-open');
    dialog.querySelector<HTMLButtonElement>('[data-close]')!.focus({ preventScroll: true });
    if (push) {
      const url = new URL(location.href);
      url.searchParams.set('detail', id);
      url.hash = `n-${id}`;
      history.pushState(null, '', url);
    }
  }
  root.querySelectorAll<HTMLDetailsElement>('.atlas-detail').forEach((detail) => {
    detail.querySelector('summary')!.addEventListener('click', (event) => {
      event.preventDefault();
      show(detail.closest<HTMLElement>('[data-node]')!.dataset.node!);
    });
  });
  root.querySelector('[data-close]')!.addEventListener('click', () => close());
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.open) {
      event.preventDefault();
      close();
    }
  });
  dialog.addEventListener('click', (event) => {
    const link = (event.target as Element).closest('a');
    if (link?.getAttribute('href')?.startsWith('#')) close(false);
  });
  function restoreUrl() {
    const id = new URL(location.href).searchParams.get('detail');
    if (id && byId.has(id)) show(id, false);
    else if (dialog.open) close(false, false);
  }
  addEventListener('popstate', restoreUrl);
  restoreUrl();

  const input = root.querySelector<HTMLInputElement>('#atlas-query')!;
  const status = root.querySelector<HTMLOutputElement>('[data-search-status]')!;
  let matches: HTMLElement[] = [];
  let index = -1;
  function find() {
    const q = input.value.trim().toLocaleLowerCase();
    index = -1;
    matches = all.filter((n) => q && n.dataset.search!.toLocaleLowerCase().includes(q));
    all.forEach((n) => {
      n.classList.toggle('is-match', matches.includes(n));
      n.classList.remove('is-current-match');
    });
    status.textContent = q ? `${matches.length}地点が一致` : '名前・コード・データから探せます';
  }
  function move(delta: number) {
    if (!matches.length) return;
    if (index < 0) index = delta > 0 ? 0 : matches.length - 1;
    else index = (index + delta + matches.length) % matches.length;
    all.forEach((n) => n.classList.remove('is-current-match'));
    const n = matches[index];
    n.classList.add('is-current-match');
    n.scrollIntoView({ block: 'center' });
    status.textContent = `${index + 1} / ${matches.length}：${n.querySelector('h3')!.textContent}`;
    const url = new URL(location.href);
    url.hash = n.id;
    history.replaceState(null, '', url);
  }
  input.addEventListener('input', find);
  root.querySelector('form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    move(1);
  });
  root.querySelector('[data-prev]')!.addEventListener('click', () => move(-1));
  root.querySelector<HTMLButtonElement>('.atlas-wide')!.addEventListener('click', (e) => {
    const button = e.currentTarget as HTMLButtonElement;
    const expanded = document.body.classList.toggle('atlas-expanded');
    button.setAttribute('aria-pressed', String(expanded));
    button.textContent = expanded ? '左メニューを戻す' : '広く見る';
  });

  const graphs = Array.from(root.querySelectorAll<HTMLElement>('.atlas-graph'));
  function draw(graph: HTMLElement) {
    const svg = graph.querySelector<SVGSVGElement>('svg')!;
    svg.querySelectorAll('.atlas-route').forEach((p) => p.remove());
    if (matchMedia('(max-width:600px)').matches) return;
    const bounds = graph.getBoundingClientRect();
    const edges: AtlasEdge[] = JSON.parse(graph.dataset.edges!);
    edges.forEach((edge, i) => {
      const from = byId.get(edge.from),
        to = byId.get(edge.to);
      if (!from || !to) return;
      const a = from.getBoundingClientRect(),
        b = to.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - bounds.left,
        y1 = a.bottom - bounds.top;
      const x2 = b.left + b.width / 2 - bounds.left,
        y2 = b.top - bounds.top;
      let d: string;
      const fromBlock = from.closest('.atlas-block')!.getBoundingClientRect();
      const toBlock = to.closest('.atlas-block')!.getBoundingClientRect();
      const crossesBlock = from.closest('.atlas-block') !== to.closest('.atlas-block');
      const blocked =
        crossesBlock &&
        Array.from(graph.querySelectorAll<HTMLElement>('[data-node]')).some((n) => {
          if (n === from || n === to) return false;
          const r = n.getBoundingClientRect();
          return (
            r.top > a.bottom &&
            r.bottom < b.top &&
            r.left < a.left + a.width / 2 &&
            r.right > a.left + a.width / 2
          );
        });
      const side = edge.kind === 'residual' || edge.kind === 'update' || y2 < y1 || blocked;
      if (edge.kind === 'shared' && !crossesBlock && a.right < b.left) {
        d =
          'M' +
          (a.right - bounds.left) +
          ',' +
          (a.top + a.height / 2 - bounds.top) +
          ' L' +
          (b.left - bounds.left) +
          ',' +
          (b.top + b.height / 2 - bounds.top);
      } else if (side) {
        const right = edge.label === 'Vの値' || edge.label === '完了';
        const sx = (right ? a.right : a.left) - bounds.left,
          tx = (right ? b.right : b.left) - bounds.left;
        const rail = right ? bounds.width - 4 : 4 + (i % 3) * 5;
        if (edge.kind === 'residual')
          d = `M${sx},${a.top + a.height / 2 - bounds.top} H${rail} V${b.top + b.height / 2 - bounds.top} H${tx}`;
        else {
          const exitY = from.nextElementSibling ? y1 + 12 : fromBlock.bottom - bounds.top - 8;
          d = `M${x1},${y1} V${exitY} H${rail} V${toBlock.top - bounds.top + 8} H${x2} V${y2}`;
        }
      } else {
        const mid = Math.max(y1 + 10, y2 - 14);
        d = `M${x1},${y1} V${mid} H${x2} V${y2}`;
      }
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', `atlas-route atlas-route--${edge.kind || 'flow'}`);
      path.dataset.from = edge.from;
      path.dataset.to = edge.to;
      if (edge.kind !== 'shared')
        path.setAttribute('marker-end', `url(#${svg.querySelector('marker')!.id})`);
      svg.append(path);
    });
    graph.classList.add('has-routes');
  }
  const canvas = root.querySelector<HTMLElement>('.atlas-canvas')!;
  const crossSvg = canvas.querySelector<SVGSVGElement>('.atlas-cross-edges')!;
  const connections = crossConnections;
  function drawConnections() {
    crossSvg.querySelectorAll('path[data-from]').forEach((p) => p.remove());
    const bounds = canvas.getBoundingClientRect();
    connections.forEach(([fromId, toId], i) => {
      const from = byId.get(fromId),
        to = byId.get(toId);
      if (!from || !to) return;
      const a = from.getBoundingClientRect(),
        b = to.getBoundingClientRect();
      const direct =
        to.closest('.atlas-section')?.classList.contains('atlas-section--continuation') &&
        ['embedding', 'next-layer', 'lm-head'].includes(fromId);
      const narrow = matchMedia('(max-width:600px)').matches;
      const x1 = a.left + (direct && narrow ? 12 : a.width / 2) - bounds.left,
        y1 = a.bottom - bounds.top;
      const x2 = b.left + (direct && narrow ? 12 : b.width / 2) - bounds.left,
        y2 = b.top - bounds.top;
      const rail = 5 + (i % 3) * 6;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute(
        'd',
        'M' +
          x1 +
          ',' +
          y1 +
          ' V' +
          (y1 + 12) +
          ' H' +
          rail +
          ' V' +
          (y2 - 12) +
          ' H' +
          x2 +
          ' V' +
          y2,
      );
      if (direct) path.setAttribute('d', `M${x1},${y1} L${x2},${y2}`);
      path.dataset.direct = String(Boolean(direct));
      path.setAttribute('class', 'atlas-cross-route');
      path.setAttribute('marker-end', 'url(#atlas-cross-arrow)');
      path.dataset.from = fromId;
      path.dataset.to = toId;
      crossSvg.append(path);
    });
  }
  let frame = 0;
  const redraw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      graphs.forEach(draw);
      drawConnections();
    });
  };
  const observer = new ResizeObserver(redraw);
  graphs.forEach((g) => observer.observe(g));
  observer.observe(canvas);
  document.fonts.ready.then(redraw);
  redraw();
  const chapters = Array.from(root.querySelectorAll<HTMLAnchorElement>('.atlas-chapters a'));
  const headings = Array.from(root.querySelectorAll<HTMLElement>('.atlas-section'));
  let scrollFrame = 0;
  const current = () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      let id = headings[0]?.id;
      for (const h of headings) if (h.getBoundingClientRect().top < 180) id = h.id;
      chapters.forEach((a) => {
        if (a.hash === `#${id}`) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    });
  };
  addEventListener('scroll', current, { passive: true });
  current();
}

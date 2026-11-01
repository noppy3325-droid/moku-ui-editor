import type { Screen, UINode } from './model';

/** A selected ancestor carries all descendants; a descendant must never move twice. */
export function hasSelectedAncestor(node: UINode, nodes: UINode[], selected: Set<string>): boolean {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const visited = new Set([node.id]);
  let parent = node.parentId;
  while (parent && !visited.has(parent)) {
    if (selected.has(parent)) return true;
    visited.add(parent);
    parent = byId.get(parent)?.parentId ?? null;
  }
  return false;
}

export function isEffectivelyLocked(node: UINode, nodes: UINode[]): boolean {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const visited = new Set<string>();
  let current: UINode | undefined = node;
  while (current && !visited.has(current.id)) {
    if (current.locked) return true;
    visited.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

export function editableRoots(nodes: UINode[], ids: string[]): UINode[] {
  const selected = new Set(ids);
  return nodes.filter(n => selected.has(n.id) && !isEffectivelyLocked(n, nodes) && !hasSelectedAncestor(n, nodes, selected));
}

export function worldGeometry(node: UINode, nodes: UINode[]): { x: number; y: number; rotation: number } {
  const byId = new Map(nodes.map(n => [n.id, n])), ancestors: UINode[] = [], seen = new Set([node.id]);
  let parent = node.parentId ? byId.get(node.parentId) : undefined;
  while (parent && !seen.has(parent.id)) { ancestors.push(parent); seen.add(parent.id); parent = parent.parentId ? byId.get(parent.parentId) : undefined; }
  let cx = node.x + node.width / 2, cy = node.y + node.height / 2, rotation = node.rotation;
  ancestors.forEach(p => {
    const angle = p.rotation * Math.PI / 180, dx = cx - p.width / 2, dy = cy - p.height / 2;
    cx = p.x + p.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle);
    cy = p.y + p.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle);
    rotation += p.rotation;
  });
  return { x: cx - node.width / 2, y: cy - node.height / 2, rotation: ((rotation + 180) % 360 + 360) % 360 - 180 };
}

export function localDelta(node: UINode, nodes: UINode[], dx: number, dy: number) {
  const angle = (worldGeometry(node, nodes).rotation - node.rotation) * Math.PI / 180;
  return { x: dx * Math.cos(angle) + dy * Math.sin(angle), y: -dx * Math.sin(angle) + dy * Math.cos(angle) };
}

export function synchronizeChildren(screen: Screen) {
  const children = new Map<string, string[]>();
  screen.nodes.forEach(n => {
    if (n.parentId) {
      const list = children.get(n.parentId) ?? [];
      list.push(n.id);
      children.set(n.parentId, list);
    }
  });
  screen.nodes.forEach(n => { n.children = children.get(n.id) ?? []; });
}

export function reflowScreen(screen: Screen) {
  synchronizeChildren(screen);
  const byId = new Map(screen.nodes.map(n => [n.id, n]));
  const visited = new Set<string>();
  const layout = (parent: UINode) => {
    if (visited.has(parent.id)) return;
    visited.add(parent.id);
    const children = parent.children.map(id => byId.get(id)!).filter(Boolean).sort((a, b) => a.zIndex - b.zIndex);
    const { mode, padding, gap, align } = parent.layout;
    if (mode === 'grid') {
      const columnWidth = Math.max(1, (parent.width - padding * 2 - gap) / 2);
      let y = padding;
      for (let i = 0; i < children.length; i += 2) {
        const row = children.slice(i, i + 2);
        row.forEach((child, col) => {
          child.x = padding + col * (columnWidth + gap);
          child.y = y;
          child.width = columnWidth;
        });
        y += Math.max(...row.map(n => n.height)) + gap;
      }
    } else if (mode !== 'free') {
      let offset = padding;
      children.forEach(child => {
        if (mode === 'vertical') {
          child.y = offset;
          child.x = align === 'center' ? (parent.width - child.width) / 2 : align === 'end' ? parent.width - child.width - padding : padding;
          offset += child.height + gap;
        } else {
          child.x = offset;
          child.y = align === 'center' ? (parent.height - child.height) / 2 : align === 'end' ? parent.height - child.height - padding : padding;
          offset += child.width + gap;
        }
      });
    }
    children.forEach(layout);
  };
  screen.nodes.filter(n => !n.parentId).forEach(layout);
}

/** Pointer deltas are in screen space; resizing a rotated node needs its own axes. */
export function resizeGeometry(original: UINode, handle: string, dx: number, dy: number, preserveRatio: boolean) {
  const angle = original.rotation * Math.PI / 180;
  const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
  const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const horizontal = handle.includes('e') || handle.includes('w');
  const vertical = handle.includes('n') || handle.includes('s');
  let width = original.width + (handle.includes('e') ? localX : handle.includes('w') ? -localX : 0);
  let height = original.height + (handle.includes('s') ? localY : handle.includes('n') ? -localY : 0);
  if (preserveRatio) {
    const ratio = original.width / original.height;
    if (horizontal && vertical) {
      if (Math.abs(width / original.width - 1) > Math.abs(height / original.height - 1)) height = width / ratio;
      else width = height * ratio;
    } else if (horizontal) height = width / ratio;
    else width = height * ratio;
  }
  const minScale = Math.max(8 / original.width, 8 / original.height);
  if (preserveRatio) {
    const scale = Math.max(minScale, Math.min(10000 / original.width, 10000 / original.height, width / original.width));
    width = original.width * scale;
    height = original.height * scale;
  } else {
    width = Math.max(8, Math.min(10000, width));
    height = Math.max(8, Math.min(10000, height));
  }
  const shiftX = handle.includes('w') ? (original.width - width) / 2 : handle.includes('e') ? (width - original.width) / 2 : 0;
  const shiftY = handle.includes('n') ? (original.height - height) / 2 : handle.includes('s') ? (height - original.height) / 2 : 0;
  const centerX = original.x + original.width / 2 + shiftX * Math.cos(angle) - shiftY * Math.sin(angle);
  const centerY = original.y + original.height / 2 + shiftX * Math.sin(angle) + shiftY * Math.cos(angle);
  return { x: Math.round(centerX - width / 2), y: Math.round(centerY - height / 2), width: Math.round(width), height: Math.round(height) };
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every(k => Object.prototype.hasOwnProperty.call(b, k) && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export function clampZoom(value: number) { return Number.isFinite(value) ? Math.max(.15, Math.min(2, value)) : .8; }

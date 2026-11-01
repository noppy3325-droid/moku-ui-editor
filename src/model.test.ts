import { describe, expect, it } from 'vitest';
import { absolutePosition, clone, createProject, newNode, parseProject, safeImage, safeUrl } from './model';

describe('project schema and import safety', () => {
  it('round trips the complete project without losing transitions or styles', () => { const p = createProject(); const result = parseProject(JSON.parse(JSON.stringify(p))); expect(result).toEqual(p); expect(result.screens[0].nodes.some(n => n.actions.some(a => a.targetScreenId === result.screens[1].id))).toBe(true); });
  it('rejects unsupported versions, duplicate IDs, missing start screens and non-finite geometry', () => {
    const p = createProject();
    const badVersion = { ...p, version: '999' }; expect(() => parseProject(badVersion)).toThrow();
    const duplicate = clone(p); duplicate.screens[1].id = duplicate.screens[0].id; expect(() => parseProject(duplicate)).toThrow();
    expect(() => parseProject({ ...p, startScreenId: 'missing' })).toThrow();
    const geometry = clone(p); geometry.screens[0].nodes[0].width = Infinity; expect(() => parseProject(geometry)).toThrow();
  });
  it('rejects cyclic hierarchies and missing parents', () => { const p = createProject(); const [a, b] = p.screens[0].nodes; a.parentId = b.id; b.parentId = a.id; expect(() => parseProject(p)).toThrow(); b.parentId = 'not-a-node'; expect(() => parseProject(p)).toThrow(); });
  it('rejects script URLs, external image tracking and active SVG payloads', () => { expect(safeUrl('javascript:alert(1)')).toBe(false); expect(safeUrl('https://example.com')).toBe(true); expect(safeImage('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false); expect(safeImage('https://example.com/track.png')).toBe(false); const p = createProject(); p.screens[0].nodes[0].actions = [{ id: 'action-1', trigger: 'click', type: 'url', targetScreenId: '', transition: 'none', url: 'javascript:alert(1)' }]; expect(() => parseProject(p)).toThrow(); });
  it('restores child references from the authoritative parent IDs', () => { const p = createProject(true); const group = newNode('container', 10, 20), child = newNode('button', 5, 7); child.parentId = group.id; p.screens[0].nodes = [group, child]; const parsed = parseProject(p); expect(parsed.screens[0].nodes[0].children).toEqual([child.id]); expect(absolutePosition(child, [group, child])).toEqual({ x: 15, y: 27 }); });
});

import { describe, expect, it } from 'vitest';
import { createProject, newNode } from './model';
import { html, markdown, scopedProject, warnings } from './exports';
describe('shared-model exports', () => {
  it('includes geometry, typography and ID-based transitions in the AI specification', () => { const p = createProject(); const text = markdown(p); expect(text).toContain('393 × 852px'); expect(text).toContain('Noto Sans JP'); expect(text).toContain(p.screens[1].id); expect(text).toContain('navigate'); expect(text).toContain('TODO'); expect(text).toContain('React + TypeScript'); });
  it('escapes user-authored text and names in executable HTML', () => { const p = createProject(true); p.name = '<script>alert(1)</script>'; const n = newNode('text'); n.properties.text = '<img src=x onerror=alert(1)>'; p.screens[0].nodes.push(n); const code = html(p); expect(code).toContain('&lt;script&gt;'); expect(code).toContain('&lt;img'); expect(code).not.toContain('<img src=x'); expect(code).not.toContain('<script>alert(1)'); });
  it('retains viewport settings and warns about removed destinations', () => { const p = createProject(); const target = p.screens[1].id; p.screens = p.screens.filter(s => s.id !== target); expect(warnings(p).length).toBeGreaterThan(0); expect(markdown(p)).toContain('削除された画面'); });
  it('uses the current screen as the start for a single-screen export', () => { const p = createProject(); const scoped = scopedProject(p, [p.screens[1]]); expect(scoped.startScreenId).toBe(p.screens[1].id); expect(scoped.screens).toHaveLength(1); });
});

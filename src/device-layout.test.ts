import { describe, expect, it } from 'vitest';
import { createProject, newNode } from './model';
import { applyScreenSize } from './device-layout';
import { offlineWorkerSource } from '../build/offline-worker';

describe('device conversion', () => {
  it('keeps free-placement geometry unless scaling is explicitly selected', () => { const s = createProject(true).screens[0]; const node = newNode('button', 20, 80); s.nodes.push(node); applyScreenSize(s, 1440, 900, 'Laptop'); expect([node.x, node.y, node.width]).toEqual([20, 80, 280]); expect(s.viewportSettings.statusBar).toBe(false); expect(s.viewportSettings.scrollHeight).toBeGreaterThanOrEqual(900); });
  it('scales nested local coordinates and caps valid font/layout sizes', () => { const s = createProject(true).screens[0]; const n = newNode('text', 40, 50); s.nodes.push(n); applyScreenSize(s, s.width * 2, s.height * 2, 'Scaled', true); expect([n.x, n.y, n.width, n.styles.fontSize]).toEqual([80, 100, 480, 40]); });
});
describe('offline application shell', () => {
  it('preloads lazy modules and does not cache project data or external requests', () => { const source = offlineWorkerSource('test', ['/index.html', '/assets/Dialogs.js', '/assets/index.css']); expect(source).toContain('/assets/Dialogs.js'); expect(source).toContain("url.origin!==self.location.origin"); expect(source).toContain("request.method!=='GET'"); expect(source).not.toContain('indexedDB'); });
  it('requires an authenticated app marker before caching HTML and preserves the previous cache during updates', () => { const source = offlineWorkerSource('test', ['/index.html']); expect(source).toContain('name="moku-app"'); expect(source).toContain('ACTIVATE_UPDATE'); expect(source).toContain("key!==CACHE&&!previous.includes(key)"); });
});

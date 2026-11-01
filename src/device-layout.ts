import type { Screen } from './model';

export function applyScreenSize(screen: Screen, width: number, height: number, device: string, scaleContent = false) {
  const w = Math.max(100, Math.min(6000, Math.round(width))), h = Math.max(100, Math.min(10000, Math.round(height)));
  const sx = w / screen.width, sy = h / screen.height;
  if (scaleContent) screen.nodes.forEach(node => {
    node.x = Math.round(node.x * sx); node.y = Math.round(node.y * sy);
    node.width = Math.max(1, Math.round(node.width * sx)); node.height = Math.max(1, Math.round(node.height * sy));
    const ratio = Math.min(sx, sy);
    node.styles.fontSize = Math.max(1, Math.min(500, Math.round(node.styles.fontSize * ratio)));
    node.styles.radius = Math.min(1000, Math.round(node.styles.radius * ratio));
    node.layout.padding = Math.min(1000, Math.round(node.layout.padding * ratio));
    node.layout.gap = Math.min(1000, Math.round(node.layout.gap * ratio));
  });
  screen.width = w; screen.height = h; screen.device = device;
  screen.viewportSettings.scrollHeight = Math.max(h, Math.min(20000, Math.round(screen.viewportSettings.scrollHeight * (scaleContent ? sy : 1))));
  if (w > 1100) { screen.viewportSettings.deviceFrame = false; screen.viewportSettings.statusBar = false; screen.viewportSettings.safeArea = false; }
}

import type { CSSProperties } from 'react';
import type { UINode } from './model';

export function appearanceCSS(n: UINode): CSSProperties {
  const s = n.styles, g = s.gradient, c = s.corners, shadow = s.shadowStyle;
  const background = g?.type === 'linear' ? `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` : g?.type === 'radial' ? `radial-gradient(circle, ${g.from}, ${g.to})` : s.background;
  return {
    background, borderStyle: s.borderStyle ?? 'solid',
    borderRadius: n.type === 'ellipse' || n.type === 'avatar' ? '50%' : c?.enabled ? `${c.topLeft}px ${c.topRight}px ${c.bottomRight}px ${c.bottomLeft}px` : s.radius,
    boxShadow: s.shadow ? shadow ? `${shadow.inset ? 'inset ' : ''}${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color}` : '0 8px 28px #27342b16' : undefined,
    fontStyle: s.fontStyle, textDecoration: s.textDecoration, textTransform: s.textTransform,
    filter: s.blur ? `blur(${s.blur}px)` : undefined,
    backdropFilter: s.backdropBlur ? `blur(${s.backdropBlur}px)` : undefined,
    '--node-accent': s.accent ?? '#D4A373',
    '--node-padding': s.padding?.enabled ? `${s.padding.top}px ${s.padding.right}px ${s.padding.bottom}px ${s.padding.left}px` : undefined,
    '--node-text-align': s.verticalAlign === 'center' ? 'center' : s.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
  } as CSSProperties;
}

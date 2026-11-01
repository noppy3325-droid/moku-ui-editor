import { useSyncExternalStore } from 'react';

type OfflineState = { online: boolean; ready: boolean; updating: boolean; available: boolean; supported: boolean; error: boolean };
let state: OfflineState = { online: typeof navigator === 'undefined' || navigator.onLine, ready: false, updating: false, available: false, supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator, error: false };
const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | undefined;
let refreshing = false;
function update(patch: Partial<OfflineState>) { state = { ...state, ...patch }; listeners.forEach(listener => listener()); }
export function useOffline() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state); }
export async function initializeOffline() {
  window.addEventListener('online', () => update({ online: true }));
  window.addEventListener('offline', () => update({ online: false }));
  if (!state.supported || !import.meta.env.PROD) return;
  try {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    update({ ready: Boolean(registration.active), available: Boolean(registration.waiting) });
    registration.addEventListener('updatefound', () => {
      const worker = registration!.installing;
      update({ updating: true });
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') update({ ready: !navigator.serviceWorker.controller || state.ready, available: Boolean(navigator.serviceWorker.controller), updating: false });
        if (worker.state === 'redundant') update({ updating: false });
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { update({ ready: true }); if (refreshing) window.location.reload(); });
    await navigator.serviceWorker.ready;
    update({ ready: true });
  } catch { update({ error: true, updating: false }); }
}
export function applyOfflineUpdate() { if (!registration?.waiting) return; refreshing = true; registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' }); }

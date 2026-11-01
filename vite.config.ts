import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlineWorkerSource } from './build/offline-worker';

export default defineConfig({
  build: { rollupOptions: { output: { manualChunks(id) {
    if (id.includes('/node_modules/zod/')) return 'validation';
    if (id.includes('/node_modules/dexie/')) return 'local-storage';
  } } } },
  plugins: [react(), {
  name: 'moku-offline-shell',
  apply: 'build',
  generateBundle(_options, bundle) {
    const files = Object.keys(bundle).filter(name => !name.endsWith('.map'));
    // Every release also refreshes un-hashed public assets and the HTML shell.
    const version = Date.now().toString(36) + '-' + (files.join('|').split('').reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0).toString(16);
    const paths = ['/index.html', '/favicon.svg', '/assets/mountain.jpg', '/assets/forest.jpg', ...files.map(name => '/' + name)];
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: offlineWorkerSource(version, paths) });
  },
}] });

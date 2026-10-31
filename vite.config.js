import { defineConfig } from 'vite';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

// Polyfork's licence lets a game *contain* its models, but hosting the files
// on our own server, where anyone can download them, counts as
// redistribution. So a production build loads the models from Polyfork's
// public CDN (CORS-open, free low-poly assets) and does not copy them into
// dist. Set VITE_SELF_HOST_MODELS=1 only with Polyfork's written OK.
const selfHost = process.env.VITE_SELF_HOST_MODELS === '1';

export default defineConfig({
  base: './', // works at any path: a domain root or GitHub Pages /scary-island/
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 5000, // Rapier's WASM is inlined (~4 MB)
  },
  plugins: [{
    name: 'drop-local-models',
    apply: 'build',
    closeBundle() {
      if (!selfHost) rmSync(resolve('dist/assets/polyfork'), { recursive: true, force: true });
    },
  }],
});

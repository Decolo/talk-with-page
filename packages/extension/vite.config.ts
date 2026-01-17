import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, cpSync, mkdirSync } from 'fs';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'content/content-script': resolve(__dirname, 'src/content/content-script.ts'),
        'popup/popup': resolve(__dirname, 'src/popup/popup.ts'),
        'offscreen/offscreen': resolve(__dirname, 'src/offscreen/offscreen.ts'),
        'side-panel/side-panel': resolve(__dirname, 'src/side-panel/side-panel.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'shared/[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    {
      name: 'copy-extension-files',
      closeBundle() {
        // Copy manifest.json
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        );
        // Copy popup html/css
        copyFileSync(
          resolve(__dirname, 'popup/popup.html'),
          resolve(__dirname, 'dist/popup/popup.html')
        );
        copyFileSync(
          resolve(__dirname, 'popup/popup.css'),
          resolve(__dirname, 'dist/popup/popup.css')
        );
        // Copy side-panel html/css
        mkdirSync(resolve(__dirname, 'dist/side-panel'), { recursive: true });
        copyFileSync(
          resolve(__dirname, 'side-panel/side-panel.html'),
          resolve(__dirname, 'dist/side-panel/side-panel.html')
        );
        copyFileSync(
          resolve(__dirname, 'side-panel/side-panel.css'),
          resolve(__dirname, 'dist/side-panel/side-panel.css')
        );
        // Copy offscreen html
        mkdirSync(resolve(__dirname, 'dist/offscreen'), { recursive: true });
        copyFileSync(
          resolve(__dirname, 'src/offscreen/offscreen.html'),
          resolve(__dirname, 'dist/offscreen/offscreen.html')
        );
        // Copy assets
        mkdirSync(resolve(__dirname, 'dist/assets'), { recursive: true });
        cpSync(
          resolve(__dirname, 'assets'),
          resolve(__dirname, 'dist/assets'),
          { recursive: true }
        );
      },
    },
  ],
});

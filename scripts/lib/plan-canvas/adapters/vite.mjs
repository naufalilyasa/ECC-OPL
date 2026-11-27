// Vite adapter: injects the Plan Canvas annotation SDK into the dev server's
// HTML only. `apply: 'serve'` keeps it out of `vite build`, so the SDK is never
// a production dependency and never ships in the bundle.

const DEFAULT_CANVAS_URL = 'http://127.0.0.1:4517';

export function planCanvasAnnotations({ canvasUrl = process.env.ECC_PLAN_CANVAS_URL || DEFAULT_CANVAS_URL, enabled = true } = {}) {
  const src = String(canvasUrl).replace(/\/+$/, '') + '/sdk.js';
  return {
    name: 'ecc-plan-canvas-annotations',
    apply: 'serve',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!enabled || html.includes(src)) return html;
        return {
          html,
          tags: [{ tag: 'script', attrs: { src, defer: true }, injectTo: 'body' }]
        };
      }
    }
  };
}

export default planCanvasAnnotations;

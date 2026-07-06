/* Device quality tiering + runtime FPS governor.
   Tier is decided once at boot from cheap signals; the governor then only
   ever steps quality DOWN (never up, to avoid oscillation). Stability is
   the product: a steady 60 on a phone beats a stuttering showcase. */

export function detectQuality() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = matchMedia('(pointer: coarse)').matches;

  let score = 0;
  score += mem >= 8 ? 2 : mem >= 4 ? 1 : 0;
  score += cores >= 8 ? 2 : cores >= 4 ? 1 : 0;
  score += coarse ? 0 : 1;

  // GPU probe: known-weak renderers drop a point, software rasterizers two
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).toLowerCase() : '';
    if (/swiftshader|llvmpipe|software/.test(r)) score -= 2;
    else if (/mali-4|mali-t|adreno [1-4]|powervr/.test(r)) score -= 1;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* probe is best-effort */ }

  const tier = score >= 4 ? 2 : score >= 2 ? 1 : 0;
  return {
    tier,
    stars: [2800, 5600, 9000][tier],
    dust: tier > 0,
    face: tier > 0,           // Matrix face backdrop needs headroom
    dprCap: [1.25, 1.5, 1.75][tier],
    waterSeg: [40, 56, 72][tier],
    snow: [140, 260, 380][tier],
    bubbles: [90, 160, 220][tier],
    rays: [3, 5, 7][tier],
    grainMs: [300, 200, 160][tier],
  };
}

/* Rolling 2s FPS windows; below 44 fps → one downgrade step, then a
   3-window cooldown so a transient spike can't cascade. */
export class Governor {
  constructor(apply, maxStep = 4) {
    this.apply = apply;
    this.maxStep = maxStep;
    this.acc = 0; this.n = 0; this.step = 0; this.cool = 4;
  }
  tick(dt) {
    if (document.hidden) { this.acc = 0; this.n = 0; return; }
    this.acc += dt; this.n++;
    if (this.acc < 2) return;
    const fps = this.n / this.acc;
    this.acc = 0; this.n = 0;
    if (this.cool > 0) { this.cool--; return; }
    if (fps < 44 && this.step < this.maxStep) {
      this.step++;
      this.cool = 3;
      this.apply(this.step);
    }
  }
}

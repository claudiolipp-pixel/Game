// 3D-Renderer (reines WebGL 1, keine Bibliotheken): schräge Kamera, Gelände als texturierte Chunks,
// räumliche Gebäude/Bäume/Autos/Figuren, Sonnenlicht + projizierte Schatten, Punktlichter, Taschenlampe, Nebel.
// Die Spiellogik bleibt 2D: Spiel (x, y) → Welt (x, Höhe, z = y).
import { G } from '../state.js';
import { settings } from '../core/save.js';
import { BUILD } from '../config.js';
import { W, T, CH, chunkAt, ensureChunk, prepareChunk, isTownChunk, getGround, G_FOREST, G_ROAD, G_FLOOR, O_TREE, O_ROCK, O_BUSH, O_BUSH_E, O_WALL, O_WINDOW, O_CRATE, O_CRATE_O, O_CAR, O_CAR_O } from '../world/world.js';
import { PAL, WALLCOL, ROOFCOL } from '../render/sprites.js';
import { lights } from '../render/lighting.js';
import { hash2 } from '../core/rng.js';
import { Z } from '../entities/zombies.js';
import { shots } from '../entities/projectiles.js';
import { parts } from '../entities/fx.js';
import { ST } from '../building/structures.js';
import { weaponDef } from '../systems/combat.js';

export const R3 = { ok: false, yaw: Math.PI / 4, pitch: 0.93, dist: 800, fov: 0.5 };
let gl = null, cv = null, prog = null;
const U = {}, A = {};
const VP = new Float32Array(16), VIEW = new Float32Array(16), PROJ = new Float32Array(16), M = new Float32Array(16), IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const cam = { x: 0, z: 0, ex: 0, ey: 0, ez: 0, ox: 0, oz: 0, psx: 0, psy: 0, pdepth: 0 };
const STRIDE = 12;   // pos3 nor3 col4 uv2
const CS = CH * T;

const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec4 aCol; attribute vec2 aUV;
uniform mat4 uVP; uniform mat4 uM; uniform vec3 uInvS2; uniform vec3 uShear;
varying vec3 vW; varying vec3 vN; varying vec4 vC; varying vec2 vUV;
void main(){
  vec4 w = uM * vec4(aPos, 1.0);
  if (uShear.z > 0.5) { w.x += w.y * uShear.x; w.z += w.y * uShear.y; w.y = 0.2; }
  vW = w.xyz; vN = mat3(uM) * (aNor * uInvS2); vC = aCol; vUV = aUV;
  gl_Position = uVP * w;
}`;
const FS = `
precision highp float;
varying vec3 vW; varying vec3 vN; varying vec4 vC; varying vec2 vUV;
uniform sampler2D uTex; uniform float uTexMix; uniform vec4 uColor; uniform float uAlpha;
uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uAmb;
uniform vec4 uLp[6]; uniform vec3 uLc[6];
uniform vec3 uSpotP; uniform vec3 uSpotD; uniform vec3 uSpot;
uniform vec3 uFogCol; uniform vec3 uFogR; uniform vec2 uCenter;
uniform float uShadow; uniform vec4 uShadowCol; uniform vec4 uFade;
void main(){
  if (uShadow > 0.5) { gl_FragColor = uShadowCol; return; }
  if (vC.a > 0.5 && uFade.z > 0.0) {            // Durchblick auf die Spielfigur (Raster-Ausblendung)
    float d = distance(gl_FragCoord.xy, uFade.xy);
    if (d < uFade.z && gl_FragCoord.z < uFade.w) {
      float cx = floor(gl_FragCoord.x), cy = floor(gl_FragCoord.y);
      if (mod(cx + cy, 2.0) < 1.0 || (d < uFade.z * 0.62 && mod(cx, 2.0) < 1.0)) discard;
    }
  }
  vec3 base = vC.rgb * uColor.rgb;
  if (uTexMix > 0.5) base = texture2D(uTex, vUV).rgb;
  vec3 n = normalize(vN);
  vec3 lit = uAmb * (0.72 + 0.28 * n.y) + uSunCol * max(dot(n, uSun), 0.0);
  for (int i = 0; i < 6; i++) {
    vec3 d = uLp[i].xyz - vW; float a = max(0.0, 1.0 - length(d) / uLp[i].w);
    lit += uLc[i] * a * a * (0.55 + 0.45 * max(dot(n, normalize(d)), 0.0));
  }
  vec3 sd = vW - uSpotP; float sl = length(sd) + 0.001;
  lit += vec3(1.0, 0.95, 0.82) * uSpot.z * smoothstep(uSpot.x, uSpot.x + 0.12, dot(sd / sl, uSpotD)) * max(0.0, 1.0 - sl / uSpot.y);
  lit = min(lit, vec3(1.45));
  vec3 col = mix(base * lit, base, uColor.a);
  float f = smoothstep(uFogR.x, uFogR.y, distance(vW.xz, uCenter)) * uFogR.z;
  gl_FragColor = vec4(mix(col, uFogCol, f), uAlpha);
}`;

// ---------- Mathe ----------
function perspective(o, fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); o.fill(0); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); }
function lookAt(o, ex, ey, ez, cx, cy, cz) {
  let zx = ex - cx, zy = ey - cy, zz = ez - cz; let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xz); xx /= l; xz /= l;          // cross(up, z)
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0; o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
  o[12] = -(xx * ex + xy * ey + xz * ez); o[13] = -(yx * ex + yy * ey + yz * ez); o[14] = -(zx * ex + zy * ey + zz * ez); o[15] = 1;
}
function mul(o, a, b) { for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; }
// Weltpunkt (Spielkoordinaten x,y + Höhe) → Geräte-Pixel (oben links)
export function project(x, y, h, out) {
  const px = x - cam.ox, pz = y - cam.oz;
  const cx = VP[0] * px + VP[4] * h + VP[8] * pz + VP[12], cy = VP[1] * px + VP[5] * h + VP[9] * pz + VP[13], cz = VP[2] * px + VP[6] * h + VP[10] * pz + VP[14], cw = VP[3] * px + VP[7] * h + VP[11] * pz + VP[15];
  out.x = (cx / cw * 0.5 + 0.5) * cv.width; out.y = (1 - (cy / cw * 0.5 + 0.5)) * cv.height; out.z = cz / cw * 0.5 + 0.5;
}
const hex = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

// ---------- Geometrie-Bausteine (schreiben 12 Floats je Vertex in ein Array) ----------
let SPH = null;   // Einheitskugel (Ikosphäre, 80 Dreiecke): Float32Array [x,y,z]*240
function icosphere() {
  const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => { const l = Math.hypot(...p); return p.map(c => c / l); });
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const out = [], mid = (a, b) => { const m = [a[0] + b[0], a[1] + b[1], a[2] + b[2]], l = Math.hypot(...m); return m.map(c => c / l); };
  for (const [a, b, c] of f) { const A_ = v[a], B = v[b], C = v[c], ab = mid(A_, B), bc = mid(B, C), ca = mid(C, A_); for (const tri of [[A_, ab, ca], [B, bc, ab], [C, ca, bc], [ab, bc, ca]]) for (const p of tri) out.push(p[0], p[1], p[2]); }
  return new Float32Array(out);
}
const vtx = (o, x, y, z, nx, ny, nz, c, f, k) => { o.push(x, y, z, nx, ny, nz, c[0] * k, c[1] * k, c[2] * k, f, 0, 0); };
function quad(o, a, b, c, d, n, col, f, k) { for (const p of [a, b, c, a, c, d]) vtx(o, p[0], p[1], p[2], n[0], n[1], n[2], col, f, k === undefined ? 1 : k); }
function box(o, cx, cy, cz, hx, hy, hz, col, f) {
  const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
  quad(o, [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], col, f);
  quad(o, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col, f, 0.92);
  quad(o, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], col, f, 0.92);
  quad(o, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], col, f, 0.96);
  quad(o, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], col, f, 0.96);
}
function sphere(o, cx, cy, cz, rx, ry, rz, col, f, seed, rough) {
  for (let i = 0; i < SPH.length; i += 3) {
    const px = SPH[i], py = SPH[i + 1], pz = SPH[i + 2];
    const q = 1 + (hash2(Math.round(px * 50) + seed, Math.round(py * 50 + pz * 31), 7) - 0.5) * (rough || 0);
    let nx = px / rx, ny = py / ry, nz = pz / rz; const l = Math.hypot(nx, ny, nz);
    const k = (0.78 + 0.3 * hash2(Math.round(px * 40), Math.round(pz * 40 + py * 17), seed)) * (0.82 + 0.18 * py);
    vtx(o, cx + px * rx * q, cy + py * ry * q, cz + pz * rz * q, nx / l, ny / l, nz / l, col, f, k);
  }
}
// verjüngtes n-seitiges Rohr von A nach B (Stämme, Äste, Räder, Masten, Leitungen)
function tube(o, ax, ay, az, bx, by, bz, ra, rb, col, f, n, caps) {
  n = n || 4;
  let dx = bx - ax, dy = by - ay, dz = bz - az; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  let ux = Math.abs(dy) > 0.9 ? 1 : 0, uy = Math.abs(dy) > 0.9 ? 0 : 1, uz = 0;
  let vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux; const m = Math.hypot(vx, vy, vz); vx /= m; vy /= m; vz /= m;
  ux = vy * dz - vz * dy; uy = vz * dx - vx * dz; uz = vx * dy - vy * dx;
  const p = (r, a, X, Y, Z) => { const c = Math.cos(a), s2 = Math.sin(a); return [X + (ux * c + vx * s2) * r, Y + (uy * c + vy * s2) * r, Z + (uz * c + vz * s2) * r]; };
  for (let k = 0; k < n; k++) {
    const a0 = k * 6.2832 / n, a1 = (k + 1) * 6.2832 / n, am = (a0 + a1) / 2, cm = Math.cos(am), sm = Math.sin(am);
    quad(o, p(ra, a0, ax, ay, az), p(ra, a1, ax, ay, az), p(rb, a1, bx, by, bz), p(rb, a0, bx, by, bz), [ux * cm + vx * sm, uy * cm + vy * sm, uz * cm + vz * sm], col, f, 0.85 + 0.15 * ((k * 3) % n) / n);
    if (caps) {
      for (const q of [p(rb, a0, bx, by, bz), p(rb, a1, bx, by, bz), [bx, by, bz]]) vtx(o, q[0], q[1], q[2], dx, dy, dz, col, f, 0.9);
      for (const q of [p(ra, a0, ax, ay, az), p(ra, a1, ax, ay, az), [ax, ay, az]]) vtx(o, q[0], q[1], q[2], -dx, -dy, -dz, col, f, 0.9);
    }
  }
}
const prism = (o, ax, ay, az, bx, by, bz, ra, rb, col, f) => tube(o, ax, ay, az, bx, by, bz, ra, rb, col, f, 5);
function cone(o, cx, y0, cz, r, h, col, f, seed) {
  const n = 9, l = Math.hypot(r, h);
  for (let k = 0; k < n; k++) {
    const a0 = k * 6.2832 / n + seed, a1 = (k + 1) * 6.2832 / n + seed, am = (a0 + a1) / 2, kk = 0.8 + 0.3 * hash2(k, seed * 100 | 0, 5);
    vtx(o, cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r, Math.cos(a0) * h / l, r / l, Math.sin(a0) * h / l, col, f, kk * 0.8);
    vtx(o, cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r, Math.cos(a1) * h / l, r / l, Math.sin(a1) * h / l, col, f, kk * 0.8);
    vtx(o, cx, y0 + h, cz, Math.cos(am) * h / l, r / l, Math.sin(am) * h / l, col, f, kk * 1.1);
  }
}
// Pyramidenstumpf: unten x∈[a0,a1], oben x∈[b0,b1] (relativ zu cx), Tiefe hz0 → hz1
function frustum(o, cx, y0, y1, cz, a0, a1, b0, b1, hz0, hz1, col, f) {
  const P = [[cx + a0, y0, cz - hz0], [cx + a1, y0, cz - hz0], [cx + a1, y0, cz + hz0], [cx + a0, y0, cz + hz0], [cx + b0, y1, cz - hz1], [cx + b1, y1, cz - hz1], [cx + b1, y1, cz + hz1], [cx + b0, y1, cz + hz1]];
  const mid = [cx + (a0 + a1 + b0 + b1) / 4, (y0 + y1) / 2, cz];
  const face = (i, j, k, l) => {
    const A_ = P[i], B = P[j], D = P[l]; let nx = (B[1] - A_[1]) * (D[2] - A_[2]) - (B[2] - A_[2]) * (D[1] - A_[1]), ny = (B[2] - A_[2]) * (D[0] - A_[0]) - (B[0] - A_[0]) * (D[2] - A_[2]), nz = (B[0] - A_[0]) * (D[1] - A_[1]) - (B[1] - A_[1]) * (D[0] - A_[0]);
    const m = Math.hypot(nx, ny, nz) || 1; nx /= m; ny /= m; nz /= m;
    if (nx * (A_[0] - mid[0]) + ny * (A_[1] - mid[1]) + nz * (A_[2] - mid[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    quad(o, P[i], P[j], P[k], P[l], [nx, ny, nz], col, f);
  };
  face(0, 1, 5, 4); face(1, 2, 6, 5); face(2, 3, 7, 6); face(3, 0, 4, 7); face(4, 5, 6, 7);
}
function gable(o, x0, z0, x1, z1, y0, h, col, f) {
  const alongX = (x1 - x0) >= (z1 - z0);
  if (alongX) {
    const zm = (z0 + z1) / 2, run = zm - z0, l = Math.hypot(run, h), ny = run / l, nz = h / l;
    quad(o, [x0, y0, z1], [x1, y0, z1], [x1, y0 + h, zm], [x0, y0 + h, zm], [0, ny, nz], col, f);
    quad(o, [x1, y0, z0], [x0, y0, z0], [x0, y0 + h, zm], [x1, y0 + h, zm], [0, ny, -nz], col, f, 0.9);
    for (const [x, nx] of [[x0, -1], [x1, 1]]) for (const p of [[x, y0, z0], [x, y0, z1], [x, y0 + h, zm]]) vtx(o, p[0], p[1], p[2], nx, 0, 0, col, f, 0.8);
  } else {
    const xm = (x0 + x1) / 2, run = xm - x0, l = Math.hypot(run, h), ny = run / l, nx = h / l;
    quad(o, [x1, y0, z1], [x1, y0, z0], [xm, y0 + h, z0], [xm, y0 + h, z1], [nx, ny, 0], col, f);
    quad(o, [x0, y0, z0], [x0, y0, z1], [xm, y0 + h, z1], [xm, y0 + h, z0], [-nx, ny, 0], col, f, 0.9);
    for (const [z, nz] of [[z0, -1], [z1, 1]]) for (const p of [[x0, y0, z], [x1, y0, z], [xm, y0 + h, z]]) vtx(o, p[0], p[1], p[2], 0, 0, nz, col, f, 0.8);
  }
}

// ---------- GL-Grundlagen ----------
function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function mkBuf(arr) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr instanceof Float32Array ? arr : new Float32Array(arr), gl.STATIC_DRAW); return b; }
function bind(buf) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.vertexAttribPointer(A.aPos, 3, gl.FLOAT, false, STRIDE * 4, 0); gl.vertexAttribPointer(A.aNor, 3, gl.FLOAT, false, STRIDE * 4, 12);
  gl.vertexAttribPointer(A.aCol, 4, gl.FLOAT, false, STRIDE * 4, 24); gl.vertexAttribPointer(A.aUV, 2, gl.FLOAT, false, STRIDE * 4, 40);
}
let bufSphere, bufBox, bufQuad, whiteTex;
const WHITE = [1, 1, 1];

export function init3d(overlay) {
  if (!settings.gfx3d) return false;
  try {
    cv = document.createElement('canvas'); cv.id = 'gl';
    gl = cv.getContext('webgl', { antialias: (window.devicePixelRatio || 1) < 2, stencil: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    prog = gl.createProgram(); gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    for (const n of ['uVP', 'uM', 'uInvS2', 'uShear', 'uTex', 'uTexMix', 'uColor', 'uAlpha', 'uSun', 'uSunCol', 'uAmb', 'uLp', 'uLc', 'uSpotP', 'uSpotD', 'uSpot', 'uFogCol', 'uFogR', 'uCenter', 'uShadow', 'uShadowCol', 'uFade']) U[n] = gl.getUniformLocation(prog, n);
    for (const n of ['aPos', 'aNor', 'aCol', 'aUV']) { A[n] = gl.getAttribLocation(prog, n); gl.enableVertexAttribArray(A[n]); }
    SPH = icosphere();
    let o = []; sphere(o, 0, 0, 0, 1, 1, 1, WHITE, 0, 1, 0); for (let i = 6; i < o.length; i += STRIDE) { o[i] = o[i + 1] = o[i + 2] = 0.8 + 0.2 * o[i - 5]; } bufSphere = mkBuf(o);
    o = []; box(o, 0, 0, 0, 1, 1, 1, WHITE, 0); bufBox = mkBuf(o);
    o = []; for (const p of [[0, 0], [0, 1], [1, 1], [0, 0], [1, 1], [1, 0]]) o.push(p[0] * CS, 0, p[1] * CS, 0, 1, 0, 1, 1, 1, 0, p[0], p[1]); bufQuad = mkBuf(o);
    whiteTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, whiteTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.uniform1i(U.uTex, 0);
    overlay.parentNode.insertBefore(cv, overlay);
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); location.reload(); });
    R3.ok = true; W.mode3d = true; G.cam = { yaw: R3.yaw, sinP: Math.sin(R3.pitch) };
    document.body.classList.add('g3d');
    return true;
  } catch (e) { console.warn('WebGL nicht verfügbar, 2D-Darstellung aktiv:', e.message); gl = null; return false; }
}
export function resize3d(w, h) { if (!R3.ok) return; cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }

// ---------- Chunk-Meshes ----------
const recs = new Map();
let frame = 0;
function rec(c) {
  const k = c.cx * 65536 + c.cy; let r = recs.get(k);
  if (!r) { r = { tex: null, ver: -2, vbo: null, n: 0, bvbo: null, bn: 0, cvbo: null, cn: 0, frame: 0, c: null }; recs.set(k, r); }
  return r;
}
function setBuf(r, key, nkey, arr) {
  if (r[key]) { gl.deleteBuffer(r[key]); r[key] = null; }
  r[nkey] = arr.length / STRIDE; if (arr.length) r[key] = mkBuf(arr);
}
function tree(o, x, z, s, pal, seed, pine) {
  const h1 = hash2(seed, 3, 11), h2 = hash2(seed, 5, 13), sc = 0.85 + h1 * 0.4, bark = s === 3 ? [0.17, 0.15, 0.19] : [0.24, 0.19, 0.14];
  if (pine) {        // Nadelbaum: bleibt im Winter grün, mit Schnee auf den Zweigen
    const g = s === 3 ? [0.2, 0.3, 0.27] : s === 2 ? [0.17, 0.27, 0.16] : [0.14, 0.27, 0.15], hh = 1 + h2 * 0.35;
    tube(o, x, 0, z, x, 16 * sc * hh, z, 2.6, 2, bark, 1, 5);
    for (let k = 0; k < 4; k++) {
      const y = (9 + k * 12) * sc * hh, r = (17 - k * 3.6) * sc;
      cone(o, x, y, z, r, 19 * sc * hh, g, 1, h1 * 6 + k);
      if (s === 3) cone(o, x, y + 6 * sc * hh, z, r * 0.74, 13.5 * sc * hh, [0.86, 0.89, 0.96], 1, h1 * 6 + k + 0.3);
    }
    return;
  }
  if (s === 3) {     // kahl
    const th = 26 * sc; prism(o, x, 0, z, x + (h2 - 0.5) * 4, th, z, 3.4, 2.2, bark, 1);
    const br = (ax, ay, az, ang, tilt, len, r, d) => {
      const bx = ax + Math.cos(ang) * Math.cos(tilt) * len, by = ay + Math.sin(tilt) * len, bz = az + Math.sin(ang) * Math.cos(tilt) * len;
      tube(o, ax, ay, az, bx, by, bz, r, r * 0.55, bark, 1, 4);
      if (d > 0) for (let i = 0; i < 2; i++) br(bx, by, bz, ang + (i ? 0.7 : -0.6) + (hash2(seed + d * 7, i, 17) - 0.5), tilt * 0.75 + 0.15, len * 0.68, r * 0.55, d - 1);
    };
    for (let i = 0; i < 4; i++) br(x + (h2 - 0.5) * 4, th * (0.75 + i * 0.08), z, i * 1.6 + h1 * 6, 0.75 - i * 0.08, 17 * sc, 1.9, 2);
    return;
  }
  prism(o, x, 0, z, x + (h2 - 0.5) * 3, 24 * sc, z, 3.3, 2.1, bark, 1);
  tube(o, x, 15 * sc, z, x + (h1 - 0.5) * 14, 27 * sc, z + (h2 - 0.5) * 14, 1.6, 1, bark, 1, 4);
  const c1 = hex(pal.tree), c2 = hex(pal.treeB), c3 = c1.map((v, i) => v * (i === 1 ? 1.12 : 1.02));
  sphere(o, x, 34 * sc, z, 15 * sc, 12.5 * sc, 15 * sc, c1, 1, seed, 0.3);
  sphere(o, x + (h1 - 0.5) * 20, 28 * sc, z + (h2 - 0.5) * 20, 11 * sc, 9 * sc, 11 * sc, c2, 1, seed + 1, 0.32);
  sphere(o, x - (h2 - 0.5) * 18, 30 * sc, z + (h1 - 0.5) * 16, 10 * sc, 8.5 * sc, 10 * sc, c2, 1, seed + 3, 0.32);
  sphere(o, x - (h1 - 0.5) * 10, 42 * sc, z - (h2 - 0.5) * 12, 9.5 * sc, 8 * sc, 9.5 * sc, c3, 1, seed + 2, 0.32);
}
function car(o, x, z, s, v) {
  const col = [[0.36, 0.17, 0.15], [0.22, 0.27, 0.32], [0.42, 0.42, 0.36]][v], dk = col.map(c => c * 0.7), glass = [0.07, 0.1, 0.14], chrome = [0.5, 0.52, 0.55];
  box(o, x, 8.5, z, 29, 4.5, 12, col, 0);                                       // Karosserie
  box(o, x, 5, z, 29.6, 1.4, 12.4, dk, 0);                                      // Schweller
  frustum(o, x - 3, 13, 21, z, -17, 15, -12, 9, 11.4, 9.6, glass, 0);           // Kabine mit schrägen Scheiben
  box(o, x - 4.5, 21.5, z, 10.8, 0.8, 9.9, col.map(c => c * 1.12), 0);          // Dach
  for (const px of [-15, -4.5, 6]) { box(o, x + px, 17, z - 10.4, 0.9, 4, 0.5, col, 0); box(o, x + px, 17, z + 10.4, 0.9, 4, 0.5, col, 0); }   // Säulen
  for (const wx of [-19, 19]) for (const wz of [-10.8, 10.8]) { tube(o, x + wx, 5.6, z + wz - 2.3, x + wx, 5.6, z + wz + 2.3, 5.6, 5.6, [0.05, 0.05, 0.06], 0, 10, true); tube(o, x + wx, 5.6, z + wz + (wz > 0 ? 2.3 : -2.5), x + wx, 5.6, z + wz + (wz > 0 ? 2.5 : -2.3), 2.6, 2.6, chrome, 0, 8, true); }
  box(o, x + 30, 6.5, z, 1, 1.6, 12.2, chrome, 0); box(o, x - 30, 6.5, z, 1, 1.6, 12.2, chrome, 0);                    // Stoßstangen
  box(o, x + 29.4, 10.5, z - 8, 0.5, 1.5, 2.4, [0.8, 0.77, 0.6], 0); box(o, x + 29.4, 10.5, z + 8, 0.5, 1.5, 2.4, [0.8, 0.77, 0.6], 0);
  box(o, x - 29.4, 10.5, z - 8.5, 0.5, 1.3, 2, [0.5, 0.1, 0.1], 0); box(o, x - 29.4, 10.5, z + 8.5, 0.5, 1.3, 2, [0.5, 0.1, 0.1], 0);
  if (s === 3) { box(o, x - 4.5, 23.1, z, 10.4, 1.3, 9.5, [0.9, 0.92, 0.97], 0); box(o, x + 21, 13.6, z, 7.5, 0.8, 11.4, [0.88, 0.9, 0.96], 0); box(o, x - 25, 13.6, z, 4, 0.8, 11.4, [0.88, 0.9, 0.96], 0); }
}
// Strommast mit Leitungen zum nächsten Mast (Osten/Süden)
function pole(o, x, z, east, south) {
  const wood = [0.2, 0.16, 0.12];
  tube(o, x, 0, z, x, 74, z, 2, 1.5, wood, 1, 6);
  box(o, x, 66, z, 9, 0.9, 0.9, wood, 1); box(o, x, 60, z, 0.9, 0.9, 7, wood, 1);
  for (const dx of [-8, 0, 8]) box(o, x + dx, 67.6, z, 0.8, 1, 0.8, [0.6, 0.62, 0.6], 1);
  const wire = (tx, tz, off, perpX) => { let px = x + (perpX ? off : 0), pz = z + (perpX ? 0 : off), py = 67; for (let k = 1; k <= 5; k++) { const t = k / 5, nx = x + (tx - x) * t + (perpX ? off : 0), nz = z + (tz - z) * t + (perpX ? 0 : off), ny = 67 - Math.sin(t * Math.PI) * 9; tube(o, px, py, pz, nx, ny, nz, 0.32, 0.32, [0.06, 0.06, 0.07], 0, 3); px = nx; py = ny; pz = nz; } };
  if (east) for (const off of [-7, 7]) wire(x + CS, z, off, false);
  if (south) for (const off of [-7, 7]) wire(x, z + CS, off, true);
}
const WALL_H = 44;
function buildChunk(c, r) {
  const s = W.season, pal = PAL[s], o = [], bo = [], co = [];
  const type = c.bld ? c.bld.type : 'house', wc = hex(WALLCOL[type]), wc2 = wc.map(v => v * 0.82), trim = wc.map(v => Math.min(1, v * 0.55 + 0.34)), plinth = [0.26, 0.26, 0.27], glass = [0.13, 0.2, 0.26];
  for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
    const i = lx + ly * CH, ob = c.o[i]; if (!ob) continue;
    const x = lx * T + 16, z = ly * T + 16, seed = (c.cx * CH + lx) * 131 + (c.cy * CH + ly) * 17;
    switch (ob) {
      case O_TREE: tree(o, x, z, s, pal, seed, c.g[i] === G_FOREST ? hash2(seed, 9, 2) < 0.45 : hash2(seed, 9, 2) < 0.12); break;
      case O_ROCK: sphere(o, x, 4, z, 11 + hash2(seed, 1, 3) * 4, 7 + hash2(seed, 2, 3) * 3, 9 + hash2(seed, 3, 3) * 3, s === 3 ? [0.74, 0.77, 0.84] : [0.46, 0.47, 0.44], 0, seed, 0.35); break;
      case O_BUSH: case O_BUSH_E: {
        sphere(o, x, 6, z, 12, 8.5, 12, hex(pal.bush), 0, seed, 0.3);
        if (ob === O_BUSH && s !== 3) for (let k = 0; k < 5; k++) { const a = k * 1.3 + seed; box(o, x + Math.cos(a) * 8, 9 + (k % 3) * 2, z + Math.sin(a) * 8, 1.2, 1.2, 1.2, [0.6, 0.1, 0.2], 0); }
        break;
      }
      case O_CRATE: box(o, x, 8, z, 10, 8, 10, [0.5, 0.36, 0.2], 0); box(o, x, 16.4, z, 10.6, 0.8, 10.6, [0.58, 0.43, 0.25], 0); box(o, x, 11, z + 10.2, 2, 2.4, 0.5, [0.85, 0.7, 0.3], 0); break;
      case O_CRATE_O: box(o, x, 5, z, 10, 5, 10, [0.26, 0.19, 0.12], 0); break;
      case O_CAR: case O_CAR_O: car(o, x + 16, z, s, (((lx + c.cx * 7 + c.cy * 3) % 3) + 3) % 3); break;
      case O_WALL: case O_WINDOW: {
        const bd = c.bld, corner = bd && (lx === bd.x - c.cx * CH || lx === bd.x + bd.w - 1 - c.cx * CH) && (ly === bd.y - c.cy * CH || ly === bd.y + bd.h - 1 - c.cy * CH);
        box(bo, x, 2.2, z, 16.7, 2.2, 16.7, plinth, 1); box(co, x, 3.5, z, 16, 3.5, 16, wc, 0);
        if (ob === O_WALL) { if (corner) box(bo, x, WALL_H / 2, z, 16.5, WALL_H / 2, 16.5, trim, 1); else { box(bo, x, WALL_H / 2, z, 16, WALL_H / 2, 16, wc, 1); for (let k = 0; k < 4; k++) box(bo, x, 9 + k * 9, z, 16.25, 0.5, 16.25, wc2, 1); } }
        else {
          box(bo, x, 8, z, 16, 8, 16, wc, 1); box(bo, x, 23, z, 15.3, 7, 15.3, glass, 1); box(bo, x, 37, z, 16, 7, 16, wc, 1);
          box(bo, x, 15.6, z, 17, 0.9, 17, trim, 1); box(bo, x, 30.4, z, 16.6, 0.7, 16.6, trim, 1); box(bo, x, 23, z, 15.6, 7, 0.9, trim, 1); box(bo, x, 23, z, 0.9, 7, 15.6, trim, 1);
        }
        break;
      }
    }
  }
  if (c.bld) {
    const b = c.bld, lx0 = b.x - c.cx * CH, ly0 = b.y - c.cy * CH, x0 = lx0 * T, z0 = ly0 * T, rc = s === 3 ? [0.82, 0.85, 0.92] : hex(ROOFCOL[type]);
    const rh = 20 + Math.min(b.w, b.h) * 1.6, X1 = x0 + b.w * T, Z1 = z0 + b.h * T, alongX = b.w >= b.h;
    gable(bo, x0 - 7, z0 - 7, X1 + 7, Z1 + 7, WALL_H, rh, rc, 1);
    box(bo, (x0 + X1) / 2, WALL_H + 0.6, (z0 + Z1) / 2, b.w * T * 0.5 + 7, 0.8, b.h * T * 0.5 + 7, rc.map(v => v * 0.6), 1);
    if (alongX) box(bo, (x0 + X1) / 2, WALL_H + rh, (z0 + Z1) / 2, b.w * T * 0.5 + 7.5, 1, 1.6, rc.map(v => v * 0.7), 1); else box(bo, (x0 + X1) / 2, WALL_H + rh, (z0 + Z1) / 2, 1.6, 1, b.h * T * 0.5 + 7.5, rc.map(v => v * 0.7), 1);
    if (type === 'house' || type === 'farm') { const cxm = alongX ? x0 + b.w * T * 0.28 : (x0 + X1) / 2 + 9, czm = alongX ? (z0 + Z1) / 2 + 9 : z0 + b.h * T * 0.28; box(bo, cxm, WALL_H + rh * 0.9, czm, 5, rh * 0.42, 5, [0.36, 0.2, 0.17], 1); box(bo, cxm, WALL_H + rh * 1.33, czm, 5.8, 1, 5.8, [0.2, 0.2, 0.2], 1); }
    // Türen: Sturz über der Öffnung, Rahmen, offenes Türblatt, Stufe
    for (let ly = ly0; ly < ly0 + b.h; ly++) for (let lx = lx0; lx < lx0 + b.w; lx++) {
      const edgeX = lx === lx0 || lx === lx0 + b.w - 1, edgeY = ly === ly0 || ly === ly0 + b.h - 1;
      if (!(edgeX || edgeY) || c.o[lx + ly * CH] === O_WALL || c.o[lx + ly * CH] === O_WINDOW) continue;
      const x = lx * T + 16, z = ly * T + 16, horiz = edgeY && !edgeX || (edgeY && ly !== ly0 && ly !== ly0 + b.h - 1 ? false : edgeY);
      box(bo, x, 40, z, 16, 4, 16, wc, 1); box(co, x, 0.6, z, 16, 0.6, 16, plinth, 0);
      if (horiz) { box(bo, x - 15, 18, z, 1.2, 18, 16.4, trim, 1); box(bo, x + 15, 18, z, 1.2, 18, 16.4, trim, 1); const out = ly === ly0 ? -1 : 1; box(bo, x - 13, 18, z + out * 28, 1, 17.5, 13, [0.3, 0.2, 0.12], 0); box(o, x, 1, z + out * 20, 13, 1, 4, plinth, 0); }
      else { box(bo, x, 18, z - 15, 16.4, 18, 1.2, trim, 1); box(bo, x, 18, z + 15, 16.4, 18, 1.2, trim, 1); const out = lx === lx0 ? -1 : 1; box(bo, x + out * 28, 18, z - 13, 13, 17.5, 1, [0.3, 0.2, 0.12], 0); box(o, x + out * 20, 1, z, 4, 1, 13, plinth, 0); }
    }
  }
  if (c.g[0] === G_ROAD && isTownChunk(c.cx, c.cy)) pole(o, 27, 27, isTownChunk(c.cx + 1, c.cy), isTownChunk(c.cx, c.cy + 1));
  setBuf(r, 'vbo', 'n', o); setBuf(r, 'bvbo', 'bn', bo); setBuf(r, 'cvbo', 'cn', co);
  if (!r.tex) { r.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, r.tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); }
  gl.bindTexture(gl.TEXTURE_2D, r.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, c.canvas); gl.generateMipmap(gl.TEXTURE_2D);
  r.ver = W.season; r.c = c;
}
function gcRecs() {
  for (const [k, r] of recs) if (frame - r.frame > 240) { if (r.tex) gl.deleteTexture(r.tex); for (const b of ['vbo', 'bvbo', 'cvbo']) if (r[b]) gl.deleteBuffer(r[b]); recs.delete(k); }
}

// ---------- dynamische Teile (Instanzlisten: Box + Kugel) ----------
const MAXI = 5200, IS = 12;      // x,y,z, yaw, sx,sy,sz, r,g,b, emissiv, Schatten(0/1)
const iBox = new Float32Array(MAXI * IS), iSph = new Float32Array(MAXI * IS); let nBox = 0, nSph = 0;
function part(sph, x, y, z, yaw, sx, sy, sz, r, g, b, em, sh) {
  const a = sph ? iSph : iBox; let n = sph ? nSph : nBox; if (n >= MAXI) return;
  const i = n * IS; a[i] = x - cam.ox; a[i + 1] = y; a[i + 2] = z - cam.oz; a[i + 3] = yaw; a[i + 4] = sx; a[i + 5] = sy; a[i + 6] = sz; a[i + 7] = r; a[i + 8] = g; a[i + 9] = b; a[i + 10] = em; a[i + 11] = sh;
  if (sph) nSph++; else nBox++;
}
// Teil relativ zur Figur: vor (f), seitlich (l), Höhe (h)
function rel(sph, e, f, l, h, sx, sy, sz, r, g, b, sc, sh) {
  const ca = Math.cos(e.a), sa = Math.sin(e.a);
  part(sph, e.x + (ca * f - sa * l) * sc, h * sc, e.y + (sa * f + ca * l) * sc, e.a, sx * sc, sy * sc, sz * sc, r, g, b, 0, sh === undefined ? 1 : sh);
}
const E = { x: 0, y: 0, a: 0 };
function humanoid(x, y, ang, sc, body, skin, pants, hair, zombie, phase, moving, flat) {
  E.x = x; E.y = y; E.a = ang;
  const sw = moving ? Math.sin(phase) : 0, hy = flat ? 0.45 : 1;
  rel(1, E, sw * 3.6, -3, 6 * hy, 2.7, 6.2 * hy, 2.7, pants[0], pants[1], pants[2], sc);
  rel(1, E, -sw * 3.6, 3, 6 * hy, 2.7, 6.2 * hy, 2.7, pants[0], pants[1], pants[2], sc);
  rel(1, E, flat ? 4 : 0, 0, 16 * hy, flat ? 8 : 4.3, 6.6 * hy, 6.2, body[0], body[1], body[2], sc);
  rel(1, E, flat ? 12 : 0.6, 0, 25.2 * hy, 3.9, 3.9 * (flat ? 0.8 : 1), 3.7, skin[0], skin[1], skin[2], sc);
  rel(1, E, flat ? 11 : -0.7, 0, 26.6 * hy, 3.5, 3 * (flat ? 0.8 : 1), 3.6, hair[0], hair[1], hair[2], sc, 0);
  rel(1, E, sw * 3.6 + 1.6, -3, 1.3, 3.2, 1.4, 2, 0.08, 0.07, 0.07, sc, 0); rel(1, E, -sw * 3.6 + 1.6, 3, 1.3, 3.2, 1.4, 2, 0.08, 0.07, 0.07, sc, 0);     // Schuhe
  if (zombie) {
    rel(1, E, 6 + sw, -6.4, 19 * hy, 5.6, 2, 2, body[0], body[1], body[2], sc, 0); rel(1, E, 12.5 + sw, -6.4, 19 * hy, 2.3, 1.7, 1.9, skin[0], skin[1], skin[2], sc, 0);
    rel(1, E, 6 - sw, 6.4, 18 * hy, 5.6, 2, 2, body[0], body[1], body[2], sc, 0); rel(1, E, 12.5 - sw, 6.4, 18 * hy, 2.3, 1.7, 1.9, skin[0], skin[1], skin[2], sc, 0);
    rel(1, E, 1.5, 1.5, 13 * hy, 3.6, 3, 4.6, 0.3, 0.07, 0.06, sc, 0);                                                                                       // Blutfleck
  } else {
    rel(1, E, 3.5 - sw * 2, -7, 16, 3.6, 5, 2, body[0], body[1], body[2], sc, 0);
    rel(1, E, 4.5 + sw * 2, 7, 16.5, 4.6, 4.2, 2, body[0], body[1], body[2], sc, 0);
    rel(1, E, 6.5 - sw * 2.4, -7, 12.6, 1.7, 1.7, 1.7, skin[0], skin[1], skin[2], sc, 0); rel(1, E, 9 + sw * 2.4, 7, 15.4, 1.7, 1.7, 1.7, skin[0], skin[1], skin[2], sc, 0);
    rel(0, E, -5.4, 0, 16.5, 2.2, 5, 4.4, 0.33, 0.27, 0.18, sc, 0);       // Rucksack
  }
}
const ZC = {
  walker: [[0.33, 0.34, 0.27], [0.5, 0.55, 0.42]], runner: [[0.42, 0.31, 0.21], [0.6, 0.54, 0.4]], crawler: [[0.22, 0.24, 0.2], [0.35, 0.38, 0.3]],
  screamer: [[0.54, 0.54, 0.53], [0.66, 0.67, 0.64]], brute: [[0.3, 0.2, 0.2], [0.53, 0.38, 0.35]],
};
const FROST = [[0.42, 0.52, 0.6], [0.66, 0.77, 0.82]], ZPANTS = [0.17, 0.16, 0.15], ZHAIR = [0.15, 0.13, 0.1];
// Bauwerke: Liste von Teilen [Kugel?, f, l, h, sx, sy, sz, r, g, b, emissiv, dreht mit Kopf?]
const WOOD = [0.48, 0.34, 0.2], WOODD = [0.33, 0.23, 0.13], STONE = [0.5, 0.51, 0.53], MET = [0.4, 0.42, 0.45], DARK = [0.14, 0.14, 0.15];
const P = (s, f, l, h, sx, sy, sz, c, em, head) => [s, f, l, h, sx, sy, sz, c[0], c[1], c[2], em || 0, head || 0];
const SM = {
  wall_w: [P(0, 0, 0, 20, 16, 20, 16, WOOD), P(0, 0, 0, 40.6, 16.4, 0.8, 16.4, WOODD)],
  wall_s: [P(0, 0, 0, 22, 16, 22, 16, STONE)],
  door: [P(0, 0, 0, 20, 16, 20, 3, WOODD), P(0, 9, 3.4, 18, 1.2, 1.2, 0.8, [0.9, 0.75, 0.3])],
  barricade: [P(0, 0, 0, 7, 15, 2.2, 3, WOOD), P(0, 0, 0, 15, 15, 2.2, 3, WOODD), P(0, -9, 0, 11, 2.4, 11, 3.4, WOOD), P(0, 9, 0, 11, 2.4, 11, 3.4, WOOD)],
  campfire: [P(1, 0, 0, 1.5, 11, 2.5, 11, STONE), P(0, 0, 0, 3, 7, 1.5, 2, WOODD), P(0, 0, 0, 3, 2, 1.5, 7, WOODD), P(1, 0, 0, 7.5, 4.6, 6.5, 4.6, [1, 0.55, 0.12], 1)],
  collector: [P(0, 0, 0, 7, 12, 7, 12, WOOD), P(0, 0, 0, 14.2, 10, 0.5, 10, [0.22, 0.45, 0.62])],
  plot: [P(0, 0, 0, 2, 15, 2, 15, [0.24, 0.16, 0.09]), P(0, 0, -15, 3, 15, 3, 1, WOOD), P(0, 0, 15, 3, 15, 3, 1, WOOD), P(0, -15, 0, 3, 1, 3, 15, WOOD), P(0, 15, 0, 3, 1, 3, 15, WOOD)],
  chest: [P(0, 0, 0, 7, 12, 7, 8.5, WOOD), P(0, 0, 0, 14.6, 12.5, 1, 9, WOODD), P(0, 0, 8.7, 9, 1.6, 2, 0.5, [0.9, 0.75, 0.3])],
  bed: [P(0, 0, 0, 3, 14, 3, 9, WOODD), P(0, 2, 0, 6.6, 11, 1.2, 8.4, [0.55, 0.16, 0.16]), P(0, -11, 0, 7.2, 3, 1.5, 7, [0.88, 0.88, 0.84])],
  spikes: [P(0, 0, 0, 0.6, 14, 0.6, 14, [0.12, 0.09, 0.06]), P(0, -7, -7, 5, 0.9, 5, 0.9, [0.8, 0.74, 0.6]), P(0, 7, -7, 5, 0.9, 5, 0.9, [0.8, 0.74, 0.6]), P(0, -7, 7, 5, 0.9, 5, 0.9, [0.8, 0.74, 0.6]), P(0, 7, 7, 5, 0.9, 5, 0.9, [0.8, 0.74, 0.6]), P(0, 0, 0, 5, 0.9, 5, 0.9, [0.8, 0.74, 0.6])],
  beartrap: [P(0, 0, 0, 1.2, 8, 1.2, 8, MET), P(0, 0, 0, 2.6, 6.5, 1.6, 0.8, [0.7, 0.7, 0.72])],
  wire: [P(0, -14, 0, 7, 1.4, 7, 1.4, WOODD), P(0, 14, 0, 7, 1.4, 7, 1.4, WOODD), P(0, 0, 0, 4, 14, 0.5, 0.5, MET), P(0, 0, 0, 9, 14, 0.5, 0.5, MET), P(0, 0, 3, 6.5, 14, 0.5, 0.5, MET)],
  tripwire: [P(0, -13, 0, 4, 1.2, 4, 1.2, WOODD), P(0, 13, 0, 4, 1.2, 4, 1.2, WOODD), P(0, 0, 0, 5, 13, 0.25, 0.25, [0.8, 0.8, 0.8]), P(0, -4, 0, 3.4, 1.4, 1.8, 1.4, [0.7, 0.2, 0.2])],
  lure: [P(0, 0, 0, 5, 4, 5, 4, DARK), P(1, 0, 0, 11, 2.4, 1.6, 2.4, [0.9, 0.8, 0.2])],
  gas: [P(1, 0, 0, 0.4, 13, 0.5, 11, [0.2, 0.19, 0.12])],
  bomb: [P(0, 0, 0, 2.5, 6, 2.5, 2.5, MET), P(0, 5, 0, 3.4, 1, 1.4, 1, [0.7, 0.15, 0.15])],
  spikewall: [P(0, 0, 0, 7, 16, 2.4, 4, WOODD), P(0, -11, 0, 11, 1.3, 11, 1.3, WOOD), P(0, -4, 0, 12, 1.3, 12, 1.3, WOOD), P(0, 4, 0, 12, 1.3, 12, 1.3, WOOD), P(0, 11, 0, 11, 1.3, 11, 1.3, WOOD)],
  xbow: [P(0, 0, 0, 8, 9, 8, 9, WOOD), P(0, 2, 0, 18.5, 11, 1.4, 1.6, WOODD, 0, 1), P(0, 7, 0, 18.5, 1, 1, 10, MET, 0, 1)],
  sgtrap: [P(0, 0, 0, 7, 9, 7, 9, MET), P(0, 9, -2.5, 10, 9, 1.4, 1.4, DARK, 0, 1), P(0, 9, 2.5, 10, 9, 1.4, 1.4, DARK, 0, 1)],
  flamer: [P(0, 0, 0, 8, 9, 8, 9, [0.45, 0.2, 0.2]), P(1, -3, 0, 19, 5, 4, 4, [0.6, 0.25, 0.22], 0, 1), P(0, 8, 0, 18.5, 8, 1.3, 1.3, DARK, 0, 1)],
  mg: [P(1, 0, -12, 5, 15, 5, 5, [0.36, 0.42, 0.28]), P(1, 0, 12, 5, 15, 5, 5, [0.36, 0.42, 0.28]), P(1, 13, 0, 5, 5, 5, 13, [0.36, 0.42, 0.28]), P(0, 6, 0, 13, 13, 1.3, 1.3, DARK, 0, 1), P(0, -2, 0, 12, 3, 3, 3, [0.2, 0.22, 0.2], 0, 1)],
  gen: [P(0, 0, 0, 9, 12, 9, 8, [0.68, 0.52, 0.14]), P(0, -4, 0, 19, 4, 1, 5, DARK), P(0, 9, 0, 21, 1, 3, 1, DARK)],
  fence: [P(0, -14, 0, 18, 1.6, 18, 1.6, MET), P(0, 14, 0, 18, 1.6, 18, 1.6, MET), P(0, 0, 0, 9, 14, 0.5, 0.5, [0.62, 0.68, 0.75]), P(0, 0, 0, 19, 14, 0.5, 0.5, [0.62, 0.68, 0.75]), P(0, 0, 0, 29, 14, 0.5, 0.5, [0.62, 0.68, 0.75])],
};
const LVL = [[1, 1, 1], [0.86, 0.9, 0.96], [0.62, 0.66, 0.74]];
function structure(s) {
  const m = SM[s.id]; if (!m) return;
  const p = G.player, snowy = s.def.trap && W.season === 3 && !settings.markTraps && !(s.fire > 0), lv = LVL[s.lvl - 1];
  const base = (s.def.dir || s.id === 'door' || s.id === 'spikewall' || s.id === 'wire' || s.id === 'tripwire') ? s.rot * Math.PI / 2 : 0;
  const head = s.id === 'mg' && p.mounted === s ? p.ang : s.ang, jx = s.hitT > 0 ? (Math.random() - 0.5) * 2 : 0;
  for (let i = 0; i < m.length; i++) {
    const q = m[i]; let r = q[7] * lv[0], g = q[8] * lv[1], b = q[9] * lv[2], em = q[10];
    if (snowy) { r = r * 0.25 + 0.6; g = g * 0.25 + 0.63; b = b * 0.25 + 0.7; }
    if (s.id === 'campfire' && em) { const fl = 0.85 + Math.random() * 0.3; E.x = s.x; E.y = s.y; E.a = 0; rel(1, E, 0, 0, q[3] * fl, q[4], q[5] * fl, q[6], r, g, b, 1, 0); iSph[(nSph - 1) * IS + 10] = 1; continue; }
    if (s.id === 'lure' && em) em = s.on && (G.tick & 16) ? 1 : 0;
    if (s.id === 'fence' && i >= 2 && s.pow) { r = 0.7; g = 0.85; b = 1; em = (G.tick & 4) ? 1 : 0.4; }
    if (s.id === 'beartrap' && i === 1 && s.shut) continue;
    E.x = s.x + jx; E.y = s.y; E.a = q[11] ? head : base;
    rel(q[0], E, q[1], q[2], q[3], q[4], q[5], q[6], r, g, b, 1, i === 0 ? 1 : 0);
    if (em) (q[0] ? iSph : iBox)[((q[0] ? nSph : nBox) - 1) * IS + 10] = em;
  }
  E.x = s.x; E.y = s.y; E.a = 0;
  if (s.id === 'plot' && s.planted && s.grow > 0.15) for (let k = 0; k < 4; k++) rel(1, E, (k & 1 ? 6 : -6), (k & 2 ? 6 : -6), 4 + s.grow * 4, 2 + s.grow * 3, 2 + s.grow * 4, 2 + s.grow * 3, 0.25, 0.5 + (s.grow >= 1 ? 0.1 : 0), 0.18, 1, 0);
  if (s.id === 'gas' && s.fire > 0) for (let k = 0; k < 3; k++) { rel(1, E, (k - 1) * 9, (k % 2) * 8 - 4, 7 + Math.random() * 4, 6, 8 + Math.random() * 5, 6, 1, 0.5 + k * 0.12, 0.1, 1, 0); iSph[(nSph - 1) * IS + 10] = 1; }
  if (s.def.trap && settings.markTraps) { part(0, s.x, 22, s.y, 0, 1, 4, 1, 1, 0.8, 0, 1, 0); }
}

function collect(alpha) {
  nBox = 0; nSph = 0;
  const p = G.player, e = G.env, R2 = 780 * 780;
  for (let i = 0; i < ST.list.length; i++) { const s = ST.list[i]; if ((s.x - cam.x) * (s.x - cam.x) + (s.y - cam.z) * (s.y - cam.z) < R2) structure(s); }
  for (let i = 0; i < G.drops.length; i++) { const d = G.drops[i]; part(0, d.x, 4, d.y, i, 5, 4, 4, 0.5, 0.38, 0.2, 0, 1); }
  const zl = Z.list;
  for (let i = 0; i < zl.length; i++) {
    const z = zl[i]; if (!z.alive) continue;
    const zx = z.ox + (z.x - z.ox) * alpha, zy = z.oy + (z.y - z.oy) * alpha;
    if ((zx - cam.x) * (zx - cam.x) + (zy - cam.z) * (zy - cam.z) > R2) continue;
    const sc = z.def.sz * (z.flash > 0 ? 1.1 : 1);
    if (z.def.animal) {
      E.x = zx; E.y = zy; E.a = z.ang; const c = z.type === 'deer' ? [0.5, 0.38, 0.25] : [0.66, 0.6, 0.52], ph = (G.tick + i * 9) * 0.35;
      rel(1, E, 0, 0, 13, 10, 5.5, 4.6, c[0], c[1], c[2], sc); rel(1, E, 11, 0, 18, 4, 3.4, 3, c[0] * 0.9, c[1] * 0.9, c[2] * 0.9, sc, 0);
      for (let k = 0; k < 4; k++) rel(0, E, (k & 1 ? 6 : -6) + Math.sin(ph + k * 1.6) * 2, (k & 2 ? 2.6 : -2.6), 4.5, 0.9, 4.5, 0.9, c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, sc, 0);
      continue;
    }
    const zc = z.frost ? FROST : ZC[z.type] || ZC.walker;
    humanoid(zx, zy, z.ang, sc, zc[0], zc[1], ZPANTS, ZHAIR, true, (G.tick + i * 11) * (z.def.sp > 60 ? 0.45 : 0.2), z.holdT <= 0 && z.stunT <= 0, z.type === 'crawler');
    if (z.burnT > 0) { part(1, zx, 18, zy, 0, 5, 9, 5, 1, 0.5, 0.1, 1, 0); }
  }
  if (p.hp > 0) {
    const px = p.ox + (p.x - p.ox) * alpha, py = p.oy + (p.y - p.oy) * alpha;
    humanoid(px, py, p.ang, 1, [0.27, 0.32, 0.36], [0.78, 0.62, 0.48], [0.16, 0.17, 0.2], [0.2, 0.15, 0.1], false, G.tick * (p.sprinting ? 0.5 : 0.3), p.moving, false);
    E.x = px; E.y = py; E.a = p.ang;
    const w = weaponDef(), gun = w.t === 'gun';
    if (w.dur || gun) rel(0, E, gun ? 12 : 10, 7, 16.5, gun ? 7 : 5, gun ? 1.1 : 0.7, gun ? 1.1 : 0.9, gun ? 0.1 : 0.72, gun ? 0.1 : 0.72, gun ? 0.11 : 0.75, 1, 0);
    if (p.swing > 0) { const a = p.ang + (0.5 - p.swing / 0.16) * p.swingArc; part(0, px + Math.cos(a) * (p.swingR - 6), 16, py + Math.sin(a) * (p.swingR - 6), a + 1.57, 8, 0.5, 1.2, 1, 1, 1, 1, 0); }
    if (p.torchT > 0) rel(1, E, 9, -7, 24, 2, 3.4, 2, 1, 0.6, 0.15, 1, 0), iSph[(nSph - 1) * IS + 10] = 1;
  }
  for (let i = 0; i < shots.length; i++) {
    const q = shots[i]; if (!q.on) continue;
    const qx = q.ox + (q.x - q.ox) * alpha, qy = q.oy + (q.y - q.oy) * alpha;
    part(0, qx, 15, qy, Math.atan2(q.vy, q.vx), q.kind === 1 ? 6 : 9, 0.5, 0.5, q.kind === 1 ? 0.8 : 1, q.kind === 1 ? 0.75 : 0.9, q.kind === 1 ? 0.6 : 0.6, q.kind === 1 ? 0.3 : 1, 0);
  }
  for (let i = 0; i < parts.length; i++) {
    const q = parts[i]; if (!q.on) continue;
    const n = parseInt(q.col.length === 4 ? q.col[1] + q.col[1] + q.col[2] + q.col[2] + q.col[3] + q.col[3] : q.col.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    if (q.max >= 5) part(1, q.x, 0.3, q.y, 0, q.sz * 1.6, 0.25, q.sz * 1.3, r, g, b, 0, 0);
    else { const k = q.life / q.max, z = q.sz * (0.2 + 0.25 * k); part(1, q.x, 9 + (1 - k) * 10, q.y, 0, z, z, z, r, g, b, r > 0.8 ? 1 : 0.3, 0); }
  }
}
function drawList(a, n, buf, cnt, shadow) {
  if (!n) return; bind(buf);
  for (let k = 0; k < n; k++) {
    const i = k * IS; if (shadow && a[i + 11] < 0.5) continue;
    const c = Math.cos(a[i + 3]), s = Math.sin(a[i + 3]), sx = a[i + 4], sy = a[i + 5], sz = a[i + 6];
    M[0] = c * sx; M[1] = 0; M[2] = s * sx; M[3] = 0; M[4] = 0; M[5] = sy; M[6] = 0; M[7] = 0; M[8] = -s * sz; M[9] = 0; M[10] = c * sz; M[11] = 0; M[12] = a[i]; M[13] = a[i + 1]; M[14] = a[i + 2]; M[15] = 1;
    gl.uniformMatrix4fv(U.uM, false, M);
    if (!shadow) { gl.uniform3f(U.uInvS2, 1 / (sx * sx), 1 / (sy * sy), 1 / (sz * sz)); gl.uniform4f(U.uColor, a[i + 7], a[i + 8], a[i + 9], a[i + 10]); }
    gl.drawArrays(gl.TRIANGLES, 0, cnt);
  }
}

const lp = new Float32Array(24), lc = new Float32Array(18), vis = [];
const scr = { x: 0, y: 0, z: 0 };
export function playerScreen3d(out, css) { out.x = cam.psx / css; out.y = cam.psy / css; }

export function render3d(alpha) {
  const p = G.player, e = G.env, w = cv.width, h = cv.height;
  frame++;
  const px = p.ox + (p.x - p.ox) * alpha, py = p.oy + (p.y - p.oy) * alpha;
  cam.x += (px + Math.cos(p.ang) * 22 - cam.x) * 0.12; cam.z += (py + Math.sin(p.ang) * 22 - cam.z) * 0.12;
  if (Math.abs(cam.x - px) > 400 || Math.abs(cam.z - py) > 400) { cam.x = px; cam.z = py; }
  cam.ox = Math.floor(cam.x / CS) * CS; cam.oz = Math.floor(cam.z / CS) * CS;
  const sk = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0, sk2 = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  const tx = cam.x - cam.ox + sk, tz = cam.z - cam.oz + sk2, asp = w / h, dist = R3.dist * (asp < 1.2 ? 1.5 : 1);
  cam.ex = tx + Math.sin(R3.yaw) * Math.cos(R3.pitch) * dist; cam.ey = Math.sin(R3.pitch) * dist; cam.ez = tz + Math.cos(R3.yaw) * Math.cos(R3.pitch) * dist;
  perspective(PROJ, R3.fov, asp, 60, 3200); lookAt(VIEW, cam.ex, cam.ey, cam.ez, tx, 8, tz); mul(VP, PROJ, VIEW);
  project(px, py, 14, scr); cam.psx = scr.x; cam.psy = scr.y; cam.pdepth = scr.z;

  // Licht-/Nebelstimmung
  const d = e.dark, wth = e.weather, wf = { clear: 1, heat: 1, snow: 0.6, rain: 0.45, fog: 0.3, storm: 0.3, blizzard: 0.25 }[wth] || 1;
  let ar = 0.56 + (0.085 - 0.56) * d, ag = 0.57 + (0.11 - 0.57) * d, ab = 0.6 + (0.2 - 0.6) * d;
  if (e.bloodMoon) { ar = 0.3; ag = 0.07; ab = 0.08; }
  if (e.season === 3) { ar *= 0.9; ag *= 0.96; ab *= 1.14; }
  const dusk = d > 0.02 && d < 0.85 ? Math.sin(d / 0.85 * Math.PI) : 0;
  let sr = 0.62 * (1 - d) * wf + dusk * 0.3, sg = 0.58 * (1 - d) * wf + dusk * 0.12, sb = 0.5 * (1 - d) * wf;
  if (G.lightning > 0) { const k = Math.min(1, G.lightning * 4); ar += k; ag += k; ab += k * 1.1; }
  const fogW = wth === 'fog' ? 1 : wth === 'blizzard' ? 0.9 : wth === 'storm' ? 0.4 : wth === 'rain' || wth === 'snow' ? 0.3 : 0;
  const fr = (0.56 + (0.02 - 0.56) * d) * (e.bloodMoon ? 1.6 : 1) + (e.bloodMoon ? 0.06 : 0), fg = 0.6 + (0.03 - 0.6) * d, fb = 0.66 + (0.07 - 0.66) * d;
  gl.clearColor(fr, fg, fb, 1); gl.clearStencil(0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  gl.uniformMatrix4fv(U.uVP, false, VP);
  gl.uniform3f(U.uAmb, ar, ag, ab); gl.uniform3f(U.uSunCol, sr, sg, sb);
  const ca = Math.cos(e.shAng) * e.shLen, sa = Math.sin(e.shAng) * e.shLen, sl = Math.hypot(ca, 1, sa);
  gl.uniform3f(U.uSun, -ca / sl, 1 / sl, -sa / sl);
  gl.uniform3f(U.uFogCol, fr, fg, fb); gl.uniform3f(U.uFogR, 620 - fogW * 470, 860 - fogW * 500, 1); gl.uniform2f(U.uCenter, tx, tz);
  gl.uniform4f(U.uFade, cam.psx, h - cam.psy, Math.min(w, h) * 0.085, cam.pdepth - 0.0004);
  gl.uniform1f(U.uAlpha, 1); gl.uniform1f(U.uShadow, 0); gl.uniform3f(U.uShear, 0, 0, 0);
  // Lichter: Spieler-Schein, Fackel, Mündungsfeuer + die nächsten Lichtquellen der Welt
  lp.fill(0); lc.fill(0); let nl = 0;
  const addL = (x, y, hh, r, cr, cg, cb) => { if (nl >= 6) return; lp[nl * 4] = x - cam.ox; lp[nl * 4 + 1] = hh; lp[nl * 4 + 2] = y - cam.oz; lp[nl * 4 + 3] = r; lc[nl * 3] = cr; lc[nl * 3 + 1] = cg; lc[nl * 3 + 2] = cb; nl++; };
  const nk = Math.max(d, wth === 'storm' || wth === 'blizzard' ? 0.3 : 0);
  if (nk > 0.05) addL(px, py, 30, 110, 0.3 * nk, 0.32 * nk, 0.4 * nk);
  if (p.torchT > 0) { const fl = 0.9 + Math.random() * 0.15; addL(px, py, 30, 190, 1.0 * fl * (0.35 + nk), 0.62 * fl * (0.35 + nk), 0.25 * fl * (0.35 + nk)); }
  if (G.flashT > 0) addL(px + Math.cos(p.ang) * 16, py + Math.sin(p.ang) * 16, 18, 240, 1.4, 1.2, 0.8);
  for (let i = 0; i < lights.n && nl < 6; i++) { const fl = 0.9 + Math.random() * 0.14, k = (0.2 + nk * 0.55) * lights.a[i] * fl; addL(lights.x[i], lights.y[i], 16, lights.r[i] * 1.25, 1.0 * k, 0.6 * k, 0.24 * k); }
  lights.n = 0;
  gl.uniform4fv(U.uLp, lp); gl.uniform3fv(U.uLc, lc);
  gl.uniform3f(U.uSpotP, px - cam.ox, 17, py - cam.oz); gl.uniform3f(U.uSpotD, Math.cos(p.ang) * 0.985, -0.17, Math.sin(p.ang) * 0.985);
  gl.uniform3f(U.uSpot, 0.86, 330, p.flash ? 1.5 * nk : 0);

  // sichtbare Chunks vorbereiten
  vis.length = 0;
  const c0x = Math.floor((cam.x - 900) / CS), c1x = Math.floor((cam.x + 900) / CS), c0y = Math.floor((cam.z - 900) / CS), c1y = Math.floor((cam.z + 900) / CS);
  let budget = recs.size ? 1 : 99;
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
    if (Math.abs(cx - W.pcx) > 2 || Math.abs(cy - W.pcy) > 2) continue;
    const ddx = Math.max(cx * CS - cam.x, 0, cam.x - (cx + 1) * CS), ddy = Math.max(cy * CS - cam.z, 0, cam.z - (cy + 1) * CS);
    if (ddx * ddx + ddy * ddy > 880 * 880) continue;
    const c = ensureChunk(cx, cy), r = rec(c);
    if ((r.ver !== c.ver || c.ver !== W.season || r.c !== c) && budget > 0) { budget--; prepareChunk(c); buildChunk(c, r); }
    if (r.tex && r.c === c) { r.frame = frame; vis.push(r); }
  }
  if ((frame & 255) === 0) gcRecs();
  const ptx = Math.floor(p.x / T), pty = Math.floor(p.y / T);
  const setM = r => { IDENT[12] = r.c.cx * CS - cam.ox; IDENT[14] = r.c.cy * CS - cam.oz; gl.uniformMatrix4fv(U.uM, false, IDENT); };
  const inside = r => { const b = r.c.bld; return b && ptx >= b.x && ptx < b.x + b.w && pty >= b.y && pty < b.y + b.h; };

  // 1) Boden
  gl.disable(gl.BLEND); gl.uniform3f(U.uInvS2, 1, 1, 1); gl.uniform4f(U.uColor, 1, 1, 1, 0); gl.uniform1f(U.uTexMix, 1); bind(bufQuad);
  for (let i = 0; i < vis.length; i++) { const r = vis[i]; setM(r); gl.bindTexture(gl.TEXTURE_2D, r.tex); gl.drawArrays(gl.TRIANGLES, 0, 6); }
  gl.uniform1f(U.uTexMix, 0); gl.bindTexture(gl.TEXTURE_2D, whiteTex);
  collect(alpha);

  // 2) projizierte Schatten (Stencil verhindert doppeltes Abdunkeln)
  const shA = e.shA * 1.25;
  if (shA > 0.02) {
    gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.uniform1f(U.uShadow, 1); gl.uniform4f(U.uShadowCol, 0.05, 0.07, 0.2, Math.min(0.6, shA)); gl.uniform3f(U.uShear, ca, sa, 1);
    for (let i = 0; i < vis.length; i++) {
      const r = vis[i]; setM(r);
      if (r.n) { bind(r.vbo); gl.drawArrays(gl.TRIANGLES, 0, r.n); }
      if (r.bn) { bind(r.bvbo); gl.drawArrays(gl.TRIANGLES, 0, r.bn); }
    }
    drawList(iBox, nBox, bufBox, 30, true); drawList(iSph, nSph, bufSphere, 240, true);
    gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    gl.uniform1f(U.uShadow, 0); gl.uniform3f(U.uShear, 0, 0, 0);
  }
  // 3) statische Welt
  gl.uniform3f(U.uInvS2, 1, 1, 1); gl.uniform4f(U.uColor, 1, 1, 1, 0);
  for (let i = 0; i < vis.length; i++) {
    const r = vis[i]; setM(r);
    if (r.n) { bind(r.vbo); gl.drawArrays(gl.TRIANGLES, 0, r.n); }
    if (inside(r)) { if (r.cn) { bind(r.cvbo); gl.drawArrays(gl.TRIANGLES, 0, r.cn); } }
    else if (r.bn) { bind(r.bvbo); gl.drawArrays(gl.TRIANGLES, 0, r.bn); }
  }
  // 4) Figuren, Bauwerke, Effekte
  drawList(iBox, nBox, bufBox, 30, false); drawList(iSph, nSph, bufSphere, 240, false);
  // 5) Bau-Vorschau (transparent)
  if (G.build) {
    const g = G.build, def = BUILD[g.id];
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.uniform1f(U.uAlpha, 0.5); bind(bufBox);
    const hh = def.block ? 14 : 3;
    M.fill(0); M[0] = 16; M[5] = hh; M[10] = 16; M[12] = g.tx * T + 16 - cam.ox; M[13] = hh; M[14] = g.ty * T + 16 - cam.oz; M[15] = 1;
    gl.uniformMatrix4fv(U.uM, false, M); gl.uniform3f(U.uInvS2, 1, 1, 1); gl.uniform4f(U.uColor, g.ok ? 0.3 : 1, g.ok ? 0.72 : 0.2, g.ok ? 1 : 0.2, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 30);
    if (def.dir || g.id === 'door') { const a = g.rot * Math.PI / 2; M[0] = 5; M[5] = 2; M[10] = 5; M[12] += Math.cos(a) * 22; M[13] = hh + 4; M[14] += Math.sin(a) * 22; gl.uniformMatrix4fv(U.uM, false, M); gl.drawArrays(gl.TRIANGLES, 0, 30); }
    gl.uniform1f(U.uAlpha, 1); gl.depthMask(true); gl.disable(gl.BLEND);
  }
}

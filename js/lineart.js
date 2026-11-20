// Turn an uploaded picture into line art: find the figure, trace its lines.

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
let segPromise = null;

function loadSegmenter() {
  if (!segPromise) {
    segPromise = (async () => {
      const v = await import(/* @vite-ignore */ `${MP}/vision_bundle.mjs`);
      const files = await v.FilesetResolver.forVisionTasks(`${MP}/wasm`);
      return v.ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite' },
        runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false,
      });
    })().catch(e => { segPromise = null; throw e; });
  }
  return segPromise;
}
const timeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

function blur(src, w, h, sigma) {
  const r = Math.max(1, Math.ceil(sigma * 2.5)), k = [];
  let sum = 0; for (let i = -r; i <= r; i++) { const v = Math.exp(-i * i / (2 * sigma * sigma)); k.push(v); sum += v; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let acc = 0; for (let i = -r; i <= r; i++) { const xx = x + i < 0 ? 0 : x + i >= w ? w - 1 : x + i; acc += src[y * w + xx] * k[i + r]; }
    tmp[y * w + x] = acc;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let acc = 0; for (let i = -r; i <= r; i++) { const yy = y + i < 0 ? 0 : y + i >= h ? h - 1 : y + i; acc += tmp[yy * w + x] * k[i + r]; }
    out[y * w + x] = acc;
  }
  return out;
}

function dilate(m, w, h, r) {
  let cur = m;
  for (let n = 0; n < r; n++) {
    const o = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      o[i] = cur[i] || (x > 0 && cur[i - 1]) || (x < w - 1 && cur[i + 1]) || (y > 0 && cur[i - w]) || (y < h - 1 && cur[i + w]) ? 1 : 0;
    }
    cur = o;
  }
  return cur;
}

// background = everything connected to the border that looks like the border
function floodMask(d, w, h) {
  const bc = [];
  const push = (x, y) => { const i = (y * w + x) * 4; bc.push([d[i], d[i + 1], d[i + 2]]); };
  for (let x = 0; x < w; x += 2) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y += 2) { push(0, y); push(w - 1, y); }
  const med = [0, 1, 2].map(c => bc.map(p => p[c]).sort((a, b) => a - b)[bc.length >> 1]);
  const near = bc.filter(p => Math.hypot(p[0] - med[0], p[1] - med[1], p[2] - med[2]) < 40).length / bc.length;
  if (near < .55) return null;
  const bg = new Uint8Array(w * h), st = [];
  const ok = i => { const j = i * 4; return Math.hypot(d[j] - med[0], d[j + 1] - med[1], d[j + 2] - med[2]) < 46; };
  for (let x = 0; x < w; x++) { st.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { st.push(y * w, y * w + w - 1); }
  while (st.length) {
    const i = st.pop(); if (bg[i] || !ok(i)) continue; bg[i] = 1;
    const x = i % w;
    if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1);
    if (i >= w) st.push(i - w); if (i < w * (h - 1)) st.push(i + w);
  }
  let n = 0; const fg = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { fg[i] = bg[i] ? 0 : 1; n += fg[i]; }
  const frac = n / (w * h);
  return frac > .04 && frac < .92 ? fg : null;
}

async function personMask(cv, w, h, status) {
  status && status('正在识别人物…');
  const seg = await timeout(loadSegmenter(), 15000);
  const res = seg.segment(cv);
  const cm = res.categoryMask, mw = cm.width, mh = cm.height, arr = cm.getAsUint8Array();
  const m = new Uint8Array(w * h); let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = arr[Math.floor(y * mh / h) * mw + Math.floor(x * mw / w)];
    if (v > 0) { m[y * w + x] = 1; n++; }
  }
  cm.close && cm.close();
  const frac = n / (w * h);
  return frac > .03 && frac < .97 ? m : null;
}

/**
 * opts: { W, H, personOnly, detail (0..1), colored, underlay, status(fn) }
 * returns { canvas, mask, colors, rect, how }
 */
export async function extractLineArt(img, opts) {
  const { W, H } = opts;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const sc = Math.min(W * .92 / iw, H * .92 / ih);
  const dw = Math.round(iw * sc), dh = Math.round(ih * sc), x0 = Math.round((W - dw) / 2), y0 = Math.round((H - dh) / 2);
  const ps = Math.min(1, 760 / Math.max(dw, dh)), pw = Math.round(dw * ps), ph = Math.round(dh * ps);

  const pc = document.createElement('canvas'); pc.width = pw; pc.height = ph;
  const px = pc.getContext('2d', { willReadFrequently: true });
  px.drawImage(img, 0, 0, pw, ph);
  const raw = px.getImageData(0, 0, pw, ph), d = raw.data, N = pw * ph;

  // flatten transparency onto white
  let transparent = 0;
  for (let i = 0; i < N; i++) {
    const a = d[i * 4 + 3] / 255; if (a < .1) transparent++;
    if (a < 1) for (let c = 0; c < 3; c++) d[i * 4 + c] = d[i * 4 + c] * a + 255 * (1 - a);
  }

  // ── figure mask ──
  let mask = null, how = '全图';
  if (opts.personOnly) {
    if (transparent > N * .04) {
      mask = new Uint8Array(N); for (let i = 0; i < N; i++) mask[i] = raw.data[i * 4 + 3] > 0 ? 1 : 0;
      // alpha was flattened; recompute from source
      const a2 = document.createElement('canvas'); a2.width = pw; a2.height = ph; const ac = a2.getContext('2d', { willReadFrequently: true }); ac.drawImage(img, 0, 0, pw, ph);
      const ad = ac.getImageData(0, 0, pw, ph).data; for (let i = 0; i < N; i++) mask[i] = ad[i * 4 + 3] > 40 ? 1 : 0;
      how = '透明背景';
    }
    if (!mask) { mask = floodMask(d, pw, ph); if (mask) how = '纯色背景'; }
    if (!mask) {
      const tmp = document.createElement('canvas'); tmp.width = pw; tmp.height = ph; tmp.getContext('2d').putImageData(raw, 0, 0);
      try { mask = await personMask(tmp, pw, ph, opts.status); if (mask) how = 'AI 人物识别'; } catch (e) { mask = null; }
      if (!mask) how = '全图（未找到人物）';
    }
  }

  // ── lines: difference of gaussians on luminance ──
  const L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114;
  const det = opts.detail ?? .5;
  const s1 = 1.1 - det * .45 + 0.2 * (pw / 760);
  const g1 = blur(L, pw, ph, s1), g2 = blur(L, pw, ph, s1 * 1.7);
  const thr = 7.5 - det * 6, gain = 1 / (14 - det * 6);
  const A = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const D = g1[i] - g2[i];
    let v = (-D - thr) * gain;
    if (L[i] < 70 && D < -1) v = Math.max(v, .9);
    A[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  if (mask) {
    const big = dilate(mask, pw, ph, 2);
    for (let i = 0; i < N; i++) {
      if (!big[i]) { A[i] = 0; continue; }
      // silhouette edge
      const x = i % pw;
      if (mask[i] && ((x > 0 && !mask[i - 1]) || (x < pw - 1 && !mask[i + 1]) || (i >= pw && !mask[i - pw]) || (i < N - pw && !mask[i + pw]))) A[i] = 1;
    }
  }
  // despeckle
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < ph - 1; y++) for (let x = 1; x < pw - 1; x++) {
      const i = y * pw + x; if (A[i] < .15) continue;
      let n = 0; for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) if ((xx || yy) && A[i + yy * pw + xx] > .15) n++;
      if (n < 2) A[i] = 0;
    }
  }

  // ── fill colours (blurred original) ──
  const cc = document.createElement('canvas'); cc.width = Math.max(1, pw >> 3); cc.height = Math.max(1, ph >> 3);
  const ccx = cc.getContext('2d', { willReadFrequently: true });
  const flat = document.createElement('canvas'); flat.width = pw; flat.height = ph; flat.getContext('2d').putImageData(raw, 0, 0);
  ccx.imageSmoothingQuality = 'high'; ccx.drawImage(flat, 0, 0, cc.width, cc.height);
  const cd = ccx.getImageData(0, 0, cc.width, cc.height).data;

  // ── render line layer ──
  const out = px.createImageData(pw, ph), od = out.data;
  for (let i = 0; i < N; i++) {
    if (A[i] <= 0) continue;
    let r = 74, g = 58, b = 46;
    if (opts.colored) {
      const x = i % pw, y = (i / pw) | 0, j = (Math.min(cc.height - 1, y >> 3) * cc.width + Math.min(cc.width - 1, x >> 3)) * 4;
      r = cd[j] * .62; g = cd[j + 1] * .62; b = cd[j + 2] * .62;
    }
    od[i * 4] = r; od[i * 4 + 1] = g; od[i * 4 + 2] = b; od[i * 4 + 3] = Math.round(Math.pow(A[i], .8) * 255);
  }
  const lc = document.createElement('canvas'); lc.width = pw; lc.height = ph; lc.getContext('2d').putImageData(out, 0, 0);

  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const cx = canvas.getContext('2d');
  if (opts.underlay) {
    cx.globalAlpha = .22;
    if (mask) {
      const u = document.createElement('canvas'); u.width = pw; u.height = ph; const ux = u.getContext('2d');
      const ud = ux.createImageData(pw, ph); for (let i = 0; i < N; i++) { ud.data.set([d[i * 4], d[i * 4 + 1], d[i * 4 + 2], mask[i] ? 255 : 0], i * 4); }
      ux.putImageData(ud, 0, 0); cx.drawImage(u, x0, y0, dw, dh);
    } else cx.drawImage(flat, x0, y0, dw, dh);
    cx.globalAlpha = 1;
  }
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(lc, x0, y0, dw, dh);

  // binary footprint for the note map
  const mk = document.createElement('canvas'); mk.width = W; mk.height = H;
  const mx = mk.getContext('2d', { willReadFrequently: true });
  mx.drawImage(lc, x0, y0, dw, dh);
  const md = mx.getImageData(0, 0, W, H);
  for (let i = 3; i < md.data.length; i += 4) { const on = md.data[i] > 60; md.data[i - 3] = md.data[i - 2] = md.data[i - 1] = 255; md.data[i] = on ? 255 : 0; }
  mx.putImageData(md, 0, 0);

  const colorAt = (x, y) => {
    const u = (x - x0) / dw, v = (y - y0) / dh;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return null;
    const j = (Math.floor(v * cc.height) * cc.width + Math.floor(u * cc.width)) * 4;
    return '#' + [cd[j], cd[j + 1], cd[j + 2]].map(n => n.toString(16).padStart(2, '0')).join('');
  };
  return { canvas, mask: mk, colorAt, rect: { x0, y0, dw, dh }, how };
}

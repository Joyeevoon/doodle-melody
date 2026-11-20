import { GENRES, MOODS, SCALES, COLORS, ROLE_INFO, TIMBRE_NAME, PURE_LABEL, colorRole, pureTimbre, chordTones } from './genres.js';
import { Engine, Sequencer } from './audio.js';
import { BRUSHES, LAYERED, rng, drawSeg, drawTail, metaWidth, idColor } from './brushes.js';
import { extractLineArt } from './lineart.js';
import { Pet } from './pet.js';
import { IC } from './icons.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const isMobile = () => innerWidth <= 900;
// paper shape follows the room the screen gives it (fixed for the session)
const [W, H] = (() => {
  const st = document.getElementById('stage'), tr = innerWidth > 900 ? 84 : 0;
  let a = st.clientWidth / Math.max(1, st.clientHeight - tr);
  if (!isFinite(a) || a <= 0) a = innerWidth > innerHeight ? 4 / 3 : 3 / 4;
  a = Math.max(.56, Math.min(1.78, a));
  return a >= 1 ? [1440, Math.round(1440 / a)] : [Math.round(1440 * a), 1440];
})();
// time: 64 sixteenths across (4 bars). pitch: 16 notes of a five-note scale, 3 octaves up from the key
const COLS = 64, FR = 48, NP = 16;
const CW = W / COLS, RH = H / FR;

const S = {
  brush: 'pen', color: '#3E9E5B', size: 10, alpha: 1,
  genre: GENRES[0], mood: MOODS[1], bpm: Math.round(GENRES[0].bpm * MOODS[1].tempo),
  backing: true, live: true, echo: true, nodes: false,
};

const engine = new Engine();
const seq = new Sequencer(engine);
seq.bpm = engine.bpm = S.bpm;

// ───────── canvases ─────────
const paper = $('#paper');
const mk = (el) => { el.width = W; el.height = H; return el.getContext('2d'); };
const bgX = mk($('#cBg')), artX = mk($('#cArt')), liveX = mk($('#cLive')), fxX = mk($('#cFx'));
const off = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const metaC = off(), metaX = metaC.getContext('2d', { willReadFrequently: true });
const scratch = off(), scrX = scratch.getContext('2d');
const tint = off(), tintX = tint.getContext('2d');

let items = [], undoS = [], redoS = [], nextId = 1;
const byId = () => new Map(items.map(it => [it.id, it]));
let idMap = new Map();

// pitch rows (for the grid view): the y at which pitch p turns into p+1
const bandY = p => H * (1 - (p + .5) / (NP - 1));
function drawBg() {
  bgX.fillStyle = '#FFFEFA'; bgX.fillRect(0, 0, W, H);
  if (S.nodes) {
    for (let p = 0; p < NP; p++) {
      const top = p === NP - 1 ? 0 : bandY(p), bot = p === 0 ? H : bandY(p - 1);
      if (p % 5 === 0) { bgX.fillStyle = 'rgba(255,200,80,.16)'; bgX.fillRect(0, top, W, bot - top); }
      else if (p % 2) { bgX.fillStyle = 'rgba(255,214,92,.06)'; bgX.fillRect(0, top, W, bot - top); }
    }
    bgX.strokeStyle = 'rgba(214,170,80,.28)'; bgX.lineWidth = 2; bgX.setLineDash([8, 10]);
    for (let b = 1; b < 4; b++) { bgX.beginPath(); bgX.moveTo(b * 16 * CW, 0); bgX.lineTo(b * 16 * CW, H); bgX.stroke(); }
    bgX.setLineDash([]);
    bgX.fillStyle = 'rgba(214,170,80,.25)';
    for (let c = 0; c <= COLS; c += 4) for (let p = 0; p < NP - 1; p++) { bgX.beginPath(); bgX.arc(c * CW, bandY(p), 2, 0, 6.283); bgX.fill(); }
  } else {
    bgX.fillStyle = 'rgba(214,180,110,.16)';
    for (let y = 30; y < H; y += 40) for (let x = 30; x < W; x += 40) { bgX.beginPath(); bgX.arc(x, y, 1.6, 0, 6.283); bgX.fill(); }
  }
}

function renderStroke(ctx, s) {
  const st = { rng: rng(s.seed), acc: 0 };
  for (let i = 0; i < s.pts.length; i++) drawSeg(ctx, s, i, st);
  drawTail(ctx, s, st);
}
function renderItem(it) {
  if (it.type === 'image') { artX.drawImage(it.canvas, 0, 0); return; }
  const la = LAYERED[it.brush];
  if (la) {
    scrX.clearRect(0, 0, W, H); renderStroke(scrX, it);
    artX.save(); artX.globalAlpha = la * it.alpha; artX.drawImage(scratch, 0, 0); artX.restore();
  } else renderStroke(artX, it);
}
function renderMeta(it) {
  if (it.type === 'image') {
    tintX.clearRect(0, 0, W, H); tintX.globalCompositeOperation = 'source-over'; tintX.drawImage(it.mask, 0, 0);
    tintX.globalCompositeOperation = 'source-in'; tintX.fillStyle = idColor(it.id); tintX.fillRect(0, 0, W, H);
    tintX.globalCompositeOperation = 'source-over'; metaX.drawImage(tint, 0, 0); return;
  }
  metaX.save();
  metaX.lineCap = metaX.lineJoin = 'round';
  metaX.lineWidth = Math.max(6, metaWidth(it));
  if (it.brush === 'eraser') metaX.globalCompositeOperation = 'destination-out';
  metaX.strokeStyle = metaX.fillStyle = idColor(it.id);
  const P = it.pts;
  metaX.beginPath(); metaX.moveTo(P[0].x, P[0].y);
  if (P.length === 1) metaX.lineTo(P[0].x + .1, P[0].y);
  for (let i = 1; i < P.length; i++) metaX.lineTo(P[i].x, P[i].y);
  metaX.stroke(); metaX.restore();
}
function redrawAll() {
  artX.clearRect(0, 0, W, H); metaX.clearRect(0, 0, W, H);
  items.forEach(it => { renderItem(it); renderMeta(it); });
  rebuild(); updateUI();
}

// ───────── pitch ─────────
const pFromY = y => Math.max(0, Math.min(NP - 1, Math.round((1 - y / H) * (NP - 1))));
function keyBase() { const pc = S.genre.root % 12; return 48 + (pc > 6 ? pc - 12 : pc); }
function scaleMidi(p) { const sc = SCALES[S.mood.scale], n = sc.length; return keyBase() + sc[((p % n) + n) % n] + 12 * Math.floor(p / n); }
function timbreFor(color) { return S.genre.pure ? pureTimbre(color) : S.genre.roles[colorRole(color)]; }
function shiftFor(color) {
  if (S.genre.pure) { const t = pureTimbre(color); return t === 'bass' ? -12 : t === 'glock' ? 12 : 0; }
  const r = colorRole(color);
  return r === 'bass' ? (S.genre.flutey ? 0 : -12) : r === 'bell' ? 12 : 0;
}
const midiFor = (p, color) => scaleMidi(p) + shiftFor(color);
const bellTimbre = () => S.genre.pure ? 'glock' : S.genre.roles.bell;

// ───────── note map: what the drawing plays ─────────
// segs: one per continuous line voice; segAt[c]: segments that begin at column c
let segs = [], segAt = [], onsets = [], dens = [], nodes = [], noteCount = 0;
function rebuild() {
  const d = metaX.getImageData(0, 0, W, H).data;
  idMap = byId();
  const percol = [];
  for (let c = 0; c < COLS; c++) {
    const hits = new Map(), x0 = Math.floor(c * CW) + 1, x1 = (c + 1) * CW - 1;
    for (let y = 1; y < H - 1; y += 3) {
      const r = Math.min(FR - 1, Math.floor(y / RH)), row = y * W;
      for (let x = x0; x < x1; x += 3) {
        const i = (row + x) * 4;
        if (d[i + 3] !== 255 || d[i + 2] !== 77) continue;
        const id = d[i] | (d[i + 1] << 8); if (!idMap.has(id)) continue;
        let a = hits.get(id); if (!a) hits.set(id, a = new Uint8Array(FR)); a[r]++;
      }
    }
    const m = new Map();
    for (const [id, a] of hits) {
      const img = idMap.get(id).type === 'image', cs = [];
      let s = -1, gap = 0;
      for (let r = 0; r <= FR; r++) {
        const on = r < FR && a[r] >= 2;
        if (on) { if (s < 0) s = r; gap = 0; }
        else if (s >= 0 && (++gap > 1 || r === FR)) {
          const e = r - gap, L = e - s + 1;
          if (!img && L >= 6) { cs.push(s + 1); if (L >= 12) cs.push((s + e) / 2); cs.push(e - 1); }
          else cs.push((s + e) / 2);
          s = -1; gap = 0;
        }
      }
      let keep = cs;
      if (cs.length > 3) keep = [0, 1, 2].map(k => cs[Math.round(k * (cs.length - 1) / 2)]);
      m.set(id, keep);
    }
    percol.push(m);
  }
  segs = []; segAt = Array.from({ length: COLS }, () => []); onsets = Array.from({ length: COLS }, () => []);
  dens = new Array(COLS).fill(0); nodes = [];
  const yOf = ctr => (ctr + .5) * RH;
  for (const [id, it] of idMap) {
    if (it.type === 'image') {
      for (let c = 0; c < COLS; c++) {
        const cur = percol[c].get(id); if (!cur) continue;
        const prev = c > 0 ? percol[c - 1].get(id) || [] : [];
        for (const ctr of cur) {
          const y = yOf(ctr), color = it.colorAt((c + .5) * CW, y) || '#6b5644', isNew = !prev.some(q => Math.abs(q - ctr) <= 1.5);
          nodes.push({ c, y, color, start: isNew });
          if (!isNew) continue;
          let len = 1, tr = ctr;
          while (len < 4 && c + len < COLS) { const nx = (percol[c + len].get(id) || []).find(q => Math.abs(q - tr) <= 1.5); if (nx === undefined) break; tr = nx; len++; }
          const p = pFromY(y);
          const sg = { key: `${id}:i${c}:${Math.round(ctr)}`, id, lane: 0, start: c, ps: new Array(len).fill(p), ys: new Array(len).fill(y), color, img: 1 };
          segs.push(sg); segAt[c].push(sg); onsets[c].push({ y, color, big: 1 });
        }
      }
      continue;
    }
    const open = [];
    const close = k => { if (open[k]) { segs.push(open[k]); segAt[open[k].start].push(open[k]); open[k] = null; } };
    for (let c = 0; c < COLS; c++) {
      const cur = (percol[c].get(id) || []).slice().sort((a, b) => a - b);
      for (let k = 0; k < 3; k++) {
        if (k >= cur.length) { close(k); continue; }
        const y = yOf(cur[k]), p = pFromY(y), o = open[k];
        if (o && Math.abs(o.ps[o.ps.length - 1] - p) <= 5) {
          if (o.ps[o.ps.length - 1] !== p) onsets[c].push({ y, color: it.color, big: 0 });
          o.ps.push(p); o.ys.push(y); nodes.push({ c, y, color: it.color, start: false });
        } else {
          close(k);
          open[k] = { key: `${id}:${k}:${c}`, id, lane: k, start: c, ps: [p], ys: [y], color: it.color };
          onsets[c].push({ y, color: it.color, big: 1 }); nodes.push({ c, y, color: it.color, start: true });
        }
      }
    }
    for (let k = 0; k < 3; k++) close(k);
  }
  for (const sg of segs) for (let k = 0; k < sg.ps.length; k++) dens[sg.start + k]++;
  noteCount = segs.length;
  segKey = new Map(segs.map(sg => [sg.key, sg]));
}
let rebuildT = 0;
const scheduleRebuild = () => { clearTimeout(rebuildT); rebuildT = setTimeout(rebuild, 40); };

// ───────── playback ─────────
const vq = [];
let head = null;
const swingAmt = () => (S.genre.swing || 0) + (S.mood.swing || 0);
function swingOff(k) {
  const sw = swingAmt(), sd = seq.stepDur; if (!sw) return 0;
  if (S.genre.swing8) return k % 4 === 2 ? sw * 2 * sd : 0;
  return k % 2 === 1 ? sw * sd : 0;
}

const HAT = new Set(['h', 'hf', 'o', 'ri', 'sh', 'ta', 'na', 'w']), SNARE = ['s', 'c', 'r'];
function drumPlan(D, s16, bar) {
  const out = [], dn = S.mood.density, hit = k => D[k] && D[k][s16] === 'x';
  const keys = Object.keys(D).filter(k => k !== 'vinyl');
  const kick = D.k ? 'k' : D.tk ? 'tk' : null, snare = SNARE.find(k => D[k]);
  const acc = s16 % 4 === 0 ? 1 : .78;
  if (dn === 'full' || dn === 'drive') {
    keys.forEach(k => { if (hit(k) && !(k === 'cr' && bar % 2)) out.push([k, acc]); });
    if (dn === 'drive') {
      if (kick && s16 % 4 === 0 && !hit(kick)) out.push([kick, .85]);
      if (s16 === 0 && bar % 2 === 0 && !hit('cr')) out.push(['cr', .8]);
      if (bar === 3 && s16 >= 12) out.push([snare || 'tom', .45 + (s16 - 12) * .14]);
    }
  } else if (dn === 'soft') {
    if (s16 === 0 && kick) out.push([kick, .65]);
    if (s16 === 8 && snare) out.push(['r', .4]);
    keys.forEach(k => { if (HAT.has(k) && hit(k) && s16 % 4 === 0) out.push([k, .45]); });
  } else if (dn === 'half') {
    if ((s16 === 0 || s16 === 10) && kick) out.push([kick, .8]);
    if (s16 === 8 && snare) out.push([snare, .75]);
    keys.forEach(k => { if (HAT.has(k) && hit(k) && s16 % 2 === 0) out.push([k, .55]); });
  } else if (dn === 'tense') {
    if (s16 === 0) out.push(['k', .85]);
    if (s16 === 3) out.push(['k', .5]);
    if (s16 % 2 === 0) out.push(['h', s16 % 4 ? .25 : .4]);
  }
  return out;
}

function playBacking(g, s16, bar, t) {
  const sd = seq.stepDur, M = S.mood, dn = M.density;
  if (g.drums) for (const [k, v] of drumPlan(g.drums, s16, bar)) engine.drum(k, t, v, g.side && k === 'k');
  const [cr, cq] = M.prog[bar % M.prog.length];
  const { tones, root } = chordTones(cr, cq, M.sevenths || g.sevenths);
  const chBase = keyBase() + 12;
  for (const ch of g.chords) {
    const base = chBase + ch.oct, vel = ch.vel * (dn === 'drive' ? 1.1 : dn === 'soft' ? .85 : 1);
    const set = ch.five ? [root, root + 7, root + 12] : tones;
    const play = (tone, when, len, v = 1) => engine.note(ch.inst, base + tone, when, len * sd, vel * v, { pan: (((tone % 5) + 5) % 5 - 2) * .08, bus: 'back' });
    let style = ch.style;
    if (dn === 'tense') style = 'pad';
    if (dn === 'soft' && (style === 'pattern' || style === 'strum' || style === 'comp')) style = 'soft';
    switch (style) {
      case 'pattern': if (ch.pat[s16] === 'x') set.forEach(tn => play(tn, t, ch.len, s16 % 4 === 0 ? 1 : .85)); break;
      case 'strum': if (ch.pat[s16] === 'x') { const down = s16 % 4 === 0; (down ? set : [...set].reverse()).forEach((tn, i) => play(tn, t + i * .018, ch.len, down ? 1 : .75)); } break;
      case 'soft': if (s16 === 0 || s16 === 8) set.forEach((tn, i) => play(tn, t + i * .03, 7.5, .8)); break;
      case 'pad': if (s16 === 0) set.forEach(tn => play(tn, t, 15.6, .8)); break;
      case 'arp': if (s16 % 2 === 0) { const ext = [...set, set[0] + 12, set[1] + 12], ord = [0, 1, 2, 3, 4, 3, 2, 1]; play(ext[ord[(s16 / 2) % 8] % ext.length], t, ch.len, s16 % 8 === 0 ? 1 : .8); } break;
      case 'alberti': if (s16 % 2 === 0) { const o = [0, 2, 1, 2][(s16 / 2) % 4]; play(set[Math.min(o, set.length - 1)], t, ch.len); } break;
      case 'comp': { const pat = bar % 2 ? '...x.....x......' : 'x.....x.........'; if (pat[s16] === 'x') set.slice(1).forEach(tn => play(tn, t, ch.len)); break; }
      case 'drone': if (s16 === 0) { play(root, t, 15.6); play(root + 7, t, 15.6, .8); } break;
    }
  }
  const b = g.bass; if (!b) return;
  let r = keyBase() - 12 + root; if (r < 33) r += 12;
  let m = null, len = b.len;
  if (dn === 'tense') { if (s16 % 2 === 0) { m = r; len = 1.4; } }
  else if (dn === 'soft') { if (s16 === 0) { m = r; len = 14; } }
  else if (b.walk) {
    if (s16 % 4 === 0) {
      const beat = s16 / 4, nx = M.prog[(bar + 1) % M.prog.length][0];
      let nr = keyBase() - 12 + (nx > 5 ? nx - 12 : nx); if (nr < 33) nr += 12;
      m = beat === 0 ? r : beat === 1 ? r + (tones[1] - tones[0] + 12) % 12 : beat === 2 ? r + 7 : nr + (nr > r ? -1 : 1);
    }
  } else {
    const c = b.pat[s16];
    if (c === '1') m = r; else if (c === '5') m = r + 7; else if (c === '8') m = r + 12;
  }
  if (m != null) engine.note(b.inst, m, t, len * sd, s16 % 4 === 0 ? .85 : .7, { bus: 'back' });
}

// line voices are steered step by step, so a new mood, genre or tempo is heard at once
const running = new Map();
let segKey = new Map();
function segCtx(sg) {
  const it = idMap.get(sg.id); if (!it) return null;
  const img = it.type === 'image', brush = img ? 'pen' : it.brush, color = sg.color;
  const tim = timbreFor(color), sus = engine.isSustained(tim);
  let vel = img ? .5 : (.62 + Math.min(it.size, 40) / 40 * .22) * (.65 + .35 * it.alpha);
  if (brush === 'ink') { const w = it.pts.reduce((a, p) => a + p.w, 0) / it.pts.length; vel *= Math.max(.6, Math.min(1.25, .55 + w * .6)); }
  vel *= 1 / Math.sqrt(Math.max(1, dens[sg.start] / 2.5));
  const pan = (((sg.id * .618) + sg.lane * .31) % 1 - .5) * .6;
  const o = { pan, bus: 'draw' };
  if (brush === 'water') Object.assign(o, { rev: 2.6, relMul: 3, bright: .7 });
  if (brush === 'neon') Object.assign(o, { del: 2.8 });
  const layers = [[0, 1]];
  if (brush === 'marker') layers.push([-12, .45]);
  if (brush === 'neon') layers.push([12, .22]);
  return { brush, color, tim, sus, vel, pan, o, layers, legato: sus && brush !== 'pencil' && brush !== 'crayon' };
}
function deco(c, p, t) {
  if (c.brush !== 'star' && c.brush !== 'spray') return;
  const bt = bellTimbre(), sd = seq.stepDur, hi = q => Math.min(96, scaleMidi(q));
  if (c.brush === 'star') engine.note(bt, hi(p + 5), t, sd * 2, c.vel * .38, { pan: -c.pan, rev: 1.6 });
  else [7, 9].forEach((dp, i) => engine.note(bt, hi(p + dp), t + (i + 1) * sd * .33, sd, c.vel * .22, { pan: -c.pan, rev: 1.5 }));
}
function startLegato(r, k, t, grace) {
  const c = r.c, m = midiFor(r.sg.ps[k], c.color);
  r.voices = c.layers.map(([sh, vm]) => ({ sh, v: engine.voice(c.tim, m + sh, t, c.vel * vm, (sh || !grace) ? { ...c.o, grace: false } : c.o) })).filter(x => x.v);
}
function strike(r, k, t) {
  const c = r.c, ps = r.sg.ps, sd = seq.stepDur;
  let e = k + 1; while (e < ps.length && ps[e] === ps[k]) e++;
  const every = c.brush === 'crayon' ? 2 : c.brush === 'pencil' ? 4 : 8;
  const len = c.brush === 'pencil' ? .7 : c.brush === 'crayon' ? Math.min(every, e - k) * .6 : Math.min(every, e - k);
  const fresh = k === 0 || ps[k] !== ps[k - 1];
  for (const [sh, vm] of c.layers) engine.note(c.tim, midiFor(ps[k], c.color) + sh, t, Math.max(.06, len * sd), c.vel * vm * (fresh ? 1 : .78), c.o);
  if (fresh) deco(c, ps[k], t);
}
function stepVoices(st, t) {
  for (const [key, r] of running) {
    const sg = segKey.get(key), k = st - r.start;
    if (!sg || k < 0 || k >= sg.ps.length) { r.voices.forEach(x => x.v.end(t)); running.delete(key); continue; }
    r.sg = sg;
    const tim = timbreFor(r.c.color);
    if (tim !== r.c.tim) {          // the genre changed under this line: hand it to the new instrument
      r.voices.forEach(x => x.v.end(t)); r.c = segCtx(sg) || r.c; r.voices = [];
      if (r.c.legato) startLegato(r, k, t, false);
      r.runStart = k;
    }
    const ps = sg.ps, changed = ps[k] !== ps[k - 1];
    if (changed) r.runStart = k;
    if (r.c.legato) {
      r.voices.forEach(x => x.v.to(midiFor(ps[k], r.c.color) + x.sh, t));
      if (changed) deco(r.c, ps[k], t);
    } else {
      const every = r.c.brush === 'crayon' ? 2 : r.c.brush === 'pencil' ? 4 : 8;
      if (changed || (k - (r.runStart || 0)) % every === 0) strike(r, k, t);
    }
  }
  for (const sg of segAt[st]) {
    if (running.has(sg.key)) continue;
    const c = segCtx(sg); if (!c) continue;
    const r = { sg, c, start: sg.start, voices: [], runStart: 0 };
    running.set(sg.key, r);
    if (c.legato) { startLegato(r, 0, t, true); deco(c, sg.ps[0], t); }
    else strike(r, 0, t);
  }
}

seq.onStep = (step, t) => {
  const g = S.genre, st = step % COLS, bar = Math.floor(st / 16), s16 = st % 16;
  const tt = t + swingOff(st);
  if (S.backing && !g.pure) playBacking(g, s16, bar, tt);
  stepVoices(st, tt);
  vq.push({ t: tt, bt: t, st, dots: onsets[st] });
};

// ───────── fx layer ─────────
const rings = [], parts = [];
let lastPetNote = 0;
function ring(x, y, color, big = 1) {
  rings.push({ x, y, color, t0: performance.now(), big });
  if (rings.length > 140) rings.shift();
  if (Math.random() < .3 * big) parts.push({ x, y, vx: (Math.random() - .5) * .08, vy: -.06 - Math.random() * .05, color, t0: performance.now(), ch: '♪♫♩♬'[(Math.random() * 4) | 0] });
}
function frame() {
  requestAnimationFrame(frame);
  const now = engine.ctx ? engine.ctx.currentTime : 0, pnow = performance.now();
  while (vq.length && vq[0].t <= now) {
    const ev = vq.shift(); head = ev;
    let lead = null;
    ev.dots.forEach(dt => { ring((ev.st + .5) * CW, dt.y, dt.color, dt.big ? 1.2 : .7); if (dt.big && !lead) lead = dt.color; });
    if (lead && pnow - lastPetNote > 380) { lastPetNote = pnow; pet.note(lead); }
  }
  fxX.clearRect(0, 0, W, H);
  if (S.nodes) {
    for (const n of nodes) {
      fxX.globalAlpha = n.start ? .95 : .35;
      fxX.fillStyle = '#fff'; fxX.beginPath(); fxX.arc((n.c + .5) * CW, n.y, n.start ? 10 : 5, 0, 6.283); fxX.fill();
      fxX.fillStyle = n.color; fxX.beginPath(); fxX.arc((n.c + .5) * CW, n.y, n.start ? 6.5 : 3, 0, 6.283); fxX.fill();
    }
    fxX.globalAlpha = 1;
  }
  if (seq.playing && head) {
    const pos = ((head.st + Math.max(0, now - head.bt) / seq.stepDur) % COLS) * CW;
    const gr = fxX.createLinearGradient(pos - 90, 0, pos, 0);
    gr.addColorStop(0, 'rgba(255,214,92,0)'); gr.addColorStop(1, 'rgba(255,214,92,.22)');
    fxX.fillStyle = gr; fxX.fillRect(pos - 90, 0, 90, H);
    fxX.fillStyle = '#F5BE38'; fxX.fillRect(pos - 2, 0, 4, H);
    fxX.beginPath(); fxX.arc(pos, 14, 11, 0, 6.283); fxX.fill();
    fxX.fillStyle = '#fff'; fxX.beginPath(); fxX.arc(pos, 14, 4.5, 0, 6.283); fxX.fill();
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i], a = (pnow - r.t0) / 650;
    if (a >= 1) { rings.splice(i, 1); continue; }
    fxX.globalAlpha = (1 - a) * .9; fxX.strokeStyle = r.color; fxX.lineWidth = 5 * (1 - a) + 1;
    fxX.beginPath(); fxX.arc(r.x, r.y, (10 + a * 34) * r.big, 0, 6.283); fxX.stroke();
    fxX.globalAlpha = (1 - a) * .35; fxX.fillStyle = r.color; fxX.beginPath(); fxX.arc(r.x, r.y, 9 * r.big * (1 - a * .5), 0, 6.283); fxX.fill();
  }
  fxX.font = '900 30px Nunito, sans-serif'; fxX.textAlign = 'center';
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i], age = pnow - p.t0;
    if (age > 1100) { parts.splice(i, 1); continue; }
    fxX.globalAlpha = 1 - age / 1100; fxX.fillStyle = p.color;
    fxX.fillText(p.ch, p.x + p.vx * age, p.y + p.vy * age);
  }
  fxX.globalAlpha = 1;
}

// ───────── drawing input ─────────
let cur = null, curSt = null, ptrId = null, live = null;
function toLocal(e) { const b = paper.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width * W, y: (e.clientY - b.top) / b.height * H }; }

paper.addEventListener('pointerdown', e => {
  if (ptrId !== null || e.button > 0) return;
  engine.init(); applyFx();
  ptrId = e.pointerId; paper.setPointerCapture(ptrId);
  const p = toLocal(e);
  const w0 = S.brush === 'ink' ? .45 : (e.pointerType === 'pen' && e.pressure > 0 ? .4 + e.pressure : 1);
  cur = { id: nextId++, type: 'stroke', brush: S.brush, color: S.color, size: S.size, alpha: S.alpha, seed: (Math.random() * 1e9) | 0, pts: [{ x: p.x, y: p.y, w: w0 }], _t: performance.now() };
  curSt = { rng: rng(cur.seed), acc: 0 };
  const la = LAYERED[cur.brush];
  if (la) { liveX.clearRect(0, 0, W, H); $('#cLive').style.opacity = la * cur.alpha; }
  drawSeg(la ? liveX : artX, cur, 0, curSt);
  $('#hint').classList.add('gone');
  liveSound(p);
});
paper.addEventListener('pointermove', e => {
  if (e.pointerId !== ptrId || !cur) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  const tgt = LAYERED[cur.brush] ? liveX : artX;
  let lastP = null;
  for (const ev of (evs.length ? evs : [e])) {
    const p = toLocal(ev), P = cur.pts, last = P[P.length - 1];
    const d = Math.hypot(p.x - last.x, p.y - last.y);
    if (d < 2) continue;
    const now = performance.now(), dt = Math.max(1, now - cur._t); cur._t = now;
    let w = 1;
    if (cur.brush === 'ink') { const v = d / dt; w = last.w * .7 + Math.max(.28, Math.min(1.4, 1.45 - v * .32)) * .3; }
    if (ev.pointerType === 'pen' && ev.pressure > 0) w *= .4 + ev.pressure;
    P.push({ x: p.x, y: p.y, w });
    drawSeg(tgt, cur, P.length - 1, curSt);
    lastP = p;
  }
  if (lastP) liveSound(lastP);
});
function endStroke(e) {
  if (e.pointerId !== ptrId) return;
  ptrId = null; liveEnd();
  if (!cur) return;
  const la = LAYERED[cur.brush];
  drawTail(la ? liveX : artX, cur, curSt);
  if (la) { artX.save(); artX.globalAlpha = la * cur.alpha; artX.drawImage($('#cLive'), 0, 0); artX.restore(); liveX.clearRect(0, 0, W, H); }
  delete cur._t;
  undoS.push(items); redoS = []; items = [...items, cur];
  renderMeta(cur); idMap = byId(); scheduleRebuild(); updateUI();
  cur = null;
  pet.advanceIf('stroke');
}
paper.addEventListener('pointerup', endStroke);
paper.addEventListener('pointercancel', endStroke);

// the pen sings while you draw: one voice that follows it
function liveSound(pt) {
  if (!S.live || S.brush === 'eraser' || !engine.ctx) return;
  const p = pFromY(pt.y), now = engine.ctx.currentTime, tim = timbreFor(S.color), m = midiFor(p, S.color);
  const vel = .55 + Math.min(S.size, 40) / 40 * .2;
  const o = { pan: (pt.x / W - .5) * .5, bus: 'draw', del: S.brush === 'neon' ? 2.4 : .6, rev: S.brush === 'water' ? 2.4 : 1 };
  if (!live) {
    const v = engine.voice(tim, m, now, vel, o); if (!v) return;
    v.live = true; live = { v, p, tim, sus: engine.isSustained(tim), t: now };
    ring(pt.x, pt.y, S.color, .8); return;
  }
  if (p === live.p) return;
  if (live.sus && tim === live.tim) live.v.to(m, now);
  else {
    if (now - live.t < .07) return;
    live.v.end(now + .12);
    const v = engine.voice(tim, m, now, vel, o); if (!v) return; v.live = true; live.v = v; live.tim = tim;
  }
  live.p = p; live.t = now;
  if (S.brush === 'star' || S.brush === 'spray') engine.note(bellTimbre(), Math.min(96, scaleMidi(p + 5)), now + .02, .3, vel * .3, { rev: 1.5 });
  ring(pt.x, pt.y, S.color, .8);
}
function liveEnd() {
  if (!live) return;
  const now = engine.ctx.currentTime;
  live.v.live = false; live.v.end(live.sus ? now : now + .35); live = null;
}

// ───────── actions ─────────
function undo() { if (!undoS.length) return; redoS.push(items); items = undoS.pop(); redrawAll(); }
function redo() { if (!redoS.length) return; undoS.push(items); items = redoS.pop(); redrawAll(); }
function clearAll() {
  if (!items.length) return;
  undoS.push(items); redoS = []; items = []; redrawAll();
  pet.chat('白纸一张～想画什么就画什么！（画错了可以撤销哦）', 3500);
}
function applyFx() {
  engine.bpm = S.bpm;
  const g = S.genre, M = S.mood;
  engine.setFx({ rev: g.fx.rev + (M.rev || 0), del: g.fx.del + (M.del || 0), lp: Math.min(g.fx.lp || 18000, M.lp || 18000), echo: S.echo });
}
function syncVinyl() { engine.startVinyl(seq.playing && S.backing && !S.genre.pure && S.genre.drums && S.genre.drums.vinyl); }
function togglePlay() {
  engine.init();
  if (seq.playing) {
    seq.stop(); vq.length = 0; head = null; running.clear(); engine.releaseAll(); pet.dance(false);
  } else {
    applyFx(); seq.bpm = S.bpm; seq.start(); pet.dance(true, S.bpm);
    if (!items.length && !pet.touring) pet.chat(S.genre.pure ? '纯净模式没有伴奏哦～画几笔，播放线扫过就会唱出来！' : '先放伴奏给你听～在画布上画几笔，播放线扫过时就会唱出来！', 4200);
    pet.advanceIf('play');
  }
  syncVinyl(); updateUI();
}
function toggleNodes() { S.nodes = !S.nodes; drawBg(); updateUI(); }
function savePng() {
  const c = off(), x = c.getContext('2d');
  x.drawImage($('#cBg'), 0, 0); x.drawImage($('#cArt'), 0, 0);
  c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `doodle-melody-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('图片已保存'); });
}
function retempo() {
  S.bpm = Math.round(S.genre.bpm * S.mood.tempo);
  seq.bpm = engine.bpm = S.bpm; $('#bpm').value = S.bpm; syncRange($('#bpm'));
  applyFx(); if (seq.playing) pet.dance(true, S.bpm);
}
function setGenre(g, quiet) {
  S.genre = g; retempo(); syncVinyl(); updateUI();
  if (!quiet) pet.chat(`${g.emo} ${g.name} · ${g.zh}：${g.desc}～`, 3200);
}
function setMood(m, quiet) {
  S.mood = m; retempo(); updateUI();
  if (!quiet) pet.chat(`${m.emo} ${m.name}：${m.line}`, 3200);
}

const ACTS = { undo, redo, clear: clearAll, play: togglePlay, nodes: toggleNodes, save: savePng, upload: () => { closeSheets(); $('#file').click(); } };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  engine.init(); ACTS[b.dataset.act] && ACTS[b.dataset.act]();
});
document.addEventListener('keydown', e => {
  if (e.target.matches('input')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
});

// ───────── UI build ─────────
function syncRange(el) { el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%'); }
$$('input[type=range]').forEach(el => { syncRange(el); el.addEventListener('input', () => syncRange(el)); });

$('#brushGrid').innerHTML = BRUSHES.map(b => `<button class="brush" data-brush="${b.id}"><i>${IC[b.id]}</i><span><b>${b.name}</b><small>${b.play}</small></span></button>`).join('');
$('#brushGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-brush]'); if (!b) return;
  S.brush = b.dataset.brush; updateUI();
});
const swBtns = COLORS.map(([c, n]) => `<button class="sw" data-c="${c}" style="--c:${c}" title="${n}" aria-label="${n}"></button>`).join('');
const customBtn = `<button class="sw custom" data-custom="1" title="自定义颜色" aria-label="自定义颜色"></button>`;
$('#swatchGrid').innerHTML = swBtns + customBtn;
$('#swatchStrip').innerHTML = customBtn + swBtns;   // on phones the custom swatch leads the strip, never scrolled away
let customColor = null;
function previewColor() {
  if (!engine.ctx || S.brush === 'eraser') return;
  const t = engine.ctx.currentTime;
  [0, 2, 4].forEach((p, i) => engine.note(timbreFor(S.color), midiFor(5 + p, S.color), t + i * .11, .22, .5, { bus: 'draw' }));
}
document.addEventListener('click', e => {
  const sw = e.target.closest('.sw'); if (!sw || sw.dataset.rc) return;
  engine.init();
  if (sw.dataset.custom) { openPicker(); return; }
  S.color = sw.dataset.c; if (S.brush === 'eraser') S.brush = 'pen'; updateUI(); previewColor();
});

// ───────── in-page colour picker (works in every browser and in-app webview) ─────────
const cp = { h: 330, s: .55, v: 1, before: null };
let recent = []; try { recent = JSON.parse(localStorage.getItem('dm-colors') || '[]').filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 8); } catch (e) { }
const hsv2hex = (h, s, v) => { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); };
function hex2hsv(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  let h = 0; if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: mx ? d / mx : 0, v: mx };
}
const cpHex = () => hsv2hex(cp.h, cp.s, cp.v);
function cpRender(fromHex) {
  const hex = cpHex(), sv = $('#cpSv');
  sv.style.setProperty('--hue', `hsl(${cp.h} 100% 50%)`);
  $('#cpThumb').style.left = cp.s * 100 + '%'; $('#cpThumb').style.top = (1 - cp.v) * 100 + '%'; $('#cpThumb').style.background = hex;
  const hue = $('#cpHue'); hue.value = Math.round(cp.h); hue.style.setProperty('--thumb', `hsl(${cp.h} 100% 50%)`);
  $('#cpPrev').style.background = hex;
  if (!fromHex) $('#cpHex').value = hex.slice(1).toUpperCase();
  const tim = timbreFor(hex);
  $('#cpRole').innerHTML = S.genre.pure ? `这个颜色会弹：<b>${PURE_LABEL[tim]}</b>` : `这个颜色会弹：<b>${ROLE_INFO[colorRole(hex)].icon} ${ROLE_INFO[colorRole(hex)].label} · ${TIMBRE_NAME[tim] || tim}</b>`;
}
function cpLive() { S.color = cpHex(); if (S.brush === 'eraser') S.brush = 'pen'; updateUI(); }
function cpRecent() {
  $('#cpRecentT').style.display = recent.length ? '' : 'none';
  $('#cpRecent').innerHTML = recent.map(c => `<button class="sw" data-rc="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('');
}
function openPicker() {
  cp.before = { color: S.color, brush: S.brush };
  Object.assign(cp, hex2hsv(customColor || (COLORS.some(([c]) => c === S.color) ? '#FF6FAE' : S.color)));
  closeSheets(); cpRender(); cpRecent(); cpLive();
  $('#colorModal').classList.add('on');
}
function closePicker(keep) {
  $('#colorModal').classList.remove('on');
  if (!keep) { S.color = cp.before.color; S.brush = cp.before.brush; updateUI(); return; }
  const hex = cpHex(); customColor = hex; S.color = hex; if (S.brush === 'eraser') S.brush = 'pen';
  recent = [hex, ...recent.filter(c => c.toLowerCase() !== hex.toLowerCase())].slice(0, 8);
  try { localStorage.setItem('dm-colors', JSON.stringify(recent)); } catch (e) { }
  updateUI(); previewColor();
}
(() => {
  const sv = $('#cpSv'); let id = null;
  const at = e => { const r = sv.getBoundingClientRect(); cp.s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); cp.v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)); cpRender(); cpLive(); };
  sv.addEventListener('pointerdown', e => { id = e.pointerId; sv.setPointerCapture(id); at(e); });
  sv.addEventListener('pointermove', e => { if (e.pointerId === id) at(e); });
  const up = e => { if (e.pointerId === id) { id = null; engine.init(); previewColor(); } };
  sv.addEventListener('pointerup', up); sv.addEventListener('pointercancel', up);
})();
$('#cpHue').addEventListener('input', e => { cp.h = +e.target.value; cpRender(); cpLive(); });
$('#cpHue').addEventListener('change', () => { engine.init(); previewColor(); });
$('#cpHex').addEventListener('input', e => {
  const v = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6); if (v !== e.target.value) e.target.value = v;
  const full = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
  if (full.length === 6) { Object.assign(cp, hex2hsv('#' + full)); cpRender(true); cpLive(); }
});
$('#cpHex').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') closePicker(true); });
$('#cpRecent').addEventListener('click', e => { const b = e.target.closest('[data-rc]'); if (!b) return; e.stopPropagation(); Object.assign(cp, hex2hsv(b.dataset.rc)); cpRender(); cpLive(); engine.init(); previewColor(); });
$('#cpOk').addEventListener('click', () => closePicker(true));
$('#cpCancel').addEventListener('click', () => closePicker(false));
$('#cpX').addEventListener('click', () => closePicker(false));
$('#colorModal').addEventListener('click', e => { if (e.target.id === 'colorModal') closePicker(false); });

$('#genreGrid').innerHTML = GENRES.map(g => `<button class="genre${g.pure ? ' pure' : ''}" data-g="${g.id}"><span class="ge">${g.emo}</span><div><b>${g.name}</b><small>${g.zh}</small></div></button>`).join('');
$('#genreGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-g]'); if (!b) return;
  engine.init(); setGenre(GENRES.find(g => g.id === b.dataset.g));
});
$('#moodRow').innerHTML = MOODS.map(m => `<button class="mood" data-m="${m.id}"><span>${m.emo}</span>${m.name}</button>`).join('');
$('#moodRow').addEventListener('click', e => {
  const b = e.target.closest('[data-m]'); if (!b) return;
  engine.init(); setMood(MOODS.find(m => m.id === b.dataset.m)); pet.advanceIf('mood');
});

$('#size').addEventListener('input', e => { S.size = +e.target.value; updateUI(); });
$('#opacity').addEventListener('input', e => { S.alpha = +e.target.value / 100; updateUI(); });
$('#bpm').addEventListener('input', e => { S.bpm = +e.target.value; seq.bpm = engine.bpm = S.bpm; applyFx(); pet.dance(seq.playing, S.bpm); updateUI(); });
$('#vol').addEventListener('input', e => { engine.setVolume(+e.target.value / 100); $('#volVal').textContent = e.target.value; });
$('#optBacking').addEventListener('change', e => { S.backing = e.target.checked; syncVinyl(); });
$('#optLive').addEventListener('change', e => { S.live = e.target.checked; });
$('#optEcho').addEventListener('change', e => { S.echo = e.target.checked; applyFx(); });

// icons
$$('[data-act="undo"].tool-btn, .dock [data-act="undo"] .db-ic').forEach(el => el.innerHTML = IC.undo);
$$('[data-act="redo"].tool-btn').forEach(el => el.innerHTML = IC.redo);
$$('[data-act="clear"].tool-btn').forEach(el => el.innerHTML = IC.trash);
$$('[data-act="upload"].tool-btn, .dock [data-act="upload"] .db-ic').forEach(el => el.innerHTML = IC.image);
$$('[data-act="nodes"].tool-btn').forEach(el => el.innerHTML = IC.grid);
$$('[data-act="save"].tool-btn').forEach(el => el.innerHTML = IC.save);
$('#mSet .db-ic').innerHTML = IC.sliders;
$('#helpBtn').innerHTML = IC.help;
$$('.sheet-x').forEach(el => el.innerHTML = IC.close);

// sheets (phone)
function openSheet(id) { closeSheets(); $(id).classList.add('open'); $('#scrim').classList.add('on'); }
function closeSheets() { $$('.sheet.open').forEach(s => s.classList.remove('open')); $('#scrim').classList.remove('on'); }
$('#mBrush').addEventListener('click', () => openSheet('#brushPanel'));
$('#mSet').addEventListener('click', () => openSheet('#setPanel'));
$('#genreChip').addEventListener('click', () => {
  if (isMobile()) openSheet('#genrePanel');
  else { const el = $('#genreGrid .genre.on'); el && el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('#genrePanel').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }], { duration: 300 }); }
});
$('#scrim').addEventListener('click', closeSheets);
$$('.sheet-x').forEach(b => b.addEventListener('click', closeSheets));

function updateUI() {
  $$('.brush').forEach(b => b.classList.toggle('on', b.dataset.brush === S.brush));
  const br = BRUSHES.find(b => b.id === S.brush);
  $('#brushDesc').textContent = `${br.name} · ${br.desc}`;
  $('#mBrushIc').innerHTML = IC[S.brush]; $('#mBrushName').textContent = br.name;
  $$('.sw:not([data-rc])').forEach(s => s.classList.toggle('on', s.dataset.c ? s.dataset.c.toLowerCase() === S.color.toLowerCase() && S.brush !== 'eraser' : (customColor && customColor === S.color && S.brush !== 'eraser')));
  $$('.sw.custom').forEach(s => customColor && s.style.setProperty('--c', customColor));
  const dot = $('#sizeDot'); dot.style.setProperty('--d', Math.max(3, S.size * .55) + 'px'); dot.style.setProperty('--c', S.color); dot.style.opacity = S.alpha;
  $('#opVal').textContent = Math.round(S.alpha * 100) + '%';
  const tim = timbreFor(S.color);
  let card;
  if (S.brush === 'eraser') card = `<span class="rc-emo">🧽</span><div><b>橡皮擦</b><span>擦掉的线条不会再发声</span></div>`;
  else if (S.genre.pure) { const [ic, ...nm] = PURE_LABEL[tim].split(' '); card = `<span class="rc-emo" style="background:${S.color}22;box-shadow:inset 0 0 0 2px ${S.color}">${ic}</span><div><b>${nm.join(' ')}</b><span>🤍 纯净模式：每种颜色一种乐器</span></div>`; }
  else { const ri = ROLE_INFO[colorRole(S.color)]; card = `<span class="rc-emo" style="background:${S.color}22;box-shadow:inset 0 0 0 2px ${S.color}">${ri.icon}</span><div><b>${ri.label} · ${TIMBRE_NAME[tim] || tim}</b><span>${S.genre.emo} ${S.genre.zh} 曲风下的音色</span></div>`; }
  $('#roleCard').innerHTML = card;
  $$('.genre').forEach(b => b.classList.toggle('on', b.dataset.g === S.genre.id));
  $$('.mood').forEach(b => b.classList.toggle('on', b.dataset.m === S.mood.id));
  $('#chipEmo').textContent = S.genre.emo;
  $('#chipName').innerHTML = S.genre.pure ? '纯净 无风格' : `<span class="en">${S.genre.name} </span>${S.genre.zh}`;
  $('#chipMood').innerHTML = `${S.mood.emo}<b>${S.mood.name}</b>`;
  $('#bpmVal').textContent = S.bpm; $('#bpmPill').textContent = `${S.bpm} BPM`;
  $('#optBacking').closest('.switch-row').classList.toggle('dim', !!S.genre.pure);
  $$('.play-btn').forEach(b => { b.classList.toggle('on', seq.playing); b.innerHTML = seq.playing ? IC.pause : IC.play; b.setAttribute('aria-label', seq.playing ? '暂停' : '播放'); });
  $$('[data-act="nodes"]').forEach(b => b.classList.toggle('on', S.nodes));
  $$('[data-act="undo"]').forEach(b => b.disabled = !undoS.length);
  $$('[data-act="redo"]').forEach(b => b.disabled = !redoS.length);
  $('#hint').classList.toggle('gone', items.length > 0);
}

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

// ───────── layout ─────────
function fit() {
  const st = $('#stage'), tr = $('.transport');
  const trH = isMobile() ? 0 : (tr.offsetHeight + 12);
  const aw = st.clientWidth, ah = st.clientHeight - trH;
  let w = aw, h = w * H / W;
  if (h > ah) { h = ah; w = h * W / H; }
  paper.style.width = Math.floor(w) + 'px'; paper.style.height = Math.floor(h) + 'px';
  const dock = $('.dock'); document.documentElement.style.setProperty('--dock-h', (isMobile() ? dock.offsetHeight : 0) + 'px');
}
new ResizeObserver(fit).observe($('#stage'));
addEventListener('resize', fit);

// ───────── image → line art ─────────
let pendingImg = null, importRes = null, importRun = 0;
$('#file').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  const img = new Image();
  img.onload = () => { pendingImg = img; $('#importModal').classList.add('on'); runImport(); };
  img.onerror = () => toast('这张图片打不开，换一张试试');
  img.src = URL.createObjectURL(f);
});
const detailLabel = v => v < 34 ? '简洁' : v < 67 ? '中' : '丰富';
async function runImport() {
  if (!pendingImg) return;
  const run = ++importRun;
  $('#importBusy').classList.add('on'); $('#importBusyText').textContent = '提取线稿中…'; $('#importOk').disabled = true;
  await new Promise(r => setTimeout(r, 30));
  try {
    const res = await extractLineArt(pendingImg, {
      W, H, personOnly: $('#impPerson').checked, colored: $('#impColor').checked, underlay: $('#impUnder').checked,
      detail: $('#impDetail').value / 100, status: t => run === importRun && ($('#importBusyText').textContent = t),
    });
    if (run !== importRun) return;
    importRes = res;
    const pv = $('#importPrev'); pv.width = W / 2; pv.height = H / 2;
    const x = pv.getContext('2d'); x.fillStyle = '#FFFEFA'; x.fillRect(0, 0, pv.width, pv.height); x.drawImage(res.canvas, 0, 0, pv.width, pv.height);
    $('#importHow').textContent = `识别方式：${res.how}`;
    $('#importOk').disabled = false;
  } catch (err) {
    console.error(err); toast('线稿提取失败了，换一张试试');
  } finally { if (run === importRun) $('#importBusy').classList.remove('on'); }
}
let impT;
['#impPerson', '#impColor', '#impUnder'].forEach(s => $(s).addEventListener('change', runImport));
$('#impDetail').addEventListener('input', e => { $('#impDetailVal').textContent = detailLabel(+e.target.value); clearTimeout(impT); impT = setTimeout(runImport, 250); });
const closeImport = () => { $('#importModal').classList.remove('on'); importRun++; };
$('#importX').addEventListener('click', closeImport);
$('#importAgain').addEventListener('click', () => $('#file').click());
$('#importOk').addEventListener('click', () => {
  if (!importRes) return;
  const it = { id: nextId++, type: 'image', canvas: importRes.canvas, mask: importRes.mask, colorAt: importRes.colorAt, brush: 'pen', size: 10, alpha: 1 };
  undoS.push(items); redoS = []; items = [...items, it];
  renderItem(it); renderMeta(it); rebuild();
  closeImport();
  if (!S.nodes) toggleNodes(); else updateUI();
  const count = segs.filter(s => s.id === it.id).length;
  pet.chat(`线稿描好啦！一共 ${count} 个音符节点，播放线扫过它们就会响～`, 5000);
  if (!seq.playing) togglePlay();
});

// ───────── pet + tour ─────────
const onScreen = el => { if (!el || !el.getClientRects().length) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.top < innerHeight - 20 && r.bottom > 20 && r.left < innerWidth && r.right > 0; };
const vis = (...sels) => () => sels.map(s => $(s)).find(onScreen);
const TOUR = [
  { text: '嗨！我是霜糖～这是一张会唱歌的画布：你画下的每一笔，都会变成一段旋律哦！' },
  { target: vis('#paper'), text: '📄 从左到右是时间，越往上音越高。一条线就是一个声音，跟着你的笔走：波浪线会唱起伏的旋律！现在画一笔试试～', waitFor: 'stroke' },
  { target: vis('#swatchGrid', '#swatchStrip'), text: '🎨 颜色决定乐器：暖色唱主旋律，绿色是琴，蓝紫是长音，深色是低音，白色叮咚响。点一下颜色就能先听听～' },
  { target: vis('#brushGrid', '#mBrush'), text: '🖌️ 笔刷决定怎么演奏：铅笔蹦蹦跳，蜡笔打节奏，水彩拉长变柔，星星和喷枪会撒铃音～' },
  { target: vis('#genrePanel', '#genreChip'), text: '🎶 选一个曲风！第一个「纯净」没有伴奏，只有你画的声音；中国风是竹笛唱主角哦。' },
  { target: vis('#moodRow', '#genreChip'), text: '🌈 每种曲风都能换情绪：激昂热血、愉悦欢快、温柔宁静、悲伤忧郁、紧张悬疑、慵懒松弛～' },
  { target: vis('.transport .play-btn', '.dock .play-btn'), text: '▶️ 点播放！黄色播放线从左扫到右，把你的画唱出来，再点一下就暂停。', waitFor: 'play' },
  { target: vis('#uploadDesk', '#uploadMob'), text: '🖼️ 还可以上传人物图片，我帮你描成线稿，按线稿上的节点来演奏！' },
  { text: '准备好啦！点我可以听更多小技巧，按住我还能把我拖到别的地方～' },
];
const pet = new Pet($('#pet'), { onTourStep: () => { if (isMobile()) closeSheets(); } });
$('#helpBtn').addEventListener('click', () => { closeSheets(); pet.startTour(TOUR); });

// ───────── boot ─────────
drawBg(); updateUI(); fit(); requestAnimationFrame(frame);
setGenre(S.genre, true); rebuild();
let seen = false; try { seen = localStorage.getItem('dm-tour2') === '1'; } catch (e) { }
setTimeout(() => seen ? pet.chat('欢迎回来～我是霜糖，今天想画一首什么歌？', 3500) : pet.startTour(TOUR), 700);
window.__dm = { S, items: () => items, segs: () => segs, engine, seq, setGenre, setMood, GENRES, MOODS };

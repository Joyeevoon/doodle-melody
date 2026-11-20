// Brush definitions and deterministic stroke rendering.

export const BRUSHES = [
  { id: 'pen',    name: '钢笔',   play: '连奏长音',   desc: '圆润稳定的线条，每一笔都是连贯的长音' },
  { id: 'pencil', name: '铅笔',   play: '短促跳音',   desc: '颗粒细线，弹出轻快的跳音' },
  { id: 'ink',    name: '毛笔',   play: '力度起伏',   desc: '画得快笔锋细、画得慢笔锋粗，音量随之起伏' },
  { id: 'marker', name: '马克笔', play: '八度加厚',   desc: '扁平半透明，叠加低八度让声音更厚' },
  { id: 'water',  name: '水彩',   play: '柔和延音',   desc: '晕染柔边，音符拉长、混响更深' },
  { id: 'crayon', name: '蜡笔',   play: '节奏连打',   desc: '粗糙质感，长音会被切成跳动的节奏' },
  { id: 'spray',  name: '喷枪',   play: '闪光装饰音', desc: '雾状颗粒，撒下一串轻巧的琶音' },
  { id: 'neon',   name: '霓虹',   play: '回声延迟',   desc: '发光线条，带着高八度的回声' },
  { id: 'star',   name: '星星',   play: '叮咚铃音',   desc: '星星印章，每颗都加一声铃' },
  { id: 'eraser', name: '橡皮',   play: '擦掉音符',   desc: '擦掉线条，也擦掉对应的音符' },
];

// composite alpha for brushes drawn on a scratch layer first
export const LAYERED = { marker: .55, water: .42 };

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function starPath(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * .45 : r, a = rot + i * Math.PI / 5 - Math.PI / 2;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** state = { rng, acc } ; draws the segment ending at point index i (i >= 1), or a dot when i===0 */
export function drawSeg(ctx, s, i, st) {
  const P = s.pts, b = P[i], a = P[Math.max(0, i - 1)], z = P[Math.max(0, i - 2)];
  const m1 = { x: (z.x + a.x) / 2, y: (z.y + a.y) / 2 }, m2 = i === 0 ? b : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const size = s.size, R = st.rng;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle = s.color;
  if (s.brush !== 'eraser' && !LAYERED[s.brush]) ctx.globalAlpha = s.alpha;
  const curve = () => { ctx.beginPath(); if (i === 0) { ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + .01, b.y); } else { ctx.moveTo(m1.x, m1.y); ctx.quadraticCurveTo(a.x, a.y, m2.x, m2.y); } ctx.stroke(); };
  const walk = (step, fn) => {
    const dx = m2.x - m1.x, dy = m2.y - m1.y, d = Math.hypot(dx, dy);
    if (i === 0) { fn(b.x, b.y, b.w); return; }
    st.acc = (st.acc || 0) + d;
    while (st.acc >= step) { st.acc -= step; const k = d ? 1 - st.acc / d : 1; fn(m1.x + dx * Math.min(1, k), m1.y + dy * Math.min(1, k), a.w + (b.w - a.w) * k); }
  };
  switch (s.brush) {
    case 'pen': ctx.lineWidth = size * (a.w + b.w) / 2; curve(); break;
    case 'pencil': {
      ctx.lineWidth = Math.max(1.2, size * .32); ctx.globalAlpha *= .85; curve();
      ctx.globalAlpha = s.alpha * .35;
      walk(2, (x, y) => { for (let k = 0; k < 2; k++) ctx.fillRect(x + (R() - .5) * size * .7, y + (R() - .5) * size * .7, 1.2, 1.2); });
      break;
    }
    case 'ink': walk(1, (x, y, w) => { ctx.beginPath(); ctx.arc(x, y, Math.max(.6, size * .55 * w), 0, 6.283); ctx.fill(); }); break;
    case 'marker': ctx.lineCap = 'square'; ctx.lineWidth = size * 1.5; curve(); break;
    case 'water': ctx.shadowColor = s.color; ctx.shadowBlur = size * .9; ctx.lineWidth = size * 2; curve(); break;
    case 'crayon': {
      const r = size * .6;
      walk(1.4, (x, y) => { for (let k = 0; k < Math.max(3, size * .5); k++) { ctx.globalAlpha = s.alpha * (.35 + R() * .6); const ang = R() * 6.283, rr = Math.sqrt(R()) * r; ctx.fillRect(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, 1 + R() * 1.6, 1 + R() * 1.6); } });
      break;
    }
    case 'spray': {
      const r = size * 1.7;
      walk(2, (x, y) => { for (let k = 0; k < size * .9 + 3; k++) { const ang = R() * 6.283, rr = r * Math.sqrt(R()) * (R() < .7 ? .7 : 1); ctx.globalAlpha = s.alpha * (.3 + R() * .6); ctx.beginPath(); ctx.arc(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, .5 + R() * 1.1, 0, 6.283); ctx.fill(); } });
      break;
    }
    case 'neon': {
      // core on top, body and glow slide underneath so joints never cover the core
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(1, size * .28); curve();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.strokeStyle = s.color; ctx.lineWidth = size * .9; curve();
      ctx.shadowColor = s.color; ctx.shadowBlur = size * 1.6; ctx.lineWidth = size * .7; curve();
      break;
    }
    case 'star': {
      walk(size * 1.9 + 6, (x, y) => {
        const r = size * (.6 + R() * .6) + 3, rot = R() * 1.2;
        starPath(ctx, x, y, r, rot); ctx.fill();
        ctx.globalAlpha = s.alpha * .9; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(x - r * .2, y - r * .2, r * .16, 0, 6.283); ctx.fill(); ctx.fillStyle = s.color; ctx.globalAlpha = s.alpha;
      });
      break;
    }
    case 'eraser': ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = size * 1.6; curve(); break;
  }
  ctx.restore();
}

// last half-segment so the stroke reaches its final point
export function drawTail(ctx, s, st) {
  const n = s.pts.length; if (n < 2) return;
  const fake = { ...s, pts: [s.pts[n - 2], s.pts[n - 1], s.pts[n - 1]] };
  drawSeg(ctx, fake, 2, st);
}

/** coarse "id" footprint for the note map (exact colours, no transparency inside) */
export function metaWidth(s) {
  return { pen: s.size, pencil: Math.max(6, s.size * .5), ink: s.size * .9, marker: s.size * 1.5, water: s.size * 2, crayon: s.size * 1.2, spray: s.size * 2.2, neon: s.size, star: s.size * 2, eraser: s.size * 1.6 }[s.brush] || s.size;
}

export function idColor(id) { return `rgb(${id & 255},${(id >> 8) & 255},77)`; }

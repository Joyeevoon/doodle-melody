// 音音 — the desk pet who teaches the game.

const TIPS = [
  '横着画一条线，就是一个长长的音～',
  '画波浪线，旋律就会跟着起起伏伏！',
  '竖着画一笔，会同时响好几个音，像弹和弦！',
  '同一幅画换个曲风，会变成完全不同的歌哦！',
  '试试「紧张悬疑」，心跳声会响起来…',
  '中国风里，红色和黑色都是竹笛和洞箫在吹～',
  '「纯净」模式没有伴奏，最适合慢慢画、静静听。',
  '点一下颜色，我会先弹给你听它是什么乐器～',
  '橡皮擦掉的线，音符也会一起消失～',
  '上传一张人物图，我帮你描成线稿再唱出来！',
  '打开「节点」，就能看到每个音符在哪里。',
];

export class Pet {
  constructor(root, { onTourStep } = {}) {
    this.root = root; this.onTourStep = onTourStep;
    this.bubble = root.querySelector('.pet-bubble');
    this.text = root.querySelector('.pet-text');
    this.actions = root.querySelector('.pet-actions');
    this.img = root.querySelector('.pet-img');
    this.spot = document.getElementById('spotlight');
    this.tourSteps = null; this.tourIdx = -1; this.hideT = null; this.tipIdx = 0;
    this._drag();
    window.addEventListener('resize', () => { this._clamp(); if (this.tourIdx >= 0) this._spotlight(); });
  }

  say(text, ms = 4200, actions = null) {
    clearTimeout(this.hideT);
    this.text.textContent = text;
    this.actions.innerHTML = '';
    if (actions) actions.forEach(([label, fn, primary]) => {
      const b = document.createElement('button'); b.className = 'pet-btn' + (primary ? ' primary' : ''); b.textContent = label;
      b.addEventListener('click', e => { e.stopPropagation(); fn(); }); this.actions.appendChild(b);
    });
    this.root.classList.add('talking');
    this.img.classList.remove('hop'); void this.img.offsetWidth; this.img.classList.add('hop');
    if (ms) this.hideT = setTimeout(() => this.root.classList.remove('talking'), ms);
  }
  // casual chatter stays quiet while the guided tour is talking
  chat(text, ms) { if (!this.touring) this.say(text, ms); }
  hush() { this.root.classList.remove('talking'); }

  tip() { this.say(TIPS[this.tipIdx++ % TIPS.length], 4600); }

  dance(on, bpm = 100) {
    this.root.style.setProperty('--beat', (60 / bpm) + 's');
    this.root.classList.toggle('dancing', on);
  }

  note(color) {
    const n = document.createElement('span'); n.className = 'pet-note'; n.textContent = Math.random() < .5 ? '♪' : '♫';
    n.style.color = color; n.style.left = (30 + Math.random() * 40) + '%';
    this.root.querySelector('.pet-body').appendChild(n);
    setTimeout(() => n.remove(), 1200);
  }

  // ── guided tour ──
  startTour(steps) { this.tourSteps = steps; this.tourIdx = -1; this.next(); }
  get touring() { return this.tourIdx >= 0; }
  next() {
    this.tourIdx++;
    const st = this.tourSteps[this.tourIdx];
    if (!st) return this.endTour(true);
    const last = this.tourIdx === this.tourSteps.length - 1;
    const acts = [];
    if (!last) acts.push(['跳过', () => this.endTour(false)]);
    acts.push([last ? '开始玩！' : '下一步', () => this.next(), true]);
    this.say(`${st.text}`, 0, acts);
    this.root.querySelector('.pet-step').textContent = `${this.tourIdx + 1}/${this.tourSteps.length}`;
    this.root.classList.add('touring');
    this._spotlight();
    this.onTourStep && this.onTourStep(st);
  }
  advanceIf(event) {
    const st = this.tourSteps && this.tourSteps[this.tourIdx];
    if (st && st.waitFor === event) setTimeout(() => this.next(), 500);
  }
  endTour(done) {
    this.tourIdx = -1; this.root.classList.remove('touring');
    this.spot.classList.remove('on');
    try { localStorage.setItem('dm-tour2', '1'); } catch (e) { }
    this.say(done ? '随时点我，我会告诉你更多小技巧～' : '好哒！想再听玩法就点我或右上角的「?」～', 3800);
  }
  _spotlight() {
    const st = this.tourSteps && this.tourSteps[this.tourIdx];
    const el = st && st.target && st.target();
    if (!el) { this.spot.classList.remove('on'); return; }
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(this.spot.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    this.spot.classList.add('on');
  }

  // ── drag to move ──
  _drag() {
    const body = this.root.querySelector('.pet-body');
    let sx, sy, ox, oy, moved = false, id = null;
    body.addEventListener('pointerdown', e => {
      id = e.pointerId; body.setPointerCapture(id); moved = false;
      const r = this.root.getBoundingClientRect(); sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
    });
    body.addEventListener('pointermove', e => {
      if (id !== e.pointerId) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true;
      this.root.style.left = ox + dx + 'px'; this.root.style.top = oy + dy + 'px';
      this.root.style.right = 'auto'; this.root.style.bottom = 'auto';
      this.root.classList.toggle('flip', ox + dx < window.innerWidth / 2);
    });
    body.addEventListener('pointerup', e => {
      if (id !== e.pointerId) return; id = null;
      if (moved) { this._clamp(); return; }
      if (this.touring) this.next();
      else this.tip();
    });
  }
  _clamp() {
    if (!this.root.style.left || this.root.style.left === 'auto') return;
    const r = this.root.getBoundingClientRect();
    this.root.style.left = Math.max(4, Math.min(window.innerWidth - r.width - 4, r.left)) + 'px';
    this.root.style.top = Math.max(4, Math.min(window.innerHeight - r.height - 4, r.top)) + 'px';
  }
}

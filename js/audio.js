// Web Audio engine: line-following voices, drums, effects, lookahead sequencer.
import { TIMBRES } from './genres.js';

export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const loudness = (f, low) => {
  if (f < 330) return Math.min(low ? 2.1 : 1.6, Math.pow(330 / Math.max(f, 40), low ? .45 : .3));
  if (f > 1400) return Math.pow(1400 / f, .15);
  return 1;
};

class Voice {
  constructor(E, spec, midi, t, vel, o) {
    const ctx = E.ctx; this.E = E; this.s = spec; this.t0 = t; this.m0 = this.cur = midi; this.nodes = [];
    const f = mtof(midi);
    this.peak = vel * spec.g * loudness(f, spec.low);
    const env = spec.env; this.atk = env[0]; this.tau = env[1]; this.floor = env[2]; this.rel = env[3] * (o.relMul || 1);
    const out = E.route(o);
    const amp = this.amp = ctx.createGain(); amp.gain.value = 0;
    if (spec.trem) {
      // tremolo multiplies after the envelope, so it falls silent with it
      const tn = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      tn.gain.value = 1 - spec.trem[1] / 2; l.frequency.value = spec.trem[0]; lg.gain.value = spec.trem[1] / 2;
      l.connect(lg); lg.connect(tn.gain); amp.connect(tn); tn.connect(out); this.nodes.push(l);
    } else amp.connect(out);
    let head = amp;
    if (spec.drive) {
      const ws = ctx.createWaveShaper(); ws.curve = E.curve(spec.drive); ws.connect(head); head = ws;
    }
    const lpS = spec.lp ? (typeof spec.lp === 'number' ? { f: spec.lp, q: .5 } : spec.lp) : null;
    if (lpS) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = lpS.q ?? .5;
      const cut = Math.min(lpS.f * (o.bright || 1), 16000);
      if (lpS.env) { lp.frequency.setValueAtTime(Math.min(cut + lpS.env * vel, 16000), t); lp.frequency.setTargetAtTime(cut, t + .005, lpS.tau); }
      else lp.frequency.value = cut;
      lp.connect(head); head = lp;
    }
    if (spec.peak) {
      const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = spec.peak[0]; pk.gain.value = spec.peak[1]; pk.Q.value = spec.peak[2];
      pk.connect(head); head = pk;
    }
    let mix = head;
    if (spec.formants) {
      mix = ctx.createGain();
      const body = ctx.createGain(); body.gain.value = spec.body || 0; mix.connect(body); body.connect(head);
      spec.formants.forEach(([fr, q, g]) => {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q;
        const gg = ctx.createGain(); gg.gain.value = g * 2.2; mix.connect(bp); bp.connect(gg); gg.connect(head);
      });
    }
    // one pitch control (cents) drives every oscillator: the line glides by moving it
    const pc = this.pc = ctx.createConstantSource(); pc.offset.value = 0; this.nodes.push(pc);
    if (spec.grace && o.grace !== false) { pc.offset.setValueAtTime(-spec.grace * 100, t); pc.offset.setTargetAtTime(0, t + .012, .022); }
    const oscs = [];
    spec.osc.forEach((d, i) => {
      const osc = ctx.createOscillator();
      if (Array.isArray(d.w)) osc.setPeriodicWave(E.wave(d.w)); else osc.type = d.w || 'sine';
      const fr = f * (d.r || 1);
      if (spec.drop && i === 0) { osc.frequency.setValueAtTime(fr * Math.pow(2, spec.drop[0] / 12), t); osc.frequency.exponentialRampToValueAtTime(fr, t + spec.drop[1]); }
      else osc.frequency.value = fr;
      osc.detune.value = d.det || 0; pc.connect(osc.detune);
      const g = ctx.createGain(), lv = d.g ?? 1;
      if (d.dec) { g.gain.setValueAtTime(lv, t); g.gain.setTargetAtTime(lv * d.dec[1], t, d.dec[0]); } else g.gain.value = lv;
      osc.connect(g); g.connect(mix); oscs.push(osc); this.nodes.push(osc);
    });
    if (spec.fm) {
      const m = ctx.createOscillator(), mg = ctx.createGain(), dev = spec.fm.i * f * spec.fm.r;
      m.frequency.value = f * spec.fm.r; pc.connect(m.detune);
      mg.gain.setValueAtTime(dev * (.6 + .6 * vel), t); mg.gain.setTargetAtTime(dev * spec.fm.dec[1], t, spec.fm.dec[0]);
      m.connect(mg); mg.connect(oscs[0].frequency); this.nodes.push(m);
    }
    if (spec.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = spec.vib[0];
      lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + spec.vib[2]); lg.gain.linearRampToValueAtTime(spec.vib[1], t + spec.vib[2] + .35);
      l.connect(lg); oscs.forEach(x => lg.connect(x.detune)); this.nodes.push(l);
    }
    if (spec.noise) {
      const n = ctx.createBufferSource(); n.buffer = E.noise; n.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(f * spec.noise.r, 12000); bp.Q.value = spec.noise.q;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(spec.noise.g * 1.8, t); ng.gain.setTargetAtTime(spec.noise.g, t + .03, .08);
      n.connect(bp); bp.connect(ng); ng.connect(mix); this.nodes.push(n); this._noiseOff = Math.random();
    }
    const g = amp.gain;
    g.setValueAtTime(0, t); g.linearRampToValueAtTime(this.peak, t + this.atk);
    if (this.floor < 1) g.setTargetAtTime(this.peak * this.floor, t + this.atk, this.tau);
    this.nodes.forEach(n => n.start(t, n.buffer ? this._noiseOff : undefined));
    E.voices.add(this);
  }
  envAt(t) {
    const dt = t - this.t0;
    if (dt <= this.atk) return this.peak * Math.max(0, dt) / this.atk;
    if (this.floor >= 1) return this.peak;
    const fl = this.peak * this.floor;
    return fl + (this.peak - fl) * Math.exp(-(dt - this.atk) / this.tau);
  }
  to(midi, t, porta) {
    if (midi === this.cur || this.ended) return;
    this.cur = midi;
    this.pc.offset.setTargetAtTime((midi - this.m0) * 100, t, Math.max(.003, (porta ?? this.s.porta ?? .006) / 3));
  }
  end(t) {
    if (this.ended) return; this.ended = true;
    t = Math.max(t, this.t0 + .02);
    const g = this.amp.gain, v = this.envAt(t);
    g.cancelScheduledValues(t); g.setValueAtTime(v, t); g.setTargetAtTime(0, t, this.rel / 3);
    const stop = t + this.rel * 2 + .05;
    this.nodes.forEach(n => { try { n.stop(stop); } catch (e) { } });
    const ms = (stop - this.E.ctx.currentTime) * 1000 + 100;
    setTimeout(() => { this.E.voices.delete(this); try { this.amp.disconnect(); } catch (e) { } }, Math.max(50, ms));
  }
}

// plucked string; struck only
class KSVoice {
  constructor(E, spec, midi, t, vel, o) {
    const ctx = E.ctx, K = spec.ks; this.E = E; this.t0 = t; this.cur = midi;
    const { buf, rate, sec } = E.ksBuf(K, Math.round(midi));
    const src = this.src = ctx.createBufferSource(); src.buffer = buf;
    if (K.bend) { src.playbackRate.setValueAtTime(rate * Math.pow(2, K.bend / 12), t); src.playbackRate.setTargetAtTime(rate, t + .02, .05); }
    else src.playbackRate.value = rate;
    const amp = this.amp = ctx.createGain(); this.peak = vel * spec.g * loudness(mtof(midi), spec.low); amp.gain.value = this.peak;
    let head = src;
    if (K.lowpass) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = K.lowpass; src.connect(lp); head = lp; }
    head.connect(amp); amp.connect(E.route(o));
    this.nodes = [src];
    if (K.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = K.vib[0]; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(K.vib[1], t + K.vib[2] + .3); l.connect(lg); lg.connect(src.detune); this.nodes.push(l); }
    this.nodes.forEach(n => n.start(t));
    if (K.chorus) { const s2 = ctx.createBufferSource(); s2.buffer = buf; s2.playbackRate.value = rate * 1.004; const g2 = ctx.createGain(); g2.gain.value = .5; s2.connect(g2); g2.connect(amp); s2.start(t + .012); this.nodes.push(s2); }
    this.sec = sec; this.rel = .25 * (o.relMul || 1);
    E.voices.add(this);
  }
  to() { }
  end(t) {
    if (this.ended) return; this.ended = true;
    t = Math.max(t, this.t0 + .12);
    const g = this.amp.gain; g.setValueAtTime(this.peak, t); g.setTargetAtTime(0, t, this.rel / 2);
    const stop = Math.min(this.t0 + this.sec, t + this.rel * 3);
    this.nodes.forEach(n => { try { n.stop(stop); } catch (e) { } });
    setTimeout(() => { this.E.voices.delete(this); try { this.amp.disconnect(); } catch (e) { } }, Math.max(50, (stop - this.E.ctx.currentTime) * 1000 + 100));
  }
}

export class Engine {
  constructor() { this.ctx = null; this.vol = .8; this.ksCache = new Map(); this.waves = new Map(); this.curves = new Map(); this.voices = new Set(); this.bpm = 110; }

  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    const ctx = this.ctx = new C({ latencyHint: 'interactive' });
    this.master = ctx.createGain(); this.master.gain.value = this.vol;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = .005; comp.release.value = .25;
    const clip = ctx.createWaveShaper(), n = 2048, cv = new Float32Array(n);
    // soft saturation: unity for quiet signals, rounds peaks off instead of clipping
    for (let i = 0; i < n; i++) { const x = (i / (n - 1) * 2 - 1) * 3; cv[i] = x * (27 + x * x) / (27 + 9 * x * x); }
    clip.curve = cv; const pre = ctx.createGain(); pre.gain.value = 1 / 3;
    this.master.connect(comp); comp.connect(pre); pre.connect(clip); clip.connect(ctx.destination);
    this.tone = ctx.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 18000; this.tone.Q.value = .4;
    this.tone.connect(this.master);
    this.drawBus = ctx.createGain(); this.drawBus.gain.value = .8; this.drawBus.connect(this.tone);
    this.duck = ctx.createGain(); this.duck.connect(this.tone);
    this.backBus = ctx.createGain(); this.backBus.gain.value = .5; this.backBus.connect(this.duck);
    this.drumBus = ctx.createGain(); this.drumBus.gain.value = .36; this.drumBus.connect(this.tone);
    // reverb
    this.rev = ctx.createConvolver(); this.rev.buffer = this._ir(2.6, 2.8);
    this.revSend = ctx.createGain(); this.revSend.gain.value = .2;
    const revOut = ctx.createGain(); revOut.gain.value = .9;
    this.revSend.connect(this.rev); this.rev.connect(revOut); revOut.connect(this.master);
    // echo: lows are stripped from each repeat so it never muds up
    this.dl = ctx.createDelay(2); this.dlFb = ctx.createGain(); this.dlFb.gain.value = .3;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    this.delSend = ctx.createGain(); this.delSend.gain.value = .15;
    this.delSend.connect(this.dl); this.dl.connect(hp); hp.connect(lp); lp.connect(this.dlFb); this.dlFb.connect(this.dl);
    const dOut = ctx.createGain(); dOut.gain.value = .55; lp.connect(dOut); dOut.connect(this.master);
    this.noise = this._noiseBuf(2);
  }

  setVolume(v) { this.vol = v; if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, .05); }
  setFx({ rev, del, lp, echo }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.revSend.gain.setTargetAtTime(Math.max(0, rev), t, .1);
    this.delSend.gain.setTargetAtTime(echo === false ? 0 : Math.max(0, del), t, .1);
    this.dl.delayTime.setTargetAtTime(Math.min(1.9, 60 / this.bpm * .75), t, .05);
    this.tone.frequency.setTargetAtTime(lp || 18000, t, .1);
  }

  wave(p) {
    const k = p.join(','); if (this.waves.has(k)) return this.waves.get(k);
    const re = new Float32Array(p.length + 1), im = new Float32Array(p.length + 1);
    p.forEach((a, i) => im[i + 1] = a);
    const w = this.ctx.createPeriodicWave(re, im); this.waves.set(k, w); return w;
  }
  curve(k) {
    if (this.curves.has(k)) return this.curves.get(k);
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    this.curves.set(k, c); return c;
  }
  _ir(sec, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) { lp = lp * .6 + (Math.random() * 2 - 1) * .4; d[i] = lp * Math.pow(1 - i / len, decay); }
    }
    return b;
  }
  _noiseBuf(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  ksBuf(K, midi) {
    const key = [K.bright, K.damp, K.buzz || 0, midi].join(':');
    if (this.ksCache.has(key)) return this.ksCache.get(key);
    const sr = this.ctx.sampleRate, f = mtof(midi), N = Math.max(2, Math.floor(sr / f - .5));
    const sec = Math.min(4, 1.2 + 260 / f), len = Math.floor(sr * sec);
    const buf = this.ctx.createBuffer(1, len, sr), y = buf.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; lp = lp + (r - lp) * (.25 + K.bright * .75); y[i] = lp; }
    const damp = Math.pow(K.damp, 440 / Math.max(f, 60) * .35 + .65);
    for (let i = N; i < len; i++) {
      let v = damp * .5 * (y[i - N] + y[Math.max(0, i - N - 1)]);
      if (K.buzz) v = Math.tanh(v * K.buzz * .25) / (K.buzz * .25) * .98 + v * .02;
      y[i] = v;
    }
    let pk = 0; for (let i = 0; i < Math.min(len, N * 4); i++) pk = Math.max(pk, Math.abs(y[i]));
    if (pk > 0) for (let i = 0; i < len; i++) y[i] /= pk;
    const res = { buf, rate: f * (N + .5) / sr, sec };
    if (this.ksCache.size > 400) this.ksCache.clear();
    this.ksCache.set(key, res); return res;
  }

  // per-voice output: pan + reverb/echo sends
  route(o) {
    const ctx = this.ctx, p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (p.pan) p.pan.value = Math.max(-1, Math.min(1, o.pan || 0));
    p.connect(o.bus === 'back' ? this.backBus : this.drawBus);
    const r = ctx.createGain(); r.gain.value = o.rev ?? 1; p.connect(r); r.connect(this.revSend);
    const d = ctx.createGain(); d.gain.value = o.del ?? (o.bus === 'back' ? .3 : 1); p.connect(d); d.connect(this.delSend);
    return p;
  }

  /** start a voice; call .to(midi,t) to glide, .end(t) to release */
  voice(name, midi, t, vel = .8, o = {}) {
    if (!this.ctx) return null;
    if (this.voices.size > 140 && o.bus === 'back') return null;
    const spec = TIMBRES[name] || TIMBRES.keys;
    t = Math.max(t, this.ctx.currentTime + .004);
    return spec.ks ? new KSVoice(this, spec, midi, t, vel, o) : new Voice(this, spec, midi, t, vel, o);
  }
  note(name, midi, t, dur, vel = .8, o = {}) { const v = this.voice(name, midi, t, vel, o); if (v) v.end(t + dur); return v; }
  isSustained(name) { const s = TIMBRES[name]; return !!(s && s.sus); }

  releaseAll() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + .01;
    [...this.voices].forEach(v => { if (v.live) return; v.ended = false; v.rel = Math.min(v.rel, .15); v.end(t); });
  }

  // ───────────── drums ─────────────
  drum(kind, t, vel = 1, side) {
    const ctx = this.ctx; if (!ctx) return;
    t = Math.max(t, ctx.currentTime + .003);
    const out = ctx.createGain(); out.gain.value = vel; out.connect(this.drumBus);
    setTimeout(() => out.disconnect(), (t - ctx.currentTime + 2) * 1000);
    const noise = (hp, lp, dec, g, start = t, q = .7) => {
      const n = ctx.createBufferSource(); n.buffer = this.noise;
      const f1 = ctx.createBiquadFilter(); f1.type = hp ? 'highpass' : 'bandpass'; f1.frequency.value = hp || lp; f1.Q.value = q;
      const a = ctx.createGain(); a.gain.setValueAtTime(g, start); a.gain.exponentialRampToValueAtTime(.0005, start + dec);
      n.connect(f1); f1.connect(a); a.connect(out); n.start(start, Math.random() * 1.5); n.stop(start + dec + .02);
    };
    const tone = (type, f0, f1, dec, g, bendT = .08) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + bendT);
      const a = ctx.createGain(); a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(.0005, t + dec);
      o.connect(a); a.connect(out); o.start(t); o.stop(t + dec + .02);
    };
    switch (kind) {
      case 'k': tone('sine', 150, 46, .4, 1.1, .1); tone('triangle', 700, 110, .02, .18, .02);
        if (side) { const g = this.duck.gain; g.cancelScheduledValues(t); g.setValueAtTime(.35, t); g.linearRampToValueAtTime(1, t + 60 / this.bpm * .45); }
        break;
      case 's': noise(1800, 0, .16, .45); tone('triangle', 220, 170, .09, .35); break;
      case 'c': [0, .011, .022].forEach(d => noise(0, 1300, .03, .5, t + d, 1.2)); noise(0, 1300, .18, .32, t + .03, 1.2); break;
      case 'h': noise(8000, 0, .035, .2); break;
      case 'hf': noise(6500, 0, .05, .15); break;
      case 'o': noise(7500, 0, .25, .14); break;
      case 'cr': noise(5000, 0, 1.2, .16); break;
      case 'ri': noise(6500, 0, .4, .07); [1, 1.48, 1.92].forEach(r => tone('square', 520 * r, 520 * r, .4, .014)); break;
      case 'r': tone('triangle', 1700, 1600, .035, .4); noise(0, 2500, .02, .22); break;
      case 'sh': noise(0, 6500, .06, .18, t, 1.5); break;
      case 'ta': tone('sine', 380, 410, .3, .5, .05); tone('sine', 760, 770, .12, .12); break;
      case 'na': tone('sine', 620, 640, .18, .3); noise(0, 3000, .03, .2); break;
      case 'tk': tone('sine', 140, 85, .5, .85, .2); noise(0, 300, .06, .25); break;
      case 'w': tone('sine', 1100, 1050, .05, .45, .02); tone('triangle', 2200, 2100, .025, .1, .02); break;
      case 'fb': [1, 1.37, 2.13, 2.76].forEach((r, i) => tone('sine', 300 * r, 290 * r, 1.4 - i * .3, .07)); break;
      case 'tom': tone('sine', 190, 110, .3, .7, .12); break;
    }
  }

  startVinyl(on) {
    if (!this.ctx) return;
    if (this.vinyl) { try { this.vinyl.stop(); } catch (e) { } this.vinyl = null; }
    if (!on) return;
    const ctx = this.ctx, len = ctx.sampleRate * 3, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * .012 + (Math.random() < .0003 ? (Math.random() * 2 - 1) * .5 : 0);
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = .5;
    const g = ctx.createGain(); g.gain.value = .4; s.connect(f); f.connect(g); g.connect(this.master); s.start();
    this.vinyl = s;
  }
}

// ───────────── sequencer ─────────────
export class Sequencer {
  constructor(engine) { this.e = engine; this.playing = false; this.step = 0; this.bpm = 108; this.onStep = null; this.timer = null; }
  get stepDur() { return 60 / this.bpm / 4; }
  start() {
    const ctx = this.e.ctx; if (!ctx) return;
    this.playing = true; this.step = 0; this.next = ctx.currentTime + .08;
    const tick = () => {
      while (this.next < ctx.currentTime + .14) {
        this.onStep && this.onStep(this.step, this.next);
        this.next += this.stepDur; this.step++;
      }
    };
    tick(); this.timer = setInterval(tick, 25);
  }
  stop() { this.playing = false; clearInterval(this.timer); this.timer = null; }
}

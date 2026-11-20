// Timbres, genres, moods, colours.
//
// Sound model: every stroke is a voice that follows the line. Pitch comes
// from a five-note scale, so any pile of lines stays consonant.
//
// Timbre spec
//   osc:   [{ w: 'sine'|'triangle'|'square'|'sawtooth'|[partials], r: ratio, g: gain, det: cents, dec: [tau, floor] }]
//   fm:    { r, i, dec: [tau, floor] }          modulator on the first osc
//   noise: { g, r, q }                          breath (band-passed noise)
//   formants: [[freq, q, gain]], body           vowel filter bank
//   lp:    cutoff | { f, q, env, tau }          low-pass, optional filter envelope
//   peak:  [freq, dB, q]
//   env:   [attack, decayTau, floor, release]   floor 1 = sustained
//   vib:   [rate, cents, delay]   trem: [rate, depth]
//   porta: glide seconds    grace: semitones up into the first note
//   sus:   true → glides along the line;  false → re-strikes on each new pitch
//   ks:    plucked string (Karplus-Strong)

export const TIMBRES = {
  // ── struck ──
  keys:     { osc: [{ w: 'sine' }, { w: [0, .38, .14, .05], dec: [.3, .12] }], lp: 4200, env: [.005, .7, .4, .25], g: .5 },
  piano:    { osc: [{ w: 'sine' }, { w: 'sine', det: 4, g: .35 }, { w: [0, .5, .25, .12, .06, .03], dec: [.25, .08] }], lp: 5000, env: [.003, .9, .22, .3], g: .42 },
  ep:       { osc: [{ w: 'sine' }], fm: { r: 1, i: 1.3, dec: [.25, .12] }, trem: [4.2, .12], lp: 5000, env: [.004, 1.2, .35, .35], g: .5 },
  pluck:    { osc: [{ w: 'triangle' }], lp: { f: 1500, q: .8, env: 2400, tau: .12 }, env: [.004, .45, .25, .2], g: .62 },
  pluck_syn:{ osc: [{ w: 'sawtooth', det: -6, g: .5 }, { w: 'sawtooth', det: 6, g: .5 }], lp: { f: 500, q: 2, env: 3500, tau: .12 }, env: [.003, .35, .15, .18], g: .26 },
  bell:     { osc: [{ w: 'sine' }], fm: { r: 2, i: .6, dec: [.6, .2] }, lp: 6000, env: [.004, 1.1, .25, .6], g: .42 },
  marimba:  { osc: [{ w: 'sine' }, { w: 'sine', r: 4, g: .35, dec: [.06, 0] }], env: [.003, .3, .18, .15], g: .62 },
  chime:    { osc: [{ w: 'sine' }, { w: 'sine', r: 3.984, g: .22, dec: [.4, .1] }], env: [.004, .8, .3, .5], g: .45 },
  glock:    { osc: [{ w: 'sine' }, { w: 'sine', r: 2.76, g: .3, dec: [.15, 0] }, { w: 'sine', r: 5.4, g: .12, dec: [.08, 0] }], env: [.002, .6, .12, .45], g: .38 },
  vibes:    { osc: [{ w: 'sine' }, { w: 'sine', r: 4, g: .15, dec: [.2, 0] }], trem: [5.5, .3], env: [.004, 1.2, .3, .6], g: .45 },
  kawaii:   { osc: [{ w: 'square', g: .35 }, { w: 'sine', r: 2, g: .4 }], lp: { f: 3800, q: .7, env: 1500, tau: .1 }, env: [.004, .3, .5, .16], g: .26 },
  clav:     { osc: [{ w: 'square', g: .5 }, { w: 'sawtooth', g: .3 }], lp: { f: 900, q: 3, env: 3000, tau: .07 }, env: [.002, .2, .2, .07], g: .22 },
  slap:     { osc: [{ w: [1, .5, .33, .25, .2] }], lp: { f: 250, q: 4, env: 2600, tau: .06 }, env: [.002, .2, .35, .08], g: .45, low: 1 },
  power:    { osc: [{ w: 'sawtooth', det: -8, g: .5 }, { w: 'sawtooth', det: 8, g: .5 }], lp: 1800, drive: 8, env: [.004, .3, .6, .12], g: .08 },
  guitar:   { ks: { bright: .55, damp: .996, chorus: 1 }, g: .55 },
  nylon:    { ks: { bright: .35, damp: .995 }, g: .6 },
  harp:     { ks: { bright: .45, damp: .9975 }, g: .55 },
  guzheng:  { ks: { bright: .7, damp: .997, bend: -.6, vib: [5.5, 25, .25] }, g: .55 },
  sitar:    { ks: { bright: .9, damp: .9975, buzz: 6, bend: -1, vib: [5, 22, .3] }, g: .45 },
  santoor:  { ks: { bright: .85, damp: .996 }, g: .45 },
  upright:  { ks: { bright: .2, damp: .994, lowpass: 900 }, g: .85, low: 1 },
  // ── sustained ──
  flute:    { sus: 1, osc: [{ w: [1, .1, .03] }], noise: { g: .05, r: 2, q: 1.5 }, lp: 3000, env: [.08, 0, 1, .12], vib: [4.6, 7, .3], porta: .025, g: .55 },
  dizi:     { sus: 1, osc: [{ w: [1, .5, .32, .2, .14, .09, .06, .04, .03] }], peak: [2900, 7, 1.2], lp: 6500, noise: { g: .07, r: 3, q: 2 }, env: [.035, 0, 1, .1], vib: [5.6, 18, .22], porta: .045, grace: 2, g: .34 },
  xiao:     { sus: 1, osc: [{ w: [1, .2, .07] }], lp: 1700, noise: { g: .09, r: 2, q: 1.2 }, env: [.11, 0, 1, .18], vib: [4.6, 10, .3], porta: .05, grace: 1, g: .6 },
  bansuri:  { sus: 1, osc: [{ w: [1, .18, .06] }], lp: 2600, noise: { g: .07, r: 2, q: 1.4 }, env: [.06, 0, 1, .14], vib: [5.2, 14, .25], porta: .04, grace: 1, g: .55 },
  strings:  { sus: 1, osc: [{ w: 'triangle', g: .6 }, { w: 'triangle', det: 14, g: .6 }, { w: 'sawtooth', det: -8, g: .12 }], lp: 2000, env: [.16, 0, 1, .35], vib: [5, 7, .35], porta: .03, g: .42 },
  violin:   { sus: 1, osc: [{ w: 'sawtooth', det: -4, g: .5 }, { w: 'sawtooth', det: 4, g: .5 }], lp: { f: 2400, q: 1 }, env: [.09, 0, 1, .3], vib: [5.6, 16, .18], porta: .04, g: .2 },
  cello:    { sus: 1, osc: [{ w: 'sawtooth', det: -5, g: .5 }, { w: 'sawtooth', det: 5, g: .5 }], lp: 900, env: [.12, 0, 1, .35], vib: [5, 10, .25], porta: .04, g: .3, low: 1 },
  bass:     { sus: 1, osc: [{ w: [1, .22] }], lp: 1200, env: [.02, 0, 1, .1], porta: .01, g: .7, low: 1 },
  sub:      { sus: 1, osc: [{ w: [1, .1] }], lp: 800, env: [.01, 0, 1, .1], porta: .01, g: .75, low: 1 },
  chip:     { sus: 1, osc: [{ w: 'square' }], lp: 950, env: [.02, 0, 1, .06], g: .22 },
  vocal_a:  { sus: 1, osc: [{ w: 'sawtooth', g: .7 }, { w: 'triangle', g: .5 }], formants: [[750, 6, 1], [1200, 7, .55], [2700, 8, .22]], body: .25, lp: 4500, env: [.05, 0, 1, .16], vib: [5.6, 22, .25], porta: .05, g: .5 },
  vocal_o:  { sus: 1, osc: [{ w: 'sawtooth', g: .6 }, { w: 'triangle', g: .6 }], formants: [[450, 6, 1], [800, 7, .5], [2800, 9, .12]], body: .3, lp: 3500, env: [.06, 0, 1, .2], vib: [5.2, 18, .3], porta: .06, g: .55 },
  sax:      { sus: 1, osc: [{ w: [1, .6, .45, .3, .22, .15, .1, .07] }], formants: [[600, 3, 1], [1500, 4, .6]], body: .3, lp: 2200, env: [.04, 0, 1, .14], vib: [5, 14, .3], porta: .03, g: .38 },
  brass:    { sus: 1, osc: [{ w: 'sawtooth', det: -5, g: .5 }, { w: 'sawtooth', det: 5, g: .5 }], lp: { f: 800, q: 1.2, env: 1800, tau: .15 }, env: [.03, 0, 1, .12], vib: [5.5, 6, .3], g: .24 },
  synth:    { sus: 1, osc: [{ w: 'sawtooth', det: -7, g: .5 }, { w: 'square', det: 7, g: .3 }], lp: { f: 2000, q: 1.2, env: 1200, tau: .15 }, env: [.01, 0, 1, .15], vib: [5.5, 9, .3], porta: .03, g: .2 },
  lead_gtr: { sus: 1, osc: [{ w: 'sawtooth', det: -9, g: .5 }, { w: 'sawtooth', det: 9, g: .5 }, { w: 'square', r: .5, g: .3 }], lp: 2400, drive: 12, env: [.005, 0, 1, .15], vib: [5.5, 14, .35], porta: .02, g: .09 },
  dream:    { sus: 1, osc: [{ w: 'triangle', det: -6 }, { w: 'sine', r: 2, g: .25 }, { w: 'triangle', det: 6, g: .5 }], lp: 2400, env: [.06, 0, 1, .5], vib: [4.5, 12, .3], porta: .04, g: .42 },
  pad:      { sus: 1, osc: [{ w: 'sawtooth', det: -10, g: .4 }, { w: 'sawtooth', det: 10, g: .4 }, { w: 'triangle', r: .5, g: .3 }], lp: 1100, env: [.3, 0, 1, .8], g: .18 },
  organ:    { sus: 1, osc: [{ w: [1, .6, .4, .24] }], trem: [6, .08], lp: 5000, env: [.01, 0, 1, .08], g: .36 },
  supersaw: { sus: 1, osc: [-20, -9, 0, 9, 20].map(d => ({ w: 'sawtooth', det: d, g: .25 })), lp: 2800, env: [.01, 0, 1, .25], g: .09 },
  b808:     { osc: [{ w: 'sine' }], drop: [7, .06], drive: 2.5, lp: 900, env: [.004, .9, .35, .25], g: .65, low: 1 },
};

export const TIMBRE_NAME = {
  keys: '柔和钢琴', piano: '钢琴', ep: '电钢琴', pluck: '拨弦', pluck_syn: '合成拨弦', bell: '铃音', marimba: '马林巴', chime: '风铃',
  glock: '钟琴', vibes: '颤音琴', kawaii: '甜甜合成器', clav: '克拉维', slap: '拍弦贝斯', power: '强力和弦', guitar: '清音吉他', nylon: '木吉他',
  harp: '竖琴', guzheng: '古筝', sitar: '西塔琴', santoor: '桑图尔琴', upright: '低音提琴', flute: '长笛', dizi: '竹笛', xiao: '洞箫',
  bansuri: '班苏里笛', strings: '弦乐', violin: '小提琴', cello: '大提琴', bass: '贝斯', sub: '低音贝斯', chip: '8-bit', vocal_a: '歌姬人声',
  vocal_o: '哼唱人声', sax: '萨克斯', brass: '铜管', synth: '合成器主音', lead_gtr: '电吉他', dream: '梦幻主音', pad: '温暖铺底', organ: '风琴',
  supersaw: '超级锯齿', b808: '808 贝斯',
};

// chords: [rootSemitone, quality] in the key; one per bar, four bars loop
const Q = { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], 5: [0, 7, 12], sus2: [0, 2, 7], '7sus': [0, 5, 7, 10], add9: [0, 4, 7, 14] };
export const SCALES = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10], in: [0, 1, 5, 7, 8] };

export const MOODS = [
  { id: 'hype',  name: '激昂热血', emo: '🔥', scale: 'minor', prog: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], tempo: 1.15, density: 'drive', rev: -.04, del: 0, line: '热血燃起来！鼓点加倍，冲呀～' },
  { id: 'happy', name: '愉悦欢快', emo: '🌞', scale: 'major', prog: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']], tempo: 1.06, density: 'full', rev: 0, del: 0, line: '开开心心的大调，蹦蹦跳跳～' },
  { id: 'calm',  name: '温柔宁静', emo: '🌙', scale: 'major', prog: [[0, 'M7'], [5, 'M7'], [9, 'm7'], [7, 'sus2']], tempo: .8, density: 'soft', rev: .14, del: .06, lp: 6000, line: '放慢一点，轻轻的、软软的～' },
  { id: 'sad',   name: '悲伤忧郁', emo: '🌧️', scale: 'minor', prog: [[0, 'm'], [8, 'M'], [5, 'm'], [7, 'm']], tempo: .78, density: 'soft', rev: .18, del: .08, lp: 5200, line: '小调慢慢走，有点想哭了…' },
  { id: 'tense', name: '紧张悬疑', emo: '🕯️', scale: 'in', prog: [[0, '5'], [1, 'M'], [5, 'm'], [1, 'M']], tempo: .95, density: 'tense', rev: .08, del: .14, lp: 4500, line: '嘘…心跳声响起来了，小心背后！' },
  { id: 'chill', name: '慵懒松弛', emo: '☕', scale: 'major', prog: [[0, 'M7'], [9, 'm7'], [2, 'm7'], [7, '7sus']], tempo: .78, density: 'half', swing: .14, rev: .08, del: .05, lp: 4200, sevenths: 1, line: '摊平～律动松松的，喝口咖啡吧' },
];

export function chordTones(root, qual, sevenths) {
  let q = qual;
  if (sevenths) q = { M: 'M7', m: 'm7' }[qual] || qual;
  const t = Q[q].map(x => {
    let v = root + x; while (v > 11) v -= 12; while (v < -7) v += 12; return v;
  }).sort((a, b) => a - b);
  let r = root; while (r > 5) r -= 12;
  return { tones: t, root: r };
}

// one chord sound per bar for the backing; drums are 16-step patterns
export const GENRES = [
  { id: 'pure', name: '纯净', zh: '无风格', emo: '🤍', bpm: 110, root: 60, pure: 1, chords: [], bass: null, drums: null,
    fx: { rev: .18, del: .2 }, desc: '没有伴奏，只有你画的声音' },
  { id: 'pop', name: 'Pop', zh: '流行', emo: '🎤', bpm: 108, root: 60,
    roles: { lead: 'synth', keys: 'piano', pad: 'strings', bass: 'bass', bell: 'bell' },
    chords: [{ inst: 'piano', style: 'pattern', pat: 'x..x..x...x..x..', len: 2.5, oct: 0, vel: .4 }],
    bass: { inst: 'bass', pat: '1.....1.1...5...', len: 2 },
    drums: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    fx: { rev: .2, del: .12 }, desc: '明亮上口，四和弦循环' },
  { id: 'rock', name: 'Rock', zh: '摇滚', emo: '🎸', bpm: 126, root: 64,
    roles: { lead: 'lead_gtr', keys: 'organ', pad: 'strings', bass: 'bass', bell: 'chime' },
    chords: [{ inst: 'power', style: 'pattern', pat: 'x.x.x.x.x.x.x.x.', len: 1.6, oct: -12, vel: .5, five: 1 }],
    bass: { inst: 'bass', pat: '1.1.1.1.1.1.1.1.', len: 1.6 },
    drums: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', cr: 'x...............' },
    fx: { rev: .14, del: .05 }, desc: '电吉他与强力鼓点' },
  { id: 'hiphop', name: 'Hip-hop', zh: '嘻哈/说唱', emo: '🧢', bpm: 88, swing: .18, root: 57, sevenths: 1,
    roles: { lead: 'pluck', keys: 'ep', pad: 'pad', bass: 'sub', bell: 'glock' },
    chords: [{ inst: 'ep', style: 'pattern', pat: 'x.........x.....', len: 7, oct: 0, vel: .35 }],
    bass: { inst: 'b808', pat: '1......1..1.....', len: 5 },
    drums: { k: 'x......x..x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xx', vinyl: 1 },
    fx: { rev: .12, del: .1, lp: 9000 }, desc: 'Boom-bap 律动，808 低音' },
  { id: 'rnb', name: 'R&B', zh: '节奏布鲁斯', emo: '🌙', bpm: 74, swing: .12, root: 62, sevenths: 1,
    roles: { lead: 'vocal_o', keys: 'ep', pad: 'pad', bass: 'sub', bell: 'chime' },
    chords: [{ inst: 'ep', style: 'pattern', pat: 'x.......x.....x.', len: 6, oct: 0, vel: .35 }],
    bass: { inst: 'sub', pat: '1.....1...1.....', len: 3 },
    drums: { k: 'x.........x.....', c: '....x.......x...', h: 'x.x.x.x.xxx.x.x.' },
    fx: { rev: .3, del: .16 }, desc: '丝滑电钢琴与慵懒鼓点' },
  { id: 'electronic', name: 'Electronic', zh: '电子', emo: '🎧', bpm: 122, root: 57, side: 1,
    roles: { lead: 'synth', keys: 'pluck_syn', pad: 'pad', bass: 'bass', bell: 'bell' },
    chords: [{ inst: 'supersaw', style: 'pattern', pat: '..x...x...x...x.', len: 1.5, oct: 0, vel: .45 }],
    bass: { inst: 'bass', pat: '..1...1...1...1.', len: 1.5 },
    drums: { k: 'x...x...x...x...', c: '....x.......x...', o: '..x...x...x...x.', h: 'xxxxxxxxxxxxxxxx' },
    fx: { rev: .2, del: .26 }, desc: '四踩 House 与侧链泵感' },
  { id: 'folk', name: 'Folk', zh: '民谣', emo: '🪕', bpm: 96, root: 55,
    roles: { lead: 'flute', keys: 'nylon', pad: 'strings', bass: 'upright', bell: 'glock' },
    chords: [{ inst: 'nylon', style: 'strum', pat: 'x...x.x...x.x.x.', len: 4, oct: 0, vel: .4 }],
    bass: { inst: 'upright', pat: '1.......5.......', len: 4 },
    drums: { sh: 'x.x.x.x.x.x.x.x.', k: 'x.......x.......', r: '....x.......x...' },
    fx: { rev: .24, del: .05 }, desc: '木吉他扫弦，温暖质朴' },
  { id: 'jazz', name: 'Jazz', zh: '爵士', emo: '🎷', bpm: 120, swing: .3, swing8: 1, root: 60, sevenths: 1,
    roles: { lead: 'sax', keys: 'ep', pad: 'vibes', bass: 'upright', bell: 'vibes' },
    chords: [{ inst: 'ep', style: 'comp', len: 1.6, oct: 0, vel: .34 }],
    bass: { inst: 'upright', walk: 1, len: 3.6 },
    drums: { ri: 'x...x.x.x...x.x.', hf: '....x.......x...', k: 'x.......x.......' },
    fx: { rev: .24, del: 0 }, desc: '摇摆律动，七和弦' },
  { id: 'classical', name: 'Classical', zh: '古典', emo: '🎻', bpm: 84, root: 60,
    roles: { lead: 'violin', keys: 'piano', pad: 'strings', bass: 'cello', bell: 'harp' },
    chords: [{ inst: 'piano', style: 'alberti', len: 2, oct: -12, vel: .3 }, { inst: 'strings', style: 'pad', len: 16, oct: -12, vel: .22 }],
    bass: { inst: 'cello', pat: '1.......5.......', len: 7.5 },
    drums: null,
    fx: { rev: .4, del: 0 }, desc: '钢琴分解和弦与弦乐' },
  { id: 'bedroom', name: 'Bedroom Pop', zh: '卧室流行', emo: '🛏️', bpm: 86, swing: .1, root: 62, sevenths: 1,
    roles: { lead: 'dream', keys: 'guitar', pad: 'pad', bass: 'sub', bell: 'glock' },
    chords: [{ inst: 'guitar', style: 'strum', pat: 'x.....x...x.....', len: 5, oct: 0, vel: .38 }],
    bass: { inst: 'sub', pat: '1.......1..5....', len: 3 },
    drums: { k: 'x......x.x......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', vinyl: 1 },
    fx: { rev: .28, del: .14, lp: 5200 }, desc: 'Lo-fi 磁带感，松弛可爱' },
  { id: 'dream', name: 'Dream Pop', zh: '梦幻流行', emo: '☁️', bpm: 78, root: 64, sevenths: 1,
    roles: { lead: 'dream', keys: 'guitar', pad: 'pad', bass: 'sub', bell: 'bell' },
    chords: [{ inst: 'pad', style: 'pad', len: 16, oct: 0, vel: .45 }, { inst: 'guitar', style: 'arp', len: 3, oct: 0, vel: .3 }],
    bass: { inst: 'sub', pat: '1.......1.......', len: 7 },
    drums: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' },
    fx: { rev: .5, del: .32 }, desc: '混响铺满的朦胧吉他' },
  { id: 'kawaii', name: 'Kawaii Future Bass', zh: '可爱未来贝斯', emo: '🍬', bpm: 150, root: 65, side: 1, sevenths: 1,
    roles: { lead: 'kawaii', keys: 'glock', pad: 'strings', bass: 'sub', bell: 'bell' },
    chords: [{ inst: 'supersaw', style: 'pattern', pat: 'x..x..x...x..x..', len: 1.6, oct: 0, vel: .48 }],
    bass: { inst: 'sub', pat: '1..1..1...1..1..', len: 1.5 },
    drums: { k: 'x.........x.....', s: '........x.......', c: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
    fx: { rev: .24, del: .2 }, desc: '闪亮和弦+八音盒，超甜' },
  { id: 'neosoul', name: 'Neo‑Soul', zh: '新灵魂乐', emo: '☕', bpm: 80, swing: .2, root: 63, sevenths: 1,
    roles: { lead: 'vocal_o', keys: 'ep', pad: 'organ', bass: 'sub', bell: 'vibes' },
    chords: [{ inst: 'ep', style: 'pattern', pat: 'x.....x...x.....', len: 3, oct: 0, vel: .36 }],
    bass: { inst: 'sub', pat: '1..5..8.1.......', len: 1.8 },
    drums: { k: 'x.....x...x.....', r: '....x.......x...', h: 'x.xxx.x.x.xxx.x.' },
    fx: { rev: .22, del: .1, lp: 8000 }, desc: '九和弦与醉拍律动' },
  { id: 'funk', name: 'Light Funk', zh: '轻放克', emo: '🕺', bpm: 106, root: 64, sevenths: 1,
    roles: { lead: 'brass', keys: 'clav', pad: 'organ', bass: 'slap', bell: 'glock' },
    chords: [{ inst: 'clav', style: 'pattern', pat: '..x.x..x..x.x..x', len: .6, oct: 0, vel: .42 }],
    bass: { inst: 'slap', pat: '1..1.8..1.5.1.8.', len: .8 },
    drums: { k: 'x.....x...x..x..', s: '....x..x.x..x...', h: 'xxxxxxxxxxxxxxxx' },
    fx: { rev: .12, del: .05 }, desc: '跳跃贝斯与切音键盘' },
  { id: 'chinese', name: 'Guofeng', zh: '中国风', emo: '🏮', bpm: 82, root: 62, flutey: 1,
    roles: { lead: 'dizi', keys: 'guzheng', pad: 'xiao', bass: 'xiao', bell: 'bell' },
    chords: [{ inst: 'guzheng', style: 'arp', len: 3, oct: 0, vel: .32 }, { inst: 'strings', style: 'pad', len: 16, oct: -12, vel: .16 }],
    bass: { inst: 'sub', pat: '1.......5.......', len: 6 },
    drums: { tk: 'x.........x.....', w: '....x.......x.x.', fb: 'x...............' },
    fx: { rev: .36, del: .16 }, desc: '竹笛唱主角，古筝伴奏' },
  { id: 'indian', name: 'Indian Pop', zh: '印度流行', emo: '🪷', bpm: 100, root: 61,
    roles: { lead: 'sitar', keys: 'santoor', pad: 'bansuri', bass: 'sub', bell: 'bell' },
    chords: [{ inst: 'sitar', style: 'drone', len: 8, oct: -12, vel: .22 }, { inst: 'strings', style: 'pad', len: 16, oct: -12, vel: .16 }],
    bass: { inst: 'sub', pat: '1.....1.1.......', len: 2 },
    drums: { ta: 'x..x..x.x..x..x.', na: '..x...x...x.x...', c: '....x.......x...', sh: 'x.x.x.x.x.x.x.x.' },
    fx: { rev: .24, del: .12 }, desc: '西塔琴、班苏里笛、塔布拉鼓' },
  { id: 'vocaloid', name: 'Vocaloid', zh: '虚拟歌姬', emo: '💙', bpm: 140, root: 61,
    roles: { lead: 'vocal_a', keys: 'piano', pad: 'synth', bass: 'bass', bell: 'glock' },
    chords: [{ inst: 'piano', style: 'pattern', pat: 'x.x.x.x.x.x.x.x.', len: 1.5, oct: 0, vel: .3 }, { inst: 'supersaw', style: 'pad', len: 16, oct: 0, vel: .26 }],
    bass: { inst: 'bass', pat: '1.1.1.1.1.1.1.1.', len: 1.6 },
    drums: { k: 'x...x...x...x...', s: '....x.......x...', o: '..x...x...x...x.' },
    fx: { rev: .22, del: .18 }, desc: '电子歌姬声线，高速 J‑Pop' },
];

export const ROLE_INFO = {
  lead: { label: '主旋律', icon: '🎤' },
  keys: { label: '拨弦/键盘', icon: '🎹' },
  pad:  { label: '柔和长音', icon: '☁️' },
  bass: { label: '低音', icon: '🔊' },
  bell: { label: '闪亮铃音', icon: '🔔' },
};

function hsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
  return { h, s, l };
}
export function colorRole(hex) {
  const { h, s, l } = hsl(hex);
  if (l > .9) return 'bell';
  if (l < .22 || s < .15 || (s < .32 && l < .55)) return 'bass';
  if (h < 70 || h >= 320) return 'lead';
  if (h < 195) return 'keys';
  return 'pad';
}
// the pure (no-style) instrument: one timbre per colour family
export function pureTimbre(hex) {
  const { h, s, l } = hsl(hex);
  if (l > .9) return 'glock';
  if (l < .22 || s < .15 || (s < .32 && l < .55)) return 'bass';
  if (h < 15 || h >= 345) return 'pluck';
  if (h < 42) return 'marimba';
  if (h < 70) return 'chime';
  if (h < 160) return 'keys';
  if (h < 195) return 'glock';
  if (h < 250) return 'flute';
  if (h < 290) return 'bell';
  return 'strings';
}
export const PURE_LABEL = { pluck: '🪕 拨弦', marimba: '🪘 马林巴', chime: '✨ 风铃', keys: '🎹 柔和钢琴', glock: '🔔 钟琴', flute: '🪈 长笛', bell: '🛎️ 铃音', strings: '🎻 弦乐', bass: '🔊 贝斯' };

export const COLORS = [
  ['#2B2622', '墨黑'], ['#6E6862', '深灰'], ['#B9B3AA', '浅灰'], ['#FFFFFF', '白'],
  ['#8A6650', '可可'], ['#E8433F', '番茄红'], ['#FF7A5C', '珊瑚'], ['#F7A1B9', '樱花粉'],
  ['#D9437E', '玫红'], ['#FF9F1C', '橙'], ['#FFD23F', '柠檬黄'], ['#F3E3A1', '奶油'],
  ['#9BCB52', '草绿'], ['#3E9E5B', '森林绿'], ['#5CC9B5', '薄荷'], ['#55B8F0', '天蓝'],
  ['#2F6FD6', '海蓝'], ['#2D3A8C', '藏青'], ['#8E5BD9', '葡萄紫'], ['#BFA6F0', '薰衣草'],
];

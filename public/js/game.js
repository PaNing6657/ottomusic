/* ===== 下落箭头音乐游戏 - 游戏核心逻辑 ===== */
/* 支持 2~8 轨道 · 谱面自定义键位 */
'use strict';

const NOTE_SIZE = 60;
const APPROACH_MS = 1800;      // 音符从出现到判定线的下落时长
const COUNTDOWN_S = 2.4;       // 倒计时总时长（3×800ms），预滚动时钟以此对齐
const WIN = { perfect: 0.045, great: 0.09, good: 0.135 };  // 判定窗口(秒)
const SCORE = { perfect: 1000, great: 600, good: 300, holdBonus: 500 };

// 对战双方与血量：左 notch / 右 古阵兴
const P_LEFT = 'NOTCH', P_RIGHT = '古镇兴';
const HP_MAX = 100;
const DMG = { miss: 5, break: 5, ghost: 2 };   // 漏接/断连/空按 扣血量

// 8 轨道配置：颜色 / 符号 / 箭头旋转角 / 默认键位 [主, 副]
const LANE_COLORS = ['#ff3d81', '#00d9ff', '#ffc400', '#00ff9d', '#ff7847', '#8f6cff', '#ff4dd2', '#4dffd2'];
const ARROW_CHARS = ['↑', '↓', '←', '→', '↖', '↗', '↙', '↘'];
const LANE_ROTATIONS = [0, 180, 270, 90, 315, 45, 225, 135];
const DEFAULT_KEYS = [
  ['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown'], ['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight'],
  ['KeyQ', null], ['KeyE', null], ['KeyZ', null], ['KeyC', null],
];
const ARROW_UP_PATH = 'M12 3 L20 12 H15 V21 H9 V12 H4 Z';

// ---------- 打击音效：Web Audio 合成"击碎"质感，无需外部文件 ----------
const SFX = {
  ctx: null, comp: null,
  // 首次按键时解锁 AudioContext（浏览器自动播放策略）
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
        // 主压缩器：多层叠加防削波，并让碎裂更有冲击力
        this.comp = this.ctx.createDynamicsCompressor();
        this.comp.threshold.value = -18; this.comp.knee.value = 20;
        this.comp.ratio.value = 6; this.comp.attack.value = 0.002;
        this.comp.release.value = 0.12;
        this.comp.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  // 共享白噪声源（配合随机起点/速率，每次碎裂波形都不同）
  _noise: null,
  noiseBuf(ctx) {
    if (!this._noise) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5 | 0, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;
    }
    return this._noise;
  },
  // 冲击体：低频下坠，给碎裂提供"分量"
  thump(t0, vol) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
    osc.connect(g); g.connect(this.comp);
    osc.start(t0); osc.stop(t0 + 0.1);
  },
  // 碎裂主体：带通噪声爆裂，中心频率与波形取样点随机微调
  crack(t0, vol, freq) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf(ctx);
    src.playbackRate.value = 0.85 + Math.random() * 0.4;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * (0.9 + Math.random() * 0.2);
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.13);
    src.connect(bp); bp.connect(g); g.connect(this.comp);
    src.start(t0, Math.random() * 0.25);
    src.stop(t0 + 0.13);
  },
  hit(kind) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    // 三档判定：perfect 碎得最亮最脆，good 最闷最轻
    const conf = {
      perfect: { thump: 0.3, crack: 0.5, crackF: 5200 },
      great: { thump: 0.24, crack: 0.4, crackF: 4200 },
      good: { thump: 0.18, crack: 0.3, crackF: 3300 },
    }[kind];
    if (!conf) return;
    this.thump(t0, conf.thump);
    this.crack(t0, conf.crack, conf.crackF);
  },
  // 通用短音（miss / 断连 / hold 轻响）
  play({ freq = 600, dur = 0.08, noise = true, type = 'triangle', vol = 0.5, slide = 0 }) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(vol, t0);
    out.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    out.connect(this.comp);
    // 音高层：短促敲击音
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    osc.connect(out);
    osc.start(t0); osc.stop(t0 + dur);
    // 噪声层：增加"敲击"质感
    if (noise) {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 2500;   // 只保留高频脆感
      const nOut = ctx.createGain();
      nOut.gain.setValueAtTime(vol * 0.7, t0);
      nOut.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(hp); hp.connect(nOut); nOut.connect(this.comp);
      src.start(t0);
    }
  },
  miss() { this.play({ freq: 160, dur: 0.16, type: 'sawtooth', vol: 0.22, slide: -80, noise: false }); },
  break_() { this.play({ freq: 320, dur: 0.2, type: 'square', vol: 0.25, slide: -240, noise: false }); },
  holdTick() { this.play({ freq: 1500, dur: 0.04, vol: 0.2, noise: false, type: 'sine' }); },
};

// code → lane 映射（init 时按谱面键位动态构建）
let LANE_KEYMAP = {};

const $ = id => document.getElementById(id);
const els = {
  overlay: $('startOverlay'), mapInfo: $('mapInfo'), startBtn: $('startBtn'), backEditor: $('backEditor'),
  keyHint: $('keyHint'),
  countdown: $('countdown'), hud: $('hud'), stage: $('stage'), pausePanel: $('pausePanel'),
  score: $('score'), acc: $('acc'), combo: $('combo'), lastJudge: $('lastJudge'),
  judgeLine: $('judgeLine'), fxLayer: $('fxLayer'),
  result: $('resultPanel'), rank: $('rank'), rScore: $('rScore'), rAcc: $('rAcc'), rCombo: $('rCombo'),
  cP: $('cP'), cG: $('cG'), cO: $('cO'), cM: $('cM'),
  retryBtn: $('retryBtn'), exitBtn: $('exitBtn'),
  devBtn: $('devBtn'), devModal: $('devModal'), devPass: $('devPass'),
  devErr: $('devErr'), devOk: $('devOk'), devCancel: $('devCancel'), autoBadge: $('autoBadge'),
  hpBars: $('hpBars'), hpFillL: $('hpFillL'), hpGhostL: $('hpGhostL'),
  hpFillR: $('hpFillR'), hpGhostR: $('hpGhostR'),
  resultTitle: $('resultTitle'), vsNameL: $('vsNameL'), vsNameR: $('vsNameR'),
  vsHpL: $('vsHpL'), vsHpR: $('vsHpR'),
  charL: $('charL'), charR: $('charR'),
  charHitL: $('charHitL'), charHitR: $('charHitR'),
  pauseBtn: $('pauseBtn'),
  calBtn: $('calBtn'), calModal: $('calModal'), calPad: $('calPad'),
  calBlocks: $('calBlocks'), calFlash: $('calFlash'),
  calVal: $('calVal'), calCnt: $('calCnt'),
  calReset: $('calReset'), calCancel: $('calCancel'), calSave: $('calSave'),
  loadWrap: $('loadWrap'), loadFill: $('loadFill'), loadPct: $('loadPct'),
};

const state = {
  map: null,
  keyCount: 4,       // 轨道数 2~8
  audio: null,
  running: false,
  paused: false,       // Esc 暂停
  baseTime: 0,          // gameTime = audio.currentTime - baseTime
  pxPerMs: 0,
  judgeY: 0,
  noteIdx: 0,           // 当前待处理音符游标
  score: 0, maxCombo: 0, combo: 0,
  counts: { perfect: 0, great: 0, good: 0, miss: 0 },
  totalPossible: 0,
  activeKey: {},        // 当前按住的键 -> lane
  holds: new Map(),     // noteIdx -> {note, broken}
  autoplay: false,      // 自动弹调试模式（暗号解锁）
  autoIdx: 0,           // 自动弹待处理音符游标
  preroll: false,       // 倒计时预滚动：音符提前下落但不可判定
  prerollStart: 0,      // 预滚动起点（performance.now）
  hp: { left: HP_MAX, right: HP_MAX },   // 双方血量
  leftCount: 2,          // 左方（notch）轨道数
  userOffset: 0,         // 本机音频延迟补偿（秒，节奏校准所得；正值 = 声音到得晚）
};

// 键位显示名
function keyLabel(code) {
  if (!code) return '—';
  const map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'SPACE' };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  return code.length > 4 ? code.slice(0, 4) : code;
}

// 规范化谱面键位：补默认值并去重
function normalizeKeys(keys, count) {
  const out = [];
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    const pair = (keys && keys[i]) || [];
    const slot = [];
    for (let s = 0; s < 2; s++) {
      const code = pair[s] || DEFAULT_KEYS[i][s];
      if (code && !seen.has(code)) { seen.add(code); slot.push(code); }
      else slot.push(null);
    }
    out.push(slot);
  }
  return out;
}

// ---------- 自定义键位（按轨道数存本机） ----------
const kbStoreKey = () => `ottohub_gameKeys_${state.keyCount}`;

// ---------- 本机音频延迟补偿（节奏校准所得，毫秒存本机） ----------
const USER_OFFSET_KEY = 'ottohub_userOffset';
function loadUserOffset() {
  try {
    const v = parseFloat(localStorage.getItem(USER_OFFSET_KEY));
    if (Number.isFinite(v)) return Math.max(-500, Math.min(500, v)) / 1000;   // 钳制 ±500ms
  } catch { /* localStorage 不可用 */ }
  return 0;
}

// 读取本机自定义主键：返回 [code|null, ...]
function loadCustomKeys() {
  try {
    const arr = JSON.parse(localStorage.getItem(kbStoreKey()));
    if (Array.isArray(arr)) return arr.map(c => (typeof c === 'string' ? c : null));
  } catch { /* 忽略损坏数据 */ }
  return null;
}

// 应用自定义主键到规范化键位（副键若冲突则清掉）
function applyCustomKeys(keys) {
  const custom = loadCustomKeys();
  if (!custom) return keys;
  for (let i = 0; i < keys.length; i++) {
    const code = custom[i];
    if (!code) continue;
    keys[i] = [code, null];   // 自定义后该轨仅此键
    // 其他轨冲突的同键清除
    for (let j = 0; j < keys.length; j++) {
      if (j !== i) keys[j] = keys[j].map(c => (c === code ? null : c));
    }
  }
  return keys;
}

// 键位生效：写 LANE_KEYMAP 并刷新开始页键位提示
function applyKeymap(keys) {
  LANE_KEYMAP = {};
  keys.forEach((pair, lane) => pair.forEach(code => { if (code) LANE_KEYMAP[code] = lane; }));
  const item = lane =>
    `<div class="key-item"><span class="k" style="color:${LANE_COLORS[lane]};box-shadow:0 4px 0 #0a0c1c, 0 0 0 rgba(0,0,0,0)">${keyLabel(keys[lane][0])}</span><span>${ARROW_CHARS[lane]}</span></div>`;
  els.keyHint.innerHTML =
    `<div class="key-group"><div class="kg-label l">${P_LEFT}</div><div class="kg-keys">${keys.map((_, i) => i < state.leftCount ? item(i) : '').join('')}</div></div>` +
    `<div class="kg-vs">VS</div>` +
    `<div class="key-group"><div class="kg-label r">${P_RIGHT}</div><div class="kg-keys">${keys.map((_, i) => i >= state.leftCount ? item(i) : '').join('')}</div></div>`;
}

// ---------- 初始化 ----------
async function init() {
  state.userOffset = loadUserOffset();   // 开局读取本机校准值
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) {
    els.mapInfo.textContent = '未指定谱面，请先在编辑器中选择';
    els.startBtn.disabled = true;
    els.backEditor.href = '/editor.html';
    return;
  }
  const res = await fetch(`/api/maps/${id}`);
  if (!res.ok) {
    els.mapInfo.textContent = '谱面加载失败';
    els.startBtn.disabled = true;
    els.backEditor.href = '/editor.html';
    return;
  }
  state.map = await res.json();
  state.map.notes.sort((a, b) => a.time - b.time);
  state.audio = new Audio('/api/audio');
  // 音频结束后延迟结算：等最后几个音符走完 miss 判定
  state.audio.addEventListener('ended', () => setTimeout(finish, 600));
  preloadResources();   // 开局即后台缓存音频与立绘，点开始时通常已就绪
  // 谱面结束时间：最后一个音符（含 hold 尾部）走完判定窗口即结束，不必等音乐放完
  state.endTime = state.map.notes.reduce((mx, n) => Math.max(mx, n.time + (n.duration || 0)), 0)
    + (state.map.offset || 0) + WIN.good + 0.3;

  // 轨道数与键位（旧谱面默认 4 轨，再叠加本机自定义主键）
  state.keyCount = Math.min(8, Math.max(2, state.map.keyCount || 4));
  state.leftCount = Math.ceil(state.keyCount / 2);   // 前半轨道归左方 notch
  const keys = applyCustomKeys(normalizeKeys(state.map.keys, state.keyCount));
  buildStage(keys);
  applyKeymap(keys);

  const info = await (await fetch('/api/audio/info')).json();
  const density = state.map.notes.length / Math.max(1, info.duration);
  els.mapInfo.textContent =
    `「${state.map.name}」 · ${state.map.bpm} BPM · ${state.keyCount}K · ${state.map.notes.length} 个音符 · 密度 ${density.toFixed(1)}/秒`;
  els.backEditor.href = `/editor.html?id=${id}`;
  els.exitBtn.onclick = () => location.href = els.backEditor.href;

  state.totalPossible = state.map.notes.reduce((s, n) => s + SCORE.perfect + (n.type === 'hold' ? SCORE.holdBonus : 0), 0);
}

// 动态生成舞台轨道 + 开始界面键位提示
function buildStage(keys) {
  els.stage.style.setProperty('--lane-count', state.keyCount);
  // 音符尺寸随轨道数收缩；小屏（手机横屏）再缩 0.7
  const compact = matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 520;
  const base = state.keyCount <= 4 ? 62 : state.keyCount <= 6 ? 54 : 46;
  const noteSize = compact ? Math.round(base * 0.7) : base;
  els.stage.style.setProperty('--note-size', noteSize + 'px');

  // 轨道插到判定线之前
  for (let i = 0; i < state.keyCount; i++) {
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.dataset.lane = i;
    lane.innerHTML = '<div class="lane-base"></div>';
    els.stage.insertBefore(lane, els.judgeLine);
  }

  state.laneEls = [...els.stage.querySelectorAll('.lane')];

  // 轨道底部归属标签：左半 cyan / 右半 pink
  const tagL = document.createElement('div');
  tagL.className = 'side-tag l';
  tagL.textContent = P_LEFT;
  els.stage.appendChild(tagL);
  const tagR = document.createElement('div');
  tagR.className = 'side-tag r';
  tagR.textContent = P_RIGHT;
  els.stage.appendChild(tagR);
}

// ---------- 资源预缓存：完整缓冲音频 + 预解码立绘，避免游戏中卡顿 ----------
let resourcesReady = Promise.resolve();
let resourcesDone = true;
let resImgDone = 0;

// 加载进度聚合：音频缓冲占 60%，4 张立绘共占 40%
function updateLoadProgress(forceDone) {
  const a = state.audio;
  let frac = forceDone ? 1 : 0;
  if (!forceDone && a && a.duration > 0 && a.buffered && a.buffered.length) {
    frac = Math.min(1, a.buffered.end(a.buffered.length - 1) / a.duration);
  }
  const pct = Math.min(100, Math.round((frac * 0.6 + (resImgDone / 4) * 0.4) * 100));
  els.loadFill.style.width = pct + '%';
  els.loadPct.textContent = pct + '%';
}

function preloadResources() {
  resourcesDone = false;
  els.loadWrap.hidden = false;
  const jobs = [];
  // 音频：等到浏览器确认可不中断地播完（canplaythrough）
  const audio = state.audio;
  audio.preload = 'auto';
  jobs.push(new Promise(resolve => {
    const done = () => { updateLoadProgress(true); resolve(); };
    if (audio.readyState >= 3) return done();
    audio.addEventListener('canplaythrough', done, { once: true });
    audio.addEventListener('error', done, { once: true });   // 加载失败也不阻塞开始
    audio.addEventListener('progress', () => updateLoadProgress());
  }));
  // 立绘：提前解码，首次显示与受击切换不掉帧
  for (const img of [els.charL, els.charR, els.charHitL, els.charHitR]) {
    jobs.push(img.decode().catch(() => {}).then(() => { resImgDone++; updateLoadProgress(); }));
  }
  resourcesReady = Promise.all(jobs).then(() => {
    resourcesDone = true;
    setTimeout(() => { els.loadWrap.hidden = true; }, 400);   // 满格稍作停留再隐藏
  });
}

// ---------- 开始 ----------
els.startBtn.addEventListener('click', async () => {
  if (els.startBtn.disabled) return;
  els.startBtn.disabled = true;   // 防重入
  SFX.ensure();   // 用户手势解锁音效
  // 借点击手势进入全屏；不支持或被浏览器拒绝时静默继续
  try { await document.documentElement.requestFullscreen(); }
  catch { document.documentElement.webkitRequestFullscreen?.(); }
  // 资源未缓存完则先等完（按钮提示加载中），保证游戏全程不因加载卡顿
  if (!resourcesDone) {
    els.startBtn.textContent = '加载中…';
    await resourcesReady;
    els.startBtn.textContent = '▶ 点击开始';
  }
  els.devBtn.classList.add('hidden');   // 游戏开始后隐藏调试入口
  // 触屏设备显示暂停按钮（桌面用 Esc）
  if (matchMedia('(pointer: coarse)').matches) els.pauseBtn.classList.remove('hidden');
  els.overlay.classList.add('hidden');
  els.hud.classList.remove('hidden');
  els.hpBars.classList.remove('hidden');   // 显示对战血条
  els.charL.classList.remove('hidden');    // 显示两侧人物
  els.charR.classList.remove('hidden');
  els.charHitL.classList.remove('hidden'); // 受击差分图同步显示（默认透明）
  els.charHitR.classList.remove('hidden');
  els.stage.classList.remove('hidden');
  layout();   // 舞台已显示，立即测量判定线

  // 倒计时期间不播音频：保证谱面 0 点 = 音频 0 点（根治位置错位）
  // 预滚动：游戏时钟从 -2.4s 走起，前 1.8s 内的音符倒计时中已在下落，不再突然出现
  state.preroll = true;
  state.prerollStart = performance.now();
  requestAnimationFrame(loop);
  for (const n of [3, 2, 1]) {
    els.countdown.textContent = n;
    els.countdown.classList.remove('hidden');
    els.countdown.style.animation = 'none';   // 重触发动画
    void els.countdown.offsetWidth;
    els.countdown.style.animation = '';
    await new Promise(r => setTimeout(r, 800));
    els.countdown.classList.add('hidden');
  }

  state.audio.currentTime = 0;
  await state.audio.play();
  // 无缝交接：预滚动时钟翻到音频时钟（rAF 链不断，画面无跳变）
  state.baseTime = 0;    // gameTime = 音频时间，所见即所判
  state.preroll = false;
  state.running = true;
});

function layout() {
  if (!state.laneEls) return;
  const stage = els.stage;
  const rect = stage.getBoundingClientRect();
  state.judgeY = rect.height * 0.78;
  state.pxPerMs = (state.judgeY + NOTE_SIZE + 60) / APPROACH_MS;
  state.laneEls.forEach(l => l.style.setProperty('--lane-c', LANE_COLORS[+l.dataset.lane]));
}

window.addEventListener('resize', layout);

// ---------- 自动弹（调试工具） ----------
// 走真实 hitLane 判定：在判定窗口内自动命中每轨音符，用于校验谱面/判定/offset
function autoPlayTick() {
  const notes = state.map.notes, off = state.map.offset || 0, t = gameTime();
  while (state.autoIdx < notes.length) {
    const n = notes[state.autoIdx], nt = n.time + off;
    if (n._done) { state.autoIdx++; continue; }
    // 到判定瞬间（micro 提前）即点击，保证命中 perfect
    if (nt - t <= 0.01) {
      hitLane(n.lane);
      // 视觉：整轨点亮模拟按键，tap 瞬闪，hold 持续到结束
      const laneEl = state.laneEls[n.lane];
      if (laneEl) {
        laneEl.classList.add('active');
        const dur = (n.type === 'hold' ? n.endTime + off - t : nt - t) * 1000;
        setTimeout(() => laneEl.classList.remove('active'), Math.max(160, dur + 60));
      }
      state.autoIdx++;
    } else break;
  }
}

// ---------- 开发者暗号解锁 ----------
const DEV_PASS = 'notch666';
function openDev() {
  els.devErr.classList.add('hidden');
  els.devPass.value = '';
  els.devModal.classList.remove('hidden');
  setTimeout(() => els.devPass.focus(), 50);
}
function closeDev() { els.devModal.classList.add('hidden'); }
els.devBtn.addEventListener('click', openDev);
els.devCancel.addEventListener('click', closeDev);
els.devOk.addEventListener('click', () => {
  if (els.devPass.value.trim() === DEV_PASS) {
    state.autoplay = true;
    state.autoIdx = 0;
    els.autoBadge.classList.remove('hidden');   // 常驻 AUTO 角标
    closeDev();
  } else {
    els.devErr.classList.remove('hidden');
  }
});
els.devPass.addEventListener('keydown', e => { if (e.key === 'Enter') els.devOk.click(); });

// ---------- 键位设置弹窗 ----------
let kbDraft = null;        // 草稿：每轨主键 code
let kbListening = -1;      // 正在监听的轨道（-1 无）

const kbBtns = {
  modal: $('kbModal'), rows: $('kbRows'),
  open: $('keybindBtn'), reset: $('kbReset'), cancel: $('kbCancel'), save: $('kbSave'),
};

// 打开弹窗：以当前生效键位为草稿
function openKb() {
  if (state.running) return;   // 游戏中不允许改
  kbDraft = [];
  for (let i = 0; i < state.keyCount; i++) {
    const pair = Object.entries(LANE_KEYMAP).find(([, lane]) => lane === i);
    kbDraft.push(pair ? pair[0] : null);
  }
  renderKbRows();
  kbBtns.modal.classList.remove('hidden');
}

// 渲染每轨行：箭头（轨道色）+ 当前键帽（重复标红）
function renderKbRows() {
  kbBtns.rows.replaceChildren();
  for (let i = 0; i < state.keyCount; i++) {
    const row = document.createElement('div');
    row.className = 'kb-row';
    const code = kbDraft[i];
    const dup = code && kbDraft.filter(c => c === code).length > 1;
    row.innerHTML = `
      <span class="arrow" style="color:${LANE_COLORS[i]}">${ARROW_CHARS[i]}</span>
      <span class="kb-key${dup ? ' dup' : ''}${kbListening === i ? ' listening' : ''}">${code ? keyLabel(code) : '—'}</span>`;
    // 点击键帽进入监听
    row.querySelector('.kb-key').addEventListener('click', () => {
      kbListening = i;
      renderKbRows();
    });
    kbBtns.rows.appendChild(row);
  }
}

// 监听模式：下一个按键绑到该轨（Esc 取消监听不关弹窗）
window.addEventListener('keydown', e => {
  if (kbBtns.modal.classList.contains('hidden') || kbListening < 0) return;
  e.preventDefault(); e.stopPropagation();
  if (e.code === 'Escape') { kbListening = -1; }
  else kbDraft[kbListening] = e.code;
  kbListening = -1;
  renderKbRows();
}, true);

// 保存：清空空轨（null 保留默认），写 localStorage 并立即生效
function saveKb() {
  if (kbDraft.some((c, i) => c && kbDraft.filter(x => x === c).length > 1)) {
    alert('存在重复键位，请先解决标红的键帽');
    return;
  }
  // 草稿与默认完全一致则删存储，否则存自定义
  const sameAsDefault = kbDraft.every((c, i) => c === DEFAULT_KEYS[i][0]);
  if (sameAsDefault) localStorage.removeItem(kbStoreKey());
  else localStorage.setItem(kbStoreKey(), JSON.stringify(kbDraft));
  closeKb();
  // 重新计算生效键位（保留谱面副键默认，再叠自定义）
  applyKeymap(applyCustomKeys(normalizeKeys(state.map.keys, state.keyCount)));
}

function closeKb() {
  kbBtns.modal.classList.add('hidden');
  kbListening = -1;
}

kbBtns.open.addEventListener('click', openKb);
kbBtns.cancel.addEventListener('click', closeKb);
kbBtns.save.addEventListener('click', saveKb);
// 恢复默认：草稿回到默认键
kbBtns.reset.addEventListener('click', () => {
  kbDraft = DEFAULT_KEYS.slice(0, state.keyCount).map(p => p[0]);
  renderKbRows();
});

// ---------- 节奏校准弹窗：下落块落到判定线时点按，测本机延迟 ----------
const CAL_SPB = 0.6;        // 100 BPM，每拍 0.6s（对齐窗口 ±300ms，容得下大延迟）
const CAL_KEEP = 12;        // 参与平均的最近点按数
const CAL_APPROACH = 1.2;   // 方块从出现到判定线的下落时长（秒）
const cal = { open: false, timer: 0, raf: 0, t0: 0, nextT: 0, beatNo: 0, samples: [], lastTap: 0, blocks: [] };

// 节拍声：每 4 拍一个重音，帮助跟住拍点
function calTickSound(t, accent) {
  const ctx = SFX.ctx;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = accent ? 1200 : 800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(accent ? 0.5 : 0.32, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(g); g.connect(SFX.comp);
  osc.start(t); osc.stop(t + 0.1);
}

// 前瞻调度：以音频时钟为准排节拍（比 setInterval 精确），每拍生成一个下落块
// 前瞻量 = 下落时长：保证方块总是在开始下落前就创建好，从顶部完整落下
function calSchedule() {
  const ctx = SFX.ctx;
  while (cal.nextT < ctx.currentTime + CAL_APPROACH) {
    const accent = cal.beatNo % 4 === 0;
    calTickSound(cal.nextT, accent);
    // 下落块：颜色轮换轨道色，恰在节拍时刻抵达判定线
    const c = LANE_COLORS[cal.beatNo % LANE_COLORS.length];
    const el = document.createElement('div');
    el.className = 'cal-block';
    el.style.background = `linear-gradient(165deg, color-mix(in srgb, ${c} 42%, #fff), ${c})`;
    els.calBlocks.appendChild(el);
    cal.blocks.push({ t: cal.nextT, el, hit: false });
    cal.nextT += CAL_SPB;
    cal.beatNo++;
  }
}

// 下落块位置：rAF 按音频时钟推进，p=1 恰在线上（与节拍声同刻）
function calFrame() {
  if (!cal.open) return;
  cal.raf = requestAnimationFrame(calFrame);
  const t = SFX.ctx.currentTime;
  const lineCenter = els.calPad.clientHeight - 28;
  for (let i = cal.blocks.length - 1; i >= 0; i--) {
    const b = cal.blocks[i];
    const p = (t - (b.t - CAL_APPROACH)) / CAL_APPROACH;
    if (p < 0) continue;   // 还没到出现时间
    if (p > 1.35 || (b.hit && p > 1.3)) {   // 漏掉飘出 / 爆散动画播完：回收
      b.el.remove(); cal.blocks.splice(i, 1);
      continue;
    }
    b.el.style.top = (p * (lineCenter + 27) - 50) + 'px';   // p=0 藏于顶边外，p=1 中心恰在判定线
    // 过线未击：继续下落并淡出
    b.el.style.opacity = p > 1.1 ? String(Math.max(0, 1 - (p - 1.1) / 0.25)) : '1';
  }
}

function calRender() {
  if (!cal.samples.length) {
    els.calVal.textContent = '跟拍中…';
    els.calCnt.textContent = '';
    return;
  }
  const avg = cal.samples.reduce((a, b) => a + b, 0) / cal.samples.length;
  const ms = Math.round(avg * 1000);
  els.calVal.textContent = (ms >= 0 ? '+' : '') + ms + ' ms';
  els.calCnt.textContent = `已采 ${cal.samples.length} 次（正值 = 点得晚，保存后判定按此提前补偿）`;
}

function calStart() {
  const ctx = SFX.ensure();
  if (!ctx) { els.calVal.textContent = '浏览器不支持音频，无法校准'; return; }
  cal.open = true;
  cal.samples = [];
  cal.beatNo = 0;
  cal.lastTap = 0;
  cal.t0 = cal.nextT = ctx.currentTime + CAL_APPROACH + 0.1;   // 首拍留足下落时长，方块才能从顶部完整落下
  cal.timer = setInterval(calSchedule, 50);
  cal.raf = requestAnimationFrame(calFrame);
  calRender();
}

function calStop() {
  cal.open = false;
  clearInterval(cal.timer);
  cancelAnimationFrame(cal.raf);
  cal.blocks.forEach(b => b.el.remove());
  cal.blocks = [];
}

// 一次点按：对齐最近一拍，偏差计入样本，并爆散对应方块
function calTap() {
  if (!cal.open) return;
  const ctx = SFX.ctx;
  const t = ctx.currentTime;
  if (t - cal.lastTap < 0.12) return;   // 抖动去重
  cal.lastTap = t;
  if (t < cal.t0 - 0.15) return;        // 起拍前的乱点不计
  const k = Math.round((t - cal.t0) / CAL_SPB);
  const delta = t - (cal.t0 + k * CAL_SPB);
  cal.samples.push(delta);
  if (cal.samples.length > CAL_KEEP) cal.samples.shift();
  // 命中视觉：该拍的方块爆散（尚未出现的忽略）
  const bt = cal.t0 + k * CAL_SPB;
  for (const b of cal.blocks) {
    if (!b.hit && Math.abs(b.t - bt) < 0.01 && t >= b.t - CAL_APPROACH) {
      b.hit = true;
      b.el.classList.add('hit');
      break;
    }
  }
  // 单次偏差闪现：±45ms 内标绿（接近完美）
  const ms = Math.round(delta * 1000);
  els.calFlash.textContent = (ms >= 0 ? '+' : '') + ms + ' ms';
  els.calFlash.style.color = Math.abs(ms) <= 45 ? 'var(--brand)' : 'var(--text-2)';
  els.calFlash.classList.remove('show');
  void els.calFlash.offsetWidth;
  els.calFlash.classList.add('show');
  calRender();
}

els.calBtn.addEventListener('click', () => {
  els.calModal.classList.remove('hidden');
  calStart();
});
els.calPad.addEventListener('pointerdown', e => { e.preventDefault(); calTap(); });
els.calSave.addEventListener('click', () => {
  // 样本太少不保存（视为取消），避免误存离谱值
  if (cal.samples.length >= 4) {
    const avg = cal.samples.reduce((a, b) => a + b, 0) / cal.samples.length;
    const ms = Math.round(avg * 1000);
    state.userOffset = ms / 1000;
    try { localStorage.setItem(USER_OFFSET_KEY, String(ms)); } catch { /* 忽略 */ }
  }
  calStop();
  els.calModal.classList.add('hidden');
});
els.calCancel.addEventListener('click', () => { calStop(); els.calModal.classList.add('hidden'); });
els.calReset.addEventListener('click', () => {
  state.userOffset = 0;
  try { localStorage.removeItem(USER_OFFSET_KEY); } catch { /* 忽略 */ }
  calStop();
  els.calModal.classList.add('hidden');
});
// 弹窗打开时按任意键等同点按（Esc 关闭）
document.addEventListener('keydown', e => {
  if (!cal.open || e.repeat) return;
  if (e.code === 'Escape') { els.calCancel.click(); return; }
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  calTap();
});

// ---------- 对战血量：哪边按错扣哪边，一方归零直接结算 ----------
// 轨道归属：前半归左方 notch，后半归右方 古阵兴
function sideOf(lane) { return lane < state.leftCount ? 'left' : 'right'; }

// 扣血：kind = miss 漏接 / break 断连 / ghost 空按（autoplay 调试不扣血）
function damageHP(side, kind) {
  if (!state.running || state.autoplay || state.hp[side] <= 0) return;
  state.hp[side] = Math.max(0, state.hp[side] - DMG[kind]);
  updateHP(side);
  hitCharAnim(side);   // 人物受击反馈
  if (state.hp[side] <= 0) finish(true);   // 一方归零：立即结算
}

// 人物受击：隐藏正常图，差分图闪现 + 抖动，动画结束后恢复
const hitTimers = { left: 0, right: 0 };
function hitCharAnim(side) {
  const hitEl = side === 'left' ? els.charHitL : els.charHitR;
  const normalEl = side === 'left' ? els.charL : els.charR;
  clearTimeout(hitTimers[side]);   // 连续受击重置计时，避免提前恢复
  hitEl.classList.remove('hit-anim');
  void hitEl.offsetWidth;
  hitEl.classList.add('hit-anim');
  normalEl.classList.add('hidden');   // 受击期间隐藏正常图
  hitTimers[side] = setTimeout(() => {
    normalEl.classList.remove('hidden');   // 恢复正常图
    hitEl.classList.remove('hit-anim');    // 差分图回归透明
  }, 350);
}

// 血条 UI：填充 + 残影 + 濒死警告（人物同步闪烁）
function updateHP(side) {
  const pct = state.hp[side] / HP_MAX * 100;
  const fill = side === 'left' ? els.hpFillL : els.hpFillR;
  const ghost = side === 'left' ? els.hpGhostL : els.hpGhostR;
  const char = side === 'left' ? els.charL : els.charR;
  fill.style.width = pct + '%';
  ghost.style.width = pct + '%';   // ghost 有延迟过渡，形成掉血拖尾
  fill.classList.toggle('low', pct < 30);
  char.classList.toggle('danger', pct < 30 && pct > 0);
}

// ---------- 主循环 ----------
function gameTime() {
  // 预滚动：倒计时期间返回负时间（-2.4 → 0），音符提前下落但不判定
  if (state.preroll) return (performance.now() - state.prerollStart) / 1000 - COUNTDOWN_S;
  return state.running ? state.audio.currentTime - state.baseTime : 0;
}

function loop() {
  if (!state.running && !state.preroll) return;
  requestAnimationFrame(loop);
  if (state.paused) return;   // 暂停：音频已停，时间冻结
  const t = gameTime();
  const jt = t - state.userOffset;   // 补偿后时钟：漏接窗口与命中判定同坐标系
  const notes = state.map.notes;
  const off = state.map.offset || 0;

  // 0) 谱面已完（最后一个音符判定窗口已过）：直接结算，不等音乐放完
  if (state.endTime && t > state.endTime) { finish(); return; }

  // 1) Miss 检测：noteIdx 之前的音符均已完结（命中或漏接）
  while (state.noteIdx < notes.length) {
    const n = notes[state.noteIdx];
    const nt = n.time + off;
    if (n._done) { state.noteIdx++; continue; }
    if (nt - jt < -WIN.good) {
      n._done = 'miss';
      lastHitLane = n.lane;
      state.counts.miss++;
      state.combo = 0;
      els.combo.textContent = '0';
      showJudge('MISS', 'miss', n.lane);
      SFX.miss();
      shakeScreen();   // Miss 震屏反馈
      damageHP(sideOf(n.lane), 'miss');   // 漏接扣所属方血
      state.noteIdx++;
      removeNoteEl(n);
    } else break;
  }

  // 1.5) 自动弹调试：自动命中待处理音符（走真实判定，预滚动期不触发）
  if (state.autoplay && !state.preroll) autoPlayTick();

  // 2) 未完结音符位置更新（hold 按住中仍跟随）
  for (let i = state.noteIdx; i < notes.length; i++) {
    const n = notes[i];
    if (n._done && n._done !== 'hold') continue;
    const nt = n.time + off;
    const y = state.judgeY - (nt - t) * state.pxPerMs * 1000 - NOTE_SIZE / 2;
    if (y > state.judgeY + 40) break;
    if (y < -NOTE_SIZE - 80) continue;
    let el = n._el;
    if (!el) {
      el = n._el = makeNoteEl(n);
      state.laneEls[n.lane].appendChild(el);
    }
    // hold 按住中：头部锁定判定线；否则正常下落
    el.style.top = (n._done === 'hold' ? state.judgeY - NOTE_SIZE / 2 : y) + 'px';
  }

  // 3) hold：尾条缩短 + 完成检测（独立于游标，避免被跳过）
  for (const [idx, h] of state.holds) {
    const n = notes[idx];
    const endT = n.endTime + off;   // endTime 同坐标系，统一加偏移
    if (!h.completed && t >= endT) {
      h.completed = true;
      n._done = 'complete';
      addScore(SCORE.holdBonus);
      SFX.holdTick();   // hold 完成轻响
      state.holds.delete(idx);
      removeNoteEl(n);
      continue;
    }
    if (n._done === 'hold' && n._el) {
      const tail = n._el.querySelector('.hold-tail');
      if (tail) tail.style.height = Math.max(4, (endT - t) * state.pxPerMs * 1000) + 'px';
    }
  }

  updateHUD();
}

/* 命中/漏接后的统一移除：播放消散动画并清理 DOM */
function removeNoteEl(n) {
  if (!n._el || n._removed) return;
  n._removed = true;
  n._el.classList.add('hit');
  n._el.style.opacity = '0';
  setTimeout(() => n._el.remove(), 260);
}

function makeNoteEl(n) {
  const el = document.createElement('div');
  el.className = 'note' + (n.type === 'hold' ? ' hold' : '');
  el.dataset.lane = n.lane;
  // 统一向上箭头按轨道旋转
  el.innerHTML = `<div class="arrow-body"><svg viewBox="0 0 24 24" width="30" height="30"><g transform="rotate(${LANE_ROTATIONS[n.lane]} 12 12)"><path d="${ARROW_UP_PATH}" fill="#fff"/></g></svg></div>`;
  if (n.type === 'hold') {
    const tail = document.createElement('div');
    tail.className = 'hold-tail';
    // 尾条固定为完整长度（未命中时随音符整体下落，长度不变）
    tail.style.height = Math.max(6, (n.endTime - n.time) * state.pxPerMs * 1000) + 'px';
    el.appendChild(tail);
  }
  el.style.left = '50%';
  return el;
}

// ---------- 判定 ----------
function hitLane(lane) {
  if (!state.running) return;
  const notes = state.map.notes;
  // 判定用补偿后时钟：本机声音到得晚（userOffset>0），玩家按键整体偏晚，往前扣回
  const t = gameTime() - state.userOffset;
  let best = null;
  for (let i = state.noteIdx; i < notes.length; i++) {
    const n = notes[i];
    if (n.lane !== lane || n._done) continue;
    const diff = (n.time + (state.map.offset || 0)) - t;
    if (diff > WIN.perfect + 0.12) break;          // 还没到
    if (diff < -WIN.good - 0.12) continue;          // 已经过了
    if (!best || Math.abs(diff) < Math.abs(best.diff)) best = { i, n, diff };
  }
  if (!best) return false;   // 空按：无命中音符（供 ghost 扣血判断）
  const { i, n, diff } = best;
  const ad = Math.abs(diff);
  spawnParticles(lane);   // 命中粒子迸射

  if (n.type === 'hold') {
    if (ad <= WIN.perfect) { judge('perfect', lane); }
    else if (ad <= WIN.great) { judge('great', lane); }
    else { judge('good', lane); }
    n._done = 'hold';             // 开始命中：按住中（不移除，由 holds 循环管理）
    if (n._el) n._el.classList.add('hold-active');
    state.holds.set(i, { completed: false });
  } else {
    if (ad <= WIN.perfect) { judge('perfect', lane); }
    else if (ad <= WIN.great) { judge('great', lane); }
    else { judge('good', lane); }
    n._done = 'tap';              // 命中完成：立即消散移除
    removeNoteEl(n);
  }
  return true;   // 有命中
}

function judge(kind, lane) {
  state.counts[kind]++;
  addScore(SCORE[kind]);
  bumpCombo(1);
  showJudge({ perfect: 'PERFECT', great: 'GREAT', good: 'GOOD' }[kind], kind, lane);
  SFX.hit(kind);
  // 判定线脉冲反馈
  pulseJudgeLine(kind);
  // 连击里程碑：50/100/... 加一圈扩散环
  if (state.combo > 0 && state.combo % 50 === 0) comboBurst();
}

function addScore(v) {
  state.score += v;
  els.score.textContent = state.score.toLocaleString();
}

function bumpCombo(delta) {
  state.combo = Math.max(0, state.combo + delta);
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  els.combo.textContent = state.combo;
  if (delta > 0) {
    els.combo.classList.remove('pop');
    void els.combo.offsetWidth;
    els.combo.classList.add('pop');
  }
}

function updateHUD() {
  const max = state.totalPossible;
  const acc = max > 0 ? Math.max(0, state.score / max * 100) : 100;
  els.acc.textContent = acc.toFixed(2) + '%';
}

function showJudge(text, kind, lane) {
  els.lastJudge.textContent = text;
  els.lastJudge.className = 'hud-judge ' + kind;
  els.lastJudge.classList.remove('show');
  void els.lastJudge.offsetWidth;
  els.lastJudge.classList.add('show');
  // 命中特效：定位到对应轨道中心（fxLayer 为 absolute 定位参照）
  const fx = document.createElement('div');
  fx.className = 'fx';
  const l = lane !== undefined ? lane : lastHitLane;
  fx.style.setProperty('--lane-c', LANE_COLORS[l]);
  const laneRect = state.laneEls[l].getBoundingClientRect();
  const layerRect = els.fxLayer.getBoundingClientRect();
  fx.style.left = (laneRect.left + laneRect.width / 2 - layerRect.left) + 'px';
  els.fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 500);
}
let lastHitLane = 0;

// ---------- 打击感视觉反馈 ----------
// 判定线脉冲：命中瞬间亮一下
function pulseJudgeLine(kind) {
  const line = els.judgeLine;
  line.classList.remove('pulse', 'pulse-strong');
  void line.offsetWidth;   // 重触发动画
  line.classList.add(kind === 'perfect' ? 'pulse-strong' : 'pulse');
}

// Miss/Break 震屏
function shakeScreen() {
  document.body.classList.remove('shake');
  void document.body.offsetWidth;
  document.body.classList.add('shake');
}

// 连击里程碑：判定线全宽扩散环
function comboBurst() {
  const burst = document.createElement('div');
  burst.className = 'combo-burst';
  els.fxLayer.appendChild(burst);
  setTimeout(() => burst.remove(), 700);
}

// 命中粒子：沿轨道色迸出
function spawnParticles(lane) {
  const laneEl = state.laneEls[lane];
  const rect = laneEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = state.judgeY;
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.setProperty('--lane-c', LANE_COLORS[lane]);
    // 随机迸射方向（上半圆）
    const ang = -Math.PI * Math.random();
    const dist = 40 + Math.random() * 55;
    p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    els.fxLayer.appendChild(p);
    setTimeout(() => p.remove(), 480);
  }
}

// ---------- 输入：键盘 + 触屏共用（pressLane / releaseLane） ----------
function pressLane(lane) {
  lastHitLane = lane;
  // 按住期间整轨高亮，松开熄灭
  const laneEl = state.laneEls && state.laneEls[lane];
  if (laneEl) laneEl.classList.add('active');
  if (!state.running || state.paused) return;
  // 空按（ghost）：无命中音符 → 扣该键所属方血
  if (!hitLane(lane)) damageHP(sideOf(lane), 'ghost');
}

function releaseLane(lane) {
  // 松开：轨道熄灭
  const laneEl = state.laneEls && state.laneEls[lane];
  if (laneEl) laneEl.classList.remove('active');
  if (!state.running || state.paused) return;
  // hold 提前松开 → BREAK（endTime 统一加偏移，与判定同坐标系）
  for (const [idx, h] of state.holds) {
    const n = state.map.notes[idx];
    const endT = n.endTime + (state.map.offset || 0);
    if (n.lane === lane && !h.completed && gameTime() - state.userOffset < endT - 0.06) {
      h.completed = true;
      n._done = 'broken';
      state.holds.delete(idx);
      state.combo = 0;
      els.combo.textContent = '0';
      showJudge('BREAK', 'miss', lane);
      SFX.break_();
      shakeScreen();
      damageHP(sideOf(lane), 'break');   // 断连扣所属方血
      removeNoteEl(n);
      break;   // 同轨道同时只有一个按住中的 hold
    }
  }
}

document.addEventListener('keydown', e => {
  if (e.code === 'Escape' && state.running) { togglePause(); return; }
  if (e.repeat) return;
  const lane = LANE_KEYMAP[e.code];
  if (lane === undefined) return;
  e.preventDefault();
  state.activeKey[e.code] = true;
  pressLane(lane);
});

document.addEventListener('keyup', e => {
  const lane = LANE_KEYMAP[e.code];
  if (lane === undefined) return;
  delete state.activeKey[e.code];
  releaseLane(lane);
});

// ---------- 触屏：点按轨道即按键（多点触控，双人对战各点各的） ----------
const touchLane = new Map();   // touchId -> lane
// 按实际轨道元素中心最近匹配（轨道收窄居中后全宽均分会错位）
function laneFromPoint(clientX) {
  let best = 0, bestDist = Infinity;
  (state.laneEls || []).forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const d = Math.abs(clientX - (r.left + r.width / 2));
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
}
els.stage.addEventListener('touchstart', e => {
  if (!state.running) return;   // 开始页按钮正常触控
  e.preventDefault();   // 防滚动/缩放
  for (const t of e.changedTouches) {
    const lane = laneFromPoint(t.clientX);
    touchLane.set(t.identifier, lane);
    pressLane(lane);
  }
}, { passive: false });
// 触屏没有 keyup：touchend/touchcancel 释放对应轨道
function touchRelease(e) {
  for (const t of e.changedTouches) {
    const lane = touchLane.get(t.identifier);
    if (lane === undefined) continue;
    touchLane.delete(t.identifier);
    releaseLane(lane);
  }
}
els.stage.addEventListener('touchend', touchRelease);
els.stage.addEventListener('touchcancel', touchRelease);

// 触屏暂停按钮（触屏设备游戏中显示，CSS 控制）
els.pauseBtn.addEventListener('click', () => {
  if (state.running) togglePause();
});

// ---------- 暂停：音频与谱面同停同续（gameTime 基于音频时间，天然对齐） ----------
function togglePause() {
  state.paused = !state.paused;
  if (state.paused) {
    state.audio.pause();
    els.pausePanel.classList.remove('hidden');
  } else {
    state.audio.play();
    els.pausePanel.classList.add('hidden');
  }
}

// ---------- 结束 ----------
// ko=true 表示一方血量归零提前结算
function finish(ko) {
  if (!state.running) return;   // 防重复结算
  state.running = false;
  state.audio.pause();
  els.pauseBtn.classList.add('hidden');   // 结算后隐藏暂停按钮
  const max = state.totalPossible;
  const acc = max > 0 ? Math.max(0, state.score / max * 100) : 100;

  // 对战结果：按血量判胜负（血量相同算平局）
  const koL = state.hp.left <= 0, koR = state.hp.right <= 0;
  let winner = null;
  if (koL && !koR) winner = 'r';
  else if (koR && !koL) winner = 'l';
  else if (state.hp.left > state.hp.right) winner = 'l';
  else if (state.hp.right > state.hp.left) winner = 'r';

  els.resultTitle.textContent = winner ? 'VICTORY' : 'DRAW';
  els.resultTitle.classList.toggle('win', !!winner);
  els.vsHpL.textContent = Math.round(state.hp.left);
  els.vsHpR.textContent = Math.round(state.hp.right);
  els.vsNameL.classList.toggle('winner', winner === 'l');
  els.vsNameR.classList.toggle('winner', winner === 'r');

  // 段位按准确率
  let rank = 'D';
  if (acc >= 98) rank = 'SS';
  else if (acc >= 93) rank = 'S';
  else if (acc >= 85) rank = 'A';
  else if (acc >= 75) rank = 'B';
  else if (acc >= 60) rank = 'C';
  // 一方归零：显示 KO 段位
  if (ko && (koL || koR)) rank = 'KO';

  els.rScore.textContent = state.score.toLocaleString();
  els.rAcc.textContent = acc.toFixed(2) + '%';
  els.rCombo.textContent = state.maxCombo;
  els.rank.textContent = rank;
  els.rank.className = 'rank ' + rank;
  els.cP.textContent = state.counts.perfect;
  els.cG.textContent = state.counts.great;
  els.cO.textContent = state.counts.good;
  els.cM.textContent = state.counts.miss;
  els.result.classList.remove('hidden');
  submitAndShowLB(rank, acc);   // 登录则提交成绩并渲染排行榜
  reportClear(ko);   // 完整通关（非KO、非autoplay）上报，作为上传社区资格
}

// 通关上报：完整打完且双方存活才记录（autoplay 调试不算）
function reportClear(ko) {
  if (ko || state.autoplay) return;   // 被KO或自动弹不算通关
  const mapId = state.map && state.map.id;
  if (!mapId) return;
  let token = null;
  try { token = localStorage.getItem('ottohub_token'); } catch { return; }
  if (!token) return;   // 未登录无法归属通关者
  fetch(`/api/maps/${encodeURIComponent(mapId)}/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }).catch(() => {});   // 静默失败不影响结算
}

// ---------- 排行榜：提交成绩 + 渲染 TOP10 ----------
async function submitAndShowLB(rank, acc) {
  const lbList = document.getElementById('lbList');
  const lbStatus = document.getElementById('lbStatus');
  const mapId = state.map && state.map.id;
  // 读取首页存的登录态
  let user = null;
  try {
    const token = localStorage.getItem('ottohub_token');
    if (token) user = {
      token,
      uid: localStorage.getItem('ottohub_uid'),
      username: localStorage.getItem('ottohub_username'),
    };
  } catch { /* localStorage 不可用时视为未登录 */ }
  if (!mapId) return;
  if (!user) {
    lbStatus.textContent = '· 未登录（成绩未上传）';
    lbList.innerHTML = '<div class="r-lb-empty">登录 OttoHub 账号后自动上传成绩</div>';
    return;
  }
  lbStatus.textContent = '· 上传中…';
  let myRank = null;
  try {
    // 提交成绩（服务端校验 token，防伪造）
    const r = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: user.token,
        mapId,
        score: state.score,
        acc,
        maxCombo: state.maxCombo,
        rank,
        counts: state.counts,
      }),
    });
    const data = await r.json();
    if (r.ok) myRank = data.rank;
    else if (r.status === 401) {   // token 失效，清除本地登录态
      ['token', 'uid', 'username', 'avatar'].forEach(k => localStorage.removeItem('ottohub_' + k));
      lbStatus.textContent = '· 登录已过期（成绩未上传）';
      lbList.innerHTML = '<div class="r-lb-empty">请回首页重新登录</div>';
      return;
    }
  } catch { /* 提交失败仍展示榜单 */ }
  // 拉取排行榜 TOP10
  try {
    const { list } = await (await fetch(`/api/scores/${encodeURIComponent(mapId)}`)).json();
    if (!list || !list.length) {
      lbStatus.textContent = myRank ? `· 第 ${myRank} 名` : '';
      lbList.innerHTML = '<div class="r-lb-empty">暂无成绩</div>';
      return;
    }
    lbStatus.textContent = myRank ? `· 我的排名 #${myRank}` : '';
    lbList.innerHTML = list.slice(0, 10).map((e, i) => {
      const no = i + 1;
      const topCls = no === 1 ? 'top1' : no === 2 ? 'top2' : no === 3 ? 'top3' : '';
      const me = user && String(e.uid) === String(user.uid) ? ' me' : '';
      const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      return `<div class="r-lb-row${me}">
        <span class="no ${topCls}">${no}</span>
        <span class="name">${esc(e.username)}${me ? ' (我)' : ''}</span>
        <span class="rk">${esc(e.rank)}</span>
        <span class="sc">${e.score}</span>
      </div>`;
    }).join('');
  } catch {
    lbStatus.textContent = '· 榜单加载失败';
  }
}

els.retryBtn.addEventListener('click', () => {
  location.reload();
});

init();

/* ===== 下落箭头音乐游戏 - 游戏核心逻辑 ===== */
/* 支持 2~8 轨道 · 谱面自定义键位 */
'use strict';

const NOTE_SIZE = 60;
const APPROACH_MS = 1800;      // 音符从出现到判定线的下落时长
const WIN = { perfect: 0.045, great: 0.09, good: 0.135 };  // 判定窗口(秒)
const SCORE = { perfect: 1000, great: 600, good: 300, holdBonus: 500 };

// 8 轨道配置：颜色 / 符号 / 箭头旋转角 / 默认键位 [主, 副]
const LANE_COLORS = ['#ff3d81', '#00d9ff', '#ffc400', '#00ff9d', '#ff7847', '#8f6cff', '#ff4dd2', '#4dffd2'];
const ARROW_CHARS = ['↑', '↓', '←', '→', '↖', '↗', '↙', '↘'];
const LANE_ROTATIONS = [0, 180, 270, 90, 315, 45, 225, 135];
const DEFAULT_KEYS = [
  ['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown'], ['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight'],
  ['KeyQ', null], ['KeyE', null], ['KeyZ', null], ['KeyC', null],
];
const ARROW_UP_PATH = 'M12 3 L20 12 H15 V21 H9 V12 H4 Z';

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

// ---------- 初始化 ----------
async function init() {
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

  // 轨道数与键位（旧谱面默认 4 轨）
  state.keyCount = Math.min(8, Math.max(2, state.map.keyCount || 4));
  const keys = normalizeKeys(state.map.keys, state.keyCount);
  LANE_KEYMAP = {};
  keys.forEach((pair, lane) => pair.forEach(code => { if (code) LANE_KEYMAP[code] = lane; }));
  buildStage(keys);

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
  // 音符尺寸随轨道数收缩
  const noteSize = state.keyCount <= 4 ? 62 : state.keyCount <= 6 ? 54 : 46;
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

  // 键位提示
  els.keyHint.innerHTML = keys.map((pair, lane) =>
    `<div class="key-item"><span class="k" style="color:${LANE_COLORS[lane]};box-shadow:0 4px 0 #0a0c1c, 0 0 0 rgba(0,0,0,0)">${keyLabel(pair[0])}</span><span>${ARROW_CHARS[lane]}</span></div>`
  ).join('');
}

// ---------- 开始 ----------
els.startBtn.addEventListener('click', async () => {
  if (els.startBtn.disabled) return;
  els.startBtn.disabled = true;   // 防重入
  els.overlay.classList.add('hidden');
  els.hud.classList.remove('hidden');
  els.stage.classList.remove('hidden');
  layout();   // 舞台已显示，立即测量判定线

  // 倒计时期间不播音频：保证谱面 0 点 = 音频 0 点（根治位置错位）
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
  state.baseTime = 0;    // gameTime = 音频时间，所见即所判
  state.running = true;
  requestAnimationFrame(loop);
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

// ---------- 主循环 ----------
function gameTime() {
  return state.running ? state.audio.currentTime - state.baseTime : 0;
}

function loop() {
  if (!state.running) return;
  requestAnimationFrame(loop);
  if (state.paused) return;   // 暂停：音频已停，时间冻结
  const t = gameTime();
  const notes = state.map.notes;
  const off = state.map.offset || 0;

  // 1) Miss 检测：noteIdx 之前的音符均已完结（命中或漏接）
  while (state.noteIdx < notes.length) {
    const n = notes[state.noteIdx];
    const nt = n.time + off;
    if (n._done) { state.noteIdx++; continue; }
    if (nt - t < -WIN.good) {
      n._done = 'miss';
      lastHitLane = n.lane;
      state.counts.miss++;
      state.combo = 0;
      els.combo.textContent = '0';
      showJudge('MISS', 'miss');
      state.noteIdx++;
      removeNoteEl(n);
    } else break;
  }

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
  const t = gameTime();
  let best = null;
  for (let i = state.noteIdx; i < notes.length; i++) {
    const n = notes[i];
    if (n.lane !== lane || n._done) continue;
    const diff = (n.time + (state.map.offset || 0)) - t;
    if (diff > WIN.perfect + 0.12) break;          // 还没到
    if (diff < -WIN.good - 0.12) continue;          // 已经过了
    if (!best || Math.abs(diff) < Math.abs(best.diff)) best = { i, n, diff };
  }
  if (!best) return;
  const { i, n, diff } = best;
  const ad = Math.abs(diff);

  if (n.type === 'hold') {
    if (ad <= WIN.perfect) { judge('perfect'); }
    else if (ad <= WIN.great) { judge('great'); }
    else { judge('good'); }
    n._done = 'hold';             // 开始命中：按住中（不移除，由 holds 循环管理）
    if (n._el) n._el.classList.add('hold-active');
    state.holds.set(i, { completed: false });
  } else {
    if (ad <= WIN.perfect) { judge('perfect'); }
    else if (ad <= WIN.great) { judge('great'); }
    else { judge('good'); }
    n._done = 'tap';              // 命中完成：立即消散移除
    removeNoteEl(n);
  }
}

function judge(kind) {
  state.counts[kind]++;
  addScore(SCORE[kind]);
  bumpCombo(1);
  showJudge({ perfect: 'PERFECT', great: 'GREAT', good: 'GOOD' }[kind], kind);
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

function showJudge(text, kind) {
  els.lastJudge.textContent = text;
  els.lastJudge.className = 'hud-judge ' + kind;
  els.lastJudge.classList.remove('show');
  void els.lastJudge.offsetWidth;
  els.lastJudge.classList.add('show');
  // 命中特效
  const fx = document.createElement('div');
  fx.className = 'fx';
  fx.style.setProperty('--lane-c', LANE_COLORS[lastHitLane]);
  els.fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 500);
}
let lastHitLane = 0;

// ---------- 按键 ----------
document.addEventListener('keydown', e => {
  if (e.code === 'Escape' && state.running) { togglePause(); return; }
  if (e.repeat) return;
  const lane = LANE_KEYMAP[e.code];
  if (lane === undefined) return;
  e.preventDefault();
  lastHitLane = lane;
  // 按住期间整轨高亮，松开熄灭
  const laneEl = state.laneEls && state.laneEls[lane];
  if (laneEl) laneEl.classList.add('active');
  if (!state.running || state.paused) return;
  state.activeKey[e.code] = true;
  hitLane(lane);
});

document.addEventListener('keyup', e => {
  const lane = LANE_KEYMAP[e.code];
  if (lane === undefined) return;
  delete state.activeKey[e.code];
  // 松开：轨道熄灭
  const laneEl = state.laneEls && state.laneEls[lane];
  if (laneEl) laneEl.classList.remove('active');
  if (!state.running || state.paused) return;
  // hold 提前松开 → BREAK（endTime 统一加偏移，与判定同坐标系）
  for (const [idx, h] of state.holds) {
    const n = state.map.notes[idx];
    const endT = n.endTime + (state.map.offset || 0);
    if (n.lane === lane && !h.completed && gameTime() < endT - 0.06) {
      h.completed = true;
      n._done = 'broken';
      state.holds.delete(idx);
      state.combo = 0;
      els.combo.textContent = '0';
      showJudge('BREAK', 'miss');
      removeNoteEl(n);
      break;   // 同轨道同时只有一个按住中的 hold
    }
  }
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
function finish() {
  if (!state.running) return;   // 防重复结算
  state.running = false;
  const max = state.totalPossible;
  const acc = max > 0 ? Math.max(0, state.score / max * 100) : 100;
  let rank = 'D';
  if (acc >= 98) rank = 'SS';
  else if (acc >= 93) rank = 'S';
  else if (acc >= 85) rank = 'A';
  else if (acc >= 75) rank = 'B';
  else if (acc >= 60) rank = 'C';

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
}

els.retryBtn.addEventListener('click', () => {
  location.reload();
});

init();

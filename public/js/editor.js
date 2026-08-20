/* ===== 下落箭头音乐游戏 - 谱面编辑器核心逻辑 ===== */
/* 支持 2~8 轨道 · 自定义键位 · 实时按键录制生成谱面 */
'use strict';

// ---------- 常量 ----------
const MIN_LANES = 2;
const MAX_LANES = 8;
// 8 轨道功能色（降饱和，与 CSS 保持一致）
const LANE_COLORS = ['#e5484d', '#0091ff', '#f5a623', '#12b886', '#f76707', '#7048e8', '#e64980', '#0ca678'];
const ARROW_CHARS = ['↑', '↓', '←', '→', '↖', '↗', '↙', '↘'];
const LANE_ROTATIONS = [0, 180, 270, 90, 315, 45, 225, 135]; // 统一向上箭头的旋转角
const ARROW_UP_PATH = 'M12 3 L20 12 H15 V21 H9 V12 H4 Z';
const NOTE_W = 46;
const HOLD_MS = 180; // 录制时按住超过该时长生成 hold

// 默认键位：每轨 [主键code, 副键code|null]，前4轨兼容 WASD+方向键
const DEFAULT_KEYS = [
  ['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown'], ['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight'],
  ['KeyQ', null], ['KeyE', null], ['KeyZ', null], ['KeyC', null],
];

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const els = {
  mapName: $('mapName'), bpmInput: $('bpmInput'), snapSelect: $('snapSelect'),
  laneCountSelect: $('laneCountSelect'), keybindBtn: $('keybindBtn'),
  zoomOut: $('zoomOut'), zoomIn: $('zoomIn'), zoomLabel: $('zoomLabel'),
  followPlay: $('followPlay'), playBtn: $('playBtn'), stopBtn: $('stopBtn'),
  recordBtn: $('recordBtn'), recBar: $('recBar'), recCount: $('recCount'),
  timeLabel: $('timeLabel'), saveBtn: $('saveBtn'), playtestBtn: $('playtestBtn'),
  listBtn: $('listBtn'), bpmDetect: $('bpmDetect'),
  scrollArea: $('scrollArea'), content: $('content'),
  rulerRow: $('rulerRow'), waveCanvas: $('waveCanvas'), laneRows: $('laneRows'),
  laneLabels: $('laneLabels'),
  gridLayer: $('gridLayer'), playhead: $('playhead'),
  statusNotes: $('statusNotes'), statusTime: $('statusTime'), statusHint: $('statusHint'),
  saveState: $('saveState'), toast: $('toast'),
  modal: $('mapListModal'), modalClose: $('modalClose'), mapList: $('mapList'), newMapBtn: $('newMapBtn'),
  keybindModal: $('keybindModal'), keybindClose: $('keybindClose'),
  keybindRows: $('keybindRows'), keybindReset: $('keybindReset'),
};

// ---------- 状态 ----------
const state = {
  mapId: null,
  name: '未命名谱面',
  bpm: 120,
  offset: 0,
  keyCount: 4,        // 轨道数 2~8
  keys: [],           // 每轨 [主键, 副键|null]
  notes: [],
  duration: 0,
  zoom: 1,
  snapDiv: 4,
  selected: -1,
  playing: false,
  currentTime: 0,
  follow: true,
  audio: null,        // HTMLAudioElement
  audioCtx: null,     // 用于解码波形
  wavePeaks: null,    // {min:Float32Array, max:Float32Array, cols}
  drag: null,         // {type:'note'|'resize', note, grabOffset, origLane, moved}
  record: null,       // 录制状态 {press:Map, snapshot, count}
};

// 键位绑定弹窗监听状态 {lane, slot} | null
let keybindListening = null;

const pxPerSec = () => 60 * state.zoom;
const timeToX = t => t * pxPerSec();
const xToTime = x => x / pxPerSec();

// ---------- 工具 ----------
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.add('hidden'), 1800);
}

function snapTime(t) {
  const div = state.snapDiv;
  if (!div) return t;
  const step = (60 / state.bpm) / div;
  return Math.round(t / step) * step;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function fmtTime(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

// 键位显示名：KeyW→W / Digit1→1 / ArrowUp→↑
function keyLabel(code) {
  if (!code) return '—';
  const map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'SPACE' };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  return code.length > 4 ? code.slice(0, 4) : code;
}

// 统一向上箭头 + 旋转得到 8 个方向
const arrowSVG = lane => `<svg class="arrow-ico" viewBox="0 0 24 24" width="26" height="26"><g transform="rotate(${LANE_ROTATIONS[lane]} 12 12)"><path d="${ARROW_UP_PATH}" fill="#fff"/></g></svg>`;

// 规范化键位配置：补默认值并去重（同 code 只保留首次出现）
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

// code → 轨道号（未绑定返回 -1）
function laneFromCode(code) {
  for (let i = 0; i < state.keyCount; i++) {
    const pair = state.keys[i];
    if (pair && (pair[0] === code || pair[1] === code)) return i;
  }
  return -1;
}

// ---------- 音频与波形 ----------
async function loadAudio() {
  const res = await fetch('/api/audio');
  const buf = await res.arrayBuffer();
  els.audioCtx = els.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await els.audioCtx.decodeAudioData(buf);
  // 单声道混音，用于波形 & BPM
  const mono = new Float32Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    let v = 0;
    for (let c = 0; c < decoded.numberOfChannels; c++) v += decoded.getChannelData(c)[i];
    mono[i] = v / decoded.numberOfChannels;
  }
  state.waveData = mono;

  // 音频元素（支持 range 拖动）
  const audio = new Audio('/api/audio');
  audio.preload = 'auto';
  state.audio = audio;

  // 获取时长
  const info = await (await fetch('/api/audio/info')).json();
  state.duration = info.duration;
  return info;
}

function computePeaks(width) {
  const data = state.waveData;
  if (!data) return null;
  const cols = Math.max(1, Math.floor(width));
  const min = new Float32Array(cols).fill(1);
  const max = new Float32Array(cols).fill(-1);
  const per = data.length / cols;
  for (let i = 0; i < cols; i++) {
    const s = Math.floor(i * per), e = Math.max(s + 1, Math.floor((i + 1) * per));
    let mn = 1, mx = -1;
    for (let j = s; j < e && j < data.length; j++) {
      const v = data[j];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    min[i] = mn; max[i] = mx;
  }
  return { min, max, cols };
}

function drawWave() {
  const canvas = els.waveCanvas;
  const W = contentWidth();
  const H = canvas.height;
  if (canvas.width !== W) {
    canvas.width = W;
    state.wavePeaks = computePeaks(W);
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // 网格（与下方轨道对齐）
  const beatSec = 60 / state.bpm;
  const barSec = beatSec * 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 1;
  for (let t = barSec; t < state.duration; t += barSec) {
    ctx.beginPath(); ctx.moveTo(timeToX(t), 0); ctx.lineTo(timeToX(t), H); ctx.stroke();
  }

  const peaks = state.wavePeaks;
  if (!peaks) return;
  const mid = H / 2, amp = H / 2 - 5;
  // 简约风：波形单色灰
  ctx.fillStyle = '#a8afc0';
  for (let i = 0; i < peaks.cols; i++) {
    const top = mid - Math.max(peaks.max[i], 0) * amp;
    const h = Math.max(1.2, (peaks.max[i] - peaks.min[i]) * amp);
    ctx.fillRect(i, top, 1, h);
  }
  // 中线
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();
}

// ---------- 渲染：网格 + 标尺 ----------
function renderGrid() {
  const beatSec = 60 / state.bpm;
  const barSec = beatSec * 4;
  const pps = pxPerSec();

  // 网格线图层（一次渲染，贯穿所有轨道）
  const bars = Math.ceil(state.duration / barSec) + 1;
  const beats = Math.ceil(state.duration / beatSec) + 1;
  const showBeats = pps > 40;
  const showSub = pps > 110;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < bars; i++) {
    const el = document.createElement('div');
    el.className = 'gridline bar';
    el.style.left = (i * barSec * pps) + 'px';
    frag.appendChild(el);
  }
  if (showBeats) {
    for (let i = 0; i < beats; i++) {
      const t = i * beatSec;
      if (Math.abs(t / barSec - Math.round(t / barSec)) < 1e-6) continue; // 跳过小节线
      const el = document.createElement('div');
      el.className = 'gridline beat';
      el.style.left = (t * pps) + 'px';
      frag.appendChild(el);
    }
  }
  if (showSub) {
    const subSec = beatSec / 4;
    const subs = Math.ceil(state.duration / subSec) + 1;
    for (let i = 0; i < subs; i++) {
      const t = i * subSec;
      const beatIdx = t / beatSec;
      if (Math.abs(beatIdx - Math.round(beatIdx)) < 1e-6) continue;
      const el = document.createElement('div');
      el.className = 'gridline sub';
      el.style.left = (t * pps) + 'px';
      frag.appendChild(el);
    }
  }
  els.gridLayer.replaceChildren(frag);

  // 标尺刻度
  const rfrag = document.createDocumentFragment();
  for (let i = 0; i < bars; i++) {
    const tick = document.createElement('div');
    tick.className = 'tick big';
    const x = i * barSec * pps;
    tick.style.left = x + 'px';
    tick.innerHTML = `<div class="tick-line"></div><div class="tick-label">${i + 1}</div>`;
    rfrag.appendChild(tick);
  }
  // 秒刻度（px 足够密时显示）
  if (pps > 22) {
    for (let t = 1; t < state.duration; t++) {
      if (Math.abs((t / barSec) % 1) < 1e-6) continue;
      const tick = document.createElement('div');
      tick.className = 'tick';
      tick.style.left = (t * pps) + 'px';
      tick.innerHTML = `<div class="tick-line"></div><div class="tick-label">${t}s</div>`;
      rfrag.appendChild(tick);
    }
  }
  els.rulerRow.replaceChildren(rfrag);

  els.content.style.width = Math.max(contentWidth(), els.scrollArea.clientWidth) + 'px';
}

function contentWidth() {
  return Math.max(state.duration * pxPerSec() + 200, els.scrollArea.clientWidth - 96);
}

// ---------- 渲染：动态轨道 ----------
function renderLanes() {
  // 轨道多时压缩行高，保证 8 轨也能放进视口
  document.body.dataset.lanes = state.keyCount;

  // 左侧标签列
  const frag = document.createDocumentFragment();
  for (let i = 0; i < state.keyCount; i++) {
    const label = document.createElement('div');
    label.className = 'row-label lane-label';
    label.dataset.lane = i;
    const pair = state.keys[i] || [null, null];
    const keysText = pair[1] ? `${keyLabel(pair[0])} / ${keyLabel(pair[1])}` : keyLabel(pair[0]);
    label.innerHTML = `<span class="arrow">${ARROW_CHARS[i]}</span><span class="key">${keysText}</span>`;
    frag.appendChild(label);
  }
  els.laneLabels.replaceChildren(frag);

  // 轨道行
  const rows = document.createDocumentFragment();
  for (let i = 0; i < state.keyCount; i++) {
    const row = document.createElement('div');
    row.className = 'row lane-row';
    row.dataset.lane = i;
    rows.appendChild(row);
  }
  els.laneRows.replaceChildren(rows);

  renderNotes();
}

// ---------- 渲染：音符 ----------
function noteEl(note, idx) {
  const d = document.createElement('div');
  d.className = 'note' + (note.type === 'hold' ? ' hold' : '') + (idx === state.selected ? ' selected' : '');
  d.dataset.lane = note.lane;
  d.dataset.idx = idx;
  d.style.left = timeToX(note.time) + 'px';
  d.innerHTML = arrowSVG(note.lane);
  if (note.type === 'hold') addHoldDom(d, note);
  return d;
}

// 给音符 DOM 附加 hold 尾条与调整把手（录制实时转 hold 时复用）
function addHoldDom(el, note) {
  if (el.querySelector('.hold-tail')) return;
  el.classList.add('hold');
  const tail = document.createElement('div');
  tail.className = 'hold-tail';
  el.appendChild(tail);
  const handle = document.createElement('div');
  handle.className = 'hold-handle';
  el.appendChild(handle);
  setTailW(el, note);
}

// 设置 hold 尾条宽度变量（时间轴横向，尾条向右延伸，把手位置同步）
function setTailW(el, note) {
  const w = Math.max(8, (note.endTime - note.time) * pxPerSec());
  el.style.setProperty('--tail-w', w + 'px');
}

function renderNotes() {
  const sorted = [...state.notes].sort((a, b) => a.time - b.time);
  // 保持 state.notes 顺序为时间序
  if (state.notes.length !== sorted.length || sorted.some((n, i) => n !== state.notes[i])) {
    state.notes = sorted;
  }
  const lanes = [...els.laneRows.children];
  lanes.forEach(l => l.replaceChildren());
  state.notes.forEach((n, i) => {
    if (lanes[n.lane]) lanes[n.lane].appendChild(noteEl(n, i)); // 越界音符防御
  });
  els.statusNotes.textContent = `音符: ${state.notes.length}`;
}

function updatePlayheadUI() {
  const x = timeToX(state.currentTime);
  els.playhead.style.left = x + 'px';
  els.playhead.style.display = 'block';
  els.timeLabel.textContent = `${fmtTime(state.currentTime)} / ${fmtTime(state.duration)}`;
  els.statusTime.textContent = `时间: ${state.currentTime.toFixed(3)}s`;
  if (state.follow && (state.playing || state.record)) {
    const sa = els.scrollArea;
    const vw = sa.clientWidth;
    if (x < sa.scrollLeft + 140) sa.scrollLeft = Math.max(0, x - 140);
    else if (x > sa.scrollLeft + vw - 140) sa.scrollLeft = x - vw + 140;
  }
}

function seek(t) {
  t = clamp(t, 0, Math.max(0, state.duration - 0.02));
  state.currentTime = t;
  if (state.audio) state.audio.currentTime = t;
  updatePlayheadUI();
}

// ---------- 播放控制 ----------
async function togglePlay() {
  if (!state.audio) { toast('音频尚未就绪'); return; }
  if (state.record) { finishRecord(); return; } // 录制中空格 = 结束录制
  if (state.audio.paused) {
    if (state.currentTime >= state.duration - 0.05) seek(0);
    state.audio.currentTime = state.currentTime;
    await state.audio.play();
    state.playing = true;
    els.playBtn.textContent = '❚❚ 暂停';
  } else {
    state.audio.pause();
    state.currentTime = state.audio.currentTime;
    state.playing = false;
    els.playBtn.textContent = '▶ 播放';
  }
}

function stopPlay() {
  if (state.record) { finishRecord(); return; }
  state.audio && state.audio.pause();
  state.playing = false;
  els.playBtn.textContent = '▶ 播放';
  seek(0);
}

function loop() {
  requestAnimationFrame(loop);
  if (state.audio && !state.audio.paused) {
    state.currentTime = state.audio.currentTime;
    updatePlayheadUI();
    // 录制中：实时延长按住的 hold 尾条
    if (state.record) {
      updateRecordTails();
      // 录制到音频结尾自动结束
      if (state.currentTime >= state.duration - 0.05) finishRecord();
    }
  }
}

// ---------- 实时录制：播放中按键自动生成谱面 ----------
async function toggleRecord() {
  if (state.record) { finishRecord(); return; }
  if (!state.audio) { toast('音频尚未就绪'); return; }
  if (!state.audio.paused) { state.audio.pause(); state.playing = false; els.playBtn.textContent = '▶ 播放'; }

  state.record = {
    press: new Map(),          // lane -> { note, down, el }
    snapshot: state.notes.slice(), // Esc 撤销快照
    count: 0,
  };
  state.selected = -1;
  document.body.classList.add('recording');
  els.recBar.classList.remove('hidden');
  els.recCount.textContent = '已录 0 音符';
  els.recordBtn.textContent = '⏹ 结束录制';
  els.recordBtn.classList.add('active');
  els.playBtn.textContent = '❚❚ 暂停';

  // 从头播放开始录制
  seek(0);
  await state.audio.play();
}

// 结束录制：未释放按键用当前时间定格
function finishRecord() {
  const rec = state.record;
  if (!rec) return;
  for (const { note, down } of rec.press.values()) {
    if (state.audio.currentTime - down >= HOLD_MS / 1000) {
      note.endTime = Math.max(note.time + 0.1, snapTime(state.audio.currentTime));
    }
  }
  rec.press.clear();
  state.record = null;
  state.audio && state.audio.pause();
  state.playing = false;
  els.playBtn.textContent = '▶ 播放';
  document.body.classList.remove('recording');
  document.querySelectorAll('.lane-row.key-active').forEach(el => el.classList.remove('key-active'));
  els.recBar.classList.add('hidden');
  els.recordBtn.textContent = '⏺ 录制';
  els.recordBtn.classList.remove('active');
  renderNotes();
  toast(`录制完成，新增 ${rec.count} 个音符`);
}

// 撤销本次录制
function cancelRecord() {
  const rec = state.record;
  if (!rec) return;
  state.notes = rec.snapshot;
  state.record = null;
  state.audio && state.audio.pause();
  state.playing = false;
  els.playBtn.textContent = '▶ 播放';
  document.body.classList.remove('recording');
  document.querySelectorAll('.lane-row.key-active').forEach(el => el.classList.remove('key-active'));
  els.recBar.classList.add('hidden');
  els.recordBtn.textContent = '⏺ 录制';
  els.recordBtn.classList.remove('active');
  renderNotes();
  toast('已撤销本次录制');
}

// 录制 keydown：按下立即生成音符并显示，长按过程中实时延长
function recordKeydown(lane) {
  const rec = state.record;
  if (rec.press.has(lane)) return;
  const down = state.audio.currentTime;
  const note = { time: clamp(snapTime(down), 0, state.duration), lane, type: 'tap' };
  state.notes.push(note);
  rec.count++;
  els.recCount.textContent = `已录 ${rec.count} 音符`;
  els.statusNotes.textContent = `音符: ${state.notes.length}`;

  // 直接追加 DOM（录制时时间单调递增，无需重排，避免打断其他按键的实时尾条）
  const el = noteEl(note, state.notes.length - 1);
  el.classList.add('rec-living'); // 按住中：尾条实时拉长的视觉状态
  const row = els.laneRows.querySelector(`.lane-row[data-lane="${lane}"]`);
  if (row) row.appendChild(el);
  rec.press.set(lane, { note, down, el });

  if (row) row.classList.add('key-active');
}

// 录制中每帧调用：按住超过阈值转 hold，尾条随播放实时增长
function updateRecordTails() {
  const now = state.audio.currentTime;
  for (const { note, down, el } of state.record.press.values()) {
    if (now - down < HOLD_MS / 1000) continue;
    if (note.type !== 'hold') {
      note.type = 'hold';
      note.endTime = now;
      addHoldDom(el, note);
    }
    note.endTime = Math.max(note.time + 0.1, now);
    setTailW(el, note);
  }
}

// 录制 keyup：定格尾条（短按保持 tap）
function recordKeyup(lane) {
  const rec = state.record;
  const p = rec.press.get(lane);
  if (!p) return;
  rec.press.delete(lane);
  const row = els.laneRows.querySelector(`.lane-row[data-lane="${lane}"]`);
  if (row) row.classList.remove('key-active');
  const { note, down } = p;
  if (state.audio.currentTime - down >= HOLD_MS / 1000) {
    note.endTime = Math.max(note.time + 0.1, snapTime(state.audio.currentTime));
  } else {
    note.type = 'tap';
    delete note.endTime;
  }
  // 就地替换为定格后的音符，不影响其他按住中的键
  const idx = state.notes.indexOf(note);
  p.el.replaceWith(noteEl(note, idx));
}

// ---------- 键位绑定弹窗 ----------
function renderKeybindRows() {
  const frag = document.createDocumentFragment();
  for (let lane = 0; lane < state.keyCount; lane++) {
    const pair = state.keys[lane] || [null, null];
    const row = document.createElement('div');
    row.className = 'keybind-row';
    row.innerHTML = `
      <span class="kb-arrow" style="color:${LANE_COLORS[lane]}">${ARROW_CHARS[lane]}</span>
      <span class="kb-lane">轨道 ${lane + 1}</span>
      <button class="kb-key" data-lane="${lane}" data-slot="0">${keyLabel(pair[0])}</button>
      <span class="kb-plus">+</span>
      <button class="kb-key" data-lane="${lane}" data-slot="1">${keyLabel(pair[1])}</button>`;
    frag.appendChild(row);
  }
  els.keybindRows.replaceChildren(frag);
}

// 绑定键：冲突时自动从原轨道移除
function assignKey(lane, slot, code) {
  state.keys.forEach((pair, l) => {
    pair.forEach((c, s) => { if (c === code) state.keys[l][s] = null; });
  });
  state.keys[lane][slot] = code;
  renderKeybindRows();
  renderLanes();
  toast(`轨道 ${lane + 1} 已绑定 [${keyLabel(code)}]`);
}

function openKeybindModal() {
  if (state.record) { toast('录制中无法修改键位'); return; }
  keybindListening = null;
  renderKeybindRows();
  els.keybindModal.classList.remove('hidden');
}

// ---------- BPM 检测（自相关） ----------
function detectBPM() {
  const data = state.waveData;
  if (!data) { toast('音频未加载'); return; }
  const hop = 1024;
  const sr = els.audioCtx.sampleRate;
  const fps = sr / hop;
  const frames = [];
  for (let i = 0; i < data.length; i += hop) {
    let sum = 0, n = 0;
    for (let j = i; j < Math.min(i + hop, data.length); j++) { sum += data[j] * data[j]; n++; }
    frames.push(Math.sqrt(sum / Math.max(1, n)));
  }
  const minLag = Math.floor(fps * 60 / 240), maxLag = Math.ceil(fps * 60 / 50);
  const scoreAt = lag => {
    let s = 0, n = 0;
    for (let i = 0; i + lag < frames.length; i += Math.max(1, lag >> 3)) {
      s += frames[i] * frames[i + lag]; n++;
    }
    return n ? s / n : 0;
  };
  let best = { lag: 0, score: -1 };
  for (let lag = minLag; lag <= maxLag; lag++) {
    const s = scoreAt(lag);
    if (s > best.score) best = { lag, score: s };
  }
  // 局部精化
  for (let lag = best.lag - 3; lag <= best.lag + 3; lag++) {
    if (lag < minLag || lag > maxLag) continue;
    const s = scoreAt(lag);
    if (s > best.score) best = { lag, score: s };
  }
  // 倍频检查：bpm/2 与 bpm*2
  const bpm0 = 60 * fps / best.lag;
  const cands = [bpm0];
  for (const m of [0.5, 2]) {
    const b = bpm0 * m;
    if (b >= 55 && b <= 260) {
      const lag = Math.round(60 * fps / b);
      const s = scoreAt(lag);
      if (s > best.score * 0.88) cands.push(b);
    }
  }
  const finalBpm = cands.reduce((acc, b) => Math.abs(b - 120) < Math.abs(acc - 120) ? b : acc, cands[0]);
  state.bpm = Math.round(finalBpm * 10) / 10;
  els.bpmInput.value = state.bpm;
  renderGrid(); drawWave();
  toast(`检测到 BPM ≈ ${state.bpm}`);
}

// ---------- 保存 / 加载 / 谱面库 ----------
async function saveMap(silent) {
  state.name = els.mapName.value.trim() || '未命名谱面';
  state.bpm = parseFloat(els.bpmInput.value) || 120;
  const payload = {
    id: state.mapId || undefined,
    name: state.name, bpm: state.bpm, offset: state.offset,
    keyCount: state.keyCount, keys: state.keys,
    notes: state.notes, duration: state.duration
  };
  const res = await fetch(state.mapId ? `/api/maps/${state.mapId}` : '/api/maps', {
    method: state.mapId ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) { toast('保存失败'); return null; }
  const saved = await res.json();
  state.mapId = saved.id;
  els.saveState.textContent = `已保存 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
  els.saveState.classList.add('saved');
  if (!silent) toast('谱面已保存');
  return saved;
}

function loadMap(map) {
  state.mapId = map.id;
  state.name = map.name;
  state.bpm = map.bpm || 120;
  state.offset = map.offset || 0;
  state.keyCount = clamp(map.keyCount || 4, MIN_LANES, MAX_LANES);
  state.keys = normalizeKeys(map.keys, state.keyCount);
  state.notes = (map.notes || []).map(n => ({ ...n })).sort((a, b) => a.time - b.time);
  state.selected = -1;
  els.mapName.value = state.name;
  els.bpmInput.value = state.bpm;
  els.laneCountSelect.value = state.keyCount;
  els.saveState.textContent = '已加载';
  els.saveState.classList.remove('saved');
  renderGrid(); renderLanes(); drawWave();
  seek(0);
}

async function refreshMapList() {
  const maps = await (await fetch('/api/maps')).json();
  els.mapList.replaceChildren();
  if (!maps.length) {
    const li = document.createElement('li');
    li.style.border = 'none';
    li.textContent = '（暂无谱面）';
    els.mapList.appendChild(li);
    return;
  }
  maps.forEach(m => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="m-name">${escapeHtml(m.name)}</span>
      <span class="m-meta">${m.bpm} BPM · ${m.keyCount || 4}K · ${m.noteCount} 音符</span>
      <span class="m-del" title="删除">🗑</span>`;
    li.querySelector('.m-name').addEventListener('click', async () => {
      const map = await (await fetch(`/api/maps/${m.id}`)).json();
      loadMap(map);
      els.modal.classList.add('hidden');
      toast(`已加载「${m.name}」`);
    });
    li.querySelector('.m-del').addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm(`删除谱面「${m.name}」？`)) return;
      await fetch(`/api/maps/${m.id}`, { method: 'DELETE' });
      if (state.mapId === m.id) {
        state.mapId = null; state.notes = []; state.selected = -1; renderNotes();
        els.saveState.textContent = '未保存';
      }
      refreshMapList();
      toast('已删除');
    });
    els.mapList.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- 交互：放置 / 拖动 / 删除 ----------
function laneFromY(clientY) {
  const rect = els.laneRows.getBoundingClientRect();
  const h = rect.height / state.keyCount; // 行高随轨道数变化
  return clamp(Math.floor((clientY - rect.top) / h), 0, state.keyCount - 1);
}

function timeFromClientX(clientX) {
  const rect = els.content.getBoundingClientRect();
  return clamp(snapTime(xToTime(clientX - rect.left)), 0, Math.max(0, state.duration - 0.02));
}

els.laneRows.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if (state.record) return; // 录制中禁用鼠标编辑
  const noteEl = e.target.closest('.note');
  const time = timeFromClientX(e.clientX);
  const lane = laneFromY(e.clientY);

  if (noteEl) {
    const idx = +noteEl.dataset.idx;
    const note = state.notes[idx];
    state.selected = idx;
    renderNotes();

    // hold 尾条把手调整
    if (e.target.classList.contains('hold-handle')) {
      state.drag = { type: 'resize', idx, note };
      e.target.classList.add('active');
      return;
    }
    // 拖动音符
    state.drag = { type: 'note', idx, note, grabOffset: note.time - time, origLane: note.lane, moved: false };
    return;
  }

  // 空白处：放置新音符
  const newNote = { time, lane, type: 'tap' };
  state.notes.push(newNote);
  state.notes.sort((a, b) => a.time - b.time);
  state.selected = state.notes.indexOf(newNote);
  renderNotes();
  state.drag = { type: 'note', idx: state.selected, note: newNote, grabOffset: 0, moved: false };
});

document.addEventListener('mousemove', e => {
  const d = state.drag;
  if (!d) return;
  const time = timeFromClientX(e.clientX);
  d.moved = true;
  if (d.type === 'resize') {
    d.note.endTime = Math.max(d.note.time + 0.1, time);
    // 就地更新尾条宽度
    const el = els.laneRows.querySelector(`.note[data-idx="${d.idx}"]`);
    if (el) setTailW(el, d.note);
    return;
  }
  // 移动音符（可跨轨道）
  d.note.time = clamp(snapTime(time + d.grabOffset), 0, Math.max(0, state.duration - 0.02));
  d.note.lane = laneFromY(e.clientY);
  const el = els.laneRows.querySelector(`.note[data-idx="${d.idx}"]`);
  if (el) {
    el.style.left = timeToX(d.note.time) + 'px';
    el.dataset.lane = d.note.lane;
  }
});

document.addEventListener('mouseup', () => {
  const d = state.drag;
  if (!d) return;
  state.drag = null;
  if (d.type === 'note') {
    state.notes.sort((a, b) => a.time - b.time);
    // 重新索引
    state.selected = state.notes.indexOf(d.note);
    renderNotes();
  } else {
    renderNotes();
  }
  document.querySelectorAll('.hold-handle.active').forEach(el => el.classList.remove('active'));
});

// 右键删除
els.laneRows.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (state.record) return;
  const noteEl = e.target.closest('.note');
  if (!noteEl) return;
  const idx = +noteEl.dataset.idx;
  state.notes.splice(idx, 1);
  state.selected = -1;
  renderNotes();
});

// 双击音符转 hold / 转 tap
els.laneRows.addEventListener('dblclick', e => {
  if (state.record) return;
  const noteEl = e.target.closest('.note');
  if (!noteEl) return;
  const idx = +noteEl.dataset.idx;
  const n = state.notes[idx];
  if (n.type === 'hold') { n.type = 'tap'; delete n.endTime; }
  else n.type = 'hold', n.endTime = n.time + 0.5;
  renderNotes();
});

// 点击波形 / 标尺 seek
els.waveCanvas.addEventListener('mousedown', e => {
  if (state.record) return;
  const rect = els.content.getBoundingClientRect();
  seek(xToTime(e.clientX - rect.left));
});
els.rulerRow.addEventListener('mousedown', e => {
  if (state.record) return;
  const rect = els.content.getBoundingClientRect();
  seek(xToTime(e.clientX - rect.left));
});

// ---------- 缩放 ----------
function setZoom(z) {
  const sa = els.scrollArea;
  const centerTime = (sa.scrollLeft + sa.clientWidth / 2) / pxPerSec();
  state.zoom = clamp(z, 0.25, 6);
  els.zoomLabel.textContent = '×' + state.zoom.toFixed(2);
  renderGrid(); drawWave(); renderNotes();
  const nx = centerTime * pxPerSec() - sa.clientWidth / 2;
  sa.scrollLeft = Math.max(0, nx);
  updatePlayheadUI();
}

// ---------- 快捷键（capture 层：键位绑定监听优先） ----------
document.addEventListener('keydown', e => {
  if (!keybindListening) return;
  e.preventDefault();
  e.stopPropagation();
  const { lane, slot } = keybindListening;
  keybindListening = null;
  if (e.code === 'Escape') { renderKeybindRows(); return; }
  if (e.code === 'F5' || e.code === 'F12') return;
  assignKey(lane, slot, e.code);
}, true);

// ---------- 快捷键（主逻辑层） ----------
document.addEventListener('keydown', async e => {
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);

  // 录制模式：轨道键打点，空格结束，Esc 撤销，屏蔽其他快捷键
  if (state.record) {
    if (e.repeat) { e.preventDefault(); return; }
    if (e.code === 'Space') { e.preventDefault(); finishRecord(); return; }
    if (e.code === 'Escape') { cancelRecord(); return; }
    const lane = laneFromCode(e.code);
    if (lane >= 0) { e.preventDefault(); recordKeydown(lane); }
    return;
  }

  if (e.code === 'Space' && !typing) {
    e.preventDefault();
    togglePlay();
  } else if (e.code === 'KeyR' && !typing) {
    e.preventDefault();
    toggleRecord();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected >= 0 && !typing) {
    state.notes.splice(state.selected, 1);
    state.selected = -1;
    renderNotes();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveMap();
  } else if (e.key === '+' || e.key === '=') {
    setZoom(state.zoom * 1.25);
  } else if (e.key === '-') {
    setZoom(state.zoom / 1.25);
  } else if (e.key === 'Escape') {
    state.selected = -1;
    renderNotes();
  }
});

// 录制 keyup：松开生成音符
document.addEventListener('keyup', e => {
  if (!state.record) return;
  const lane = laneFromCode(e.code);
  if (lane >= 0) recordKeyup(lane);
});

// ---------- 工具栏事件 ----------
els.playBtn.addEventListener('click', togglePlay);
els.stopBtn.addEventListener('click', stopPlay);
els.recordBtn.addEventListener('click', toggleRecord);
els.zoomIn.addEventListener('click', () => setZoom(state.zoom * 1.25));
els.zoomOut.addEventListener('click', () => setZoom(state.zoom / 1.25));
els.snapSelect.addEventListener('change', () => {
  state.snapDiv = +els.snapSelect.value;
});
els.followPlay.addEventListener('change', () => { state.follow = els.followPlay.checked; });
els.bpmInput.addEventListener('change', () => {
  state.bpm = parseFloat(els.bpmInput.value) || 120;
  renderGrid(); drawWave();
});
els.bpmDetect.addEventListener('click', detectBPM);

// 轨道数切换：越界音符提示删除
els.laneCountSelect.addEventListener('change', () => {
  const n = +els.laneCountSelect.value;
  if (n === state.keyCount) return;
  const out = state.notes.filter(note => note.lane >= n).length;
  if (out > 0 && !confirm(`有 ${out} 个音符超出新轨道范围，切换后将被删除。继续？`)) {
    els.laneCountSelect.value = state.keyCount;
    return;
  }
  if (out > 0) state.notes = state.notes.filter(note => note.lane < n);
  state.keyCount = n;
  state.keys = normalizeKeys(state.keys, n);
  renderLanes();
  toast(`已切换为 ${n} 轨道`);
});

// 键位绑定弹窗
els.keybindBtn.addEventListener('click', openKeybindModal);
els.keybindClose.addEventListener('click', () => els.keybindModal.classList.add('hidden'));
els.keybindModal.addEventListener('click', e => { if (e.target === els.keybindModal) els.keybindModal.classList.add('hidden'); });
els.keybindReset.addEventListener('click', () => {
  state.keys = normalizeKeys(null, state.keyCount);
  renderKeybindRows();
  renderLanes();
  toast('已恢复默认键位');
});
// 键槽点击 → 进入监听态
els.keybindRows.addEventListener('click', e => {
  const btn = e.target.closest('.kb-key');
  if (!btn) return;
  const lane = +btn.dataset.lane, slot = +btn.dataset.slot;
  keybindListening = { lane, slot };
  btn.textContent = '按键…';
  btn.classList.add('listening');
});

els.saveBtn.addEventListener('click', () => saveMap());
els.playtestBtn.addEventListener('click', async () => {
  const saved = await saveMap(true);
  if (saved) window.open(`/game.html?id=${saved.id}`, '_blank');
});
els.listBtn.addEventListener('click', () => {
  els.modal.classList.remove('hidden');
  refreshMapList();
});
els.modalClose.addEventListener('click', () => els.modal.classList.add('hidden'));
els.modal.addEventListener('click', e => { if (e.target === els.modal) els.modal.classList.add('hidden'); });
els.newMapBtn.addEventListener('click', () => {
  state.mapId = null;
  state.name = '未命名谱面';
  state.notes = [];
  state.selected = -1;
  state.bpm = 120;
  state.keyCount = 4;
  state.keys = normalizeKeys(null, 4);
  els.mapName.value = state.name;
  els.bpmInput.value = 120;
  els.laneCountSelect.value = 4;
  els.saveState.textContent = '未保存';
  els.saveState.classList.remove('saved');
  renderGrid(); renderLanes(); drawWave(); seek(0);
  els.modal.classList.add('hidden');
  toast('已新建空白谱面');
});

// ---------- 启动 ----------
(async function init() {
  try {
    const info = await loadAudio();
    state.keys = normalizeKeys(null, state.keyCount);
    renderLanes();

    // URL 参数加载已有谱面
    const params = new URLSearchParams(location.search);
    const mapId = params.get('id');
    if (mapId) {
      const map = await (await fetch(`/api/maps/${mapId}`)).json();
      loadMap(map);
    } else {
      renderGrid();
    }
    drawWave();
    renderNotes();
    seek(0);
    requestAnimationFrame(loop);
    els.statusHint.textContent = `音频: 8月20日.wav · ${fmtTime(info.duration)} · R 键开始录制`;
  } catch (err) {
    console.error(err);
    els.statusHint.textContent = '音频加载失败: ' + err.message;
  }
})();

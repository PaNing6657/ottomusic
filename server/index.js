/**
 * 下落式箭头音乐游戏 - 后端服务
 * 职责：静态托管前端 + 音频流式服务(Range) + 谱面 JSON CRUD
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const MAPS_DIR = path.join(ROOT, 'data', 'maps');
const SCORES_FILE = path.join(ROOT, 'data', 'scores.json');
const AUDIO_FILE = path.join(ROOT, '8月20日.wav');
const AUDIO_NAME = '8月20日.wav';

// OttoHub 官方 API（登录/资料）
const OTTOHUB_API = 'https://api.ottohub.cn';

fs.mkdirSync(MAPS_DIR, { recursive: true });
if (!fs.existsSync(SCORES_FILE)) fs.writeFileSync(SCORES_FILE, '{}', 'utf8');

// 成绩存储：{ [mapId]: [ {uid, username, avatar, score, acc, maxCombo, rank, counts, createdAt}, ... ] }
function loadScores() {
  try { return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8')); } catch { return {}; }
}
function saveScores(db) {
  fs.writeFileSync(SCORES_FILE, JSON.stringify(db, null, 2), 'utf8');
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// ---------- 音频：支持 Range 流式播放（拖动进度条必需） ----------
app.get('/api/audio', (req, res) => {
  if (!fs.existsSync(AUDIO_FILE)) {
    return res.status(404).json({ error: '音频文件不存在' });
  }
  const stat = fs.statSync(AUDIO_FILE);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store');

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : fileSize - 1;
    if (isNaN(start) || start >= fileSize) start = 0;
    if (isNaN(end) || end >= fileSize) end = fileSize - 1;
    if (start > end) end = fileSize - 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(AUDIO_FILE, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(AUDIO_FILE).pipe(res);
  }
});

// ---------- 音频元信息 ----------
app.get('/api/audio/info', (req, res) => {
  if (!fs.existsSync(AUDIO_FILE)) {
    return res.status(404).json({ error: '音频文件不存在' });
  }
  const buf = fs.readFileSync(AUDIO_FILE).subarray(0, 100);
  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bits = buf.readUInt16LE(34);
  // 扫描 data chunk 大小
  let dataSize = 0;
  let off = 12;
  while (off < buf.length - 8) {
    const id = buf.toString('ascii', off, off + 4);
    const sz = buf.readUInt32LE(off + 4);
    if (id === 'data') { dataSize = sz; break; }
    off += 8 + sz + (sz % 2);
  }
  const duration = dataSize / (sampleRate * channels * (bits / 8));
  res.json({ name: AUDIO_NAME, channels, sampleRate, bits, duration, size: fs.statSync(AUDIO_FILE).size });
});

// ---------- 谱面 CRUD ----------
function mapPath(id) {
  // 防路径穿越
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error('invalid id');
  return path.join(MAPS_DIR, `${id}.json`);
}

// 轨道数限制 2~8
function clampKeyCount(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(8, Math.max(2, Math.round(n))) : 4;
}

// 键位数组：每轨 [主键code, 副键code|null]
function sanitizeKeys(keys) {
  if (!Array.isArray(keys)) return undefined;
  return keys.slice(0, 8).map(pair =>
    Array.isArray(pair) ? [String(pair[0] || ''), String(pair[1] || '') || null] : null
  );
}

// 列表：scope=all 时按登录者过滤（官方谱 + 自己的谱）；默认只返回官方+已发布
app.get('/api/maps', async (req, res) => {
  let myUid = null;
  if (req.query.scope === 'all' && req.query.token) {
    const profile = await fetchProfile(req.query.token).catch(() => null);
    if (profile) myUid = String(profile.uid);
  }
  const items = fs.readdirSync(MAPS_DIR).filter(f => f.endsWith('.json')).map(f => {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(MAPS_DIR, f), 'utf8'));
      return { id: m.id, name: m.name, bpm: m.bpm, keyCount: m.keyCount || 4, noteCount: (m.notes || []).length, updatedAt: m.updatedAt, duration: m.duration, official: m.official === true, published: m.published === true, owner: m.owner || null, uploader: m.uploader || null };
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  if (req.query.scope === 'all') {
    // 登录：官方 + 自己的谱；未登录：官方 + 无主谱（本机未登录创建）
    const list = items.filter(m => m.official
      || (myUid ? (m.owner && String(m.owner.uid) === myUid) : !m.owner));
    return res.json(list);
  }
  res.json(items.filter(m => m.official || m.published));
});

app.get('/api/maps/:id', (req, res) => {
  try {
    const p = mapPath(req.params.id);
    if (!fs.existsSync(p)) return res.status(404).json({ error: '谱面不存在' });
    res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/maps', async (req, res) => {
  const body = req.body || {};
  const id = body.id && /^[a-zA-Z0-9_-]{1,64}$/.test(body.id) ? body.id
    : `map_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
  // 带登录态保存则记录归属（未登录保存的谱为无主，仅本机未登录可见）
  let owner = null;
  if (body.token) {
    const profile = await fetchProfile(body.token).catch(() => null);
    if (profile) owner = { uid: profile.uid, username: profile.username };
  }
  const map = {
    id,
    name: String(body.name || '未命名谱面'),
    audio: AUDIO_NAME,
    bpm: Number(body.bpm) || 120,
    offset: Number(body.offset) || 0,
    keyCount: clampKeyCount(body.keyCount),
    keys: sanitizeKeys(body.keys),
    notes: Array.isArray(body.notes) ? body.notes : [],
    duration: Number(body.duration) || 0,
    owner,
    createdAt: now,
    updatedAt: now
  };
  fs.writeFileSync(mapPath(id), JSON.stringify(map, null, 2), 'utf8');
  res.json(map);
});

app.put('/api/maps/:id', async (req, res) => {
  try {
    const p = mapPath(req.params.id);
    if (!fs.existsSync(p)) return res.status(404).json({ error: '谱面不存在' });
    const old = JSON.parse(fs.readFileSync(p, 'utf8'));
    const b = req.body || {};
    const map = {
      ...old,
      name: b.name !== undefined ? String(b.name) : old.name,
      bpm: b.bpm !== undefined ? Number(b.bpm) : old.bpm,
      offset: b.offset !== undefined ? Number(b.offset) : old.offset,
      keyCount: b.keyCount !== undefined ? clampKeyCount(b.keyCount) : (old.keyCount || 4),
      keys: b.keys !== undefined ? sanitizeKeys(b.keys) : old.keys,
      notes: Array.isArray(b.notes) ? b.notes : old.notes,
      duration: b.duration !== undefined ? Number(b.duration) : old.duration,
      updatedAt: new Date().toISOString()
    };
    // 无主谱在登录态下保存时补记归属（已有归属不覆盖）
    if (!map.owner && b.token) {
      const profile = await fetchProfile(b.token).catch(() => null);
      if (profile) map.owner = { uid: profile.uid, username: profile.username };
    }
    fs.writeFileSync(p, JSON.stringify(map, null, 2), 'utf8');
    res.json(map);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 通关上报：试玩/游玩完整结束且未被 KO 时记录（autoplay 不算，由前端控制）
app.post('/api/maps/:id/clear', async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.body || {};
    if (!token) return res.status(401).json({ error: '请先登录' });
    const profile = await fetchProfile(token);
    if (!profile) return res.status(401).json({ error: '登录已过期' });
    const p = mapPath(id);
    if (!fs.existsSync(p)) return res.status(404).json({ error: '谱面不存在' });
    const map = JSON.parse(fs.readFileSync(p, 'utf8'));
    map.clears = map.clears || [];
    if (!map.clears.includes(String(profile.uid))) map.clears.push(String(profile.uid));
    fs.writeFileSync(p, JSON.stringify(map, null, 2), 'utf8');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'system_error' });
  }
});

// 发布谱面到社区：需登录、经验>100、自己通关过、音符>100
app.post('/api/maps/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.body || {};
    if (!token) return res.status(401).json({ error: '请先登录' });
    const p = mapPath(id);
    if (!fs.existsSync(p)) return res.status(404).json({ error: '谱面不存在，请先保存' });
    // 服务端验证 token 并取经验值（防伪造）
    const profile = await fetchProfile(token);
    if (!profile) return res.status(401).json({ error: '登录已过期，请重新登录' });
    if (!(Number(profile.experience) > 100)) {
      return res.status(403).json({ error: `经验不足（需 >100，当前 ${profile.experience}）` });
    }
    const map = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (map.official) return res.status(400).json({ error: '官方谱无需发布' });
    if (!((map.notes || []).length > 100)) {
      return res.status(400).json({ error: `音符量不足（需 >100，当前 ${(map.notes || []).length}）` });
    }
    if (!(map.clears || []).includes(String(profile.uid))) {
      return res.status(403).json({ error: '请先试玩通过（不被 KO）后再上传' });
    }
    // 标记发布并记录上传者
    map.published = true;
    map.uploader = { uid: profile.uid, username: profile.username };
    map.updatedAt = new Date().toISOString();
    fs.writeFileSync(p, JSON.stringify(map, null, 2), 'utf8');
    res.json({ ok: true, uploader: map.uploader });
  } catch (e) {
    res.status(500).json({ error: 'system_error' });
  }
});

app.delete('/api/maps/:id', (req, res) => {
  try {
    const p = mapPath(req.params.id);
    if (!fs.existsSync(p)) return res.status(404).json({ error: '谱面不存在' });
    fs.unlinkSync(p);
    res.json({ ok: true });
  } catch (e) {
    // 容错：部分环境（沙箱/杀软）将 unlink 包装为回收站操作，文件可能已被移走
    if (!fs.existsSync(mapPath(req.params.id))) return res.json({ ok: true });
    res.status(400).json({ error: e.message });
  }
});

// ---------- OttoHub 登录代理（避免浏览器跨域） ----------
// 登录成功后顺带拉取昵称，前端一次请求拿全信息
app.post('/api/ottohub/login', async (req, res) => {
  try {
    const { uid_email, pw } = req.body || {};
    if (!uid_email || !pw) return res.status(400).json({ error: 'missing_argument' });
    const r = await fetch(`${OTTOHUB_API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid_email, pw }),
    });
    const data = await r.json();
    if (data.status !== 'success') return res.status(r.status === 401 ? 401 : 400).json(data);
    // 拉昵称/经验失败不影响登录，降级为 null（前端显示 uid）
    let username = null, experience = null;
    try {
      const profile = await fetchProfile(data.token);
      if (profile) { username = profile.username; experience = profile.experience; }
    } catch { /* 资料获取失败，静默降级 */ }
    res.json({ ...data, username, experience });
  } catch {
    res.status(502).json({ error: 'system_error' });
  }
});

// 用 token 拉取 OttoHub 用户资料（昵称等）
async function fetchProfile(token) {
  const r = await fetch(`${OTTOHUB_API}/api/profile?token=${encodeURIComponent(token)}`);
  const data = await r.json();
  if (data.status !== 'success') return null;
  return data.data;   // { uid, username, ... }
}

// 资料代理：前端用 token 换昵称/头像
app.get('/api/ottohub/profile', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).json({ error: 'missing_argument' });
  const profile = await fetchProfile(token).catch(() => null);
  if (!profile) return res.status(401).json({ error: 'error_token' });
  res.json({ status: 'success', data: { uid: profile.uid, username: profile.username, experience: profile.experience } });
});

// ---------- 排行榜 ----------
// 提交成绩（服务端验证 token 防伪造）
app.post('/api/scores', async (req, res) => {
  try {
    const { token, mapId, score, acc, maxCombo, rank, counts } = req.body || {};
    if (!token || !mapId) return res.status(400).json({ error: 'missing_argument' });
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(mapId)) return res.status(400).json({ error: 'invalid mapId' });
    const profile = await fetchProfile(token);
    if (!profile) return res.status(401).json({ error: 'error_token' });

    const db = loadScores();
    const list = db[mapId] || [];
    const entry = {
      uid: profile.uid,
      username: profile.username,
      score: Math.max(0, Math.round(Number(score) || 0)),
      acc: Math.min(100, Math.max(0, +Number(acc).toFixed(2) || 0)),
      maxCombo: Math.max(0, Math.round(Number(maxCombo) || 0)),
      rank: String(rank || 'D'),
      counts: counts || null,
      createdAt: new Date().toISOString(),
    };
    // 同人同谱保留最高分
    const i = list.findIndex(e => e.uid === entry.uid);
    if (i >= 0) {
      if (entry.score > list[i].score) list[i] = entry;
    } else {
      list.push(entry);
    }
    // 排序并截取前 100
    list.sort((a, b) => b.score - a.score);
    db[mapId] = list.slice(0, 100);
    saveScores(db);
    const myRank = db[mapId].findIndex(e => e.uid === entry.uid) + 1;
    res.json({ ok: true, rank: myRank, total: db[mapId].length });
  } catch {
    res.status(500).json({ error: 'system_error' });
  }
});

// 查询某谱排行榜（前 50 + 我的名次）
app.get('/api/scores/:mapId', async (req, res) => {
  const { mapId } = req.params;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(mapId)) return res.status(400).json({ error: 'invalid mapId' });
  const list = (loadScores()[mapId] || []).slice(0, 50);
  let myRank = null;
  const token = req.query.token;
  if (token) {
    const profile = await fetchProfile(token).catch(() => null);
    if (profile) myRank = (loadScores()[mapId] || []).findIndex(e => e.uid === profile.uid) + 1 || null;
  }
  res.json({ list, myRank, total: (loadScores()[mapId] || []).length });
});

// ---------- 静态前端 ----------
app.use(express.static(PUBLIC_DIR));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎵 音乐游戏服务已启动: http://localhost:${PORT}`);
  console.log(`   音频: ${AUDIO_NAME}  (${AUDIO_FILE})`);
});

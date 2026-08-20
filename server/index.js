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
const AUDIO_FILE = path.join(ROOT, '8月20日.wav');
const AUDIO_NAME = '8月20日.wav';

fs.mkdirSync(MAPS_DIR, { recursive: true });

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

app.get('/api/maps', (req, res) => {
  const items = fs.readdirSync(MAPS_DIR).filter(f => f.endsWith('.json')).map(f => {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(MAPS_DIR, f), 'utf8'));
      return { id: m.id, name: m.name, bpm: m.bpm, noteCount: (m.notes || []).length, updatedAt: m.updatedAt, duration: m.duration };
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  res.json(items);
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

app.post('/api/maps', (req, res) => {
  const body = req.body || {};
  const id = body.id && /^[a-zA-Z0-9_-]{1,64}$/.test(body.id) ? body.id
    : `map_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
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
    createdAt: now,
    updatedAt: now
  };
  fs.writeFileSync(mapPath(id), JSON.stringify(map, null, 2), 'utf8');
  res.json(map);
});

app.put('/api/maps/:id', (req, res) => {
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
    fs.writeFileSync(p, JSON.stringify(map, null, 2), 'utf8');
    res.json(map);
  } catch (e) {
    res.status(400).json({ error: e.message });
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

// ---------- 静态前端 ----------
app.use(express.static(PUBLIC_DIR));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎵 音乐游戏服务已启动: http://localhost:${PORT}`);
  console.log(`   音频: ${AUDIO_NAME}  (${AUDIO_FILE})`);
});

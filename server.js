const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Nginx ke peeche chal rahe hain, isliye asli visitor ka IP milega
app.set('trust proxy', 'loopback');

// ---------- Data ko file mein save karna ----------
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'notes.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

let notes = [];
try {
  notes = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch (e) {
  notes = []; // pehli baar file nahi hoti, ye normal hai
}

function save() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(notes));
  fs.renameSync(tmp, DATA_FILE); // beech mein crash ho to purani file safe rehti hai
}

// ---------- Spam se bachav: ek IP se 1 minute mein max 20 notes ----------
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const list = (hits.get(req.ip) || []).filter(t => now - t < 60000);
  if (list.length >= 20) {
    return res.status(429).json({ error: 'Too many notes. Please wait a minute.' });
  }
  list.push(now);
  hits.set(req.ip, list);
  next();
}
setInterval(() => hits.clear(), 10 * 60 * 1000);

// ---------- Routes ----------
app.use(express.json({ limit: '10kb' }));
app.use(express.static('public'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.get('/api/notes', (req, res) => res.json(notes));

app.post('/api/notes', rateLimit, (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 200);
  const author = String(req.body.author || '').trim().slice(0, 40) || 'Anonymous';
  if (!text) return res.status(400).json({ error: 'Note cannot be empty.' });
  if (notes.length >= 5000) return res.status(507).json({ error: 'Storage is full.' });

  const last = notes.length ? notes[notes.length - 1].id : 0;
  const note = { id: Math.max(Date.now(), last + 1), text, author };
  notes.push(note);
  save();
  res.status(201).json(note);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Saving data to ${DATA_FILE}`);
});
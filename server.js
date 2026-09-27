const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const authRoutes = require('./routes/auth');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 5e6 });

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const db = new sqlite3.Database('./messenger.db');

db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, avatar TEXT, email TEXT)');
db.all("PRAGMA table_info(users)", function(err, cols) {
  if (cols && !cols.find(function(c){ return c.name === 'avatar'; })) db.run("ALTER TABLE users ADD COLUMN avatar TEXT");
  if (cols && !cols.find(function(c){ return c.name === 'email'; })) db.run("ALTER TABLE users ADD COLUMN email TEXT");
});

db.run('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, text TEXT, type TEXT, created_at INTEGER)');
db.run('CREATE TABLE IF NOT EXISTS private_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, from_user TEXT, to_user TEXT, text TEXT, type TEXT, created_at INTEGER)');
db.run('CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, created_by TEXT, created_at INTEGER)');
db.run('CREATE TABLE IF NOT EXISTS group_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER, username TEXT, text TEXT, type TEXT, created_at INTEGER)');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

transporter.verify(function(error) {
  if (error) console.log('Ошибка почты:', error.message);
  else console.log('Сервер готов к отправке писем');
});

const verificationCodes = {};

app.use('/api/auth', authRoutes(db));

// Отправка кода на email
app.post('/api/send-code', function(req, res) {
  const email = req.body.email;
  if (!email) return res.status(400).json({ message: 'Введите email' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes[email] = { code: code, expires: Date.now() + 10 * 60 * 1000, verified: false };

  const mailOptions = {
    from: '"SonyChat" <' + process.env.EMAIL_USER + '>',
    to: email,
    subject: 'Код подтверждения SonyChat',
    html: '<div style="font-family: Arial; padding: 20px; background: #f0f8ff;">' +
          '<h2 style="color: #4a90d9;">SonyChat</h2>' +
          '<p>Ваш код подтверждения:</p>' +
          '<h1 style="color: #1a4d80; font-size: 40px; letter-spacing: 8px;">' + code + '</h1>' +
          '<p style="color: #5a7fa0;">Код действует 10 минут.</p>' +
          '</div>'
  };

  transporter.sendMail(mailOptions, function(error) {
    if (error) {
      console.log('Ошибка:', error.message);
      return res.status(500).json({ message: 'Не удалось отправить письмо' });
    }
    res.json({ message: 'Код отправлен' });
  });
});

// Проверка кода
app.post('/api/check-code', function(req, res) {
  const { email, code } = req.body;
  const stored = verificationCodes[email];
  if (!stored) return res.status(400).json({ message: 'Сначала запросите код' });
  if (stored.expires < Date.now()) return res.status(400).json({ message: 'Код истёк' });
  if (stored.code !== code) return res.status(400).json({ message: 'Неверный код' });
  stored.verified = true;
  res.json({ ok: true });
});

// Финальная регистрация
app.post('/api/verify-register', async function(req, res) {
  const { username, password, email, code, avatar } = req.body;
  if (!username || !password || !email || !code) return res.status(400).json({ message: 'Заполните все поля' });
  const stored = verificationCodes[email];
  if (!stored) return res.status(400).json({ message: 'Сначала запросите код' });
  if (!stored.verified) return res.status(400).json({ message: 'Сначала подтвердите код' });

  try {
    const hashed = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password, email, avatar) VALUES (?, ?, ?, ?)',
      [username, hashed, email, avatar || ''],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(400).json({ message: 'Пользователь уже есть' });
          return res.status(500).json({ message: 'Ошибка сервера' });
        }
        delete verificationCodes[email];
        res.status(201).json({ message: 'Пользователь создан!' });
      });
  } catch (e) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

app.get('/api/users', function(req, res) {
  db.all('SELECT username, avatar FROM users', [], function(err, rows) { res.json(rows || []); });
});

app.get('/api/users/:username/avatar', function(req, res) {
  db.get('SELECT avatar FROM users WHERE username = ?', [req.params.username], function(err, row) {
    if (err || !row) return res.status(404).json({});
    res.json({ avatar: row.avatar || null });
  });
});

app.post('/api/users/avatar', function(req, res) {
  db.run('UPDATE users SET avatar = ? WHERE username = ?', [req.body.avatar, req.body.username], function(err) {
    if (err) return res.status(500).json({});
    io.emit('avatar_updated', { username: req.body.username, avatar: req.body.avatar });
    res.json({ ok: true });
  });
});

app.get('/api/messages', function(req, res) {
  db.all('SELECT id, username, text, type, created_at FROM messages ORDER BY id ASC LIMIT 500', [], function(err, rows) { res.json(rows || []); });
});

app.get('/api/private/:u1/:u2', function(req, res) {
  db.all('SELECT id, from_user AS username, text, type, created_at FROM private_messages WHERE (from_user=? AND to_user=?) OR (from_user=? AND to_user=?) ORDER BY id ASC LIMIT 500',
    [req.params.u1, req.params.u2, req.params.u2, req.params.u1], function(err, rows) { res.json(rows || []); });
});

app.get('/api/groups', function(req, res) {
  db.all('SELECT * FROM groups ORDER BY created_at DESC', [], function(err, rows) { res.json(rows || []); });
});

app.post('/api/groups', function(req, res) {
  const { name, username } = req.body;
  if (!name || !username) return res.status(400).json({ message: 'Нет данных' });
  db.run('INSERT INTO groups (name, created_by, created_at) VALUES (?,?,?)', [name, username, Date.now()], function(err) {
    if (err) return res.status(400).json({ message: 'Такая группа уже есть' });
    const g = { id: this.lastID, name: name, created_by: username };
    io.emit('group_created', g);
    res.status(201).json(g);
  });
});

app.get('/api/groups/:id', function(req, res) {
  db.get('SELECT * FROM groups WHERE id = ?', [req.params.id], function(err, row) {
    if (!row) return res.status(404).json({});
    res.json(row);
  });
});

app.get('/api/groups/:id/messages', function(req, res) {
  db.all('SELECT username, text, type, created_at FROM group_messages WHERE group_id = ? ORDER BY id ASC LIMIT 500', [req.params.id], function(err, rows) { res.json(rows || []); });
});

app.use(express.static('public'));
app.get('/', function(req, res) { res.send('OK'); });

io.on('connection', function(socket) {
  socket.on('send_message', function(data) {
    data.time = Date.now();
    db.run('INSERT INTO messages (username, text, type, created_at) VALUES (?,?,?,?)', [data.user, data.text || '', data.type || 'text', data.time], function(err) {
      if (err) { io.emit('new_message', data); return; }
      data.id = this.lastID;
      io.emit('new_message', data);
    });
  });

  socket.on('send_private', function(data) {
    data.time = Date.now();
    db.run('INSERT INTO private_messages (from_user, to_user, text, type, created_at) VALUES (?,?,?,?,?)', [data.from, data.to, data.text || '', data.type || 'text', data.time], function(err) {
      if (err) return;
      data.id = this.lastID;
      io.emit('new_private_message', data);
    });
  });

  socket.on('join_group', function(id) { socket.join('g_' + id); });
  socket.on('leave_group', function(id) { socket.leave('g_' + id); });

  socket.on('send_group_message', function(data) {
    data.time = Date.now();
    db.run('INSERT INTO group_messages (group_id, username, text, type, created_at) VALUES (?,?,?,?,?)', [data.groupId, data.user, data.text || '', data.type || 'text', data.time], function(err) {
      if (err) return;
      io.to('g_' + data.groupId).emit('new_group_message', data);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', function() { console.log('Порт ' + PORT); });
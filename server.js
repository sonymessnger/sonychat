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

// Обновляем структуру БД (добавляем is_deleted)
db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, avatar TEXT, email TEXT, is_admin INTEGER DEFAULT 0, banned INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0)');
db.all("PRAGMA table_info(users)", function(err, cols) {
  if (!cols) return;
  if (!cols.find(c => c.name === 'avatar')) db.run("ALTER TABLE users ADD COLUMN avatar TEXT");
  if (!cols.find(c => c.name === 'email')) db.run("ALTER TABLE users ADD COLUMN email TEXT");
  if (!cols.find(c => c.name === 'is_admin')) db.run("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
  if (!cols.find(c => c.name === 'banned')) db.run("ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0");
  if (!cols.find(c => c.name === 'is_deleted')) db.run("ALTER TABLE users ADD COLUMN is_deleted INTEGER DEFAULT 0");
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

const verificationCodes = {};
const onlineUsers = {};

app.use('/api/auth', authRoutes(db));

function isAdmin(username, cb) {
  db.get('SELECT is_admin FROM users WHERE username = ?', [username], function(err, row) {
    cb(row && row.is_admin === 1);
  });
}

app.post('/api/send-code', function(req, res) {
  const email = req.body.email;
  if (!email) return res.status(400).json({ message: 'Введите email' });
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes[email] = { code: code, expires: Date.now() + 10 * 60 * 1000, verified: false };

  const mailOptions = {
    from: '"SonyChat" <' + process.env.EMAIL_USER + '>',
    to: email,
    subject: 'Код подтверждения SonyChat',
    html: '<h2>Ваш код: <b style="font-size:30px">' + code + '</b></h2>'
  };

  transporter.sendMail(mailOptions, function(error) {
    if (error) return res.status(500).json({ message: 'Не удалось отправить письмо' });
    res.json({ message: 'Код отправлен' });
  });
});

app.post('/api/check-code', function(req, res) {
  const { email, code } = req.body;
  const stored = verificationCodes[email];
  if (!stored) return res.status(400).json({ message: 'Сначала запросите код' });
  if (stored.expires < Date.now()) return res.status(400).json({ message: 'Код истёк' });
  if (stored.code !== code) return res.status(400).json({ message: 'Неверный код' });
  stored.verified = true;
  res.json({ ok: true });
});

app.post('/api/verify-register', async function(req, res) {
  const { username, password, email, code, avatar } = req.body;
  db.all('SELECT id, username, text, type, created_at FROM messages ORDER BY id ASC LIMIT 500', [], function(err, rows) { res.json(rows || []); });
});

app.get('/api/private/:u1/:u2', function(req, res) {
  db.all('SELECT id, from_user AS username, text, type, created_at FROM private_messages WHERE (from_user=? AND to_user=?) OR (from_user=? AND to_user=?) ORDER BY id ASC LIMIT 500',
    [req.params.u1, req.params.u2, req.params.u2, req.params.u1], function(err, rows) { res.json(rows || []); });
});

app.use(express.static('public'));
app.get('/', function(req, res) { res.send('OK'); });

io.on('connection', function(socket) {
  socket.on('user_connected', function(username) {
    onlineUsers[socket.id] = username;
    io.emit('online_list', Object.values(onlineUsers));
  });

  socket.on('typing', function(data) { socket.broadcast.emit('user_typing', data); });

  socket.on('send_message', function(data) {
    db.get('SELECT banned, is_deleted FROM users WHERE username = ?', [data.user], function(e, row) {
      if (row && (row.banned === 1 || row.is_deleted === 1)) return;
      data.time = Date.now();
      db.run('INSERT INTO messages (username, text, type, created_at) VALUES (?,?,?,?)', [data.user, data.text || '', data.type || 'text', data.time], function(err) {
        if (err) { io.emit('new_message', data); return; }
        data.id = this.lastID;
        io.emit('new_message', data);
      });
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

  socket.on('disconnect', function() {
    delete onlineUsers[socket.id];
    io.emit('online_list', Object.values(onlineUsers));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', function() { console.log('Порт ' + PORT); });
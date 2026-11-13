const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = (db) => {
  const router = express.Router();
  const JWT_SECRET = process.env.JWT_SECRET || 'secret';

  router.post('/register', async (req, res) => {
    // ... оставляем как было, если нужно
    res.status(400).json({ message: 'Используйте регистрацию по коду' });
  });

  router.post('/login', (req, res) => {
    db.get('SELECT * FROM users WHERE username = ?', [req.body.username], async (err, user) => {
      if (err || !user) return res.status(400).json({ message: 'Неверный логин' });
      if (user.is_deleted === 1) return res.status(403).json({ message: 'Этот аккаунт был удалён' });
      if (user.banned === 1) return res.status(403).json({ message: 'Аккаунт заблокирован' });

      const ok = await bcrypt.compare(req.body.password, user.password);
      if (!ok) return res.status(400).json({ message: 'Неверный пароль' });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, username: user.username });
    });
  });

  return router;
};
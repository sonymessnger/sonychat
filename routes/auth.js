const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = (db) => {
  const router = express.Router();
  const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

  router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Заполните все поля' });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ message: 'Пользователь уже существует' });
          }
          return res.status(500).json({ message: 'Ошибка сервера' });
        }
        res.status(201).json({ message: 'Пользователь создан!' });
      });
    } catch (error) {
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

  router.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err || !user) return res.status(400).json({ message: 'Неверный логин или пароль' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Неверный логин или пароль' });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, userId: user.id, username: user.username });
    });
  });

  return router;
};
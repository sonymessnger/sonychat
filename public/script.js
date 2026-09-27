const steps = ['step1','step2','step3','step4','step5','loginBox'];
function showStep(id) {
  steps.forEach(function(s) { document.getElementById(s).style.display = 'none'; });
  document.getElementById(id).style.display = 'block';
}

let regEmail = '';
let regCode = '';
let regAvatar = '';

const msg1 = document.getElementById('msg1');
document.getElementById('sendCodeBtn').onclick = async function() {
  const email = document.getElementById('email').value.trim();
  if (!email) { msg1.textContent = 'Введите email'; msg1.style.color = '#f23f43'; return; }

  this.disabled = true;
  this.textContent = 'Отправка...';
  try {
    const res = await fetch('/api/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });
    const data = await res.json();
    if (res.ok) {
      regEmail = email;
      document.getElementById('emailLabel').textContent = email;
      showStep('step2');
    } else {
      msg1.textContent = data.message || 'Ошибка';
      msg1.style.color = '#f23f43';
    }
  } catch (e) {
    msg1.textContent = 'Сервер не отвечает';
    msg1.style.color = '#f23f43';
  }
  this.disabled = false;
  this.textContent = 'Получить код';
};

const msg2 = document.getElementById('msg2');
document.getElementById('checkCodeBtn').onclick = async function() {
  const code = document.getElementById('code').value.trim();
  if (!code || code.length < 6) { msg2.textContent = 'Введите 6-значный код'; msg2.style.color = '#f23f43'; return; }

  try {
    const res = await fetch('/api/check-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail, code: code })
    });
    const data = await res.json();
    if (res.ok) {
      regCode = code;
      showStep('step3');
    } else {
      msg2.textContent = data.message || 'Неверный код';
      msg2.style.color = '#f23f43';
    }
  } catch (e) {
    msg2.textContent = 'Сервер не отвечает';
    msg2.style.color = '#f23f43';
  }
};

document.getElementById('back1').onclick = function(e) { e.preventDefault(); showStep('step1'); };

document.getElementById('startSetupBtn').onclick = function() {
  buildAvatarGrid();
  showStep('step4');
};

const EMOJIS = ['😀','🐱','🐶','🦊','🐼','🦁','🐸','🐵','🦄','🐧','🐨','🐯','🦉','🐢','🐙','🦋'];
const COLORS = ['#5865f2','#ef4444','#10b981','#f59e0b','#ec4899','#06b6d4','#8b5cf6','#84cc16'];

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, r - 60); g = Math.max(0, g - 60); b = Math.max(0, b - 60);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function emojiAvatarURL(emoji, color) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="' + color + '"/>' +
    '<stop offset="1" stop-color="' + shade(color) + '"/>' +
    '</linearGradient></defs>' +
    '<circle cx="50" cy="50" r="50" fill="url(#g)"/>' +
    '<text x="50" y="68" font-size="58" text-anchor="middle">' + emoji + '</text></svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function buildAvatarGrid() {
  const grid = document.getElementById('avatarGrid');
  grid.innerHTML = '';
  EMOJIS.forEach(function(emoji, i) {
    const color = COLORS[i % COLORS.length];
    const div = document.createElement('div');
    div.className = 'avatar-choice';
    div.style.background = 'linear-gradient(135deg, ' + color + ', ' + shade(color) + ')';
    div.textContent = emoji;
    div.onclick = function() {
      document.querySelectorAll('.avatar-choice').forEach(function(el) { el.classList.remove('selected'); });
      div.classList.add('selected');
      regAvatar = emojiAvatarURL(emoji, color);
      document.getElementById('avatarNextBtn').disabled = false;
    };
    grid.appendChild(div);
  });
}

document.getElementById('uploadBtn').onclick = function() { document.getElementById('photoInput').click(); };
document.getElementById('photoInput').onchange = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = function() {
    const img = new Image();
    img.onload = function() {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 200, 200);
      regAvatar = c.toDataURL('image/jpeg', 0.85);
      document.querySelectorAll('.avatar-choice').forEach(function(el) { el.classList.remove('selected'); });
      document.getElementById('avatarNextBtn').disabled = false;
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
};

document.getElementById('avatarNextBtn').onclick = function() {
  const el = document.getElementById('chosenAvatar');
  el.style.background = 'url("' + regAvatar + '") center/cover';
  el.textContent = '';
  showStep('step5');
};

document.getElementById('finishBtn').onclick = async function() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const msg = document.getElementById('msg5');

  if (!username || !password) { msg.textContent = 'Заполните все поля'; msg.style.color = '#f23f43'; return; }
  if (username.length < 3) { msg.textContent = 'Имя от 3 символов'; msg.style.color = '#f23f43'; return; }
  if (password.length < 4) { msg.textContent = 'Пароль от 4 символов'; msg.style.color = '#f23f43'; return; }

  try {
    const res = await fetch('/api/verify-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password, email: regEmail, code: regCode, avatar: regAvatar })
    });
    const data = await res.json();
    if (res.ok) {
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      });
      const loginData = await loginRes.json();
      if (loginData.token) {
        localStorage.setItem('token', loginData.token);
        localStorage.setItem('username', loginData.username);
        window.location.href = 'chat.html';
      }
    } else {
      msg.textContent = data.message || 'Ошибка';
      msg.style.color = '#f23f43';
    }
  } catch (e) {
    msg.textContent = 'Сервер не отвечает';
    msg.style.color = '#f23f43';
  }
};

document.getElementById('loginBtn').onclick = async function() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const msg = document.getElementById('loginMsg');

  if (!username || !password) { msg.textContent = 'Заполните поля'; msg.style.color = '#f23f43'; return; }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);
      window.location.href = 'chat.html';
    } else {
      msg.textContent = data.message || 'Неверный логин или пароль';
      msg.style.color = '#f23f43';
    }
  } catch (e) {
    msg.textContent = 'Сервер не отвечает';
    msg.style.color = '#f23f43';
  }
};

document.getElementById('toLogin').onclick = function(e) { e.preventDefault(); showStep('loginBox'); };
document.getElementById('toRegister').onclick = function(e) { e.preventDefault(); showStep('step1'); };
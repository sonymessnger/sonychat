const socket = io();
const username = localStorage.getItem('username') || 'Гость';
if (!localStorage.getItem('token')) window.location.href = 'index.html';

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const logoutBtn = document.getElementById('logoutBtn');
const currentUserEl = document.getElementById('currentUser');
const userAvatarEl = document.getElementById('userAvatar');
const contactsList = document.getElementById('contactsList');
const chatTitle = document.getElementById('chatTitle');
const chatSubtitle = document.getElementById('chatSubtitle');
const chatAvatar = document.getElementById('chatAvatar');
const sidebarEl = document.getElementById('sidebar');
const backBtn = document.getElementById('backBtn');
const sectionTitle = document.getElementById('sectionTitle');

const navChats = document.getElementById('navChats');
const navContacts = document.getElementById('navContacts');
const navProfile = document.getElementById('navProfile');

const avatars = {};
const usersData = {}; // Храним данные о всех пользователях
const onlineUsers = new Set();
let currentChat = 'general';
let iAmAdmin = false;
let typingTimeout = null;
let typingIndicatorEl = null;
let currentTab = 'chats';

function getUserColor(name) {
  const c = [['#5865f2','#8b5cf6'],['#ef4444','#f97316'],['#10b981','#14b8a6'],['#f59e0b','#eab308'],['#ec4899','#f43f5e'],['#06b6d4','#3b82f6'],['#8b5cf6','#d946ef'],['#84cc16','#22c55e']];
  let h = 0; for (let i=0;i<name.length;i++) h = name.charCodeAt(i) + ((h<<5)-h);
  return c[Math.abs(h)%c.length];
}

function avatarHTML(name, cls) {
  const isDeleted = usersData[name] && usersData[name].is_deleted === 1;
  if (isDeleted) {
    return '<div class="avatar '+cls+'" data-user="'+name+'" style="background:#cbd5e1; display:flex; align-items:center; justify-content:center; font-size:18px;">👻</div>';
  }

  const isOnline = onlineUsers.has(name);
  const onlineMark = isOnline ? '<span class="online-dot"></span>' : '';
  
  if (avatars[name]) return '<div class="avatar '+cls+'" data-user="'+name+'" style="background:url(\''+avatars[name]+'\') center/cover">'+onlineMark+'</div>';
  
  const c = getUserColor(name);
  return '<div class="avatar '+cls+'" data-user="'+name+'" style="background:linear-gradient(135deg,'+c[0]+','+c[1]+')">'+name.charAt(0).toUpperCase()+onlineMark+'</div>';
}

function renderMyAvatar() {
  if (avatars[username]) { userAvatarEl.style.background='url(\''+avatars[username]+'\') center/cover'; userAvatarEl.textContent=''; }
  else { const c=getUserColor(username); userAvatarEl.style.background='linear-gradient(135deg,'+c[0]+','+c[1]+')'; userAvatarEl.textContent=username.charAt(0).toUpperCase(); }
}

currentUserEl.textContent = username;
renderMyAvatar();
socket.emit('user_connected', username);

fetch('/api/me/' + username).then(function(r){ return r.json(); }).then(function(data) {
  if (data.is_admin === 1) {
    iAmAdmin = true;
    const badge = document.createElement('div');
    badge.className = 'admin-badge';
    badge.textContent = '👑 ADMIN';
    currentUserEl.parentElement.appendChild(badge);

    const adminBtn = document.createElement('button');
    adminBtn.className = 'admin-btn';
    adminBtn.textContent = '⚙️ Админ-панель';
    adminBtn.onclick = function() { window.location.href = 'admin.html'; };
    sidebarEl.insertBefore(adminBtn, logoutBtn);
  }
});

async function loadAvatars() {
  const r = await fetch('/api/users');
  const users = await r.json();
  users.forEach(function(u) { 
    if (u.avatar) avatars[u.username] = u.avatar; 
    usersData[u.username] = u; // Сохраняем в кэш
  });
  renderMyAvatar();
}

async function loadContacts() {
  const r = await fetch('/api/users');
  const users = await r.json();
  users.forEach(u => usersData[u.username] = u); // Обновляем кэш
  
  contactsList.innerHTML = '';

  if (currentTab === 'chats') {
    sectionTitle.textContent = 'Чаты';
    const gen = document.createElement('li');
    gen.className = 'contact' + (currentChat === 'general' ? ' active' : '');
    gen.innerHTML = '<div class="avatar small">О</div><span>Общий чат</span>';
    gen.onclick = function() { switchChat('general'); };
    contactsList.appendChild(gen);
  } else {
    sectionTitle.textContent = 'Контакты';
    let hasContacts = false;
    users.forEach(function(u) {
      if (u.username === username) return;
      if (u.is_deleted === 1) return; // НЕ показываем удалённых в контактах
      
      hasContacts = true;
      const li = document.createElement('li');
      li.className = 'contact' + (currentChat === u.username ? ' active' : '');
      li.innerHTML = avatarHTML(u.username, 'small') + '<span>' + u.username + (u.is_admin === 1 ? ' 👑' : '') + '</span>';
      li.onclick = function() { switchChat(u.username); };
      contactsList.appendChild(li);
    });
    if (!hasContacts) {
      contactsList.innerHTML = '<li style="text-align:center; padding:20px; color:#94a3b8; font-size:14px;">Пока нет контактов</li>';
    }
  }
}

function switchChat(id) {
  currentChat = id;
  messagesEl.innerHTML = '';
  loadContacts();
  if (window.innerWidth <= 600) sidebarEl.classList.add('chat-open');

  const user = usersData[id];
  const isDeleted = user && user.is_deleted === 1;

  if (id === 'general') {
    chatTitle.textContent = 'Общий чат';
    chatSubtitle.textContent = 'Все пользователи';
    chatAvatar.textContent = 'О';
    chatAvatar.style.background = 'linear-gradient(135deg,#5865f2,#8b5cf6)';
    loadGeneral();
  } else {
    chatTitle.textContent = isDeleted ? 'Удалённый аккаунт' : id;
    chatSubtitle.textContent = isDeleted ? 'Пользователь удалил аккаунт' : (onlineUsers.has(id) ? '● онлайн' : '○ оффлайн');
    
    if (isDeleted) {
      chatAvatar.textContent = '👻';
      chatAvatar.style.background = '#cbd5e1';
    } else {
      const c = getUserColor(id);
      chatAvatar.textContent = id.charAt(0).toUpperCase();
      chatAvatar.style.background = 'linear-gradient(135deg,'+c[0]+','+c[1]+')';
    }
    loadPrivate(id);
  }
}

async function loadGeneral() {
  const r = await fetch('/api/messages');
  const msgs = await r.json();
  if (msgs.length === 0) { messagesEl.innerHTML = '<div class="system-msg">Сообщений пока нет</div>'; return; }
  msgs.forEach(function(m) { addMsg({ id: m.id, user: m.username, text: m.text, type: m.type, time: m.created_at }, false); });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function loadPrivate(other) {
  const r = await fetch('/api/private/' + username + '/' + other);
  const msgs = await r.json();
  if (msgs.length === 0) { messagesEl.innerHTML = '<div class="system-msg">Сообщений пока нет</div>'; return; }
  msgs.forEach(function(m) { addMsg({ user: m.username, text: m.text, type: m.type, time: m.created_at }, false); });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatTime(ms) {
  const d = new Date(ms), h = d.getHours(), m = d.getMinutes();
  return (h<10?'0':'')+h + ':' + (m<10?'0':'')+m;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function linkify(text) {
  const escaped = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return escaped.replace(urlRegex, function(url) {
    return '<a href="' + url + '" target="_blank" rel="noopener" class="msg-link">' + url + '</a>';
  });
}

function addMsg(data, scroll) {
  const sys = messagesEl.querySelector('.system-msg');
  if (sys) sys.remove();
  const div = document.createElement('div');
  div.className = 'message' + (data.user === username ? ' own' : '');
  if (data.id) div.dataset.id = data.id;

  let content;
  if (data.type === 'image') content = '<img src="' + data.image + '" onclick="window.open(this.src)">';
  else content = linkify(data.text);

  const t = data.time ? formatTime(data.time) : '';
  const isDeleted = usersData[data.user] && usersData[data.user].is_deleted === 1;

  let deleteBtn = '';
  if (data.user === username || iAmAdmin) {
    deleteBtn = '<button class="delete-msg-btn" title="Удалить">✕</button>';
  }

  const authorName = isDeleted ? 'Удалённый аккаунт' : data.user;

  div.innerHTML = avatarHTML(data.user, 'small') +
    '<div class="message-content">' +
      '<div class="author" style="'+(isDeleted?'color:#94a3b8; font-style:italic;':'')+'">' + authorName + '</div>' +
      '<div class="bubble">' + content + '<span class="msg-time">' + t + '</span></div>' +
    '</div>' + deleteBtn;

  messagesEl.appendChild(div);

  const delBtn = div.querySelector('.delete-msg-btn');
  if (delBtn && data.id) {
    delBtn.onclick = function(e) {
      e.stopPropagation();
      if (!confirm('Удалить сообщение?')) return;
      fetch('/api/messages/' + data.id, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username })
      }).then(function(r) {
        if (!r.ok) r.json().then(function(d) { alert(d.message); });
      });
    };
  }

  if (scroll !== false) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function send() {
  const text = inputEl.value.trim(); if (!text) return;
  if (currentChat === 'general') socket.emit('send_message', { user: username, type: 'text', text: text });
  else socket.emit('send_private', { from: username, to: currentChat, type: 'text', text: text });
  inputEl.value = '';
  socket.emit('typing', { user: username, chat: currentChat, isTyping: false });
}
sendBtn.onclick = send;

inputEl.oninput = function() {
  socket.emit('typing', { user: username, chat: currentChat, isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(function() {
    socket.emit('typing', { user: username, chat: currentChat, isTyping: false });
  }, 1500);
};

inputEl.onkeypress = function(e) { if (e.key === 'Enter') send(); };

attachBtn.onclick = function() { fileInput.click(); };
fileInput.onchange = function(e) {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 5*1024*1024) { alert('Файл > 5 МБ'); fileInput.value = ''; return; }
  const r = new FileReader();
  r.onload = function() {
    if (currentChat === 'general') socket.emit('send_message', { user: username, type: 'image', image: r.result });
    else socket.emit('send_private', { from: username, to: currentChat, type: 'image', image: r.result });
    fileInput.value = '';
  };
  r.readAsDataURL(f);
};

if (backBtn) {
  backBtn.onclick = function(e) {
    e.preventDefault();
    sidebarEl.classList.remove('chat-open');
  };
}

if (navChats) {
  navChats.onclick = function() {
    currentTab = 'chats';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    sidebarEl.classList.remove('chat-open');
    loadContacts();
  };
}

if (navContacts) {
  navContacts.onclick = function() {
    currentTab = 'contacts';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    sidebarEl.classList.remove('chat-open');
    loadContacts();
  };
}

if (navProfile) {
  navProfile.onclick = function() {
    userAvatarEl.click();
  };
}

socket.on('new_message', function(data) { if (currentChat === 'general') addMsg(data, true); });
socket.on('new_private_message', function(data) {
  const other = data.from === username ? data.to : data.from;
  if (currentChat === other) addMsg({ user: data.from, text: data.text, type: data.type, image: data.image, time: data.time }, true);
});
socket.on('avatar_updated', function(d) { avatars[d.username] = d.avatar; if (d.username === username) renderMyAvatar(); loadContacts(); });
socket.on('message_deleted', function(data) {
  const el = messagesEl.querySelector('.message[data-id="' + data.id + '"]');
  if (el) el.remove();
});

socket.on('user_deleted_soft', function(data) {
  if (usersData[data.username]) {
    usersData[data.username].is_deleted = 1;
    avatars[data.username] = null;
    loadContacts();
    
    // Если сейчас открыт чат с этим пользователем, обновляем шапку
    if (currentChat === data.username) {
      chatTitle.textContent = 'Удалённый аккаунт';
      chatSubtitle.textContent = 'Пользователь удалил аккаунт';
      chatAvatar.textContent = '👻';
      chatAvatar.style.background = '#cbd5e1';
    }
  }
});

socket.on('online_list', function(list) {
  onlineUsers.clear();
  list.forEach(function(u) { onlineUsers.add(u); });
  loadContacts();
  if (currentChat !== 'general') {
    const user = usersData[currentChat];
    const isDeleted = user && user.is_deleted === 1;
    chatSubtitle.textContent = isDeleted ? 'Пользователь удалил аккаунт' : (onlineUsers.has(currentChat) ? '● онлайн' : '○ оффлайн');
  }
});

socket.on('user_typing', function(data) {
  if (data.chat !== currentChat) return;
  if (data.user === username) return;
  if (!typingIndicatorEl) {
    typingIndicatorEl = document.createElement('div');
    typingIndicatorEl.className = 'typing-indicator';
    messagesEl.appendChild(typingIndicatorEl);
  }
  if (data.isTyping) {
    typingIndicatorEl.innerHTML = data.user + ' печатает<span class="dots">...</span>';
    typingIndicatorEl.style.display = 'block';
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } else {
    typingIndicatorEl.style.display = 'none';
  }
});

// ===== ПРОФИЛЬ =====
const myProfileMenu = document.getElementById('myProfileMenu');
const myMenuClose = document.getElementById('myMenuClose');

userAvatarEl.onclick = function() {
  const myAv = document.getElementById('myMenuAvatar');
  if (avatars[username]) {
    myAv.style.background = 'url(\'' + avatars[username] + '\') center/cover';
    myAv.textContent = '';
  } else {
    const c = getUserColor(username);
    myAv.style.background = 'linear-gradient(135deg,' + c[0] + ',' + c[1] + ')';
    myAv.textContent = username.charAt(0).toUpperCase();
  }
  document.getElementById('myMenuName').textContent = username;
  myProfileMenu.classList.add('show');
};

myMenuClose.onclick = function() { myProfileMenu.classList.remove('show'); };
myProfileMenu.onclick = function(e) { if (e.target === myProfileMenu) myProfileMenu.classList.remove('show'); };

// Просмотр ЧУЖОГО профиля
messagesEl.addEventListener('click', function(e) {
  const av = e.target.closest('.avatar');
  if (!av) return;
  const clickedUser = av.dataset.user;
  if (!clickedUser || clickedUser === username) return;

  // Модалка чужого профиля
  let modal = document.getElementById('profileModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'profileModal';
    modal.className = 'profile-modal';
    modal.innerHTML = '<div class="profile-content"><span class="profile-close">✕</span><div class="profile-avatar" id="profileAvatarBig"></div><h2 class="profile-name" id="profileName"></h2><p class="profile-status" id="profileStatus">● онлайн</p><button class="profile-msg-btn" id="profileMsgBtn">Написать сообщение</button></div>';
    document.body.appendChild(modal);
    modal.querySelector('.profile-close').onclick = function() { modal.classList.remove('show'); };
    modal.onclick = function(e) { if (e.target === modal) modal.classList.remove('show'); };
  }

  const bigAv = document.getElementById('profileAvatarBig');
  const user = usersData[clickedUser];
  const isDeleted = user && user.is_deleted === 1;

  if (isDeleted) {
    bigAv.style.background = '#cbd5e1';
    bigAv.textContent = '👻';
    document.getElementById('profileName').textContent = 'Удалённый аккаунт';
    document.getElementById('profileStatus').textContent = 'Пользователь удалил аккаунт';
    document.getElementById('profileStatus').style.color = '#94a3b8';
    document.getElementById('profileMsgBtn').style.display = 'none'; // Скрываем кнопку написать
  } else {
    if (avatars[clickedUser]) { bigAv.style.background = 'url(\'' + avatars[clickedUser] + '\') center/cover'; bigAv.textContent = ''; }
    else { const c = getUserColor(clickedUser); bigAv.style.background = 'linear-gradient(135deg,' + c[0] + ',' + c[1] + ')'; bigAv.textContent = clickedUser.charAt(0).toUpperCase(); }
    
    document.getElementById('profileName').textContent = clickedUser;
    const statusEl = document.getElementById('profileStatus');
    if (onlineUsers.has(clickedUser)) { statusEl.textContent = '● онлайн'; statusEl.style.color = '#a5ff8a'; }
    else { statusEl.textContent = '○ оффлайн'; statusEl.style.color = '#a88cc0'; }
    document.getElementById('profileMsgBtn').style.display = 'block';
    document.getElementById('profileMsgBtn').onclick = function() { modal.classList.remove('show'); switchChat(clickedUser); };
  }
  
  modal.classList.add('show');
});

// Смена аватара
const avatarFileInput = document.getElementById('avatarFileInput');
document.getElementById('menuChangeAvatar').onclick = function() { avatarFileInput.click(); };

avatarFileInput.onchange = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert('Файл больше 5 МБ'); avatarFileInput.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function() {
    const img = new Image();
    img.onload = function() {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 200, 200);
      const data = c.toDataURL('image/jpeg', 0.85);

      fetch('/api/users/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, avatar: data })
      }).then(function(r) {
        if (r.ok) {
          avatars[username] = data;
          renderMyAvatar();
          loadContacts();
          alert('Аватар обновлён! ❄️');
          myProfileMenu.classList.remove('show');
        } else { alert('Ошибка сохранения'); }
      });
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  avatarFileInput.value = '';
};

// Удаление
document.getElementById('menuDeleteAccount').onclick = async function() {
  const password = prompt('Введите пароль для подтверждения удаления:');
  if (!password) return;
  if (!confirm('⚠️ Удалить аккаунт навсегда? Ваши сообщения останутся, но профиль станет "Удалённый аккаунт".')) return;

  try {
    const res = await fetch('/api/delete-my-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Аккаунт удалён. До свидания! ❄️');
      localStorage.clear();
      window.location.href = 'index.html';
    } else {
      alert(data.message || 'Ошибка удаления');
    }
  } catch (e) { alert('Сервер не отвечает'); }
};

logoutBtn.onclick = function() { localStorage.clear(); window.location.href = 'index.html'; };

loadAvatars().then(function() { loadContacts(); });
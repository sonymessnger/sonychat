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

const avatars = {};
let currentChat = 'general';

function getUserColor(name) {
  const c = [['#5865f2','#8b5cf6'],['#ef4444','#f97316'],['#10b981','#14b8a6'],['#f59e0b','#eab308'],['#ec4899','#f43f5e'],['#06b6d4','#3b82f6'],['#8b5cf6','#d946ef'],['#84cc16','#22c55e']];
  let h = 0; for (let i=0;i<name.length;i++) h = name.charCodeAt(i) + ((h<<5)-h);
  return c[Math.abs(h)%c.length];
}

function avatarHTML(name, cls) {
  if (avatars[name]) {
    return '<div class="avatar '+cls+'" data-user="'+name+'" style="background:url(\''+avatars[name]+'\') center/cover"></div>';
  }
  const c = getUserColor(name);
  return '<div class="avatar '+cls+'" data-user="'+name+'" style="background:linear-gradient(135deg,'+c[0]+','+c[1]+')">'+name.charAt(0).toUpperCase()+'</div>';
}

function renderMyAvatar() {
  if (avatars[username]) { userAvatarEl.style.background='url(\''+avatars[username]+'\') center/cover'; userAvatarEl.textContent=''; }
  else { const c=getUserColor(username); userAvatarEl.style.background='linear-gradient(135deg,'+c[0]+','+c[1]+')'; userAvatarEl.textContent=username.charAt(0).toUpperCase(); }
}

currentUserEl.textContent = username;
renderMyAvatar();

async function loadAvatars() {
  const r = await fetch('/api/users');
  const users = await r.json();
  users.forEach(function(u) { if (u.avatar) avatars[u.username] = u.avatar; });
  renderMyAvatar();
}

async function loadContacts() {
  const r = await fetch('/api/users');
  const users = await r.json();
  contactsList.innerHTML = '';
  const gen = document.createElement('li');
  gen.className = 'contact' + (currentChat === 'general' ? ' active' : '');
  gen.innerHTML = '<div class="avatar small">О</div><span>Общий чат</span>';
  gen.onclick = function() { switchChat('general'); };
  contactsList.appendChild(gen);
  users.forEach(function(u) {
    if (u.username === username) return;
    const li = document.createElement('li');
    li.className = 'contact' + (currentChat === u.username ? ' active' : '');
    li.innerHTML = avatarHTML(u.username, 'small') + '<span>' + u.username + '</span>';
    li.onclick = function() { switchChat(u.username); };
    contactsList.appendChild(li);
  });
}

function switchChat(id) {
  currentChat = id;
  messagesEl.innerHTML = '';
  loadContacts();
  if (id === 'general') {
    chatTitle.textContent = 'Общий чат';
    chatSubtitle.textContent = 'Все пользователи';
    chatAvatar.textContent = 'О';
    loadGeneral();
  } else {
    chatTitle.textContent = id;
    chatSubtitle.textContent = 'Личные сообщения';
    const c = getUserColor(id);
    chatAvatar.textContent = id.charAt(0).toUpperCase();
    chatAvatar.style.background = 'linear-gradient(135deg,'+c[0]+','+c[1]+')';
    loadPrivate(id);
  }
}

async function loadGeneral() {
  const r = await fetch('/api/messages');
  const msgs = await r.json();
  if (msgs.length === 0) { messagesEl.innerHTML = '<div class="system-msg">Сообщений пока нет</div>'; return; }
  msgs.forEach(function(m) { addMsg({ user: m.username, text: m.text, type: m.type, time: m.created_at }, false); });
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

function addMsg(data, scroll) {
  const sys = messagesEl.querySelector('.system-msg');
  if (sys) sys.remove();
  const div = document.createElement('div');
  div.className = 'message' + (data.user === username ? ' own' : '');
  let content = data.type === 'image' ? '<img src="'+data.image+'" onclick="window.open(this.src)">' : data.text;
  const t = data.time ? formatTime(data.time) : '';
  div.innerHTML = avatarHTML(data.user, 'small') + '<div class="message-content"><div class="author">'+data.user+'</div><div class="bubble">'+content+'<span class="msg-time">'+t+'</span></div></div>';
  messagesEl.appendChild(div);
  if (scroll !== false) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function send() {
  const text = inputEl.value.trim(); if (!text) return;
  if (currentChat === 'general') socket.emit('send_message', { user: username, type: 'text', text: text });
  else socket.emit('send_private', { from: username, to: currentChat, type: 'text', text: text });
  inputEl.value = '';
}
sendBtn.onclick = send;
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

socket.on('new_message', function(data) { if (currentChat === 'general') addMsg(data, true); });
socket.on('new_private_message', function(data) {
  const other = data.from === username ? data.to : data.from;
  if (currentChat === other) addMsg({ user: data.from, text: data.text, type: data.type, image: data.image, time: data.time }, true);
});
socket.on('avatar_updated', function(d) { avatars[d.username] = d.avatar; if (d.username === username) renderMyAvatar(); loadContacts(); });

// Клик по чужой аватарке → профиль
messagesEl.addEventListener('click', function(e) {
  const av = e.target.closest('.avatar');
  if (!av) return;
  const clickedUser = av.dataset.user;
  if (!clickedUser || clickedUser === username) return;
  showProfile(clickedUser);
});

function showProfile(name) {
  let modal = document.getElementById('profileModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'profileModal';
    modal.className = 'profile-modal';
    modal.innerHTML = '<div class="profile-content"><span class="profile-close">✕</span><div class="profile-avatar" id="profileAvatarBig"></div><h2 class="profile-name" id="profileName"></h2><p class="profile-status">● онлайн</p><button class="profile-msg-btn" id="profileMsgBtn">Написать сообщение</button></div>';
    document.body.appendChild(modal);
    modal.querySelector('.profile-close').onclick = function() { modal.classList.remove('show'); };
    modal.onclick = function(e) { if (e.target === modal) modal.classList.remove('show'); };
  }

  const bigAv = document.getElementById('profileAvatarBig');
  if (avatars[name]) {
    bigAv.style.background = 'url(\'' + avatars[name] + '\') center/cover';
    bigAv.textContent = '';
  } else {
    const c = getUserColor(name);
    bigAv.style.background = 'linear-gradient(135deg,' + c[0] + ',' + c[1] + ')';
    bigAv.textContent = name.charAt(0).toUpperCase();
  }

  document.getElementById('profileName').textContent = name;
  document.getElementById('profileMsgBtn').onclick = function() {
    modal.classList.remove('show');
    switchChat(name);
  };

  modal.classList.add('show');
}

userAvatarEl.onclick = function() { window.location.href = 'create-avatar.html'; };
logoutBtn.onclick = function() { localStorage.clear(); window.location.href = 'index.html'; };

loadAvatars().then(function() { loadContacts(); loadGeneral(); });
const socket = io();
const username = localStorage.getItem('username') || 'Гость';

if (!localStorage.getItem('token')) {
  window.location.href = 'index.html';
}

const params = new URLSearchParams(window.location.search);
const groupId = parseInt(params.get('id'));

if (!groupId) {
  window.location.href = 'chat.html';
}

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const backBtn = document.getElementById('backBtn');
const currentUserEl = document.getElementById('currentUser');
const userAvatarEl = document.getElementById('userAvatar');
const groupTitle = document.getElementById('groupTitle');
const groupSubtitle = document.getElementById('groupSubtitle');
const sideGroupName = document.getElementById('sideGroupName');

function getUserColor(name) {
  const colors = [
    ['#5865f2', '#8b5cf6'],
    ['#ef4444', '#f97316'],
    ['#10b981', '#14b8a6'],
    ['#f59e0b', '#eab308'],
    ['#ec4899', '#f43f5e'],
    ['#06b6d4', '#3b82f6'],
    ['#8b5cf6', '#d946ef'],
    ['#84cc16', '#22c55e']
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function avatarHTML(name, sizeClass) {
  const c = getUserColor(name);
  return '<div class="avatar ' + sizeClass + '" style="background: linear-gradient(135deg, ' + c[0] + ', ' + c[1] + ')">' + name.charAt(0).toUpperCase() + '</div>';
}

currentUserEl.textContent = username;
const myColor = getUserColor(username);
userAvatarEl.style.background = 'linear-gradient(135deg, ' + myColor[0] + ', ' + myColor[1] + ')';
userAvatarEl.textContent = username.charAt(0).toUpperCase();

async function loadGroupInfo() {
  try {
    const res = await fetch('/api/groups/' + groupId);
    const group = await res.json();
    groupTitle.textContent = group.name;
    groupSubtitle.textContent = 'Создал: ' + group.created_by;
    sideGroupName.textContent = group.name;
    document.title = group.name;
  } catch (e) {
    console.error(e);
  }
}

async function loadMessages() {
  try {
    const res = await fetch('/api/groups/' + groupId + '/messages');
    const msgs = await res.json();
    messagesEl.innerHTML = '';

    if (msgs.length === 0) {
      messagesEl.innerHTML = '<div class="system-msg">Пока пусто. Напишите первое сообщение!</div>';
      return;
    }

    msgs.forEach(function(m) {
      addMessage({ user: m.username, text: m.text, type: m.type || 'text' }, true);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } catch (e) {
    console.error(e);
  }
}

function addMessage(data, isHistory) {
  const sys = messagesEl.querySelector('.system-msg');
  if (sys) sys.remove();

  const msgDiv = document.createElement('div');
  msgDiv.className = 'message' + (data.user === username ? ' own' : '');

  let content;
  if (data.type === 'image') {
    content = '<img src="' + data.image + '" onclick="window.open(this.src)">';
  } else {
    content = data.text;
  }

  msgDiv.innerHTML = avatarHTML(data.user, 'small') +
    '<div class="message-content">' +
      '<div class="author">' + data.user + '</div>' +
      '<div class="bubble">' + content + '</div>' +
    '</div>';
  messagesEl.appendChild(msgDiv);

  if (!isHistory) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  socket.emit('send_group_message', {
    groupId: groupId,
    user: username,
    type: 'text',
    text: text
  });
  inputEl.value = '';
}

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keypress', function(e) {
  if (e.key === 'Enter') sendMessage();
});

attachBtn.addEventListener('click', function() {
  fileInput.click();
});
fileInput.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('Картинка слишком большая. Максимум 5 МБ.');
    fileInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function() {
    socket.emit('send_group_message', {
      groupId: groupId,
      user: username,
      type: 'image',
      image: reader.result
    });
    fileInput.value = '';
  };
  reader.readAsDataURL(file);
});

socket.emit('join_group', groupId);

socket.on('new_group_message', function(data) {
  if (data.groupId === groupId) addMessage(data);
});

backBtn.addEventListener('click', function() {
  window.location.href = 'chat.html';
});

loadGroupInfo();
loadMessages();
const username = localStorage.getItem('username') || 'Гость';

if (!localStorage.getItem('token')) {
  window.location.href = 'index.html';
}

const groupName = document.getElementById('groupName');
const createBtn = document.getElementById('createBtn');
const messageEl = document.getElementById('message');
const groupsList = document.getElementById('groupsList');
const backBtn = document.getElementById('backBtn');

// Загрузить список групп
async function loadGroups() {
  try {
    const res = await fetch('/api/groups');
    const groups = await res.json();

    groupsList.innerHTML = '';

    if (groups.length === 0) {
      groupsList.innerHTML = '<li class="empty">Пока нет ни одной группы</li>';
      return;
    }

    groups.forEach(function(g) {
      const li = document.createElement('li');
      li.innerHTML =
        '<div>' +
          '<div class="group-name">' + g.name + '</div>' +
          '<div class="group-author">Создал: ' + g.created_by + '</div>' +
        '</div>' +
        '<div>→</div>';
      li.addEventListener('click', function() {
        // Переход в чат группы (пока просто уведомление)
        alert('Группа "' + g.name + '" — чат добавим позже');
      });
      groupsList.appendChild(li);
    });
  } catch (e) {
    console.error(e);
  }
}

// Создать группу
createBtn.addEventListener('click', async function() {
  const name = groupName.value.trim();
  if (!name) {
    messageEl.textContent = 'Введите название группы';
    messageEl.style.color = '#f23f43';
    return;
  }

  try {
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, username: username })
    });
    const data = await res.json();

    if (!res.ok) {
      messageEl.textContent = data.message || 'Ошибка';
      messageEl.style.color = '#f23f43';
      return;
    }

    messageEl.textContent = 'Группа "' + name + '" создана!';
    messageEl.style.color = '#23a55a';
    groupName.value = '';
    loadGroups();
  } catch (e) {
    messageEl.textContent = 'Сервер не отвечает';
    messageEl.style.color = '#f23f43';
  }
});

// Enter в поле — создать
groupName.addEventListener('keypress', function(e) {
  if (e.key === 'Enter') createBtn.click();
});

// Назад в чат
backBtn.addEventListener('click', function() {
  window.location.href = 'chat.html';
});

loadGroups();
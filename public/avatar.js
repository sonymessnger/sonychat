const username = localStorage.getItem('username') || 'Гость';
if (!localStorage.getItem('token')) window.location.href = 'index.html';
const preview = document.getElementById('preview');
const input = document.getElementById('fileInput');
const msg = document.getElementById('message');

function showDefault() {
  const c = [['#5865f2','#8b5cf6'],['#ef4444','#f97316'],['#10b981','#14b8a6'],['#f59e0b','#eab308'],['#ec4899','#f43f5e'],['#06b6d4','#3b82f6']];
  let h = 0; for (let i=0;i<username.length;i++) h = username.charCodeAt(i) + ((h<<5)-h);
  const p = c[Math.abs(h)%c.length];
  preview.style.background = 'linear-gradient(135deg,'+p[0]+','+p[1]+')';
  preview.textContent = username.charAt(0).toUpperCase();
}

fetch('/api/users/' + username + '/avatar').then(function(r){return r.json();}).then(function(d) {
  if (d.avatar) { preview.style.background = 'url(\''+d.avatar+'\') center/cover'; preview.textContent = ''; }
  else showDefault();
}).catch(showDefault);

document.getElementById('chooseBtn').onclick = function() { input.click(); };
input.onchange = function(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = function() {
    const img = new Image();
    img.onload = function() {
      const c = document.createElement('canvas'); c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width-s)/2, (img.height-s)/2, s, s, 0, 0, 200, 200);
      const data = c.toDataURL('image/jpeg', 0.85);
      preview.style.background = 'url(\''+data+'\') center/cover'; preview.textContent = '';
      msg.textContent = 'Нажми «Назад в чат»';
      fetch('/api/users/avatar', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: username, avatar: data }) });
    };
    img.src = r.result;
  };
  r.readAsDataURL(f);
};
document.getElementById('backBtn').onclick = function() { window.location.href = 'chat.html'; };
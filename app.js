// ==================== CONFIG ====================
// Ganti URL ini setelah deploy server ke Render
const SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://marzzdraw-server.onrender.com'; // ganti setelah deploy

// ==================== STATE ====================
let socket = null;
let playerName = localStorage.getItem('marzz_name') || '';
let roomCode = null;
let isHost = false;
let isDrawer = false;
let currentWord = '';
let currentColor = '#000000';
let currentSize = 8;
let drawing = false;
let lastX = 0, lastY = 0;

const COLORS = ['#000000','#ffffff','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#78716c'];

document.addEventListener('DOMContentLoaded', () => {
  if (playerName) {
    document.getElementById('nameInput').value = playerName;
    document.getElementById('homeName').textContent = playerName;
  }

  const colorsEl = document.getElementById('colors');
  COLORS.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'color-btn' + (i === 0 ? ' active' : '');
    btn.style.background = c;
    if (c === '#ffffff') btn.style.border = '1px solid #ccc';
    btn.dataset.color = c;
    btn.onclick = () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentColor = c;
    };
    colorsEl.appendChild(btn);
  });

  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSize = parseInt(btn.dataset.size);
    };
  });

  document.getElementById('btnCreate').onclick = createRoom;
  document.getElementById('btnJoin').onclick = () => {
    document.getElementById('joinModal').classList.remove('hidden');
    document.getElementById('codeInput').focus();
  };
  document.getElementById('btnCancelJoin').onclick = () => {
    document.getElementById('joinModal').classList.add('hidden');
  };
  document.getElementById('btnConfirmJoin').onclick = joinRoom;
  document.getElementById('btnLeave').onclick = leaveRoom;
  document.getElementById('btnStart').onclick = startGame;
  document.getElementById('btnClear').onclick = () => {
    clearCanvas();
    if (socket) socket.emit('clear');
  };
  document.getElementById('btnCopy').onclick = () => {
    navigator.clipboard.writeText(roomCode);
    addSystem('Kode disalin!');
  };
  document.getElementById('btnSend').onclick = sendChat;
  document.getElementById('chatInput').onkeypress = (e) => {
    if (e.key === 'Enter') sendChat();
  };

  document.getElementById('nameInput').onchange = (e) => {
    playerName = e.target.value.trim() || 'Player';
    localStorage.setItem('marzz_name', playerName);
    document.getElementById('homeName').textContent = playerName;
  };

  setupCanvas();
});

function connectSocket() {
  return new Promise((resolve, reject) => {
    socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => resolve());
    socket.on('connect_error', (err) => reject(err));

    socket.on('room-created', (data) => {
      roomCode = data.code;
      isHost = true;
      document.getElementById('roomCode').textContent = data.code;
      document.getElementById('roomName').textContent = data.name;
      document.getElementById('hostHint').style.display = 'block';
      document.getElementById('btnStart').style.display = 'block';
      updatePlayers(data.players);
      showGame();
      addSystem('Ruangan dibuat! Bagikan kode: ' + data.code);
    });

    socket.on('room-joined', (data) => {
      roomCode = data.code;
      isHost = false;
      document.getElementById('roomCode').textContent = data.code;
      document.getElementById('roomName').textContent = data.name;
      updatePlayers(data.players);
      showGame();
      addSystem('Berhasil gabung ke ruangan!');
    });

    socket.on('player-joined', (data) => {
      updatePlayers(data.players);
      addSystem(data.name + ' bergabung!');
    });

    socket.on('player-left', (data) => {
      updatePlayers(data.players);
      addSystem(data.name + ' keluar.');
    });

    socket.on('game-started', (data) => {
      currentWord = data.word || '';
      isDrawer = data.drawer === playerName;
      document.getElementById('roundInfo').textContent = 'Ronde ' + data.round;
      document.getElementById('btnStart').style.display = 'none';
      document.getElementById('hostHint').style.display = 'none';
      clearCanvas();

      if (isDrawer) {
        document.getElementById('wordBar').textContent = 'Gambar: ' + data.word;
        document.getElementById('toolbar').classList.add('active');
        addSystem('Giliranmu menggambar!');
      } else {
        document.getElementById('wordBar').textContent = data.hint || '_ _ _ _';
        document.getElementById('toolbar').classList.remove('active');
        addSystem(data.drawer + ' sedang menggambar...');
      }
      startTimer(data.time || 60);
    });

    socket.on('draw', (data) => {
      if (!isDrawer) drawLine(data);
    });

    socket.on('clear', () => clearCanvas());

    socket.on('chat', (data) => {
      addChat(data.name, data.msg, data.correct);
    });

    socket.on('correct-guess', (data) => {
      addChat(data.name, '✅ Benar! +' + data.points, true);
      updatePlayers(data.players);
    });

    socket.on('time-up', (data) => {
      addSystem('Waktu habis! Jawaban: ' + data.word);
      document.getElementById('toolbar').classList.remove('active');
      isDrawer = false;
    });

    socket.on('error-msg', (msg) => alert(msg));
  });
}

async function createRoom() {
  playerName = document.getElementById('nameInput').value.trim() || 'Player';
  localStorage.setItem('marzz_name', playerName);
  try {
    await connectSocket();
    socket.emit('create-room', { name: playerName });
  } catch (e) {
    alert('Gagal konek ke server. Server belum di-deploy atau sedang sleep.\n\nError: ' + e.message);
  }
}

async function joinRoom() {
  const code = document.getElementById('codeInput').value.trim().toUpperCase();
  if (!code || code.length < 4) { alert('Masukkan kode yang valid'); return; }
  playerName = document.getElementById('nameInput').value.trim() || 'Player';
  localStorage.setItem('marzz_name', playerName);
  document.getElementById('joinModal').classList.add('hidden');
  try {
    await connectSocket();
    socket.emit('join-room', { code, name: playerName });
  } catch (e) {
    alert('Gagal konek ke server.\n\nError: ' + e.message);
  }
}

function startGame() { if (socket) socket.emit('start-game'); }

function leaveRoom() {
  if (socket) { socket.emit('leave-room'); socket.disconnect(); }
  socket = null; roomCode = null; isHost = false; isDrawer = false;
  document.getElementById('chatLog').innerHTML = '';
  document.getElementById('home').classList.add('active');
  document.getElementById('game').classList.remove('active');
  document.getElementById('toolbar').classList.remove('active');
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg || !socket) return;
  socket.emit('chat', { msg });
  input.value = '';
}

function showGame() {
  document.getElementById('home').classList.remove('active');
  document.getElementById('game').classList.add('active');
}

function updatePlayers(players) {
  const list = document.getElementById('playersList');
  list.innerHTML = players.map(p => `
    <li class="${p.name === playerName ? 'me' : ''}">
      <span>😊</span>
      <span>${p.name}${p.isHost ? ' 👑' : ''}</span>
      <span class="score">${p.score || 0}</span>
    </li>
  `).join('');
}

function addSystem(msg) {
  const div = document.createElement('div');
  div.className = 'msg system';
  div.textContent = msg;
  document.getElementById('chatLog').appendChild(div);
  document.getElementById('chatLog').scrollTop = 99999;
}

function addChat(name, msg, correct = false) {
  const div = document.createElement('div');
  div.className = 'msg' + (correct ? ' correct' : '');
  div.innerHTML = `<strong>${name}:</strong> ${msg}`;
  document.getElementById('chatLog').appendChild(div);
  document.getElementById('chatLog').scrollTop = 99999;
}

let timerInterval = null;
function startTimer(seconds) {
  let t = seconds;
  document.getElementById('timer').textContent = t;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    t--;
    document.getElementById('timer').textContent = t;
    if (t <= 0) clearInterval(timerInterval);
  }, 1000);
}

function setupCanvas() {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width;
    const sy = canvas.height / r.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy };
  }

  function start(e) {
    if (!isDrawer) return;
    drawing = true;
    const p = pos(e);
    lastX = p.x; lastY = p.y;
  }

  function move(e) {
    if (!drawing || !isDrawer) return;
    e.preventDefault();
    const p = pos(e);
    const data = { x0: lastX, y0: lastY, x1: p.x, y1: p.y, color: currentColor, size: currentSize };
    drawLine(data);
    if (socket) socket.emit('draw', data);
    lastX = p.x; lastY = p.y;
  }

  function stop() { drawing = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseleave', stop);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', stop);
}

function drawLine(d) {
  const ctx = document.getElementById('canvas').getContext('2d');
  ctx.strokeStyle = d.color;
  ctx.lineWidth = d.size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(d.x0, d.y0);
  ctx.lineTo(d.x1, d.y1);
  ctx.stroke();
}

function clearCanvas() {
  const c = document.getElementById('canvas');
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
}

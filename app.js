// ==================== STATE ====================
let playerName = localStorage.getItem('marzz_name') || 'Player' + Math.floor(Math.random()*9000+1000);
let peer = null;
let connections = [];
let myPeerId = null;
let roomCode = null;
let isHost = false;
let isDrawer = false;
let currentWord = '';
let currentColor = '#000000';
let currentSize = 8;
let drawing = false;
let lastX = 0, lastY = 0;
let players = [];
let timerInterval = null;

const WORDS = ['Kucing','Anjing','Rumah','Mobil','Pohon','Bunga','Matahari','Bulan','Bintang','Ikan','Burung','Sepeda','Bola','Buku','Pensil','Kursi','Meja','Pintu','Jendela','Komputer','Telepon','Jam','Topi','Sepatu','Payung','Kunci','Apel','Pisang','Jeruk','Gunung','Laut','Pantai','Hutan','Sekolah','Robot','Ninja','Pizza','Es Krim'];
const COLORS = ['#000000','#ffffff','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#78716c'];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('nameInput').value = playerName;
  document.getElementById('homeName').textContent = playerName;

  // Colors
  const colorsEl = document.getElementById('colors');
  COLORS.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'color-btn' + (i === 0 ? ' active' : '');
    btn.style.background = c;
    if (c === '#ffffff') btn.style.border = '1px solid #ccc';
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
    document.getElementById('codeInput').value = '';
    document.getElementById('codeInput').focus();
  };
  document.getElementById('btnCancelJoin').onclick = () => document.getElementById('joinModal').classList.add('hidden');
  document.getElementById('btnConfirmJoin').onclick = joinRoom;
  document.getElementById('btnLeave').onclick = leaveRoom;
  document.getElementById('btnStart').onclick = startGame;
  document.getElementById('btnClear').onclick = () => { clearCanvas(); broadcast({ type: 'clear' }); };
  document.getElementById('btnCopy').onclick = () => {
    navigator.clipboard.writeText(roomCode);
    addSystem('Kode disalin: ' + roomCode);
  };
  document.getElementById('btnSend').onclick = sendChat;
  document.getElementById('chatInput').onkeypress = e => { if (e.key === 'Enter') sendChat(); };

  document.getElementById('nameInput').onchange = e => {
    playerName = e.target.value.trim() || 'Player';
    localStorage.setItem('marzz_name', playerName);
    document.getElementById('homeName').textContent = playerName;
  };

  setupCanvas();
});

// ==================== PEER ====================
function createPeer() {
  return new Promise((resolve, reject) => {
    if (peer) try { peer.destroy(); } catch(e) {}

    peer = new Peer({
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    const t = setTimeout(() => reject(new Error('Timeout')), 12000);

    peer.on('open', id => {
      clearTimeout(t);
      myPeerId = id;
      resolve(id);
    });

    peer.on('connection', conn => {
      setupConn(conn);
    });

    peer.on('error', err => {
      clearTimeout(t);
      reject(err);
    });
  });
}

function setupConn(conn) {
  if (connections.find(c => c.peer === conn.peer)) return;
  connections.push(conn);

  conn.on('open', () => {
    if (isHost) {
      // send current state
      conn.send({ type: 'welcome', players, word: currentWord, isDrawer: false });
      addSystem('Pemain baru terhubung!');
    }
  });

  conn.on('data', data => handleData(data, conn));
  conn.on('close', () => {
    connections = connections.filter(c => c !== conn);
    addSystem('Seorang pemain keluar');
  });
}

function broadcast(data) {
  connections.forEach(c => { if (c.open) try { c.send(data); } catch(e){} });
}

function handleData(data, conn) {
  switch (data.type) {
    case 'join':
      if (isHost) {
        players.push({ id: data.id, name: data.name, score: 0 });
        updatePlayers();
        broadcast({ type: 'players', players });
        addSystem(data.name + ' bergabung!');
      }
      break;
    case 'welcome':
      players = data.players || [];
      if (!players.find(p => p.name === playerName)) {
        players.push({ id: myPeerId, name: playerName, score: 0 });
      }
      updatePlayers();
      break;
    case 'players':
      players = data.players;
      updatePlayers();
      break;
    case 'start':
      startRound(data.word, data.drawer);
      break;
    case 'draw':
      if (!isDrawer) drawLine(data);
      break;
    case 'clear':
      clearCanvas();
      break;
    case 'chat':
      addChat(data.name, data.msg, data.correct);
      break;
    case 'correct':
      addChat(data.name, '✅ Benar!', true);
      const p = players.find(x => x.name === data.name);
      if (p) p.score = (p.score || 0) + 100;
      updatePlayers();
      break;
  }
}

// ==================== ACTIONS ====================
async function createRoom() {
  playerName = document.getElementById('nameInput').value.trim() || 'Player';
  localStorage.setItem('marzz_name', playerName);

  try {
    addSystem('Membuat ruangan...');
    const id = await createPeer();
    roomCode = id;
    isHost = true;
    players = [{ id, name: playerName, score: 0 }];

    document.getElementById('roomCode').textContent = id;
    document.getElementById('roomName').textContent = 'Ruangan ' + id.slice(0,6);
    document.getElementById('hostHint').style.display = 'block';
    document.getElementById('btnStart').style.display = 'block';
    updatePlayers();
    showGame();
    addSystem('Ruangan siap!');
    addSystem('Kode: ' + id);
    addSystem('Bagikan kode ini ke teman. Mereka harus gabung dengan kode yang SAMA.');
  } catch (e) {
    alert('Gagal membuat ruangan. Coba refresh halaman.\n' + e.message);
  }
}

async function joinRoom() {
  const code = document.getElementById('codeInput').value.trim();
  if (!code || code.length < 5) {
    alert('Masukkan kode yang valid');
    return;
  }
  playerName = document.getElementById('nameInput').value.trim() || 'Player';
  localStorage.setItem('marzz_name', playerName);
  document.getElementById('joinModal').classList.add('hidden');

  try {
    addSystem('Menghubungkan...');
    await createPeer();
    roomCode = code;
    isHost = false;

    const conn = peer.connect(code, { reliable: true });
    setupConn(conn);

    conn.on('open', () => {
      conn.send({ type: 'join', id: myPeerId, name: playerName });
      document.getElementById('roomCode').textContent = code;
      document.getElementById('roomName').textContent = 'Ruangan ' + code.slice(0,6);
      showGame();
      addSystem('Terhubung! Menunggu host memulai...');
    });

    setTimeout(() => {
      if (!conn.open) {
        addSystem('Gagal terhubung. Pastikan host sudah membuat ruangan dan kode benar.');
      }
    }, 8000);
  } catch (e) {
    alert('Gagal gabung: ' + e.message);
  }
}

function startGame() {
  if (!isHost) return;
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const drawer = playerName; // host draws first for simplicity
  broadcast({ type: 'start', word, drawer });
  startRound(word, drawer);
}

function startRound(word, drawer) {
  currentWord = word;
  isDrawer = (drawer === playerName);
  clearCanvas();
  document.getElementById('btnStart').style.display = 'none';
  document.getElementById('hostHint').style.display = 'none';

  if (isDrawer) {
    document.getElementById('wordBar').textContent = 'Gambar: ' + word;
    document.getElementById('toolbar').classList.add('active');
    addSystem('Giliranmu menggambar: ' + word);
  } else {
    document.getElementById('wordBar').textContent = word.split('').map(() => '_').join(' ');
    document.getElementById('toolbar').classList.remove('active');
    addSystem(drawer + ' sedang menggambar...');
  }

  let t = 60;
  document.getElementById('timer').textContent = t;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    t--;
    document.getElementById('timer').textContent = t;
    if (t <= 0) {
      clearInterval(timerInterval);
      addSystem('Waktu habis! Jawaban: ' + currentWord);
      document.getElementById('toolbar').classList.remove('active');
      isDrawer = false;
    }
  }, 1000);
}

function leaveRoom() {
  if (peer) try { peer.destroy(); } catch(e) {}
  peer = null;
  connections = [];
  roomCode = null;
  isHost = false;
  isDrawer = false;
  players = [];
  if (timerInterval) clearInterval(timerInterval);
  document.getElementById('chatLog').innerHTML = '';
  document.getElementById('home').classList.add('active');
  document.getElementById('game').classList.remove('active');
  document.getElementById('toolbar').classList.remove('active');
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;

  if (currentWord && msg.toLowerCase() === currentWord.toLowerCase() && !isDrawer) {
    addChat(playerName, '✅ ' + msg, true);
    broadcast({ type: 'correct', name: playerName });
    const p = players.find(x => x.name === playerName);
    if (p) p.score = (p.score || 0) + 100;
    updatePlayers();
  } else {
    addChat(playerName, msg);
    broadcast({ type: 'chat', name: playerName, msg });
  }
  input.value = '';
}

// ==================== UI ====================
function showGame() {
  document.getElementById('home').classList.remove('active');
  document.getElementById('game').classList.add('active');
}

function updatePlayers() {
  const list = document.getElementById('playersList');
  list.innerHTML = players.map(p => `
    <li class="${p.name === playerName ? 'me' : ''}">
      <span>😊</span>
      <span>${p.name}</span>
      <span class="score">${p.score || 0}</span>
    </li>
  `).join('');
}

function addSystem(msg) {
  const div = document.createElement('div');
  div.className = 'msg system';
  div.textContent = msg;
  const log = document.getElementById('chatLog');
  if (log) { log.appendChild(div); log.scrollTop = 99999; }
}

function addChat(name, msg, correct = false) {
  const div = document.createElement('div');
  div.className = 'msg' + (correct ? ' correct' : '');
  div.innerHTML = `<strong>${name}:</strong> ${msg}`;
  const log = document.getElementById('chatLog');
  if (log) { log.appendChild(div); log.scrollTop = 99999; }
}

// ==================== CANVAS ====================
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
    const data = { type: 'draw', x0: lastX, y0: lastY, x1: p.x, y1: p.y, color: currentColor, size: currentSize };
    drawLine(data);
    broadcast(data);
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

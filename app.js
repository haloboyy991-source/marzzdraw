// ==================== STATE ====================
let playerName = localStorage.getItem('marzz_name') || 'User' + Math.floor(Math.random() * 9000 + 1000);
let currentRoom = null;
let isHost = false;
let currentWord = '';
let peer = null;
let connections = [];
let myPeerId = null;
let currentColor = '#000000';
let currentSize = 8;
let isDrawingMode = false;
let timerInterval = null;
let timeLeft = 60;

const WORDS = [
  'Kucing', 'Anjing', 'Rumah', 'Mobil', 'Pohon', 'Bunga', 'Matahari', 'Bulan',
  'Bintang', 'Ikan', 'Burung', 'Sepeda', 'Bola', 'Buku', 'Pensil', 'Kursi',
  'Meja', 'Pintu', 'Jendela', 'Komputer', 'Telepon', 'Jam', 'Topi', 'Sepatu',
  'Payung', 'Kunci', 'Gunting', 'Sendok', 'Garpu', 'Piring', 'Gelas', 'Botol',
  'Apel', 'Pisang', 'Jeruk', 'Anggur', 'Semangka', 'Nanas', 'Mangga', 'Pepaya',
  'Gunung', 'Sungai', 'Laut', 'Pantai', 'Hutan', 'Kota', 'Desa', 'Sekolah',
  'Kantor', 'Toko', 'Pasar', 'Stasiun', 'Bandara', 'Jembatan', 'Menara', 'Istana'
];

const MOCK_ROOMS = [
  { id: '10t', name: 'Umum #10t', icon: '🎰', players: 9, max: 15, score: '176/240', lang: 'ID' },
  { id: '13X', name: 'Umum #13X', icon: '🎰', players: 5, max: 5, score: '200/240', lang: 'ID' },
  { id: '10p', name: 'Umum #10p', icon: '🎰', players: 2, max: 15, score: '0/120', lang: 'ID' },
  { id: '13y', name: 'Umum #13y', icon: '🎰', players: 2, max: 5, score: '0/120', lang: 'ID' },
  { id: '128', name: 'Objek #128', icon: '📷', players: 0, max: 8, score: '0/180', lang: 'ID' },
  { id: '1Bu', name: 'Objek #1Bu', icon: '📷', players: 0, max: 8, score: '0/180', lang: 'ID' },
  { id: '3UA', name: 'Tema Gila #3UA', icon: '🎩', players: 0, max: 6, score: '0/150', lang: 'ID' },
  { id: '129', name: 'Objek #129', icon: '📷', players: 0, max: 8, score: '0/180', lang: 'ID' },
  { id: '1WF', name: 'Umum #1WF', icon: '🎰', players: 0, max: 6, score: '0/360', lang: 'ID' },
  { id: '12y', name: 'Makanan #12y', icon: '🍔', players: 0, max: 5, score: '0/480', lang: 'ID' },
  { id: 'ECK', name: 'Objek #ECK', icon: '📷', players: 0, max: 8, score: '0/180', lang: 'ID' },
  { id: '113', name: 'Pekerjaan #113', icon: '💼', players: 0, max: 5, score: '0/480', lang: 'ID' },
];

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('playerName').value = playerName;
  document.getElementById('displayName').textContent = playerName;

  document.getElementById('playerName').addEventListener('change', (e) => {
    playerName = e.target.value.trim() || 'Anonim';
    localStorage.setItem('marzz_name', playerName);
    document.getElementById('displayName').textContent = playerName;
  });

  renderRooms();
  setupCanvas();
  setupTools();
});

// ==================== NAVIGATION ====================
function showHome() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('homeScreen').classList.add('active');
}

function showRooms() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('roomsScreen').classList.add('active');
  renderRooms();
}

function showGame() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('gameScreen').classList.add('active');
}

// ==================== ROOMS ====================
function renderRooms() {
  const grid = document.getElementById('roomsGrid');
  grid.innerHTML = MOCK_ROOMS.map(r => `
    <div class="room-card" onclick="selectRoom('${r.id}')">
      <div class="room-icon">${r.icon}<span class="check">✓</span></div>
      <div class="room-name">${r.name}</div>
      <div class="room-stats">
        <span>👥 ${r.players}/${r.max}</span>
        <span>💬 ${r.lang}</span>
        <span>🏆 ${r.score}</span>
      </div>
    </div>
  `).join('');
}

function selectRoom(id) {
  document.querySelectorAll('.room-card').forEach(c => c.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}

function createRoom() {
  document.getElementById('modalTitle').textContent = 'Buat Ruangan Baru';
  document.getElementById('roomNameInput').value = 'Umum #' + Math.random().toString(36).substring(2, 5).toUpperCase();
  document.getElementById('roomCodeInput').value = '';
  document.getElementById('modalConfirmBtn').textContent = 'Buat';
  document.getElementById('modalConfirmBtn').onclick = confirmCreateRoom;
  document.getElementById('roomModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('roomModal').classList.add('hidden');
}

function joinByCode() {
  document.getElementById('joinModal').classList.remove('hidden');
  document.getElementById('joinCodeInput').value = '';
  document.getElementById('joinCodeInput').focus();
}

function closeJoinModal() {
  document.getElementById('joinModal').classList.add('hidden');
}

function generateCode() {
  // PeerJS IDs work better with lowercase + numbers
  return Math.random().toString(36).substring(2, 10);
}

async function confirmCreateRoom() {
  const name = document.getElementById('roomNameInput').value.trim() || 'Ruangan Baru';
  closeModal();
  isHost = true;
  currentRoom = { code: '...', name, players: [{ id: 'me', name: playerName, score: 0 }] };

  addSystemMessage('Sedang membuat ruangan...');
  showGame();
  document.getElementById('gameRoomName').textContent = name;
  document.getElementById('gameRoomCode').textContent = 'Membuat...';

  try {
    const id = await initPeerAsHost();
    currentRoom.code = id;
    document.getElementById('gameRoomCode').textContent = id;
    updatePlayersList();
    addSystemMessage('✅ Ruangan siap!');
    addSystemMessage('Kode ruangan: ' + id);
    addSystemMessage('Bagikan kode di atas ke teman. Mereka harus masuk dengan kode yang SAMA.');
    addSystemMessage('Setelah teman masuk, ketik /start di chat untuk mulai.');
  } catch (e) {
    addSystemMessage('❌ Gagal membuat ruangan: ' + e.message);
  }
}

async function doJoinByCode() {
  const code = document.getElementById('joinCodeInput').value.trim();
  if (!code || code.length < 4) {
    alert('Masukkan kode ruangan yang valid!');
    return;
  }
  closeJoinModal();
  isHost = false;
  currentRoom = { code, name: 'Ruangan ' + code, players: [] };

  showGame();
  document.getElementById('gameRoomName').textContent = 'Ruangan ' + code;
  document.getElementById('gameRoomCode').textContent = code;
  addSystemMessage('Sedang menghubungkan ke host...');

  try {
    await initPeerAsJoiner(code);
    addSystemMessage('✅ Terhubung! Menunggu host memulai game...');
  } catch (e) {
    addSystemMessage('❌ Gagal terhubung: ' + e.message);
    addSystemMessage('Pastikan host sudah membuat ruangan dan kode-nya benar.');
  }
}

function quickPlay() {
  confirmCreateRoom();
}

// ==================== PEERJS ====================
function initPeerAsHost() {
  return new Promise((resolve, reject) => {
    if (peer) {
      try { peer.destroy(); } catch(e) {}
    }

    peer = new Peer({
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    const timeout = setTimeout(() => {
      reject(new Error('Timeout membuat peer. Coba refresh halaman.'));
    }, 15000);

    peer.on('open', (id) => {
      clearTimeout(timeout);
      myPeerId = id;
      console.log('Host Peer ID:', id);
      resolve(id);
    });

    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      clearTimeout(timeout);
      console.error('Peer error:', err);
      reject(new Error(err.type || err.message || 'Unknown error'));
    });
  });
}

function initPeerAsJoiner(hostId) {
  return new Promise((resolve, reject) => {
    if (peer) {
      try { peer.destroy(); } catch(e) {}
    }

    peer = new Peer({
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    const timeout = setTimeout(() => {
      reject(new Error('Timeout koneksi. Pastikan host online dan kode benar.'));
    }, 15000);

    peer.on('open', (id) => {
      myPeerId = id;
      console.log('Joiner Peer ID:', id, 'connecting to', hostId);

      const conn = peer.connect(hostId, { reliable: true });
      
      conn.on('open', () => {
        clearTimeout(timeout);
        setupConnection(conn);
        // Introduce myself
        conn.send({ type: 'player-join', name: playerName, id: myPeerId });
        resolve(id);
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error('Gagal connect ke host'));
      });
    });

    peer.on('error', (err) => {
      clearTimeout(timeout);
      console.error('Peer error:', err);
      reject(new Error(err.type || 'Peer error'));
    });
  });
}

function setupConnection(conn) {
  // Avoid duplicate
  if (connections.find(c => c.peer === conn.peer)) return;
  connections.push(conn);

  conn.on('data', (data) => {
    handlePeerData(data, conn);
  });

  conn.on('close', () => {
    connections = connections.filter(c => c !== conn);
    addSystemMessage('Seorang pemain keluar.');
  });

  conn.on('error', (err) => {
    console.error('Connection error', err);
  });

  if (isHost) {
    addSystemMessage('Pemain baru terhubung!');
    // Send current room state
    conn.send({ type: 'welcome', room: currentRoom, word: currentWord });
  }
}

function broadcast(data) {
  connections.forEach(c => {
    if (c.open) {
      try { c.send(data); } catch(e) { console.error(e); }
    }
  });
}

function handlePeerData(data, conn) {
  switch (data.type) {
    case 'player-join':
      if (currentRoom && !currentRoom.players.find(p => p.id === data.id)) {
        currentRoom.players.push({ id: data.id, name: data.name, score: 0 });
        updatePlayersList();
        addSystemMessage(data.name + ' bergabung!');
        // Tell others too
        if (isHost) broadcast({ type: 'player-join', name: data.name, id: data.id });
      }
      break;
    case 'welcome':
      if (data.room) {
        currentRoom = data.room;
        // Make sure I'm in the list
        if (!currentRoom.players.find(p => p.name === playerName)) {
          currentRoom.players.push({ id: myPeerId, name: playerName, score: 0 });
        }
        updatePlayersList();
      }
      if (data.word) currentWord = data.word;
      break;
    case 'draw':
      drawRemote(data);
      break;
    case 'clear':
      clearCanvas(false);
      break;
    case 'chat':
      addChatMessage(data.name, data.msg);
      break;
    case 'start-round':
      startRound(data.word, data.drawer);
      break;
    case 'guess-correct':
      addChatMessage(data.name, '✅ Menebak dengan benar!', true);
      break;
  }
}

// ==================== CANVAS ====================
function setupCanvas() {
  const canvas = document.getElementById('drawCanvas');
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let drawing = false;
  let lastX = 0, lastY = 0;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function startDraw(e) {
    if (!isDrawingMode) return;
    drawing = true;
    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;
  }

  function draw(e) {
    if (!drawing || !isDrawingMode) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    broadcast({
      type: 'draw',
      x0: lastX, y0: lastY,
      x1: pos.x, y1: pos.y,
      color: currentColor,
      size: currentSize
    });

    lastX = pos.x;
    lastY = pos.y;
  }

  function stopDraw() { drawing = false; }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDraw);
}

function drawRemote(data) {
  const canvas = document.getElementById('drawCanvas');
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = data.color;
  ctx.lineWidth = data.size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(data.x0, data.y0);
  ctx.lineTo(data.x1, data.y1);
  ctx.stroke();
}

function clearCanvas(broadcastIt = true) {
  const canvas = document.getElementById('drawCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (broadcastIt) broadcast({ type: 'clear' });
}

function setupTools() {
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentColor = btn.dataset.color;
    });
  });

  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSize = parseInt(btn.dataset.size);
    });
  });

  document.getElementById('clearBtn').addEventListener('click', () => clearCanvas(true));
  document.getElementById('undoBtn').addEventListener('click', () => clearCanvas(true));

  document.getElementById('sendGuess').addEventListener('click', sendGuess);
  document.getElementById('guessInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendGuess();
  });
}

// ==================== GAME LOGIC ====================
function updatePlayersList() {
  const list = document.getElementById('playersList');
  if (!currentRoom) return;
  list.innerHTML = currentRoom.players.map(p => `
    <li class="${p.name === playerName ? 'me' : ''}">
      <span>😊</span>
      <span>${p.name}</span>
      <span class="score">${p.score || 0}</span>
    </li>
  `).join('');
}

function addSystemMessage(msg) {
  const div = document.createElement('div');
  div.className = 'msg system';
  div.textContent = msg;
  const chat = document.getElementById('chatMessages');
  if (chat) {
    chat.appendChild(div);
    chat.scrollTop = 9999;
  }
}

function addChatMessage(name, msg, correct = false) {
  const div = document.createElement('div');
  div.className = 'msg' + (correct ? ' correct' : '');
  div.innerHTML = `<strong>${name}:</strong> ${msg}`;
  const chat = document.getElementById('chatMessages');
  if (chat) {
    chat.appendChild(div);
    chat.scrollTop = 9999;
  }
}

function sendGuess() {
  const input = document.getElementById('guessInput');
  const msg = input.value.trim();
  if (!msg) return;

  // Command /start
  if (msg === '/start' && isHost) {
    input.value = '';
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    broadcast({ type: 'start-round', word, drawer: playerName });
    startRound(word, playerName);
    return;
  }

  if (currentWord && msg.toLowerCase() === currentWord.toLowerCase() && !isDrawingMode) {
    addChatMessage(playerName, '✅ ' + msg, true);
    broadcast({ type: 'guess-correct', name: playerName });
    const me = currentRoom.players.find(p => p.name === playerName);
    if (me) me.score = (me.score || 0) + 100;
    updatePlayersList();
  } else {
    addChatMessage(playerName, msg);
    broadcast({ type: 'chat', name: playerName, msg });
  }
  input.value = '';
}

function startRound(word, drawerName) {
  currentWord = word;
  clearCanvas(false);
  timeLeft = 60;
  document.getElementById('timer').textContent = timeLeft;

  if (drawerName === playerName) {
    isDrawingMode = true;
    document.getElementById('wordDisplay').textContent = 'Gambar: ' + word;
    document.getElementById('drawingTools').style.opacity = '1';
    addSystemMessage('Giliranmu menggambar: ' + word);
  } else {
    isDrawingMode = false;
    document.getElementById('wordDisplay').textContent = word.split('').map(() => '_').join(' ');
    document.getElementById('drawingTools').style.opacity = '0.4';
    addSystemMessage(drawerName + ' sedang menggambar...');
  }

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('timer').textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      addSystemMessage('Waktu habis! Jawaban: ' + currentWord);
      isDrawingMode = false;
    }
  }, 1000);
}

function leaveRoom() {
  if (peer) {
    try { peer.destroy(); } catch(e) {}
  }
  connections = [];
  currentRoom = null;
  isHost = false;
  isDrawingMode = false;
  if (timerInterval) clearInterval(timerInterval);
  showRooms();
  clearCanvas(false);
  document.getElementById('chatMessages').innerHTML = '';
}

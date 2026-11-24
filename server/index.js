const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

const WORDS = [
  'Kucing','Anjing','Rumah','Mobil','Pohon','Bunga','Matahari','Bulan',
  'Bintang','Ikan','Burung','Sepeda','Bola','Buku','Pensil','Kursi',
  'Meja','Pintu','Jendela','Komputer','Telepon','Jam','Topi','Sepatu',
  'Payung','Kunci','Gunting','Apel','Pisang','Jeruk','Gunung','Laut',
  'Pantai','Hutan','Sekolah','Stasiun','Jembatan','Istana','Robot','Ninja'
];

const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('create-room', ({ name }) => {
    let code;
    do { code = generateCode(); } while (rooms[code]);

    rooms[code] = {
      name: 'Ruangan ' + code,
      host: socket.id,
      players: [{ id: socket.id, name: name || 'Host', score: 0, isHost: true }],
      drawer: null,
      word: null,
      round: 0,
      timer: null
    };

    socket.join(code);
    socket.roomCode = code;
    socket.playerName = name;

    socket.emit('room-created', {
      code,
      name: rooms[code].name,
      players: rooms[code].players
    });
  });

  socket.on('join-room', ({ code, name }) => {
    code = (code || '').toUpperCase().trim();
    const room = rooms[code];

    if (!room) {
      socket.emit('error-msg', 'Ruangan tidak ditemukan. Cek kode lagi.');
      return;
    }
    if (room.players.length >= 10) {
      socket.emit('error-msg', 'Ruangan penuh.');
      return;
    }

    room.players.push({ id: socket.id, name: name || 'Player', score: 0, isHost: false });
    socket.join(code);
    socket.roomCode = code;
    socket.playerName = name;

    socket.emit('room-joined', {
      code,
      name: room.name,
      players: room.players
    });

    socket.to(code).emit('player-joined', {
      name,
      players: room.players
    });
  });

  socket.on('start-game', () => {
    const code = socket.roomCode;
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;

    room.round = (room.round || 0) + 1;
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    room.word = word;

    const drawerIndex = (room.round - 1) % room.players.length;
    room.drawer = room.players[drawerIndex].name;

    const hint = word.split('').map(() => '_').join(' ');

    room.players.forEach(p => {
      const s = io.sockets.sockets.get(p.id);
      if (!s) return;
      s.emit('game-started', {
        round: room.round,
        drawer: room.drawer,
        word: p.name === room.drawer ? word : null,
        hint: p.name === room.drawer ? null : hint,
        time: 60
      });
    });

    if (room.timer) clearTimeout(room.timer);
    room.timer = setTimeout(() => {
      io.to(code).emit('time-up', { word: room.word });
      room.word = null;
    }, 60000);
  });

  socket.on('draw', (data) => {
    const code = socket.roomCode;
    if (!code) return;
    socket.to(code).emit('draw', data);
  });

  socket.on('clear', () => {
    const code = socket.roomCode;
    if (!code) return;
    socket.to(code).emit('clear');
  });

  socket.on('chat', ({ msg }) => {
    const code = socket.roomCode;
    const room = rooms[code];
    if (!room || !msg) return;

    const name = socket.playerName || 'Player';

    if (room.word && msg.toLowerCase() === room.word.toLowerCase() && name !== room.drawer) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.score = (player.score || 0) + 100;
        const drawer = room.players.find(p => p.name === room.drawer);
        if (drawer) drawer.score = (drawer.score || 0) + 50;
      }

      io.to(code).emit('correct-guess', {
        name,
        points: 100,
        players: room.players
      });

      if (room.timer) clearTimeout(room.timer);
      io.to(code).emit('time-up', { word: room.word });
      room.word = null;
      return;
    }

    io.to(code).emit('chat', { name, msg });
  });

  socket.on('leave-room', () => handleLeave(socket));
  socket.on('disconnect', () => handleLeave(socket));
});

function handleLeave(socket) {
  const code = socket.roomCode;
  if (!code || !rooms[code]) return;

  const room = rooms[code];
  const name = socket.playerName || 'Player';
  room.players = room.players.filter(p => p.id !== socket.id);

  if (room.players.length === 0) {
    if (room.timer) clearTimeout(room.timer);
    delete rooms[code];
  } else {
    if (room.host === socket.id) {
      room.host = room.players[0].id;
      room.players[0].isHost = true;
    }
    socket.to(code).emit('player-left', { name, players: room.players });
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('MarzzDraw server running on port', PORT);
});

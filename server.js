const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- GAME STATE MANAGEMENT ---
// Salas: { 'CODE12': { players: [{id, name, role, word}], status: 'lobby', settings: {spies: 1} } }
const rooms = {};

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', ({ playerName }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            players: [{ id: socket.id, name: playerName, isHost: true }],
            status: 'lobby',
            settings: { spies: 1, time: 300 }
        };
        socket.join(roomCode);
        socket.emit('room_created', { roomCode, isHost: true, players: rooms[roomCode].players });
    });

    socket.on('join_room', ({ roomCode, playerName }) => {
        roomCode = roomCode.toUpperCase();
        const room = rooms[roomCode];

        if (room && room.status === 'lobby') {
            room.players.push({ id: socket.id, name: playerName, isHost: false });
            socket.join(roomCode);

            // Notificar al usuario actual
            socket.emit('joined_room', { roomCode, isHost: false, players: room.players });
            // Notificar a todos en la sala que alguien entró
            io.to(roomCode).emit('update_players', room.players);
        } else {
            socket.emit('error_message', 'Sala no encontrada o juego ya iniciado.');
        }
    });

    socket.on('start_game', async ({ roomCode, settings }) => {
        const room = rooms[roomCode];
        if (!room) return;

        // Configurar juego
        room.status = 'playing';
        room.settings = settings; // { spies: N }

        try {
            // 1. Obtener palabra aleatoria de la BD
            const [rows] = await db.query('SELECT * FROM words ORDER BY RAND() LIMIT 1');
            const secretData = rows.length > 0 ? rows[0] : { word: 'Error', category: 'Error' };

            room.secretWord = secretData.word;
            room.category = secretData.category;

            // 2. Asignar roles
            const totalPlayers = room.players.length;
            const roles = Array(totalPlayers).fill('citizen');
            let spiesAssigned = 0;

            // Evitar bucle infinito si hay más espías que jugadores
            const numSpies = Math.min(settings.spies, totalPlayers - 1);

            while (spiesAssigned < numSpies) {
                const idx = Math.floor(Math.random() * totalPlayers);
                if (roles[idx] === 'citizen') {
                    roles[idx] = 'spy';
                    spiesAssigned++;
                }
            }

            // 3. Notificar a cada jugador su rol individualmente
            room.players.forEach((player, index) => {
                player.role = roles[index];
                player.word = player.role === 'citizen' ? room.secretWord : '???';

                io.to(player.id).emit('game_started', {
                    role: player.role,
                    word: player.word,
                    category: room.category,
                    time: settings.time
                });
            });

            // Enviar timer global
            io.to(roomCode).emit('start_timer', settings.time);

        } catch (err) {
            console.error(err);
            io.to(roomCode).emit('error_message', 'Error iniciando juego');
        }
    });

    // Sincronización de Timer (Desde el host)
    socket.on('sync_timer', ({ roomCode, time }) => {
        socket.to(roomCode).emit('update_timer', time);
    });

    // Finalizar juego y revelar
    socket.on('reveal_game', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (room) {
            io.to(roomCode).emit('game_reveal', {
                word: room.secretWord,
                category: room.category,
                players: room.players
            });
            room.status = 'finished';
        }
    });

    socket.on('disconnect', () => {
        // Encontrar sala del usuario y eliminarlo
        for (const code in rooms) {
            const room = rooms[code];
            const playerIdx = room.players.findIndex(p => p.id === socket.id);
            if (playerIdx !== -1) {
                room.players.splice(playerIdx, 1);
                io.to(code).emit('update_players', room.players);

                // Si la sala se vacía, borrarla
                if (room.players.length === 0) delete rooms[code];
                break;
            }
        }
    });
});


// --- API ROUTES ---

// Obtener todas las palabras
app.get('/api/words', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM words ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener palabras' });
    }
});

app.get('/api/word/random', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT word, category FROM words ORDER BY RAND() LIMIT 1');
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: 'No hay palabras en la base de datos' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener palabra aleatoria' });
    }
});

// Añadir una nueva palabra
app.post('/api/words', async (req, res) => {
    const { word, category } = req.body;
    if (!word) return res.status(400).json({ error: 'La palabra es requerida' });

    try {
        const [result] = await db.query('INSERT INTO words (word, category) VALUES (?, ?)', [word, category || 'General']);
        res.json({ id: result.insertId, word, category });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'La palabra ya existe' });
        } else {
            res.status(500).json({ error: 'Error al guardar la palabra' });
        }
    }
});

// Eliminar una palabra
app.delete('/api/words/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM words WHERE id = ?', [id]);
        res.json({ message: 'Palabra eliminada' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar la palabra' });
    }
});

// --- FRONTEND ROUTES ---
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cambiar app.listen a server.listen para socket.io
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


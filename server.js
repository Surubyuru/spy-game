const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE INIT ---
async function initDB() {
    console.log('🔄 Verificando estado de la base de datos...');
    try {
        // Verificar si hay palabras
        const [rows] = await db.query('SELECT count(*) as count FROM words');
        if (rows[0].count > 0) {
            console.log('✅ Base de datos ya inicializada.');
            return;
        }
    } catch (err) {
        console.log('⚠️ Tabla "words" no encontrada o vacía. Iniciando setup...');
    }

    try {
        const sql = fs.readFileSync(path.join(__dirname, 'setup.sql'), 'utf8');
        const statements = sql.split(/;\s*$/m);

        for (const statement of statements) {
            if (statement.trim()) {
                await db.query(statement);
            }
        }
        console.log('✅ Base de datos inicializada con éxito (Tablas y Datos).');
    } catch (err) {
        console.error('❌ Error fatal inicializando DB:', err);
    }
}

// Llamar a initDB al arrancar
initDB();

// --- GAME STATE MANAGEMENT ---
const rooms = {};

const sessions = {}; // sessionId -> { roomCode, userId }
const RECONNECT_WINDOW = 120000; // 2 minutos

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function generateId() {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Intentar reconexión rápida
    socket.on('rejoin_request', ({ sessionId }) => {
        if (!sessions[sessionId]) {
            socket.emit('rejoin_failed');
            return;
        }

        const { roomCode, userId } = sessions[sessionId];
        const room = rooms[roomCode];

        if (!room) {
            delete sessions[sessionId];
            socket.emit('rejoin_failed');
            return;
        }

        const player = room.players.find(p => p.id === userId);
        if (player) {
            // Cancelar timeout de destrucción si existe
            if (player.disconnectTimeout) {
                clearTimeout(player.disconnectTimeout);
                player.disconnectTimeout = null;
            }

            // Actualizar socket
            player.socketId = socket.id; // Guardamos la nueva referencia
            player.connected = true;
            socket.join(roomCode);

            // Restaurar estado al cliente
            socket.emit('rejoin_success', {
                roomCode,
                gameDetails: {
                    status: room.status,
                    players: room.players.map(p => ({
                        id: p.id, // userId
                        name: p.name,
                        isHost: p.isHost,
                        connected: p.connected,
                        // No enviamos roles a todos, pero al propio usuario sí si está jugando
                    })),
                    myRole: player.role,
                    myWord: player.word,
                    category: room.category,
                    time: room.settings ? room.settings.time : 0
                }
            });

            // Notificar a otros que volvió de entre los muertos
            io.to(roomCode).emit('player_reconnected', { userId: player.id });
        } else {
            socket.emit('rejoin_failed');
        }
    });

    socket.on('create_room', ({ playerName }) => {
        const roomCode = generateRoomCode();
        const userId = generateId();
        const sessionId = generateId();

        sessions[sessionId] = { roomCode, userId };

        rooms[roomCode] = {
            players: [{
                id: userId,
                socketId: socket.id,
                name: playerName,
                isHost: true,
                connected: true
            }],
            status: 'lobby',
            settings: { spies: 1, time: 300 }
        };
        socket.join(roomCode);
        socket.emit('room_created', {
            roomCode,
            isHost: true,
            players: rooms[roomCode].players,
            sessionId,
            userId
        });
    });

    socket.on('join_room', ({ roomCode, playerName }) => {
        roomCode = roomCode.toUpperCase();
        const room = rooms[roomCode];

        if (room && room.status === 'lobby') {
            const userId = generateId();
            const sessionId = generateId();
            sessions[sessionId] = { roomCode, userId };

            const newPlayer = {
                id: userId,
                socketId: socket.id,
                name: playerName,
                isHost: false,
                connected: true
            };

            room.players.push(newPlayer);
            socket.join(roomCode);

            // Send session info ONLY to this socket
            socket.emit('joined_room', {
                roomCode,
                isHost: false,
                players: room.players,
                sessionId,
                userId
            });
            io.to(roomCode).emit('update_players', room.players);
        } else {
            socket.emit('error_message', 'Sala no encontrada o juego ya iniciado.');
        }
    });

    socket.on('start_game', async ({ roomCode, settings }) => {
        const room = rooms[roomCode];
        if (!room) return;

        room.status = 'playing';
        room.settings = settings;

        try {
            const [rows] = await db.query('SELECT * FROM words ORDER BY RAND() LIMIT 1');
            const secretData = rows.length > 0 ? rows[0] : { word: 'Error', category: 'Error' };

            room.secretWord = secretData.word;
            room.category = secretData.category;

            const totalPlayers = room.players.length;
            const roles = Array(totalPlayers).fill('citizen');
            let spiesAssigned = 0;
            const numSpies = Math.min(settings.spies, totalPlayers - 1);

            while (spiesAssigned < numSpies) {
                const idx = Math.floor(Math.random() * totalPlayers);
                if (roles[idx] === 'citizen') {
                    roles[idx] = 'spy';
                    spiesAssigned++;
                }
            }

            room.players.forEach((player, index) => {
                player.role = roles[index];
                player.word = player.role === 'citizen' ? room.secretWord : '???';

                if (player.connected && player.socketId) {
                    io.to(player.socketId).emit('game_started', {
                        role: player.role,
                        word: player.word,
                        category: room.category,
                        time: settings.time
                    });
                }
            });

            io.to(roomCode).emit('start_timer', settings.time);

        } catch (err) {
            console.error(err);
            const msg = err.code === 'ER_NO_SUCH_TABLE'
                ? 'Error: La base de datos no está inicializada.'
                : `Error iniciando juego: ${err.message}`;
            io.to(roomCode).emit('error_message', msg);
        }
    });

    socket.on('sync_timer', ({ roomCode, time }) => {
        socket.to(roomCode).emit('update_timer', time);
    });

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

    socket.on('play_again', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (room && room.status === 'finished') {
            const player = room.players.find(p => p.socketId === socket.id); // Correct check
            if (!player || !player.isHost) return;

            room.status = 'lobby';
            io.to(roomCode).emit('back_to_lobby');
            io.to(roomCode).emit('update_players', room.players);
        }
    });

    socket.on('leave_game', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (room) {
            // Find player by socketId
            const player = room.players.find(p => p.socketId === socket.id);
            if (player) {
                // Remove immediately, no grace period
                if (player.disconnectTimeout) clearTimeout(player.disconnectTimeout);

                const idx = room.players.indexOf(player);
                room.players.splice(idx, 1);

                io.to(roomCode).emit('update_players', room.players);
                io.to(roomCode).emit('player_left', { userId: player.id });

                if (room.players.length === 0) {
                    delete rooms[roomCode];
                    // Clean sessions
                    for (const sid in sessions) {
                        if (sessions[sid].roomCode === roomCode) delete sessions[sid];
                    }
                } else if (player.isHost) {
                    // Reassign host if needed (though usually we pick first remaining)
                    const activeP = room.players.find(p => p.connected);
                    if (activeP) {
                        activeP.isHost = true; // Assign to first active
                        room.players[0] = activeP; // Move to front? No, just flag.
                        // Actually just flag is enough, update_players will notify
                    }
                    io.to(roomCode).emit('update_players', room.players);
                }
            }
        }
    });

    socket.on('disconnect', () => {
        for (const code in rooms) {
            const room = rooms[code];
            // Find player by socketId (stored in `socketId` prop now)
            const player = room.players.find(p => p.socketId === socket.id);

            if (player) {
                console.log(`Player ${player.name} disconnected. Starting grace period.`);
                player.connected = false;

                // Notify others to show the timer UI
                io.to(code).emit('player_disconnected_wait', {
                    userId: player.id,
                    name: player.name,
                    timeout: RECONNECT_WINDOW
                });

                // Start destruction timer
                player.disconnectTimeout = setTimeout(() => {
                    console.log(`Player ${player.name} timed out. Removing.`);
                    if (room.players.includes(player)) {
                        const idx = room.players.indexOf(player);
                        room.players.splice(idx, 1);

                        // Notify removal
                        io.to(code).emit('update_players', room.players);
                        io.to(code).emit('player_left', { userId: player.id });

                        // If room empty or only disconnected players left?
                        // "si no hay nadie se cierra"
                        const activePlayers = room.players.filter(p => p.connected);
                        if (activePlayers.length === 0) {
                            console.log(`Room ${code} empty. Deleting.`);
                            delete rooms[code];

                            // Cleanup sessions
                            for (const sid in sessions) {
                                if (sessions[sid].roomCode === code) delete sessions[sid];
                            }
                        } else {
                            // If host left, assign new host
                            if (player.isHost && room.players.length > 0) {
                                room.players[0].isHost = true;
                                io.to(code).emit('update_players', room.players);
                            }
                        }
                    }
                }, RECONNECT_WINDOW);
                break;
            }
        }
    });
});

// --- API ROUTES ---

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

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

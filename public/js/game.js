const socket = io();

// Elementos DOM
const screens = {
    home: document.getElementById('screen-home'),
    lobby: document.getElementById('screen-lobby'),
    reveal: document.getElementById('screen-reveal'),
    game: document.getElementById('screen-game'),
    results: document.getElementById('screen-results')
};

// State
let myRoomCode = null;
let amIHost = false;

// --- HOME LOGIC ---

document.getElementById('btn-create-room').addEventListener('click', () => {
    const name = document.getElementById('input-name').value.trim() || 'Agente X';
    socket.emit('create_room', { playerName: name });
});

document.getElementById('btn-join-room').addEventListener('click', () => {
    const name = document.getElementById('input-name').value.trim() || 'Agente X';
    const code = document.getElementById('input-room-code').value.trim();
    if (code) socket.emit('join_room', { roomCode: code, playerName: name });
});

// --- SOCKET LISTENERS ---

socket.on('room_created', (data) => {
    enterLobby(data);
});

socket.on('joined_room', (data) => {
    enterLobby(data);
});

socket.on('update_players', (players) => {
    renderLobbyPlayers(players);
});

socket.on('error_message', (msg) => {
    alert(msg);
});

socket.on('game_started', (data) => {
    // data = { role, word, category, time }
    showScreen('reveal');

    const roleElem = document.getElementById('role-display');
    const catElem = document.getElementById('category-display');

    if (data.role === 'spy') {
        roleElem.innerText = 'ESPÍA';
        roleElem.className = 'role-text impostor-text';
        catElem.innerText = 'Descubre la palabra';
    } else {
        roleElem.innerText = data.word;
        roleElem.className = 'role-text citizen-text';
        catElem.innerText = `Categoría: ${data.category}`;
    }
});

socket.on('start_timer', (duration) => {
    // Iniciar timer visual (sincronizado "más o menos")
    startLocalTimer(duration);
    setTimeout(() => {
        showScreen('game');
    }, 5000); // Dar 5 segundos para leer la carta
});

socket.on('game_reveal', (data) => {
    // data = { word, category, players }
    showScreen('results');
    document.getElementById('result-word').innerText = data.word;

    const list = document.getElementById('result-players');
    list.innerHTML = '';

    data.players.forEach(p => {
        const div = document.createElement('div');
        const isSpy = p.role === 'spy';
        div.className = `word-chip ${isSpy ? 'reveal-spy' : 'reveal-citizen'}`;
        div.innerHTML = `
            <strong>${p.name}</strong>
            <span>${isSpy ? '🕵️ ESPÍA' : 'AGENT'}</span>
        `;
        list.appendChild(div);
    });
});

// --- LOBBY LOGIC ---

function enterLobby(data) {
    myRoomCode = data.roomCode;
    amIHost = data.isHost;

    document.getElementById('lobby-code').innerText = myRoomCode;
    renderLobbyPlayers(data.players);
    showScreen('lobby');

    if (amIHost) {
        document.getElementById('host-controls').classList.remove('hidden');
        document.getElementById('host-game-controls').classList.remove('hidden');
    } else {
        document.getElementById('waiting-msg').classList.remove('hidden');
    }
}

function renderLobbyPlayers(players) {
    const container = document.getElementById('lobby-players');
    container.innerHTML = '';
    players.forEach(p => {
        const el = document.createElement('div');
        el.className = 'word-chip glass-panel';
        el.innerText = p.name + (p.isHost ? ' (Líder)' : '');
        container.appendChild(el);
    });
}

document.getElementById('btn-start-game').addEventListener('click', () => {
    const spies = parseInt(document.getElementById('lobby-spies').value);
    socket.emit('start_game', { roomCode: myRoomCode, settings: { spies, time: 300 } });
});

document.getElementById('btn-reveal-game').addEventListener('click', () => {
    if (confirm('¿Terminar partida y revelar roles?')) {
        socket.emit('reveal_game', { roomCode: myRoomCode });
    }
});

// --- HELPERS ---

function showScreen(name) {
    Object.values(screens).forEach(el => el.classList.add('hidden'));
    screens[name].classList.remove('hidden');
}

// Card Interaction (Igual que antes)
const card = document.getElementById('identity-card');
const wrapper = card.querySelector('.card-wrapper');
const reveal = (e) => { e.preventDefault(); wrapper.classList.add('revealed'); };
const hide = (e) => { if (e) e.preventDefault(); wrapper.classList.remove('revealed'); };

card.addEventListener('mousedown', reveal);
card.addEventListener('mouseup', hide);
card.addEventListener('mouseleave', hide);
card.addEventListener('touchstart', reveal);
card.addEventListener('touchend', hide);

// Timer Simple
function startLocalTimer(seconds) {
    const timerEl = document.getElementById('timer');
    let rem = seconds;
    const interval = setInterval(() => {
        rem--;
        const m = Math.floor(rem / 60).toString().padStart(2, '0');
        const s = (rem % 60).toString().padStart(2, '0');
        timerEl.innerText = `${m}:${s}`;

        if (rem <= 0) clearInterval(interval);
    }, 1000);
}

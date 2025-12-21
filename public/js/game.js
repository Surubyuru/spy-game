const socket = io();

// Elementos DOM
const screens = {
    home: document.getElementById('screen-home'),
    lobby: document.getElementById('screen-lobby'),
    reveal: document.getElementById('screen-reveal'),
    game: document.getElementById('screen-game'),
    voting: document.getElementById('screen-voting'),
    results: document.getElementById('screen-results')
};

// State
let myRoomCode = null;
let amIHost = false;
let myUserId = null; // Store for self-vote check
let myName = '';

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

// Removed duplicative enterLobby call here as room_created handles it


socket.on('room_created', (data) => {
    localStorage.setItem('spy_session', data.sessionId); // Save session
    myName = document.getElementById('input-name').value.trim() || 'Suru'; // Fallback to current input or Suru
    enterLobby(data);
});

socket.on('joined_room', (data) => {
    localStorage.setItem('spy_session', data.sessionId); // Save session
    myName = document.getElementById('input-name').value.trim() || 'Agente X';
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

socket.on('voting_started', ({ players }) => {
    showScreen('voting');

    // Determine my ID to prevent self-voting (hacky way via localStorage)
    // Better way: Server sent 'userId' in joined_room. Only available in scope if stored globally?
    // We saved session, but we need current user ID in memory.
    // Actually, let's grab it from session storage or check against name (risky).
    // Let's assume we can reconstruct it or simply just block visually by name for now, 
    // or better: The server prevents it, so visual cue is enough. 
    // We used `enterLobby` data. 
    // Let's store myId in a variable in `enterLobby`

    renderVotingList(players);
});

socket.on('vote_confirmed', () => {
    document.getElementById('voting-status').classList.remove('hidden');
    const container = document.getElementById('voting-players-container');
    // Disable all buttons
    const btns = container.querySelectorAll('button');
    btns.forEach(b => b.disabled = true);
});

socket.on('game_reveal', (data) => {
    // data = { word, category, players, votes }
    showScreen('results');
    document.getElementById('result-word').innerText = data.word;

    const list = document.getElementById('result-players');
    list.innerHTML = '';

    data.players.forEach(p => {
        const div = document.createElement('div');
        const isSpy = p.role === 'spy';
        const votesReceived = (data.votes && data.votes[p.id]) || 0;

        div.className = `word-chip ${isSpy ? 'reveal-spy' : 'reveal-citizen'}`;
        div.innerHTML = `
            <strong>${p.name}</strong>
            <div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-top:0.5rem">
                <span>${isSpy ? '🕵️ ESPÍA' : 'AGENT'}</span>
                ${votesReceived > 0 ? `<span class="badge" style="background:orange; padding:2px 6px; border-radius:4px; font-size:0.8rem">🗳️ ${votesReceived}</span>` : ''}
            </div>
        `;
        list.appendChild(div);
    });

    if (amIHost) {
        document.getElementById('btn-restart-game').classList.remove('hidden');
    }
});

socket.on('back_to_lobby', () => {
    showScreen('lobby');
    // Limpiar pantalla de resultados por si acaso
    document.getElementById('btn-restart-game').classList.add('hidden');
});

// --- LOBBY LOGIC ---

function enterLobby(data) {
    myRoomCode = data.roomCode;
    amIHost = data.isHost;
    if (data.userId) myUserId = data.userId; // Capture ID

    document.getElementById('lobby-code').innerText = myRoomCode;
    renderLobbyPlayers(data.players);
    showScreen('lobby');

    if (amIHost) {
        document.getElementById('host-controls').classList.remove('hidden');
        document.getElementById('host-game-controls').classList.remove('hidden');

        // MOSTRAR BOTON SECRETO SOLO SI ES SURU
        if (myName === 'Suru') {
            document.getElementById('secret-cheat-btn').classList.remove('hidden');
        }
    } else {
        document.getElementById('host-controls').classList.add('hidden'); // Ensure hidden
        document.getElementById('host-game-controls').classList.add('hidden');
        document.getElementById('waiting-msg').classList.remove('hidden');
        document.getElementById('secret-cheat-btn').classList.add('hidden');
    }
}

function renderLobbyPlayers(players) {
    const container = document.getElementById('lobby-players');
    container.innerHTML = '';
    players.forEach(p => {
        const el = document.createElement('div');
        el.className = 'word-chip glass-panel';

        // Handle connected status visual
        if (p.connected === false) {
            el.style.opacity = '0.5';
            el.innerText = p.name + ' (Desconectado)';
        } else {
            el.innerText = p.name + (p.isHost ? ' (Líder)' : '');
        }

        container.appendChild(el);
    });
}

// Exit button logic (Both in-screen and global)
function handleExitGame() {
    if (confirm('¿Seguro que quieres salir de la sala?')) {
        localStorage.removeItem('spy_session');
        if (myRoomCode) {
            socket.emit('leave_game', { roomCode: myRoomCode });
        }
        location.reload();
    }
}

document.getElementById('btn-exit-game').addEventListener('click', handleExitGame);
document.getElementById('global-exit-btn').addEventListener('click', handleExitGame);


document.getElementById('btn-start-game').addEventListener('click', () => {
    const spies = parseInt(document.getElementById('lobby-spies').value);
    socket.emit('start_game', { roomCode: myRoomCode, settings: { spies, time: 300 } });
});

document.getElementById('btn-reveal-game').addEventListener('click', () => {
    if (confirm('¿Terminar debate y pasar a votación?')) {
        socket.emit('start_voting', { roomCode: myRoomCode });
    }
});

document.getElementById('btn-restart-game').addEventListener('click', () => {
    socket.emit('play_again', { roomCode: myRoomCode });
});

// --- CHEAT PANEL LOGIC ---
const cheatModal = document.getElementById('cheat-modal');
const cheatBtn = document.getElementById('secret-cheat-btn');
const closeCheat = document.querySelector('.close-modal');
const refreshCheat = document.getElementById('btn-refresh-cheat');
const cheatContent = document.getElementById('cheat-content');

cheatBtn.addEventListener('click', () => {
    cheatModal.classList.remove('hidden');
    requestCheatUpdate();
});

closeCheat.addEventListener('click', () => {
    cheatModal.classList.add('hidden');
});

refreshCheat.addEventListener('click', () => {
    requestCheatUpdate();
});

function requestCheatUpdate() {
    cheatContent.innerHTML = '<p>Obteniendo secretos...</p>';
    socket.emit('request_cheat_data', { roomCode: myRoomCode });
}

socket.on('cheat_data', (data) => {
    // data = { secretWord, category, players: [{name, role, connected}] }
    let html = `
        <div style="margin-bottom: 1rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
            <p><strong>PALABRA:</strong> <span style="color: var(--secondary); font-size: 1.2rem;">${data.secretWord || '???'}</span></p>
            <p><strong>CATEGORÍA:</strong> ${data.category || '???'}</p>
        </div>
        <div class="cheat-list">
    `;

    data.players.forEach(p => {
        const isSpy = p.role === 'spy';
        html += `
            <div class="cheat-item">
                <span style="${!p.connected ? 'opacity: 0.5' : ''}">${p.name}</span>
                <span style="font-weight: bold; color: ${isSpy ? 'var(--danger)' : 'var(--secondary)'}">
                    ${isSpy ? '🕵️ ESPÍA' : 'AGENT'}
                </span>
            </div>
        `;
    });

    html += '</div>';
    cheatContent.innerHTML = html;
});

// --- HELPERS ---

function showScreen(name) {
    Object.values(screens).forEach(el => el.classList.add('hidden'));
    screens[name].classList.remove('hidden');

    // Toggle global exit button
    const exitBtn = document.getElementById('global-exit-btn');
    if (name === 'home') {
        exitBtn.classList.add('hidden');
    } else {
        exitBtn.classList.remove('hidden');
    }
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
// --- RECONNECTION & DISCONNECTION UI ---
socket.on('connect', () => {
    // Check for saved session
    const savedSession = localStorage.getItem('spy_session');
    if (savedSession) {
        socket.emit('rejoin_request', { sessionId: savedSession });
    }
});

socket.on('run_rejoin_logic', () => {
    // Placeholder (not strictly needed with new flow but good to have)
});

socket.on('rejoin_success', (data) => {
    // data = { roomCode, gameDetails }
    console.log('Rejoined successfully!', data);
    enterLobby({
        roomCode: data.roomCode,
        isHost: data.gameDetails.players.find(p => p.id === data.gameDetails.players[0].id).isHost, // Assuming ordered, but we need check by ID logic really.
        players: data.gameDetails.players
    });

    // Determine current screen based on status
    if (data.gameDetails.status === 'playing') {
        const myRole = data.gameDetails.myRole;
        if (myRole) {
            // Restore role info
            const roleElem = document.getElementById('role-display');
            const catElem = document.getElementById('category-display');

            if (myRole === 'spy') {
                roleElem.innerText = 'ESPÍA';
                roleElem.className = 'role-text impostor-text';
                catElem.innerText = 'Descubre la palabra';
            } else {
                roleElem.innerText = data.gameDetails.myWord;
                roleElem.className = 'role-text citizen-text';
                catElem.innerText = `Categoría: ${data.gameDetails.category}`;
            }
        }
        showScreen('game');
    } else if (data.gameDetails.status === 'finished') {
        // Can't easily restore full result state without more data, but show lobby or wait
        showScreen('results');
    }
});

socket.on('player_disconnected_wait', ({ userId, name, timeout }) => {
    showDisconnectAlert(userId, name, timeout);
});

socket.on('player_reconnected', ({ userId }) => {
    removeDisconnectAlert(userId);
});

socket.on('player_left', ({ userId }) => {
    removeDisconnectAlert(userId);
});


// Helper for voting list


function renderVotingList(players) {
    const container = document.getElementById('voting-players-container');
    container.innerHTML = '';

    // Reset status
    document.getElementById('voting-status').classList.add('hidden');

    players.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.innerHTML = `<span>${p.name}</span> <span>👉</span>`;

        if (p.id === myUserId) {
            btn.disabled = true;
            btn.style.opacity = '0.3';
            btn.innerHTML = `<span>${p.name} (Tú)</span> <span>🚫</span>`;
        }

        btn.onclick = () => {
            // Visual selection
            const all = container.querySelectorAll('.vote-btn');
            all.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            if (confirm(`¿Votar a ${p.name}? No se puede cambiar.`)) {
                socket.emit('cast_vote', { roomCode: myRoomCode, targetId: p.id });
            }
        };

        container.appendChild(btn);
    });
}

// UI Helpers for Alerts
function showDisconnectAlert(userId, name, timeoutMs) {
    const id = `alert-${userId}`;
    if (document.getElementById(id)) return;

    const alert = document.createElement('div');
    alert.id = id;
    alert.className = 'disconnect-alert';

    let secondsLeft = Math.ceil(timeoutMs / 1000);

    alert.innerHTML = `
        <div style="font-size: 2rem;">⚠️</div>
        <div>
            <div style="font-weight: bold; margin-bottom: 0.2rem;">${name} desconectado</div>
            <div style="font-size: 0.8rem; opacity: 0.8;">Esperando reconexión...</div>
        </div>
        <div class="disconnect-timer" id="timer-${id}">${formatTime(secondsLeft)}</div>
    `;

    document.body.appendChild(alert);

    // Timer logic
    const interval = setInterval(() => {
        secondsLeft--;
        const tEl = document.getElementById(`timer-${id}`);
        if (tEl) tEl.innerText = formatTime(secondsLeft);

        if (secondsLeft <= 0) {
            clearInterval(interval);
            removeDisconnectAlert(userId);
        }
    }, 1000);

    // Store interval to clear it if removed early
    alert.dataset.interval = interval;
}

function removeDisconnectAlert(userId) {
    const id = `alert-${userId}`;
    const el = document.getElementById(id);
    if (el) {
        clearInterval(el.dataset.interval);
        el.classList.add('fading');
        setTimeout(() => el.remove(), 500);
    }
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Timer Simple (Updated to avoid conflict)
function startLocalTimer(seconds) {
    const timerEl = document.getElementById('timer');
    // Clear prev interval if any (global var would be better but this is quick fix)
    if (window.gameTimer) clearInterval(window.gameTimer);

    let rem = seconds;
    window.gameTimer = setInterval(() => {
        rem--;
        const m = Math.floor(rem / 60).toString().padStart(2, '0');
        const s = (rem % 60).toString().padStart(2, '0');
        timerEl.innerText = `${m}:${s}`;

        if (rem <= 0) clearInterval(window.gameTimer);
    }, 1000);
}

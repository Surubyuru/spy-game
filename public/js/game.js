// Game Logic

const screens = {
    setup: document.getElementById('screen-setup'),
    pass: document.getElementById('screen-pass'),
    reveal: document.getElementById('screen-reveal'),
    game: document.getElementById('screen-game'),
    results: document.getElementById('screen-results')
};

const inputs = {
    players: document.getElementById('input-players'),
    spies: document.getElementById('input-spies')
};

let gameState = {
    players: [], // Array of objects { role: 'spy' | 'citizen', word: string }
    currentPlayerIndex: 0,
    secretWord: '',
    category: ''
};

let timerInterval;
let timeRemaining = 300; // 5 minutes

// --- EVENT LISTENERS ---

document.getElementById('btn-start').addEventListener('click', async () => {
    const numPlayers = parseInt(inputs.players.value);
    const numSpies = parseInt(inputs.spies.value);

    if (numSpies >= numPlayers) {
        alert('No puede haber más espías que jugadores.');
        return;
    }

    await initializeGame(numPlayers, numSpies);
});

document.getElementById('btn-reveal').addEventListener('click', () => {
    showRole();
    showScreen('reveal');
});

document.getElementById('btn-hide').addEventListener('click', () => {
    gameState.currentPlayerIndex++;
    if (gameState.currentPlayerIndex < gameState.players.length) {
        updatePassScreen();
        showScreen('pass');
    } else {
        startTimerPhase();
    }
});

document.getElementById('btn-timer-toggle').addEventListener('click', toggleTimer);
document.getElementById('btn-finish').addEventListener('click', endGame);
document.getElementById('btn-restart').addEventListener('click', () => {
    // Reset fundamental state but keep settings
    stopTimer();
    showScreen('setup');
});

// --- FUNCTIONS ---

async function initializeGame(numPlayers, numSpies) {
    try {
        const response = await fetch('/api/word/random');
        if (!response.ok) throw new Error('Error fetching word');
        const data = await response.json();

        gameState.secretWord = data.word; // e.g. "Manzana"
        gameState.category = data.category || 'General';

        // Create player roles
        let roles = Array(numPlayers).fill('citizen');

        // Randomly assign spies
        let spiesAssigned = 0;
        while (spiesAssigned < numSpies) {
            const idx = Math.floor(Math.random() * numPlayers);
            if (roles[idx] === 'citizen') {
                roles[idx] = 'spy';
                spiesAssigned++;
            }
        }

        gameState.players = roles.map(role => ({
            role,
            word: role === 'citizen' ? gameState.secretWord : '???'
        }));

        gameState.currentPlayerIndex = 0;

        // Start flow
        updatePassScreen();
        showScreen('pass');

    } catch (error) {
        alert('Error al iniciar partida: Asegúrate de que el servidor esté corriendo y haya palabras en la base de datos.');
        console.error(error);
    }
}

function updatePassScreen() {
    document.getElementById('current-player-num').innerText = gameState.currentPlayerIndex + 1;
}

function showRole() {
    const player = gameState.players[gameState.currentPlayerIndex];
    const roleDisplay = document.getElementById('role-display');
    const categoryDisplay = document.getElementById('category-display');

    if (player.role === 'spy') {
        roleDisplay.innerText = 'ESPÍA';
        roleDisplay.className = 'role-text impostor-text';
        categoryDisplay.innerText = 'Tu objetivo: Descubrir la palabra secreta';
    } else {
        roleDisplay.innerText = gameState.secretWord;
        roleDisplay.className = 'role-text citizen-text';
        categoryDisplay.innerText = `Categoría: ${gameState.category}`;
    }
}

function showScreen(screenName) {
    // Hide all
    Object.values(screens).forEach(el => el.classList.add('hidden'));
    // Show target
    // Check if element exists before accessing classList to avoid errors if I missed one
    if (screens[screenName]) {
        screens[screenName].classList.remove('hidden');
    }
}

function startTimerPhase() {
    showScreen('game');
    timeRemaining = 300; // Reset to 5 mins
    updateTimerDisplay();
    // Auto start? Maybe wait for user action. Let's wait.
}

// Timer Logic
function toggleTimer() {
    const btn = document.getElementById('btn-timer-toggle');
    if (timerInterval) {
        stopTimer();
        btn.innerText = "CONTINUAR";
    } else {
        btn.innerText = "PAUSA";
        timerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerDisplay();
            if (timeRemaining <= 0) {
                stopTimer();
                alert('¡TIEMPO TERMINADO! Momento de votar.');
                // We don't auto-end game, we let them discuss.
            }
        }, 1000);
    }
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const seconds = (timeRemaining % 60).toString().padStart(2, '0');
    document.getElementById('timer').innerText = `${minutes}:${seconds}`;
}

function endGame() {
    stopTimer();

    // Populate Results
    document.getElementById('result-word').innerText = gameState.secretWord;
    document.getElementById('result-category').innerText = gameState.category;

    const list = document.getElementById('players-reveal-list');
    list.innerHTML = '';

    gameState.players.forEach((player, idx) => {
        const div = document.createElement('div');
        const isSpy = player.role === 'spy';
        div.className = `word-chip ${isSpy ? 'reveal-spy' : 'reveal-citizen'}`;

        div.innerHTML = `
            <div>
                <strong>Jugador ${idx + 1}</strong>
            </div>
            <div style="font-weight: 800; font-size: 0.9rem;">
                ${isSpy ? '🕵️ ESPÍA' : '👤 AGENTE'}
            </div>
        `;
        list.appendChild(div);
    });

    showScreen('results');
}

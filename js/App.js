function getVisualSeatMapping() {
    let userSeat = gameState.mySeat;
    if (gameState.mode === 'insegnare' && gameState.mySeatsInsegnare.length > 0) {
        // In "Insegnare Bridge" il posto scelto dall'utente viene sempre mostrato in basso.
        userSeat = gameState.mySeatsInsegnare[0];
    } else if (!userSeat || userSeat === 'spectator') {
        userSeat = 'south';
    }
    const order = ['south', 'west', 'north', 'east'];
    let userIdx = order.indexOf(userSeat);
    if (userIdx === -1) userIdx = 0;

    return {
        bottom: order[userIdx],
        left: order[(userIdx + 1) % 4],
        top: order[(userIdx + 2) % 4],
        right: order[(userIdx + 3) % 4]
    };
}

function scheduleRobotMove(fn, delay) {
    if (robotTimer) clearTimeout(robotTimer);
    robotTimer = setTimeout(() => {
        robotTimer = null;
        fn();
    }, delay);
}

// FIX - app.js viene caricato PRIMA di multiplayer.js, quindi qui
// syncMultiplayerState non esiste ancora e la riga originale
// "setInterval(syncMultiplayerState, 1000)" esplodeva al caricamento con
// "Uncaught ReferenceError: syncMultiplayerState is not defined" e
// l'orologio di sincronizzazione non partiva mai.
// Ora l'avvio e' rimandato a quando TUTTI gli script sono caricati
// (DOMContentLoaded) e parte solo se la funzione esiste davvero.
function startMultiplayerSyncLoop() {
    if (typeof syncMultiplayerState !== 'function') return;
    setInterval(syncMultiplayerState, 1000);
    window.addEventListener('storage', syncMultiplayerState);
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMultiplayerSyncLoop);
} else {
    startMultiplayerSyncLoop();
}

function startGameSolo() {
    gameState.mode = 'solo';
    gameState.modeTitle = 'Gioca da Solo';
    gameState.mySeat = 'south';
    gameState.tableCreator = 'south';
    gameState.playersNames = { north: 'Robot N', east: 'Robot E', south: 'SUD', west: 'Robot O' };
    gameState.spectators = [];
    
    document.getElementById('start-panel').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    document.getElementById('btn-reveal').style.display = 'block';
    initNewBoard();
}

function startAmici() {
    gameState.mode = 'amici';
    gameState.modeTitle = 'Gioca con amici';
    openLobbyPanel();
}

function startInsegnare() {
    gameState.mode = 'insegnare';
    gameState.modeTitle = 'Insegnare Bridge';
    gameState.preparedHands = null;
    gameState.preparedHandsSource = '';
    updatePreparedHandsCommandVisibility();
    openLobbyPanel();
}

function updatePreparedHandsCommandVisibility() {
    const btn = document.getElementById('btn-load-prepared-file');
    if (!btn) return;
    btn.style.display = (gameState.mode === 'insegnare' && typeof isTeachingMaster === 'function' && isTeachingMaster()) ? 'block' : 'none';
}

function openLobbyPanel() {
    document.getElementById('start-panel').style.display = 'none';
    document.getElementById('lobby-panel').style.display = 'flex';
    document.getElementById('lobby-title').innerText = gameState.modeTitle;
    resetLobbyUI();
}

function resetLobbyUI() {
    document.getElementById('lobby-pin').value = '';
    document.getElementById('lobby-nick').value = '';
    document.getElementById('seat-selection').style.display = 'none';
    
    PLAYERS.forEach(seat => {
        const btn = document.getElementById(`seat-${seat}`);
        if (btn) {
            btn.classList.remove('selected', 'occupied');
            btn.disabled = false;
            btn.innerText = seat.toUpperCase();
        }
    });

    document.getElementById('btn-start-table').style.display = 'none';
    document.getElementById('btn-visitatore').style.display = 'none';
    
    gameState.tablePin = null;
    gameState.tableCreator = null;
    gameState.tableCreatorNick = null;
    gameState.playersNames = { north: '', east: '', south: '', west: '' };
    gameState.spectators = [];
    gameState.mySeatsInsegnare = [];
}

function goBackToStart() {
    document.getElementById('lobby-panel').style.display = 'none';
    document.getElementById('start-panel').style.display = 'flex';
}

async function confirmNickname() {
    const pin = document.getElementById('lobby-pin').value.trim();
    const nick = document.getElementById('lobby-nick').value.trim();
    if (!/^\d{5}$/.test(pin)) {
        alert('Inserisci un codice tavolo composto da esattamente 5 numeri.');
        return;
    }
    if (nick.length === 0) {
        alert('Inserisci un Nickname valido prima di proseguire.');
        return;
    }
    const confirmButton = document.querySelector('#lobby-panel button[onclick="confirmNickname()"]');
    if (confirmButton) confirmButton.disabled = true;
    try {
        if (typeof window.bridgeLoadTable !== 'function') throw new Error('Modulo Firebase non caricato. Ricarica il sito.');
        await window.bridgeLoadTable(pin);
        gameState.tablePin = pin;
        syncTableState();
        document.getElementById('seat-selection').style.display = 'block';
    } catch (error) {
        console.error(error);
        alert('Non riesco a collegarmi al tavolo. Verifica la connessione e le regole Firebase. Dettaglio: ' + error.message);
    } finally {
        if (confirmButton) confirmButton.disabled = false;
    }
}


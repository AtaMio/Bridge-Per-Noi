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

setInterval(syncMultiplayerState, 1000);
window.addEventListener('storage', syncMultiplayerState);

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

function confirmNickname() {
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
    
    gameState.tablePin = pin;
    syncTableState();
    document.getElementById('seat-selection').style.display = 'block';
}


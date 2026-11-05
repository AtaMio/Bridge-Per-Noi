function syncTableState() {
    if (!gameState.tablePin) return;
    const storageKey = `bridge_table_${gameState.tablePin}`;
    let tableData;
    try { tableData = JSON.parse(localStorage.getItem(storageKey)); } catch(e) { tableData = null; }

    if (!tableData || typeof tableData !== 'object' || !tableData.seats) {
        tableData = { creator: null, creatorNick: null, seats: { north: '', east: '', south: '', west: '' }, spectators: [], micStates: { north: false, east: false, south: false, west: false }, spectatorMicStates: {} };
        localStorage.setItem(storageKey, JSON.stringify(tableData));
    }

    gameState.tableCreator = tableData.creator;
    gameState.tableCreatorNick = tableData.creatorNick || null;
    gameState.spectators = tableData.spectators || [];
    gameState.micStates = tableData.micStates || { north: false, east: false, south: false, west: false };
    gameState.spectatorMicStates = tableData.spectatorMicStates || {};
    let occupiedCount = 0;

    PLAYERS.forEach(seat => {
        const btn = document.getElementById(`seat-${seat}`);
        const occupant = tableData.seats[seat] || '';

        if (occupant) {
            occupiedCount++;
            gameState.playersNames[seat] = occupant;
            if (btn) {
                btn.disabled = true;
                btn.classList.add('occupied');
                btn.innerText = `${seat.toUpperCase()} (${occupant})`;
            }
        } else {
            gameState.playersNames[seat] = '';
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('occupied');
                btn.innerText = seat.toUpperCase();
            }
        }
    });

    const btnVisitatore = document.getElementById('btn-visitatore');
    if (btnVisitatore) {
        btnVisitatore.style.display = (occupiedCount === 4 || gameState.mode === 'insegnare' || gameState.mode === 'amici') ? 'block' : 'none';
    }
}

function saveMultiplayerState() {
    if (!gameState.tablePin || gameState.mode === 'solo') return;
    const storageKey = `bridge_table_${gameState.tablePin}`;
    let tableData = JSON.parse(localStorage.getItem(storageKey)) || {};
    tableData.seats = gameState.playersNames;
    tableData.spectators = gameState.spectators;
    tableData.micStates = gameState.micStates;
    tableData.spectatorMicStates = gameState.spectatorMicStates;
    tableData.creator = gameState.tableCreator;
    tableData.creatorNick = gameState.tableCreatorNick;
    tableData.preparedHands = gameState.preparedHands;
    tableData.preparedHandsSource = gameState.preparedHandsSource;
    tableData.bids = gameState.bids;
    tableData.currentBidder = gameState.currentBidder;
    tableData.biddingEnded = gameState.biddingEnded;
    tableData.contract = gameState.contract;
    tableData.hands = gameState.hands;
    tableData.initialHands = gameState.initialHands;
    tableData.dealer = gameState.dealer;
    tableData.boardNum = gameState.boardNum;
    tableData.currentTurn = gameState.currentTurn;
    tableData.trick = gameState.trick;
    tableData.trickLedSuit = gameState.trickLedSuit;
    tableData.tricksWon = gameState.tricksWon;
    localStorage.setItem(storageKey, JSON.stringify(tableData));
}

function syncMultiplayerState() {
    if (!gameState.tablePin || gameState.mode === 'solo') return;
    const storageKey = `bridge_table_${gameState.tablePin}`;
    let tableData;
    try { tableData = JSON.parse(localStorage.getItem(storageKey)); } catch(e) {}
    if (!tableData) return;

    let updated = false;

    if (tableData.spectators && JSON.stringify(tableData.spectators) !== JSON.stringify(gameState.spectators)) {
        gameState.spectators = tableData.spectators;
        updated = true;
    }

    if (tableData.micStates && JSON.stringify(tableData.micStates) !== JSON.stringify(gameState.micStates)) {
        gameState.micStates = tableData.micStates;
        updated = true;
    }

    if (tableData.spectatorMicStates && JSON.stringify(tableData.spectatorMicStates) !== JSON.stringify(gameState.spectatorMicStates)) {
        gameState.spectatorMicStates = tableData.spectatorMicStates;
        updated = true;
    }

    if (tableData.preparedHands && JSON.stringify(tableData.preparedHands) !== JSON.stringify(gameState.preparedHands)) {
        gameState.preparedHands = tableData.preparedHands;
        gameState.preparedHandsSource = tableData.preparedHandsSource || '';
        updatePreparedHandsStatus();
        updated = true;
    }

    if (tableData.bids && JSON.stringify(tableData.bids) !== JSON.stringify(gameState.bids)) {
        gameState.bids = tableData.bids || [];
        gameState.currentBidder = tableData.currentBidder ?? gameState.currentBidder;
        gameState.biddingEnded = tableData.biddingEnded ?? gameState.biddingEnded;
        gameState.contract = tableData.contract ?? gameState.contract;
        if (tableData.hands) gameState.hands = tableData.hands;
        if (tableData.initialHands) gameState.initialHands = tableData.initialHands;
        gameState.dealer = tableData.dealer ?? gameState.dealer;
        gameState.boardNum = tableData.boardNum ?? gameState.boardNum;
        gameState.currentTurn = tableData.currentTurn ?? gameState.currentTurn;
        if (tableData.trick) gameState.trick = tableData.trick;
        gameState.trickLedSuit = tableData.trickLedSuit ?? gameState.trickLedSuit;
        if (tableData.tricksWon) gameState.tricksWon = tableData.tricksWon;
        updated = true;
    }

    if (updated) {
        updateUI();
    }
}

function handleNickKeyDown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        confirmNickname();
    }
}

function joinSeat(seat) {
    const nick = document.getElementById('lobby-nick').value.trim() || 'Giocatore';
    const storageKey = `bridge_table_${gameState.tablePin}`;
    let tableData = JSON.parse(localStorage.getItem(storageKey)) || { seats: {}, spectators: [], micStates: {} };
    if (!tableData.seats) tableData.seats = {};

    if (tableData.seats[seat] && tableData.seats[seat] !== nick) {
        alert('Questo posto è appena stato occupato!');
        syncTableState();
        return;
    }

    if (!tableData.creator) {
        tableData.creator = seat;
        gameState.tableCreator = seat;
    }
    if (!tableData.creatorNick) {
        tableData.creatorNick = nick;
        gameState.tableCreatorNick = nick;
    }

    const btn = document.getElementById(`seat-${seat}`);

    if (gameState.mode === 'insegnare') {
        if (btn.classList.contains('selected')) {
            btn.classList.remove('selected');
            tableData.seats[seat] = '';
            gameState.playersNames[seat] = '';
            gameState.mySeatsInsegnare = gameState.mySeatsInsegnare.filter(s => s !== seat);
        } else {
            btn.classList.add('selected');
            tableData.seats[seat] = nick;
            gameState.playersNames[seat] = nick;
            gameState.mySeatsInsegnare.push(seat);
        }
    } else {
        PLAYERS.forEach(s => {
            if (tableData.seats[s] === nick) tableData.seats[s] = '';
        });
        document.querySelectorAll('.seat-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        gameState.mySeat = seat;
        tableData.seats[seat] = nick;
        gameState.playersNames[seat] = nick;
    }

    localStorage.setItem(storageKey, JSON.stringify(tableData));

    const hasSelection = (gameState.mode === 'insegnare') ? gameState.mySeatsInsegnare.length > 0 : true;
    document.getElementById('btn-start-table').style.display = hasSelection ? 'block' : 'none';
}

function joinSpectator() {
    const nick = document.getElementById('lobby-nick').value.trim() || 'Visitatore';
    const storageKey = `bridge_table_${gameState.tablePin}`;
    let tableData = JSON.parse(localStorage.getItem(storageKey)) || { seats: {}, spectators: [], micStates: {} };
    if (!tableData.spectators) tableData.spectators = [];
    
    if (!tableData.spectators.includes(nick)) {
        tableData.spectators.push(nick);
    }
    
    gameState.spectators = tableData.spectators;
    gameState.mySeat = 'spectator';
    localStorage.setItem(storageKey, JSON.stringify(tableData));

    document.querySelectorAll('.seat-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('btn-visitatore').classList.add('selected');
    enterMultiplayerTable();
}

function enterMultiplayerTable() {
    document.getElementById('lobby-panel').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    document.getElementById('btn-reveal').style.display = (gameState.mode === 'insegnare' && isTeachingMaster()) ? 'block' : 'none';
    updatePreparedHandsCommandVisibility();
    updatePreparedHandsStatus();
    initNewBoard();
}

function quitToLobby() {
    if (gameState.tablePin) {
        const storageKey = `bridge_table_${gameState.tablePin}`;
        let tableData = JSON.parse(localStorage.getItem(storageKey));
        const nick = document.getElementById('lobby-nick').value.trim();
        
        if (tableData) {
            if (tableData.spectators && nick) {
                tableData.spectators = tableData.spectators.filter(s => s !== nick);
            }
            if (tableData.spectatorMicStates && nick) {
                delete tableData.spectatorMicStates[nick];
            }
            if (tableData.seats && gameState.mySeat !== 'spectator') {
                if (gameState.mode === 'insegnare') {
                    gameState.mySeatsInsegnare.forEach(s => tableData.seats[s] = '');
                } else if (gameState.mySeat) {
                    tableData.seats[gameState.mySeat] = '';
                }
            }
            const allSeatsEmpty = tableData.seats &&
                PLAYERS.every(seat => !(tableData.seats[seat] || '').trim());
            if (allSeatsEmpty) {
                // Il codice torna disponibile sul browser quando tutti i posti sono liberi.
                localStorage.removeItem(storageKey);
            } else {
                localStorage.setItem(storageKey, JSON.stringify(tableData));
            }
        }
    }

    if (gameState.localAudioStream) {
        gameState.localAudioStream.getTracks().forEach(track => track.stop());
        gameState.localAudioStream = null;
    }

    document.getElementById('game-container').style.display = 'none';
    document.getElementById('start-panel').style.display = 'flex';
}

async function toggleMicrophone(seat) {
    if (gameState.mode !== 'amici' && gameState.mode !== 'insegnare') return;
    if (seat !== gameState.mySeat && !gameState.mySeatsInsegnare.includes(seat)) return;

    const currentState = !!gameState.micStates[seat];
    if (!currentState) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            gameState.localAudioStream = stream;
            gameState.micStates[seat] = true;
        } catch (err) {
            alert("Impossibile accedere al microfono: " + err.message);
            return;
        }
    } else {
        if (gameState.localAudioStream) {
            gameState.localAudioStream.getTracks().forEach(track => track.stop());
            gameState.localAudioStream = null;
        }
        gameState.micStates[seat] = false;
    }

    saveMultiplayerState();
    updateUI();
}

async function toggleVisitorMicrophone(nick) {
    if (gameState.mode !== 'amici' && gameState.mode !== 'insegnare') return;
    const myNick = document.getElementById('lobby-nick').value.trim() || 'Visitatore';
    if (nick !== myNick) return;

    const currentState = !!gameState.spectatorMicStates[nick];
    if (!currentState) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            gameState.localAudioStream = stream;
            gameState.spectatorMicStates[nick] = true;
        } catch (err) {
            alert("Impossibile accedere al microfono: " + err.message);
            return;
        }
    } else {
        if (gameState.localAudioStream) {
            gameState.localAudioStream.getTracks().forEach(track => track.stop());
            gameState.localAudioStream = null;
        }
        gameState.spectatorMicStates[nick] = false;
    }

    saveMultiplayerState();
    updateUI();
}


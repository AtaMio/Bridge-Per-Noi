function isTeachingMaster() {
    if (gameState.mode !== 'insegnare') return false;
    const nick = (document.getElementById('lobby-nick')?.value || '').trim();
    return !!nick && !!gameState.tableCreatorNick && nick === gameState.tableCreatorNick;
}

function toggleRevealCards() {
    if (gameState.mode === 'amici') return;
    if (gameState.mode === 'insegnare' && !isTeachingMaster()) { alert('Solo il maestro che ha creato il tavolo può rivelare le carte.'); return; }
    gameState.revealed = !gameState.revealed;
    updateUI();
}

function nextBoard() {
    if (gameState.contract) {
        gameState.historyResults.push({
            board: gameState.boardNum,
            contract: gameState.contract,
            declarer: gameState.declarer ? gameState.declarer.toUpperCase() : '-',
            ns: gameState.tricksWon.ns,
            ew: gameState.tricksWon.ew
        });
        renderResultsTable();
    }
    if (gameState.mode === 'insegnare' && gameState.preparedHands) {
        const available = Object.keys(gameState.preparedHands).map(Number).sort((a,b)=>a-b);
        const nextPrepared = available.find(n => n > gameState.boardNum);
        if (nextPrepared !== undefined) gameState.boardNum = nextPrepared;
        else gameState.boardNum = gameState.boardNum + 1;
    } else {
        gameState.boardNum++;
    }
    initNewBoard();
}

function renderResultsTable() {
    let tbody = document.getElementById('results-tbody');
    tbody.innerHTML = '';
    gameState.historyResults.forEach(r => {
        let tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.board}</td><td>${r.contract}</td><td>${r.declarer}</td><td>${r.ns}</td><td>${r.ew}</td>`;
        tbody.appendChild(tr);
    });
}

function toggleResultsModal(show) {
    document.getElementById('results-modal').style.display = show ? 'flex' : 'none';
}

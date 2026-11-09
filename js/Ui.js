function createCardDOM(c, isVisible, onClickHandler, canClick) {
    let cardEl = document.createElement('div');
    cardEl.className = 'card';
    
    if (isVisible) {
        let isRed = ['♦', '♥'].includes(c.suit);
        let colorClass = isRed ? 'suit-red' : 'suit-black';
        if (canClick) cardEl.classList.add('card-clickable');
        
        let displayVal = (c.val === 'T') ? '10' : c.val;

        cardEl.innerHTML = `
            <div class="card-corner ${colorClass}">
                <span class="card-val">${displayVal}</span>
                <span class="card-suit-sm">${c.suit}</span>
            </div>
            <div class="card-suit-center ${colorClass}">${c.suit}</div>
            <div class="card-corner card-corner-bottom ${colorClass}">
                <span class="card-val">${displayVal}</span>
                <span class="card-suit-sm">${c.suit}</span>
            </div>
        `;
        if (onClickHandler) cardEl.onclick = onClickHandler;
    } else {
        cardEl.classList.add('card-back');
        cardEl.innerHTML = `<span class="card-back-pattern">🂠</span>`;
    }
    return cardEl;
}

// FIX - IL MORTO: il morto e' il partner del dichiarante e le sue carte le
// gioca il DICHIARANTE, non il morto stesso. Prima, in modalita' amici,
// isHumanTurn(morto) era false per il dichiarante, quindi le carte del
// morto venivano create SENZA onclick: il clic non veniva nemmeno
// accettato e la mano si bloccava al turno del morto. In solo funzionava
// perche' c'era un ramo speciale SUD/NORD. Ora la regola vale in tutte le
// modalita'. Il morto stesso NON puo' cliccare: se potessero farlo in due,
// due clic quasi simultanei giocherebbero due carte diverse.
function getDummySeatUI() {
    if (!gameState.declarer) return null;
    const declarerIdx = PLAYERS.indexOf(gameState.declarer);
    if (declarerIdx === -1) return null;
    return PLAYERS[(declarerIdx + 2) % 4];
}

function isHumanTurn(seat) {
    const dummy = getDummySeatUI();
    if (dummy && seat === dummy) {
        // Il morto lo gioca solo il dichiarante.
        if (gameState.mode === 'insegnare') {
            return gameState.mySeatsInsegnare.includes(gameState.declarer);
        }
        return gameState.mySeat === gameState.declarer;
    }
    if (gameState.mode === 'solo') {
        if (!gameState.biddingEnded) {
            return seat === 'south' && gameState.currentBidder === 2;
        } else {
            let currentSeat = PLAYERS[gameState.currentTurn];
            if (gameState.declarer === 'south' || gameState.declarer === 'north') {
                return (currentSeat === 'south' || currentSeat === 'north') && seat === currentSeat;
            } else {
                return currentSeat === 'south' && seat === 'south';
            }
        }
    } else if (gameState.mode === 'insegnare') {
        return gameState.mySeatsInsegnare.includes(seat);
    } else {
        return gameState.mySeat === seat;
    }
}

function updateUI() {
    document.getElementById('mode-display-title').innerText = gameState.modeTitle;
    const tablePinDisplay = document.getElementById('table-pin-display');
    const tablePinValue = document.getElementById('table-pin-value');
    if (tablePinDisplay && tablePinValue) {
        const hasTablePin = gameState.mode !== 'solo' && gameState.tablePin;
        tablePinDisplay.style.display = hasTablePin ? 'block' : 'none';
        tablePinValue.innerText = hasTablePin ? gameState.tablePin : '';
    }
    document.getElementById('board-num').innerText = gameState.boardNum;
    document.getElementById('board-dealer').innerText = PLAYERS[gameState.dealer].toUpperCase();

    // Aggiornamento Box Visitatori sotto la Bidding Box
    const vPanel = document.getElementById('visitor-panel');
    const vList = document.getElementById('visitor-list');
    if (vPanel && vList) {
        if (gameState.spectators && gameState.spectators.length > 0) {
            vPanel.style.display = 'block';
            const myNick = document.getElementById('lobby-nick').value.trim() || 'Visitatore';
            vList.innerHTML = gameState.spectators.map(s => {
                const isMicActive = !!gameState.spectatorMicStates[s];
                const icon = isMicActive ? '🎙️' : '🔇';
                const isSelf = s === myNick;
                const cursorStyle = isSelf ? 'cursor:pointer;' : 'cursor:default;';
                const titleText = isMicActive ? 'Microfono Attivo' : 'Microfono Disattivato';
                const safeNick = JSON.stringify(s).replace(/</g, '\u003c');
                return `👤 ${s} <button onclick='toggleVisitorMicrophone(${safeNick})' style="background:none; border:none; ${cursorStyle} font-size:1.05rem; margin-left:3px;" title="${titleText}">${icon}</button>`;
            }).join('<br>');
        } else {
            vPanel.style.display = 'none';
            vList.innerHTML = '';
        }
    }

    const visualMap = getVisualSeatMapping();
    const positions = ['bottom', 'top', 'left', 'right'];

    positions.forEach(pos => {
        const p = visualMap[pos];

        const titleSpan = document.getElementById(`title-${pos}`);
        const nameSpan = document.getElementById(`name-${pos}`);
        const micSpan = document.getElementById(`mic-${pos}`);

        if (titleSpan) titleSpan.innerText = p.toUpperCase();

        const isCreator = (p === gameState.tableCreator) ? ' ⭐' : '';
        const playerName = gameState.playersNames[p] ? `- ${gameState.playersNames[p]}` : '';
        if (nameSpan) nameSpan.innerText = `${playerName}${isCreator}`;

        // Gestione Microfono in "Gioca con Amici"
        if (micSpan) {
            if ((gameState.mode === 'amici' || gameState.mode === 'insegnare') && gameState.playersNames[p]) {
                const isMicActive = gameState.micStates[p];
                const icon = isMicActive ? '🎙️' : '🔇';
                const isSelf = (p === gameState.mySeat);
                const cursorStyle = isSelf ? 'cursor:pointer;' : 'cursor:default;';
                const titleText = isMicActive ? 'Microfono Attivo' : 'Microfono Disattivato';
                micSpan.innerHTML = `<button onclick="toggleMicrophone('${p}')" style="background:none; border:none; ${cursorStyle} font-size:1.05rem; margin-left:3px;" title="${titleText}">${icon}</button>`;
            } else {
                micSpan.innerHTML = '';
            }
        }

        let cardsDiv = document.getElementById(`cards-${pos}`);
        cardsDiv.innerHTML = '';

        let isMyPosition = false;
        if (gameState.mode === 'solo') {
            if (gameState.declarer === 'south' || gameState.declarer === 'north') {
                isMyPosition = (p === 'south' || p === 'north');
            } else {
                isMyPosition = (p === 'south');
            }
        } else if (gameState.mode === 'insegnare') {
            isMyPosition = gameState.mySeatsInsegnare.length > 0 && p === gameState.mySeatsInsegnare[0];
        } else {
            isMyPosition = (p === gameState.mySeat);
        }

        let isVisitor = (gameState.mySeat === 'spectator');
        let isVisible = isVisitor || isMyPosition || gameState.revealed;
        if (gameState.mode === 'amici' && !isMyPosition && gameState.mySeat !== 'spectator') {
            isVisible = false;
        }
        // FIX - IL MORTO E' SCOPERTO: a bridge, finita la licita, le carte
        // del morto stanno scoperte sul tavolo e le vedono tutti. Prima, in
        // modalita' amici, il dichiarante le vedeva coperte e non poteva
        // giocarle. Ora il morto e' sempre visibile dopo la licita.
        if (gameState.biddingEnded && p === getDummySeatUI()) {
            isVisible = true;
        }

        const suitOrder = (() => {
            const strain = gameState.contract && (gameState.contract.suit || gameState.contract.strain);
            const suitByStrain = { '♠':'♠', '♥':'♥', '♦':'♦', '♣':'♣', spades:'♠', hearts:'♥', diamonds:'♦', clubs:'♣' };
            const trump = suitByStrain[strain];
            const base = ['♠', '♥', '♦', '♣'];
            return trump ? [trump, ...base.filter(x => x !== trump)] : base;
        })();

        // La disposizione dipende dalla posizione VISIVA al tavolo, non dal punto cardinale reale: chi entra resta sempre in basso.
        // In alto/basso: quattro colonne, una per seme, con la carta maggiore allineata in cima.
        if ((pos === 'top' || pos === 'bottom') && isVisible) {
            cardsDiv.className = 'cards-container exposed-horizontal-hand';
            suitOrder.forEach(suit => {
                const col = document.createElement('div');
                col.className = 'exposed-suit-column';
                const cards = gameState.hands[p].map((card, idx) => ({card, idx}))
                    .filter(x => x.card.suit === suit)
                    .sort((a,b) => b.card.weight - a.card.weight);
                cards.forEach(item => {
                    const isTurnToPlay = gameState.biddingEnded && PLAYERS[gameState.currentTurn] === p && !gameState.isProcessingTrick;
                    const canClick = isTurnToPlay && isHumanTurn(p);
                    col.appendChild(createCardDOM(item.card, true, canClick ? () => selectCard(p, item.idx) : null, canClick));
                });
                cardsDiv.appendChild(col);
            });
        } else if ((pos === 'left' || pos === 'right') && isVisible) {
            // Ai lati: un seme per riga. A sinistra la sequenza maggiore-minore va da bordo verso centro; a destra è speculare.
            cardsDiv.className = `cards-container exposed-vertical-hand ${pos === 'left' ? 'faces-right' : 'faces-left'} ${pos === 'right' ? 'mirror-suit-order' : ''}`;
            suitOrder.forEach(suit => {
                const row = document.createElement('div');
                row.className = 'exposed-vertical-suit-row';
                const cards = gameState.hands[p].map((card, idx) => ({card, idx}))
                    .filter(x => x.card.suit === suit)
                    .sort((a,b) => b.card.weight - a.card.weight);
                cards.forEach(item => {
                    const isTurnToPlay = gameState.biddingEnded && PLAYERS[gameState.currentTurn] === p && !gameState.isProcessingTrick;
                    const canClick = isTurnToPlay && isHumanTurn(p);
                    row.appendChild(createCardDOM(item.card, true, canClick ? () => selectCard(p, item.idx) : null, canClick));
                });
                cardsDiv.appendChild(row);
            });
        } else {
            // Mani non scoperte e disposizione verticale standard restano invariate.
            cardsDiv.className = (pos === 'left' || pos === 'right') ? 'cards-container vertical-stack' : 'cards-container';
            gameState.hands[p].forEach((c, i) => {
                let isTurnToPlay = gameState.biddingEnded && (PLAYERS[gameState.currentTurn] === p) && !gameState.isProcessingTrick;
                let canClick = isTurnToPlay && isHumanTurn(p);
                let handler = canClick ? () => selectCard(p, i) : null;
                cardsDiv.appendChild(createCardDOM(c, isVisible, handler, canClick));
            });
        }

        let trickSlot = document.getElementById(`trick-${pos}`);
        if (trickSlot) {
            trickSlot.innerHTML = '';
            if (gameState.trick[p]) {
                trickSlot.appendChild(createCardDOM(gameState.trick[p], true, null, false));
            }
        }
    });

    renderBiddingHistory();
    renderBiddingBox();

    let totalTricks = gameState.tricksWon.ns + gameState.tricksWon.ew;
    if (totalTricks === 13 || (gameState.biddingEnded && !gameState.contract)) {
        showHandSummary();
    }
}

function renderBiddingHistory() {
    let grid = document.getElementById('history-grid');
    grid.innerHTML = '';

    const headers = ['O', 'N', 'E', 'S'];
    headers.forEach(h => {
        let headerDiv = document.createElement('div');
        headerDiv.className = 'history-header';
        headerDiv.innerText = h;
        grid.appendChild(headerDiv);
    });

    let dealerColOffset = (gameState.dealer === 3) ? 0 : gameState.dealer + 1;

    for (let i = 0; i < dealerColOffset; i++) {
        let emptyCell = document.createElement('div');
        emptyCell.className = 'history-cell cell-dash';
        emptyCell.innerText = '-';
        grid.appendChild(emptyCell);
    }

    gameState.bids.forEach(b => {
        let cell = document.createElement('div');
        cell.className = 'history-cell';
        cell.innerText = b;
        grid.appendChild(cell);
    });

    grid.scrollTop = grid.scrollHeight;
}

function renderBiddingBox() {
    let box = document.getElementById('bidding-box');
    box.innerHTML = '';

    const turnPlayer = PLAYERS[gameState.currentBidder];
    const turnPlayerName = gameState.playersNames[turnPlayer] || turnPlayer.toUpperCase();

    const isMyTurnToBid = isHumanTurn(turnPlayer) && !gameState.biddingEnded;

    let turnIndicator = document.getElementById('bidding-turn-indicator');
    if (turnIndicator) {
        if (gameState.biddingEnded) {
            turnIndicator.innerText = "Licitazione Conclusa";
            turnIndicator.style.color = "#e74c3c";
        } else if (!isMyTurnToBid) {
            turnIndicator.innerText = `Turno licita: ${turnPlayerName.toUpperCase()}`;
            turnIndicator.style.color = "#f39c12";
        } else {
            turnIndicator.innerText = `È il tuo turno (${turnPlayerName.toUpperCase()})`;
            turnIndicator.style.color = "#2ecc71";
        }
    }

    let matrixDiv = document.createElement('div');
    matrixDiv.className = 'bidding-matrix';

    for (let level = 1; level <= 7; level++) {
        STRAINS.forEach(strain => {
            let bidStr = level + strain;
            let btn = document.createElement('button');
            btn.className = 'bid-cell-btn';

            if (strain === '♣') btn.classList.add('strain-clubs');
            else if (strain === '♦') btn.classList.add('strain-diamonds');
            else if (strain === '♥') btn.classList.add('strain-hearts');
            else if (strain === '♠') btn.classList.add('strain-spades');
            else if (strain === 'NT') btn.classList.add('strain-nt');

            btn.innerText = bidStr;

            let valid = isMyTurnToBid && !gameState.biddingEnded && isValidBid(bidStr, gameState.currentBidder, gameState.bids);

            if (!valid) {
                btn.disabled = true;
                btn.style.opacity = '0.35';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.onclick = () => makeBid(bidStr);
            }
            matrixDiv.appendChild(btn);
        });
    }
    box.appendChild(matrixDiv);

    const btnPass = document.querySelector('.btn-pass-stylish');
    const btnDouble = document.querySelector('.btn-double');
    const btnRedouble = document.querySelector('.btn-redouble');
    const btnAlert = document.querySelector('.btn-alert');
    const btnUndo = document.querySelector('.btn-undo-bid');

    if (btnPass) {
        let canPass = isMyTurnToBid && !gameState.biddingEnded;
        btnPass.disabled = !canPass;
        btnPass.style.opacity = canPass ? '1' : '0.35';
        btnPass.style.cursor = canPass ? 'pointer' : 'not-allowed';
    }

    if (btnDouble) {
        let canDouble = isMyTurnToBid && !gameState.biddingEnded && isValidBid('X', gameState.currentBidder, gameState.bids);
        btnDouble.disabled = !canDouble;
        btnDouble.style.opacity = canDouble ? '1' : '0.35';
        btnDouble.style.cursor = canDouble ? 'pointer' : 'not-allowed';
    }

    if (btnRedouble) {
        let canRedouble = isMyTurnToBid && !gameState.biddingEnded && isValidBid('XX', gameState.currentBidder, gameState.bids);
        btnRedouble.disabled = !canRedouble;
        btnRedouble.style.opacity = canRedouble ? '1' : '0.35';
        btnRedouble.style.cursor = canRedouble ? 'pointer' : 'not-allowed';
    }

    if (btnAlert) {
        let canAlert = isMyTurnToBid && !gameState.biddingEnded;
        btnAlert.disabled = !canAlert;
        btnAlert.style.opacity = canAlert ? '1' : '0.35';
        btnAlert.style.cursor = canAlert ? 'pointer' : 'not-allowed';
    }

    if (btnUndo) {
        let canUndo = gameState.bids.length > 0 && !gameState.biddingEnded;
        btnUndo.disabled = !canUndo;
        btnUndo.style.opacity = canUndo ? '1' : '0.35';
        btnUndo.style.cursor = canUndo ? 'pointer' : 'not-allowed';
    }
}

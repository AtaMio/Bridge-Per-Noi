function makeBid(bidStr) {
    if (gameState.biddingEnded) return;

    if (!isValidBid(bidStr, gameState.currentBidder, gameState.bids)) {
        return;
    }

    gameState.bids.push(bidStr);
    gameState.currentBidder = (gameState.currentBidder + 1) % 4;
    checkBiddingEnd();
    saveMultiplayerState();
    updateUI();
    checkRobotTurn();
}

function userPass() { makeBid('Passo'); }
function userSpecialBid(type) { makeBid(type); }

function undoLastBid() {
    if (gameState.bids.length > 0 && !gameState.biddingEnded) {
        gameState.bids.pop();
        gameState.currentBidder = (gameState.dealer + gameState.bids.length) % 4;
        saveMultiplayerState();
        updateUI();
    }
}

function toggleAlert() { alert('Allert registrato.'); }

function checkBiddingEnd() {
    if (gameState.bids.length >= 4) {
        let last3 = gameState.bids.slice(-3);
        let last4 = gameState.bids.slice(-4);

        if ((gameState.bids.length === 4 && last4.every(b => b === 'Passo')) ||
            (gameState.bids.length > 4 && last3.every(b => b === 'Passo'))) {

            gameState.biddingEnded = true;
            let validBids = gameState.bids.filter(b => b !== 'Passo' && b !== 'X' && b !== 'XX');

            if (validBids.length === 0) {
                document.getElementById('status-bar').innerText = 'Tutti Passo - Smazzata licitata a vuoto.';
                showHandSummary();
                return;
            }

            gameState.contract = validBids[validBids.length - 1];
            let lastBidIdx = gameState.bids.lastIndexOf(gameState.contract);
            let declarerIdx = (gameState.dealer + lastBidIdx) % 4;
            gameState.declarer = PLAYERS[declarerIdx];

            gameState.trumpSuit = gameState.contract.includes('NT') ? 'NT' : gameState.contract.slice(-1);
            let leaderIdx = (declarerIdx + 1) % 4;
            gameState.currentTurn = leaderIdx;

            document.getElementById('status-bar').innerText = `Contratto: ${gameState.contract} (${gameState.declarer.toUpperCase()}). Muove ${PLAYERS[leaderIdx].toUpperCase()}`;
            document.getElementById('score-tracker').style.display = 'block';
            document.getElementById('trick-area').style.display = 'grid';
        }
    }
}

function selectCard(seat, idx) {
    if (!gameState.biddingEnded || gameState.isProcessingTrick) return;

    let turnPlayer = PLAYERS[gameState.currentTurn];
    // In multiplayer a client may play only cards belonging to its assigned seat.
    // This prevents one browser from acting on every hand just because it is the current turn.
    if (gameState.mode !== 'solo') {
        let ownsSeat = gameState.mySeat === seat ||
            (Array.isArray(gameState.mySeatsInsegnare) && gameState.mySeatsInsegnare.includes(seat));
        if (gameState.mode === 'amici') {
            const dummy = getDummySeat();
            if (dummy && seat === dummy) {
                // Le carte del morto le gioca solo il dichiarante, e solo dopo l'attacco.
                ownsSeat = gameState.mySeat === gameState.declarer && isDummyRevealed();
            }
        }
        if (!ownsSeat) return;
    }
    if (seat !== turnPlayer) return;

    let hand = gameState.hands[seat];
    if (!hand || !hand[idx]) return;
    let card = hand[idx];

    if (gameState.trickLedSuit) {
        let hasLedSuit = hand.some(c => c.suit === gameState.trickLedSuit);
        if (hasLedSuit && card.suit !== gameState.trickLedSuit) {
            alert(`Devi rispondere a seme (${gameState.trickLedSuit})!`);
            return;
        }
    }

    hand.splice(idx, 1);
    recordPlayedCard(seat, card);
    if (!gameState.trickLedSuit) {
        gameState.trickLedSuit = card.suit;
    }
    gameState.trick[seat] = card;
    gameState.currentTurn = (gameState.currentTurn + 1) % 4;

    saveMultiplayerState();
    updateUI();

    let playedCardsCount = PLAYERS.filter(p => gameState.trick[p] != null).length;
    if (playedCardsCount === 4) {
        gameState.isProcessingTrick = true;
        scheduleRobotMove(evaluateTrick, 1200);
    } else {
        checkRobotTurn();
    }
}

function evaluateTrick() {
    let winningPlayer = null;
    let highestRank = -1;

    if (gameState.trumpSuit && gameState.trumpSuit !== 'NT') {
        let trumpsPlayed = PLAYERS.filter(p => gameState.trick[p] && gameState.trick[p].suit === gameState.trumpSuit);
        if (trumpsPlayed.length > 0) {
            trumpsPlayed.forEach(p => {
                if (gameState.trick[p].weight > highestRank) {
                    highestRank = gameState.trick[p].weight;
                    winningPlayer = p;
                }
            });
        }
    }

    if (!winningPlayer) {
        let ledPlayed = PLAYERS.filter(p => gameState.trick[p] && gameState.trick[p].suit === gameState.trickLedSuit);
        ledPlayed.forEach(p => {
            if (gameState.trick[p].weight > highestRank) {
                highestRank = gameState.trick[p].weight;
                winningPlayer = p;
            }
        });
    }

    if (!winningPlayer) winningPlayer = PLAYERS[gameState.currentTurn];

    if (winningPlayer === 'north' || winningPlayer === 'south') {
        gameState.tricksWon.ns++;
    } else {
        gameState.tricksWon.ew++;
    }

    document.getElementById('tricks-ns').innerText = gameState.tricksWon.ns;
    document.getElementById('tricks-ew').innerText = gameState.tricksWon.ew;

    const completedTrick = {};
    PLAYERS.forEach(p => completedTrick[p] = gameState.trick[p]);
    gameState.trickHistory.push({
        leader: PLAYERS[(PLAYERS.indexOf(winningPlayer) + 1) % 4],
        ledSuit: gameState.trickLedSuit,
        cards: completedTrick,
        winner: winningPlayer
    });
    PLAYERS.forEach(p => gameState.trick[p] = null);
    gameState.trickLedSuit = null;

    let winnerIdx = PLAYERS.indexOf(winningPlayer);
    gameState.currentTurn = winnerIdx;
    gameState.isProcessingTrick = false;

    let totalTricks = gameState.tricksWon.ns + gameState.tricksWon.ew;
    if (totalTricks === 13) {
        document.getElementById('status-bar').innerText = `Smazzata Conclusa! Prese N/S: ${gameState.tricksWon.ns} | Prese E/O: ${gameState.tricksWon.ew}. Clicca "Prossima Smazzata" per continuare.`;
        showHandSummary();
    } else {
        document.getElementById('status-bar').innerText = `Presa vinta da ${winningPlayer.toUpperCase()}. Tocca a ${winningPlayer.toUpperCase()}`;
        checkRobotTurn();
    }

    saveMultiplayerState();
    updateUI();
}

function formatHandBySuitsHTML(hand) {
    if (!hand || !Array.isArray(hand)) return '';
    const suitSymbols = ['♠', '♥', '♦', '♣'];
    let html = '';
    suitSymbols.forEach(suit => {
        let isRed = ['♦', '♥'].includes(suit);
        let colorStyle = isRed ? 'color: #d90429;' : 'color: #ffffff;';
        let cardsOfSuit = hand.filter(c => c.suit === suit);
        let ranksStr = cardsOfSuit.map(c => c.val === 'T' ? '10' : c.val).join(' ');
        if (!ranksStr) ranksStr = '-';
        html += `<div style="font-family: monospace; font-size: 0.85rem;"><span style="${colorStyle} font-weight: bold;">${suit}</span> ${ranksStr}</div>`;
    });
    return html;
}

function calcBridgePoints(contract, declarerTricks) {
    if (!contract || contract === 'Passo') return 0;
    let level = parseInt(contract[0]);
    let strain = contract.slice(1);
    let target = 6 + level;
    let diff = declarerTricks - target;

    if (diff < 0) {
        return diff * 50;
    }

    let trickPts = 0;
    if (strain === '♣' || strain === '♦') {
        trickPts = level * 20;
    } else if (strain === '♥' || strain === '♠') {
        trickPts = level * 30;
    } else if (strain === 'NT') {
        trickPts = 40 + (level - 1) * 30;
    }

    let bonus = (trickPts >= 100) ? 300 : 50;
    if (level === 6) bonus += 500;
    if (level === 7) bonus += 1000;

    let overtrickPts = (strain === '♣' || strain === '♦') ? (diff * 20) : (diff * 30);

    return trickPts + bonus + overtrickPts;
}

function showHandSummary() {
    let box = document.getElementById('last-hand-box');
    let scoreDiv = document.getElementById('last-hand-score');
    let cardsDiv = document.getElementById('last-hand-cards');

    if (!box || !scoreDiv || !cardsDiv) return;

    box.style.display = 'block';

    let scoreHTML = '';
    if (!gameState.contract) {
        scoreHTML = '<strong>Esito:</strong> Tutti Passo (Smazzata a vuoto)';
    } else {
        let declarerTeam = (gameState.declarer === 'north' || gameState.declarer === 'south') ? 'NS' : 'EW';
        let declarerTricks = declarerTeam === 'NS' ? gameState.tricksWon.ns : gameState.tricksWon.ew;
        
        let level = parseInt(gameState.contract[0]);
        let target = 6 + level;
        let diff = declarerTricks - target;
        
        let bridgePoints = calcBridgePoints(gameState.contract, declarerTricks);
        let diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
        let ptsStr = bridgePoints >= 0 ? `+${bridgePoints}` : `${bridgePoints}`;

        scoreHTML = `
            <strong>Contratto:</strong> ${gameState.contract} (${gameState.declarer.toUpperCase()})<br>
            <strong>Prese N/S:</strong> ${gameState.tricksWon.ns} | <strong>E/O:</strong> ${gameState.tricksWon.ew}<br>
            <strong>Esito:</strong> ${diff >= 0 ? 'Mantenuto' : 'Fatto cadere'} (${diffStr})<br>
            <strong>Punteggio:</strong> <span style="color:#52b788; font-weight:bold;">${ptsStr} (${declarerTeam})</span>
        `;
    }
    scoreDiv.innerHTML = scoreHTML;

    let cardsHTML = '';
    const playerLabels = { north: 'NORD', east: 'EST', south: 'SUD', west: 'OVEST' };
    
    PLAYERS.forEach(p => {
        let pName = gameState.playersNames[p] ? ` (${gameState.playersNames[p]})` : '';
        let initialHand = gameState.initialHands ? gameState.initialHands[p] : [];
        cardsHTML += `
            <div style="margin-bottom: 8px;">
                <div style="font-weight: bold; color: #52b788; border-bottom: 1px solid #2d6a4f; margin-bottom: 2px;">
                    ${playerLabels[p]}${pName}
                </div>
                ${formatHandBySuitsHTML(initialHand)}
            </div>
        `;
    });
    cardsDiv.innerHTML = cardsHTML;
}


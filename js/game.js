function initNewBoard() {
    if (robotTimer) clearTimeout(robotTimer);
    gameState.bids = [];
    gameState.biddingEnded = false;
    gameState.contract = null;
    gameState.trumpSuit = null;
    gameState.declarer = null;
    gameState.revealed = false;
    gameState.tricksWon = { ns: 0, ew: 0 };
    gameState.trickLedSuit = null;
    gameState.isProcessingTrick = false;
    gameState.playedCards = [];
    gameState.trickHistory = [];
    gameState.robotMemory = {};
    PLAYERS.forEach(p => gameState.trick[p] = null);

    document.getElementById('score-tracker').style.display = 'none';
    document.getElementById('trick-area').style.display = 'none';
    document.getElementById('tricks-ns').innerText = '0';
    document.getElementById('tricks-ew').innerText = '0';
    
    let lastBox = document.getElementById('last-hand-box');
    if (lastBox) lastBox.style.display = 'none';

    const prepared = (typeof getPreparedHandForBoard === 'function')
        ? getPreparedHandForBoard(gameState.boardNum)
        : null;

    if (prepared) {
        PLAYERS.forEach(p => {
            gameState.hands[p] = JSON.parse(JSON.stringify(prepared[p]));
            sortHand(gameState.hands[p]);
        });
    } else {
        if (typeof getPreparedHandForBoard === 'function' && gameState.mode === 'insegnare' && gameState.preparedHands) {
            const available = Object.keys(gameState.preparedHands).map(Number).sort((a,b)=>a-b);
            const next = available.find(n => n >= gameState.boardNum);
            if (next !== undefined && next !== gameState.boardNum) {
                gameState.boardNum = next;
                return initNewBoard();
            }
            alert('La mano preparata n°' + gameState.boardNum + ' non è presente. Verrà usata una smazzata casuale.');
        }

        let deck = [];
        SUITS.forEach(suit => {
            RANKS.forEach(val => deck.push({ suit, val, weight: getRankWeight(val) }));
        });
        deck.sort(() => Math.random() - 0.5);

        PLAYERS.forEach((p, idx) => {
            gameState.hands[p] = deck.slice(idx * 13, (idx + 1) * 13);
            sortHand(gameState.hands[p]);
        });
    }
    gameState.initialHands = JSON.parse(JSON.stringify(gameState.hands));
    if (typeof updatePreparedHandsStatus === 'function') updatePreparedHandsStatus();

    gameState.dealer = (gameState.boardNum - 1) % 4;
    gameState.currentBidder = gameState.dealer;
    document.getElementById('status-bar').innerText = `Board N°${gameState.boardNum} - Mazziere: ${PLAYERS[gameState.dealer].toUpperCase()}. Fase di licitazione.`;

    saveMultiplayerState();
    updateUI();
    checkRobotTurn();
}

function getRankWeight(v) {
    const map = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14};
    return map[v] || 0;
}

function sortHand(hand) {
    const suitOrder = {'♠': 0, '♥': 1, '♦': 2, '♣': 3};
    hand.sort((a, b) => {
        if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
        return b.weight - a.weight;
    });
}

/* --- LOGICA DI LICITA CORRETTA E RIGOROSA --- */

function getBidValue(bidStr) {
    if (!bidStr || bidStr === 'Passo' || bidStr === 'X' || bidStr === 'XX') return 0;
    let level = parseInt(bidStr[0]);
    let strain = bidStr.slice(1);
    let strainMap = {'♣': 1, '♦': 2, '♥': 3, '♠': 4, 'NT': 5};
    return level * 10 + (strainMap[strain] || 0);
}

function getHighestBidInfo(bids) {
    if (!bids || bids.length === 0) return null;
    let dealer = gameState.dealer;
    for (let i = bids.length - 1; i >= 0; i--) {
        let b = bids[i];
        if (b !== 'Passo' && b !== 'X' && b !== 'XX') {
            let bidderIdx = (dealer + i) % 4;
            return { bid: b, bidderIdx: bidderIdx, val: getBidValue(b), index: i };
        }
    }
    return null;
}

function getHighestBid() {
    let info = getHighestBidInfo(gameState.bids);
    return info ? info.bid : null;
}

function isValidBid(bidStr, bidderIdx, bidsHistory) {
    if (bidStr === 'Passo') return true;

    let highest = getHighestBidInfo(bidsHistory);

    if (bidStr !== 'X' && bidStr !== 'XX') {
        let val = getBidValue(bidStr);
        let highestVal = highest ? highest.val : 0;
        return val > highestVal;
    }

    if (bidStr === 'X') {
        if (!highest) return false;
        let isOpponent = (bidderIdx % 2) !== (highest.bidderIdx % 2);
        if (!isOpponent) return false;

        for (let i = highest.index + 1; i < bidsHistory.length; i++) {
            if (bidsHistory[i] !== 'Passo') return false;
        }
        return true;
    }

    if (bidStr === 'XX') {
        if (!highest) return false;
        let lastXIdx = -1;
        let lastXBidder = -1;
        let dealer = gameState.dealer;

        for (let i = bidsHistory.length - 1; i >= highest.index; i--) {
            if (bidsHistory[i] === 'X') {
                lastXIdx = i;
                lastXBidder = (dealer + i) % 4;
                break;
            }
            if (bidsHistory[i] !== 'Passo') break;
        }
        if (lastXIdx === -1) return false;
        let isOpponentDouble = (bidderIdx % 2) !== (lastXBidder % 2);
        if (!isOpponentDouble) return false;

        for (let i = lastXIdx + 1; i < bidsHistory.length; i++) {
            if (bidsHistory[i] !== 'Passo') return false;
        }
        return true;
    }

    return false;
}

/* --- FINE LOGICA LICITA --- */


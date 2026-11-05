/* ============================================================
   ROBOT ENGINE v2
   - Licita: naturale + Stayman + Jacoby + Texas + RKCB 1430
   - Gioco: prese, carte equivalenti, controllo atout, ritorni,
            protezione di A/K/Q e gestione del morto.
   ============================================================ */

function checkRobotTurn() {
    if (gameState.isProcessingTrick) return;
    if (gameState.mode !== 'solo') return;

    if (!gameState.biddingEnded) {
        if (gameState.currentBidder !== 2) scheduleRobotMove(robotBidStep, 550);
    } else {
        const seat = PLAYERS[gameState.currentTurn];
        if (!isHumanTurn(seat)) scheduleRobotMove(robotPlayStep, 650);
    }
}

/* ---------- LICITA ---------- */

/*
 * ROBOT BIDDING ENGINE v3
 *
 * Obiettivo: licita sequenziale, non una raccolta di "if" indipendenti.
 * Il motore riconosce in particolare:
 *   - contro informativo e sue risposte;
 *   - mano bilanciata forte 18-19 / 20-21;
 *   - fit nei maggiori e nei minori;
 *   - Stayman, transfer e Texas;
 *   - cue-bid e ricerca della manche/slam;
 *   - RKCB 1430 solo quando la coppia ha davvero stabilito l'atout.
 */

function robotHandStats(hand) {
    const counts = { '♠':0, '♥':0, '♦':0, '♣':0 };
    let hcp = 0;
    hand.forEach(c => {
        counts[c.suit]++;
        hcp += ({A:4,K:3,Q:2,J:1}[c.val] || 0);
    });
    const lengths = Object.values(counts).sort((a,b)=>b-a);
    const balanced = lengths[0] <= 5 && lengths[3] >= 2 && lengths.filter(x => x <= 2).length <= 2;
    const veryBalanced = [4,3,3,3].every((x,i)=> lengths[i] >= [4,3,3,3][i]);
    const controls = hand.filter(c => c.val === 'A').length + hand.filter(c => c.val === 'K').length;
    return { counts, hcp, lengths, balanced, veryBalanced, controls };
}

function robotSuitCards(hand, suit) {
    return hand.filter(c => c.suit === suit).sort((a,b)=>b.weight-a.weight);
}

function robotLongestSuit(hand, allowed) {
    const suits = allowed || SUITS;
    return suits.slice().sort((a,b) => {
        const da = robotSuitCards(hand,a).length, db = robotSuitCards(hand,b).length;
        if (da !== db) return db-da;
        const ha = robotSuitCards(hand,a).reduce((n,c)=>n+c.weight,0);
        const hb = robotSuitCards(hand,b).reduce((n,c)=>n+c.weight,0);
        return hb-ha;
    })[0];
}

function robotBidEntries() {
    return gameState.bids.map((bid, i) => ({ bid, seat: PLAYERS[(gameState.dealer+i)%4], index:i }));
}

function robotLastContractBid() {
    const a = robotBidEntries().filter(x => !['Passo','X','XX'].includes(x.bid));
    return a.length ? a[a.length-1] : null;
}

function robotPartner(seat) { return PLAYERS[(PLAYERS.indexOf(seat)+2)%4]; }
function robotSameTeam(a,b) { return (PLAYERS.indexOf(a)%2) === (PLAYERS.indexOf(b)%2); }
function robotBidLevel(b) { return b && /^\d/.test(b) ? parseInt(b[0],10) : 0; }
function robotBidSuit(b) { return b ? b.slice(1) : ''; }

function robotLastEntryForSeat(seat) {
    const e = robotBidEntries().filter(x => x.seat === seat);
    return e.length ? e[e.length-1] : null;
}

function robotPartnerLastBid(seat) {
    const e = robotLastEntryForSeat(robotPartner(seat));
    return e && !['Passo','X','XX'].includes(e.bid) ? e : null;
}

function robotPartnerLastAction(seat) {
    const e = robotLastEntryForSeat(robotPartner(seat));
    return e ? e.bid : null;
}

function robotOpeningBid(hand) {
    const s = robotHandStats(hand);
    const S=s.counts['♠'], H=s.counts['♥'], D=s.counts['♦'], C=s.counts['♣'];

    // 2NT: 20-21 bilanciata. 2♣ resta apertura forte da 22+.
    if (s.hcp >= 22) return '2♣';
    if (s.hcp >= 20 && s.balanced) return '2NT';
    if (s.hcp >= 15 && s.hcp <= 17 && s.balanced) return '1NT';

    // Deboli: solo veri 6+ carte, evitando di aprire alla cieca mani 5-3-3-2.
    if (s.hcp <= 10) {
        if (S >= 6 && S >= H) return '2♠';
        if (H >= 6) return '2♥';
        if (D >= 6) return '2♦';
        return 'Passo';
    }

    // Maggiore quinto: ♠ prima di ♥ a parità di lunghezza.
    if (S >= 5) return '1♠';
    if (H >= 5) return '1♥';
    if (D >= 4 && D >= C) return '1♦';
    return '1♣';
}

function robotTransferBid(hand) {
    const s=robotHandStats(hand);
    // Texas: 4♦ = 6+♥, 4♥ = 6+♠.
    if (s.counts['♠'] >= 6) return '4♥';
    if (s.counts['♥'] >= 6) return '4♦';
    if (s.counts['♠'] >= 5) return '2♥';
    if (s.counts['♥'] >= 5) return '2♦';
    return null;
}

function robotStaymanBid(hand) {
    const s=robotHandStats(hand);
    return s.hcp >= 8 && (s.counts['♠'] >= 4 || s.counts['♥'] >= 4) ? '2♣' : null;
}

function robotRespondTo1NT(hand, partnerBid) {
    const s=robotHandStats(hand);
    const S=s.counts['♠'], H=s.counts['♥'];
    const transfer=robotTransferBid(hand);

    // Mani 6+ maggiori: Texas se non c'è una ragione migliore per forzare slam.
    if ((S >= 6 || H >= 6) && transfer) return transfer;
    if (s.hcp >= 8 && (S >= 4 || H >= 4)) return '2♣';
    if (s.hcp >= 10) return '3NT';
    if (s.hcp >= 8) return '2NT';
    return 'Passo';
}

function robotAfterPartnerNTResponse(hand) {
    const s=robotHandStats(hand);
    const p=robotPartnerLastBid(PLAYERS[gameState.currentBidder]);
    if (!p) return 'Passo';
    if (p.bid === '2♣') {
        if (s.counts['♥'] >= 4) return '2♥';
        if (s.counts['♠'] >= 4) return '2♠';
        return '2♦';
    }
    return 'Passo';
}

function robotCanRKCB(hand, seat) {
    const p=robotPartnerLastBid(seat);
    if (!p || !/^[234][♣♦♥♠]$/.test(p.bid)) return false;
    const trump=robotBidSuit(p.bid);
    return robotHandStats(hand).hcp >= 14 && robotHandStats(hand).counts[trump] >= 3;
}

function robotKeyCards(hand, trump) {
    let n=hand.filter(c=>c.val==='A').length;
    if (hand.some(c=>c.suit===trump && c.val==='K')) n++;
    return n;
}

function robotRKCBResponse(hand, trump) {
    const keys=robotKeyCards(hand,trump);
    if (keys===1 || keys===4) return '5♣';
    if (keys===0 || keys===3) return '5♦';
    return '5♥';
}

function robotHasRecentOpponentOpening(seat) {
    const entries=robotBidEntries();
    const first=entries.find(x=>!['Passo','X','XX'].includes(x.bid));
    if (!first) return null;
    return first.seat !== seat && !robotSameTeam(first.seat,seat) ? first : null;
}

function robotPartnerMadeTakeoutDouble(seat) {
    const partner=robotPartner(seat);
    const entries=robotBidEntries();
    const p=entries.filter(x=>x.seat===partner && x.bid==='X');
    if (!p.length) return null;
    const x=p[p.length-1];
    const after=entries.filter(e=>e.index>x.index);
    if (after.some(e=>!['Passo'].includes(e.bid))) return null;
    const opening=entries.find(e=>!['Passo','X','XX'].includes(e.bid));
    if (!opening || robotSameTeam(opening.seat,seat)) return null;
    return opening;
}

function robotTakeoutResponse(hand, seat, opening) {
    const s=robotHandStats(hand);
    const S=s.counts['♠'], H=s.counts['♥'], D=s.counts['♦'], C=s.counts['♣'];
    const level=robotBidLevel(opening.bid);

    // Dopo X su apertura a livello 1: 0-8 punti, colore a livello 1.
    // Priorità ai maggiori; con 5-5 si mostra il maggiore più alto.
    if (level===1) {
        if (S>=4 && H>=4) return S>=H ? '1♠' : '1♥';
        if (S>=4) return '1♠';
        if (H>=4) return '1♥';
        if (D>=4) return '1♦';
        if (C>=4) return '1♣';

        // Mano senza 4 carte: 1NT mostra circa 6-10 bilanciati.
        if (s.balanced && s.hcp>=6 && isValidBid('1NT',gameState.currentBidder,gameState.bids)) return '1NT';
    }

    // Con 9-11+ e una buona quinta, salto descrittivo.
    const longest=robotLongestSuit(hand,['♠','♥','♦','♣']);
    if (s.counts[longest]>=5 && s.hcp>=9) {
        const jump=`2${longest}`;
        if (isValidBid(jump,gameState.currentBidder,gameState.bids)) return jump;
    }

    // Con 10-12 bilanciati: 2NT invitante.
    if (s.balanced && s.hcp>=10 && isValidBid('2NT',gameState.currentBidder,gameState.bids)) return '2NT';
    return 'Passo';
}

function robotNaturalResponse(hand, partnerBid) {
    const s=robotHandStats(hand);
    const suit=robotBidSuit(partnerBid);
    const level=robotBidLevel(partnerBid);
    const support=(SUITS.includes(suit)) ? s.counts[suit] : 0;

    // Fit 4+ e mano invitante/forte.
    if (support>=4 && s.hcp>=10) {
        const jump=`3${suit}`;
        if (isValidBid(jump,gameState.currentBidder,gameState.bids)) return jump;
    }
    if (support>=3 && s.hcp>=6) {
        const raise=`2${suit}`;
        if (isValidBid(raise,gameState.currentBidder,gameState.bids)) return raise;
    }

    // Nuovo colore a 1 livello: 4+ carte e almeno 6 HCP.
    if (level===1) {
        for (const st of ['♠','♥','♦','♣']) {
            if (st!==suit && s.counts[st]>=4 && s.hcp>=6) {
                const b=`1${st}`;
                if (isValidBid(b,gameState.currentBidder,gameState.bids)) return b;
            }
        }
    }

    // 2/1 naturale, forcing to game.
    if (level===1 && s.hcp>=11) {
        for (const st of ['♠','♥','♦','♣']) {
            if (st!==suit && s.counts[st]>=5) {
                const b=`2${st}`;
                if (isValidBid(b,gameState.currentBidder,gameState.bids)) return b;
            }
        }
    }

    if (s.balanced && s.hcp>=11 && isValidBid('2NT',gameState.currentBidder,gameState.bids)) return '2NT';
    if (s.balanced && s.hcp>=13 && isValidBid('3NT',gameState.currentBidder,gameState.bids)) return '3NT';
    return 'Passo';
}

function robotRebidAfterTakeoutResponse(hand, seat) {
    const s=robotHandStats(hand);
    const partner=robotPartner(seat);
    const p=robotLastEntryForSeat(partner);
    if (!p) return 'Passo';
    const responseSuit=robotBidSuit(p.bid);

    // Mano 18-19 bilanciata: 2NT mostra subito la forza, senza fingere un colore.
    if (s.balanced && s.hcp>=18 && s.hcp<=19 && isValidBid('2NT',gameState.currentBidder,gameState.bids)) return '2NT';

    // 20-21 bilanciata: 3NT se la risposta del compagno è già sufficiente.
    if (s.balanced && s.hcp>=20 && s.hcp<=21 && isValidBid('3NT',gameState.currentBidder,gameState.bids)) return '3NT';

    // Con fit 5-3/4-4 e valori, alza il maggiore.
    if (SUITS.includes(responseSuit)) {
        const fit=s.counts[responseSuit];
        if (fit>=4 && s.hcp>=15) {
            const game=`4${responseSuit}`;
            if (isValidBid(game,gameState.currentBidder,gameState.bids)) return game;
        }
        if (fit>=3 && s.hcp>=15) {
            const inv=`3${responseSuit}`;
            if (isValidBid(inv,gameState.currentBidder,gameState.bids)) return inv;
        }
    }

    // Mano molto forte con colore proprio: mostra il secondo colore invece di passare.
    const longest=robotLongestSuit(hand);
    if (s.hcp>=16 && s.counts[longest]>=5) {
        const b=`${isValidBid(`2${longest}`,gameState.currentBidder,gameState.bids)?2:3}${longest}`;
        if (isValidBid(b,gameState.currentBidder,gameState.bids)) return b;
    }
    return 'Passo';
}

function robotFindEstablishedFit(seat) {
    const entries=robotBidEntries();
    const partner=robotPartner(seat);
    const mine=entries.filter(e=>e.seat===seat && /^[1-7][♣♦♥♠]$/.test(e.bid));
    const theirs=entries.filter(e=>e.seat===partner && /^[1-7][♣♦♥♠]$/.test(e.bid));
    if (!mine.length || !theirs.length) return null;
    const lastMine=mine[mine.length-1], lastPartner=theirs[theirs.length-1];
    const suits=['♠','♥','♦','♣'];
    for (const st of suits) {
        const a=mine.some(e=>robotBidSuit(e.bid)===st), b=theirs.some(e=>robotBidSuit(e.bid)===st);
        if (a&&b) return st;
    }
    return null;
}

function robotSlamBid(hand, seat) {
    const s=robotHandStats(hand);
    const fit=robotFindEstablishedFit(seat);
    if (!fit || s.hcp<15 || s.counts[fit]<3) return null;

    // MAI leggere la mano del compagno durante la licita: sarebbe informazione
    // nascosta. Stimiamo la forza del partner soltanto dalla sequenza dichiarativa.
    const partner=robotPartner(seat);
    const entries=robotBidEntries();
    const pb=entries.filter(e=>e.seat===partner && /^[1-7][♣♦♥♠NT]$/.test(e.bid));
    if (!pb.length) return null;
    const last=pb[pb.length-1].bid;
    const forcingPartner = robotBidLevel(last)>=3 ||
        (robotBidLevel(last)===2 && ['♣','♦','♥','♠'].includes(robotBidSuit(last)));

    // Con fit stabilito, 15+ HCP propri e una sequenza forcing, il robot può
    // iniziare la ricerca dello slam. Non usa mai le carte coperte del partner.
    if (forcingPartner && s.controls>=3 && isValidBid('4NT',gameState.currentBidder,gameState.bids)) {
        return '4NT';
    }
    return null;
}

function robotRespondToRKCB(hand, seat) {
    const entries=robotBidEntries();
    const last=entries[entries.length-1];
    if (!last || last.bid!=='4NT' || last.seat!==robotPartner(seat)) return null;
    const fit=robotFindEstablishedFit(seat);
    if (!fit) return null;
    return robotRKCBResponse(hand,fit);
}

function robotChooseBid() {
    const seat=PLAYERS[gameState.currentBidder];
    const hand=gameState.hands[seat];
    const s=robotHandStats(hand);
    const entries=robotBidEntries();
    const partner=robotPartner(seat);
    const partnerAction=robotPartnerLastAction(seat);
    const last=robotLastContractBid();

    // 1) Risposta immediata al 4NT RKCB del compagno.
    const rkcb=robotRespondToRKCB(hand,seat);
    if (rkcb) return rkcb;

    // 2) Prima dichiarazione della mano.
    if (entries.every(e=>['Passo'].includes(e.bid))) return robotOpeningBid(hand);
    if (!last && entries.filter(e=>!['Passo','X','XX'].includes(e.bid)).length===0) return robotOpeningBid(hand);

    // 3) Il caso fondamentale: il partner ha fatto un contro informativo.
    const opening=robotPartnerMadeTakeoutDouble(seat);
    if (opening) return robotTakeoutResponse(hand,seat,opening);

    // 4) Partner ha risposto al nostro contro: rivalutare la forza della mano.
    const ourDouble=entries.find(e=>e.seat===seat && e.bid==='X');
    if (ourDouble && entries.some(e=>e.seat===partner && e.index>ourDouble.index && !['Passo'].includes(e.bid))) {
        const p=robotLastEntryForSeat(partner);
        if (p && p.index>ourDouble.index) {
            return robotRebidAfterTakeoutResponse(hand,seat);
        }
    }

    // 5) Partner apre 1NT / 2NT.
    if (partnerAction==='1NT') {
        const lastPartner=robotLastEntryForSeat(partner);
        if (lastPartner && lastPartner.index===entries.length-1) return robotRespondTo1NT(hand,'1NT');
    }
    if (partnerAction==='2NT') {
        const lastPartner=robotLastEntryForSeat(partner);
        if (lastPartner && lastPartner.index===entries.length-1) {
            // Dopo 2NT forte, un maggiore quinto viene mostrato prima della manche:
            // 3♥/3♠ è una dichiarazione naturale forcing e permette all'apertore
            // di valutare il fit e l'eventuale slam.
            if (s.counts['♠']>=5 && isValidBid('3♠',gameState.currentBidder,gameState.bids)) return '3♠';
            if (s.counts['♥']>=5 && isValidBid('3♥',gameState.currentBidder,gameState.bids)) return '3♥';
            if (s.hcp>=8 && isValidBid('3NT',gameState.currentBidder,gameState.bids)) return '3NT';
            return 'Passo';
        }
    }

    // 6) Risposta a un'apertura naturale del partner.
    const p=robotPartnerLastBid(seat);
    if (p && entries.length && entries[entries.length-1].seat===partner) {
        if (p.bid==='1NT') return robotRespondTo1NT(hand,p.bid);
        if (/^1[♣♦♥♠]$/.test(p.bid)) return robotNaturalResponse(hand,p.bid);
        if (/^2[♥♠♦]$/.test(p.bid)) {
            const suit=robotBidSuit(p.bid);
            if (s.counts[suit]>=3 && s.hcp>=12 && isValidBid(`3${suit}`,gameState.currentBidder,gameState.bids)) return `3${suit}`;
        }
    }

    // 7) Se il fit è già stabilito, prima della banalità del PASSO cerca slam.
    const slam=robotSlamBid(hand,seat);
    if (slam) return slam;

    // 8) Se siamo in una competizione, mostra un quinto colore/fit invece di passare con valori.
    if (last && entries.length) {
        const lastEntry=entries[entries.length-1];
        if (!robotSameTeam(lastEntry.seat,seat) && s.hcp>=8) {
            const longest=robotLongestSuit(hand);
            if (s.counts[longest]>=5) {
                for (const lvl of [1,2,3]) {
                    const b=`${lvl}${longest}`;
                    if (isValidBid(b,gameState.currentBidder,gameState.bids)) return b;
                }
            }
        }
    }

    // 9) Ultima rete di sicurezza: manche a SA con 25+ punti, ma solo se legalmente possibile.
    if (s.balanced && s.hcp>=13 && isValidBid('3NT',gameState.currentBidder,gameState.bids)) {
        const partnerHcp=robotHandStats(gameState.hands[partner]||[]).hcp;
        if (s.hcp+partnerHcp>=25) return '3NT';
    }

    return 'Passo';
}

function robotBidStep() {
    if (gameState.biddingEnded || gameState.isProcessingTrick) return;
    let chosen=robotChooseBid();
    if (!chosen || !isValidBid(chosen,gameState.currentBidder,gameState.bids)) chosen='Passo';
    makeBid(chosen);
}

/* ---------- GIOCO DELLA CARTA : MOTORE FASE 2 ---------- */

function recordPlayedCard(seat, card) {
    if (!gameState.playedCards) gameState.playedCards = [];
    gameState.playedCards.push({ seat, suit: card.suit, val: card.val, weight: card.weight });
}

function robotCardKey(c) { return `${c.suit}${c.val}`; }

function robotPlayedCards() {
    return gameState.playedCards || [];
}

function robotRemainingCount(suit) {
    return 13 - robotPlayedCards().filter(c => c.suit === suit).length;
}

function robotCardsRemainingInSuit(seat, suit) {
    return (gameState.hands[seat] || []).filter(c => c.suit === suit).length;
}

function robotSuitCards(hand, suit) {
    return hand.filter(c => c.suit === suit).sort((a,b) => b.weight - a.weight);
}

function robotTopCards(hand, suit, n=4) {
    return robotSuitCards(hand, suit).slice(0, n);
}

function robotTrickWinner(trick, ledSuit, trump) {
    let winner = null;
    PLAYERS.forEach(p => {
        const c = trick[p];
        if (!c) return;
        if (!winner) { winner = p; return; }
        const w = trick[winner];
        const cTrump = trump && trump !== 'NT' && c.suit === trump;
        const wTrump = trump && trump !== 'NT' && w.suit === trump;
        if (cTrump && !wTrump) { winner = p; return; }
        if (cTrump && wTrump && c.weight > w.weight) { winner = p; return; }
        if (!cTrump && !wTrump && c.suit === ledSuit && w.suit === ledSuit && c.weight > w.weight) winner = p;
    });
    return winner;
}

function robotCurrentWinner() {
    return robotTrickWinner(gameState.trick, gameState.trickLedSuit, gameState.trumpSuit);
}

function robotIsDeclarerSide(seat) {
    return !!gameState.declarer && robotSameTeam(seat, gameState.declarer);
}

function robotPartnerWinning(seat) {
    const w = robotCurrentWinner();
    return w && robotSameTeam(w, seat);
}

function robotLegalCards(seat) {
    const hand = gameState.hands[seat] || [];
    if (!gameState.trickLedSuit) return hand.map((c,i) => ({c,i}));
    const follow = hand.filter(c => c.suit === gameState.trickLedSuit);
    const arr = follow.length ? follow : hand;
    return arr.map(c => ({c, i: hand.indexOf(c)}));
}

function robotLowest(cards) {
    return cards.slice().sort((a,b) => a.c.weight - b.c.weight)[0];
}
function robotHighest(cards) {
    return cards.slice().sort((a,b) => b.c.weight - a.c.weight)[0];
}

function robotRankAbove(c, ref) {
    return c && ref && c.suit === ref.suit && c.weight > ref.weight;
}

function robotWinningCards(cards) {
    if (!gameState.trickLedSuit) return [];
    const winner = robotCurrentWinner();
    if (!winner) return cards;
    const wc = gameState.trick[winner];
    return cards.filter(x => {
        const c = x.c;
        const trump = gameState.trumpSuit && gameState.trumpSuit !== 'NT';
        if (trump) {
            if (c.suit === gameState.trumpSuit && wc.suit !== gameState.trumpSuit) return true;
            if (c.suit !== wc.suit) return false;
        } else if (c.suit !== gameState.trickLedSuit) return false;
        return c.weight > wc.weight;
    });
}

function robotHonorRank(val) {
    return ({A:4,K:3,Q:2,J:1}[val] || 0);
}

function robotHasCard(seat, suit, val) {
    return (gameState.hands[seat] || []).some(c => c.suit === suit && c.val === val);
}

function robotRemainingOpponents(seat) {
    return PLAYERS.filter(p => p !== seat && !robotSameTeam(p, seat));
}

function robotRemainingPartners(seat) {
    return PLAYERS.filter(p => p !== seat && robotSameTeam(p, seat));
}

function robotUnknownRanks(suit, seat) {
    const known = new Set();
    (gameState.hands[seat] || []).filter(c => c.suit === suit).forEach(c => known.add(c.val));
    robotPlayedCards().filter(c => c.suit === suit).forEach(c => known.add(c.val));
    return RANKS.filter(v => !known.has(v));
}

function robotSuitControl(hand, suit) {
    const cs = robotSuitCards(hand, suit);
    return {
        cards: cs,
        len: cs.length,
        ace: cs.some(c => c.val === 'A'),
        king: cs.some(c => c.val === 'K'),
        queen: cs.some(c => c.val === 'Q'),
        top: cs.slice(0,4).map(c => c.val)
    };
}

function robotImmediateWinnerForSuit(seat, suit, trump) {
    const hand = gameState.hands[seat] || [];
    const cs = robotSuitCards(hand, suit);
    if (!cs.length) return null;
    const opponents = robotRemainingOpponents(seat);
    const partner = robotPartner(seat);
    const unseen = RANKS.map(v => ({val:v, weight:getRankWeight(v)}))
        .filter(c => !hand.some(h => h.suit===suit && h.val===c.val))
        .filter(c => !robotPlayedCards().some(p => p.suit===suit && p.val===c.val));

    const top = cs[0];
    if (top.val === 'A') return top;
    if (top.val === 'K' && !unseen.some(c => c.weight > top.weight)) return top;
    if (top.val === 'Q' && !unseen.some(c => c.weight > top.weight)) return top;
    return null;
}

function robotSafeWinner(card, seat, ledSuit) {
    if (!card) return false;
    if (gameState.trumpSuit && gameState.trumpSuit !== 'NT' && card.suit === gameState.trumpSuit) {
        const higher = robotPlayedCards().some(c => c.suit === card.suit && c.weight > card.weight);
        return !higher;
    }
    const higher = robotPlayedCards().some(c => c.suit === card.suit && c.weight > card.weight);
    return !higher;
}

function robotTargetTricks(seat) {
    if (!gameState.contract || !gameState.declarer) return 0;
    const level = parseInt(gameState.contract[0], 10);
    const target = 6 + level;
    const ns = gameState.tricksWon.ns;
    const ew = gameState.tricksWon.ew;
    const own = robotSameTeam(seat, 'north') ? ns : ew;
    const total = ns + ew;
    return Math.max(0, target - own);
}

function robotTeamTricksWon(seat) {
    return robotSameTeam(seat, 'north') ? gameState.tricksWon.ns : gameState.tricksWon.ew;
}

function robotTeamTricksRemaining(seat) {
    return 13 - (gameState.tricksWon.ns + gameState.tricksWon.ew) - robotTargetTricks(seat);
}

function robotCardCanWinCurrent(card, seat) {
    if (!gameState.trickLedSuit) return true;
    const winner = robotCurrentWinner();
    if (!winner) return true;
    const wc = gameState.trick[winner];
    const trump = gameState.trumpSuit && gameState.trumpSuit !== 'NT';
    if (trump) {
        if (card.suit === gameState.trumpSuit && wc.suit !== gameState.trumpSuit) return true;
        if (card.suit !== wc.suit) return false;
        return card.weight > wc.weight;
    }
    return card.suit === gameState.trickLedSuit && wc.suit === gameState.trickLedSuit && card.weight > wc.weight;
}

function robotMinimumWinningCard(cards, seat) {
    const winning = cards.filter(x => robotCardCanWinCurrent(x.c, seat));
    if (!winning.length) return null;
    winning.sort((a,b) => a.c.weight - b.c.weight);
    return winning[0];
}

function robotCurrentTrickHasThreat(seat) {
    const winner = robotCurrentWinner();
    if (!winner) return false;
    return !robotSameTeam(winner, seat);
}

function robotSuitLength(hand, suit) {
    return hand.filter(c => c.suit === suit).length;
}

function robotCanEstablishSuit(hand, suit) {
    const cs = robotSuitCards(hand, suit);
    if (cs.length < 4) return false;
    const ranks = new Set(cs.map(c => c.val));
    if (ranks.has('A') && ranks.has('K')) return true;
    if (ranks.has('A') && ranks.has('Q')) return true;
    if (ranks.has('K') && ranks.has('Q') && ranks.has('J')) return true;
    return cs.length >= 5;
}

function robotSuitEntryValue(hand, suit) {
    const cs = robotSuitCards(hand, suit);
    if (!cs.length) return 0;
    let v = cs.length * 2;
    if (cs.some(c => c.val === 'A')) v += 5;
    if (cs.some(c => c.val === 'K')) v += 3;
    if (cs.some(c => c.val === 'Q')) v += 2;
    return v;
}

function robotFindBestLeadSuit(seat) {
    const hand = gameState.hands[seat] || [];
    const trump = gameState.trumpSuit && gameState.trumpSuit !== 'NT' ? gameState.trumpSuit : null;
    const candidates = SUITS.filter(s => hand.some(c => c.suit === s)).map(s => {
        const cs = robotSuitCards(hand,s);
        let score = cs.length * 5;
        if (s === trump) score -= 8;
        if (cs.some(c => c.val === 'A')) score += 4;
        if (cs.some(c => c.val === 'K') && cs.some(c => c.val === 'Q')) score += 5;
        if (cs.length >= 5) score += 5;
        if (robotCanEstablishSuit(hand,s)) score += 4;
        return {s,cs,score};
    }).sort((a,b)=>b.score-a.score);
    return candidates[0] || null;
}

function robotLeadFromSuit(cs, mode='fourth') {
    if (!cs.length) return null;
    const asc = cs.slice().sort((a,b)=>a.weight-b.weight);
    const desc = cs.slice().sort((a,b)=>b.weight-a.weight);
    if (mode === 'top') return desc[0];
    if (mode === 'second') return desc[Math.min(1,desc.length-1)];
    if (mode === 'fourth') return asc[Math.min(3,asc.length-1)];
    if (mode === 'low') return asc[0];
    return asc[0];
}

function robotDefensiveReturn(seat, legal) {
    const partner = robotPartner(seat);
    const hist = gameState.trickHistory || [];
    const last = hist[hist.length-1];
    if (!last || last.winner !== partner) return null;

    const partnerCard = last.cards[partner];
    if (!partnerCard) return null;
    const same = legal.filter(x => x.c.suit === partnerCard.suit);
    if (!same.length) return null;

    // Ritorno nello stesso colore: basso da tre/quattro carte, alto da doubleton.
    // Se il compagno ha mostrato un onore, evita di restituire un onore superiore
    // senza una ragione concreta.
    const suitCountAtEnd = robotRemainingCount(partnerCard.suit);
    if (same.length === 2) return robotHighest(same);
    if (same.length >= 3) {
        const low = robotLowest(same);
        if (low.c.val === 'Q' || low.c.val === 'K' || low.c.val === 'A') {
            const nonHonor = same.filter(x => x.c.weight <= 10);
            if (nonHonor.length) return robotLowest(nonHonor);
        }
        return low;
    }
    return same[0];
}

function robotAttackAgainstNT(seat, legal) {
    const lead = robotFindBestLeadSuit(seat);
    if (!lead) return null;
    const cs = legal.filter(x => x.c.suit === lead.s);
    if (!cs.length) return null;

    const ranks = new Set(lead.cs.map(c=>c.val));
    if (ranks.has('K') && ranks.has('Q')) return cs.find(x=>x.c.val==='K') || robotHighest(cs);
    if (ranks.has('A') && ranks.has('K')) return cs.find(x=>x.c.val==='A') || robotHighest(cs);
    return robotLeadFromSuit(lead.cs, 'fourth') ? cs.find(x=>x.c.val===robotLeadFromSuit(lead.cs,'fourth').val) || robotLowest(cs) : robotLowest(cs);
}

function robotLeadCard(seat, legal) {
    const hand = gameState.hands[seat] || [];
    const trump = gameState.trumpSuit && gameState.trumpSuit !== 'NT' ? gameState.trumpSuit : null;
    const partner = robotPartner(seat);

    // In difesa, il ritorno al colore del compagno ha priorità sullo sviluppo casuale.
    const partnerReturn = robotDefensiveReturn(seat, legal);
    if (partnerReturn) return partnerReturn;

    // Primo attacco contro 3NT/1NT: quarto migliore da un colore lungo,
    // K da KQ e A da AK quando il colore lo giustifica.
    if (!robotIsDeclarerSide(seat) && gameState.contract && gameState.contract.endsWith('NT')) {
        return robotAttackAgainstNT(seat, legal) || robotLowest(legal);
    }

    const candidates = SUITS.filter(s => hand.some(c=>c.suit===s)).map(s => {
        const cs = robotSuitCards(hand,s);
        const ranks = new Set(cs.map(c=>c.val));
        let score = cs.length * 4;
        if (s === trump) score -= 10;
        if (ranks.has('K') && ranks.has('Q')) score += 8;
        if (ranks.has('A') && ranks.has('K')) score += 6;
        if (cs.length >= 5) score += 5;
        if (cs.length === 2 && !ranks.has('A')) score -= 2;
        return {s,cs,ranks,score};
    }).sort((a,b)=>b.score-a.score);

    const best = candidates[0];
    if (!best) return robotLowest(legal);
    const allowed = legal.filter(x=>x.c.suit===best.s);
    if (!allowed.length) return robotLowest(legal);

    if (best.ranks.has('K') && best.ranks.has('Q')) return allowed.find(x=>x.c.val==='K') || robotHighest(allowed);
    if (best.ranks.has('A') && best.ranks.has('K') && best.cs.length <= 3) return allowed.find(x=>x.c.val==='A') || robotHighest(allowed);
    return robotLeadFromSuit(best.cs,'fourth') ? allowed.find(x=>x.c.val===robotLeadFromSuit(best.cs,'fourth').val) || robotLowest(allowed) : robotLowest(allowed);
}

function robotShouldDuck(seat, legal) {
    if (!gameState.trickLedSuit || !legal.length) return false;
    if (!robotIsDeclarerSide(seat)) return false;
    const winner = robotCurrentWinner();
    if (!winner || robotSameTeam(winner, seat)) return false;
    const winning = robotWinningCards(legal);
    if (!winning.length) return true;

    // Dichiarante: se la presa non è necessaria ora e cedere conserva una
    // carta di controllo/ingresso, preferisce lisciare.
    const target = robotTargetTricks(seat);
    const remaining = 13 - (gameState.tricksWon.ns + gameState.tricksWon.ew);
    if (target < remaining && winning.some(x=>x.c.val==='A' || x.c.val==='K')) return true;
    return false;
}

function robotChooseDefensiveCard(seat, legal) {
    const winner = robotCurrentWinner();
    if (winner && robotSameTeam(winner, seat)) {
        // Se il compagno è già vincente, scarica la carta meno utile.
        const sorted = legal.slice().sort((a,b) => {
            const value = x => {
                let v = x.c.weight;
                if (x.c.val === 'A') v += 80;
                if (x.c.val === 'K') v += 35;
                if (x.c.val === 'Q') v += 14;
                if (x.c.suit === gameState.trumpSuit) v += 10;
                if (robotSuitLength(gameState.hands[seat], x.c.suit) === 1) v -= 8;
                return v;
            };
            return value(a)-value(b);
        });
        return sorted[0];
    }

    // Prendi con il minimo onore necessario: A su R è ammesso solo se R
    // è effettivamente la presa da vincere; non viene usato “per sicurezza”.
    const minimumWinner = robotMinimumWinningCard(legal, seat);
    if (minimumWinner) return minimumWinner;

    // Se non posso vincere, scarto in modo intelligente: corto, inutile,
    // oppure una carta che non protegge un onore successivo.
    const scored = legal.map(x => {
        const c = x.c;
        let score = c.weight;
        const len = robotSuitLength(gameState.hands[seat], c.suit);
        if (c.val === 'A') score += 100;
        if (c.val === 'K') score += 35;
        if (c.val === 'Q') score += 12;
        if (len === 1) score -= 16;
        if (len === 2) score -= 7;
        if (c.suit === gameState.trumpSuit) score += 16;
        return {x,score};
    }).sort((a,b)=>a.score-b.score);
    return scored[0].x;
}

function robotChooseDeclarerCard(seat, legal) {
    const hand = gameState.hands[seat] || [];
    const winner = robotCurrentWinner();

    // Il compagno/morto è già vincente: non consumare un onore.
    if (winner && robotSameTeam(winner, seat)) return robotLowest(legal);

    // Se la presa corrente è avversaria, prima valuta se conviene lisciare.
    if (robotShouldDuck(seat, legal)) {
        const low = robotLowest(legal);
        if (low && low.c.weight <= 10) return low;
    }

    const minimumWinner = robotMinimumWinningCard(legal, seat);
    if (minimumWinner) return minimumWinner;

    // Quando siamo in testa, sviluppa il colore che produce più prese future.
    if (!gameState.trickLedSuit) {
        const lead = robotFindBestLeadSuit(seat);
        if (lead) {
            const same = legal.filter(x=>x.c.suit===lead.s);
            if (same.length) {
                const cs = robotSuitCards(hand,lead.s);
                const ranks = new Set(cs.map(c=>c.val));
                if (ranks.has('A')) return same.find(x=>x.c.val==='A') || robotHighest(same);
                if (ranks.has('K') && ranks.has('Q')) return same.find(x=>x.c.val==='K') || robotHighest(same);
                return robotLeadFromSuit(cs,'fourth') ? same.find(x=>x.c.val===robotLeadFromSuit(cs,'fourth').val) || robotLowest(same) : robotLowest(same);
            }
        }
    }

    // Su un colore già guidato, evita di bruciare A/K quando può lisciare.
    const sorted = legal.slice().sort((a,b)=>{
        const value = x => {
            let v = x.c.weight;
            if (x.c.val === 'A') v += 50;
            if (x.c.val === 'K') v += 20;
            if (x.c.val === 'Q') v += 8;
            return v;
        };
        return value(a)-value(b);
    });
    return sorted[0];
}


/* ---------- PIANIFICATORE FASE 3 ---------- */

function robotKnownCardsForPlanning(seat) {
    const known = [];
    (gameState.hands[seat] || []).forEach(c => known.push(c));
    robotPlayedCards().forEach(c => known.push(c));

    // Dopo l'attacco, il morto è noto al dichiarante e ai robot della coppia.
    // Non usiamo invece le carte nascoste degli avversari per evitare il "cheating".
    if (gameState.declarer && robotIsDeclarerSide(seat) && robotPlayedCards().length > 0) {
        const dummy = robotPartner(gameState.declarer);
        if (dummy !== seat) (gameState.hands[dummy] || []).forEach(c => known.push(c));
    }
    return known;
}

function robotUnknownCardsForPlanning(seat, suit) {
    const known = new Set(robotKnownCardsForPlanning(seat).filter(c=>c.suit===suit).map(c=>c.val));
    return RANKS.filter(v => !known.has(v));
}

function robotTopUnseenRank(seat, suit) {
    const unknown = robotUnknownCardsForPlanning(seat, suit)
        .map(v=>getRankWeight(v)).sort((a,b)=>b-a);
    return unknown.length ? unknown[0] : 0;
}

function robotImmediateWinners(hand, suit, seat) {
    const cs = robotSuitCards(hand,suit);
    if (!cs.length) return 0;
    const unseen = new Set(robotUnknownCardsForPlanning(seat,suit));
    let n=0;
    for (const c of cs) {
        if (c.val === 'A') { n++; continue; }
        if (c.val === 'K' && !unseen.has('A')) { n++; continue; }
        if (c.val === 'Q' && !unseen.has('A') && !unseen.has('K')) { n++; continue; }
        if (c.val === 'J' && !unseen.has('A') && !unseen.has('K') && !unseen.has('Q')) n++;
    }
    return n;
}

function robotPotentialFutureTricks(seat, suit) {
    const hand = gameState.hands[seat] || [];
    const cs = robotSuitCards(hand,suit);
    if (!cs.length) return 0;
    let score = robotImmediateWinners(hand,suit,seat);
    const unknown = robotUnknownCardsForPlanning(seat,suit);
    const highUnknown = unknown.map(getRankWeight).sort((a,b)=>b-a);
    const top = cs.map(c=>c.weight).sort((a,b)=>b-a);

    // Colori lunghi: una volta esaurite le carte avversarie, le basse possono diventare prese.
    if (cs.length >= 5) score += Math.max(0, cs.length - 4) * 0.7;
    if (cs.length >= 4 && top[0] >= 12) score += 0.5;
    if (highUnknown.length && top[0] >= highUnknown[0]-1) score += 0.5;
    return score;
}

function robotLosersInSuit(seat, suit) {
    const hand = gameState.hands[seat] || [];
    const cs = robotSuitCards(hand,suit);
    if (!cs.length) return 0;
    const unknown = new Set(robotUnknownCardsForPlanning(seat,suit));
    let losers=0;
    if (!cs.some(c=>c.val==='A')) losers++;
    if (cs.length >= 2 && !cs.some(c=>c.val==='K') && unknown.has('A')) losers++;
    if (cs.length >= 3 && !cs.some(c=>c.val==='Q') && (unknown.has('A') || unknown.has('K'))) losers++;
    return Math.min(losers, cs.length);
}

function robotTrumpWinners(seat) {
    const trump = gameState.trumpSuit;
    if (!trump || trump==='NT') return 0;
    const hand = gameState.hands[seat] || [];
    const cs = robotSuitCards(hand,trump);
    let n=0;
    const unknown = new Set(robotUnknownCardsForPlanning(seat,trump));
    cs.forEach(c=>{
        if (c.val==='A' || (c.val==='K'&&!unknown.has('A')) || (c.val==='Q'&&!unknown.has('A')&&!unknown.has('K'))) n++;
    });
    return n;
}

function robotPlanSummary(seat) {
    const hand = gameState.hands[seat] || [];
    const suits = SUITS.map(s=>({
        suit:s,
        len:robotSuitLength(hand,s),
        winners:robotImmediateWinners(hand,s,seat),
        future:robotPotentialFutureTricks(seat,s),
        losers:robotLosersInSuit(seat,s),
        entry:robotSuitEntryValue(hand,s)
    }));
    const immediate = suits.reduce((n,x)=>n+x.winners,0) + robotTrumpWinners(seat);
    const target = robotTargetTricks(seat);
    return { suits, immediate, target, surplus: immediate-target };
}

function robotIsFinesseCandidate(seat, card) {
    if (!card || card.val === 'A' || card.val === 'K') return false;
    const hand = gameState.hands[seat] || [];
    const cs = robotSuitCards(hand,card.suit);
    const unknown = new Set(robotUnknownCardsForPlanning(seat,card.suit));
    if (cs.some(c=>c.val==='A') && cs.some(c=>c.val==='Q') && unknown.has('K')) return true;
    if (cs.some(c=>c.val==='K') && cs.some(c=>c.val==='Q') && unknown.has('A')) return true;
    if (cs.some(c=>c.val==='A') && cs.some(c=>c.val==='J') && unknown.has('Q') && unknown.has('K')) return true;
    return false;
}

function robotCandidateCardScore(seat, option, plan) {
    const c = option.c;
    const hand = gameState.hands[seat] || [];
    const legal = robotLegalCards(seat);
    let score = 0;
    const trump = gameState.trumpSuit && gameState.trumpSuit!=='NT' ? gameState.trumpSuit : null;
    const winner = robotCurrentWinner();

    // Base: le carte basse preservano risorse; gli onori si spendono solo quando servono.
    score += c.weight * 0.18;
    if (c.val==='A') score += 6;
    if (c.val==='K') score += 3;
    if (c.val==='Q') score += 1.2;
    if (c.val==='J') score += 0.3;

    const len = robotSuitLength(hand,c.suit);
    if (len===1) score -= 1.5; // accorciare un colore può creare un ingresso/taglio
    if (len>=5) score -= 0.8;  // sviluppo del colore lungo è spesso utile
    if (trump && c.suit===trump) score += 1.5;

    // Vincere la presa: premio minimo sufficiente, ma forte penalità se usa un onore eccessivo.
    if (robotCardCanWinCurrent(c,seat)) {
        const min = robotMinimumWinningCard(legal,seat);
        if (min && robotCardKey(min.c)===robotCardKey(c)) score -= 7;
        else score += 4;
    }

    // Se il compagno è già vincente, non spendere una carta alta.
    if (winner && robotSameTeam(winner,seat)) {
        score -= c.weight * 0.8;
        if (c.val==='A') score -= 10;
        if (c.val==='K') score -= 5;
    }

    // Entrate: conservare l'unico A/K di un colore è importante.
    const suitInfo = plan.suits.find(x=>x.suit===c.suit);
    if (suitInfo) {
        if (c.val==='A' && suitInfo.winners>0) score += 2;
        if (c.val==='K' && suitInfo.winners>0) score += 1;
        score -= suitInfo.future * 0.25;
    }

    // Una carta bassa che avvia una finesse è più interessante di un onore prematuro.
    if (!gameState.trickLedSuit && robotIsDeclarerSide(seat) && robotIsFinesseCandidate(seat,c)) score -= 3;

    // Se servono poche prese, privilegiamo sicurezza; se ne servono molte,
    // accettiamo linee che sviluppano colori e impasse.
    if (plan.target <= 3) {
        if (c.val==='A' || c.val==='K') score += 1.5;
    } else if (plan.target >= 7) {
        if (len>=4) score -= 1;
        if (robotIsFinesseCandidate(seat,c)) score -= 1.5;
    }

    return score;
}

function robotPlanDeclarerCard(seat, legal) {
    const plan = robotPlanSummary(seat);
    const winner = robotCurrentWinner();

    // In testa con il compagno: conserva le comunicazioni.
    if (winner && robotSameTeam(winner,seat)) {
        return legal.slice().sort((a,b)=>robotCandidateCardScore(seat,a,plan)-robotCandidateCardScore(seat,b,plan))[0];
    }

    // Se l'avversario vince ma non serve la presa, lisciare può essere corretto.
    if (winner && !robotSameTeam(winner,seat) && robotShouldDuck(seat,legal)) {
        const low = legal.filter(x=>x.c.weight<=10).sort((a,b)=>a.c.weight-b.c.weight);
        if (low.length) return low[0];
    }

    const scored = legal.map(x=>({x,score:robotCandidateCardScore(seat,x,plan)}))
        .sort((a,b)=>a.score-b.score);
    return scored[0] ? scored[0].x : robotLowest(legal);
}

function robotPlanDefensiveCard(seat, legal) {
    const plan = robotPlanSummary(seat);
    const winner = robotCurrentWinner();

    // Partner already wins: scarta la carta con minor valore futuro.
    if (winner && robotSameTeam(winner,seat)) {
        return legal.slice().sort((a,b)=>robotCandidateCardScore(seat,a,plan)-robotCandidateCardScore(seat,b,plan))[0];
    }

    // Se possiamo vincere, prendiamo con il minimo necessario.
    const min = robotMinimumWinningCard(legal,seat);
    if (min) return min;

    // Se non possiamo vincere, conserviamo gli onori e scarichiamo una carta poco utile.
    return legal.slice().sort((a,b)=>robotCandidateCardScore(seat,a,plan)-robotCandidateCardScore(seat,b,plan))[0];
}

function robotPlayStep() {
    if (gameState.isProcessingTrick) return;
    const seat = PLAYERS[gameState.currentTurn];
    if (isHumanTurn(seat)) return;
    const hand = gameState.hands[seat];
    if (!hand || !hand.length) return;

    const legal = robotLegalCards(seat);
    if (!legal.length) return;

    let chosen;
    if (!gameState.trickLedSuit) chosen = robotLeadCard(seat, legal);
    else if (robotIsDeclarerSide(seat)) chosen = robotPlanDeclarerCard(seat, legal);
    else chosen = robotPlanDefensiveCard(seat, legal);

    if (!chosen) chosen = robotLowest(legal);
    const card = chosen.c;
    const idx = hand.indexOf(card);
    if (idx < 0) return;

    hand.splice(idx,1);
    recordPlayedCard(seat,card);
    if (!gameState.trickLedSuit) gameState.trickLedSuit = card.suit;
    gameState.trick[seat] = card;
    gameState.currentTurn = (gameState.currentTurn+1)%4;

    saveMultiplayerState();
    updateUI();

    const count = PLAYERS.filter(p=>gameState.trick[p]!==null).length;
    if (count===4) {
        gameState.isProcessingTrick = true;
        scheduleRobotMove(evaluateTrick,1100);
    } else checkRobotTurn();
}


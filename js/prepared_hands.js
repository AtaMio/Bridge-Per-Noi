/* --- MANI PREPARATE PER "INSEGNARE BRIDGE" --- */

function openPreparedHandsFilePicker() {
    if (gameState.mode !== 'insegnare') return;
    const input = document.getElementById('prepared-hands-file-input');
    if (!input) return;
    input.value = '';
    input.click();
}

async function handlePreparedHandsSingleFile(event) {
    if (gameState.mode !== 'insegnare') return;
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        if (!text.trim()) throw new Error('Il file è vuoto.');
        const parsed = parsePreparedHandsText(text, file.name);
        const nums = Object.keys(parsed).map(Number).sort((a,b)=>a-b);
        if (!nums.length) throw new Error('Nessuna mano preparata trovata nel file.');
        gameState.preparedHands = parsed;
        gameState.preparedHandsSource = file.name;
        gameState.boardNum = nums[0];
        initNewBoard();
        updatePreparedHandsStatus();
        alert('Caricate ' + nums.length + ' mani preparate dal file "' + file.name + '". Si parte dalla mano n°' + nums[0] + '.');
    } catch (err) {
        alert('Errore nel caricamento delle mani preparate:\n\n' + err.message);
    }
}

function preparedCardFromToken(token) {
    let t = String(token || '').trim().toUpperCase();
    if (!t) return null;

    // Accetta sia A♠ sia ♠A, oltre alla notazione AS/KH/QD/TC.
    const suitAliases = { 'S':'♠', 'H':'♥', 'D':'♦', 'C':'♣', '♠':'♠', '♥':'♥', '♦':'♦', '♣':'♣' };
    let val = null;
    let suit = null;

    if (t.length >= 2 && suitAliases[t[0]] && t.slice(1).length <= 2) {
        suit = suitAliases[t[0]];
        val = t.slice(1);
    } else {
        const last = t.slice(-1);
        const first = t.slice(0, -1);
        if (suitAliases[last]) {
            suit = suitAliases[last];
            val = first;
        }
    }

    if (!suit || !['2','3','4','5','6','7','8','9','10','T','J','Q','K','A'].includes(val)) return null;
    if (val === '10') val = 'T';
    return { suit, val, weight: getRankWeight(val) };
}

function parsePreparedHandsText(text, sourceName) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const hands = {};
    let current = null;

    function fail(message) {
        throw new Error((sourceName ? sourceName + ': ' : '') + message);
    }

    lines.forEach((raw, lineIndex) => {
        const line = raw.trim();
        if (!line || line.startsWith('#') || line.startsWith('//')) return;

        const handMatch = line.match(/^MANO\s+(\d+)\s*$/i);
        if (handMatch) {
            const n = parseInt(handMatch[1], 10);
            if (!n || n < 1) fail('numero di mano non valido alla riga ' + (lineIndex + 1));
            if (hands[n]) fail('la mano ' + n + ' è duplicata');
            current = { number: n, north: [], east: [], south: [], west: [] };
            hands[n] = current;
            return;
        }

        const seatMatch = line.match(/^(NORD|N|EST|E|SUD|S|OVEST|O|W)\s*:\s*(.+)$/i);
        if (!seatMatch) fail('riga non riconosciuta alla riga ' + (lineIndex + 1) + '. Atteso MANO N oppure NORD:/EST:/SUD:/OVEST:.');
        if (!current) fail('trovata una mano senza un precedente "MANO N" alla riga ' + (lineIndex + 1));

        const seatMap = { NORD:'north', N:'north', EST:'east', E:'east', SUD:'south', S:'south', OVEST:'west', O:'west', W:'west' };
        const seat = seatMap[seatMatch[1].toUpperCase()];
        if (current[seat].length) fail('il posto ' + seat.toUpperCase() + ' è scritto più di una volta nella mano ' + current.number);

        // Separatore facoltativo: spazi, virgole o punto e virgola.
        const tokens = seatMatch[2].replace(/[,;|]+/g, ' ').split(/\s+/).filter(Boolean);
        if (tokens.length !== 13) fail('la mano ' + current.number + ' ha ' + tokens.length + ' carte per ' + seat.toUpperCase() + '; devono essere esattamente 13');
        current[seat] = tokens.map(preparedCardFromToken);
        if (current[seat].some(c => !c)) fail('carta non riconosciuta nella mano ' + current.number + ', posto ' + seat.toUpperCase());
    });

    const numbers = Object.keys(hands).map(Number).sort((a,b)=>a-b);
    if (!numbers.length) fail('nessuna mano preparata trovata');

    numbers.forEach(n => {
        const h = hands[n];
        PLAYERS.forEach(seat => {
            if (!h[seat] || h[seat].length !== 13) fail('la mano ' + n + ' non contiene 13 carte per tutti i quattro posti');
        });
        const seen = new Set();
        PLAYERS.forEach(seat => h[seat].forEach(c => {
            const key = c.val + c.suit;
            if (seen.has(key)) fail('la carta ' + key + ' è presente più volte nella mano ' + n);
            seen.add(key);
        }));
        if (seen.size !== 52) fail('la mano ' + n + ' non contiene esattamente 52 carte diverse');
        PLAYERS.forEach(seat => sortHand(h[seat]));
    });

    return hands;
}

function getPreparedHandForBoard(boardNum) {
    if (gameState.mode !== 'insegnare' || !gameState.preparedHands) return null;
    return gameState.preparedHands[String(boardNum)] || gameState.preparedHands[boardNum] || null;
}

function updatePreparedHandsStatus() {
    const box = document.getElementById('prepared-hands-status');
    if (!box) return;
    const nums = Object.keys(gameState.preparedHands || {}).map(Number).sort((a,b)=>a-b);
    if (!nums.length) {
        box.style.display = 'none';
        box.innerText = '';
        return;
    }
    box.style.display = 'block';
    box.innerText = 'Mani preparate: ' + nums.join(', ') + ' — attiva la mano n°' + gameState.boardNum;
}

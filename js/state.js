const SUITS = ['♠', '♥', '♦', '♣'];
const STRAINS = ['♣', '♦', '♥', '♠', 'NT'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const PLAYERS = ['north', 'east', 'south', 'west'];

let gameState = {
    mode: 'solo',
    modeTitle: 'Gioca da Solo',
    boardNum: 1,
    dealer: 0, // 0: north, 1: east, 2: south, 3: west
    hands: { north: [], east: [], south: [], west: [] },
    initialHands: { north: [], east: [], south: [], west: [] },
    bids: [],
    currentBidder: 0,
    biddingEnded: false,
    contract: null,
    trumpSuit: null,
    declarer: null,
    currentTurn: 0,
    trick: { north: null, east: null, south: null, west: null },
    trickLedSuit: null,
    tricksWon: { ns: 0, ew: 0 },
    historyResults: [],
    revealed: false,
    tablePin: null,
    tableCreator: null,
    tableCreatorNick: null,
    playersNames: { north: '', east: '', south: '', west: '' },
    spectators: [],
    micStates: { north: false, east: false, south: false, west: false },
    spectatorMicStates: {},
    localAudioStream: null,
    mySeat: 'south',
    mySeatsInsegnare: [],
    isProcessingTrick: false,
    playedCards: [],
    trickHistory: [],
    robotMemory: {},
    preparedHands: null,
    preparedHandsSource: ''
};

let robotTimer = null;


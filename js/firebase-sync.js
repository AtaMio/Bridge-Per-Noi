/* Firebase Realtime Database bridge adapter for Bridge per Noi.
 * Mirrors bridge_table_* localStorage entries to Firebase and listens for remote updates.
 */
(function () {
  'use strict';
  const DB_ROOT = 'bridgeTables';
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const originalGetItem = Storage.prototype.getItem;
  let applyingRemote = false;
  const listeners = new Map();

  function tablePinFromKey(key) {
    return typeof key === 'string' && key.startsWith('bridge_table_') ? key.slice('bridge_table_'.length) : null;
  }
  function tableRef(pin) { return firebase.database().ref(DB_ROOT + '/' + encodeURIComponent(pin)); }

  // Keep local behavior for the existing game code, while mirroring table changes online.
  Storage.prototype.setItem = function (key, value) {
    originalSetItem.call(this, key, value);
    const pin = tablePinFromKey(String(key));
    if (pin && !applyingRemote && window.bridgeFirebaseReady) {
      try {
        const parsed = JSON.parse(String(value));
        tableRef(pin).set(parsed).catch(err => console.error('Firebase write:', err));
      } catch (err) { console.error('Bridge table JSON/Firebase:', err); }
    }
  };
  Storage.prototype.removeItem = function (key) {
    originalRemoveItem.call(this, key);
    const pin = tablePinFromKey(String(key));
    if (pin && !applyingRemote && window.bridgeFirebaseReady) {
      tableRef(pin).remove().catch(err => console.error('Firebase remove:', err));
    }
  };

  function watchLocalTables() {
    // Subscribe to table keys already cached on this device.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i), pin = tablePinFromKey(key);
      if (pin) subscribe(pin);
    }
  }
  function subscribe(pin) {
    if (listeners.has(pin)) return;
    const ref = tableRef(pin);
    const callback = snapshot => {
      applyingRemote = true;
      try {
        if (snapshot.exists()) originalSetItem.call(localStorage, 'bridge_table_' + pin, JSON.stringify(snapshot.val()));
        else originalRemoveItem.call(localStorage, 'bridge_table_' + pin);
      } finally { applyingRemote = false; }
      // Refresh lobby/game UI when the existing page is active.
      if (window.gameState && gameState.tablePin === pin) {
        try { if (typeof syncTableState === 'function') syncTableState(); if (typeof syncMultiplayerState === 'function') syncMultiplayerState(); } catch (e) { console.warn(e); }
      }
    };
    ref.on('value', callback, err => console.error('Firebase listener:', err));
    listeners.set(pin, { ref, callback });
  }

  function initialize() {
    if (!window.firebase || !window.bridgeFirebaseConfig) {
      console.error('Firebase SDK/config non disponibili.'); return;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.bridgeFirebaseConfig);
      window.bridgeFirebaseDatabase = firebase.database();
      window.bridgeFirebaseReady = true;
      watchLocalTables();
      // Any table accessed/created after startup is subscribed too.
      const originalSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        originalSet.call(this, key, value);
        const pin = tablePinFromKey(String(key)); if (pin) subscribe(pin);
      };
      console.info('Bridge Firebase pronto.');
    } catch (e) { console.error('Inizializzazione Firebase:', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();

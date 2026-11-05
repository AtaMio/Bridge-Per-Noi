/* Firebase Realtime Database adapter. The game keeps its existing localStorage
   interface, but table reads are hydrated from Firebase before seat selection. */
(function () {
  'use strict';
  const ROOT = 'bridgeTables';
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  let applyingRemote = false;
  const subscriptions = new Map();
  let readyResolve;
  window.bridgeFirebaseReadyPromise = new Promise(resolve => { readyResolve = resolve; });

  function tablePinFromKey(key) {
    return typeof key === 'string' && key.startsWith('bridge_table_')
      ? key.slice('bridge_table_'.length) : null;
  }
  function tableRef(pin) {
    return firebase.database().ref(ROOT + '/' + encodeURIComponent(pin));
  }
  function subscribe(pin) {
    if (subscriptions.has(pin)) return;
    const ref = tableRef(pin);
    const callback = snapshot => {
      applyingRemote = true;
      try {
        if (snapshot.exists()) originalSetItem.call(localStorage, 'bridge_table_' + pin, JSON.stringify(snapshot.val()));
        else originalRemoveItem.call(localStorage, 'bridge_table_' + pin);
      } finally { applyingRemote = false; }
      if (typeof gameState !== 'undefined' && gameState.tablePin === pin) {
        try {
          if (typeof syncTableState === 'function') syncTableState();
          if (typeof syncMultiplayerState === 'function') syncMultiplayerState();
        } catch (e) { console.warn('Aggiornamento tavolo:', e); }
      }
    };
    ref.on('value', callback, error => {
      console.error('Firebase listener:', error);
      alert('Errore di collegamento al tavolo Firebase: ' + error.message);
    });
    subscriptions.set(pin, { ref, callback });
  }

  Storage.prototype.setItem = function (key, value) {
    originalSetItem.call(this, key, value);
    const pin = tablePinFromKey(String(key));
    if (pin && !applyingRemote && window.bridgeFirebaseReady) {
      try {
        const data = JSON.parse(String(value));
        tableRef(pin).set(data).catch(error => console.error('Salvataggio Firebase:', error));
        subscribe(pin);
      } catch (error) { console.error('Dati tavolo non validi:', error); }
    }
  };
  Storage.prototype.removeItem = function (key) {
    originalRemoveItem.call(this, key);
    const pin = tablePinFromKey(String(key));
    if (pin && !applyingRemote && window.bridgeFirebaseReady) {
      tableRef(pin).remove().catch(error => console.error('Eliminazione tavolo Firebase:', error));
    }
  };

  window.bridgeLoadTable = async function (pin) {
    await window.bridgeFirebaseReadyPromise;
    if (!window.bridgeFirebaseReady) throw new Error('Firebase non è inizializzato. Controlla la configurazione e la connessione.');
    const snapshot = await tableRef(pin).get();
    applyingRemote = true;
    try {
      if (snapshot.exists()) originalSetItem.call(localStorage, 'bridge_table_' + pin, JSON.stringify(snapshot.val()));
      else originalRemoveItem.call(localStorage, 'bridge_table_' + pin);
    } finally { applyingRemote = false; }
    subscribe(pin);
    return snapshot.exists() ? snapshot.val() : null;
  };

  function initialize() {
    try {
      if (!window.firebase || !window.bridgeFirebaseConfig) throw new Error('SDK o configurazione Firebase mancanti');
      if (!firebase.apps.length) firebase.initializeApp(window.bridgeFirebaseConfig);
      window.bridgeFirebaseDatabase = firebase.database();
      window.bridgeFirebaseReady = true;
      readyResolve(true);
      console.info('Bridge Firebase pronto.');
    } catch (error) {
      console.error('Inizializzazione Firebase:', error);
      window.bridgeFirebaseReady = false;
      readyResolve(false);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();

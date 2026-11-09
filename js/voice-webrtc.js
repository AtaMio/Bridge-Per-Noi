/* Audio WebRTC (mesh) per i tavoli "Gioca con amici" / "Insegnare Bridge".
   Richiede HTTPS e Firebase Realtime Database per la segnalazione.
   - Tutti i giocatori seduti si collegano tra loro appena entrano al tavolo, anche con il microfono spento:
     così si sente chi parla (prima la connessione partiva solo per chi accendeva il microfono).
   - Il microfono viene acceso/spento con replaceTrack: nessuna rinegoziazione necessaria. */
(function () {
  'use strict';
  const seatOrder = ['north', 'east', 'south', 'west'];
  const ICE = { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ] };
  let micStream = null;
  const peers = {};        // remoteSeat -> { pc, sid, pendingIce, watching }
  const audioEls = {};
  let activePin = null;
  let activeSeat = null;

  function mySeat() {
    if (gameState.mode === 'insegnare' && gameState.mySeatsInsegnare && gameState.mySeatsInsegnare.length) return gameState.mySeatsInsegnare[0];
    return gameState.mySeat;
  }
  function voiceRoot() {
    return firebase.database().ref('bridgeTables/' + encodeURIComponent(gameState.tablePin) + '/voice');
  }
  function pairKey(a, b) { return [a, b].sort().join('_'); }

  function playRemote(remote, stream) {
    let el = audioEls[remote];
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true; el.playsInline = true; el.id = 'bridge-audio-' + remote;
      el.style.display = 'none';
      document.body.appendChild(el);
      audioEls[remote] = el;
    }
    el.srcObject = stream;
    el.muted = false; el.volume = 1;
    const p = el.play(); if (p && p.catch) p.catch(() => {});
  }
  // Alcuni browser bloccano l'audio finché non c'è un tocco dell'utente: al primo tocco/click si riattiva.
  function resumeAudio() { Object.values(audioEls).forEach(el => { const p = el.play(); if (p && p.catch) p.catch(() => {}); }); }
  document.addEventListener('click', resumeAudio);
  document.addEventListener('touchstart', resumeAudio, { passive: true });

  function closePeer(remote) {
    const p = peers[remote];
    if (!p) return;
    try { p.pc.close(); } catch (e) {}
    delete peers[remote];
    if (audioEls[remote]) { audioEls[remote].srcObject = null; }
  }

  function createPeer(remote, sid) {
    closePeer(remote);
    const me = mySeat();
    const pc = new RTCPeerConnection(ICE);
    const peer = { pc, sid, pendingIce: [], watching: peers[remote] ? peers[remote].watching : false };
    peers[remote] = peer;
    // Un canale audio sempre presente (invio+ricezione); la traccia del microfono viene agganciata con replaceTrack.
    const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
    peer.sender = tr.sender;
    if (micStream) { const t = micStream.getAudioTracks()[0]; if (t) tr.sender.replaceTrack(t).catch(() => {}); }
    pc.ontrack = e => { playRemote(remote, (e.streams && e.streams[0]) || new MediaStream([e.track])); };
    pc.onicecandidate = e => {
      if (e.candidate) voiceRoot().child(pairKey(me, remote)).child('ice_' + me).push({ sid, c: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') { try { pc.restartIce && pc.restartIce(); } catch (e) {} }
    };
    return peer;
  }

  async function flushIce(peer) {
    while (peer.pendingIce.length && peer.pc.remoteDescription) {
      const c = peer.pendingIce.shift();
      try { await peer.pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn('ICE', e); }
    }
  }

  function watch(remote) {
    const me = mySeat();
    const ref = voiceRoot().child(pairKey(me, remote));
    const iAmOfferer = seatOrder.indexOf(me) < seatOrder.indexOf(remote);

    // Candidati ICE dell'altro lato
    ref.child('ice_' + remote).on('child_added', async snap => {
      const v = snap.val(); const peer = peers[remote];
      if (!v || !peer || v.sid !== peer.sid) return;
      if (peer.pc.remoteDescription) { try { await peer.pc.addIceCandidate(new RTCIceCandidate(v.c)); } catch (e) { console.warn('ICE', e); } }
      else peer.pendingIce.push(v.c);
    });

    if (iAmOfferer) {
      ref.child('answer').on('value', async snap => {
        const ans = snap.val(); const peer = peers[remote];
        if (!ans || !peer || ans.sid !== peer.sid) return;
        if (peer.pc.signalingState !== 'have-local-offer') return;
        try { await peer.pc.setRemoteDescription({ type: ans.type, sdp: ans.sdp }); await flushIce(peer); } catch (e) { console.warn('WebRTC answer', e); }
      });
    } else {
      ref.child('offer').on('value', async snap => {
        const off = snap.val();
        if (!off) return;
        const old = peers[remote];
        if (old && old.sid === off.sid) return;
        const peer = createPeer(remote, off.sid);
        try {
          await peer.pc.setRemoteDescription({ type: off.type, sdp: off.sdp });
          await flushIce(peer);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          await ref.child('answer').set({ sid: off.sid, type: answer.type, sdp: answer.sdp });
        } catch (e) { console.warn('WebRTC offer', e); }
      });
    }
    return ref;
  }

  async function makeOffer(remote) {
    const me = mySeat();
    const ref = voiceRoot().child(pairKey(me, remote));
    const sid = String(Date.now()) + Math.random().toString(36).slice(2, 6);
    const peer = createPeer(remote, sid);
    try {
      await ref.child('answer').remove();
      await ref.child('ice_' + me).remove();
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      await ref.child('offer').set({ sid, type: offer.type, sdp: offer.sdp });
    } catch (e) { console.warn('WebRTC makeOffer', e); }
  }

  const watched = {};
  function ensurePeers() {
    try {
      if (!window.firebase || !window.bridgeFirebaseReady) return;
      if (gameState.mode !== 'amici' && gameState.mode !== 'insegnare') return;
      const me = mySeat();
      if (!gameState.tablePin || !me || me === 'spectator') return;
      if (document.getElementById('game-container').style.display === 'none') {
        Object.keys(peers).forEach(closePeer); activePin = null; return;
      }

      if (activePin !== gameState.tablePin || activeSeat !== me) {
        Object.keys(peers).forEach(closePeer);
        Object.keys(watched).forEach(k => delete watched[k]);
        activePin = gameState.tablePin; activeSeat = me;
      }
      for (const remote of seatOrder) {
        if (remote === me || !gameState.playersNames[remote]) continue;
        if (gameState.mode === 'insegnare' && (gameState.mySeatsInsegnare || []).includes(remote)) continue;
        if (!watched[remote]) { watched[remote] = true; watch(remote); }
        const iAmOfferer = seatOrder.indexOf(me) < seatOrder.indexOf(remote);
        const peer = peers[remote];
        const bad = peer && ['failed', 'closed', 'disconnected'].includes(peer.pc.connectionState);
        if (iAmOfferer && (!peer || bad)) makeOffer(remote);
      }
    } catch (e) { console.warn('ensurePeers', e); }
  }
  setInterval(ensurePeers, 3000);
  window.bridgeVoiceEnsure = ensurePeers;

  async function attachMic() {
    const t = micStream && micStream.getAudioTracks()[0];
    for (const p of Object.values(peers)) {
      if (p.sender) { try { await p.sender.replaceTrack(t || null); } catch (e) { console.warn(e); } }
    }
  }

  window.toggleMicrophone = async function (seat) {
    if (gameState.mode !== 'amici' && gameState.mode !== 'insegnare') return;
    if (seat !== gameState.mySeat && !(gameState.mySeatsInsegnare || []).includes(seat)) return;
    if (!micStream) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) {
        alert('Microfono non disponibile. Consenti l’accesso al microfono nel browser e usa una pagina HTTPS. ' + e.message);
        return;
      }
      gameState.localAudioStream = micStream;
      gameState.micStates[seat] = true;
      ensurePeers();
      await attachMic();
    } else {
      micStream.getTracks().forEach(t => t.stop());
      micStream = null; gameState.localAudioStream = null;
      await attachMic();
      gameState.micStates[seat] = false;
    }
    resumeAudio();
    if (typeof saveMultiplayerState === 'function') saveMultiplayerState();
    if (typeof updateUI === 'function') updateUI();
  };

  window.addEventListener('beforeunload', () => {
    Object.keys(peers).forEach(closePeer);
    if (micStream) micStream.getTracks().forEach(t => t.stop());
  });
})();


/* WebRTC audio mesh for Bridge friends tables (requires HTTPS and Firebase RTDB). */
(function(){
 'use strict';
 let micStream=null, pcs={}, seenSignals={};
 const audioEls={};
 const seatOrder=['north','east','south','west'];
 function mySeat(){return gameState.mySeat;}
 function voiceRoot(){return firebase.database().ref('bridgeTables/'+encodeURIComponent(gameState.tablePin)+'/voice');}
 function pairKey(a,b){return [a,b].sort().join('_');}
 function pcFor(remote){
   if(pcs[remote]) return pcs[remote];
   const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
   pcs[remote]=pc;
   if(micStream) micStream.getTracks().forEach(t=>pc.addTrack(t,micStream));
   pc.ontrack=e=>{
     let el=audioEls[remote];
     if(!el){el=document.createElement('audio');el.autoplay=true;el.playsInline=true;el.id='bridge-audio-'+remote;el.style.display='none';document.body.appendChild(el);audioEls[remote]=el;}
     el.srcObject=e.streams[0]; el.play().catch(()=>{});
   };
   pc.onicecandidate=e=>{if(e.candidate) voiceRoot().child(pairKey(mySeat(),remote)).child('ice_'+mySeat()).push(e.candidate.toJSON());};
   return pc;
 }
 async function setupPeer(remote){
   if(!gameState.tablePin||!mySeat()||mySeat()==='spectator'||remote===mySeat())return;
   const pc=pcFor(remote), key=pairKey(mySeat(),remote), ref=voiceRoot().child(key);
   const lower=seatOrder.indexOf(mySeat())<seatOrder.indexOf(remote);
   if(lower && !pc.__offerMade){
     pc.__offerMade=true;
     const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
     await ref.child('offer_'+mySeat()).set({type:offer.type,sdp:offer.sdp});
   }
   const remoteOffer=ref.child('offer_'+remote);
   remoteOffer.on('value',async snap=>{
     const offer=snap.val(); if(!offer||pc.__answering===offer.sdp)return;
     pc.__answering=offer.sdp;
     try{await pc.setRemoteDescription(new RTCSessionDescription(offer));const ans=await pc.createAnswer();await pc.setLocalDescription(ans);await ref.child('answer_'+mySeat()).set({type:ans.type,sdp:ans.sdp});}catch(e){console.warn('WebRTC offer',e);}
   });
   ref.child('answer_'+remote).on('value',async snap=>{
     const ans=snap.val();if(ans&&pc.signalingState==='have-local-offer')try{await pc.setRemoteDescription(new RTCSessionDescription(ans));}catch(e){console.warn(e);}
   });
   const iceRef=ref.child('ice_'+remote);
   iceRef.on('child_added',async snap=>{try{if(snap.val())await pc.addIceCandidate(new RTCIceCandidate(snap.val()));}catch(e){console.warn('ICE',e);}});
 }
 async function connectAll(){for(const s of seatOrder)if(gameState.playersNames[s])await setupPeer(s);}
 window.toggleMicrophone=async function(seat){
   if(gameState.mode!=='amici'&&gameState.mode!=='insegnare')return;
   if(seat!==mySeat()&&!(gameState.mySeatsInsegnare||[]).includes(seat))return;
   if(!micStream){
     try{micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
     catch(e){alert('Microfono non disponibile. Consenti l’accesso in Safari/Chrome e usa HTTPS. '+e.message);return;}
     gameState.localAudioStream=micStream;
     for(const pc of Object.values(pcs))micStream.getTracks().forEach(t=>pc.addTrack(t,micStream));
     await connectAll();
     gameState.micStates[seat]=true;
   }else{
     micStream.getTracks().forEach(t=>t.stop());micStream=null;gameState.localAudioStream=null;
     Object.values(pcs).forEach(pc=>pc.getSenders().forEach(sender=>{if(sender.track&&sender.track.kind==='audio')pc.removeTrack(sender);}));
     gameState.micStates[seat]=false;
   }
   if(typeof saveMultiplayerState==='function')saveMultiplayerState();
   if(typeof updateUI==='function')updateUI();
 };
 window.addEventListener('beforeunload',()=>{Object.values(pcs).forEach(p=>p.close());if(micStream)micStream.getTracks().forEach(t=>t.stop());});
})();

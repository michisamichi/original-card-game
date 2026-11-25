// Optional device-only synthesized cues. One short cue per observed revision.
// No media downloads, no audio timers, no waiting for audio in game actions.
const CUES=Object.freeze({finish:[523,659,784],secret:[392,554,440],turn:[440,660],damage:[180,105],heal:[440,587],death:[220,147],shield:[880,660],attack:[260,180],cancel:[260,147],summon:[330,495],spell:[495,660],buff:[440,550],weaken:[330,220],silence:[440,220],transform:[330,440,660],secretSet:[330,392],stat:[392,523],expire:[440,330],bounce:[587,392],reveal:[330,523],poison:[196,233]});
export function createBattleAudio({context=()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null;},visible=()=>globalThis.document?.visibilityState!=='hidden'}={}){
 let ctx=null,resuming=false;const voices=new Map();
 function release(osc,gain){if(!voices.delete(osc))return;osc.onended=null;try{osc.disconnect();}catch{}try{gain?.disconnect();}catch{}}
 function stop(){for(const [osc,gain] of voices){try{osc.stop();}catch{}release(osc,gain);}}
 function unlock(enabled){if(!enabled||!visible())return;try{ctx??=context();if(!resuming&&(ctx?.state==='suspended'||ctx?.state==='interrupted')){resuming=true;try{Promise.resolve(ctx.resume()).catch(()=>{}).finally(()=>{resuming=false;});}catch{resuming=false;}}}catch{}}
 function play(kind,enabled=true){if(!enabled||!visible()){stop();return;}if(!ctx||ctx.state!=='running'||!Object.hasOwn(CUES,kind))return;try{stop();const now=ctx.currentTime;CUES[kind].forEach((hz,i)=>{const osc=ctx.createOscillator();voices.set(osc,null);const gain=ctx.createGain(),start=now+i*.075;voices.set(osc,gain);osc.onended=()=>release(osc,gain);osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.065,start+.012);gain.gain.exponentialRampToValueAtTime(.001,start+.105);osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+.12);});}catch{stop();}}
 return {unlock,play,stop};
}
// Local/HTTP/Firebase share the device's audio context, not game state.
export const battleAudio=createBattleAudio();
// Stop already scheduled notes on backgrounding; never replay missed cues.
globalThis.document?.addEventListener?.('visibilitychange',()=>{if(globalThis.document.visibilityState==='hidden')battleAudio.stop();});

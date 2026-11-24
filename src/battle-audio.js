// Optional device-only synthesized cues. One short cue per observed revision.
// No media downloads, no audio timers, no waiting for audio in game actions.
const CUES=Object.freeze({finish:[523,659,784],secret:[392,554,440],turn:[440,660],damage:[180,105],heal:[440,587],death:[220,147],shield:[880,660],attack:[260,180],summon:[330,495],spell:[495,660],buff:[440,550],weaken:[330,220],secretSet:[330,392]});
export function createBattleAudio({context=()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null;},visible=()=>globalThis.document?.visibilityState!=='hidden'}={}){
 let ctx=null,voices=new Set();
 function unlock(enabled){if(!enabled)return;try{ctx??=context();if(ctx?.state==='suspended')Promise.resolve(ctx.resume()).catch(()=>{});}catch{}}
 function stop(){for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
 function play(kind,enabled=true){if(!enabled||!visible()||!ctx||ctx.state!=='running'||!Object.hasOwn(CUES,kind))return;try{stop();const now=ctx.currentTime;CUES[kind].forEach((hz,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),start=now+i*.075;osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.065,start+.012);gain.gain.exponentialRampToValueAtTime(.001,start+.105);osc.connect(gain);gain.connect(ctx.destination);voices.add(osc);osc.onended=()=>{voices.delete(osc);osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(start+.12);});}catch{stop();}}
 return {unlock,play,stop};
}
// Local/HTTP/Firebase share the device's audio context, not game state.
export const battleAudio=createBattleAudio();

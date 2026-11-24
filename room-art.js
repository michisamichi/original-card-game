// Optional presentation-only Firebase asset snapshots. No image is sent with actions.
import {validateArt} from './card-art.js';
export const CLOUD_ART_PATH='ocg-shared-v1/art';
export const ROOM_ART_MAX=240000;
const idOK=id=>typeof id==='string'&&/^u_[a-f0-9]{24}$/.test(id);
export function packDeckArt(deck,art={}){
 const images={};let skipped=0,chars=2,count=0;
 for(const id of new Set(deck)){
  if(!idOK(id)||!Object.hasOwn(art,id))continue;
  try{const value=validateArt(art[id]);const entry=JSON.stringify(id).length+1+JSON.stringify(value).length+(count?1:0);if(chars+entry>ROOM_ART_MAX){skipped++;continue;}images[id]=value;chars+=entry;count++;}catch{skipped++;}
 }
 return {payload:JSON.stringify(images),skipped};
}
export function unpackDeckArt(payload){
 if(typeof payload!=='string'||payload.length>ROOM_ART_MAX)throw Error('共有画像容量不正');
 const raw=JSON.parse(payload);if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>30)throw Error('共有画像形式不正');
 const result={};for(const [id,value] of Object.entries(raw)){if(!idOK(id))throw Error('共有画像ID不正');result[id]=validateArt(value);}return result;
}
export function createRoomArtTransport(backend){
 return {
  publish:async(code,seat,payload)=>{if(![0,1].includes(seat))throw Error('画像の座席不正');unpackDeckArt(payload);await backend.put(code,seat,payload);},
  watch:async(code,{signal,onImages})=>{let last=null,decoded=[{},{}];if(signal.aborted)return;return backend.watch(code,{signal,onValue:raw=>{
   if(signal.aborted)return;const next=[raw?.['0']??null,raw?.['1']??null];if(last&&next.every((x,i)=>x===last[i]))return;
   for(let i=0;i<2;i++){if(last&&next[i]===last[i])continue;decoded[i]={};if(next[i]!==null)try{decoded[i]=unpackDeckArt(next[i]);}catch{/* malformed images never stop gameplay */}}
   last=next;onImages(decoded.map(map=>({...map}))); // Consumers cannot mutate the cached seat maps.
  }});}
 };
}

// Trusted authority prototype. NEVER expose this instance or its records to remote clients.
// Optional trusted synchronous store. Transport must authenticate and rate-limit in production.
import {CATALOG,CATALOG_VERSION,validateDeck} from './cards.js';
import {normalizeCustomCards,buildCatalog} from './custom-cards.js';
import {createGame,applyAction,legalActions,assertState} from './engine.js';
import {exactFields,validActionShape} from './state-validation.js';
export const ROOM_PROTOCOL='ocg-room-1';
const copy=x=>JSON.parse(JSON.stringify(x));
const codeOK=x=>typeof x==='string'&&/^[a-f0-9]{12}$/.test(x);
const tokenOK=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const requestOK=x=>typeof x==='string'&&/^[a-f0-9]{32}$/.test(x);
const fail=m=>{throw Error(m);};
const canonical=x=>Array.isArray(x)?`[${x.map(canonical).join(',')}]`:x!==null&&typeof x==='object'?`{${Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')}}`:JSON.stringify(x);
const recordKeys=['code','tokens','host','state','roomRevision','changedAt','receipts'];
function validReceipt(r,state){
 if(!exactFields(r,['id','fingerprint','revision'])||!requestOK(r.id)||typeof r.fingerprint!=='string'||r.fingerprint.length>512||!Number.isSafeInteger(r.revision)||r.revision<1||r.revision>state.revision)return false;
 try{const a=JSON.parse(r.fingerprint);return validActionShape(a)&&a.matchId===state.matchId&&a.revision===r.revision-1&&canonical(a)===r.fingerprint;}catch{return false;}
}
function enrollment(deck,customCards){
 const cards=normalizeCustomCards(customCards??[]);validateDeck(deck,{catalog:buildCatalog(cards)});
 return {deck:[...deck],customCards:cards.filter(c=>deck.includes(c.id))};
}
function combine(a,b){const cards=new Map();for(const c of [...a.customCards,...b.customCards]){if(cards.has(c.id)&&canonical(cards.get(c.id))!==canonical(c))fail('自作カード定義が競合しています');cards.set(c.id,c);}return normalizeCustomCards([...cards.values()]);}
// Projection is an explicit allowlist: never send full state, RNG, deck order, enemy hidden cards,
// unused custom definitions, enrollment, receipts or credentials. Burned cards are public.
function projection(room,seat){
 const base={protocol:ROOM_PROTOCOL,code:room.code,seat,phase:room.state?'match':'waiting',roomRevision:room.roomRevision};
 if(!room.state)return base;
 const s=room.state,visibleIds=new Set();
 const players=s.players.map((p,i)=>{const own=i===seat;const visible=[...p.board,...p.grave,...(own?[...p.hand,...p.secrets]:[])];for(const c of visible){visibleIds.add(c.cardId);if(c.originCardId)visibleIds.add(c.originCardId);}
 return {hp:p.hp,mana:p.mana,maxMana:p.maxMana,...(p.classId?{classId:p.classId,skillUsed:p.skillUsed,armor:p.armor}:{}),board:p.board,grave:p.grave,deckCount:p.deck.length,handCount:p.hand.length,secretCount:p.secrets.length,...(own?{hand:p.hand,secrets:p.secrets}:{})};});
 // Event card IDs describe public cards only (secretSet and draw have no cardId).
 // Include the public event definitions even if the card is not otherwise visible.
 for(const e of s.events)if(e.cardId)visibleIds.add(e.cardId);
 const customCards=Object.fromEntries(Object.entries(s.customCards).filter(([id])=>visibleIds.has(id)));
 return {...base,match:{matchId:s.matchId,revision:s.revision,status:s.status,activeSeat:s.activeSeat,firstSeat:s.firstSeat,turnNo:s.turnNo,winner:s.winner,reason:s.reason,players,customCards,events:s.events,legalActions:legalActions(s,seat)}};
}
export function createRoomCore({randomInt,maxRooms=64,now=Date.now,waitingMs=30*60000,playingMs=4*3600000,finishedMs=15*60000,store=null}={}){
 if(typeof randomInt!=='function')fail('乱数設定不正');
 if(!Number.isInteger(maxRooms)||maxRooms<1||maxRooms>1024)fail('部屋上限不正');
 if(typeof now!=='function'||![waitingMs,playingMs,finishedMs].every(n=>Number.isSafeInteger(n)&&n>0))fail('有効期限不正');
 if(store&&(typeof store.load!=='function'||typeof store.save!=='function'))fail('保存設定不正');
 const restored=store?store.load():[];
 if(!Array.isArray(restored)||restored.length>maxRooms)fail('保存ルーム数不正');
 let rooms=new Map();
 for(const r of restored){
  if(!exactFields(r,recordKeys)||!codeOK(r.code)||rooms.has(r.code)||!Number.isSafeInteger(r.changedAt)||r.changedAt<0||!Array.isArray(r.tokens)||r.tokens.length!==(r.state?2:1)||!r.tokens.every(tokenOK)||new Set(r.tokens).size!==r.tokens.length||!Array.isArray(r.receipts)||r.receipts.length!==2)fail('保存ルーム不正');
  if(r.state){assertState(r.state);if(r.state.mode!=='standard'||r.state.matchId!=='room-'+r.code||r.roomRevision!==r.state.revision+1||r.host!==null)fail('保存対戦不整合');for(const receipt of r.receipts)if(receipt!==null&&!validReceipt(receipt,r.state))fail('保存操作不正');if(r.state.revision!==Math.max(0,...r.receipts.map(x=>x?.revision??0))||(r.receipts[0]&&r.receipts[1]&&r.receipts[0].revision===r.receipts[1].revision))fail('保存操作不整合');}
  else{if(r.state!==null||r.roomRevision!==0||r.receipts.some(x=>x!==null))fail('保存待機不正');if(!exactFields(r.host,['deck','customCards']))fail('保存待機不正');r.host=enrollment(r.host.deck,r.host.customCards);}
  rooms.set(r.code,copy(r));
 }
 function commit(next){if(store)try{store.save([...next.values()]);}catch{fail('ルーム保存に失敗しました');}rooms=next;}
 function put(r){const next=new Map(rooms);next.set(r.code,r);commit(next);}
 function remove(code){const next=new Map(rooms);next.delete(code);commit(next);}

 const ttl=r=>!r.state?waitingMs:r.state.status==='finished'?finishedMs:playingMs;
 function prune(){const t=now(),expired=[];for(const [code,r] of rooms)if(t-r.changedAt>=ttl(r))expired.push(code);if(expired.length){const next=new Map(rooms);for(const code of expired)next.delete(code);commit(next);}return expired;}

 function request(raw,onExpire=()=>{}){
  try{
   // Simulate JSON wire boundary: reject oversized payloads before parsing/validation.
   const encoded=JSON.stringify(raw);if(typeof encoded!=='string'||encoded.length>100000)fail('通信データ不正または容量超過');
   const q=JSON.parse(encoded);
   if(!q||q.protocol!==ROOM_PROTOCOL||q.catalogVersion!==CATALOG_VERSION)fail('バージョンが一致しません');
   if(!codeOK(q.code)||!tokenOK(q.token))fail('部屋コードまたは参加資格が不正');
   const keys={create:['deck','customCards'],join:['deck','customCards'],sync:[],close:[],act:['requestId','action']} ;
   if(typeof q.type!=='string'||!Object.hasOwn(keys,q.type)||Object.keys(q).some(k=>!['type','protocol','catalogVersion','code','token',...keys[q.type]].includes(k)))fail('通信操作不正');
   for(const code of prune())onExpire(code);let room=rooms.get(q.code);
   if(q.type==='create'){
    if(room){if(room.tokens[0]!==q.token)fail('部屋コード使用済み');return {ok:true,view:copy(projection(room,0))};}
    if(rooms.size>=maxRooms)fail('部屋数上限');
    const entry=enrollment(q.deck,q.customCards);
    room={code:q.code,tokens:[q.token],host:entry,state:null,roomRevision:0,changedAt:now(),receipts:[null,null]};put(room);
    return {ok:true,view:copy(projection(room,0))};
   }
   if(!room)fail('部屋がありません');
   let seat=room.tokens.indexOf(q.token);
   if(q.type==='join'){
    if(seat>=0)return {ok:true,view:copy(projection(room,seat))};
    if(room.state)fail('満室です');
    const entry=enrollment(q.deck,q.customCards),cards=combine(room.host,entry);
    // All validation and game construction must finish before publishing either seat.
    const state=createGame({mode:'standard',decks:[room.host.deck,entry.deck],customCards:cards,seed:randomInt(1,0x100000000),firstSeat:randomInt(0,2),matchId:'room-'+room.code});
    room={...room,state,tokens:[...room.tokens,q.token],host:null,roomRevision:room.roomRevision+1,changedAt:now()};put(room);seat=1;
    return {ok:true,view:copy(projection(room,seat))};
   }
   if(seat<0)fail('参加資格がありません');
   if(q.type==='close'){if(seat!==0||room.state)fail('待機中の作成者のみ削除できます');remove(q.code);return {ok:true,closed:true};}
   if(q.type==='sync')return {ok:true,view:copy(projection(room,seat))};
   if(!room.state||!requestOK(q.requestId)||!validActionShape(q.action))fail('対戦操作不正');
   const fingerprint=canonical(q.action),last=room.receipts[seat];
   if(last?.id===q.requestId){if(last.fingerprint!==fingerprint)fail('操作IDの再利用');return {ok:true,duplicate:true,acceptedRevision:last.revision,view:copy(projection(room,seat))};}
   // The room authority determines actor from the credential, not the caller's claimed seat.
   // No await between verification and commit; future transport needs equivalent atomicity.
   const next=applyAction(room.state,seat,q.action);
   const receipts=[...room.receipts];receipts[seat]={id:q.requestId,fingerprint,revision:next.revision};room={...room,state:next,roomRevision:room.roomRevision+1,changedAt:now(),receipts};put(room);
   return {ok:true,acceptedRevision:next.revision,view:copy(projection(room,seat))};
  }catch(e){return {ok:false,error:e instanceof Error?e.message:'通信処理失敗'};}
 }
 return Object.freeze({request,prune});
}

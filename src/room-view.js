// Validate presentation snapshots before replacing the last usable view.
import {RULES as R,isGeneratedCard} from './cards.js';
import {validBoardState,legalActions} from './engine.js';
import {validInstanceFields,validResult,validEvents,exactFields} from './state-validation.js';
import {TRANSFORM_FORMS} from './effects.js';
import {validateMatchCatalog} from './custom-cards.js';
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const fail=()=>{throw Error('通信対戦状態不正');};
const exact=exactFields;
const rootKeys=['protocol','code','seat','phase','roomRevision'];
const matchKeys=['matchId','revision','status','activeSeat','firstSeat','turnNo','winner','reason','players','customCards','events','legalActions'];
const playerKeys=['hp','mana','maxMana','board','grave','deckCount','handCount','secretCount'];
export function validateRoomView(v){
 if(!v||v.protocol!=='ocg-room-1'||typeof v.code!=='string'||!/^[a-f0-9]{12}$/.test(v.code)||!int(v.seat,0,1)||!['waiting','match'].includes(v.phase)||!int(v.roomRevision,0,Number.MAX_SAFE_INTEGER))fail();
 if(v.phase==='waiting'){if(!exact(v,rootKeys)||v.seat!==0||v.roomRevision!==0)fail();return;}
 if(!exact(v,[...rootKeys,'match']))fail();
 const m=v.match;
 if(!exact(m,matchKeys)||m.matchId!=='room-'+v.code||v.roomRevision!==m.revision+1||typeof m.matchId!=='string'||!m.matchId||m.matchId.length>100||!int(m.revision,0,Number.MAX_SAFE_INTEGER-1)||!int(m.turnNo,1,Number.MAX_SAFE_INTEGER)||!int(m.activeSeat,0,1)||!int(m.firstSeat,0,1)||m.activeSeat!==(m.firstSeat+(m.turnNo-1)%2)%2||!['playing','finished'].includes(m.status)||!Array.isArray(m.players)||m.players.length!==2||!Array.isArray(m.events)||m.events.length>64||m.events.some(e=>!e||typeof e.type!=='string')||!Array.isArray(m.legalActions)||m.legalActions.length>200)fail();
 if(m.status==='playing'?(m.winner!==null||m.reason!==null):(!['hp','deck','concede'].includes(m.reason)||!(m.winner===null||int(m.winner,0,1))))fail();
 const catalog=validateMatchCatalog(m.customCards),ids=new Set(),visibleIds=new Set();if(!validEvents(m.events,catalog))fail();for(const e of m.events)if(e.cardId)visibleIds.add(e.cardId);
 for(let i=0;i<2;i++){
  const p=m.players[i];
  if(!exact(p,i===v.seat?[...playerKeys,'hand','secrets']:playerKeys)||!int(p.hp,0,R.hp)||!int(p.maxMana,0,R.manaCap)||!int(p.mana,0,p.maxMana)||!int(p.deckCount,0,R.deckSize)||!int(p.handCount,0,R.handCap)||!int(p.secretCount,0,R.secretCap)||!Array.isArray(p.board)||p.board.length>R.boardCap||!Array.isArray(p.grave)||p.grave.length>R.instanceCap||p.board.length+p.grave.length+p.deckCount+p.handCount+p.secretCount<R.deckSize||p.board.length+p.grave.length+p.deckCount+p.handCount+p.secretCount>R.instanceCap||Object.hasOwn(p,'deck'))fail();
  if(i===v.seat){if(!Array.isArray(p.hand)||p.hand.length!==p.handCount||!Array.isArray(p.secrets)||p.secrets.length!==p.secretCount)fail();}else if(Object.hasOwn(p,'hand')||Object.hasOwn(p,'secrets'))fail();
  const initialCopies=new Map(),total=p.board.length+p.grave.length+p.deckCount+p.handCount+p.secretCount;
  for(const zone of i===v.seat?['board','grave','hand','secrets']:['board','grave'])for(const c of p[zone]){
   if(!validInstanceFields(c,zone)||typeof c.instanceId!=='string'||!/^([01]):(0|[1-9][0-9]?)$/.test(c.instanceId)||!c.instanceId.startsWith(`${i}:`)||Number(c.instanceId.slice(2))>=total||ids.has(c.instanceId)||c.ownerSeat!==i||!Object.hasOwn(catalog,c.cardId))fail();if(Object.hasOwn(c,'originCardId')&&(!Object.hasOwn(catalog,c.originCardId)||catalog[c.originCardId].type!=='minion'||!Object.values(TRANSFORM_FORMS).includes(c.cardId)||zone==='secrets'))fail();if(Object.hasOwn(c,'costDelta')&&(zone!=='hand'||!int(c.costDelta,-catalog[c.cardId].manaCost,R.manaCap-catalog[c.cardId].manaCost)))fail();if(Object.hasOwn(c,'silenced')&&(zone!=='board'||c.silenced!==true))fail();if(Number(c.instanceId.slice(2))>=R.deckSize&&(!isGeneratedCard(c.originCardId??c.cardId)||zone==='secrets'))fail();if(Number(c.instanceId.slice(2))<R.deckSize){const id=c.originCardId??c.cardId,n=(initialCopies.get(id)??0)+1;if(n>R.copies)fail();initialCopies.set(id,n);}ids.add(c.instanceId);visibleIds.add(c.cardId);if(c.originCardId)visibleIds.add(c.originCardId);
  }
  for(const c of p.board)if(!validBoardState(catalog[c.cardId],c,m.turnNo))fail();
  if(i===v.seat&&(p.secrets.some(c=>catalog[c.cardId].type!=='secret')||new Set(p.secrets.map(c=>c.cardId)).size!==p.secrets.length))fail();
 }
 if(Object.keys(m.customCards).some(id=>!visibleIds.has(id))||!validResult(m))fail();
 // Recompute the entire list from public board and our own hand; no hidden deck is needed.
 // Reject missing, duplicate, impossible or unexpected actions without replacing the last view.
 const expected=legalActions(m,v.seat);
 if(m.legalActions.length!==expected.length)fail();
 const key=a=>JSON.stringify([a.type,a.card,a.attacker,a.target,a.matchId,a.revision]);
 const remaining=new Map(expected.map(a=>[key(a),a]));
 for(const a of m.legalActions){if(!a||typeof a!=='object'||Array.isArray(a))fail();const k=key(a),e=remaining.get(k);if(!e||Object.keys(a).length!==Object.keys(e).length||Object.keys(e).some(f=>!Object.hasOwn(a,f)||a[f]!==e[f]))fail();remaining.delete(k);}
}

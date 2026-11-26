// Shared structural validation for authoritative states and seat projections.
import {CLASS_SKILLS,ARMOR_CAP} from './class-skills.js';
import {KEYWORD_LABELS,RULES as R} from './cards.js';
import {FOLLOW_CONDITIONS,TIMING_LABELS} from './effects.js';
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export const exactFields=(o,keys)=>!!o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const baseKeys=['instanceId','cardId','ownerSeat','originCardId'];
const boardKeys=new Set([...baseKeys,'currentHealth','summonedTurn','attacksUsed','attackBonus','healthBonus','tempAttack','grantedKeywords','shieldSpent','stealthSpent','silenced']);
const handKeys=new Set([...baseKeys,'costDelta']);
const bareKeys=new Set(baseKeys);
export const instanceIdOK=id=>typeof id==='string'&&/^[01]:(0|[1-9][0-9]?)$/.test(id);
export function validActionShape(a){
 if(!a||typeof a.type!=='string'||typeof a.matchId!=='string'||!a.matchId||a.matchId.length>100||!Number.isSafeInteger(a.revision)||a.revision<0)return false;
 const base=['type','matchId','revision'];
 if(a.type==='end'||a.type==='concede')return exactFields(a,base);
 if(a.type==='skill')return !Object.hasOwn(a,'target')?exactFields(a,base):exactFields(a,[...base,'target'])&&(a.target==='hero'||instanceIdOK(a.target));
 if(a.type==='play')return instanceIdOK(a.card)&&(!Object.hasOwn(a,'target')?exactFields(a,[...base,'card']):exactFields(a,[...base,'card','target'])&&(a.target==='hero'||instanceIdOK(a.target)));
 return a.type==='attack'&&exactFields(a,[...base,'attacker','target'])&&instanceIdOK(a.attacker)&&(a.target==='hero'||instanceIdOK(a.target));
}
export function validInstanceFields(c,zone){
 if(!c||typeof c!=='object'||Array.isArray(c)||typeof c.cardId!=='string'||Object.hasOwn(c,'originCardId')&&typeof c.originCardId!=='string')return false;
 const keys=zone==='board'?boardKeys:zone==='hand'?handKeys:bareKeys;
 return Object.keys(c).every(k=>keys.has(k));
}
export function validResult(s){
 const d0=s.players[0].hp===0,d1=s.players[1].hp===0;
 if(s.status==='playing')return !d0&&!d1&&s.winner===null&&s.reason===null;
 if(s.status!=='finished')return false;
 if(s.reason==='hp')return (d0||d1)&&s.winner===(d0&&d1?null:d0?1:0);
 if(!['deck','concede'].includes(s.reason)||d0||d1||!int(s.winner,0,1))return false;
 if(s.reason==='deck'){const loser=s.players[1-s.winner];return (loser.deck?.length??loser.deckCount)===0;}
 return true;
}
// Explicit event shapes also prevent accidental disclosure through extra fields in public logs.
const seat=n=>int(n,0,1),target=id=>id==='hero'||instanceIdOK(id),stat=n=>int(n,0,99),amount=n=>int(n,0,99),delta=n=>int(n,-R.manaCap,R.manaCap);
const cardId=(id,catalog)=>typeof id==='string'&&Object.hasOwn(catalog,id);
const named=(dict,v)=>typeof v==='string'&&Object.hasOwn(dict,v);
const schemas={};
function add(types,fields){for(const type of types.split(' '))schemas[type]=Object.entries(fields);}
add('draw secretSet generate fetch attackCancelled',{seat});
add('skill',{seat,classId:v=>named(CLASS_SKILLS,v)});
add('armorChange',{seat,amount:n=>int(n,-ARMOR_CAP,ARMOR_CAP)});
add('burn secretReveal abilitySkipped discard recover play',{seat,cardId});
add('death specialSummon revive returnHand',{seat,cardId,instanceId:instanceIdOK});
add('stealthBroken silence transform destroy poisonous',{seat,cardId,target:instanceIdOK});
add('turn',{seat,turn:n=>int(n,1,Number.MAX_SAFE_INTEGER)});
add('finish',{winner:n=>n===null||seat(n),reason:v=>['hp','deck','concede'].includes(v)});
add('ability',{seat,cardId,when:v=>named(TIMING_LABELS,v)&&v!=='none'});
add('abilityFollowUp',{seat,cardId,condition:v=>named(FOLLOW_CONDITIONS,v)});
add('buff weaken',{seat,target:instanceIdOK,attack:stat,health:stat});
add('tempBuff tempExpired',{seat,target:instanceIdOK,attack:stat});
add('manaChange',{seat,mana:delta,maxMana:delta});
add('costChange',{seat,count:n=>int(n,0,R.handCap),direction:v=>v==='up'||v==='down'});
add('setStat',{seat,target:instanceIdOK,cardId,stat:v=>v==='attack'||v==='health',amount:n=>int(n,1,30)});
add('keywordGranted',{seat,target:instanceIdOK,cardId,keyword:v=>named(KEYWORD_LABELS,v)});
add('shieldBroken',{seat,target:instanceIdOK,cardId,prevented:n=>int(n,1,99)});
add('damage',{seat,target,amount});
add('lifesteal',{seat,amount});
add('attack',{seat,attacker:instanceIdOK,target});
const heroHeal=Object.entries({seat,amount}),minionHeal=Object.entries({seat,target:instanceIdOK,amount});
export function validEvents(events,catalog){
 if(!Array.isArray(events)||events.length>64)return false;
 for(const e of events){if(!e||typeof e!=='object'||Array.isArray(e)||typeof e.type!=='string')return false;
  const fields=e.type==='heal'?(Object.hasOwn(e,'target')?minionHeal:heroHeal):Object.hasOwn(schemas,e.type)?schemas[e.type]:null;
  if(!fields||Object.keys(e).length!==fields.length+1)return false;
  for(const [key,check] of fields)if(!Object.hasOwn(e,key)||!check(e[key],catalog))return false;
  if(e.instanceId!==undefined&&!e.instanceId.startsWith(`${e.seat}:`))return false;
  if(e.attacker!==undefined&&!e.attacker.startsWith(`${e.seat}:`))return false;
  if(e.target!==undefined&&e.target!=='hero'&&!e.target.startsWith(`${e.type==='attack'?1-e.seat:e.seat}:`))return false;
 }
 return true;
}

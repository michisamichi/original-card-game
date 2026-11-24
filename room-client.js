import {CATALOG_VERSION} from './cards.js';
import {validateRoomView} from './room-view.js';
import {exactFields} from './state-validation.js';
const PROTOCOL='ocg-room-1';
const copy=x=>JSON.parse(JSON.stringify(x));
// Compare JSON snapshots without depending on object member order. Arrays retain order.
function sameSnapshot(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameSnapshot(a[k],b[k]));}
const rejected=r=>exactFields(r,['ok','error'])&&r.ok===false&&typeof r.error==='string'&&r.error.trim().length>0&&r.error.length<=1000;
function validReply(r,type){if(r?.ok!==true)return false;if(type!=='act')return exactFields(r,['ok','view']);return exactFields(r,['ok','view','acceptedRevision'])||exactFields(r,['ok','view','acceptedRevision','duplicate'])&&r.duplicate===true;}
const randomId=n=>Array.from(globalThis.crypto.getRandomValues(new Uint8Array(n)),v=>v.toString(16).padStart(2,'0')).join('');
export const createRoomCredentials=()=>({code:randomId(6),token:randomId(32)});
export function createRoomClient({send,code,token}){
 if(typeof send!=='function'||typeof code!=='string'||!/^[a-f0-9]{12}$/.test(code)||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw Error('通信設定不正');
 let current=null,pending=null,inFlight=false,closing=false,generation=0;
 async function exchange(type,extra={}){
  if(closing)throw Error('部屋を削除中です');const epoch=generation;
  const result=await send({protocol:PROTOCOL,catalogVersion:CATALOG_VERSION,type,code,token,...copy(extra)});
  if(epoch!==generation)throw Error('削除前の通信応答を無視しました');
  if(rejected(result))throw Object.assign(Error(result.error),{definitive:true});
  if(result?.ok!==true)throw Error('通信応答不正');
  const v=result?.view;
  if(result?.ok!==true||v?.protocol!==PROTOCOL||v.code!==code||![0,1].includes(v.seat)||!Number.isSafeInteger(v.roomRevision)||v.roomRevision<0||!['waiting','match'].includes(v.phase)||(v.phase==='match'&&(!v.match||v.match.matchId!=='room-'+code||v.roomRevision!==v.match.revision+1))||(v.phase==='waiting'&&v.roomRevision!==0)||(current&&current.seat!==v.seat))throw Error('通信応答不正');
  if(type==='act'&&(result.acceptedRevision!==extra.action.revision+1||v.phase!=='match'||v.match.revision<result.acceptedRevision))throw Error('操作確定を確認できません');
  if(!validReply(result,type))throw Error('通信応答不正');
  const newer=!current||v.roomRevision>current.roomRevision;
  if(newer||type==='act')validateRoomView(v);
  if(current&&v.roomRevision===current.roomRevision&&!sameSnapshot(current,v))throw Error('同じ更新番号の通信状態が一致しません');
  if(newer&&current?.match&&(v.match.firstSeat!==current.match.firstSeat||v.match.turnNo<current.match.turnNo||v.match.turnNo-current.match.turnNo>v.match.revision-current.match.revision||current.match.status==='finished'))throw Error('通信対戦の進行が不整合です');
  if(newer)current=copy(v);
  return copy(current);
 }
 async function transmit(){if(!pending||inFlight)throw Error('送信中または再送対象なし');inFlight=true;try{const v=await exchange('act',pending);pending=null;return v;}catch(e){if(e.definitive)pending=null;throw e;}finally{inFlight=false;}}
 return Object.freeze({
  create:(deck,customCards=[])=>exchange('create',{deck,customCards}),join:(deck,customCards=[])=>exchange('join',{deck,customCards}),sync:()=>exchange('sync'),
  close:async()=>{if(closing||pending||inFlight||current?.phase!=='waiting')throw Error('待機中のみ削除できます');closing=true;try{const r=await send({protocol:PROTOCOL,catalogVersion:CATALOG_VERSION,type:'close',code,token});if(!exactFields(r,['ok','closed'])||r.ok!==true||r.closed!==true)throw Error(rejected(r)?r.error:'削除応答不正');generation++;current=null;}finally{closing=false;}},
  revision:()=>current?.roomRevision??-1,snapshot:()=>current?copy(current):null,hasPending:()=>pending!==null,
  act:a=>{if(closing)throw Error('部屋を削除中です');if(pending)throw Error('前の操作の応答待ち');if(!current?.match||current.match.status!=='playing'||a?.matchId!==current.match.matchId||a.revision!==current.match.revision)throw Error('古い操作または対戦なし');pending={requestId:randomId(16),action:copy(a)};return transmit();},retry:transmit
 });
}

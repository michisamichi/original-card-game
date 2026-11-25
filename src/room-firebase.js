// Shared-state, trusted-friends mode ONLY. Firebase UID is the credential;
// the core's seat tokens below are placeholders, never security credentials.
import {createRoomCore,ROOM_PROTOCOL} from './room-core.js';
import {CATALOG_VERSION} from './cards.js';
import {exactFields} from './state-validation.js';
export const CLOUD_PATH='ocg-shared-v1/rooms';
export const CLOUD_MODE='ocg-shared-1';
const T=['a'.repeat(64),'b'.repeat(64)];
const fail=error=>({ok:false,error});
const codeOK=x=>typeof x==='string'&&/^[a-f0-9]{12}$/.test(x);
const uidOK=x=>typeof x==='string'&&x.length>0&&x.length<=128;
const ttl=phase=>phase==='waiting'?1800000:phase==='finished'?900000:14400000;
const phaseOf=r=>!r.state?'waiting':r.state.status==='finished'?'finished':'match';
const copy=x=>JSON.parse(JSON.stringify(x));
// JSON string prevents RTDB from dropping empty arrays and nulls inside the game state.
function pack(room,host,guest){const payload=JSON.stringify(room);if(payload.length>240000)throw Error('対戦データ容量超過');return {mode:CLOUD_MODE,host,guest,phase:phaseOf(room),revision:room.roomRevision,updatedAt:room.changedAt,payload};}
function unpack(record,code){if(!exactFields(record,['mode','host','guest','phase','revision','updatedAt','payload'])||record.mode!==CLOUD_MODE||!uidOK(record.host)||!(record.guest===''||uidOK(record.guest)&&record.guest!==record.host)||!['waiting','match','finished'].includes(record.phase)||!Number.isSafeInteger(record.revision)||record.revision<0||!Number.isSafeInteger(record.updatedAt)||record.updatedAt<0||typeof record.payload!=='string'||record.payload.length>240000)throw Error('共有ルーム形式不正');const r=JSON.parse(record.payload);if(!r||typeof r!=='object'||Array.isArray(r)||r.code!==code||r.roomRevision!==record.revision||r.changedAt!==record.updatedAt||phaseOf(r)!==record.phase||JSON.stringify(r.tokens)!==JSON.stringify(record.guest?[...T]:[T[0]])||(record.phase==='waiting')!==!record.guest)throw Error('共有ルーム状態不整合');return r;}
// Pure transition. Stable entropy and time across retries; no side effects in callback.
export function transitionShared(record,q,uid,{now,seed,firstSeat}){
 try{
 if(!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(seed)||seed<1||seed>0xffffffff||![0,1].includes(firstSeat)||!uidOK(uid)||!codeOK(q?.code)||q.protocol!==ROOM_PROTOCOL||q.catalogVersion!==CATALOG_VERSION)return {result:fail('通信設定不正')};
 if(!['create','join','sync','close','act'].includes(q.type))return {result:fail('通信操作不正')};
 const raw=JSON.stringify(q);if(raw.length>100000)return {result:fail('通信データ容量超過')};
 const room=record?unpack(record,q.code):null;
 if(record&&now-record.updatedAt>=ttl(record.phase))return {result:fail('部屋の有効期限が切れました')};
 let seat=record?.host===uid?0:record?.guest===uid?1:-1;
 if(q.type==='create'){if(record&&seat!==0)return {result:fail('部屋コード使用済み')};seat=0;}
 else if(!record)return {result:fail('部屋がありません')};
 else if(q.type==='join'&&seat===0)return {result:fail('作成者と同じ認証情報です')};
 else if(q.type==='join'&&seat<0){if(record.guest)return {result:fail('満室です')};seat=1;}
 else if(seat<0)return {result:fail('参加資格がありません')};
 let saved=room?[room]:[],changed=false;
 const core=createRoomCore({maxRooms:1,now:()=>Math.max(now,room?.changedAt??0),randomInt:(a,b)=>b===2?firstSeat:seed,store:{load:()=>saved,save:r=>{saved=copy(r);changed=true;}}});
 const result=core.request({...q,token:T[seat]});
 if(!result.ok||!changed)return {result};
 return {result,next:saved.length?pack(saved[0],record?.host??uid,record?.guest||(q.type==='join'?uid:'')):null};
 }catch(e){return {result:fail(e.message||'共有ルーム処理失敗')};}
}
const entropy=()=>{const x=globalThis.crypto.getRandomValues(new Uint32Array(2));return {seed:x[0]||1,firstSeat:x[1]%2};};
// Adapter interface: read(code), transaction(code, reducer), watch(code,...), uid(), clock().
export function createSharedTransport(backend,{random=entropy}={}){
 const send=async(q,{freshCreate=false}={})=>{const uid=await backend.uid();const time={now:await backend.clock(),...random()};if(q.type==='sync')return transitionShared(await backend.read(q.code),q,uid,time).result;
 let outcome;
 const tx=await backend.transaction(q.code,record=>{outcome=freshCreate&&q.type==='create'&&record?{result:fail('部屋コード使用済み')}:transitionShared(record,q,uid,time);return Object.hasOwn(outcome,'next')?outcome.next:undefined;});
 if(!outcome)throw Error('通信応答不正');
 if(Object.hasOwn(outcome,'next')&&!tx.committed)throw Error('操作確定を確認できません');
 return outcome.result;
 };
 // The observed snapshot already contains the committed state. Project it for this seat
 // instead of requiring the UI to fetch the same revision a second time.
 const watch=async(credentials,{signal,onSignal})=>{const uid=await backend.uid();if(signal.aborted)return;const serverNow=await backend.clock(),started=Date.now();if(signal.aborted)return;return backend.watch(credentials.code,{signal,onValue:record=>{if(signal.aborted)return;if(!record){onSignal({closed:true});return;}const result=transitionShared(record,{...credentials,protocol:ROOM_PROTOCOL,catalogVersion:CATALOG_VERSION,type:'sync'},uid,{now:Math.max(0,serverNow+Math.max(0,Date.now()-started)),seed:1,firstSeat:0}).result;if(!result.ok)throw Error(result.error);onSignal({revision:result.view.roomRevision},result);}});};
 return {send,watch};
}

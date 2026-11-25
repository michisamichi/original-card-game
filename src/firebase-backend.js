import {CLOUD_ART_PATH,createRoomArtTransport} from './room-art.js';
import {firebaseConfigStatus} from './diagnostics.js';
import {CLOUD_CONFIG} from './cloud-config.js';
import {CLOUD_PATH,createSharedTransport} from './room-firebase.js';
const VERSION='11.10.0'; // 初代と同じ固定SDK版
const NAME='original-card-game-shared-v1';

const bounded=(promise,ms=15000)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('通信応答待ちの上限に達しました。再接続してください')),ms);Promise.resolve(promise).then(x=>{clearTimeout(timer);resolve(x);},e=>{clearTimeout(timer);reject(e);});});
// Wait for the initial value event before running a transaction. A get() alone
// need not have populated the transaction cache. Never treat an unexpected null
// as a definitive missing room or use an older snapshot to overwrite it.
export async function runObservedTransaction(s,r,fn){let stop=()=>{},observed=null;
 try{
  await bounded(new Promise((resolve,reject)=>{stop=s.onValue(r,snap=>{observed=snap.val();resolve();},reject);}));
  for(let attempt=0;attempt<2;attempt++){
   let uncached=false;
   const tx=await bounded(s.runTransaction(r,current=>{uncached=current===null&&observed!==null;return uncached?undefined:fn(current);},{applyLocally:false}));
   if(!uncached||tx.committed)return tx;
   if(attempt===0)await bounded(s.get(r));
  }
  throw Error('部屋の最新状態を取得できません。状態を更新して再試行してください');
 }finally{stop();}
}
// .info is SDK-local metadata, not an ordinary server database path.
// get() can send the special path to the server and fail with Invalid token in path.
export async function readServerClock(s,db,{now=Date.now,timeoutMs=8000}={}){
 let stop=()=>{};
 try{
  const offset=await bounded(new Promise((resolve,reject)=>{
   stop=s.onValue(s.ref(db,'.info/serverTimeOffset'),snap=>{const value=snap.val();if(typeof value==='number'&&Number.isFinite(value))resolve(value);},reject);
  }),timeoutMs);
  return Math.round(now()+offset);
 }finally{stop();}
}
export function createFirebaseConnection(config=CLOUD_CONFIG){let loading=null;
 async function init(){const status=firebaseConfigStatus(config);if(status!=='configured')throw Error(status==='unconfigured'?'新ゲーム専用Firebaseの設定が未入力です':'新ゲーム専用Firebaseの設定形式が不正です');
 if(!loading)loading=(async()=>{const [appSdk,authSdk,dbSdk]=await Promise.all(['app','auth','database'].map(n=>import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-${n}.js`)));const app=appSdk.getApps().find(a=>a.name===NAME)||appSdk.initializeApp(config,NAME);const auth=authSdk.getAuth(app);await auth.authStateReady();if(!auth.currentUser)await authSdk.signInAnonymously(auth);if(!auth.currentUser?.isAnonymous)throw Error('匿名認証が必要です');const db=dbSdk.getDatabase(app);return {auth,db,s:dbSdk};})().catch(e=>{loading=null;throw e;});return bounded(loading);}
 // A one-shot connection check, with a hard timeout and listener cleanup.
 async function requireConnection(s,db){let stop=()=>{};try{await bounded(new Promise((resolve,reject)=>{stop=s.onValue(s.ref(db,'.info/connected'),snap=>{if(snap.val()===true)resolve();},reject);}),8000);}finally{stop();}}
 const roomRef=(s,db,code)=>{if(!/^[a-f0-9]{12}$/.test(code))throw Error('部屋コード不正');return s.ref(db,`${CLOUD_PATH}/${code}`);};
 const backend={uid:async()=>{const {auth}=await init();if(!auth.currentUser?.isAnonymous)throw Error('匿名認証が必要です');return auth.currentUser.uid;},clock:async()=>{const {s,db}=await init();try{await requireConnection(s,db);return await readServerClock(s,db);}catch(e){throw Error('サーバー時刻取得：'+(e?.message||'通信失敗'));}},read:async code=>{const {s,db}=await init();await requireConnection(s,db);const snap=await bounded(s.get(roomRef(s,db,code)));return snap.val();},transaction:async(code,fn)=>{const {s,db}=await init();await requireConnection(s,db);const r=roomRef(s,db,code);return runObservedTransaction(s,r,fn);},watch:async(code,{signal,onValue})=>{const {s,db}=await init();if(signal.aborted)return;return new Promise((resolve,reject)=>{let unsubRoom=()=>{},unsubConn=()=>{},done=false,connected=false;const finish=e=>{if(done)return;done=true;signal.removeEventListener('abort',abort);unsubRoom();unsubConn();e?reject(e):resolve();};const abort=()=>finish();signal.addEventListener('abort',abort,{once:true});unsubConn=s.onValue(s.ref(db,'.info/connected'),snap=>{if(done)return;if(snap.val()===true){if(connected)return;connected=true;unsubRoom=s.onValue(roomRef(s,db,code),r=>{if(!done)try{onValue(r.val());}catch(e){finish(e);}},finish);if(done)unsubRoom();}else if(connected)finish(Error('Firebase通信切断'));},finish);if(done)unsubConn();});}};
 const artRef=(s,db,code)=>{if(!/^[a-f0-9]{12}$/.test(code))throw Error('部屋コード不正');return s.ref(db,`${CLOUD_ART_PATH}/${code}`);};
 const art=createRoomArtTransport({put:async(code,seat,payload)=>{const {s,db}=await init();await requireConnection(s,db);const r=s.child(artRef(s,db,code),String(seat));
  // Write-once. Retry of the identical snapshot is safe; never overwrite an existing image set.
  let stop=()=>{};try{stop=s.onValue(r,()=>{},()=>{});const existing=(await bounded(s.get(r))).val();if(existing===payload)return;if(existing!==null)throw Error('共有画像は既に登録されています');const tx=await bounded(s.runTransaction(r,current=>current===null?payload:undefined,{applyLocally:false}));
  if(!tx.committed&&tx.snapshot.val()!==payload)throw Error('共有画像は既に登録されています');}finally{stop();}
 },watch:async(code,{signal,onValue})=>{const {s,db}=await init();if(signal.aborted)return;return new Promise((resolve,reject)=>{let stop=()=>{},done=false;const finish=e=>{if(done)return;done=true;signal.removeEventListener('abort',abort);stop();e?reject(e):resolve();};const abort=()=>finish();signal.addEventListener('abort',abort,{once:true});stop=s.onValue(artRef(s,db,code),snap=>{if(!done)try{onValue(snap.val());}catch(e){finish(e);}},finish);if(done)stop();});}});
 return {...createSharedTransport(backend),art};
}

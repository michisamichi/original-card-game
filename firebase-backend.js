import {CLOUD_ART_PATH,createRoomArtTransport} from './room-art.js';
import {firebaseConfigStatus} from './diagnostics.js';
import {CLOUD_CONFIG} from './cloud-config.js';
import {CLOUD_PATH,createSharedTransport} from './room-firebase.js';
const VERSION='11.10.0'; // 初代と同じ固定SDK版
const NAME='original-card-game-shared-v1';

const bounded=(promise,ms=15000)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('通信応答待ちの上限に達しました。再接続してください')),ms);Promise.resolve(promise).then(x=>{clearTimeout(timer);resolve(x);},e=>{clearTimeout(timer);reject(e);});});
export function createFirebaseConnection(config=CLOUD_CONFIG){let loading=null;
 async function init(){const status=firebaseConfigStatus(config);if(status!=='configured')throw Error(status==='unconfigured'?'新ゲーム専用Firebaseの設定が未入力です':'新ゲーム専用Firebaseの設定形式が不正です');
 if(!loading)loading=(async()=>{const [appSdk,authSdk,dbSdk]=await Promise.all(['app','auth','database'].map(n=>import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-${n}.js`)));const app=appSdk.getApps().find(a=>a.name===NAME)||appSdk.initializeApp(config,NAME);const auth=authSdk.getAuth(app);await auth.authStateReady();if(!auth.currentUser)await authSdk.signInAnonymously(auth);if(!auth.currentUser?.isAnonymous)throw Error('匿名認証が必要です');const db=dbSdk.getDatabase(app);return {auth,db,s:dbSdk};})().catch(e=>{loading=null;throw e;});return bounded(loading);}
 // A one-shot connection check, with a hard timeout and listener cleanup.
 async function requireConnection(s,db){let stop=()=>{};try{await bounded(new Promise((resolve,reject)=>{stop=s.onValue(s.ref(db,'.info/connected'),snap=>{if(snap.val()===true)resolve();},reject);}),8000);}finally{stop();}}
 const roomRef=(s,db,code)=>{if(!/^[a-f0-9]{12}$/.test(code))throw Error('部屋コード不正');return s.ref(db,`${CLOUD_PATH}/${code}`);};
 const backend={uid:async()=>{const {auth}=await init();if(!auth.currentUser?.isAnonymous)throw Error('匿名認証が必要です');return auth.currentUser.uid;},clock:async()=>{const {s,db}=await init();const snap=await bounded(s.get(s.ref(db,'.info/serverTimeOffset')));return Math.round(Date.now()+(Number(snap.val())||0));},read:async code=>{const {s,db}=await init();await requireConnection(s,db);const snap=await bounded(s.get(roomRef(s,db,code)));return snap.val();},transaction:async(code,fn)=>{const {s,db}=await init();await requireConnection(s,db);const r=roomRef(s,db,code);let stop=()=>{};try{
 // Retain a listener while reading and transacting so an uncached initial null does not abort a valid join.
 stop=s.onValue(r,()=>{},()=>{});await bounded(s.get(r));return await bounded(s.runTransaction(r,fn,{applyLocally:false}));
 }finally{stop();}},watch:async(code,{signal,onValue})=>{const {s,db}=await init();if(signal.aborted)return;return new Promise((resolve,reject)=>{let unsubRoom=()=>{},unsubConn=()=>{},done=false,connected=false;const finish=e=>{if(done)return;done=true;signal.removeEventListener('abort',abort);unsubRoom();unsubConn();e?reject(e):resolve();};const abort=()=>finish();signal.addEventListener('abort',abort,{once:true});unsubConn=s.onValue(s.ref(db,'.info/connected'),snap=>{if(done)return;if(snap.val()===true){if(connected)return;connected=true;unsubRoom=s.onValue(roomRef(s,db,code),r=>{if(!done)try{onValue(r.val());}catch(e){finish(e);}},finish);if(done)unsubRoom();}else if(connected)finish(Error('Firebase通信切断'));},finish);if(done)unsubConn();});}};
 const artRef=(s,db,code)=>{if(!/^[a-f0-9]{12}$/.test(code))throw Error('部屋コード不正');return s.ref(db,`${CLOUD_ART_PATH}/${code}`);};
 const art=createRoomArtTransport({put:async(code,seat,payload)=>{const {s,db}=await init();await requireConnection(s,db);const r=s.child(artRef(s,db,code),String(seat));
  // Write-once. Retry of the identical snapshot is safe; never overwrite an existing image set.
  let stop=()=>{};try{stop=s.onValue(r,()=>{},()=>{});const existing=(await bounded(s.get(r))).val();if(existing===payload)return;if(existing!==null)throw Error('共有画像は既に登録されています');const tx=await bounded(s.runTransaction(r,current=>current===null?payload:undefined,{applyLocally:false}));
  if(!tx.committed&&tx.snapshot.val()!==payload)throw Error('共有画像は既に登録されています');}finally{stop();}
 },watch:async(code,{signal,onValue})=>{const {s,db}=await init();if(signal.aborted)return;return new Promise((resolve,reject)=>{let stop=()=>{},done=false;const finish=e=>{if(done)return;done=true;signal.removeEventListener('abort',abort);stop();e?reject(e):resolve();};const abort=()=>finish();signal.addEventListener('abort',abort,{once:true});stop=s.onValue(artRef(s,db,code),snap=>{if(!done)try{onValue(snap.val());}catch(e){finish(e);}},finish);if(done)stop();});}});
 return {...createSharedTransport(backend),art};
}

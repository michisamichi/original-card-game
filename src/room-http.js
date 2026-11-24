import {CATALOG_VERSION} from './cards.js';
// Same-origin transport: never put seat tokens in URLs.
export function createHttpTransport(fetcher=globalThis.fetch,{timeout=12000}={}){return async q=>{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
 try{const r=await fetcher('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q),cache:'no-store',signal:controller.signal});
 if(r.status===429)throw Error('通信回数の上限に達しました。少し時間を置いて再試行してください');
 if(!r.ok)throw Error('通信サーバーに接続できません');return await r.json();
 }catch(e){if(controller.signal.aborted)throw Error('通信応答待ちの上限に達しました。再接続してください');throw e;}finally{clearTimeout(timer);}
};}

// Notification-only stream: no hidden game state or credentials in notifications.
export async function watchRoom(credentials,{signal,onSignal,fetcher=globalThis.fetch}={}){
 if(signal?.aborted)return;
 const r=await fetcher('/api/room/watch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({protocol:'ocg-room-1',catalogVersion:CATALOG_VERSION,type:'sync',...credentials}),cache:'no-store',signal});
 if(!r.ok||!r.body||!r.headers.get('content-type')?.startsWith('application/x-ndjson'))throw Error('更新通知に接続できません');
 const reader=r.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let buf='';try{while(true){const {done,value}=await reader.read();if(done){if(!signal?.aborted)buf+=decoder.decode();break;}buf+=decoder.decode(value,{stream:true});const lines=buf.split('\n');buf=lines.pop();if(buf.length>256)throw Error('通知不正');for(const line of lines){if(!line)continue;if(line.length>256)throw Error('通知不正');const x=JSON.parse(line);if(signal?.aborted)return;if(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===1&&(x.closed===true||Number.isSafeInteger(x.revision)&&x.revision>=0))onSignal(x);else throw Error('通知不正');}}if(buf.length&&!signal?.aborted)throw Error('通知が途中で終了しました');}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

// Local development authority, not an internet deployment. Optional private persistence.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createRoomService} from './src/room-service.js';
import {createFileRoomStore} from './src/room-store.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const staticOK=p=>p==='/index.html'||p==='/style.css'||/^\/src\/(?!room-(?:service|store)\.js$)[a-z-]+\.js$/.test(p);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
function json(res,status,data){res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
async function read(req){let n=0;const chunks=[];for await(const c of req){n+=c.length;if(n>120000)throw Error('too large');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
export function createRoomHttpServer({service=createRoomService(),rateLimit=600,rateWindowMs=60000,now=Date.now}={}){
 if(!Number.isSafeInteger(rateLimit)||rateLimit<1||!Number.isSafeInteger(rateWindowMs)||rateWindowMs<1)throw Error('rate limit invalid');
 const watchers=new Map(),rates=new Map();let windowStart=now(),total=0;
 function allow(ip){const t=now();if(t-windowStart>=rateWindowMs){rates.clear();total=0;windowStart=t;}if(total>=rateLimit*10||(!rates.has(ip)&&rates.size>=256))return false;const n=rates.get(ip)||0;if(n>=rateLimit)return false;rates.set(ip,n+1);total++;return true;}
 function expire(){for(const code of service.prune())publish(code,{closed:true});}

 function publish(code,signal){for(const [key,r] of watchers){if(!key.startsWith(code+':'))continue;if(signal.closed)watchers.delete(key);if(r.destroyed||r.writableEnded||!r.write(JSON.stringify(signal)+'\n'))r.destroy();else if(signal.closed)r.end();}}
 function watch(q,res){
  if(q?.type!=='sync')return json(res,400,{error:'invalid watch'});
  const result=service.request(q,code=>publish(code,{closed:true}));if(!result.ok)return json(res,403,{error:'unauthorized'});
  const v=result.view,key=v.code+':'+v.seat;const old=watchers.get(key);if(old)old.end();
  if(watchers.size>=128&&!watchers.has(key))return json(res,503,{error:'stream limit'});
  res.writeHead(200,{...headers,'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'});
  watchers.set(key,res);const timer=setTimeout(()=>res.end(),30*60000);timer.unref();
  res.on('close',()=>{clearTimeout(timer);if(watchers.get(key)===res)watchers.delete(key);});
  res.write(JSON.stringify({revision:v.roomRevision})+'\n');
 }
 const server=http.createServer(async(req,res)=>{try{
  const p=new URL(req.url,'http://localhost').pathname;
  if(p==='/api/room'||p==='/api/room/watch'){
   if(req.method!=='POST'||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')||req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'forbidden'});
   if(!allow(req.socket.remoteAddress||'unknown'))return json(res,429,{error:'request limit'});
   let q;try{q=await read(req);}catch{return json(res,400,{error:'invalid request'});}
   if(p==='/api/room/watch')return watch(q,res);
   const result=service.request(q,code=>publish(code,{closed:true}));if(result.ok){if(result.closed)publish(q.code,{closed:true});else if(!result.duplicate&&['create','join','act'].includes(q.type))publish(q.code,{revision:result.view.roomRevision});}return json(res,200,result);
  }
  const f=p==='/'?'/index.html':p;
  if(req.method!=='GET'||!staticOK(f))return json(res,404,{error:'not found'});
  const filename=path.join(root,f);if(!fs.existsSync(filename))return json(res,404,{error:'not found'});
  res.writeHead(200,{...headers,'Content-Type':mime[path.extname(filename)],'Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});fs.createReadStream(filename).pipe(res);
 }catch{if(!res.headersSent)json(res,500,{error:'server error'});else res.end();}});
 server.requestTimeout=15000;server.headersTimeout=10000;
 const timer=setInterval(()=>{try{expire();}catch{/* retry on next request; never report a deletion that failed */}},60000);timer.unref();server.on('close',()=>clearInterval(timer));return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const lan=process.argv.includes('--lan'),directory=process.env.OCG_ROOM_DATA_DIR;const service=createRoomService({store:directory?createFileRoomStore(directory):null});createRoomHttpServer({service}).listen(8080,lan?'0.0.0.0':'127.0.0.1',()=>console.log(lan?'LAN試験用 http://<PCのIP>:8080 (信頼できるLAN限定)':'http://127.0.0.1:8080'));
}

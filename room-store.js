// Private, single-process snapshot storage. No public route; never put in a repository.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
const MAX=16*1024*1024;
const digest=s=>createHash('sha256').update(s).digest('hex');
export function createFileRoomStore(directory){
 if(typeof directory!=='string'||!directory.trim())throw Error('保存先不正');
 const dir=path.resolve(directory);fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const file=path.join(dir,'rooms-v1.json');
 return Object.freeze({
  load(){if(!fs.existsSync(file))return [];if(fs.statSync(file).size>MAX)throw Error('ルーム保存容量超過');const x=JSON.parse(fs.readFileSync(file,'utf8'));if(x?.version!==1||typeof x.payload!=='string'||digest(x.payload)!==x.sha256)throw Error('ルーム保存データ破損');return JSON.parse(x.payload);},
  save(records){const payload=JSON.stringify(records),data=JSON.stringify({version:1,payload,sha256:digest(payload)});if(Buffer.byteLength(data)>MAX)throw Error('ルーム保存容量超過');const temp=path.join(dir,`.rooms-${randomBytes(12).toString('hex')}.tmp`);let fd,renamed=false;try{fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,data,'utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,file);renamed=true;}finally{if(fd!==undefined)fs.closeSync(fd);if(!renamed)try{fs.unlinkSync(temp);}catch{}}}
 });
}

// New-game-only backup. Validate all references before any storage write.
import {normalizeStore,MAX_STORE_CHARS} from './decks.js';
export const BACKUP_FORMAT='original-card-game-backup';
export const MAX_BACKUP_CHARS=MAX_STORE_CHARS+500;
export const MAX_BACKUP_BYTES=MAX_BACKUP_CHARS*4;
const exact=(o,required,optional=[])=>!!o&&typeof o==='object'&&!Array.isArray(o)&&required.every(k=>Object.hasOwn(o,k))&&Object.keys(o).every(k=>required.includes(k)||optional.includes(k));
export function exportBackup(store){const data=normalizeStore(store);if(JSON.stringify(data).length>MAX_STORE_CHARS)throw Error('保存データの容量上限を超えています');return JSON.stringify({format:BACKUP_FORMAT,version:1,data});}
export function parseBackup(text){
 if(typeof text!=='string'||text.length>MAX_BACKUP_CHARS)throw Error('バックアップの容量または形式が不正');
 let raw;try{raw=JSON.parse(text);}catch{throw Error('JSON形式が不正');}
 if(!exact(raw,['format','version','data'])||raw.format!==BACKUP_FORMAT||raw.version!==1||!exact(raw.data,['version','decks'],['customCards','templates','art'])||!Array.isArray(raw.data.decks)||raw.data.decks.some(d=>!exact(d,['id','name','cards'])))throw Error('対応していないバックアップ形式');
 const data=normalizeStore(raw.data);if(JSON.stringify(data).length>MAX_STORE_CHARS)throw Error('保存データの容量上限を超えています');return data;
}

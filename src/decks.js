// Based on legacy decks.js's separated browser-local store + count validation.
// New namespace and strict format; never reads legacy keys or migrates old cards.
import {CATALOG,RULES,STANDARD_DECK,EFFECT_DECK,SECRET_DECK,validateDeck} from './cards.js';
import {buildCatalog,normalizeCustomCards} from './custom-cards.js';
import {normalizeTemplates} from './templates.js';
import {normalizeArt,ART_TOTAL_CHARS} from './card-art.js';
import {exactFields} from './state-validation.js';
export const MAX_STORE_CHARS=100000+ART_TOTAL_CHARS+10000;
export const DECK_STORE_KEY='original-card-game:decks:v1';
export const MAX_SAVED_DECKS=12;
export const PRESET_ID='preset';
export const preset=Object.freeze({id:PRESET_ID,name:'基本デッキ',cards:STANDARD_DECK});
export const presets=Object.freeze([preset,Object.freeze({id:'preset_effect',name:'登場・死亡効果デッキ',cards:EFFECT_DECK}),Object.freeze({id:'preset_secret',name:'秘策デッキ',cards:SECRET_DECK})]);
const validId=id=>typeof id==='string'&&/^d_[a-z0-9]{8,40}$/.test(id);
export function cleanName(name){if(typeof name!=='string'||!name.trim()||name.trim().length>28)throw Error('デッキ名は1〜28文字');return name.trim();}
export function countCards(cards){const counts=Object.create(null);for(const id of cards)counts[id]=(counts[id]||0)+1;return counts;}
export function editCards(cards,id,delta,catalog=CATALOG){
 if(!Array.isArray(cards)||cards.length>RULES.deckSize||typeof id!=='string'||!Object.hasOwn(catalog,id)||![1,-1].includes(delta))throw Error('不正な編集');
 if([...cards].some(key=>typeof key!=='string'||!Object.hasOwn(catalog,key)))throw Error('不正なデッキ');
 const counts=countCards(cards);for(const [key,n] of Object.entries(counts))if(!Object.hasOwn(catalog,key)||n>RULES.copies)throw Error('不正なデッキ');
 if(delta===1){if(cards.length>=RULES.deckSize)throw Error('30枚まで');if((counts[id]||0)>=RULES.copies)throw Error('同名2枚まで');return [...cards,id];}
 const i=cards.indexOf(id);if(i<0)throw Error('カードがありません');return cards.filter((_,j)=>j!==i);
}
export function normalizeStore(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!Object.hasOwn(raw,'version')||!Object.hasOwn(raw,'decks')||Object.keys(raw).some(k=>!['version','decks','customCards','templates','art'].includes(k))||raw.version!==1||!Array.isArray(raw.decks)||raw.decks.length>MAX_SAVED_DECKS)throw Error('保存形式が不正');
 const customCards=normalizeCustomCards(raw.customCards===undefined?[]:raw.customCards),catalog=buildCatalog(customCards);
 const ids=new Set();const decks=Array.from(raw.decks,d=>{if(!exactFields(d,['id','name','cards'])||!validId(d.id)||ids.has(d.id))throw Error('デッキIDが不正');ids.add(d.id);validateDeck(d.cards,{catalog});return {id:d.id,name:cleanName(d.name),cards:[...d.cards]};});
 const templates=normalizeTemplates(raw.templates);
 const art=normalizeArt(raw.art,customCards);
 return {version:1,decks,...(customCards.length?{customCards}: {}),...(templates.length?{templates}: {}),...(Object.keys(art).length?{art}:{})};
}
export const emptyStore=()=>({version:1,decks:[]});
export function readStore(storage){const raw=storage.getItem(DECK_STORE_KEY);if(raw===null)return emptyStore();if(typeof raw!=='string'||raw.length>MAX_STORE_CHARS)throw Error('保存データが不正');return normalizeStore(JSON.parse(raw));}
export function writeStore(storage,store){const normalized=normalizeStore(store);const text=JSON.stringify(normalized);if(text.length>MAX_STORE_CHARS)throw Error('保存データの容量上限を超えています');storage.setItem(DECK_STORE_KEY,text);return normalized;}
export function upsertDeck(store,deck){const s=normalizeStore(store);const i=s.decks.findIndex(d=>d.id===deck.id);if(i<0){if(s.decks.length>=MAX_SAVED_DECKS)throw Error('保存上限に達しました');s.decks.push(deck);}else s.decks[i]=deck;return normalizeStore(s);}
export function deleteDeck(store,id){const s=normalizeStore(store);if(!s.decks.some(d=>d.id===id))throw Error('デッキがありません');return {...s,decks:s.decks.filter(d=>d.id!==id)};}
export function resolveDeck(store,id){const d=presets.find(d=>d.id===id)||normalizeStore(store).decks.find(d=>d.id===id);if(!d)throw Error('デッキがありません');return [...d.cards];}

// Declarative user cards, using the same validator and executor as built-ins.
import {CATALOG,validateCard} from './cards.js';
export const MAX_CUSTOM_CARDS=80;
const idValid=id=>typeof id==='string'&&/^u_[a-f0-9]{24}$/.test(id);
const nameKey=name=>name.normalize('NFKC').trim().toLowerCase();
export function normalizeCustomCard(c){
 if(!c||typeof c!=='object'||Array.isArray(c)||!idValid(c.id)||typeof c.name!=='string')throw Error('自作カードID・名称不正');
 const allowed=['id','name','type','manaCost','ability',...(c.type==='minion'?['attack','maxHealth','keywords']:[])];
 if(Object.keys(c).some(k=>!allowed.includes(k)))throw Error('未対応のカード定義');
 const result={...c,name:c.name.trim()};validateCard(result);
 if(result.keywords)result.keywords=[...result.keywords];
 if(result.ability)result.ability={when:c.ability.when,operation:c.ability.operation,target:c.ability.target,amount:c.ability.amount,...(c.ability.followUp?{followUp:{...c.ability.followUp}}:{})};
 return result;
}
export function normalizeCustomCards(raw){
 if(!Array.isArray(raw)||raw.length>MAX_CUSTOM_CARDS)throw Error('自作カード保存形式が不正');
 const names=new Set(Object.values(CATALOG).map(c=>nameKey(c.name))),ids=new Set();
 return Array.from(raw,c=>{const d=normalizeCustomCard(c),name=nameKey(d.name);if(names.has(name)||ids.has(d.id)||Object.hasOwn(CATALOG,d.id))throw Error('カード名またはIDが重複しています');names.add(name);ids.add(d.id);return d;});
}
export function buildCatalog(raw=[]){return {...CATALOG,...Object.fromEntries(normalizeCustomCards(raw).map(c=>[c.id,c]))};}
export function upsertCustomCard(cards,card){const current=normalizeCustomCards(cards),d=normalizeCustomCard(card),i=current.findIndex(c=>c.id===d.id);if(i<0)current.push(d);else current[i]=d;return normalizeCustomCards(current);}
export function deleteCustomCard(cards,id,decks){const current=normalizeCustomCards(cards);if(!current.some(c=>c.id===id))throw Error('自作カードがありません');if(decks.some(d=>d.cards.includes(id)))throw Error('保存済みデッキから先に取り除いてください');return current.filter(c=>c.id!==id);}
export function matchCustomCards(cards,decks){const used=new Set(decks.flat());return Object.fromEntries(normalizeCustomCards(cards).filter(c=>used.has(c.id)).map(c=>[c.id,c]));}
export function validateMatchCatalog(map){if(!map||typeof map!=='object'||Array.isArray(map))throw Error('対戦カード定義不正');const list=normalizeCustomCards(Object.values(map));if(list.some(c=>!Object.hasOwn(map,c.id)||map[c.id].id!==c.id||map[c.id].name!==c.name)||Object.entries(map).some(([id,c])=>id!==c.id))throw Error('対戦カードID不整合');return list.length?{...CATALOG,...map}:CATALOG;}

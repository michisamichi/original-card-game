// Saved recipes are independent copies, never references in a live card or match.
import {TIMINGS,validateAbility,abilityText} from './effects.js';
export const MAX_TEMPLATES=80;
const validId=id=>typeof id==='string'&&/^t_[a-f0-9]{24}$/.test(id);
export function normalizeTemplate(t){
 if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).length!==4||!['id','name','type','ability'].every(k=>Object.hasOwn(t,k))||!validId(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.trim().length>40||typeof t.type!=='string'||!Object.hasOwn(TIMINGS,t.type)||t.ability?.when==='none'||!TIMINGS[t.type].includes(t.ability?.when))throw Error('効果テンプレート定義不正');
 validateAbility(t.ability,t.ability.when);
 const {when,operation,target,amount,followUp}=t.ability;
 return {id:t.id,name:t.name.trim(),type:t.type,ability:{when,operation,target,amount,...(followUp?{followUp:{condition:followUp.condition,operation:followUp.operation,target:followUp.target,amount:followUp.amount}}:{})}};
}
export function normalizeTemplates(raw=[]){
 if(!Array.isArray(raw)||raw.length>MAX_TEMPLATES)throw Error('効果テンプレート保存形式不正');
 const ids=new Set(),names=new Set();return Array.from(raw,t=>{const d=normalizeTemplate(t),name=d.name.normalize('NFKC').toLowerCase();if(ids.has(d.id)||names.has(name))throw Error('テンプレート名またはIDが重複しています');ids.add(d.id);names.add(name);return d;});
}
export function addTemplate(raw,t){return normalizeTemplates([...normalizeTemplates(raw),normalizeTemplate(t)]);}
export function deleteTemplate(raw,id){const list=normalizeTemplates(raw);if(!list.some(t=>t.id===id))throw Error('テンプレートがありません');return list.filter(t=>t.id!==id);}
export function templateDraft(t,type){const d=normalizeTemplate(t);if(d.type!==type)throw Error('カードの種類が一致しません');const a=d.ability;return {when:a.when,operation:a.operation,target:a.target,amount:a.amount,followCondition:a.followUp?.condition||'none',followOperation:a.followUp?.operation||'draw',followTarget:a.followUp?.target||'self',followAmount:a.followUp?.amount||1};}

// Rename is transactional at the store layer; the recipe and ID remain unchanged.
export function renameTemplate(raw,id,name){const list=normalizeTemplates(raw);if(!list.some(t=>t.id===id))throw Error('テンプレートがありません');return normalizeTemplates(list.map(t=>t.id===id?{...t,name}:t));}
export function findTemplates(raw,{type='all',query=''}={}){
 const q=String(query).trim().normalize('NFKC').toLowerCase();
 return normalizeTemplates(raw).filter(t=>(type==='all'||t.type===type)&&(!q||t.name.normalize('NFKC').toLowerCase().includes(q)||`${t.name} ${abilityText(t.ability)}`.normalize('NFKC').toLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'ja')||a.id.localeCompare(b.id));
}

// One validated snapshot per read-only screen. Search never mutates its entries;
// callers discard this index after any store write or full screen rebuild.
export function createTemplateSearchIndex(raw=[]){
 const normalize=value=>String(value).trim().normalize('NFKC').toLowerCase();
 const entries=normalizeTemplates(raw).sort((a,b)=>a.name.localeCompare(b.name,'ja')||a.id.localeCompare(b.id)).map(t=>({template:t,name:normalize(t.name),text:null}));
 return ({type='all',query=''}={})=>{const q=normalize(query);return entries.filter(e=>{
  if(type!=='all'&&e.template.type!==type)return false;
  if(!q||e.name.includes(q))return true;
  return (e.text??(e.text=normalize(`${e.template.name} ${abilityText(e.template.ability)}`))).includes(q);
 }).map(e=>e.template);};
}

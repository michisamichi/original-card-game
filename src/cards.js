import {CLASS_CARDS} from './class-cards.js';
import {validateAbility,abilityText} from './effects.js';
// New values; no numerical conversion from the legacy card database.
export const KEYWORD_LABELS=Object.freeze({taunt:'挑発',charge:'速攻',rush:'急襲',divineShield:'聖なる盾',windfury:'疾風',lifesteal:'生命奪取',poisonous:'猛毒',stealth:'潜伏',spellDamage:'呪文ダメージ +1'});
export const RULES = Object.freeze({hp:30,deckSize:30,copies:2,initialHands:Object.freeze([3,4]),manaCap:10,handCap:10,boardCap:7,secretCap:3,demoDeckSize:20,instanceCap:100});
const minion=(id,name,manaCost,attack,maxHealth,keywords=[],ability)=>({id,name,type:'minion',manaCost,attack,maxHealth,keywords,...(ability?{ability}:{})});
const spell=(id,name,manaCost,operation,target,amount)=>({id,name,type:'spell',manaCost,ability:{when:'play',operation,target,amount}});
const secret=(id,name,manaCost,when,operation,target,amount)=>({id,name,type:'secret',manaCost,ability:{when,operation,target,amount}});
const baseCards=[minion('scout','風の斥候',1,2,1),minion('guard','盾の衛兵',2,1,3,['taunt']),minion('wolf','灰牙の狼',2,3,2),minion('runner','閃光の獣',3,2,2,['charge']),minion('knight','蒼鉄の騎士',3,3,4),minion('golem','岩壁の巨兵',4,3,5,['taunt']),minion('dragon','暁の竜',5,5,5),spell('draw','星の導き',2,'draw','self',2),spell('heal','癒やしの光',1,'heal','self',3),spell('bolt','火花の矢',2,'damage','enemyChoice',3)];
const cards=[...baseCards,
 minion('wisp','灯火の精霊',1,1,2),minion('archer','月影の弓兵',2,2,3),
 minion('sentinel','銀嶺の守護者',3,2,4,['taunt']),minion('beast','森の巨獣',4,4,4),
 minion('titan','雷鳴の巨人',6,6,6),spell('spark','閃光弾',1,'damage','enemyChoice',1),
 minion('sage','星読みの賢者',2,1,2,[],{when:'summon',operation:'draw',target:'self',amount:1}),
 minion('flame','紅蓮の術士',3,2,2,[],{when:'summon',operation:'damage',target:'enemyChoice',amount:2}),
 minion('healer','命灯の精霊',2,2,1,[],{when:'death',operation:'heal',target:'self',amount:3}),
 minion('ember','爆炎の小鬼',2,1,1,[],{when:'death',operation:'damage',target:'enemyMinions',amount:1}),
 secret('ward','反響の結界',2,'heroAttack','damage','enemyMinions',1),
 secret('thorn','茨の罠',2,'attack','damage','eventMinion',2),
 secret('rune','封火の刻印',2,'minionPlayed','damage','eventMinion',2),
 secret('echo','知識の残響',1,'spellPlayed','draw','self',1),...CLASS_CARDS];
export function validateCard(c){
 const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 if(!c||typeof c.id!=='string'||!/^[a-z][a-z0-9_]{0,31}$/.test(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>40||!integer(c.manaCost,0,RULES.manaCap))throw Error('カード定義不正');
 if(c.type==='minion'){
  if(!integer(c.attack,0,30)||!integer(c.maxHealth,1,30)||!Array.isArray(c.keywords)||[...c.keywords].some(k=>typeof k!=='string'||!Object.hasOwn(KEYWORD_LABELS,k))||new Set(c.keywords).size!==c.keywords.length)throw Error('ミニオン定義不正');
  if(c.ability!==undefined){if(!['summon','death','turnStart','turnEnd'].includes(c.ability?.when))throw Error('ミニオン効果不正');validateAbility(c.ability,c.ability.when);}
 }else if(c.type==='spell'){
  validateAbility(c.ability,'play');if(c.keywords!==undefined||c.attack!==undefined||c.maxHealth!==undefined)throw Error('スペル定義不正');
 }else if(c.type==='secret'){
  if(!['heroAttack','attack','minionPlayed','spellPlayed'].includes(c.ability?.when)||c.keywords!==undefined||c.attack!==undefined||c.maxHealth!==undefined)throw Error('秘策定義不正');validateAbility(c.ability,c.ability.when);
 }else throw Error('カード種類不正');return true;
}
for(const c of cards)validateCard(c);
if(new Set(cards.map(c=>c.id)).size!==cards.length)throw Error('カードID重複');
export const CATALOG_VERSION='prototype-25';
export const CATALOG=Object.freeze(Object.fromEntries(cards.map(c=>[c.id,Object.freeze({...c,...(c.keywords?{keywords:Object.freeze(c.keywords)}:{}),...(c.ability?{ability:Object.freeze(c.ability)}:{})})])));
export const DEMO_DECK=Object.freeze(baseCards.flatMap(c=>[c.id,c.id]));
export const STANDARD_DECK=Object.freeze(cards.slice(0,16).filter(c=>c.id!=='titan').flatMap(c=>[c.id,c.id]));
export const EFFECT_DECK=Object.freeze([...STANDARD_DECK.filter(id=>!['wisp','archer','beast','sentinel'].includes(id)),...['sage','flame','healer','ember'].flatMap(id=>[id,id])]);
export const SECRET_DECK=Object.freeze([...EFFECT_DECK.filter(id=>!['knight','golem','dragon','spark'].includes(id)),...['ward','thorn','rune','echo'].flatMap(id=>[id,id])]);
export function validateDeck(deck,{demo=false,catalog=CATALOG}={}){
 if(!Array.isArray(deck)||deck.length!==(demo?RULES.demoDeckSize:RULES.deckSize)) throw Error('デッキ枚数が不正です');
 const counts=new Map();for(const id of deck){if(typeof id!=='string'||!Object.hasOwn(catalog,id))throw Error('未知のカード');counts.set(id,(counts.get(id)||0)+1);if(counts.get(id)>RULES.copies)throw Error('同名枚数超過');}return true;
}
export function description(c){return [...(c.keywords||[]).map(k=>KEYWORD_LABELS[k]),...(c.ability?[abilityText(c.ability)]:[])].join('・')||'通常ミニオン';}

// Curated built-in pool only; no recursive custom-card generation.
export const CREATION_POOLS=Object.freeze({tokenWisp:Object.freeze(['wisp']),tokenScout:Object.freeze(['scout']),tokenGuard:Object.freeze(['guard']),tokenSpark:Object.freeze(['spark']),poolMinion:Object.freeze(['scout','wisp','guard','wolf','archer','knight','golem','beast','dragon','titan']),poolSpell:Object.freeze(['draw','heal','bolt','spark'])});
const generatedIds=new Set(Object.values(CREATION_POOLS).flat());
export const isGeneratedCard=id=>generatedIds.has(id);

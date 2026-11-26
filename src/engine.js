import {CLASS_SKILLS,SKILL_COST,ARMOR_CAP,validateClassDeck,validSkillState} from './class-skills.js';
import {validInstanceFields,validResult,validEvents,exactFields,validActionShape} from './state-validation.js';
import {matchesFollowCondition,executeAbility,isChoiceTarget,isRandomTarget,canKill,isCreation,isZoneMove,isCostChange,isManaOperation,GRANT_KEYWORDS,TRANSFORM_FORMS} from './effects.js';
import {RULES as R,CATALOG as C,CATALOG_VERSION,DEMO_DECK,STANDARD_DECK,validateDeck,CREATION_POOLS,isGeneratedCard} from './cards.js';
import {matchCustomCards,validateMatchCatalog} from './custom-cards.js';
export const HERO='hero';
export const STAT_CAP=99; // prototype safety cap, not a balance decision
export const effectiveAttack=(definition,instance)=>definition.attack+(instance.attackBonus??0)+(instance.tempAttack??0);
export const effectiveMaxHealth=(definition,instance)=>definition.maxHealth+(instance.healthBonus??0);
const fail=m=>{throw new Error(m)};
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const copy=s=>JSON.parse(JSON.stringify(s));
const card=(s,c)=>Object.hasOwn(C,c.cardId)?C[c.cardId]:s.customCards[c.cardId];
export const effectiveCost=(definition,instance={})=>definition.manaCost+(instance.costDelta??0);
export const hasKeyword=(definition,instance,k)=>(!instance.silenced&&definition.keywords.includes(k))||(instance.grantedKeywords??[]).includes(k);
const has=(s,c,k)=>hasKeyword(card(s,c),c,k);
function rng(s){let x=s.rngState;x^=x<<13;x^=x>>>17;x^=x<<5;s.rngState=x>>>0;return s.rngState;}
function shuffle(s,a){for(let i=a.length-1;i>0;i--){const j=rng(s)%(i+1);[a[i],a[j]]=[a[j],a[i]];}}
function event(s,type,fields={}){s.events.push({type,...fields});if(s.events.length>64)s.events.shift();}
function finish(s,winner,reason){s.status='finished';s.winner=winner;s.reason=reason;event(s,'finish',{winner,reason});}
function checkHP(s){const dead=s.players.map(p=>p.hp<=0);if(dead[0]||dead[1])finish(s,dead[0]&&dead[1]?null:dead[0]?1:0,'hp');}
function draw(s,seat,n){const p=s.players[seat];for(let i=0;i<n&&s.status==='playing';i++){if(!p.deck.length){finish(s,1-seat,'deck');break;}const c=p.deck.pop();if(p.hand.length>=R.handCap){p.grave.push(c);event(s,'burn',{seat,cardId:c.cardId});}else{p.hand.push(c);event(s,'draw',{seat});}}}
function begin(s,first=false){const p=s.players[s.activeSeat];p.maxMana=Math.min(R.manaCap,p.maxMana+1);p.mana=p.maxMana;if(p.classId)p.skillUsed=false;for(const c of p.board)c.attacksUsed=0;event(s,'turn',{seat:s.activeSeat,turn:s.turnNo});if(!first)draw(s,s.activeSeat,1);if(s.status==='playing')triggerTurn(s,'turnStart');}
export function createGame({seed=1,mode='demo',decks=mode==='standard'?[STANDARD_DECK,STANDARD_DECK]:[DEMO_DECK,DEMO_DECK],firstSeat=0,matchId='local-1',ordered=false,customCards=[],classIds}={}){
 if(!['demo','standard'].includes(mode)||!int(seed,1,0xffffffff)||!int(firstSeat,0,1)||typeof matchId!=='string'||!matchId||matchId.length>100||!Array.isArray(decks)||decks.length!==2||typeof ordered!=='boolean'||(classIds!==undefined&&(mode!=='standard'||!Array.isArray(classIds)||classIds.length!==2||![0,1].every(i=>Object.hasOwn(classIds,i)&&(classIds[i]===null||typeof classIds[i]==='string'))||Object.keys(classIds).length!==2)))fail('初期設定が不正');
 const snapshot=matchCustomCards(customCards,decks),catalog=validateMatchCatalog(snapshot);
 const s={schemaVersion:16,customCards:snapshot,mode,catalogVersion:CATALOG_VERSION,matchId,revision:0,status:'playing',activeSeat:firstSeat,firstSeat,turnNo:1,rngState:seed,winner:null,reason:null,events:[],players:[]};
 for(let seat=0;seat<2;seat++){validateDeck(decks[seat],{demo:mode==='demo',catalog});const deck=decks[seat].map((cardId,i)=>({instanceId:`${seat}:${i}`,cardId,ownerSeat:seat}));if(ordered)deck.reverse();else shuffle(s,deck);const classId=mode==='standard'?validateClassDeck(decks[seat],classIds?.[seat]):null;s.players.push({hp:R.hp,maxMana:0,mana:0,deck,hand:[],board:[],grave:[],secrets:[],...(classId?{classId,skillUsed:false,armor:0}:{})});}
 draw(s,firstSeat,R.initialHands[0]);draw(s,1-firstSeat,R.initialHands[1]);begin(s,true);assertState(s);return s;
}
// Remove the entire death wave before resolving any death ability. Active seat first,
// then opposing seat, in stable board order. New deaths join the tail of the queue.
const deathTriggers=new WeakMap();
function collectDeaths(s,queue){for(const seat of [s.activeSeat,1-s.activeSeat]){const p=s.players[seat],survivors=[];for(const c of p.board){if(c.currentHealth<=0){p.grave.push(bare(c));event(s,'death',{seat,cardId:c.cardId,instanceId:c.instanceId});if(!c.silenced&&card(s,c).ability?.when==='death'){let seen=deathTriggers.get(s);if(!seen){seen=new Set();deathTriggers.set(s,seen);}if(!seen.has(c.instanceId)){seen.add(c.instanceId);queue.push({seat,source:c,ability:card(s,c).ability});}}}else survivors.push(c);}p.board=survivors;}}
function resolve(s,initial=[]){
 const queue=[...initial];collectDeaths(s,queue);if(s.status==='playing')checkHP(s);
 // Each individual may trigger a death recipe at most once per action, even after revival.
 // Throw rather than commit partial state if the structural bound is ever violated.
 const limit=2*R.instanceCap+1;let cursor=0;
 while(s.status==='playing'&&cursor<queue.length){if(cursor>=limit||queue.length>limit)fail('効果処理上限');const {seat,source,ability,target}=queue[cursor++];event(s,'ability',{seat,cardId:source.cardId,when:ability.when});
  const spellBonus=card(s,source).type==='spell'?spellDamageBonus(s,seat):0;
  const context={seat,target,get sourceId(){return s.players[seat].board.includes(source)?source.instanceId:undefined;},minions:q=>s.players[q].board.map(c=>c.instanceId),draw:(q,n)=>draw(s,q,n),heal:(q,id,n)=>heal(s,q,id,n),damage:(q,id,n)=>sourceDamage(s,seat,source,q,id,n+spellBonus),destroy:(q,id)=>destroy(s,q,id),grantKeyword:(q,id,k)=>grantKeyword(s,q,id,k),buff:(q,id,a,h)=>buff(s,q,id,a,h),weaken:(q,id,a,h)=>weaken(s,q,id,a,h),tempAttack:(q,id,a)=>tempAttack(s,q,id,a),randomIndex:n=>rng(s)%n,createCards:(q,op,t,n)=>createCards(s,q,op,t,n),moveCards:(q,op,t,n)=>moveCards(s,q,op,t,n,source.instanceId),returnHand:(q,id)=>returnToHand(s,q,id),changeCost:(q,op,t,n)=>changeCost(s,q,op,t,n),silence:(q,id)=>silence(s,q,id),transform:(q,id,form)=>transform(s,q,id,form),setStat:(q,id,op,n)=>setStat(s,q,id,op,n),changeMana:(q,op,n)=>changeMana(s,q,op,n)};
  if(!executeAbility(ability,context)){event(s,'abilitySkipped',{seat,cardId:source.cardId});continue;}
  // Only kills by the first damage or destroy step count, never later death effects.
  const killed=canKill(ability.operation)&&s.players[1-seat].board.some(c=>c.currentHealth<=0);
  collectDeaths(s,queue);if(s.status==='playing')checkHP(s);
  const follow=ability.followUp;
  // Finish this card's bounded recipe before processing queued death triggers.
  if(s.status==='playing'&&follow&&matchesFollowCondition(follow.condition,s.players[seat],s.players[1-seat],killed)){
   event(s,'abilityFollowUp',{seat,cardId:source.cardId,condition:follow.condition});
   executeAbility(follow,context);collectDeaths(s,queue);if(s.status==='playing')checkHP(s);
  }
 }
}
// Only the active player's living minions trigger, once in snapshot board order.
// Each recipe and its death chain resolves before the next source; dead sources skip.
function triggerTurn(s,when){const seat=s.activeSeat;const sources=s.players[seat].board.filter(c=>!c.silenced&&card(s,c).ability?.when===when);for(const source of sources){if(s.status!=='playing')break;if(s.players[seat].board.includes(source)&&!source.silenced&&card(s,source).ability?.when===when)resolve(s,[{seat,source,ability:card(s,source).ability}]);}}
function endTurn(s){triggerTurn(s,'turnEnd');if(s.status!=='playing')return;for(let seat=0;seat<2;seat++)for(const c of s.players[seat].board){if(c.tempAttack){event(s,'tempExpired',{seat,target:c.instanceId,attack:c.tempAttack});}delete c.tempAttack;}s.activeSeat=1-s.activeSeat;s.turnNo++;begin(s);}
function playAbility(d){return d.ability&&['play','summon'].includes(d.ability.when)?d.ability:null;}
function canSetSecret(p,c){return p.secrets.length<R.secretCap&&!p.secrets.some(x=>x.cardId===c.cardId);}
// Secrets are one-shot, defender-only, oldest first. Recheck event source/target
// before each reveal; no nested secret events from abilities, death or draws.
function triggerSecrets(s,actor,kind,context={}){
 if(s.status!=='playing'||s.activeSeat!==actor)return;
 const owner=1-actor,p=s.players[owner],enemy=s.players[actor];
 const exists=()=>enemy.board.includes(context.sourceObject);
 for(const c of [...p.secrets]){
  if(s.status!=='playing')break;
  if(kind==='attack'&&(!exists()||(context.target!==HERO&&!p.board.includes(context.targetObject))))break;
  if(kind==='minionPlayed'&&!exists())break;
  const a=card(s,c).ability;
  if(!(a.when===kind||(kind==='attack'&&a.when==='heroAttack'&&context.target===HERO)))continue;
  if(['enemyMinions','enemyRandom'].includes(a.target)&&!enemy.board.length)continue;
  if(['friendlyMinions','friendlyRandom'].includes(a.target)&&!p.board.length)continue;
  if(isManaOperation(a.operation)&&!manaAvailable(s,owner,a.operation))continue;
  if(isCostChange(a.operation)&&!s.players[a.operation==='discountHand'?owner:actor].hand.length)continue;
  if(isCreation(a.operation)&&creationCapacity(p,a.operation)<=0)continue;
  if(isZoneMove(a.operation)&&!zoneCandidates(s,owner,a.operation,a.target).length)continue;
  if(a.operation==='returnHand'&&s.players[['friendlyChoice','friendlyMinions','friendlyRandom','sourceMinion'].includes(a.target)?owner:actor].hand.length>=R.handCap)continue;
  p.secrets.splice(p.secrets.findIndex(x=>x.instanceId===c.instanceId),1);p.grave.push(c);
  event(s,'secretReveal',{seat:owner,cardId:c.cardId});
  resolve(s,[{seat:owner,source:c,ability:a,target:context.source}]);
 }
}
function enemyTargets(s,seat,attack=false){const board=s.players[1-seat].board.filter(c=>!hasStealth(card(s,c),c));const guards=board.filter(c=>has(s,c,'taunt'));return attack&&guards.length?guards.map(c=>c.instanceId):[HERO,...board.map(c=>c.instanceId)];}
export function hasStealth(definition,instance){return hasKeyword(definition,instance,'stealth')&&!instance.stealthSpent;}
function revealStealth(s,seat,source){const c=s.players[seat].board.find(x=>x===source);if(c&&hasStealth(card(s,c),c)){c.stealthSpent=true;event(s,'stealthBroken',{seat,cardId:c.cardId,target:c.instanceId});}}
export function hasDivineShield(definition,instance){return hasKeyword(definition,instance,'divineShield')&&!instance.shieldSpent;}
export function attackLimit(definition,instance={}){return hasKeyword(definition,instance,'windfury')?2:1;}
function attackTargets(s,seat,c){if(c.attacksUsed>=attackLimit(card(s,c),c)||effectiveAttack(card(s,c),c)<=0)return [];const unrestricted=c.summonedTurn<s.turnNo||has(s,c,'charge');if(!unrestricted&&!has(s,c,'rush'))return [];const targets=enemyTargets(s,seat,true);return unrestricted?targets:targets.filter(id=>id!==HERO);}
// The same target enumeration drives the UI, legalActions and action validation.
function effectChoices(s,seat,a){if(a.target==='enemyChoice')return enemyTargets(s,seat);if(a.target==='enemyMinionChoice')return enemyTargets(s,seat).filter(id=>id!==HERO);if(a.target==='friendlyChoice')return s.players[seat].board.map(c=>c.instanceId);return [];}
function boardInstance(s,seat,id){const c=s.players[seat].board.find(c=>c.instanceId===id);if(!c)fail('対象が存在しません');return c;}
function heal(s,seat,target,n,kind='heal'){const p=s.players[seat];if(target===HERO){const old=p.hp;p.hp=Math.min(R.hp,p.hp+n);event(s,kind,{seat,amount:p.hp-old});return;}const c=boardInstance(s,seat,target),old=c.currentHealth;c.currentHealth=Math.min(effectiveMaxHealth(card(s,c),c),old+n);event(s,'heal',{seat,target,amount:c.currentHealth-old});}
function buff(s,seat,id,a,h){const c=boardInstance(s,seat,id),d=card(s,c);const da=Math.min(a,STAT_CAP-effectiveAttack(d,c)),dh=Math.min(h,STAT_CAP-effectiveMaxHealth(d,c));if(da)c.attackBonus=(c.attackBonus??0)+da;if(dh){c.healthBonus=(c.healthBonus??0)+dh;c.currentHealth+=dh;}event(s,'buff',{seat,target:id,attack:da,health:dh});}
function tempAttack(s,seat,id,a){const c=boardInstance(s,seat,id),da=Math.min(a,STAT_CAP-effectiveAttack(card(s,c),c));if(da)c.tempAttack=(c.tempAttack??0)+da;event(s,'tempBuff',{seat,target:id,attack:da});}
// Negative bonuses are bounded by effective attack 0 and maximum health 1.
function weaken(s,seat,id,a,h){const c=boardInstance(s,seat,id),d=card(s,c);const da=Math.min(a,effectiveAttack(d,c)),dh=Math.min(h,effectiveMaxHealth(d,c)-1);if(da){const permanent=Math.min(da,d.attack+(c.attackBonus??0));if(permanent)c.attackBonus=(c.attackBonus??0)-permanent;const temporary=da-permanent;if(temporary){c.tempAttack-=temporary;if(!c.tempAttack)delete c.tempAttack;}}if(dh){c.healthBonus=(c.healthBonus??0)-dh;c.currentHealth-=dh;}event(s,'weaken',{seat,target:id,attack:da,health:dh});}
function manaAvailable(s,seat,op){const p=s.players[seat];return op==='gainMana'?p.maxMana<R.manaCap:op==='restoreMana'?p.mana<p.maxMana:s.players[1-seat].maxMana>0;}
function changeMana(s,seat,op,n){const owner=op==='reduceMana'?1-seat:seat,p=s.players[owner],old=p.mana,oldMax=p.maxMana;if(!manaAvailable(s,seat,op))return false;if(op==='gainMana'){const delta=Math.min(n,R.manaCap-p.maxMana);p.maxMana+=delta;p.mana+=delta;}else if(op==='restoreMana')p.mana=Math.min(p.maxMana,p.mana+n);else {p.maxMana=Math.max(0,p.maxMana-n);p.mana=Math.min(p.mana,p.maxMana);}event(s,'manaChange',{seat:owner,mana:p.mana-old,maxMana:p.maxMana-oldMax});return true;}
function changeCost(s,seat,op,target,n){const owner=op==='discountHand'?seat:1-seat,p=s.players[owner];if(!p.hand.length)return false;const list=target.endsWith('Random')?[p.hand[rng(s)%p.hand.length]]:p.hand;let changed=0;for(const c of list){const d=card(s,c),old=effectiveCost(d,c),cost=Math.max(0,Math.min(R.manaCap,old+(op==='discountHand'?-n:n)));if(cost!==old){const delta=cost-d.manaCost;if(delta)c.costDelta=delta;else delete c.costDelta;changed++;}}event(s,'costChange',{seat:owner,count:changed,direction:op==='discountHand'?'down':'up'});return true;}
function silence(s,seat,id){const c=boardInstance(s,seat,id),d=card(s,c),damageTaken=effectiveMaxHealth(d,c)-c.currentHealth;for(const k of ['attackBonus','healthBonus','tempAttack','grantedKeywords','shieldSpent','stealthSpent'])delete c[k];c.silenced=true;c.currentHealth=d.maxHealth-damageTaken;event(s,'silence',{seat,target:id,cardId:c.cardId});}
function transform(s,seat,id,form){const c=boardInstance(s,seat,id),original=c.originCardId??c.cardId,turn=c.summonedTurn,used=c.attacksUsed;const next={...bare(c),originCardId:original,cardId:form,currentHealth:C[form].maxHealth,summonedTurn:turn,attacksUsed:used};for(const k of Object.keys(c))delete c[k];Object.assign(c,next);event(s,'transform',{seat,target:id,cardId:form});}
function setStat(s,seat,id,op,n){const c=boardInstance(s,seat,id),d=card(s,c);if(op==='setAttack'){delete c.tempAttack;c.attackBonus=n-d.attack;}else{c.healthBonus=n-d.maxHealth;c.currentHealth=n;}event(s,'setStat',{seat,target:id,cardId:c.cardId,stat:op==='setAttack'?'attack':'health',amount:n});}
function instanceCount(p){return p.deck.length+p.hand.length+p.board.length+p.grave.length+p.secrets.length;}
function creationCapacity(p,op){return Math.min(R.instanceCap-instanceCount(p),op.startsWith('summon')?R.boardCap-p.board.length:R.handCap-p.hand.length);}
function createCards(s,seat,op,target,n){
 const p=s.players[seat],pool=CREATION_POOLS[target],summon=op.startsWith('summon'),count=Math.min(n,creationCapacity(p,op));
 if(count<=0)return false;
 let next=instanceCount(p);
 for(let i=0;i<count;i++){
  const cardId=pool[pool.length===1?0:rng(s)%pool.length],c={instanceId:`${seat}:${next++}`,cardId,ownerSeat:seat};
  if(summon){p.board.push({...c,currentHealth:C[cardId].maxHealth,summonedTurn:s.turnNo,attacksUsed:0});event(s,'specialSummon',{seat,cardId,instanceId:c.instanceId});}
  else{p.hand.push(c);event(s,'generate',{seat});}
 }
 return true;
}
// Zone moves preserve identity and ownership. Re-entering the board resets all temporary state;
// no battlecry or secret play trigger is generated. Full destinations stop before moving.
function bare(c){return {instanceId:c.instanceId,cardId:c.cardId,ownerSeat:c.ownerSeat,...(c.originCardId?{originCardId:c.originCardId}:{})};}
function zoneSpec(op,target){const summon=['reviveLast','reviveRandom','summonHand','summonDeck'].includes(op);return {from:op.startsWith('revive')||op==='recoverGrave'?'grave':op==='summonHand'||op==='discardHand'?'hand':'deck',to:summon?'board':op==='discardHand'?'grave':'hand',type:target.endsWith('Minion')?'minion':target.endsWith('Spell')?'spell':null};}
function zoneCandidates(s,seat,op,target,sourceId){const p=s.players[seat],{from,to,type}=zoneSpec(op,target);if(to==='board'&&p.board.length>=R.boardCap||to==='hand'&&p.hand.length>=R.handCap)return [];return p[from].filter(c=>(!type||card(s,c).type===type)&&(op!=='recoverGrave'||c.instanceId!==sourceId));}
function moveCards(s,seat,op,target,n,sourceId){const p=s.players[seat],{from,to}=zoneSpec(op,target);let moved=0;for(let i=0;i<n;i++){const pool=zoneCandidates(s,seat,op,target,sourceId);if(!pool.length)break;const c=pool[op==='reviveLast'?pool.length-1:pool.length===1?0:rng(s)%pool.length];p[from].splice(p[from].indexOf(c),1);if(to==='board'){p.board.push({...bare(c),currentHealth:card(s,c).maxHealth,summonedTurn:s.turnNo,attacksUsed:0});event(s,op.startsWith('revive')?'revive':'specialSummon',{seat,cardId:c.cardId,instanceId:c.instanceId});}else{p[to].push(bare(c));if(to==='grave')event(s,'discard',{seat,cardId:c.cardId});else if(from==='grave')event(s,'recover',{seat,cardId:c.cardId});else event(s,'fetch',{seat});}moved++;}return moved>0;}
function returnToHand(s,seat,id){const p=s.players[seat];if(p.hand.length>=R.handCap)return false;const c=boardInstance(s,seat,id);p.board.splice(p.board.indexOf(c),1);p.hand.push(bare(c));event(s,'returnHand',{seat,cardId:c.cardId,instanceId:id});return true;}
function randomTargetAvailable(s,seat,a){return !isRandomTarget(a.target)||s.players[a.target==='friendlyRandom'?seat:1-seat].board.length>0;}
export function spellDamageBonus(s,seat){return s.players[seat].board.filter(c=>c.currentHealth>0&&has(s,c,'spellDamage')).length;}
function grantKeyword(s,seat,id,k){const c=boardInstance(s,seat,id);if(!Object.values(GRANT_KEYWORDS).includes(k))fail('付与能力不正');const changed=!has(s,c,k)||(k==='divineShield'&&c.shieldSpent===true)||(k==='stealth'&&c.stealthSpent===true);if(!has(s,c,k))c.grantedKeywords=[...(c.grantedKeywords??[]),k];if(k==='divineShield')delete c.shieldSpent;if(k==='stealth')delete c.stealthSpent;if(changed)event(s,'keywordGranted',{seat,target:id,cardId:c.cardId,keyword:k});}
function validGranted(c,d){if(!Object.hasOwn(c,'grantedKeywords'))return true;const a=c.grantedKeywords;return Array.isArray(a)&&a.length>=1&&a.length<=Object.keys(GRANT_KEYWORDS).length&&new Set(a).size===a.length&&[...a].every(k=>Object.values(GRANT_KEYWORDS).includes(k)&&(c.silenced||!d.keywords.includes(k)));}
// Shared by authoritative state and seat-specific presentation validation.
export function validBoardState(d,c,turnNo){return !(d.type!=='minion'||!validGranted(c,d)||(Object.hasOwn(c,'stealthSpent')&&(c.stealthSpent!==true||!hasKeyword(d,c,'stealth')))||(Object.hasOwn(c,'shieldSpent')&&(c.shieldSpent!==true||!hasKeyword(d,c,'divineShield')))||!int(Object.hasOwn(c,'attackBonus')?c.attackBonus:0,-d.attack,STAT_CAP-d.attack)||!int(Object.hasOwn(c,'healthBonus')?c.healthBonus:0,1-d.maxHealth,STAT_CAP-d.maxHealth)||!int(Object.hasOwn(c,'tempAttack')?c.tempAttack:0,0,STAT_CAP)||effectiveAttack(d,c)>STAT_CAP||!int(c.currentHealth,1,effectiveMaxHealth(d,c))||!int(c.summonedTurn,1,turnNo)||!int(c.attacksUsed,0,c.silenced||c.originCardId?2:attackLimit(d,c)));}
function destroy(s,seat,id){const c=boardInstance(s,seat,id);c.currentHealth=0;event(s,'destroy',{seat,target:id,cardId:c.cardId});}
function damage(s,seat,target,n){const p=s.players[seat];if(target===HERO){const absorbed=Math.min(p.armor??0,n);if(absorbed){p.armor-=absorbed;event(s,'armorChange',{seat,amount:-absorbed});}p.hp=Math.max(0,p.hp-(n-absorbed));event(s,'damage',{seat,target,amount:n-absorbed});return n;}else{const c=p.board.find(c=>c.instanceId===target);if(!c)fail('対象が存在しません');if(n>0&&hasDivineShield(card(s,c),c)){c.shieldSpent=true;event(s,'shieldBroken',{seat,target,cardId:c.cardId,prevented:n});return 0;}c.currentHealth-=n;}event(s,'damage',{seat,target,amount:n});return n;}
// Damage credited to the source includes overkill, but shield absorption returns zero.
// Combat computes both damage amounts before either damage or lifesteal resolves.
function lifesteal(s,seat,source,dealt){if(dealt>0&&card(s,source).type==='minion'&&has(s,source,'lifesteal'))heal(s,seat,HERO,dealt,'lifesteal');}
// Poison is destruction, not extra damage; preserve actual damage for lifesteal.
function afterDamage(s,seat,source,targetSeat,target,dealt){if(dealt<=0)return;revealStealth(s,seat,source);if(target!==HERO&&card(s,source).type==='minion'&&has(s,source,'poisonous')){const c=boardInstance(s,targetSeat,target);c.currentHealth=0;event(s,'poisonous',{seat:targetSeat,target,cardId:c.cardId});}lifesteal(s,seat,source,dealt);}
function sourceDamage(s,seat,source,targetSeat,target,n){const dealt=damage(s,targetSeat,target,n);afterDamage(s,seat,source,targetSeat,target,dealt);return dealt;}
function play(s,seat,a){const p=s.players[seat],i=p.hand.findIndex(c=>c.instanceId===a.card);if(i<0)fail('手札にありません');const c=p.hand[i],d=card(s,c),ability=playAbility(d);if(p.mana<effectiveCost(d,c))fail('マナ不足');if(d.type==='minion'&&p.board.length>=R.boardCap)fail('場が満杯');if(d.type==='secret'&&!canSetSecret(p,c))fail('秘策が満杯または同名設置済み');let skip=false;if(ability&&isChoiceTarget(ability.target)){const choices=effectChoices(s,seat,ability);if(!choices.length&&d.type==='minion'&&a.target===undefined)skip=true;else if(!choices.includes(a.target))fail('対象不正または対象なし');}else if(a.target!==undefined)fail('対象不要');if(d.type==='spell'&&ability&&!randomTargetAvailable(s,seat,ability))fail('ランダム対象なし');
 p.mana-=effectiveCost(d,c);p.hand.splice(i,1);delete c.costDelta;if(d.type==='secret'){p.secrets.push(c);event(s,'secretSet',{seat});return;}event(s,'play',{seat,cardId:c.cardId});
 let source=c;if(d.type==='minion'){source={...c,currentHealth:d.maxHealth,summonedTurn:s.turnNo,attacksUsed:0};p.board.push(source);}else p.grave.push(c);
 if(ability&&!skip)resolve(s,[{seat,source,ability,target:a.target}]);else if(skip)event(s,'abilitySkipped',{seat,cardId:c.cardId});
 triggerSecrets(s,seat,d.type==='minion'?'minionPlayed':'spellPlayed',{source:c.instanceId,sourceObject:source});
}
function attack(s,seat,a){const p=s.players[seat],q=s.players[1-seat],c=p.board.find(c=>c.instanceId===a.attacker);if(!c)fail('攻撃できません');if(!attackTargets(s,seat,c).includes(a.target))fail('攻撃できません（召喚ターン・急襲・挑発・攻撃回数を確認）');c.attacksUsed++;event(s,'attack',{seat,attacker:a.attacker,target:a.target});revealStealth(s,seat,c);const targetObject=q.board.find(x=>x.instanceId===a.target);triggerSecrets(s,seat,'attack',{source:c.instanceId,sourceObject:c,target:a.target,targetObject});if(s.status!=='playing')return;if(!p.board.includes(c)||(a.target!==HERO&&!q.board.includes(targetObject))){event(s,'attackCancelled',{seat});return;}if(a.target===HERO)sourceDamage(s,seat,c,1-seat,HERO,effectiveAttack(card(s,c),c));else{const d=q.board.find(c=>c.instanceId===a.target);const outgoing=effectiveAttack(card(s,c),c),retaliation=effectiveAttack(card(s,d),d);const dealt=damage(s,1-seat,d.instanceId,outgoing),returned=damage(s,seat,c.instanceId,retaliation);afterDamage(s,seat,c,1-seat,d.instanceId,dealt);afterDamage(s,1-seat,d,seat,c.instanceId,returned);}resolve(s);}
// Skill targets and availability are shared by legal enumeration and execution.
function skillActions(s,seat){
 const p=s.players[seat];if(!p.classId||p.skillUsed||p.mana<SKILL_COST)return [];
 const targeted=ids=>ids.map(target=>({type:'skill',target}));
 switch(p.classId){
 case 'mage':return targeted(enemyTargets(s,seat));
 case 'priest':return targeted([HERO,...p.board.map(c=>c.instanceId)]);
 case 'rogue':return targeted(p.board.map(c=>c.instanceId));
 case 'druid':return p.board.length?targeted(p.board.map(c=>c.instanceId)):[{type:'skill'}];
 case 'shaman':case 'paladin':return p.board.length<R.boardCap&&p.board.length+p.grave.length+(p.deck?.length??p.deckCount)+(p.hand?.length??p.handCount)+(p.secrets?.length??p.secretCount)<R.instanceCap?[{type:'skill'}]:[];
 default:return [{type:'skill'}];
 }
}
function addArmor(s,seat,n){const p=s.players[seat],amount=Math.min(n,ARMOR_CAP-p.armor);p.armor+=amount;event(s,'armorChange',{seat,amount});}
function useSkill(s,seat,a){
 const p=s.players[seat];if(!skillActions(s,seat).some(x=>x.target===a.target))fail('スキルを使用できません');
 p.mana-=SKILL_COST;p.skillUsed=true;event(s,'skill',{seat,classId:p.classId});
 switch(p.classId){
 case 'warrior':addArmor(s,seat,2);break;
 case 'shaman':createCards(s,seat,'summonFixed',['tokenScout','tokenWisp','tokenGuard'][rng(s)%3],1);break;
 case 'rogue':tempAttack(s,seat,a.target,2);break;
 case 'paladin':createCards(s,seat,'summonFixed','tokenWisp',1);break;
 case 'hunter':damage(s,1-seat,HERO,2);break;
 case 'druid':addArmor(s,seat,1);if(a.target!==undefined)tempAttack(s,seat,a.target,1);break;
 case 'warlock':damage(s,seat,HERO,2);checkHP(s);if(s.status==='playing')draw(s,seat,1);break;
 case 'mage':damage(s,1-seat,a.target,1);break;
 case 'priest':heal(s,seat,a.target,2);break;
 default:fail('不明なクラス');
 }
 resolve(s);
}
export function applyAction(state,actor,a){if(!int(actor,0,1)||!validActionShape(a))fail('不正な操作');if(state.status!=='playing')fail('対戦終了');if(state.revision>=Number.MAX_SAFE_INTEGER-1)fail('操作回数上限');if(a.matchId!==state.matchId||a.revision!==state.revision)fail('古い操作');if(actor!==state.activeSeat&&a.type!=='concede')fail('相手のターン');const s=copy(state);if(a.type==='play')play(s,actor,a);else if(a.type==='attack')attack(s,actor,a);else if(a.type==='skill')useSkill(s,actor,a);else if(a.type==='end'){endTurn(s);}else finish(s,1-actor,'concede');s.revision++;assertState(s);return s;}
export function legalActions(s,seat){if(s.status!=='playing'||seat!==s.activeSeat||s.revision>=Number.MAX_SAFE_INTEGER-1)return [];const p=s.players[seat],out=[];for(const c of p.hand){const d=card(s,c);if(effectiveCost(d,c)>p.mana)continue;if(d.type==='minion'&&p.board.length>=R.boardCap)continue;if(d.type==='secret'&&!canSetSecret(p,c))continue;const ability=playAbility(d);if(d.type==='spell'&&ability&&!randomTargetAvailable(s,seat,ability))continue;if(ability&&isChoiceTarget(ability.target)){const targets=effectChoices(s,seat,ability);for(const target of targets)out.push({type:'play',card:c.instanceId,target});if(!targets.length&&d.type==='minion')out.push({type:'play',card:c.instanceId});}else out.push({type:'play',card:c.instanceId});}for(const c of p.board)for(const target of attackTargets(s,seat,c))out.push({type:'attack',attacker:c.instanceId,target});out.push(...skillActions(s,seat),{type:'end'});return out.map(a=>({...a,revision:s.revision,matchId:s.matchId}));}
const STATE_KEYS=['schemaVersion','customCards','mode','catalogVersion','matchId','revision','status','activeSeat','firstSeat','turnNo','rngState','winner','reason','events','players'];
const PLAYER_KEYS=['hp','maxMana','mana','deck','hand','board','grave','secrets'];
export function assertState(s){if(!exactFields(s,STATE_KEYS)||typeof s.matchId!=='string'||!s.matchId||s.matchId.length>100||!Array.isArray(s.events)||s.events.some(e=>!e||typeof e.type!=='string')||s.schemaVersion!==16||!['demo','standard'].includes(s.mode)||s.catalogVersion!==CATALOG_VERSION||!int(s.revision,0,Number.MAX_SAFE_INTEGER)||!int(s.turnNo,1,Number.MAX_SAFE_INTEGER)||!int(s.activeSeat,0,1)||!int(s.firstSeat,0,1)||!int(s.rngState,1,0xffffffff)||!Array.isArray(s.players)||s.players.length!==2||!['playing','finished'].includes(s.status)||s.events.length>64)fail('状態不正');if(s.activeSeat!==(s.firstSeat+(s.turnNo-1)%2)%2)fail('ターン不整合');const catalog=validateMatchCatalog(s.customCards);if(!validEvents(s.events,catalog))fail('状態不正：履歴');const ids=new Set(),used=new Set();for(let seat=0;seat<2;seat++){const p=s.players[seat];if(!(p.classId?exactFields(p,[...PLAYER_KEYS,'classId','skillUsed','armor'])&&validSkillState(p):exactFields(p,PLAYER_KEYS))||!['deck','hand','board','grave','secrets'].every(k=>Array.isArray(p[k]))||!int(p.hp,0,R.hp)||!int(p.maxMana,0,R.manaCap)||!int(p.mana,0,p.maxMana)||p.deck.length>(s.mode==='demo'?R.demoDeckSize:R.deckSize)||p.hand.length>R.handCap||p.board.length>R.boardCap||p.grave.length>R.instanceCap||!Array.isArray(p.secrets)||p.secrets.length>R.secretCap||new Set(p.secrets.map(c=>c.cardId)).size!==p.secrets.length)fail('プレイヤー状態不正');const all=[...p.deck,...p.hand,...p.board,...p.grave,...p.secrets];const initialCount=s.mode==='demo'?R.demoDeckSize:R.deckSize;if(all.length<initialCount||all.length>R.instanceCap)fail('カード数不整合');const initial=all.filter(c=>Number(c.instanceId?.split(':')[1])<initialCount).map(c=>c.originCardId??c.cardId);validateDeck(initial,{demo:s.mode==='demo',catalog});if(s.mode==='standard')validateClassDeck(initial,p.classId??null);else if(p.classId)fail('クラス状態不整合');for(const zone of ['deck','hand','board','grave','secrets'])for(const c of p[zone]){if(!validInstanceFields(c,zone))fail('個体状態不正');if(c.ownerSeat!==seat||typeof c.instanceId!=='string'||!/^([01]):(0|[1-9][0-9]?)$/.test(c.instanceId)||!c.instanceId.startsWith(`${seat}:`)||Number(c.instanceId.slice(2))>=all.length||ids.has(c.instanceId)||!Object.hasOwn(catalog,c.cardId))fail('個体ID不整合');if(Object.hasOwn(c,'originCardId')&&(!Object.hasOwn(catalog,c.originCardId)||catalog[c.originCardId].type!=='minion'||!Object.values(TRANSFORM_FORMS).includes(c.cardId)||zone==='deck'||zone==='secrets'))fail('変身状態不正');if(Object.hasOwn(c,'costDelta')&&(zone!=='hand'||!int(c.costDelta,-card(s,c).manaCost,R.manaCap-card(s,c).manaCost)))fail('コスト状態不正');if(Object.hasOwn(c,'silenced')&&(zone!=='board'||c.silenced!==true))fail('沈黙状態不正');if(Number(c.instanceId.slice(2))>=initialCount&&(!isGeneratedCard(c.originCardId??c.cardId)||zone==='deck'||zone==='secrets'))fail('生成カード不正');ids.add(c.instanceId);used.add(c.cardId);if(c.originCardId)used.add(c.originCardId);}for(const c of p.secrets)if(card(s,c).type!=='secret')fail('秘策状態不正');for(const c of p.board){if(!validBoardState(card(s,c),c,s.turnNo))fail('盤面不正');}}
 if(Object.keys(s.customCards).some(id=>!used.has(id)))fail('未使用自作カード定義');
 if(!validResult(s))fail('勝敗不整合');return true;}

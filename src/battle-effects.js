// Presentation-only observer. No timers, animation queues, network calls or action delays.
// Engine retains 64 events. Use overlap only for adjacent revisions; never replay
// an initial/reconnected snapshot or guess events lost across revision gaps.
export function newEvents(previous,next){if(!previous||previous.matchId!==next.matchId||next.revision!==previous.revision+1)return [];
 const a=previous.events,b=next.events;for(let n=Math.min(a.length,b.length);n>=0;n--){if(a.slice(a.length-n).every((e,i)=>e===b[i]))return b.slice(n).map(e=>JSON.parse(e));}return [];
}
export function summarizeEffects(events,definition){const messages=[];const cancelled=events.some(e=>e.type==='attackCancelled');let damage=0,heal=0,death=0;for(const e of events){switch(e.type){case 'secretSet':break;case 'revive':case 'specialSummon':messages.push(['summon','特殊召喚']);break;case 'buff':case 'tempBuff':case 'keywordGranted':messages.push(['buff','強化']);break;case 'weaken':messages.push(['weaken','弱体化']);break;case 'setStat':messages.push(['stat','能力値変更']);break;case 'tempExpired':messages.push(['expire','一時強化終了']);break;case 'returnHand':messages.push(['bounce','手札へ戻す']);break;case 'silence':messages.push(['silence','沈黙']);break;case 'stealthBroken':messages.push(['reveal','潜伏解除']);break;case 'transform':messages.push(['transform','変身']);break;case 'attack':if(!cancelled)messages.push(['attack','攻撃']);break;case 'attackCancelled':messages.push(['cancel','攻撃中断']);break;case 'play':{const d=definition(e.cardId);messages.push([d?.type==='minion'?'summon':'spell',d?.type==='minion'?'召喚':'スペル']);break;}case 'damage':damage+=Math.max(0,e.amount||0);break;case 'heal':case 'lifesteal':heal+=Math.max(0,e.amount||0);break;case 'death':death++;break;case 'secretReveal':messages.push(['secret','秘策発動']);break;case 'shieldBroken':messages.push(['shield','盾で無効']);break;case 'turn':messages.push(['turn',`ターン ${e.turn}`]);break;case 'finish':messages.push(['finish','対戦終了']);break;}}
 if(damage)messages.push(['damage',`ダメージ 合計 ${damage}`]);if(heal)messages.push(['heal',`回復 合計 ${heal}`]);if(death)messages.push(['death',`${death}体 撃破`]);
 if(poisonedDeaths(events).size)messages.push(['poison','猛毒']);
 // Preserve key events even on long chains; at most one chip per kind.
 const unique=new Map(messages.map(m=>[m[0],m]));return [...unique.values()].sort((a,b)=>priority(b[0])-priority(a[0])).slice(0,4);
}
const priority=k=>({finish:9,secret:8,turn:7,damage:6,heal:5,death:4,poison:4,shield:3,cancel:3,buff:3,weaken:3,silence:3,transform:3,stat:3,expire:2,bounce:2,reveal:2,attack:2,summon:2,spell:2}[k]||0);
// Only annotate existing public board/hero nodes; never recreate hidden or dead cards.
export function markBattleEvents(events,findNode,definition=()=>undefined,summons=new Map()){
 const marked=new Map(),cancelled=events.some(e=>e.type==='attackCancelled');
 // Prefer an actual impact over a casting cue on the same surviving node.
 const strength={damage:5,heal:5,shield:5,transform:4,silence:4,stat:3,expire:2,ward:3,buff:3,weaken:3,summon:2,secret:2,death:2,reveal:2,spell:1,attack:1};
 for(const e of events){let kind,target=e.target,seat=e.seat;switch(e.type){
 case 'attack':if(!cancelled){kind='attack';target=e.attacker;}break;
 case 'damage':if(e.amount>0)kind='damage';break;
 case 'heal':case 'lifesteal':if(e.amount>0){kind='heal';target??='hero';}break;
 case 'shieldBroken':kind='shield';break;
 case 'buff':case 'tempBuff':kind='buff';break;
 case 'keywordGranted':kind=e.keyword==='divineShield'?'ward':'buff';break;
 case 'setStat':if(e.stat==='attack'||e.stat==='health')kind='stat';break;
 case 'tempExpired':if(Number.isFinite(e.attack)&&e.attack>0)kind='expire';break;
 case 'weaken':kind='weaken';break;
 case 'stealthBroken':kind='reveal';break;
 case 'silence':kind='silence';break;
 case 'transform':kind='transform';break;
 case 'revive':case 'specialSummon':kind='summon';target=e.instanceId;break;
 case 'play':{const type=definition(e.cardId)?.type;if(type==='spell'){kind='spell';target='hero';}else if(type==='minion'&&summons.has(e)){kind='summon';target=summons.get(e);}break;}
 case 'secretReveal':kind='secret';target='hero';break;
 case 'death':kind='death';target='grave';break;
 }
 if(!kind||target==null||(seat!==0&&seat!==1))continue;
 const node=findNode(seat,target);if(node&&(!marked.has(node)||strength[kind]>=strength[marked.get(node)]))marked.set(node,kind);
 }
 for(const [node,kind] of marked)node.className+=' impact-'+kind;
 return marked;
}
// Aggregate per visible surviving target. The log retains all individual events.
export function appendImpactAmounts(events,findNode){
 const totals=new Map();
 for(const e of events){
  const damage=e.type==='damage',heal=e.type==='heal'||e.type==='lifesteal',shield=e.type==='shieldBroken';
  if((!damage&&!heal&&!shield)||(e.seat!==0&&e.seat!==1))continue;
  const amount=shield?e.prevented:e.amount;if(!Number.isSafeInteger(amount)||amount<=0)continue;
  if(shield&&(typeof e.target!=='string'||e.target==='hero'))continue;
  const target=findNode(e.seat,e.target??'hero');if(typeof target?.append!=='function')continue;
  const count=totals.get(target)||[0,0,0,0];count[damage?0:heal?1:2]+=amount;if(e.type==='lifesteal')count[3]+=amount;totals.set(target,count);
 }
 for(const [target,[damage,heal,shield,stolen]] of totals){
  if(![damage,heal,shield,stolen].every(Number.isSafeInteger))continue;
  const badge=document.createElement('span');
  // Actual damage/healing takes precedence over prevented damage on the same target.
  badge.className='impact-amount'+(damage?' has-damage':'')+(heal?' has-heal':'')+(damage&&heal?' has-mixed':'')+(!damage&&!heal&&shield?' has-block':'')+(!damage&&heal>0&&heal===stolen?' has-lifesteal':'');
  badge.setAttribute('aria-hidden','true');badge.textContent=damage||heal?[damage?`−${damage}`:'',heal?`+${heal}`:''].filter(Boolean).join(' / '):`盾 ${shield}防御`;
  target.append(badge);
 }
}
// Ordinary play events contain no instance ID. Only use a uniquely identifiable
// new public board instance; never guess from position, hand contents or card name.
function boardIds(match){return [0,1].map(i=>new Set((match.players?.[i]?.board??[]).map(c=>c.instanceId)));}
export function resolvePlayedMinions(events,previousIds,players,definition){
 const result=new Map();if(!previousIds||!players)return result;
 const excluded=new Set(events.flatMap(e=>e.type==='revive'||e.type==='specialSummon'||e.type==='returnHand'||e.type==='death'?[e.instanceId]:e.type==='transform'?[e.target]:[]));
 for(const e of events){if(e.type!=='play'||(e.seat!==0&&e.seat!==1)||definition(e.cardId)?.type!=='minion')continue;
  if(events.filter(x=>x.type==='play'&&x.seat===e.seat&&x.cardId===e.cardId).length!==1)continue;
  const candidates=(players[e.seat]?.board??[]).filter(c=>c.cardId===e.cardId&&!previousIds[e.seat].has(c.instanceId)&&!excluded.has(c.instanceId));
  if(candidates.length===1)result.set(e,candidates[0].instanceId);
 }return result;
}
// At most one trajectory, only for an unambiguous completed public attack.
// No trajectory if either participant has left the board or a secret intervened.
export function attackEndpoints(events,findNode){
 const attacks=events.filter(e=>e.type==='attack');if(attacks.length!==1||events.some(e=>e.type==='attackCancelled'||e.type==='secretReveal'))return null;
 const e=attacks[0];if((e.seat!==0&&e.seat!==1)||typeof e.attacker!=='string'||typeof e.target!=='string')return null;
 if(!events.some(x=>x.seat===1-e.seat&&x.target===e.target&&(x.type==='damage'&&x.amount>0||x.type==='shieldBroken')))return null;
 const source=findNode(e.seat,e.attacker),target=findNode(1-e.seat,e.target);return source&&target&&source!==target?[source,target]:null;
}
// One public turn-start cue. The visual state has already been committed;
// no new draw/card information or timing dependency is introduced.
export function markTurnMana(events,findNode){
 const turns=events.filter(e=>e.type==='turn');
 if(turns.length!==1||events.some(e=>e.type==='finish'))return;
 const {seat}=turns[0];if(seat!==0&&seat!==1)return;
 const node=findNode(seat,'mana');if(!node)return;
 node.className+=' impact-mana';
}
// Public zone changes: one cue per zone and seat; no hand contents, card IDs,
// or speculative targets. Opposing mana deltas use the neutral mixed cue.
export function markZoneChanges(events,findNode){
 const seats=[{up:false,down:false,hand:null,discard:false,death:false},{up:false,down:false,hand:null,discard:false,death:false}];
 for(const e of events){if(e.seat!==0&&e.seat!==1)continue;const state=seats[e.seat];switch(e.type){
  case 'manaChange':for(const delta of [e.mana,e.maxMana])if(Number.isFinite(delta)){if(delta>0)state.up=true;if(delta<0)state.down=true;}break;
  case 'costChange':if(e.count>0&&(e.direction==='up'||e.direction==='down')){const kind='cost-'+e.direction;state.hand=state.hand?.startsWith('cost-')&&state.hand!==kind?'cost-mixed':kind;}break;
  case 'returnHand':case 'generate':case 'fetch':case 'recover':if(!state.hand)state.hand='receive';break;
  case 'discard':state.discard=true;break;
  case 'death':state.death=true;break;
 }}
 for(const [seat,state] of seats.entries()){
  const mana=state.up||state.down?findNode(seat,'mana'):null;
  if(mana)mana.className+=' impact-mana-'+(state.up&&state.down?'mixed':state.up?'up':'down');
  const hand=state.hand?findNode(seat,'hand'):null;
  if(hand)hand.className+=' impact-hand-'+state.hand;
  const grave=state.discard&&!state.death?findNode(seat,'grave'):null;
  if(grave)grave.className+=' impact-grave-discard';
 }
}
// Public resource deltas; repeated cost changes may affect the same cards.
export function appendResourceAmounts(events,findNode){
 const seats=Array.from({length:2},()=>({mana:0,max:0,up:false,down:false,invalid:false,costs:0,count:0,costUp:false,costDown:false,generated:0,otherHand:false}));
 for(const e of events){if(e.seat!==0&&e.seat!==1)continue;const a=seats[e.seat];
  if(e.type==='manaChange'){if(!Number.isSafeInteger(e.mana)||!Number.isSafeInteger(e.maxMana)){a.invalid=true;continue;}a.mana+=e.mana;a.max+=e.maxMana;a.up ||= e.mana>0||e.maxMana>0;a.down ||= e.mana<0||e.maxMana<0;}
  else if(e.type==='costChange'&&Number.isSafeInteger(e.count)&&e.count>0&&['up','down'].includes(e.direction)){a.costs++;a.count=e.count;a.costUp ||= e.direction==='up';a.costDown ||= e.direction==='down';}
  else if(e.type==='generate')a.generated++;
  else if(['draw','burn','fetch','recover','discard','returnHand','costChange'].includes(e.type))a.otherHand=true;
 }
 const signed=n=>n>0?`+${n}`:`−${-n}`;
 function badge(seat,zone,kind,text){const node=findNode(seat,zone);if(typeof node?.append!=='function'||typeof globalThis.document?.createElement!=='function')return;const b=document.createElement('span');b.className=`fx-resource-amount fx-resource-${kind}`;b.setAttribute('aria-hidden','true');b.textContent=text;node.append(b);}
 for(const [seat,a] of seats.entries()){
  if(!a.invalid&&(a.up||a.down)){const mixed=a.up&&a.down,kind=mixed?'mixed':a.up?'up':'down';const parts=[a.mana?`マナ${signed(a.mana)}`:'',a.max?`上限${signed(a.max)}`:''].filter(Boolean);badge(seat,'mana',kind,mixed?'マナ変動':parts.join(' / '));}
  if(a.costs){const mixed=a.costUp&&a.costDown,kind=mixed?'mixed':a.costDown?'up':'down';badge(seat,'zones',kind,mixed?'コスト変動':`コスト${a.costDown?'↓':'↑'}${a.costs===1?` ${a.count}枚`:''}`);}
  else if(a.generated&&!a.otherHand)badge(seat,'zones','generated',`生成 ${a.generated}枚`);
 }
}
// Draw and overflow are public seat-level events. Never inspect card IDs or hands.
// Mark at most two deck slots; overflow takes precedence within one revision.
function deckCues(events){
 const cues=[null,null];for(const e of events){if(e.seat!==0&&e.seat!==1)continue;if(e.type==='burn')cues[e.seat]='burn';else if(e.type==='draw'&&!cues[e.seat])cues[e.seat]='draw';}return cues;
}
export function markDeckPiles(events,findNode){
 for(const [seat,kind] of deckCues(events).entries()){if(!kind)continue;const node=findNode(seat,'deck');if(node)node.className+=' impact-deck-'+kind;}
}
// A generic card back per drawing seat, not a card face or a specific hand slot.
// Overflow and terminal revisions suppress travel, retaining the deck flash.
export function drawEndpoints(events,findNode){
 if(events.some(e=>e.type==='finish'))return [];
 const pairs=[];for(const [seat,kind] of deckCues(events).entries()){if(kind!=='draw')continue;const source=findNode(seat,'deck'),target=findNode(seat,'hand');if(source&&target&&source!==target)pairs.push([source,target]);}return pairs;
}
// Generic zone-to-zone travel, one card-back per seat. Draw has priority;
// a burn, a terminal revision, or competing transfer directions suppress it.
// No event card ID or private hand slot is read.
export function transferEndpoints(events,findNode,previousIds){
 if(events.some(e=>e.type==='finish'))return [];
 const cues=[new Set(),new Set()];
 for(const e of events){if(e.seat!==0&&e.seat!==1)continue;if(['draw','burn','fetch','recover','discard','revive','returnHand','specialSummon'].includes(e.type))cues[e.seat].add(e.type);}
 const pairs=[];for(const [seat,kinds] of cues.entries()){
  if(kinds.has('burn')||kinds.has('draw')||kinds.size!==1)continue;
  const kind=[...kinds][0];let zones={fetch:['deck','hand'],recover:['grave','hand'],discard:['hand','grave']}[kind];
  if(kind==='revive'){const revives=events.filter(e=>e.type==='revive'&&e.seat===seat);if(revives.length!==1)continue;const id=revives[0].instanceId;if(typeof id!=='string'||!/^\d+:\d+$/.test(id)||!id.startsWith(`${seat}:`)||events.some(e=>e.seat===seat&&(e.type==='death'||e.type==='returnHand')&&e.instanceId===id))continue;zones=['grave',id];}
  // A bounce starts at the public board zone, not an invented former card position.
  if(kind==='returnHand'){const returns=events.filter(e=>e.type==='returnHand'&&e.seat===seat);if(returns.length!==1)continue;const id=returns[0].instanceId;if(typeof id!=='string'||!id.startsWith(`${seat}:`)||!previousIds?.[seat]?.has(id)||findNode(seat,id))continue;zones=['board','hand'];}
  if(!zones)continue;
  const source=findNode(seat,zones[0]),target=findNode(seat,zones[1]);if(source&&target&&source!==target)pairs.push([source,target,kind]);
 }return pairs;
}
// Match only an explicit public poison event to a subsequent death of the same
// instance. This describes a poison event, not an inferred cause of death.
export function poisonedDeaths(events){
 const pending=new Set(),seats=new Set();
 for(const e of events){if(e.seat!==0&&e.seat!==1)continue;
  const id=['death','returnHand','revive','specialSummon'].includes(e.type)?e.instanceId:e.target;
  if(typeof id!=='string'||!/^\d+:\d+$/.test(id)||!id.startsWith(`${e.seat}:`))continue;
  if(e.type==='poisonous')pending.add(id);
  else if(e.type==='death'){if(pending.delete(id))seats.add(e.seat);}
  else if(e.type==='returnHand'||e.type==='transform'||e.type==='silence')pending.delete(id);
 }return seats;
}
// One short numeric badge per surviving public minion. If effects of different
// kinds collide, the existing aura/log is sufficient. Never infer final stats.
export function appendStatAmounts(events,findNode,marked){
 const byTarget=new Map();
 const kinds={buff:'buff',tempBuff:'buff',weaken:'weaken',tempExpired:'expire',setStat:'stat'};
 for(const e of events){if(e.seat!==0&&e.seat!==1)continue;const id=['death','returnHand','revive','specialSummon'].includes(e.type)?e.instanceId:e.target;
  if(typeof id!=='string'||!/^\d+:\d+$/.test(id)||!id.startsWith(`${e.seat}:`))continue;
  const kind=kinds[e.type];if(!kind&&!['death','returnHand','silence','transform','keywordGranted','revive','specialSummon'].includes(e.type))continue;
  const node=findNode(e.seat,id);if(!node)continue;const a=byTarget.get(node)||{kind,attack:0,health:0,blocked:false,sets:0};byTarget.set(node,a);
  if(!kind||a.kind!==kind){a.blocked=true;continue;}
  if(kind==='stat'){if(++a.sets!==1||!['attack','health'].includes(e.stat)||!Number.isSafeInteger(e.amount)||e.amount<0){a.blocked=true;continue;}a.stat=e.stat;a.amount=e.amount;}
  else{for(const key of ['attack','health']){if(e[key]===undefined)continue;if(!Number.isSafeInteger(e[key])||e[key]<0){a.blocked=true;continue;}a[key]+=e[key];}}
 }
 for(const [node,a] of byTarget){if(a.blocked||marked.get(node)!==a.kind||!a.kind)continue;
  const sign=a.kind==='buff'?'+':'−';const parts=a.kind==='stat'?[`${a.stat==='attack'?'攻':'体'}=${a.amount}`]:[a.attack?`攻${sign}${a.attack}`:'',a.health?`体${sign}${a.health}`:''].filter(Boolean);
  if(!parts.length||typeof node.append!=='function')continue;
  const badge=document.createElement('span');badge.className='fx-stat-amount fx-stat-'+a.kind;badge.setAttribute('aria-hidden','true');badge.textContent=parts.join(' / ');node.append(badge);
 }
}
// A bounded public count at the relevant pile, not an estimate of lost HP.
// Keep it separate from card/hero damage badges and never inspect a card ID.
export function appendPileAmounts(events,findNode){
 const counts=[[0,0],[0,0]],poison=poisonedDeaths(events);
 for(const e of events){if(e.seat!==0&&e.seat!==1)continue;if(e.type==='death')counts[e.seat][0]++;else if(e.type==='burn')counts[e.seat][1]++;}
 for(const [seat,values] of counts.entries())for(const [i,count] of values.entries()){
  if(!count)continue;const target=findNode(seat,i===0?'grave':'deck');if(typeof target?.append!=='function'||typeof globalThis.document?.createElement!=='function')continue;
  const badge=document.createElement('span');badge.className='fx-pile-amount '+(i===0?'fx-pile-death':'fx-pile-burn')+(i===0&&poison.has(seat)?' fx-pile-poison':'');badge.setAttribute('aria-hidden','true');badge.textContent=(i===0?'撃破 ':'消失 ')+count;target.append(badge);
 }
}
// Public per-event counts, not a net hand-size delta. Retain at most one
// badge per pile and give existing burn/death indicators precedence.
export function appendZoneCounts(events,findNode,match){
 const counts=[Object.create(null),Object.create(null)];
 for(const e of events){if(e.seat!==0&&e.seat!==1)continue;if(!['draw','burn','fetch','recover','discard','death','specialSummon','revive'].includes(e.type))continue;const c=counts[e.seat];c[e.type]=(c[e.type]||0)+1;}
 const finish=events.filter(e=>e.type==='finish');
 const emptySeat=match?.status==='finished'&&match.reason==='deck'&&(match.winner===0||match.winner===1)&&finish.length===1&&finish[0].reason==='deck'&&finish[0].winner===match.winner?1-match.winner:null;
 function badge(seat,zone,kind,text){const target=findNode(seat,zone);if(typeof target?.append!=='function'||typeof globalThis.document?.createElement!=='function')return;const b=document.createElement('span');b.className='fx-zone-count fx-zone-'+kind;b.setAttribute('aria-hidden','true');b.textContent=text;target.append(b);}
 for(const [seat,c] of counts.entries()){
  if(!c.burn){if(seat===emptySeat)badge(seat,'deck','empty','山札切れ');else if(c.fetch&&!c.draw&&!c.specialSummon)badge(seat,'deck','fetch',`サーチ ${c.fetch}枚`);else if(c.draw>1&&!c.fetch&&!c.specialSummon)badge(seat,'deck','draw',`ドロー ${c.draw}枚`);}
  if(!c.death){if(c.recover&&!c.discard&&!c.revive)badge(seat,'grave','recover',`回収 ${c.recover}枚`);else if(c.discard&&!c.recover&&!c.revive)badge(seat,'grave','discard',`破棄 ${c.discard}枚`);}
 }
}
// Secret counts and event seats are public. Only decorate the public pile;
// never name or reveal a set secret. Reveal takes precedence in one revision.
export function markSecretPiles(events,findNode){
 const cues=[null,null];for(const e of events){if(e.seat!==0&&e.seat!==1)continue;if(e.type==='secretReveal')cues[e.seat]='reveal';else if(e.type==='secretSet'&&!cues[e.seat])cues[e.seat]='set';}
 for(const [seat,kind] of cues.entries()){if(!kind)continue;const node=findNode(seat,'secret');if(node)node.className+=' impact-secret-'+kind;}
}
// Only a confirmed terminal snapshot can turn a generic finish chip into a result.
export function resultCue(match,events,seat){
 if(match.status!=='finished'||(seat!==0&&seat!==1))return null;
 const finishes=events.filter(e=>e.type==='finish');if(finishes.length!==1||finishes[0].winner!==match.winner||finishes[0].reason!==match.reason)return null;
 if(match.winner===null)return ['draw','引き分け'];if(match.winner!==0&&match.winner!==1)return null;
 return match.winner===seat?['win','勝利']:['loss','敗北'];
}
// Named cues use only explicitly public played spells and revealed secrets.
export function publicRevealCue(events,definition,kind,viewerSeat){
 if((viewerSeat!==0&&viewerSeat!==1)||!['spell','secret'].includes(kind))return null;
 let cue=null;for(const e of events){
  if((e.seat!==0&&e.seat!==1)||e.type!==(kind==='spell'?'play':'secretReveal')||typeof e.cardId!=='string')continue;
  const d=definition(e.cardId);if(d?.type!==kind||typeof d.name!=='string'||!d.name.trim())continue;
  if(cue)return null;
  cue={name:d.name,side:e.seat===viewerSeat?'自分':'相手',art:/^[a-z][a-z0-9-]{0,31}$/.test(e.cardId)?e.cardId:null};
 }return cue;
}
// Summon names are public only after play, special summon or revival.
// Never choose a name when several summons share the same revision.
export function summonRevealCue(events,definition,viewerSeat){
 if(viewerSeat!==0&&viewerSeat!==1)return null;
 let cue=null;for(const e of events){
  if((e.seat!==0&&e.seat!==1)||!['play','specialSummon','revive'].includes(e.type)||typeof e.cardId!=='string')continue;
  const d=definition(e.cardId);if(d?.type!=='minion'||typeof d.name!=='string'||!d.name.trim())continue;
  if(cue)return null;
  cue={name:d.name,side:e.seat===viewerSeat?'自分':'相手',art:/^[a-z][a-z0-9-]{0,31}$/.test(e.cardId)?e.cardId:null,label:e.type==='revive'?'蘇生':e.type==='specialSummon'?'特殊召喚':'召喚'};
 }return cue;
}
// Generic card travels from the hand zone, not a guessed prior hand slot.
// The destination must be a uniquely resolved surviving ordinary summon.
export function summonEndpoints(events,findNode,summons){
 if(events.some(e=>e.type==='finish')||summons.size!==1)return [];
 const [[e,id]]=summons;
 if(events.some(x=>x.seat===e.seat&&['draw','burn','fetch','recover','discard','revive','returnHand','specialSummon','generate'].includes(x.type)))return [];
 const source=findNode(e.seat,'hand'),target=findNode(e.seat,id);
 return source&&target&&source!==target?[[source,target,'summon']]:[];
}
// A public minion's triggered recipe is not necessarily a successful effect.
// Name only one explicit non-skipped trigger, without guessing a board instance.
export function triggeredMinionCue(events,definition,viewerSeat){
 if((viewerSeat!==0&&viewerSeat!==1)||events.some(e=>e.type==='finish'))return null;
 const labels={summon:'登場時効果',death:'死亡時効果',turnStart:'ターン開始時効果',turnEnd:'ターン終了時効果'};
 const triggers=events.filter(e=>e.type==='ability'&&Object.hasOwn(labels,e.when));
 if(triggers.length!==1)return null;
 const e=triggers[0];if((e.seat!==0&&e.seat!==1)||typeof e.cardId!=='string'||events.some(x=>x.type==='abilitySkipped'&&x.seat===e.seat&&x.cardId===e.cardId))return null;
 const d=definition(e.cardId);if(d?.type!=='minion'||typeof d.name!=='string'||!d.name.trim())return null;
 const follow=events.some(x=>x.type==='abilityFollowUp'&&x.seat===e.seat&&x.cardId===e.cardId);
 return {name:d.name,side:e.seat===viewerSeat?'自分':'相手',art:/^[a-z][a-z0-9-]{0,31}$/.test(e.cardId)?e.cardId:null,label:labels[e.when]+(follow?'・追加効果':'')};
}
// A single public death can identify the defeated card without reconstructing
// the old board. Never infer the cause from damage totals or hidden zones.
export function defeatedMinionCue(events,definition,viewerSeat){
 if((viewerSeat!==0&&viewerSeat!==1)||events.some(e=>e.type==='finish'))return null;
 const deaths=events.filter(e=>e.type==='death');if(deaths.length!==1)return null;
 const e=deaths[0];if((e.seat!==0&&e.seat!==1)||typeof e.cardId!=='string'||typeof e.instanceId!=='string'||!/^\d+:\d+$/.test(e.instanceId)||!e.instanceId.startsWith(`${e.seat}:`))return null;
 const d=definition(e.cardId);if(d?.type!=='minion'||typeof d.name!=='string'||!d.name.trim())return null;
 const causes=new Set(events.filter(x=>(x.type==='destroy'||x.type==='poisonous')&&x.seat===e.seat&&x.target===e.instanceId&&x.cardId===e.cardId).map(x=>x.type));
 const label=causes.size===1?(causes.has('destroy')?'効果で破壊':'猛毒で撃破'):'撃破';
 return {name:d.name,side:e.seat===viewerSeat?'自分':'相手',art:/^[a-z][a-z0-9-]{0,31}$/.test(e.cardId)?e.cardId:null,label};
}
// Named status cues require one explicit public board event. The shield amount
// is prevention, never damage or a change to HP. Do not name competing targets.
export function publicStatusCue(events,definition,kind,viewerSeat){
 if((viewerSeat!==0&&viewerSeat!==1)||!['shield','silence'].includes(kind)||events.some(e=>e.type==='finish'))return null;
 const type=kind==='shield'?'shieldBroken':'silence';const matches=events.filter(e=>e.type===type);if(matches.length!==1)return null;
 const e=matches[0];if((e.seat!==0&&e.seat!==1)||typeof e.target!=='string'||!/^([01]):(0|[1-9][0-9]?)$/.test(e.target)||!e.target.startsWith(`${e.seat}:`)||typeof e.cardId!=='string')return null;
 if(kind==='shield'&&(!Number.isSafeInteger(e.prevented)||e.prevented<=0))return null;
 const d=definition(e.cardId);if(d?.type!=='minion'||typeof d.name!=='string'||!d.name.trim())return null;
 return {name:d.name,side:e.seat===viewerSeat?'自分':'相手',art:/^[a-z][a-z0-9-]{0,31}$/.test(e.cardId)?e.cardId:null,label:kind==='shield'?`盾で${e.prevented}防御`:'沈黙'};
}
// A skipped effect can be shown without inspecting its source or implying that
// all other effects failed. Keep the existing chip and audio budgets intact.
export function skippedEffectCue(events){
 if(events.some(e=>e.type==='finish'))return null;
 const count=events.filter(e=>e.type==='abilitySkipped'&&(e.seat===0||e.seat===1)).length;
 return count===0?null:count===1?'効果不発':`効果不発 ${count}件`;
}
// Only explicit public returns reveal a name; no lookup of hand contents.
export function returnedMinionCue(events,definition,viewerSeat){
 if((viewerSeat!==0&&viewerSeat!==1)||events.some(e=>e.type==='finish'))return null;
 const returns=events.filter(e=>e.type==='returnHand');if(returns.length!==1)return null;
 const e=returns[0];if((e.seat!==0&&e.seat!==1)||typeof e.instanceId!=='string'||!/^\d+:\d+$/.test(e.instanceId)||!e.instanceId.startsWith(`${e.seat}:`)||typeof e.cardId!=='string')return null;
 const d=definition(e.cardId);if(d?.type!=='minion'||typeof d.name!=='string'||!d.name.trim())return null;
 return {name:d.name,side:e.seat===viewerSeat?'自分':'相手',art:/^[a-z][a-z0-9-]{0,31}$/.test(e.cardId)?e.cardId:null,label:'手札へ戻る'};
}
// These three events expose a card that has entered or left the public grave.
// Never inspect hand/deck contents, or guess a card when transfers compete.
export function publicGraveTransferCue(events,definition,viewerSeat){
 if((viewerSeat!==0&&viewerSeat!==1)||events.some(e=>e.type==='finish'))return null;
 const labels={recover:'墓地回収',discard:'手札破棄',burn:'手札上限で消失'};
 const moves=events.filter(e=>Object.hasOwn(labels,e.type));if(moves.length!==1)return null;
 const e=moves[0];if((e.seat!==0&&e.seat!==1)||typeof e.cardId!=='string')return null;
 const d=definition(e.cardId);if(!d||!['minion','spell','secret'].includes(d.type)||typeof d.name!=='string'||!d.name.trim())return null;
 return {name:d.name,side:e.seat===viewerSeat?'自分':'相手',art:/^[a-z][a-z0-9-]{0,31}$/.test(e.cardId)?e.cardId:null,label:labels[e.type],kind:e.type};
}
// No secret identities, no new sound, no additional chips beyond the existing budget.
export function secretPlacementCue(events,viewerSeat){
 if((viewerSeat!==0&&viewerSeat!==1)||events.some(e=>e.type==='finish'||e.type==='secretReveal'))return null;
 const sets=events.filter(e=>e.type==='secretSet');if(sets.length!==1)return null;
 const {seat}=sets[0];if(seat!==0&&seat!==1)return null;
 return `${seat===viewerSeat?'自分':'相手'}・秘策設置`;
}
export function cancelledAttackCue(events,viewerSeat){
 if((viewerSeat!==0&&viewerSeat!==1)||events.some(e=>e.type==='finish'))return null;
 const cancels=events.filter(e=>e.type==='attackCancelled');if(cancels.length!==1)return null;
 const {seat}=cancels[0];if(seat!==0&&seat!==1)return null;
 return `${seat===viewerSeat?'自分':'相手'}・攻撃中断`;
}
// A transform names the resulting public minion, not the caster or old form.
export function transformRevealCue(events,definition,viewerSeat){
 if((viewerSeat!==0&&viewerSeat!==1)||events.some(e=>e.type==='finish'))return null;
 const forms=events.filter(e=>e.type==='transform');if(forms.length!==1)return null;
 const e=forms[0];if((e.seat!==0&&e.seat!==1)||typeof e.cardId!=='string'||typeof e.target!=='string'||!/^\d+:\d+$/.test(e.target)||!e.target.startsWith(`${e.seat}:`))return null;
 const d=definition(e.cardId);if(d?.type!=='minion'||typeof d.name!=='string'||!d.name.trim())return null;
 return {name:d.name,side:e.seat===viewerSeat?'自分':'相手',art:/^[a-z][a-z0-9-]{0,31}$/.test(e.cardId)?e.cardId:null,label:'変身後'};
}
// Short presentation-only labels; the rules and actual keyword badges stay unchanged.
const keywordCueLabels=Object.freeze({taunt:'挑発',charge:'速攻',rush:'急襲',divineShield:'聖なる盾',windfury:'疾風',lifesteal:'生命奪取',poisonous:'猛毒',stealth:'潜伏',spellDamage:'呪文強化'});
export function appendKeywordCues(events,findNode,marked){
 const byTarget=new Map();
 for(const e of events){if((e.seat!==0&&e.seat!==1)||typeof e.target!=='string'||!/^\d+:\d+$/.test(e.target)||!e.target.startsWith(`${e.seat}:`))continue;
  if(!['keywordGranted','buff','tempBuff','weaken','setStat','tempExpired','silence','transform','stealthBroken','shieldBroken'].includes(e.type))continue;
  const n=findNode(e.seat,e.target);if(!n)continue;
  const cue=e.type==='silence'?'silence':e.type==='stealthBroken'?'reveal':e.type==='keywordGranted'&&Object.hasOwn(keywordCueLabels,e.keyword)?e.keyword:null;if(byTarget.has(n)||!cue){byTarget.set(n,null);continue;}byTarget.set(n,cue);
 }
 for(const [n,k] of byTarget){if(!k||marked.get(n)!==(k==='silence'?'silence':k==='reveal'?'reveal':k==='divineShield'?'ward':'buff')||typeof n.append!=='function')continue;
  const badge=document.createElement('span');badge.className='fx-keyword-cue'+(k==='divineShield'?' fx-keyword-shield':k==='silence'?' fx-keyword-silence':k==='reveal'?' fx-keyword-reveal':'');badge.setAttribute('aria-hidden','true');badge.textContent=k==='silence'?'沈黙':k==='reveal'?'潜伏解除':keywordCueLabels[k]+' 付与';n.append(badge);
 }
}
export function turnCue(events,viewerSeat){
 if(viewerSeat!==0&&viewerSeat!==1||events.some(e=>e.type==='finish'))return null;
 const turns=events.filter(e=>e.type==='turn');if(turns.length!==1)return null;
 const {seat,turn}=turns[0];if((seat!==0&&seat!==1)||!Number.isSafeInteger(turn)||turn<1)return null;
 return {own:seat===viewerSeat,text:seat===viewerSeat?'自分のターン':'相手のターン',turn};
}
function decorateReveal(chip,cue,kind){
 chip.className+=' fx-card-reveal';const art=document.createElement('span');art.className='fx-reveal-art';if(cue.art)art.setAttribute('data-standard-art',cue.art);art.setAttribute('aria-hidden','true');
 const info=document.createElement('span');info.className='fx-reveal-info';const label=document.createElement('span');label.className='fx-reveal-side';label.textContent=cue.side+'・'+(cue.label??(kind==='secret'?'秘策発動':'スペル'));const name=document.createElement('span');name.className='fx-reveal-name';name.textContent=cue.name;info.append(label);info.append(name);chip.append(art);chip.append(info);
}
function appendAuras(marked){for(const [target,kind] of marked){if(typeof target.append!=='function')continue;const aura=document.createElement('span');aura.className='impact-aura aura-'+kind;aura.setAttribute('aria-hidden','true');target.append(aura);}}
// One animation frame allows layout after the new DOM is attached. It is purely
// decorative, bounded, and abandoned if the render is already obsolete.
function appendTravel(layer,endpoints,draws,transfers){
 if((!endpoints&&!draws.length&&!transfers.length)||typeof globalThis.requestAnimationFrame!=='function')return;
 globalThis.requestAnimationFrame(()=>{try{
  if(!layer.isConnected||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||layer.closest('.motion-off'))return;
  const r=layer.getBoundingClientRect();if(!r.width||!r.height)return;
  function geometry(pair){if(!pair)return null;const [source,target]=pair;if(!source.isConnected||!target.isConnected)return null;
   const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();if(!a.width||!a.height||!b.width||!b.height)return null;
   const x=a.left+a.width/2-r.left,y=a.top+a.height/2-r.top,dx=b.left+b.width/2-a.left-a.width/2,dy=b.top+b.height/2-a.top-a.height/2,len=Math.hypot(dx,dy);
   if(![x,y,dx,dy,len].every(Number.isFinite)||len<1)return null;return {x,y,dx,dy,len,width:a.width,height:a.height};}
  const strikeGeometry=geometry(endpoints),drawGeometry=draws.map(geometry).filter(Boolean),transferGeometry=transfers.map(pair=>{const g=geometry(pair);return g&&{...g,kind:pair[2]};}).filter(Boolean); // read before write
  if(strikeGeometry){const {x,y,dx,dy,len}=strikeGeometry;
   const trail=document.createElement('span');trail.className='fx-attack-trail';trail.setAttribute('aria-hidden','true');trail.setAttribute('style',`left:${x}px;top:${y}px;--trail-length:${len}px;--trail-angle:${Math.atan2(dy,dx)}rad`);layer.append(trail);
   // A non-interactive portrait echo lunges forward and retreats. The real
   // card and its hitbox stay in place. Use only the existing public portrait.
   const source=endpoints[0],portrait=source.querySelector?.('.card-art:not([hidden])'),emblem=source.querySelector?.('.card-emblem[data-standard-art]:not([hidden])');
   const echo=document.createElement('span');echo.className='fx-attack-lunge';echo.setAttribute('aria-hidden','true');
   const size=Math.min(54,Math.max(22,Math.min(strikeGeometry.width,strikeGeometry.height)*.68));
   echo.setAttribute('style',`left:${x}px;top:${y}px;--lunge-x:${dx}px;--lunge-y:${dy}px;--lunge-size:${size}px`);
   const art=document.createElement('span');art.className='fx-lunge-art';
   if(portrait?.complete&&portrait.naturalWidth>0&&/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(portrait.currentSrc||'')){const img=document.createElement('img');img.alt='';img.src=portrait.currentSrc;art.append(img);}
   else if(emblem){art.setAttribute('data-standard-art',emblem.getAttribute('data-standard-art'));}
   else art.textContent='⚔';
   echo.append(art);layer.append(echo);
   const strike=document.createElement('span');strike.className='fx-attack-strike';strike.setAttribute('aria-hidden','true');strike.setAttribute('style',`left:${x+dx}px;top:${y+dy}px;--strike-angle:${Math.atan2(dy,dx)}rad`);layer.append(strike);
  }
  for(const {x,y,dx,dy} of drawGeometry){const token=document.createElement('span');token.className='fx-draw-flight';token.setAttribute('aria-hidden','true');token.setAttribute('style',`left:${x}px;top:${y}px;--draw-x:${dx}px;--draw-y:${dy}px`);layer.append(token);}
  for(const {x,y,dx,dy,kind} of transferGeometry){const token=document.createElement('span');token.className='fx-draw-flight fx-transfer-'+kind;token.setAttribute('aria-hidden','true');token.setAttribute('style',`left:${x}px;top:${y}px;--draw-x:${dx}px;--draw-y:${dy}px`);layer.append(token);}
 }catch{/* decoration must never affect play */}});
}
export function createBattleEffects(){let previous=null;return {reset(){previous=null;},observe(match,definition,enabled=true,{sound,findNode,viewerSeat}={}){if(previous?.matchId===match.matchId&&match.revision<=previous.revision)return null;const prior=previous,next={matchId:match.matchId,revision:match.revision,events:match.events.map(e=>JSON.stringify(e)),boardIds:boardIds(match)};const events=newEvents(prior,next);previous=next;if(!events.length)return null;const messages=summarizeEffects(events,definition);if(messages.length){try{sound?.(messages[0][0]);}catch{}}if(!enabled)return null;const trigger=messages.length<4?triggeredMinionCue(events,definition,viewerSeat):null;if(trigger)messages.push(['trigger',trigger.label]);const skipped=messages.length<4?skippedEffectCue(events):null;if(skipped)messages.push(['skipped',skipped]);const placement=messages.length<4?secretPlacementCue(events,viewerSeat):null;if(placement)messages.push(['secret-set',placement]);const graveTransfer=messages.length<4?publicGraveTransferCue(events,definition,viewerSeat):null;if(graveTransfer)messages.push(['grave-'+graveTransfer.kind,graveTransfer.label]);if(findNode){markDeckPiles(events,findNode);markZoneChanges(events,findNode);appendResourceAmounts(events,findNode);markSecretPiles(events,findNode);appendPileAmounts(events,findNode);appendZoneCounts(events,findNode,match);}const draws=findNode?drawEndpoints(events,findNode):[];const transfers=findNode?transferEndpoints(events,findNode,prior?.boardIds):[];if(!messages.length&&!draws.length&&!transfers.length)return null;const layer=document.createElement('div');layer.className='battle-fx';layer.setAttribute('aria-hidden','true');if(findNode){const summons=resolvePlayedMinions(events,prior?.boardIds,match.players,definition);const marked=markBattleEvents(events,findNode,definition,summons);appendImpactAmounts(events,findNode);appendStatAmounts(events,findNode,marked);appendKeywordCues(events,findNode,marked);appendAuras(marked);markTurnMana(events,findNode);appendTravel(layer,attackEndpoints(events,findNode),draws,[...transfers,...summonEndpoints(events,findNode,summons)]);}const result=resultCue(match,events,viewerSeat);for(const [kind,text] of messages){const chip=document.createElement('span');chip.className='fx-chip fx-'+kind;if(kind==='finish'&&result){chip.className+=' fx-result-'+result[0];chip.textContent=result[1];}else if(kind==='spell'||kind==='secret'||kind==='summon'){const cue=kind==='summon'?summonRevealCue(events,definition,viewerSeat):publicRevealCue(events,definition,kind,viewerSeat);if(cue)decorateReveal(chip,cue,kind);else chip.textContent=text;}else if(kind==='death'){const cue=defeatedMinionCue(events,definition,viewerSeat);if(cue)decorateReveal(chip,cue,kind);else chip.textContent=text;}else if(kind==='shield'||kind==='silence'){const cue=publicStatusCue(events,definition,kind,viewerSeat);if(cue)decorateReveal(chip,cue,kind);else chip.textContent=text;}else if(kind==='bounce'){const cue=returnedMinionCue(events,definition,viewerSeat);if(cue)decorateReveal(chip,cue,kind);else chip.textContent=text;}else if(kind==='cancel'){chip.textContent=cancelledAttackCue(events,viewerSeat)??text;}else if(kind==='transform'){const cue=transformRevealCue(events,definition,viewerSeat);if(cue)decorateReveal(chip,cue,kind);else chip.textContent=text;}else if(kind==='trigger'&&trigger){decorateReveal(chip,trigger,kind);}else if(graveTransfer&&kind==='grave-'+graveTransfer.kind){decorateReveal(chip,graveTransfer,kind);}else if(kind==='turn'){const cue=turnCue(events,viewerSeat);if(cue){chip.className+=' fx-turn-'+(cue.own?'own':'enemy');chip.textContent=`${cue.text} · ${cue.turn}`;}else chip.textContent=text;}else chip.textContent=text;layer.append(chip);}return layer;}};}

// Presentation only. No card definitions, image fetching or battle actions are changed here.
import {CATALOG,description,KEYWORD_LABELS} from './cards.js';
import {effectiveAttack,effectiveMaxHealth,effectiveCost,hasKeyword,hasDivineShield,hasStealth,attackLimit} from './engine.js';
const TYPES=Object.freeze({minion:'ミニオン',spell:'スペル',secret:'秘策'});
function span(cls,text){const n=document.createElement('span');n.className=cls;n.textContent=text;return n;}
export function appendCardFace(parent,d,instance,art,{showDescription=true,lazyArt=false,collectLabels=false}={}){
 const mana=effectiveCost(d,instance),manaLabel=`マナ ${mana}`;const labels=collectLabels?[manaLabel]:null;const cost=span('cost',String(mana));cost.setAttribute('aria-label',manaLabel);
 if(mana!==d.manaCost)cost.setAttribute('data-stat-change',mana<d.manaCost?'positive':'negative');
 parent.append(cost,span('name',d.name),span('card-kind',TYPES[d.type]));
 // CSS-only emblem keeps empty or failed artwork from looking broken, without network requests.
 const emblem=span('card-emblem','');emblem.setAttribute('aria-hidden','true');if(Object.hasOwn(CATALOG,d.id))emblem.setAttribute('data-standard-art',d.id);emblem.hidden=!!art;parent.append(emblem);
 if(art){const img=document.createElement('img');img.className='card-art';img.alt='';img.decoding='async';img.draggable=false;img.setAttribute('aria-hidden','true');if(lazyArt)img.loading='lazy';img.onerror=()=>{img.hidden=true;emblem.hidden=false;};img.src=art;parent.append(img);}
 if(showDescription)parent.append(span('desc',instance.silenced?'沈黙中':description(d)));
 if(d.type==='minion'){
  const attack=effectiveAttack(d,instance),health=instance.currentHealth??d.maxHealth;
  if(labels)labels.push(`攻撃力 ${attack}`,`体力 ${health}`);
  const stats=span('stats','');stats.setAttribute('role','group');stats.setAttribute('aria-label',`攻撃力 ${attack}、体力 ${health}`);const power=span('power',String(attack)),life=span('life',String(health));power.setAttribute('aria-hidden','true');life.setAttribute('aria-hidden','true');if(attack!==d.attack)power.setAttribute('data-stat-change',attack>d.attack?'positive':'negative');const max=effectiveMaxHealth(d,instance);if(health<max||max<d.maxHealth)life.setAttribute('data-stat-change','negative');else if(max>d.maxHealth)life.setAttribute('data-stat-change','positive');stats.append(power,life);parent.append(stats);
 }
 return labels;
}

// Identical live status display for local and network boards.
export function appendBoardStatus(parent,d,c,{compact=false,includeTauntLabel=false}={}){
 if(d.type!=='minion')return;
 const taunt=hasKeyword(d,c,'taunt');parent.setAttribute('data-taunt',String(taunt));
 parent.setAttribute('data-silenced',String(!!c.silenced));
 const shield=hasKeyword(d,c,'divineShield'),stealth=hasKeyword(d,c,'stealth');
 const shieldActive=shield&&hasDivineShield(d,c),stealthActive=stealth&&hasStealth(d,c);
 parent.setAttribute('data-shield-active',String(shieldActive));
 parent.setAttribute('data-stealth-active',String(stealthActive));
 // A compact, bounded row on the network tabletop keeps multiple simultaneous
 // effects from stretching a minion. Full labels remain available in its title
 // and in the read-only inspector. Local developer UI retains the old labels.
 const status=compact?span('board-status',''):parent;
 const labels=[];
 const add=(cls,full,short)=>{const mark=span(cls,compact?short:full);if(compact){mark.setAttribute('title',full);mark.setAttribute('aria-label',full);}status.append(mark);labels.push(full);};
 if(c.silenced){const mark=span('board-silence-mark','沈');mark.setAttribute('aria-label','沈黙中');parent.append(mark);labels.push('沈黙中');}
 if(shield){const active=shieldActive;add(active?'shield-active':'shield-spent',active?'盾：有効':'盾：消費済み','盾');}
 if(stealth){const active=stealthActive;add(active?'stealth-active':'stealth-spent',active?'潜伏：有効':'潜伏：解除済み','潜');}
 if(hasKeyword(d,c,'windfury'))add('attack-count',`攻撃 ${c.attacksUsed}/${attackLimit(d,c)}`,`${c.attacksUsed}/${attackLimit(d,c)}`);
 if(compact){const intrinsic=[['charge','速'],['rush','急'],['lifesteal','吸'],['poisonous','毒'],['spellDamage','呪']].filter(([k])=>!c.silenced&&d.keywords.includes(k));if(intrinsic.length)add('board-keyword-mark',intrinsic.map(([k])=>KEYWORD_LABELS[k]).join('・'),intrinsic.length>2?`能${intrinsic.length}`:intrinsic.map(([,short])=>short).join(''));}
 if(c.grantedKeywords?.length)add('muted',c.grantedKeywords.map(k=>`${KEYWORD_LABELS[k]}（付与）`).join('・'),`付${c.grantedKeywords.length}`);
 if(c.tempAttack)add('temp-attack',`一時 +${c.tempAttack}`,`+${c.tempAttack}`);
 if(compact&&status.children.length)parent.append(status);
 if(includeTauntLabel&&taunt)labels.push(KEYWORD_LABELS.taunt);
 return labels;
}

// Only intrinsic attack restrictions on the active side, not temporary UI locks
// or a lack of legal targets. Uses the engine's effective keyword/attack-limit helpers.
export function boardAttackStatus(d,c,match,owner){
 if(match.status!=='playing'||match.activeSeat!==owner||d.type!=='minion')return null;
 if(c.attacksUsed>=attackLimit(d,c))return ['spent','攻撃回数を消費済み','済'];
 if(c.summonedTurn===match.turnNo&&!hasKeyword(d,c,'charge')&&!hasKeyword(d,c,'rush'))return ['sleep','召喚ターンのため攻撃不可','Zz'];
 return null;
}
